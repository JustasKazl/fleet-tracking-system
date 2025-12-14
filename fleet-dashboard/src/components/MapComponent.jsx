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

  // Create custom car icon HTML
  const createCarIcon = (heading = 0) => {
    return `
      <div style="
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.5);
        border: 3px solid white;
        transform: rotate(${heading}deg);
      ">
        <span style="font-size: 20px; transform: rotate(-${heading}deg);">🚗</span>
      </div>
    `;
  };

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

  // Fetch latest GPS location from telemetry
  const fetchLocation = async (isInitial = false) => {
    if (!isInitial) setRefreshing(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/telemetry/${vehicleImei}`, {
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
        speed: telemetry.speed || 0,
        satellites: telemetry.satellites || 0,
        heading: telemetry.heading || 0,
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
        map.current = window.L.map(mapContainer.current, {
          zoomControl: true,
          attributionControl: true,
        }).setView([lat, lng], 15);

        // Use OpenStreetMap tiles
        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map.current);
      }
    }

    // Update map view
    if (map.current) {
      map.current.setView([lat, lng], map.current.getZoom());
    }

    // Add or update marker with car icon
    if (marker.current) {
      marker.current.setLatLng([lat, lng]);
      
      // Update icon rotation based on heading
      const iconHtml = createCarIcon(telemetry.heading || 0);
      const newIcon = window.L.divIcon({
        html: iconHtml,
        className: 'car-marker-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });
      marker.current.setIcon(newIcon);
      
      // Update popup
      marker.current.setPopupContent(`
        <div class="map-popup">
          <div class="popup-header">
            <span class="popup-icon">🚗</span>
            <strong>Last Known Location</strong>
          </div>
          <div class="popup-content">
            <div class="popup-row">
              <span class="popup-label">Speed:</span>
              <span class="popup-value">${telemetry.speed || 0} km/h</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Satellites:</span>
              <span class="popup-value">${telemetry.satellites || 0}</span>
            </div>
            <div class="popup-row">
              <span class="popup-label">Coordinates:</span>
              <span class="popup-value">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
            </div>
            <div class="popup-timestamp">
              ${new Date(telemetry.timestamp).toLocaleString('lt-LT', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </div>
        </div>
      `);
    } else {
      // Create new marker with car icon
      const iconHtml = createCarIcon(telemetry.heading || 0);
      const carIcon = window.L.divIcon({
        html: iconHtml,
        className: 'car-marker-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      marker.current = window.L.marker([lat, lng], { icon: carIcon })
        .addTo(map.current)
        .bindPopup(`
          <div class="map-popup">
            <div class="popup-header">
              <span class="popup-icon">🚗</span>
              <strong>Last Known Location</strong>
            </div>
            <div class="popup-content">
              <div class="popup-row">
                <span class="popup-label">Speed:</span>
                <span class="popup-value">${telemetry.speed || 0} km/h</span>
              </div>
              <div class="popup-row">
                <span class="popup-label">Satellites:</span>
                <span class="popup-value">${telemetry.satellites || 0}</span>
              </div>
              <div class="popup-row">
                <span class="popup-label">Coordinates:</span>
                <span class="popup-value">${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
              </div>
              <div class="popup-timestamp">
                ${new Date(telemetry.timestamp).toLocaleString('lt-LT', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        `)
        .openPopup();
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
            {refreshing && <span className="map-refreshing">🔄 Updating...</span>}
          </h3>
          {lastLocation && (
            <div className="map-coords">
              <span className="coord">{lastLocation.lat.toFixed(6)}°N</span>
              <span className="coord">{lastLocation.lng.toFixed(6)}°E</span>
              {lastLocation.speed > 0 && (
                <span className="speed-badge">
                  🚗 {lastLocation.speed} km/h
                </span>
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
            <div className="error-icon">📡</div>
            <p>{error}</p>
            <small>Make sure the GPS tracker is powered on and has sent data</small>
          </div>
        )}
      </div>

      {lastLocation && (
        <div className="map-info-bar">
          <div className="map-info-item">
            <span className="info-icon">📡</span>
            <div className="info-details">
              <span className="info-label">Satellites</span>
              <span className="info-value">{lastLocation.satellites}</span>
            </div>
          </div>
          
          <div className="map-info-item">
            <span className="info-icon">⏱️</span>
            <div className="info-details">
              <span className="info-label">Last Update</span>
              <span className="info-value">
                {new Date(lastLocation.timestamp).toLocaleTimeString('lt-LT')}
              </span>
            </div>
          </div>
          
          <div className="map-info-item">
            <span className="info-icon">🎯</span>
            <div className="info-details">
              <span className="info-label">Speed</span>
              <span className="info-value">{lastLocation.speed} km/h</span>
            </div>
          </div>

          {lastFetch && (
            <div className="map-info-item">
              <span className="info-icon">🔄</span>
              <div className="info-details">
                <span className="info-label">Fetched</span>
                <span className="info-value">
                  {Math.round((Date.now() - lastFetch.getTime()) / 1000)}s ago
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MapComponent;
