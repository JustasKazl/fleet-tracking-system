// =============================================
// ALERTS PAGE - Full Alerts Management
// Fleet Tracking Dashboard
// =============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../layout/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../api';
import '../styles/alerts-page.css';

function AlertsPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { showToast } = useToast();

    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('active');
    const [severityFilter, setSeverityFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    
    // Pagination
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const limit = 20;

    // Selected for bulk actions
    const [selectedAlerts, setSelectedAlerts] = useState([]);

    useEffect(() => {
        if (token) {
            loadAlerts();
            loadStats();
        }
    }, [token, statusFilter, severityFilter, typeFilter, page]);

    async function loadAlerts() {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: (page * limit).toString()
            });
            
            if (statusFilter) params.append('status', statusFilter);
            if (severityFilter) params.append('severity', severityFilter);
            if (typeFilter) params.append('type', typeFilter);

            const res = await fetch(`${API_BASE_URL}/api/alerts?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setAlerts(data.alerts);
                setTotal(data.total);
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
                const actionText = {
                    acknowledge: 'patvirtintas',
                    resolve: 'išspręstas',
                    dismiss: 'atmestas'
                };
                showToast(`Įspėjimas ${actionText[action]}`, 'success');
                loadAlerts();
                loadStats();
            } else {
                showToast('Nepavyko atlikti veiksmo', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            showToast('Klaida', 'error');
        }
    }

    async function handleBulkAction(action) {
        if (selectedAlerts.length === 0) {
            showToast('Pasirinkite įspėjimus', 'warning');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/bulk-action`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    alert_ids: selectedAlerts,
                    action
                })
            });

            if (res.ok) {
                const data = await res.json();
                showToast(data.message, 'success');
                setSelectedAlerts([]);
                loadAlerts();
                loadStats();
            } else {
                showToast('Nepavyko atlikti veiksmo', 'error');
            }
        } catch (err) {
            console.error('Error:', err);
            showToast('Klaida', 'error');
        }
    }

    function toggleSelectAlert(alertId) {
        setSelectedAlerts(prev => 
            prev.includes(alertId) 
                ? prev.filter(id => id !== alertId)
                : [...prev, alertId]
        );
    }

    function toggleSelectAll() {
        if (selectedAlerts.length === alerts.length) {
            setSelectedAlerts([]);
        } else {
            setSelectedAlerts(alerts.map(a => a.id));
        }
    }

    function getSeverityClass(severity) {
        switch (severity) {
            case 'critical': return 'bad';
            case 'warning': return 'warn';
            case 'info': return 'good';
            default: return 'warn';
        }
    }

    function getAlertIcon(type) {
        const icons = {
            speed: '🚗',
            geofence: '📍',
            maintenance: '🔧',
            document: '📄',
            offline: '📡',
            fuel: '⛽',
            battery: '🔋',
            custom: '⚠️'
        };
        return icons[type] || '⚠️';
    }

    function getAlertTypeName(type) {
        const names = {
            speed: 'Greitis',
            geofence: 'Geofence',
            maintenance: 'Servisas',
            document: 'Dokumentai',
            offline: 'Offline',
            fuel: 'Kuras',
            battery: 'Baterija',
            custom: 'Kita'
        };
        return names[type] || type;
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString('lt-LT', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function getVehicleName(alert) {
        if (alert.vehicle_name) return alert.vehicle_name;
        if (alert.vehicle_brand && alert.vehicle_model) {
            return `${alert.vehicle_brand} ${alert.vehicle_model}`;
        }
        if (alert.vehicle_plate) return alert.vehicle_plate;
        return 'Sistema';
    }

    const totalPages = Math.ceil(total / limit);

    return (
        <DashboardLayout>
            <div className="alerts-page">
                {/* Header */}
                <div className="alerts-page-header">
                    <div className="alerts-title-section">
                        <h1 className="alerts-page-title">🔔 Įspėjimai</h1>
                        <p className="alerts-page-subtitle">Valdykite visus sistemos įspėjimus</p>
                    </div>
                </div>

                {/* Stats Cards */}
                {stats && (
                    <div className="alerts-stats-grid">
                        <div className="alert-stat-card stat-critical">
                            <div className="stat-icon">🚨</div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.critical_count || 0}</div>
                                <div className="stat-label">Kritiniai</div>
                            </div>
                        </div>
                        <div className="alert-stat-card stat-warning">
                            <div className="stat-icon">⚠️</div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.warning_count || 0}</div>
                                <div className="stat-label">Įspėjimai</div>
                            </div>
                        </div>
                        <div className="alert-stat-card stat-active">
                            <div className="stat-icon">📋</div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.active_count || 0}</div>
                                <div className="stat-label">Aktyvūs</div>
                            </div>
                        </div>
                        <div className="alert-stat-card stat-resolved">
                            <div className="stat-icon">✅</div>
                            <div className="stat-content">
                                <div className="stat-value">{stats.resolved_today || 0}</div>
                                <div className="stat-label">Išspręsta šiandien</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="alerts-filters">
                    <div className="filter-tabs">
                        <button 
                            className={`filter-tab ${statusFilter === 'active' ? 'active' : ''}`}
                            onClick={() => { setStatusFilter('active'); setPage(0); }}
                        >
                            Aktyvūs
                        </button>
                        <button 
                            className={`filter-tab ${statusFilter === 'acknowledged' ? 'active' : ''}`}
                            onClick={() => { setStatusFilter('acknowledged'); setPage(0); }}
                        >
                            Patvirtinti
                        </button>
                        <button 
                            className={`filter-tab ${statusFilter === 'resolved' ? 'active' : ''}`}
                            onClick={() => { setStatusFilter('resolved'); setPage(0); }}
                        >
                            Išspręsti
                        </button>
                        <button 
                            className={`filter-tab ${statusFilter === '' ? 'active' : ''}`}
                            onClick={() => { setStatusFilter(''); setPage(0); }}
                        >
                            Visi
                        </button>
                    </div>

                    <div className="filter-selects">
                        <select 
                            className="filter-select"
                            value={severityFilter}
                            onChange={(e) => { setSeverityFilter(e.target.value); setPage(0); }}
                        >
                            <option value="">Visi lygiai</option>
                            <option value="critical">🔴 Kritiniai</option>
                            <option value="warning">🟡 Įspėjimai</option>
                            <option value="info">🟢 Informaciniai</option>
                        </select>

                        <select 
                            className="filter-select"
                            value={typeFilter}
                            onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }}
                        >
                            <option value="">Visi tipai</option>
                            <option value="speed">🚗 Greitis</option>
                            <option value="document">📄 Dokumentai</option>
                            <option value="maintenance">🔧 Servisas</option>
                            <option value="offline">📡 Offline</option>
                            <option value="geofence">📍 Geofence</option>
                            <option value="fuel">⛽ Kuras</option>
                            <option value="battery">🔋 Baterija</option>
                        </select>
                    </div>
                </div>

                {/* Bulk Actions */}
                {selectedAlerts.length > 0 && (
                    <div className="bulk-actions-bar">
                        <span className="bulk-count">Pasirinkta: {selectedAlerts.length}</span>
                        <div className="bulk-buttons">
                            <button 
                                className="bulk-btn acknowledge"
                                onClick={() => handleBulkAction('acknowledge')}
                            >
                                ✓ Patvirtinti
                            </button>
                            <button 
                                className="bulk-btn resolve"
                                onClick={() => handleBulkAction('resolve')}
                            >
                                ✅ Išspręsti
                            </button>
                            <button 
                                className="bulk-btn dismiss"
                                onClick={() => handleBulkAction('dismiss')}
                            >
                                ✕ Atmesti
                            </button>
                        </div>
                    </div>
                )}

                {/* Alerts List */}
                {loading ? (
                    <div className="alerts-loading-full">
                        <div className="spinner"></div>
                        <p>Kraunami įspėjimai...</p>
                    </div>
                ) : alerts.length === 0 ? (
                    <div className="alerts-empty-full">
                        <div className="empty-icon">🔔</div>
                        <h3>Nėra įspėjimų</h3>
                        <p>Pagal pasirinktus filtrus įspėjimų nerasta.</p>
                    </div>
                ) : (
                    <>
                        <div className="alerts-table-wrapper">
                            <table className="alerts-table">
                                <thead>
                                    <tr>
                                        <th className="col-checkbox">
                                            <input 
                                                type="checkbox"
                                                checked={selectedAlerts.length === alerts.length}
                                                onChange={toggleSelectAll}
                                            />
                                        </th>
                                        <th className="col-severity">Lygis</th>
                                        <th className="col-type">Tipas</th>
                                        <th className="col-title">Aprašymas</th>
                                        <th className="col-vehicle">Automobilis</th>
                                        <th className="col-date">Data</th>
                                        <th className="col-status">Būsena</th>
                                        <th className="col-actions">Veiksmai</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alerts.map(alert => (
                                        <tr 
                                            key={alert.id}
                                            className={`alert-row ${selectedAlerts.includes(alert.id) ? 'selected' : ''}`}
                                        >
                                            <td className="col-checkbox">
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedAlerts.includes(alert.id)}
                                                    onChange={() => toggleSelectAlert(alert.id)}
                                                />
                                            </td>
                                            <td className="col-severity">
                                                <span className={`severity-badge ${getSeverityClass(alert.severity)}`}>
                                                    {alert.severity === 'critical' && '🔴'}
                                                    {alert.severity === 'warning' && '🟡'}
                                                    {alert.severity === 'info' && '🟢'}
                                                </span>
                                            </td>
                                            <td className="col-type">
                                                <span className="type-badge">
                                                    {getAlertIcon(alert.alert_type)} {getAlertTypeName(alert.alert_type)}
                                                </span>
                                            </td>
                                            <td className="col-title">
                                                <div className="alert-title-cell">
                                                    <span className="title-text">{alert.title}</span>
                                                    {alert.message && (
                                                        <span className="message-text">{alert.message}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="col-vehicle">
                                                {alert.vehicle_id ? (
                                                    <button 
                                                        className="vehicle-link"
                                                        onClick={() => navigate(`/vehicles/${alert.vehicle_id}`)}
                                                    >
                                                        {getVehicleName(alert)}
                                                    </button>
                                                ) : (
                                                    <span className="system-badge">Sistema</span>
                                                )}
                                            </td>
                                            <td className="col-date">
                                                {formatDate(alert.created_at)}
                                            </td>
                                            <td className="col-status">
                                                <span className={`status-badge status-${alert.status}`}>
                                                    {alert.status === 'active' && 'Aktyvus'}
                                                    {alert.status === 'acknowledged' && 'Patvirtintas'}
                                                    {alert.status === 'resolved' && 'Išspręstas'}
                                                    {alert.status === 'dismissed' && 'Atmestas'}
                                                </span>
                                            </td>
                                            <td className="col-actions">
                                                <div className="action-buttons">
                                                    {alert.status === 'active' && (
                                                        <>
                                                            <button 
                                                                className="action-btn acknowledge"
                                                                onClick={() => handleAction(alert.id, 'acknowledge')}
                                                                title="Patvirtinti"
                                                            >
                                                                ✓
                                                            </button>
                                                            <button 
                                                                className="action-btn resolve"
                                                                onClick={() => handleAction(alert.id, 'resolve')}
                                                                title="Išspręsti"
                                                            >
                                                                ✅
                                                            </button>
                                                        </>
                                                    )}
                                                    {alert.status === 'acknowledged' && (
                                                        <button 
                                                            className="action-btn resolve"
                                                            onClick={() => handleAction(alert.id, 'resolve')}
                                                            title="Išspręsti"
                                                        >
                                                            ✅
                                                        </button>
                                                    )}
                                                    <button 
                                                        className="action-btn dismiss"
                                                        onClick={() => handleAction(alert.id, 'dismiss')}
                                                        title="Atmesti"
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

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="alerts-pagination">
                                <button 
                                    className="pagination-btn"
                                    disabled={page === 0}
                                    onClick={() => setPage(p => p - 1)}
                                >
                                    ← Ankstesnis
                                </button>
                                <span className="pagination-info">
                                    Puslapis {page + 1} iš {totalPages}
                                </span>
                                <button 
                                    className="pagination-btn"
                                    disabled={page >= totalPages - 1}
                                    onClick={() => setPage(p => p + 1)}
                                >
                                    Kitas →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

export default AlertsPage;
