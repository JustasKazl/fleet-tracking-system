import { useEffect, useRef, useState } from "react";
import API_BASE_URL from "../api";

function MapComponent({ vehicleId, vehicleImei, token }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const [loading, setLoading] = useState(true);
  const [lastLocation, setLastLocation] = useState(null);
  const [error, setError] = useState(null);

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

  useEffect(() => {
    const initMap = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch telemetry data
        const res = await fetch(`${API_BASE_URL}/api/telemetry/${vehicleImei}?limit=1`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to fetch telemetry");

        const data = await res.json();
        if (!data || data.length === 0) {
          setError("No GPS data available for this vehicle yet");
          setLoading(false);
          return;
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

        // Load Leaflet
        await loadLeaflet();

        // Initialize map
        if (!map.current) {
          map.current = window.L.map(mapContainer.current).setView([lat, lng], 14);

          window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
          }).addTo(map.current);
        } else {
          map.current.setView([lat, lng], 14);
        }

        // Add or update marker
        if (marker.current) {
          marker.current.setLatLng([lat, lng]);
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

        setLoading(false);
      } catch (err) {
        console.error("Map initialization error:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    if (vehicleId && vehicleImei && token) {
      initMap();
    }
  }, [vehicleId, vehicleImei, token]);

  return (
    <div className="map-wrapper">
      <div className="map-header">
        <div className="map-title-section">
          <h3 className="map-title">📍 Last Known Location</h3>
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
