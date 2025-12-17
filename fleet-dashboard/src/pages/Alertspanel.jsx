// =============================================
// ALERTS PANEL COMPONENT
// Fleet Tracking Dashboard
// =============================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import API_BASE_URL from '../api';
import './AlertsPanel.css';

function AlertsPanel() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { showToast } = useToast();
    
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState(null);

    // Load recent alerts
    useEffect(() => {
        if (!token) return;
        
        loadAlerts();
        loadStats();
        
        // Refresh every 30 seconds
        const interval = setInterval(() => {
            loadAlerts();
            loadStats();
        }, 30000);
        
        return () => clearInterval(interval);
    }, [token]);

    async function loadAlerts() {
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/recent?limit=5`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
                const data = await res.json();
                setAlerts(data);
            }
        } catch (err) {
            console.error('Error loading alerts:', err);
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
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Error loading stats:', err);
        }
    }

    async function handleAcknowledge(alertId, e) {
        e.stopPropagation();
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/acknowledge`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
                showToast('Įspėjimas patvirtintas', 'success');
                loadAlerts();
                loadStats();
            } else {
                showToast('Nepavyko patvirtinti įspėjimo', 'error');
            }
        } catch (err) {
            console.error('Error acknowledging alert:', err);
            showToast('Klaida', 'error');
        }
    }

    async function handleDismiss(alertId, e) {
        e.stopPropagation();
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts/${alertId}/dismiss`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}` }
            });
            
            if (res.ok) {
                showToast('Įspėjimas atmestas', 'success');
                loadAlerts();
                loadStats();
            } else {
                showToast('Nepavyko atmesti įspėjimo', 'error');
            }
        } catch (err) {
            console.error('Error dismissing alert:', err);
            showToast('Klaida', 'error');
        }
    }

    // Get severity color class
    function getSeverityClass(severity) {
        switch (severity) {
            case 'critical': return 'bad';
            case 'warning': return 'warn';
            case 'info': return 'good';
            default: return 'warn';
        }
    }

    // Get alert type icon
    function getAlertIcon(type) {
        switch (type) {
            case 'speed': return '🚗';
            case 'geofence': return '📍';
            case 'maintenance': return '🔧';
            case 'document': return '📄';
            case 'offline': return '📡';
            case 'fuel': return '⛽';
            case 'battery': return '🔋';
            default: return '⚠️';
        }
    }

    // Format time ago
    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Ką tik';
        if (diffMins < 60) return `prieš ${diffMins} min`;
        if (diffHours < 24) return `prieš ${diffHours} val`;
        if (diffDays < 7) return `prieš ${diffDays} d.`;
        return date.toLocaleDateString('lt-LT');
    }

    // Get vehicle display name
    function getVehicleName(alert) {
        if (alert.vehicle_name) return alert.vehicle_name;
        if (alert.vehicle_brand && alert.vehicle_model) {
            return `${alert.vehicle_brand} ${alert.vehicle_model}`;
        }
        if (alert.vehicle_plate) return alert.vehicle_plate;
        return 'Sistema';
    }

    return (
        <div className="card alerts-panel">
            <div className="card-header">
                <div>
                    <h3 className="card-title">🔔 Naujiausi įspėjimai</h3>
                    {stats && stats.active_count > 0 && (
                        <p className="card-sub">
                            {stats.critical_count > 0 && (
                                <span className="alert-count critical">{stats.critical_count} kritiniai</span>
                            )}
                            {stats.warning_count > 0 && (
                                <span className="alert-count warning">{stats.warning_count} įspėjimai</span>
                            )}
                        </p>
                    )}
                </div>
                <button 
                    className="chip"
                    onClick={() => navigate('/alerts')}
                >
                    Visi →
                </button>
            </div>

            {loading ? (
                <div className="alerts-loading">
                    <div className="spinner-small"></div>
                    <span>Kraunama...</span>
                </div>
            ) : alerts.length === 0 ? (
                <div className="alerts-empty">
                    <span className="empty-icon">✅</span>
                    <p>Nėra aktyvių įspėjimų</p>
                </div>
            ) : (
                <div className="alert-list">
                    {alerts.map(alert => (
                        <div 
                            key={alert.id} 
                            className={`alert-item alert-${alert.status}`}
                            onClick={() => navigate(`/alerts/${alert.id}`)}
                        >
                            <div className={`alert-dot ${getSeverityClass(alert.severity)}`}></div>
                            
                            <div className="alert-main">
                                <div className="alert-title">
                                    <span className="alert-icon">{getAlertIcon(alert.alert_type)}</span>
                                    {alert.title}
                                </div>
                                <div className="alert-meta">
                                    {getVehicleName(alert)}
                                    {alert.message && ` • ${alert.message.substring(0, 50)}${alert.message.length > 50 ? '...' : ''}`}
                                </div>
                            </div>
                            
                            <div className="alert-right">
                                <span className="alert-time">{formatTimeAgo(alert.created_at)}</span>
                                
                                {alert.status === 'active' && (
                                    <div className="alert-actions">
                                        <button 
                                            className="alert-action-btn acknowledge"
                                            onClick={(e) => handleAcknowledge(alert.id, e)}
                                            title="Patvirtinti"
                                        >
                                            ✓
                                        </button>
                                        <button 
                                            className="alert-action-btn dismiss"
                                            onClick={(e) => handleDismiss(alert.id, e)}
                                            title="Atmesti"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default AlertsPanel;
