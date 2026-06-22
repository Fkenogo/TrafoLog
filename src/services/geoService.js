const Transformer = require('../models/Transformer');
const { ApiError } = require('../utils/error');
const { logger } = require('../utils/logger');
const haversine = require('haversine');
const turf = require('@turf/turf');

class GeoService {
  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1, lng1, lat2, lng2) {
    try {
      const from = { latitude: lat1, longitude: lng1 };
      const to = { latitude: lat2, longitude: lng2 };
      return haversine(from, to, { unit: 'km' });
    } catch (error) {
      logger.error('Error calculating distance:', error);
      return null;
    }
  }

  /**
   * Find nearby transformers
   */
  async findNearbyTransformers(latitude, longitude, radius = 5, filters = {}) {
    try {
      const query = {
        is_deleted: false,
        gps: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [parseFloat(longitude), parseFloat(latitude)]
            },
            $maxDistance: radius * 1000 // Convert km to meters
          }
        }
      };

      // Apply additional filters
      if (filters.territory_id) {
        query['location_operational.territory_id'] = filters.territory_id;
      }
      if (filters.network_voltage_kv) {
        query.network_voltage_kv = parseInt(filters.network_voltage_kv);
      }
      if (filters.operational_status) {
        query.operational_status = filters.operational_status;
      }

      const transformers = await Transformer.find(query)
        .populate('rating_id')
        .limit(filters.limit || 50);

      // Calculate distance for each transformer
      const results = transformers.map(transformer => {
        const distance = this.calculateDistance(
          latitude,
          longitude,
          transformer.gps.coordinates[1],
          transformer.gps.coordinates[0]
        );

        return {
          transformer,
          distance: distance || 0,
          distanceKm: distance ? distance.toFixed(2) : 'Unknown'
        };
      });

      // Sort by distance
      results.sort((a, b) => a.distance - b.distance);

      return results;
    } catch (error) {
      logger.error('Error finding nearby transformers:', error);
      throw new ApiError(500, 'Failed to find nearby transformers');
    }
  }

  /**
   * Get transformers within a polygon
   */
  async getTransformersInPolygon(polygonCoordinates) {
    try {
      const polygon = turf.polygon([polygonCoordinates]);
      
      const transformers = await Transformer.find({
        is_deleted: false,
        gps: {
          $geoWithin: {
            $geometry: {
              type: 'Polygon',
              coordinates: [polygonCoordinates]
            }
          }
        }
      });

      return transformers;
    } catch (error) {
      logger.error('Error getting transformers in polygon:', error);
      throw new ApiError(500, 'Failed to get transformers in polygon');
    }
  }

  /**
   * Get route between two points
   */
  async getRoute(startLat, startLng, endLat, endLng) {
    try {
      // This would integrate with a routing service like Mapbox or Google Maps
      // For now, return a simple straight line
      const start = [startLng, startLat];
      const end = [endLng, endLat];
      
      const route = {
        start,
        end,
        distance: this.calculateDistance(startLat, startLng, endLat, endLng),
        path: turf.lineString([start, end])
      };

      return route;
    } catch (error) {
      logger.error('Error getting route:', error);
      throw new ApiError(500, 'Failed to get route');
    }
  }

  /**
   * Geocode address to coordinates
   */
  async geocodeAddress(address) {
    try {
      // This would integrate with a geocoding service
      // For now, return mock data
      return {
        address,
        coordinates: {
          latitude: 0.3214,
          longitude: 32.5823
        },
        formattedAddress: `${address}, Kampala, Uganda`
      };
    } catch (error) {
      logger.error('Error geocoding address:', error);
      throw new ApiError(500, 'Failed to geocode address');
    }
  }

  /**
   * Reverse geocode coordinates to address
   */
  async reverseGeocode(latitude, longitude) {
    try {
      // This would integrate with a reverse geocoding service
      // For now, return mock data
      return {
        coordinates: { latitude, longitude },
        formattedAddress: 'Nakawa, Kampala, Uganda',
        components: {
          street: 'Nakawa Road',
          sublocality: 'Nakawa',
          locality: 'Kampala',
          region: 'Central',
          country: 'Uganda',
          postalCode: '256'
        }
      };
    } catch (error) {
      logger.error('Error reverse geocoding:', error);
      throw new ApiError(500, 'Failed to reverse geocode');
    }
  }

  /**
   * Get cluster data for map
   */
  async getClusterData(filters = {}) {
    try {
      const query = { is_deleted: false };
      
      if (filters.territory_id) {
        query['location_operational.territory_id'] = filters.territory_id;
      }
      if (filters.network_voltage_kv) {
        query.network_voltage_kv = parseInt(filters.network_voltage_kv);
      }

      const transformers = await Transformer.find(query)
        .select('asset_id display_rating operational_status gps has_open_fault');

      // Group by grid (e.g., 0.01 degree grid)
      const clusters = {};
      const gridSize = filters.gridSize || 0.01;

      transformers.forEach(transformer => {
        if (!transformer.gps) return;
        
        const lat = transformer.gps.coordinates[1];
        const lng = transformer.gps.coordinates[0];
        
        const latKey = Math.floor(lat / gridSize) * gridSize;
        const lngKey = Math.floor(lng / gridSize) * gridSize;
        const key = `${latKey},${lngKey}`;

        if (!clusters[key]) {
          clusters[key] = {
            center: [lngKey + gridSize / 2, latKey + gridSize / 2],
            count: 0,
            transformers: [],
            statusSummary: {
              active: 0,
              faulty: 0,
              maintenance: 0,
              decommissioned: 0
            }
          };
        }

        clusters[key].count++;
        clusters[key].transformers.push(transformer.asset_id);
        
        if (transformer.has_open_fault) {
          clusters[key].statusSummary.faulty++;
        } else if (transformer.operational_status === 'Under Maintenance') {
          clusters[key].statusSummary.maintenance++;
        } else if (transformer.operational_status === 'Decommissioned') {
          clusters[key].statusSummary.decommissioned++;
        } else {
          clusters[key].statusSummary.active++;
        }
      });

      return {
        clusters: Object.values(clusters),
        total: transformers.length,
        gridSize,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error getting cluster data:', error);
      throw new ApiError(500, 'Failed to get cluster data');
    }
  }

  /**
   * Validate coordinates
   */
  validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      return { valid: false, error: 'Invalid coordinate type' };
    }

    if (latitude < -90 || latitude > 90) {
      return { valid: false, error: 'Invalid latitude' };
    }

    if (longitude < -180 || longitude > 180) {
      return { valid: false, error: 'Invalid longitude' };
    }

    return { valid: true };
  }

  /**
   * Check if point is within radius
   */
  isWithinRadius(lat1, lng1, lat2, lng2, radius) {
    const distance = this.calculateDistance(lat1, lng1, lat2, lng2);
    return distance <= radius;
  }

  /**
   * Get bounding box for area
   */
  getBoundingBox(latitude, longitude, radius) {
    // Approximate 1 degree = 111 km
    const degrees = radius / 111;
    
    return {
      minLat: latitude - degrees,
      maxLat: latitude + degrees,
      minLng: longitude - degrees,
      maxLng: longitude + degrees
    };
  }

  /**
   * Calculate area of polygon
   */
  calculateArea(polygonCoordinates) {
    try {
      const polygon = turf.polygon([polygonCoordinates]);
      const area = turf.area(polygon);
      return area / 1000000; // Convert to square kilometers
    } catch (error) {
      logger.error('Error calculating area:', error);
      return null;
    }
  }

  /**
   * Check if point is inside polygon
   */
  isPointInPolygon(pointLat, pointLng, polygonCoordinates) {
    try {
      const point = turf.point([pointLng, pointLat]);
      const polygon = turf.polygon([polygonCoordinates]);
      return turf.booleanPointInPolygon(point, polygon);
    } catch (error) {
      logger.error('Error checking point in polygon:', error);
      return false;
    }
  }

  /**
   * Get transformer density map
   */
  async getDensityMap(filters = {}) {
    try {
      const query = { is_deleted: false };
      
      if (filters.territory_id) {
        query['location_operational.territory_id'] = filters.territory_id;
      }

      const transformers = await Transformer.find(query)
        .select('gps network_voltage_kv');

      const densityData = {
        total: transformers.length,
        byVoltage: {
          '11kV': transformers.filter(t => t.network_voltage_kv === 11).length,
          '33kV': transformers.filter(t => t.network_voltage_kv === 33).length
        },
        points: transformers
          .filter(t => t.gps)
          .map(t => ({
            coordinates: t.gps.coordinates,
            voltage: t.network_voltage_kv
          }))
      };

      return densityData;
    } catch (error) {
      logger.error('Error getting density map:', error);
      throw new ApiError(500, 'Failed to get density map');
    }
  }
}

module.exports = new GeoService();