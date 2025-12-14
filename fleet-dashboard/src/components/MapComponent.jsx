import { useEffect, useRef, useState } from "react";
import API_BASE_URL from "../api";

function MapComponent({ vehicleId, vehicleImei, token, autoRefreshInterval = 10000 }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const polylineGroup = useRef(null);
  const refreshIntervalRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [lastLocation, setLastLocation] = useState(null);
  const [error, setError] = useState(null);
  const [lastFetch, setLastFetch] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  /* ---------------- HELPERS ---------------- */

  const getSpeedColor = (speed = 0) => {
    // Smooth color gradient based on speed ranges with vibrant, highly visible colors
    // Uses RGB interpolation for smooth transitions
    
    if (speed < 10) return "#10b981"; // Emerald green - stopped/very slow
    if (speed < 20) return "#22c55e"; // Green
    if (speed < 30) return "#3bf28c"; // Bright green - slow
    if (speed < 40) return "#84cc16"; // Lime green
    if (speed < 50) return "#a3e635"; // Light lime
    if (speed < 60) return "#facc15"; // Yellow - moderate
    if (speed < 70) return "#f59e0b"; // Amber - fast
    if (speed < 80) return "#fb923c"; // Light orange
    if (speed < 90) return "#f97316"; // Orange - very fast
    if (speed < 100) return "#f87171"; // Light red
    if (speed < 110) return "#ef4444"; // Red - highway speed
    if (speed < 120) return "#dc2626"; // Dark red
    return "#b91c1c"; // Very dark red - excessive speed
  };

  const createCarIcon = (heading = 0) => `
    <div style="
      width:48px;
      height:48px;
      background:linear-gradient(135deg,#667eea,#764ba2);
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      border:4px solid white;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.6), 0 0 0 2px rgba(102, 126, 234, 0.2);
      transform:rotate(${heading}deg);
    ">
      <span style="font-size:24px;transform:rotate(-${heading}deg)">🚗</span>
    </div>
  `;

  const loadLeaflet = () =>
    new Promise((resolve) => {
      if (window.L) return resolve();

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });

  /* ---------------- FETCHES ---------------- */

  // 🔹 Latest point (marker)
  const fetchLatestLocation = async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/telemetry/${vehicleImei}?limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error("Failed to fetch telemetry");

    const data = await res.json();
    return data?.[0];
  };

  // 🔹 Last 24h track (lines)
  const fetchTrack = async () => {
    const res = await fetch(
      `${API_BASE_URL}/api/track/${vehicleImei}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) throw new Error("Failed to fetch track");
    return await res.json();
  };

  /* ---------------- MAP UPDATE ---------------- */

  const initMapAndTrack = async () => {
    await loadLeaflet();

    const track = await fetchTrack();
    if (!track.length) throw new Error("No track data");

    const latest = track[track.length - 1];

    const lat = +latest.latitude;
    const lng = +latest.longitude;

    map.current = window.L.map(mapContainer.current).setView([lat, lng], 15);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.current);

    polylineGroup.current = window.L.layerGroup().addTo(map.current);

    // 🔹 Draw speed-colored track with improved visibility
    for (let i = 1; i < track.length; i++) {
      const p1 = track[i - 1];
      const p2 = track[i];

      const speed = p2.speed || 0;
      const color = getSpeedColor(speed);

      window.L.polyline(
        [
          [+p1.latitude, +p1.longitude],
          [+p2.latitude, +p2.longitude],
        ],
        {
          color: color,
          weight: 6, // Thicker lines for better visibility
          opacity: 0.85, // Slightly transparent
          smoothFactor: 1.5, // Smoother curves
          lineCap: 'round', // Rounded line ends
          lineJoin: 'round' // Rounded line joins
        }
      ).addTo(polylineGroup.current);
    }

    // 🔹 Add a subtle shadow/outline effect by drawing a darker line underneath
    for (let i = 1; i < track.length; i++) {
      const p1 = track[i - 1];
      const p2 = track[i];

      window.L.polyline(
        [
          [+p1.latitude, +p1.longitude],
          [+p2.latitude, +p2.longitude],
        ],
        {
          color: '#000000',
          weight: 8, // Slightly thicker than the main line
          opacity: 0.2, // Very transparent for shadow effect
          smoothFactor: 1.5,
          lineCap: 'round',
          lineJoin: 'round'
        }
      ).addTo(polylineGroup.current);
    }

    // 🔹 Marker with enhanced styling
    marker.current = window.L.marker([lat, lng], {
      icon: window.L.divIcon({
        html: createCarIcon(latest.heading || 0),
        iconSize: [48, 48],
        iconAnchor: [24, 24],
      }),
      zIndexOffset: 1000 // Ensure marker is always on top
    }).addTo(map.current);

    // Add popup with speed information
    marker.current.bindPopup(`
      <div style="font-family: Arial, sans-serif; padding: 8px;">
        <strong style="font-size: 14px;">📍 Dabartinė pozicija</strong><br/>
        <div style="margin-top: 8px; font-size: 12px;">
          <div style="margin: 4px 0;">
            <strong>Greitis:</strong> 
            <span style="color: ${getSpeedColor(latest.speed || 0)}; font-weight: bold;">
              ${latest.speed || 0} km/h
            </span>
          </div>
          <div style="margin: 4px 0;">
            <strong>Palydovai:</strong> ${latest.satellites || 0}
          </div>
          <div style="margin: 4px 0; color: #666; font-size: 11px;">
            ${new Date(latest.timestamp).toLocaleString('lt-LT')}
          </div>
        </div>
      </div>
    `);

    setLastLocation({
      lat,
      lng,
      speed: latest.speed || 0,
      satellites: latest.satellites || 0,
      heading: latest.heading || 0,
      timestamp: latest.timestamp,
    });

    setLoading(false);
  };

  const updateMarker = async () => {
    setRefreshing(true);
    try {
      const telemetry = await fetchLatestLocation();
      if (!telemetry) return;

      const lat = +telemetry.latitude;
      const lng = +telemetry.longitude;

      marker.current
        .setLatLng([lat, lng])
        .setIcon(
          window.L.divIcon({
            html: createCarIcon(telemetry.heading || 0),
            iconSize: [48, 48],
            iconAnchor: [24, 24],
          })
        );

      // Update popup content
      marker.current.setPopupContent(`
        <div style="font-family: Arial, sans-serif; padding: 8px;">
          <strong style="font-size: 14px;">📍 Dabartinė pozicija</strong><br/>
          <div style="margin-top: 8px; font-size: 12px;">
            <div style="margin: 4px 0;">
              <strong>Greitis:</strong> 
              <span style="color: ${getSpeedColor(telemetry.speed || 0)}; font-weight: bold;">
                ${telemetry.speed || 0} km/h
              </span>
            </div>
            <div style="margin: 4px 0;">
              <strong>Palydovai:</strong> ${telemetry.satellites || 0}
            </div>
            <div style="margin: 4px 0; color: #666; font-size: 11px;">
              ${new Date(telemetry.timestamp).toLocaleString('lt-LT')}
            </div>
          </div>
        </div>
      `);

      map.current.setView([lat, lng], map.current.getZoom());

      setLastLocation({
        lat,
        lng,
        speed: telemetry.speed || 0,
        satellites: telemetry.satellites || 0,
        heading: telemetry.heading || 0,
        timestamp: telemetry.timestamp,
      });

      setLastFetch(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  /* ---------------- EFFECTS ---------------- */

  useEffect(() => {
    if (vehicleId && vehicleImei && token) {
      initMapAndTrack().catch((e) => {
        setError(e.message);
        setLoading(false);
      });
    }
  }, [vehicleId, vehicleImei, token]);

  useEffect(() => {
    if (!vehicleId || !vehicleImei || !token) return;

    refreshIntervalRef.current = setInterval(updateMarker, autoRefreshInterval);

    return () => clearInterval(refreshIntervalRef.current);
  }, [vehicleId, vehicleImei, token, autoRefreshInterval]);

  /* ---------------- UI ---------------- */

  return (
    <div className="map-wrapper">
      <div className="map-header">
        <div className="map-title-section">
          <h3 className="map-title">
            📍 Paskutinių 24 valandų maršrutas
            {refreshing && <span className="map-refreshing">Atnaujinama...</span>}
          </h3>
          {lastLocation && (
            <div className="map-coords">
              <span className="coord">
                🧭 {lastLocation.lat.toFixed(6)}°, {lastLocation.lng.toFixed(6)}°
              </span>
              <span className="speed-badge" style={{ color: getSpeedColor(lastLocation.speed) }}>
                🏎️ {lastLocation.speed} km/h
              </span>
              <span className="coord">
                🛰️ {lastLocation.satellites} palydovai
              </span>
            </div>
          )}
        </div>
      </div>

      <div ref={mapContainer} className="map-container">
        {loading && (
          <div className="map-loading">
            <div className="spinner"></div>
            <p>Kraunama žemėlapis...</p>
          </div>
        )}
        {error && (
          <div className="map-error">
            <div className="error-icon">⚠️</div>
            <p>Klaida kraunant žemėlapį</p>
            <small>{error}</small>
          </div>
        )}
      </div>

      {/* Speed Legend */}
      {!loading && !error && (
        <div className="map-info-bar">
          <div className="map-info-item">
            <div className="info-icon" style={{ color: '#10b981' }}>●</div>
            <div className="info-details">
              <div className="info-label">Lėtai</div>
              <div className="info-value">0-30 km/h</div>
            </div>
          </div>
          <div className="map-info-item">
            <div className="info-icon" style={{ color: '#facc15' }}>●</div>
            <div className="info-details">
              <div className="info-label">Vidutiniškai</div>
              <div className="info-value">30-60 km/h</div>
            </div>
          </div>
          <div className="map-info-item">
            <div className="info-icon" style={{ color: '#f97316' }}>●</div>
            <div className="info-details">
              <div className="info-label">Greitai</div>
              <div className="info-value">60-90 km/h</div>
            </div>
          </div>
          <div className="map-info-item">
            <div className="info-icon" style={{ color: '#ef4444' }}>●</div>
            <div className="info-details">
              <div className="info-label">Labai greitai</div>
              <div className="info-value">90+ km/h</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapComponent;
