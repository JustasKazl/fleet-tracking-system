import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function TripsHistoryPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();

  // Data state
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState({
    start: getDefaultStartDate(),
    end: getDefaultEndDate(),
  });
  const [minDistance, setMinDistance] = useState(0.5);

  // Expanded trip for map preview
  const [expandedTrip, setExpandedTrip] = useState(null);
  const [tripRoute, setTripRoute] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Map refs
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayerRef = useRef(null);

  // Helper functions
  function getDefaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  }

  function getDefaultEndDate() {
    return new Date().toISOString().split("T")[0];
  }

  // Load vehicles on mount
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE_URL}/api/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setVehicles(data);
        if (data.length > 0) {
          setSelectedVehicle(data[0]);
        }
      })
      .catch((err) => {
        console.error("Error loading vehicles:", err);
        showToast("Nepavyko įkelti automobilių", "error");
      })
      .finally(() => setLoadingVehicles(false));
  }, [token]);

  // Load trips when vehicle or filters change
  useEffect(() => {
    if (!selectedVehicle || !token) return;

    loadTrips();
  }, [selectedVehicle, dateRange, minDistance]);

  async function loadTrips() {
    if (!selectedVehicle) return;

    setLoading(true);
    setExpandedTrip(null);
    setTripRoute([]);

    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        min_distance: minDistance.toString(),
      });

      const res = await fetch(
        `${API_BASE_URL}/api/vehicles/${selectedVehicle.id}/trips?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch trips");

      const data = await res.json();
      setTrips(data);
    } catch (err) {
      console.error("Error loading trips:", err);
      showToast("Nepavyko įkelti kelionių", "error");
    } finally {
      setLoading(false);
    }
  }

  // Load trip route when expanding
  async function handleExpandTrip(trip) {
    if (expandedTrip?.id === trip.id) {
      setExpandedTrip(null);
      setTripRoute([]);
      return;
    }

    setExpandedTrip(trip);
    setLoadingRoute(true);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/vehicles/${selectedVehicle.id}/trips/${encodeURIComponent(trip.id)}/route`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch route");

      const data = await res.json();
      setTripRoute(data);
    } catch (err) {
      console.error("Error loading route:", err);
      showToast("Nepavyko įkelti maršruto", "error");
    } finally {
      setLoadingRoute(false);
    }
  }

  // Initialize/update map when route changes
  useEffect(() => {
    if (!expandedTrip || tripRoute.length === 0) {
      // Cleanup map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    // Wait for container to be ready
    setTimeout(() => {
      if (!mapContainerRef.current) return;

      // Initialize map if not exists
      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          zoomControl: true,
          scrollWheelZoom: true,
        });

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
          {
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
            maxZoom: 19,
          }
        ).addTo(mapInstanceRef.current);
      }

      // Clear previous route
      if (routeLayerRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
      }

      // Filter valid coordinates
      const validPoints = tripRoute.filter(
        (p) => p.latitude && p.longitude && p.latitude !== 0 && p.longitude !== 0
      );

      if (validPoints.length === 0) return;

      // Create route polyline
      const coordinates = validPoints.map((p) => [p.latitude, p.longitude]);

      routeLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

      // Draw route line with gradient effect
      const routeLine = L.polyline(coordinates, {
        color: "#667eea",
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(routeLayerRef.current);

      // Start marker
      const startIcon = L.divIcon({
        className: "trip-marker-start",
        html: `<div class="marker-pin start">
          <span>A</span>
        </div>`,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });

      L.marker(coordinates[0], { icon: startIcon }).addTo(routeLayerRef.current);

      // End marker
      const endIcon = L.divIcon({
        className: "trip-marker-end",
        html: `<div class="marker-pin end">
          <span>B</span>
        </div>`,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
      });

      L.marker(coordinates[coordinates.length - 1], { icon: endIcon }).addTo(
        routeLayerRef.current
      );

      // Fit bounds
      mapInstanceRef.current.fitBounds(routeLine.getBounds(), {
        padding: [30, 30],
      });
    }, 100);

    return () => {
      if (routeLayerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(routeLayerRef.current);
      }
    };
  }, [tripRoute, expandedTrip]);

  // Group trips by date
  function groupTripsByDate(trips) {
    const groups = {};

    trips.forEach((trip) => {
      const date = new Date(trip.start_time).toLocaleDateString("lt-LT", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groups[date]) {
        groups[date] = {
          date,
          dateKey: trip.start_time.split("T")[0],
          trips: [],
          totalDistance: 0,
          totalDuration: 0,
        };
      }

      groups[date].trips.push(trip);
      groups[date].totalDistance += trip.distance_km;
      groups[date].totalDuration += trip.duration_minutes;
    });

    return Object.values(groups);
  }

  // Format duration
  function formatDuration(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} val ${mins} min`;
  }

  // Format time
  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString("lt-LT", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const groupedTrips = groupTripsByDate(trips);

  // Calculate totals
  const totalDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);
  const totalDuration = trips.reduce((sum, t) => sum + t.duration_minutes, 0);
  const ongoingTrips = trips.filter((t) => t.status === "ongoing").length;

  return (
    <DashboardLayout>
      <div className="trips-history-page">
        {/* Header */}
        <div className="trips-header">
          <div className="trips-title-section">
            <h1 className="trips-title">📍 Kelionių istorija</h1>
            <p className="trips-subtitle">
              Peržiūrėkite automobilių keliones ir maršrutus
            </p>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="trips-filters">
          {/* Vehicle Selector */}
          <div className="filter-group">
            <label className="filter-label">Automobilis</label>
            <select
              className="filter-select"
              value={selectedVehicle?.id || ""}
              onChange={(e) => {
                const v = vehicles.find((v) => v.id === parseInt(e.target.value));
                setSelectedVehicle(v);
              }}
              disabled={loadingVehicles}
            >
              {loadingVehicles ? (
                <option>Kraunama...</option>
              ) : vehicles.length === 0 ? (
                <option>Nėra automobilių</option>
              ) : (
                vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.plate || v.custom_name || `${v.brand} ${v.model}`}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date Range */}
          <div className="filter-group">
            <label className="filter-label">Nuo</label>
            <input
              type="date"
              className="filter-input"
              value={dateRange.start}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, start: e.target.value }))
              }
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Iki</label>
            <input
              type="date"
              className="filter-input"
              value={dateRange.end}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, end: e.target.value }))
              }
            />
          </div>

          {/* Min Distance */}
          <div className="filter-group">
            <label className="filter-label">Min. atstumas</label>
            <select
              className="filter-select"
              value={minDistance}
              onChange={(e) => setMinDistance(parseFloat(e.target.value))}
            >
              <option value="0">Visos kelionės</option>
              <option value="0.5">0.5+ km</option>
              <option value="1">1+ km</option>
              <option value="5">5+ km</option>
              <option value="10">10+ km</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            className="btn-refresh"
            onClick={loadTrips}
            disabled={loading || !selectedVehicle}
          >
            🔄 Atnaujinti
          </button>
        </div>

        {/* Stats Summary */}
        {trips.length > 0 && (
          <div className="trips-stats">
            <div className="stat-card">
              <div className="stat-icon">🛣️</div>
              <div className="stat-content">
                <div className="stat-value">{trips.length}</div>
                <div className="stat-label">Kelionių</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📏</div>
              <div className="stat-content">
                <div className="stat-value">{totalDistance.toFixed(1)} km</div>
                <div className="stat-label">Iš viso nuvažiuota</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-content">
                <div className="stat-value">{formatDuration(totalDuration)}</div>
                <div className="stat-label">Iš viso laikas</div>
              </div>
            </div>
            {ongoingTrips > 0 && (
              <div className="stat-card stat-ongoing">
                <div className="stat-icon">🚗</div>
                <div className="stat-content">
                  <div className="stat-value">{ongoingTrips}</div>
                  <div className="stat-label">Vyksta dabar</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="trips-loading">
            <div className="spinner"></div>
            <p>Kraunamos kelionės...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && trips.length === 0 && selectedVehicle && (
          <div className="trips-empty">
            <div className="empty-icon">🗺️</div>
            <h3>Nerasta kelionių</h3>
            <p>Pasirinktame laikotarpyje kelionių nerasta.</p>
            <p className="empty-hint">
              Pabandykite pasirinkti kitą datų intervalą arba sumažinti minimalų atstumą.
            </p>
          </div>
        )}

        {/* Trips List Grouped by Date */}
        {!loading && groupedTrips.length > 0 && (
          <div className="trips-list">
            {groupedTrips.map((group) => (
              <div key={group.dateKey} className="trip-date-group">
                {/* Date Header */}
                <div className="date-header">
                  <div className="date-title">{group.date}</div>
                  <div className="date-summary">
                    {group.trips.length} kelionės • {group.totalDistance.toFixed(1)} km •{" "}
                    {formatDuration(group.totalDuration)}
                  </div>
                </div>

                {/* Trips for this date */}
                <div className="trips-cards">
                  {group.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className={`trip-card ${expandedTrip?.id === trip.id ? "trip-expanded" : ""} ${
                        trip.status === "ongoing" ? "trip-ongoing" : ""
                      }`}
                    >
                      {/* Trip Header - Clickable */}
                      <div
                        className="trip-card-header"
                        onClick={() => handleExpandTrip(trip)}
                      >
                        <div className="trip-times">
                          <div className="trip-time-start">
                            <span className="time-dot start"></span>
                            <span className="time-value">{formatTime(trip.start_time)}</span>
                          </div>
                          <div className="trip-time-line"></div>
                          <div className="trip-time-end">
                            <span className="time-dot end"></span>
                            <span className="time-value">
                              {trip.status === "ongoing" ? (
                                <span className="ongoing-badge">Vyksta...</span>
                              ) : (
                                formatTime(trip.end_time)
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="trip-stats">
                          <div className="trip-stat">
                            <span className="trip-stat-value">{trip.distance_km.toFixed(1)}</span>
                            <span className="trip-stat-unit">km</span>
                          </div>
                          <div className="trip-stat">
                            <span className="trip-stat-value">
                              {formatDuration(trip.duration_minutes)}
                            </span>
                          </div>
                          <div className="trip-stat">
                            <span className="trip-stat-value">{trip.avg_speed.toFixed(0)}</span>
                            <span className="trip-stat-unit">km/h vid.</span>
                          </div>
                          <div className="trip-stat">
                            <span className="trip-stat-value">{trip.max_speed.toFixed(0)}</span>
                            <span className="trip-stat-unit">km/h max</span>
                          </div>
                        </div>

                        <div className="trip-expand-icon">
                          {expandedTrip?.id === trip.id ? "▲" : "▼"}
                        </div>
                      </div>

                      {/* Expanded Content - Map Preview */}
                      {expandedTrip?.id === trip.id && (
                        <div className="trip-card-expanded">
                          {loadingRoute ? (
                            <div className="trip-map-loading">
                              <div className="spinner"></div>
                              <p>Kraunamas maršrutas...</p>
                            </div>
                          ) : (
                            <>
                              <div className="trip-map-container" ref={mapContainerRef}></div>
                              <div className="trip-details">
                                <div className="trip-detail">
                                  <span className="detail-label">Pradžia:</span>
                                  <span className="detail-value">
                                    {trip.start_lat?.toFixed(5)}, {trip.start_lon?.toFixed(5)}
                                  </span>
                                </div>
                                <div className="trip-detail">
                                  <span className="detail-label">Pabaiga:</span>
                                  <span className="detail-value">
                                    {trip.end_lat?.toFixed(5)}, {trip.end_lon?.toFixed(5)}
                                  </span>
                                </div>
                                <div className="trip-detail">
                                  <span className="detail-label">Taškai:</span>
                                  <span className="detail-value">{trip.points_count} GPS taškų</span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default TripsHistoryPage;
