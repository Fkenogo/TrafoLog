const redis = require('redis');

class RedisCache {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }
  
  async connect() {
    if (this.isConnected) return;
    
    try {
      this.client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis connection refused');
            return new Error('Redis connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            return new Error('Retry time exhausted');
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });
      
      this.client.on('error', this.handleError);
      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('Redis connected');
      });
      
      await this.client.connect();
    } catch (error) {
      console.error('Redis connection failed:', error);
      throw error;
    }
  }
  
  async disconnect() {
    if (!this.isConnected) return;
    
    await this.client.quit();
    this.isConnected = false;
    console.log('Redis disconnected');
  }
  
  handleError(error) {
    console.error('Redis error:', error);
  }
  
  // Cache methods
  async get(key) {
    if (!this.isConnected) return null;
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  async set(key, value, ttl = 3600) {
    if (!this.isConnected) return;
    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  async delete(key) {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }
  
  async invalidatePattern(pattern) {
    if (!this.isConnected) return;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
      }
    } catch (error) {
      console.error('Redis invalidatePattern error:', error);
    }
  }
}

module.exports = new RedisCache();