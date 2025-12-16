import { useState, useEffect } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import '../styles/trips-history.css';

function TripsHistoryPage() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  const [dateRange, setDateRange] = useState({
    start: getDefaultStartDate(),
    end: getDefaultEndDate(),
  });
  const [minDistance, setMinDistance] = useState(0.5);
  const [expandedTrip, setExpandedTrip] = useState(null);

  function getDefaultStartDate() {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  }

  function getDefaultEndDate() {
    return new Date().toISOString().split("T")[0];
  }

  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE_URL}/api/vehicles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setVehicles(data);
        if (data.length > 0) setSelectedVehicle(data[0]);
      })
      .catch(() => showToast("Nepavyko įkelti automobilių", "error"))
      .finally(() => setLoadingVehicles(false));
  }, [token]);

  useEffect(() => {
    if (selectedVehicle && token) loadTrips();
  }, [selectedVehicle, dateRange, minDistance]);

  async function loadTrips() {
    if (!selectedVehicle) return;

    setLoading(true);
    setExpandedTrip(null);

    try {
      const params = new URLSearchParams({
        start_date: dateRange.start,
        end_date: dateRange.end,
        min_distance: minDistance.toString(),
      });

      const res = await fetch(
        `${API_BASE_URL}/api/vehicles/${selectedVehicle.id}/trips?${params}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed");
      setTrips(await res.json());
    } catch {
      showToast("Nepavyko įkelti kelionių", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleExpandTrip(trip) {
    if (expandedTrip?.id === trip.id) {
      setExpandedTrip(null);
    } else {
      setExpandedTrip(trip);
    }
  }

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
        groups[date] = { date, dateKey: trip.start_time.split("T")[0], trips: [], totalDistance: 0, totalDuration: 0 };
      }
      groups[date].trips.push(trip);
      groups[date].totalDistance += trip.distance_km;
      groups[date].totalDuration += trip.duration_minutes;
    });
    return Object.values(groups);
  }

  function formatDuration(minutes) {
    if (minutes < 60) return `${Math.round(minutes)} min`;
    return `${Math.floor(minutes / 60)} val ${Math.round(minutes % 60)} min`;
  }

  function formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" });
  }

  const groupedTrips = groupTripsByDate(trips);
  const totalDistance = trips.reduce((sum, t) => sum + t.distance_km, 0);
  const totalDuration = trips.reduce((sum, t) => sum + t.duration_minutes, 0);
  const ongoingTrips = trips.filter((t) => t.status === "ongoing").length;

  return (
    <DashboardLayout>
      <div className="trips-history-page">
        <div className="trips-header">
          <div className="trips-title-section">
            <h1 className="trips-title">📍 Kelionių istorija</h1>
            <p className="trips-subtitle">Peržiūrėkite automobilių keliones ir maršrutus</p>
          </div>
        </div>

        <div className="trips-filters">
          <div className="filter-group">
            <label className="filter-label">Automobilis</label>
            <select
              className="filter-select"
              value={selectedVehicle?.id || ""}
              onChange={(e) => setSelectedVehicle(vehicles.find((v) => v.id === parseInt(e.target.value)))}
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

          <div className="filter-group">
            <label className="filter-label">Nuo</label>
            <input
              type="date"
              className="filter-input"
              value={dateRange.start}
              onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label">Iki</label>
            <input
              type="date"
              className="filter-input"
              value={dateRange.end}
              onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            />
          </div>

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
            </select>
          </div>

          <button className="btn-refresh" onClick={loadTrips} disabled={loading || !selectedVehicle}>
            🔄 Atnaujinti
          </button>
        </div>

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

        {loading && (
          <div className="trips-loading">
            <div className="spinner"></div>
            <p>Kraunamos kelionės...</p>
          </div>
        )}

        {!loading && trips.length === 0 && selectedVehicle && (
          <div className="trips-empty">
            <div className="empty-icon">🗺️</div>
            <h3>Nerasta kelionių</h3>
            <p>Pasirinktame laikotarpyje kelionių nerasta.</p>
          </div>
        )}

        {!loading && groupedTrips.length > 0 && (
          <div className="trips-list">
            {groupedTrips.map((group) => (
              <div key={group.dateKey} className="trip-date-group">
                <div className="date-header">
                  <div className="date-title">{group.date}</div>
                  <div className="date-summary">
                    {group.trips.length} kelionės • {group.totalDistance.toFixed(1)} km • {formatDuration(group.totalDuration)}
                  </div>
                </div>

                <div className="trips-cards">
                  {group.trips.map((trip) => (
                    <div
                      key={trip.id}
                      className={`trip-card ${expandedTrip?.id === trip.id ? "trip-expanded" : ""} ${trip.status === "ongoing" ? "trip-ongoing" : ""}`}
                    >
                      <div className="trip-card-header" onClick={() => handleExpandTrip(trip)}>
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
                            <span className="trip-stat-value">{formatDuration(trip.duration_minutes)}</span>
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

                        <div className="trip-expand-icon">{expandedTrip?.id === trip.id ? "▲" : "▼"}</div>
                      </div>

                      {expandedTrip?.id === trip.id && (
                        <div className="trip-card-expanded">
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
                            <div className="trip-detail">
                              <span className="detail-label">Trukmė:</span>
                              <span className="detail-value">{formatDuration(trip.duration_minutes)}</span>
                            </div>
                          </div>
                          <div className="trip-map-placeholder">
                            <span>🗺️</span>
                            <p>Žemėlapio peržiūra bus prieinama netrukus</p>
                          </div>
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
