import { useEffect, useRef, useState } from "react";
import API_BASE_URL from "../api";

function MapComponent({ vehicleId, vehicleImei, token, autoRefreshInterval = 10000 }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [loading, setLoading] = useState(true);
  const [lastLocation, setLastLocation] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshIntervalRef = useRef(null);

  // Dynamically load Leaflet library
  const loadLeaflet = async () => {
    return new Promise((resolve) => {
      if (window.L) {
        resolve();
        return;
      }

      // Load CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);

      // Load JS
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });
  };

  // Fetch latest GPS location
  const fetchLocation = async (isInitial = false) => {
    if (!isInitial) setRefreshing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/telemetry/${vehicleImei}?limit=1`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch telemetry");

      const data = await res.json();
      if (!data || data.length === 0) {
        setError("No GPS data available for this vehicle yet");
        if (isInitial) setLoading(false);
        return null;
      }

      const telemetry = data[0];
      const lat = parseFloat(telemetry.latitude);
      const lng = parseFloat(telemetry.longitude);

      setLastLocation({
        lat,
        lng,
        timestamp: telemetry.timestamp,
        speed: telemetry.speed,
        satellites: telemetry.satellites,
      });

      setLastFetch(new Date());
      setError(null);

      return { lat, lng, telemetry };
    } catch (err) {
      console.error("Fetch location error:", err);
      setError(err.message);
      return null;
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  // Update map with new location
  const updateMapLocation = async (isInitial = false) => {
    const locationData = await fetchLocation(isInitial);
    if (!locationData) return;

    const { lat, lng, telemetry } = locationData;

    if (isInitial) {
      // Load Leaflet on first load
      await loadLeaflet();

      // Initialize map with dark theme
      if (!map.current) {
        map.current = window.L.map(mapContainer.current).setView([lat, lng], 14);

        // STYLED TILE LAYER - Dark theme with Cartodb Positron or Dark Matter
        // Option 1: CartoDB Positron (light, minimal)
        // window.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        
        // Option 2: CartoDB Dark Matter (dark, sleek) ⭐ RECOMMENDED
        window.L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
          maxZoom: 19,
          className: "map-tile-layer",
        }).addTo(map.current);

        // Option 3: Stamen Toner (black & white, minimal)
        // window.L.tileLayer("https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}.png", {
        //   attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
        //   maxZoom: 19,
        // }).addTo(map.current);

        // Option 4: Dark OpenStreetMap with CSS filter (use this if you want OSM dark)
        // window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        //   attribution: '© OpenStreetMap contributors',
        //   maxZoom: 19,
        //   className: "map-tile-layer-dark",
        // }).addTo(map.current);
      }
    }

    // Update map view
    if (map.current) {
      map.current.setView([lat, lng], 14);
    }

    // Add or update marker with styled popup
    if (marker.current) {
      marker.current.setLatLng([lat, lng]);
      marker.current.setPopupContent(createPopupContent(telemetry));
    } else {
      marker.current = window.L.circleMarker([lat, lng], {
        radius: 12,
        fillColor: "#667eea",
        color: "#764ba2",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
        className: "map-marker-circle",
      })
        .addTo(map.current)
        .bindPopup(createPopupContent(telemetry));

      // Add pulsing animation
      marker.current._icon?.classList.add("map-marker-pulse");
    }
  };

  // Create styled popup content
  const createPopupContent = (telemetry) => {
    return `
      <div class="map-popup-content">
        <div class="popup-header">📍 Last Location</div>
        <div class="popup-row">
          <span class="popup-label">Speed:</span>
          <span class="popup-value">${telemetry.speed} km/h</span>
        </div>
        <div class="popup-row">
          <span class="popup-label">Satellites:</span>
          <span class="popup-value">${telemetry.satellites}</span>
        </div>
        <div class="popup-timestamp">
          ${new Date(telemetry.timestamp).toLocaleString('lt-LT')}
        </div>
      </div>
    `;
  };

  // Initial map load
  useEffect(() => {
    if (vehicleId && vehicleImei && token) {
      updateMapLocation(true);
    }
  }, [vehicleId, vehicleImei, token]);

  // Auto-refresh interval
  useEffect(() => {
    if (!vehicleId || !vehicleImei || !token || !autoRefreshInterval) return;

    // Set up auto-refresh interval
    refreshIntervalRef.current = setInterval(() => {
      updateMapLocation(false);
    }, autoRefreshInterval);

    // Cleanup interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [vehicleId, vehicleImei, token, autoRefreshInterval]);

  return (
    <div className="map-wrapper">
      <div className="map-header">
        <div className="map-title-section">
          <h3 className="map-title">
            📍 Last Known Location
            {refreshing && <span className="map-refreshing">🔄 Updating...</span>}
          </h3>
          {lastLocation && (
            <div className="map-coords">
              <span className="coord">{lastLocation.lat.toFixed(5)}°</span>
              <span className="coord">{lastLocation.lng.toFixed(5)}°</span>
              {lastLocation.speed > 0 && (
                <span className="speed-badge">🚗 Moving {lastLocation.speed} km/h</span>
              )}
              {lastLocation.speed === 0 && (
                <span className="speed-badge speed-parked">⏸️ Parked</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="map-container" ref={mapContainer}>
        {loading && (
          <div className="map-loading">
            <div className="spinner"></div>
            <p>Loading map...</p>
          </div>
        )}
        {error && (
          <div className="map-error">
            <p>📡 {error}</p>
          </div>
        )}
      </div>

      {lastLocation && (
        <div className="map-info">
          <div className="info-item">
            <span className="info-label">📡 Satellites:</span>
            <span className="info-value">{lastLocation.satellites}</span>
          </div>
          <div className="info-item">
            <span className="info-label">⏱️ Last Update:</span>
            <span className="info-value">
              {new Date(lastLocation.timestamp).toLocaleString('lt-LT')}
              {lastFetch && <span className="fetch-time">
                (fetched {Math.round((Date.now() - lastFetch.getTime()) / 1000)}s ago)
              </span>}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">🎯 Speed:</span>
            <span className="info-value">{lastLocation.speed} km/h</span>
          </div>
        </div>
      )}

      <style>{`
        /* Map tile layer styling */
        .map-tile-layer {
          filter: brightness(0.95) contrast(1.1);
        }

        .map-tile-layer-dark {
          filter: brightness(0.7) contrast(1.2) invert(1) hue-rotate(180deg);
        }

        /* Marker styling */
        .map-marker-circle {
          box-shadow: 0 0 20px rgba(102, 126, 234, 0.8);
        }

        .map-marker-pulse {
          animation: mapPulse 2s infinite;
        }

        @keyframes mapPulse {
          0% {
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.8);
          }
          50% {
            box-shadow: 0 0 40px rgba(102, 126, 234, 0.4);
          }
          100% {
            box-shadow: 0 0 20px rgba(102, 126, 234, 0.8);
          }
        }

        /* Popup styling */
        .map-popup-content {
          background: linear-gradient(135deg, rgba(26, 15, 46, 0.95) 0%, rgba(20, 8, 36, 0.9) 100%);
          border-radius: 8px;
          padding: 12px;
          border: 1px solid rgba(102, 126, 234, 0.3);
          color: white;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
          min-width: 180px;
        }

        .popup-header {
          font-weight: 700;
          color: #667eea;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(102, 126, 234, 0.2);
          padding-bottom: 6px;
        }

        .popup-row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 4px 0;
        }

        .popup-label {
          color: rgba(255, 255, 255, 0.6);
          font-weight: 500;
        }

        .popup-value {
          color: #667eea;
          font-weight: 600;
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .popup-timestamp {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid rgba(102, 126, 234, 0.2);
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
        }

        /* Speed badge styling */
        .speed-parked {
          background: rgba(242, 230, 59, 0.15) !important;
          border-color: rgba(242, 230, 59, 0.3) !important;
          color: #f2e63b !important;
        }

        /* Refreshing indicator */
        .map-refreshing {
          font-size: 12px;
          margin-left: 8px;
          opacity: 0.7;
          animation: blink 1.5s infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Fetch time styling */
        .fetch-time {
          display: block;
          font-size: 10px;
          color: rgba(102, 126, 234, 0.6);
          margin-top: 2px;
        }

        /* Leaflet control styling (zoom buttons) */
        .leaflet-control-zoom {
          border-radius: 8px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
          background: rgba(10, 1, 24, 0.9) !important;
          border: 1px solid rgba(102, 126, 234, 0.2) !important;
          backdrop-filter: blur(10px);
        }

        .leaflet-control-zoom-in,
        .leaflet-control-zoom-out {
          color: #667eea !important;
          font-weight: bold;
        }

        .leaflet-control-zoom-in:hover,
        .leaflet-control-zoom-out:hover {
          background: rgba(102, 126, 234, 0.15) !important;
          color: #764ba2 !important;
        }

        /* Attribution styling */
        .leaflet-control-attribution {
          background: rgba(10, 1, 24, 0.8) !important;
          color: rgba(255, 255, 255, 0.6) !important;
          font-size: 11px !important;
          border: 1px solid rgba(102, 126, 234, 0.1) !important;
          border-radius: 4px !important;
        }

        .leaflet-control-attribution a {
          color: #667eea !important;
        }
      `}</style>
    </div>
  );
}

export default MapComponent;
