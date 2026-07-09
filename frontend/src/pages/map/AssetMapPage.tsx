import { FormEvent, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, LocateFixed, Navigation, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { transformerApi } from '../../api/transformerApi';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { Loading } from '../../components/common/Loading';
import { Transformer } from '../../types/api';
import { getTransformerName } from '../../utils/format';

type LocatedTransformer = Transformer & {
  latitude: number;
  longitude: number;
  distanceKm?: number;
};

type NearbySearch = {
  lat: number;
  lng: number;
  radius: number;
  limit: number;
};

type SearchErrors = Partial<Record<'lat' | 'lng' | 'radius' | 'limit', string>>;

function notRecorded(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  return String(value);
}

function readableLabel(value?: string | number | null) {
  if (value === undefined || value === null || value === '') return 'Not recorded';
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function refName(value?: string | { name?: string; code?: string }) {
  if (!value || typeof value === 'string') return undefined;
  return value.name || value.code;
}

function getSiteLabel(item: Transformer) {
  return item.location_administrative?.site_name || item.site_name || getTransformerName(item);
}

function getTerritory(item: Transformer) {
  return item.location_operational?.territory_name || refName(item.location_operational?.territory_id) || 'Not recorded';
}

function getServiceArea(item: Transformer) {
  return item.location_operational?.service_area_name || refName(item.location_operational?.service_area_id) || 'Not recorded';
}

function getFeeder(item: Transformer) {
  return item.location_operational?.feeder_name || item.location_operational?.feeder_code || refName(item.location_operational?.feeder_id) || 'Not recorded';
}

function getCondition(item: Transformer) {
  return item.condition || item.overall_condition || item.latest_inspection?.physical?.overall_condition || item.latest_inspection?.overall_condition;
}

function getCoordinates(item: Transformer) {
  const [lng, lat] = item.gps?.coordinates ?? [];
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return { latitude: lat, longitude: lng };
}

function toLocated(item: Transformer, search?: NearbySearch): LocatedTransformer | undefined {
  const coordinates = getCoordinates(item);
  if (!coordinates) return undefined;
  return {
    ...item,
    ...coordinates,
    distanceKm: search ? calculateDistanceKm(search.lat, search.lng, coordinates.latitude, coordinates.longitude) : undefined
  };
}

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthKm = 6371;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function markerTone(item: Transformer) {
  const condition = getCondition(item);
  if (item.operational_status === 'Faulty' || condition === 'Critical' || condition === 'Poor') return 'risk';
  if (item.operational_status === 'Under Maintenance' || condition === 'Fair' || item.overdue_inspection_flag) return 'amber';
  if (item.operational_status === 'Active' || condition === 'Good') return 'green';
  return 'neutral';
}

function badgeClass(item: Transformer) {
  const tone = markerTone(item);
  if (tone === 'risk') return 'badge danger';
  if (tone === 'amber') return 'badge amber';
  if (tone === 'green') return 'badge green';
  return 'badge muted-badge';
}

function validateSearch(form: { lat: string; lng: string; radius: string; limit: string }) {
  const errors: SearchErrors = {};
  const lat = Number(form.lat);
  const lng = Number(form.lng);
  const radius = Number(form.radius);
  const limit = Number(form.limit);

  if (form.lat.trim() === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) errors.lat = 'Enter a latitude between -90 and 90.';
  if (form.lng.trim() === '' || !Number.isFinite(lng) || lng < -180 || lng > 180) errors.lng = 'Enter a longitude between -180 and 180.';
  if (form.radius.trim() === '' || !Number.isFinite(radius) || radius <= 0 || radius > 200) errors.radius = 'Enter a radius from 0.1 to 200 km.';
  if (form.limit.trim() === '' || !Number.isFinite(limit) || limit < 1 || limit > 100) errors.limit = 'Enter a limit from 1 to 100.';

  return {
    errors,
    values: {
      lat,
      lng,
      radius,
      limit: Math.floor(limit)
    }
  };
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'risk' | 'amber' | 'green' }) {
  return (
    <article className={`registry-summary-card ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function AssetMarker({ item, bounds }: { item: LocatedTransformer; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }) {
  const navigate = useNavigate();
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  const x = 8 + ((item.longitude - bounds.minLng) / lngRange) * 84;
  const y = 92 - ((item.latitude - bounds.minLat) / latRange) * 84;
  const clampedX = Math.min(94, Math.max(6, x));
  const clampedY = Math.min(94, Math.max(6, y));

  return (
    <button
      className={`map-marker ${markerTone(item)}`}
      type="button"
      style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
      title={`${getTransformerName(item)} - ${getSiteLabel(item)}`}
      onClick={() => navigate(`/transformers/${item._id}`)}
    >
      <span>{getTransformerName(item).replace(/^TRF-?/, '').slice(-3)}</span>
    </button>
  );
}

function AssetRow({ item, showDistance = false }: { item: LocatedTransformer; showDistance?: boolean }) {
  return (
    <tr>
      <td><Link to={`/transformers/${item._id}`}>{getTransformerName(item)}</Link></td>
      <td>{getSiteLabel(item)}</td>
      <td>{item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}</td>
      <td>{getTerritory(item)}</td>
      <td>{getServiceArea(item)}</td>
      <td>{getFeeder(item)}</td>
      <td><span className={badgeClass(item)}>{readableLabel(item.operational_status)}</span></td>
      <td>{readableLabel(getCondition(item))}</td>
      {showDistance ? <td>{item.distanceKm !== undefined ? `${item.distanceKm.toFixed(2)} km` : 'Not returned'}</td> : null}
      <td><Link className="secondary-button" to={`/transformers/${item._id}`}>View</Link></td>
    </tr>
  );
}

export function AssetMapPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ lat: '0.3476', lng: '32.5825', radius: '5', limit: '20' });
  const [errors, setErrors] = useState<SearchErrors>({});
  const [submittedSearch, setSubmittedSearch] = useState<NearbySearch | null>(null);

  const transformersQuery = useQuery({
    queryKey: ['transformers', 'map', 'all'],
    queryFn: () => transformerApi.search({ limit: 500 })
  });

  const nearbyQuery = useQuery({
    queryKey: ['transformers', 'nearby', submittedSearch],
    queryFn: () => transformerApi.nearby(submittedSearch as NearbySearch),
    enabled: Boolean(submittedSearch)
  });

  const allRows = transformersQuery.data?.data ?? [];
  const located = useMemo(() => allRows.map((item) => toLocated(item)).filter(Boolean) as LocatedTransformer[], [allRows]);
  const missingGps = useMemo(() => allRows.filter((item) => !getCoordinates(item)), [allRows]);
  const bounds = useMemo(() => {
    const latitudes = located.map((item) => item.latitude);
    const longitudes = located.map((item) => item.longitude);
    if (latitudes.length === 0 || longitudes.length === 0) {
      return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 };
    }
    return {
      minLat: Math.min(...latitudes),
      maxLat: Math.max(...latitudes),
      minLng: Math.min(...longitudes),
      maxLng: Math.max(...longitudes)
    };
  }, [located]);

  const nearbyRows = useMemo(
    () => (nearbyQuery.data ?? []).map((item) => toLocated(item, submittedSearch ?? undefined)).filter(Boolean) as LocatedTransformer[],
    [nearbyQuery.data, submittedSearch]
  );

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['transformers', 'map'] });
    if (submittedSearch) void queryClient.invalidateQueries({ queryKey: ['transformers', 'nearby'] });
  };

  const submitNearby = (event: FormEvent) => {
    event.preventDefault();
    const result = validateSearch(form);
    setErrors(result.errors);
    if (Object.keys(result.errors).length > 0) return;
    setSubmittedSearch(result.values);
  };

  const updateForm = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key as keyof SearchErrors]) setErrors((current) => ({ ...current, [key]: undefined }));
  };

  return (
    <div className="page-stack map-page">
      <section className="detail-hero map-hero">
        <div>
          <div className="breadcrumb">Operations / Location intelligence</div>
          <div className="detail-title-row">
            <div>
              <h1>Asset Location Map</h1>
              <p>Coordinate-based transformer visibility for field planning and GPS data cleanup.</p>
            </div>
          </div>
        </div>
        <button className="secondary-button" type="button" onClick={refresh} disabled={transformersQuery.isFetching || nearbyQuery.isFetching}>
          <RefreshCw size={16} />
          <span>{transformersQuery.isFetching || nearbyQuery.isFetching ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </section>

      <section className="status-strip sensitive-strip">
        <div>
          <ShieldAlert size={18} />
          <span>Transformer GPS locations are sensitive utility asset data. Keep this view within authenticated operational use.</span>
        </div>
      </section>

      {transformersQuery.isLoading ? <Loading label="Loading asset locations" /> : null}
      {transformersQuery.error ? <ErrorState error={transformersQuery.error} title="Asset locations unavailable" /> : null}

      {!transformersQuery.isLoading && !transformersQuery.error ? (
        <>
          <section className="registry-summary-grid" aria-label="Location summary">
            <SummaryCard label="Located transformers" value={located.length} tone="green" />
            <SummaryCard label="Missing GPS" value={missingGps.length} tone={missingGps.length > 0 ? 'amber' : undefined} />
            <SummaryCard label="Faulty with GPS" value={located.filter((item) => item.operational_status === 'Faulty' || item.has_open_fault).length} tone="risk" />
            <SummaryCard label="Overdue with GPS" value={located.filter((item) => item.overdue_inspection_flag).length} tone="amber" />
          </section>

          <section className="map-layout">
            <div className="panel map-panel">
              <div className="panel-heading">
                <div>
                  <h2>Location visualization</h2>
                  <span>{located.length.toLocaleString()} coordinate-backed assets</span>
                </div>
              </div>
              {located.length === 0 ? (
                <EmptyState title="No mapped assets" message="Transformer records with GPS coordinates will appear here." />
              ) : (
                <div className="asset-map-canvas" aria-label="Coordinate-normalized transformer map">
                  <div className="map-grid-line horizontal" />
                  <div className="map-grid-line vertical" />
                  {located.map((item) => <AssetMarker key={item._id} item={item} bounds={bounds} />)}
                </div>
              )}
              <div className="map-legend">
                <span><i className="legend-dot green" />Normal</span>
                <span><i className="legend-dot amber" />Watch</span>
                <span><i className="legend-dot risk" />Fault or critical</span>
              </div>
            </div>

            <section className="panel nearby-panel">
              <div className="panel-heading">
                <div>
                  <h2>Nearby search</h2>
                  <span>Radius is measured in kilometers.</span>
                </div>
                <Navigation size={18} />
              </div>
              <form className="nearby-form" onSubmit={submitNearby}>
                <label>
                  <span>Latitude</span>
                  <input value={form.lat} onChange={(event) => updateForm('lat', event.target.value)} inputMode="decimal" />
                  {errors.lat && <small className="field-error">{errors.lat}</small>}
                </label>
                <label>
                  <span>Longitude</span>
                  <input value={form.lng} onChange={(event) => updateForm('lng', event.target.value)} inputMode="decimal" />
                  {errors.lng && <small className="field-error">{errors.lng}</small>}
                </label>
                <label>
                  <span>Radius km</span>
                  <input value={form.radius} onChange={(event) => updateForm('radius', event.target.value)} inputMode="decimal" />
                  {errors.radius && <small className="field-error">{errors.radius}</small>}
                </label>
                <label>
                  <span>Limit</span>
                  <input value={form.limit} onChange={(event) => updateForm('limit', event.target.value)} inputMode="numeric" />
                  {errors.limit && <small className="field-error">{errors.limit}</small>}
                </label>
                <button className="primary-button" type="submit" disabled={nearbyQuery.isFetching}>
                  <Search size={16} />
                  <span>{nearbyQuery.isFetching ? 'Searching' : 'Search nearby'}</span>
                </button>
              </form>
              {nearbyQuery.error ? <ErrorState error={nearbyQuery.error} title="Nearby search unavailable" /> : null}
              {!submittedSearch && !nearbyQuery.error ? (
                <div className="placeholder-panel">Enter a coordinate and radius to find nearby transformer assets.</div>
              ) : null}
            </section>
          </section>

          <section className="panel registry-panel">
            <div className="panel-heading">
              <div>
                <h2>Nearby results</h2>
                <span>{submittedSearch ? `${nearbyRows.length.toLocaleString()} assets within ${submittedSearch.radius} km` : 'Run a nearby search to populate this list'}</span>
              </div>
            </div>
            {nearbyQuery.isLoading ? <Loading label="Searching nearby assets" /> : null}
            {submittedSearch && !nearbyQuery.isLoading && !nearbyQuery.error && nearbyRows.length === 0 ? (
              <EmptyState title="No nearby assets found" message="Try a wider radius or a different coordinate." />
            ) : null}
            {nearbyRows.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset ID</th>
                      <th>Site</th>
                      <th>GPS coordinates</th>
                      <th>Territory</th>
                      <th>Service area</th>
                      <th>Feeder</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Distance</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>{nearbyRows.map((item) => <AssetRow item={item} showDistance key={item._id} />)}</tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="panel registry-panel">
            <div className="panel-heading">
              <div>
                <h2>Asset location list</h2>
                <span>{located.length.toLocaleString()} transformers with captured coordinates</span>
              </div>
            </div>
            {located.length === 0 ? (
              <EmptyState title="No GPS coordinates captured" message="Use transformer create or edit workflows to add asset coordinates." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Asset ID</th>
                      <th>Site</th>
                      <th>GPS coordinates</th>
                      <th>Territory</th>
                      <th>Service area</th>
                      <th>Feeder</th>
                      <th>Status</th>
                      <th>Condition</th>
                      <th>Detail</th>
                    </tr>
                  </thead>
                  <tbody>{located.map((item) => <AssetRow item={item} key={item._id} />)}</tbody>
                </table>
              </div>
            )}
          </section>

          <section className="panel missing-gps-panel">
            <div className="panel-heading">
              <div>
                <h2>Missing GPS</h2>
                <span>Assets that still need coordinate capture.</span>
              </div>
              <AlertTriangle size={18} />
            </div>
            {missingGps.length === 0 ? (
              <EmptyState title="All listed assets have GPS" message="No missing coordinate records found in the current dataset." />
            ) : (
              <div className="missing-gps-grid">
                {missingGps.map((item) => (
                  <article className="missing-gps-card" key={item._id}>
                    <div>
                      <strong>{getTransformerName(item)}</strong>
                      <span>{getSiteLabel(item)}</span>
                    </div>
                    <small>{getTerritory(item)} / {getServiceArea(item)}</small>
                    <Link className="secondary-button" to={`/transformers/${item._id}`}>
                      <LocateFixed size={15} />
                      <span>Open record</span>
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
