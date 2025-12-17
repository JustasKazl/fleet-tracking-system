import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";

function Dashboard() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { showToast } = useToast();

    // State
    const [vehicles, setVehicles] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        total: 0,
        online: 0,
        offline: 0,
        totalKm: 0,
        alertsCount: 0
    });

    // Load data on mount
    useEffect(() => {
        if (token) {
            loadDashboardData();
            
            // Refresh every 30 seconds
            const interval = setInterval(loadDashboardData, 30000);
            return () => clearInterval(interval);
        }
    }, [token]);

    async function loadDashboardData() {
        try {
            // Load vehicles
            const vehiclesRes = await fetch(`${API_BASE_URL}/api/vehicles`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (vehiclesRes.ok) {
                const vehiclesData = await vehiclesRes.json();
                const vehiclesList = Array.isArray(vehiclesData) ? vehiclesData : [];
                setVehicles(vehiclesList);
                
                // Calculate stats
                const online = vehiclesList.filter(v => v.status === 'online').length;
                const offline = vehiclesList.filter(v => v.status === 'offline').length;
                const totalKm = vehiclesList.reduce((sum, v) => sum + (v.total_km || 0), 0);
                
                setStats(prev => ({
                    ...prev,
                    total: vehiclesList.length,
                    online,
                    offline,
                    totalKm
                }));
            }

            // Try to load alerts (may not exist yet)
            try {
                const alertsRes = await fetch(`${API_BASE_URL}/api/alerts/recent?limit=5`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                if (alertsRes.ok) {
                    const alertsData = await alertsRes.json();
                    setAlerts(Array.isArray(alertsData) ? alertsData : []);
                    setStats(prev => ({ ...prev, alertsCount: alertsData.length }));
                }
            } catch (e) {
                // Alerts endpoint may not exist - use mock data
                console.log('Alerts API not available, using placeholders');
            }

        } catch (err) {
            console.error('Error loading dashboard:', err);
            showToast('Nepavyko įkelti duomenų', 'error');
        } finally {
            setLoading(false);
        }
    }

    // Get top vehicles by km
    const topVehicles = [...vehicles]
        .sort((a, b) => (b.total_km || 0) - (a.total_km || 0))
        .slice(0, 3);

    // Format time ago
    function formatTimeAgo(timestamp) {
        if (!timestamp) return "Niekada";
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return "Ką tik";
        if (diffMins < 60) return `${diffMins} min`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} val`;
        
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} d.`;
    }

    return (
        <DashboardLayout>
            {/* KPI ROW */}
            <div className="kpi-row">
                <div className="kpi-card">
                    <div className="kpi-label">Viso automobilių</div>
                    <div className="kpi-value">{stats.total}</div>
                    <div className="kpi-sub">registruota sistemoje</div>
                </div>

                <div className="kpi-card" style={{ borderColor: 'rgba(59, 242, 140, 0.3)' }}>
                    <div className="kpi-label">Online</div>
                    <div className="kpi-value" style={{ color: 'var(--good)' }}>{stats.online}</div>
                    <div className="kpi-sub">aktyvūs dabar</div>
                </div>

                <div className="kpi-card" style={{ borderColor: 'rgba(242, 68, 68, 0.3)' }}>
                    <div className="kpi-label">Offline</div>
                    <div className="kpi-value" style={{ color: 'var(--bad)' }}>{stats.offline}</div>
                    <div className="kpi-sub">neprisijungę</div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-label">Iš viso nuvažiuota</div>
                    <div className="kpi-value">{(stats.totalKm / 1000).toFixed(1)}k</div>
                    <div className="kpi-sub">km visų automobilių</div>
                </div>
            </div>

            {/* MAIN CONTENT GRID */}
            <div className="row row-main">
                {/* LEFT COLUMN */}
                <div className="left-column">
                    {/* Alerts + Top Vehicles Row */}
                    <div className="row-left-top">
                        {/* ALERTS PANEL */}
                        <div className="card">
                            <div className="card-header">
                                <div>
                                    <div className="card-title">🔔 Naujiausi įspėjimai</div>
                                    <div className="card-sub">Paskutinės 24 val.</div>
                                </div>
                                <button className="chip" onClick={() => navigate('/alerts')}>
                                    Visi →
                                </button>
                            </div>

                            <div className="alert-list">
                                {alerts.length === 0 ? (
                                    // Show placeholder alerts if none exist
                                    <>
                                        {vehicles.filter(v => v.status === 'offline').slice(0, 2).map(v => (
                                            <div key={v.id} className="alert-item">
                                                <span className="alert-dot bad"></span>
                                                <div className="alert-main">
                                                    <div className="alert-title">{v.brand} {v.model} – Offline</div>
                                                    <div className="alert-meta">Neprisijungęs</div>
                                                </div>
                                                <div className="alert-time">{formatTimeAgo(v.last_seen)}</div>
                                            </div>
                                        ))}
                                        {vehicles.filter(v => v.status === 'offline').length === 0 && (
                                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                                <div style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}>✅</div>
                                                <div>Nėra įspėjimų</div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    alerts.map(alert => (
                                        <div key={alert.id} className="alert-item">
                                            <span className={`alert-dot ${
                                                alert.severity === 'critical' ? 'bad' : 
                                                alert.severity === 'warning' ? 'warn' : 'good'
                                            }`}></span>
                                            <div className="alert-main">
                                                <div className="alert-title">{alert.title}</div>
                                                <div className="alert-meta">{alert.message}</div>
                                            </div>
                                            <div className="alert-time">{formatTimeAgo(alert.created_at)}</div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* TOP VEHICLES */}
                        <div className="card">
                            <div className="card-header">
                                <div className="card-title">🏆 Daugiausiai nuvažiavę</div>
                                <div className="card-sub">TOP {topVehicles.length}</div>
                            </div>

                            <div className="top-list">
                                {topVehicles.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        Nėra automobilių
                                    </div>
                                ) : (
                                    topVehicles.map((v, i) => (
                                        <div key={v.id} className="top-item">
                                            <span>
                                                {i === 0 && '🥇 '}
                                                {i === 1 && '🥈 '}
                                                {i === 2 && '🥉 '}
                                                {v.brand} {v.model}
                                            </span>
                                            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                                                {(v.total_km || 0).toLocaleString('lt-LT')} km
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* VEHICLES TABLE */}
                    <div className="card vehicles-table-card">
                        <div className="card-header">
                            <div>
                                <div className="card-title">🚗 Automobilių sąrašas</div>
                                <div className="card-sub">Statusas ir rida</div>
                            </div>
                            <button className="chip" onClick={() => navigate('/vehicles')}>
                                Valdyti →
                            </button>
                        </div>

                        {loading ? (
                            <div style={{ padding: '40px', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto' }}></div>
                            </div>
                        ) : vehicles.length === 0 ? (
                            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>🚗</div>
                                <div>Nėra automobilių</div>
                                <button 
                                    className="btn-primary" 
                                    style={{ marginTop: '16px' }}
                                    onClick={() => navigate('/vehicles')}
                                >
                                    + Pridėti automobilį
                                </button>
                            </div>
                        ) : (
                            <table className="vehicles-table">
                                <thead>
                                    <tr>
                                        <th>Automobilis</th>
                                        <th>Statusas</th>
                                        <th>Paskutinis ryšys</th>
                                        <th>Iš viso km</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehicles.slice(0, 5).map(v => (
                                        <tr 
                                            key={v.id} 
                                            onClick={() => navigate(`/vehicles/${v.id}`)}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: '8px',
                                                        background: 'linear-gradient(135deg, var(--accent), var(--accent-alt))',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '14px',
                                                        fontWeight: 700
                                                    }}>
                                                        {v.brand?.[0] || '?'}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 600 }}>{v.brand} {v.model}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                            {v.plate || 'Be numerių'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`status-tag ${
                                                    v.status === 'online' ? 'status-online' : 
                                                    v.status === 'warning' ? 'status-warn' : 'status-offline'
                                                }`}>
                                                    {v.status === 'online' ? 'Online' : 
                                                     v.status === 'warning' ? 'Įspėjimas' : 'Offline'}
                                                </span>
                                            </td>
                                            <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                                {formatTimeAgo(v.last_seen)}
                                            </td>
                                            <td style={{ fontWeight: 600 }}>
                                                {(v.total_km || 0).toLocaleString('lt-LT')} km
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {vehicles.length > 5 && (
                            <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--border-light)' }}>
                                <button className="btn-link" onClick={() => navigate('/vehicles')}>
                                    Rodyti visus ({vehicles.length}) →
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* MAP CARD */}
                <div className="card map-card">
                    <div className="card-header">
                        <div>
                            <div className="card-title">📍 Žemėlapis</div>
                            <div className="card-sub">
                                {vehicles.length} automobilių pozicijos
                            </div>
                        </div>
                        <button 
                            className="chip" 
                            onClick={() => vehicles.length > 0 && navigate(`/vehicles/${vehicles[0].id}`)}
                        >
                            Atidaryti
                        </button>
                    </div>

                    <div className="map-placeholder" style={{ position: 'relative' }}>
                        {loading ? (
                            <div className="spinner"></div>
                        ) : vehicles.length === 0 ? (
                            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>🗺️</div>
                                <div>Pridėkite automobilį, kad matytumėte žemėlapį</div>
                            </div>
                        ) : (
                            <>
                                <div style={{ 
                                    fontSize: '48px', 
                                    marginBottom: '12px',
                                    animation: 'pulse 2s infinite'
                                }}>
                                    🗺️
                                </div>
                                <div style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                                    Pasirinkite automobilį, kad matytumėte maršrutą
                                </div>
                                <div style={{ 
                                    display: 'flex', 
                                    flexWrap: 'wrap', 
                                    gap: '8px', 
                                    justifyContent: 'center',
                                    maxWidth: '300px'
                                }}>
                                    {vehicles.slice(0, 4).map(v => (
                                        <button
                                            key={v.id}
                                            className="btn-ghost"
                                            onClick={() => navigate(`/vehicles/${v.id}`)}
                                            style={{ fontSize: '12px' }}
                                        >
                                            {v.brand} {v.model}
                                        </button>
                                    ))}
                                </div>
                                
                                {/* Animated markers */}
                                <div className="map-marker" style={{ top: '25%', left: '30%' }} />
                                <div className="map-marker" style={{ top: '45%', left: '55%' }} />
                                <div className="map-marker" style={{ top: '65%', left: '35%' }} />
                            </>
                        )}
                    </div>
                </div>
            </div>

        </DashboardLayout>
    );
}

export default Dashboard;
