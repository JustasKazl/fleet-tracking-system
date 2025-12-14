// fleet-dashboard/src/utils/geocoding.js
// Shared geocoding utility with caching and rate limiting

class GeocodingCache {
  constructor() {
    this.cache = new Map();
    this.requestQueue = [];
    this.processing = false;
    this.lastRequestTime = 0;
    this.MIN_INTERVAL = 1100; // 1.1 seconds between requests (respects Nominatim 1req/sec limit)
  }

  /**
   * Get cache key from coordinates (rounded to 2 decimal places for ~1km accuracy)
   */
  getCacheKey(lat, lon) {
    return `${lat.toFixed(2)},${lon.toFixed(2)}`;
  }

  /**
   * Process queued requests with rate limiting
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.MIN_INTERVAL) {
        // Wait before making next request
        await new Promise(resolve => 
          setTimeout(resolve, this.MIN_INTERVAL - timeSinceLastRequest)
        );
      }

      const { lat, lon, resolve, reject } = this.requestQueue.shift();
      this.lastRequestTime = Date.now();

      try {
        const result = await this.fetchLocation(lat, lon);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Fetch location from Nominatim API
   */
  async fetchLocation(lat, lon) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?` +
        `lat=${lat}&lon=${lon}&format=json&accept-language=lt&zoom=10`,
        {
          headers: {
            'User-Agent': 'FleetTrack/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      // Extract city/town/village name
      const locationName = 
        data.address?.city || 
        data.address?.town || 
        data.address?.village || 
        data.address?.municipality ||
        data.address?.county ||
        data.address?.state ||
        "Nežinoma vieta";
      
      return locationName;
    } catch (error) {
      console.error('Geocoding error:', error);
      return "Nežinoma vieta";
    }
  }

  /**
   * Get location name from coordinates (with caching and rate limiting)
   */
  async getLocationName(lat, lon) {
    if (!lat || !lon) {
      return "Nežinoma vieta";
    }

    const cacheKey = this.getCacheKey(lat, lon);

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    // Add to queue and return promise
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ lat, lon, resolve, reject });
      
      // Start processing queue
      this.processQueue().then(() => {
        // Cache the result
        const result = this.cache.get(cacheKey);
        if (result) {
          resolve(result);
        }
      });
    });
  }

  /**
   * Batch geocode multiple coordinates
   */
  async batchGeocode(coordinates) {
    const promises = coordinates.map(({ lat, lon }) => 
      this.getLocationName(lat, lon)
    );
    return Promise.all(promises);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      queueLength: this.requestQueue.length,
      processing: this.processing
    };
  }
}

// Singleton instance
const geocoding = new GeocodingCache();

export default geocoding;
