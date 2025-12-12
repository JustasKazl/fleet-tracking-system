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

      // Initialize map
      if (!map.current) {
        map.current = window.L.map(mapContainer.current).setView([lat, lng], 14);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map.current);
      }
    }

    // Update map view
    if (map.current) {
      map.current.setView([lat, lng], 14);
    }

    // Add or update marker
    if (marker.current) {
      marker.current.setLatLng([lat, lng]);
      // Update popup
      marker.current.setPopupContent(`
        <div class="map-popup">
          <strong>Last Location</strong><br/>
          Speed: ${telemetry.speed} km/h<br/>
          Satellites: ${telemetry.satellites}<br/>
          <small>${new Date(telemetry.timestamp).toLocaleString()}</small>
        </div>
      `);
    } else {
      marker.current = window.L.circleMarker([lat, lng], {
        radius: 10,
        fillColor: "#667eea",
        color: "#764ba2",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .addTo(map.current)
        .bindPopup(`
          <div class="map-popup">
            <strong>Last Location</strong><br/>
            Speed: ${telemetry.speed} km/h<br/>
            Satellites: ${telemetry.satellites}<br/>
            <small>${new Date(telemetry.timestamp).toLocaleString()}</small>
          </div>
        `);
    }
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
            {refreshing && <span style={{ fontSize: "12px", marginLeft: "8px", opacity: 0.7 }}>🔄 Updating...</span>}
          </h3>
          {lastLocation && (
            <div className="map-coords">
              <span className="coord">{lastLocation.lat.toFixed(5)}°</span>
              <span className="coord">{lastLocation.lng.toFixed(5)}°</span>
              {lastLocation.speed > 0 && (
                <span className="speed-badge">🚗 Moving {lastLocation.speed} km/h</span>
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
              {lastFetch && <span style={{ fontSize: "10px", marginLeft: "4px", opacity: 0.6 }}>
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
    </div>
  );
}

export default MapComponent;
