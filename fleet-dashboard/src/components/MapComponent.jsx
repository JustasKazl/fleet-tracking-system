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
    }).addTo(map.current);

    polylineGroup.current = window.L.layerGroup().addTo(map.current);

    // 🔹 Draw speed-colored track
    for (let i = 1; i < track.length; i++) {
      const p1 = track[i - 1];
      const p2 = track[i];

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

    // 🔹 Marker
    marker.current = window.L.marker([lat, lng], {
      icon: window.L.divIcon({
        html: createCarIcon(latest.heading || 0),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      }),
    }).addTo(map.current);

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
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        );

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
      <h3>
        📍 Last 24 Hours Track
        {refreshing && <span> 🔄 Updating...</span>}
      </h3>

      <div ref={mapContainer} className="map-container">
        {loading && <p>Loading map...</p>}
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    </div>
  );
}

export default MapComponent;
