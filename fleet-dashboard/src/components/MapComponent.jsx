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

  /* ---------- Helpers ---------- */

  const getSpeedColor = (speed = 0) => {
    if (speed < 50) return "green";
    if (speed < 90) return "yellow";
    return "red";
  };

  const createCarIcon = (heading = 0) => `
    <div style="
      width:40px;
      height:40px;
      background:linear-gradient(135deg,#667eea,#764ba2);
      border-radius:50%;
      display:flex;
      align-items:center;
      justify-content:center;
      border:3px solid white;
      transform:rotate(${heading}deg);
    ">
      <span style="font-size:20px;transform:rotate(-${heading}deg)">🚗</span>
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

  /* ---------- Fetch last 24h ---------- */

  const fetchLocation = async (isInitial = false) => {
    if (!isInitial) setRefreshing(true);

    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const res = await fetch(
        `${API_BASE_URL}/api/telemetry/${vehicleImei}?since=${since}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to fetch telemetry");

      const data = await res.json();
      if (!data?.length) throw new Error("No GPS data available");

      const latest = data[0];

      setLastLocation({
        lat: +latest.latitude,
        lng: +latest.longitude,
        speed: latest.speed || 0,
        satellites: latest.satellites || 0,
        heading: latest.heading || 0,
        timestamp: latest.timestamp,
      });

      setLastFetch(new Date());
      setError(null);

      return { latest, history: data };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      if (isInitial) setLoading(false);
      setRefreshing(false);
    }
  };

  /* ---------- Map update ---------- */

  const updateMapLocation = async (isInitial = false) => {
    const result = await fetchLocation(isInitial);
    if (!result) return;

    const { latest, history } = result;
    const lat = +latest.latitude;
    const lng = +latest.longitude;

    if (isInitial) {
      await loadLeaflet();

      if (!map.current) {
        map.current = window.L.map(mapContainer.current).setView([lat, lng], 15);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(map.current);

        polylineGroup.current = window.L.layerGroup().addTo(map.current);
      }
    }

    /* ----- Draw track ----- */
    polylineGroup.current.clearLayers();

    for (let i = 1; i < history.length; i++) {
      const p1 = history[i - 1];
      const p2 = history[i];
      if (!p1.latitude || !p2.latitude) continue;

      window.L.polyline(
        [
          [+p1.latitude, +p1.longitude],
          [+p2.latitude, +p2.longitude],
        ],
        {
          color: getSpeedColor(p2.speed),
          weight: 4,
          opacity: 0.9,
        }
      ).addTo(polylineGroup.current);
    }

    /* ----- Marker ----- */
    const icon = window.L.divIcon({
      html: createCarIcon(latest.heading),
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      className: "car-marker-icon",
    });

    if (!marker.current) {
      marker.current = window.L.marker([lat, lng], { icon }).addTo(map.current);
    } else {
      marker.current.setLatLng([lat, lng]).setIcon(icon);
    }

    map.current.setView([lat, lng], map.current.getZoom());
  };

  /* ---------- Effects ---------- */

  useEffect(() => {
    if (vehicleId && vehicleImei && token) updateMapLocation(true);
  }, [vehicleId, vehicleImei, token]);

  useEffect(() => {
    if (!vehicleId || !vehicleImei || !token) return;

    refreshIntervalRef.current = setInterval(
      () => updateMapLocation(false),
      autoRefreshInterval
    );

    return () => clearInterval(refreshIntervalRef.current);
  }, [vehicleId, vehicleImei, token, autoRefreshInterval]);

  /* ---------- UI ---------- */

  return (
    <div className="map-wrapper">
      <h3>
        📍 Last 24 Hours Track
        {refreshing && <span> 🔄 Updating...</span>}
      </h3>

      <div ref={mapContainer} className="map-container">
        {loading && <p>Loading map…</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}

export default MapComponent;
