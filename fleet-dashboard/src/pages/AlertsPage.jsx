import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../api';

function AlertsPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { showToast } = useToast();

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    
    // Only severity filter
    const [severityFilter, setSeverityFilter] = useState('');

    useEffect(() => {
        if (token) {
            loadAlerts();
            loadStats();
        }
    }, [token, severityFilter]);

    async function loadAlerts() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (severityFilter) params.append('severity', severityFilter);

            const res = await fetch(`${API_BASE_URL}/api/alerts?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setAlerts(data.alerts || []);
            }
        } catch (err) {
            console.error('Error loading alerts:', err);
            showToast('Nepavyko įkelti įspėjimų', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function loadStats() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setStats(await res.json());
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    async function handleAction(alertId, action) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/${action}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                showToast('Įspėjimas atnaujintas', 'success');
                loadAlerts();
                loadStats();
            } else {
                showToast('Nepavyko atlikti veiksmo', 'error');
            }
        } catch (err) {
            showToast('Klaida', 'error');
        }
    }

    function getAlertIcon(type) {
        const icons = {
            speed: '🚗', geofence: '📍', maintenance: '🔧', document: '📄',
            offline: '📡', fuel: '⛽', battery: '🔋', custom: '⚠️'
        };
        return icons[type] || '⚠️';
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString('lt-LT', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    function getVehicleName(alert) {
        if (alert.vehicle_name) return alert.vehicle_name;
        if (alert.vehicle_brand && alert.vehicle_model) return `${alert.vehicle_brand} ${alert.vehicle_model}`;
        if (alert.vehicle_plate) return alert.vehicle_plate;
        return 'Sistema';
    }

    return (
        <DashboardLayout>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
                
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>🔔 Įspėjimai</h1>
                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                            Valdykite visus sistemos įspėjimus
                        </p>
                    </div>
                </div>

                {/* Stats */}
                {stats && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderColor: 'rgba(242, 68, 68, 0.3)' }}>
                            <span style={{ fontSize: '32px' }}>🚨</span>
                            <div>
                                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--bad)' }}>{stats.critical_count || 0}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>KRITINIAI</div>
                            </div>
                        </div>
                        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderColor: 'rgba(242, 230, 59, 0.3)' }}>
                            <span style={{ fontSize: '32px' }}>⚠️</span>
                            <div>
                                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warn)' }}>{stats.warning_count || 0}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ĮSPĖJIMAI</div>
                            </div>
                        </div>
                        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', borderColor: 'rgba(59, 242, 140, 0.3)' }}>
                            <span style={{ fontSize: '32px' }}>ℹ️</span>
                            <div>
                                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--good)' }}>{stats.info_count || 0}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>INFORMACINIAI</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Severity Filter */}
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(10, 1, 24, 0.4)', padding: '8px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                    <button 
                        className={severityFilter === '' ? 'btn-primary' : 'btn-ghost'}
                        onClick={() => setSeverityFilter('')}
                        style={{ flex: 1 }}
                    >
                        Visi
                    </button>
                    <button 
                        className={severityFilter === 'critical' ? 'btn-primary' : 'btn-ghost'}
                        onClick={() => setSeverityFilter('critical')}
                        style={{ flex: 1 }}
                    >
                        🔴 Kritiniai
                    </button>
                    <button 
                        className={severityFilter === 'warning' ? 'btn-primary' : 'btn-ghost'}
                        onClick={() => setSeverityFilter('warning')}
                        style={{ flex: 1 }}
                    >
                        🟡 Įspėjimai
                    </button>
                    <button 
                        className={severityFilter === 'info' ? 'btn-primary' : 'btn-ghost'}
                        onClick={() => setSeverityFilter('info')}
                        style={{ flex: 1 }}
                    >
                        🟢 Info
                    </button>
                </div>

                {/* Alerts List */}
                {loading ? (
                    <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
                        <p style={{ color: 'var(--text-muted)' }}>Kraunami įspėjimai...</p>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
                        <div style={{ fontSize: '64px', marginBottom: '16px', opacity: 0.5 }}>✅</div>
                        <h3 style={{ margin: '0 0 8px' }}>Nėra įspėjimų</h3>
                        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Viskas gerai!</p>
                    </div>
                ) : (
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <table className="vehicles-table" style={{ width: '100%' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '50px' }}>Lygis</th>
                                    <th>Aprašymas</th>
                                    <th>Automobilis</th>
                                    <th>Data</th>
                                    <th style={{ width: '120px' }}>Veiksmai</th>
                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map(alert => (
                                    <tr key={alert.id}>
                                        <td style={{ textAlign: 'center', fontSize: '18px' }}>
                                            {alert.severity === 'critical' && '🔴'}
                                            {alert.severity === 'warning' && '🟡'}
                                            {alert.severity === 'info' && '🟢'}
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>
                                                {getAlertIcon(alert.alert_type)} {alert.title}
                                            </div>
                                            {alert.message && (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                    {alert.message}
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {alert.vehicle_id ? (
                                                <button 
                                                    className="btn-link"
                                                    onClick={() => navigate(`/vehicles/${alert.vehicle_id}`)}
                                                >
                                                    {getVehicleName(alert)}
                                                </button>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Sistema</span>
                                            )}
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                            {formatDate(alert.created_at)}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {alert.status === 'active' && (
                                                    <button 
                                                        className="btn-ghost"
                                                        onClick={() => handleAction(alert.id, 'acknowledge')}
                                                        title="Patvirtinti"
                                                        style={{ padding: '6px 10px', fontSize: '12px' }}
                                                    >
                                                        ✓
                                                    </button>
                                                )}
                                                <button 
                                                    className="btn-ghost"
                                                    onClick={() => handleAction(alert.id, 'resolve')}
                                                    title="Išspręsti"
                                                    style={{ padding: '6px 10px', fontSize: '12px' }}
                                                >
                                                    ✅
                                                </button>
                                                <button 
                                                    className="btn-ghost"
                                                    onClick={() => handleAction(alert.id, 'dismiss')}
                                                    title="Atmesti"
                                                    style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--bad)' }}
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

export default AlertsPage;
