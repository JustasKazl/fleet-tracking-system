// =============================================
// OBD PAGE - Clean version using CSS classes
// Fleet Tracking Dashboard
// =============================================

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import "../styles/obd-dashboard.css";

const OBD_PARAMS = {
    rpm: { label: "Variklio RPM", unit: "rpm", icon: "🔄", color: "#667eea", min: 0, max: 8000,
        thresholds: { normal: { max: 4000 }, warning: { max: 5500 }, critical: { max: 8000 } },
        alertMessage: "Variklio apsukos per didelės" },
    coolant_temp: { label: "Aušinimo skystis", unit: "°C", icon: "🌡️", color: "#f59e0b", min: -40, max: 130,
        thresholds: { normal: { max: 95 }, warning: { max: 105 }, critical: { max: 130 } },
        alertMessage: "Variklio temperatūra per aukšta" },
    speed_kmh: { label: "Greitis", unit: "km/h", icon: "🚗", color: "#3b82f6", min: 0, max: 200,
        thresholds: { normal: { max: 90 }, warning: { max: 130 }, critical: { max: 200 } },
        alertMessage: "Viršytas greičio limitas" },
    engine_load: { label: "Variklio apkrova", unit: "%", icon: "⚡", color: "#8b5cf6", min: 0, max: 100,
        thresholds: { normal: { max: 70 }, warning: { max: 85 }, critical: { max: 100 } },
        alertMessage: "Variklio apkrova per didelė" },
    intake_air_temp: { label: "Įsiurb. oro temp.", unit: "°C", icon: "🌬️", color: "#06b6d4", min: -40, max: 80,
        thresholds: { normal: { max: 45 }, warning: { max: 60 }, critical: { max: 80 } },
        alertMessage: "Įsiurbimo oro temperatūra per aukšta" },
    maf: { label: "MAF sensorius", unit: "g/s", icon: "💨", color: "#10b981", min: 0, max: 500,
        thresholds: { normal: { max: 250 }, warning: { max: 400 }, critical: { max: 500 } },
        alertMessage: "MAF reikšmė nenormali" },
    throttle: { label: "Akseleratoriaus pad.", unit: "%", icon: "🎚️", color: "#f43f5e", min: 0, max: 100,
        thresholds: null, alertMessage: null },
    fuel_level: { label: "Kuro lygis", unit: "%", icon: "⛽", color: "#eab308", min: 0, max: 100,
        thresholds: { normal: { min: 25 }, warning: { min: 10 }, critical: { min: 0 } },
        alertMessage: "Žemas kuro lygis", inverted: true },
    battery_voltage: { label: "Akumuliatorius", unit: "V", icon: "🔋", color: "#22c55e", min: 10, max: 16,
        thresholds: { normal: { min: 13.5 }, warning: { min: 12.0 }, critical: { min: 10 } },
        alertMessage: "Akumuliatoriaus įtampa per žema", inverted: true },
    fuel_rate: { label: "Kuro sąnaudos", unit: "L/100", icon: "📊", color: "#ec4899", min: 0, max: 30,
        thresholds: { normal: { max: 12 }, warning: { max: 18 }, critical: { max: 30 } },
        alertMessage: "Kuro sąnaudos per didelės" },
};

function getValueStatus(value, paramConfig) {
    if (!paramConfig?.thresholds) return 'normal';
    const { thresholds, inverted } = paramConfig;
    if (inverted) {
        // For inverted (fuel, battery): lower is worse
        if (value < (thresholds.critical?.min ?? -Infinity)) return 'critical';
        if (value < (thresholds.warning?.min ?? -Infinity)) return 'warning';
        if (value < (thresholds.normal?.min ?? -Infinity)) return 'warning';
        return 'normal';
    } else {
        // For normal params: higher is worse
        // Check if above critical threshold
        if (value >= (thresholds.critical?.max ?? Infinity)) return 'critical';
        // Check if above warning threshold (which is same as normal.max)
        if (value >= (thresholds.warning?.max ?? Infinity)) return 'critical';
        // Check if above normal threshold - this means we're in warning zone
        if (value > (thresholds.normal?.max ?? Infinity)) return 'warning';
        return 'normal';
    }
}

const statusColors = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

function OBDPage() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [telemetry, setTelemetry] = useState([]);
    const [loading, setLoading] = useState(false);
    const [timeRange, setTimeRange] = useState("24h");
    const [availableParams, setAvailableParams] = useState([]);
    const [selectedParam, setSelectedParam] = useState(null);
    const [createdAlerts, setCreatedAlerts] = useState(new Set());
    const [paramAlerts, setParamAlerts] = useState({}); // Track max severity per param

    useEffect(() => {
        if (!token) return;
        fetch(`${API_BASE_URL}/api/vehicles`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data) ? data : [];
                setVehicles(list);
                if (list.length > 0) setSelectedVehicle(list[0]);
            })
            .catch(console.error)
            .finally(() => setLoadingVehicles(false));
    }, [token]);

    useEffect(() => {
        if (selectedVehicle?.imei && token) loadTelemetry();
    }, [selectedVehicle, token, timeRange]);

    async function createAlert(severity, type, message, metadata = {}) {
        if (!selectedVehicle || !token) return;
        const alertKey = `${selectedVehicle.id}-${type}-${Date.now().toString().slice(0, -4)}`;
        if (createdAlerts.has(alertKey)) return;
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vehicle_id: selectedVehicle.id, alert_type: type, severity, title: message,
                    message: `${message} - ${selectedVehicle.brand} ${selectedVehicle.model}`,
                    metadata: { ...metadata, vehicle_name: `${selectedVehicle.brand} ${selectedVehicle.model}`, source: 'obd' }
                })
            });
            if (res.ok) {
                setCreatedAlerts(prev => new Set([...prev, alertKey]));
                showToast(`⚠️ ${message}`, severity === 'critical' ? 'error' : 'warning');
            }
        } catch (err) { console.error(err); }
    }

    function checkThresholds(paramName, value) {
        const param = OBD_PARAMS[paramName];
        if (!param?.alertMessage) return;
        const status = getValueStatus(value, param);
        
        // Track the worst status for this parameter
        if (status === 'critical' || status === 'warning') {
            setParamAlerts(prev => {
                const current = prev[paramName];
                // Only upgrade: normal -> warning -> critical
                if (!current || (current === 'warning' && status === 'critical')) {
                    return { ...prev, [paramName]: status };
                }
                return prev;
            });
        }
        
        if (status === 'critical') createAlert('critical', `obd_${paramName}`, param.alertMessage, { parameter: paramName, value, unit: param.unit });
        else if (status === 'warning') createAlert('warning', `obd_${paramName}`, param.alertMessage, { parameter: paramName, value, unit: param.unit });
    }

    // Check all telemetry points for alerts in the period
    function analyzeAlertsInPeriod(telemetryData) {
        const alerts = {};
        
        telemetryData.forEach(point => {
            Object.keys(OBD_PARAMS).forEach(paramName => {
                const value = point[paramName];
                if (value === undefined) return;
                
                const param = OBD_PARAMS[paramName];
                if (!param?.thresholds) return;
                
                const status = getValueStatus(value, param);
                
                // Track worst status: critical > warning > normal
                if (status === 'critical') {
                    alerts[paramName] = 'critical';
                } else if (status === 'warning') {
                    if (alerts[paramName] !== 'critical') {
                        alerts[paramName] = 'warning';
                    }
                }
                // Don't set normal - we only care if there were any warnings/criticals
            });
        });
        
        // Set normal for params that had no warnings/criticals
        availableParams.forEach(paramName => {
            if (!alerts[paramName]) {
                alerts[paramName] = 'normal';
            }
        });
        
        setParamAlerts(alerts);
    }

    async function loadTelemetry() {
        if (!selectedVehicle?.imei) return;
        setLoading(true);
        try {
            const limits = { "24h": 2880, "7d": 10000, "30d": 20000 };
            const res = await fetch(`${API_BASE_URL}/api/telemetry/${selectedVehicle.imei}?limit=${limits[timeRange] || 120}`,
                { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();
            const processed = data.map(point => {
                let io = point.io_elements;
                if (typeof io === "string") try { io = JSON.parse(io); } catch { io = {}; }
                return { timestamp: new Date(point.received_at || point.timestamp), speed: point.speed, ...extractOBD(io) };
            }).reverse();
            setTelemetry(processed);
            
            // Analyze all points for alerts in this period
            analyzeAlertsInPeriod(processed);
            
            if (processed.length > 0) {
                const latest = processed[processed.length - 1];
                Object.keys(OBD_PARAMS).forEach(p => { if (latest[p] !== undefined) checkThresholds(p, latest[p]); });
            }
            const params = new Set();
            processed.forEach(p => Object.keys(OBD_PARAMS).forEach(k => { if (p[k] !== undefined) params.add(k); }));
            const paramList = Array.from(params);
            setAvailableParams(paramList);
            if (!selectedParam && paramList.length > 0) setSelectedParam(paramList[0]);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function extractOBD(io) {
        if (!io) return {};
        const map = { 36: "rpm", 32: "coolant_temp", 37: "speed_kmh", 31: "engine_load", 39: "intake_air_temp", 40: "maf", 41: "throttle", 48: "fuel_level", 51: "battery_voltage", 60: "fuel_rate" };
        const conv = { maf: v => v * 0.01, battery_voltage: v => v * 0.001, fuel_rate: v => v * 0.01 };
        const data = {};
        Object.entries(map).forEach(([id, name]) => {
            const val = io[id] || io[parseInt(id)];
            if (val !== undefined) data[name] = conv[name] ? conv[name](val) : val;
        });
        return data;
    }

    function getStats(paramName) {
        const values = telemetry.map(p => p[paramName]).filter(v => v !== undefined);
        if (!values.length) return null;
        const current = values[values.length - 1];
        return { current, min: Math.min(...values), max: Math.max(...values), avg: values.reduce((a, b) => a + b, 0) / values.length, status: getValueStatus(current, OBD_PARAMS[paramName]) };
    }

    const selConfig = selectedParam ? OBD_PARAMS[selectedParam] : null;
    const selStats = selectedParam ? getStats(selectedParam) : null;

    return (
        <DashboardLayout>
            <div className="obd-dashboard-page">
                {/* Header */}
                <div className="obd-header">
                    <div className="obd-title-section">
                        <h1 className="obd-title">🔧 OBD-II Diagnostika</h1>
                        <p className="obd-subtitle">Realaus laiko variklio parametrai</p>
                    </div>
                    
                    <select
                        className="obd-vehicle-select"
                        value={selectedVehicle?.id || ''}
                        onChange={e => { 
                            setSelectedVehicle(vehicles.find(v => v.id === parseInt(e.target.value))); 
                            setSelectedParam(null); 
                            setAvailableParams([]); 
                            setCreatedAlerts(new Set()); 
                        }}
                        disabled={loadingVehicles}
                    >
                        {loadingVehicles ? <option>Kraunama...</option> : vehicles.length === 0 ? <option>Nėra automobilių</option> :
                            vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} {v.plate ? `(${v.plate})` : ''}</option>)}
                    </select>
                    
                    <div className="obd-time-selector">
                        {[
                            { key: "24h", label: "Diena" },
                            { key: "7d", label: "Savaitė" },
                            { key: "30d", label: "Mėnuo" }
                        ].map(t => (
                            <button 
                                key={t.key} 
                                onClick={() => setTimeRange(t.key)} 
                                className={`time-btn ${timeRange === t.key ? 'active' : ''}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="obd-loading">
                        <div className="spinner" />
                        <p>Kraunami duomenys...</p>
                    </div>
                ) : availableParams.length === 0 ? (
                    <div className="obd-empty">
                        <div className="empty-icon">🔌</div>
                        <h3>Nėra OBD-II duomenų</h3>
                        <p>Patikrinkite, ar FMB įrenginys prijungtas prie OBD-II lizdo.</p>
                    </div>
                ) : (
                    <div className="obd-main-grid">
                        {/* Left - Cards Grid */}
                        <div className="obd-cards-grid">
                            {availableParams.map(paramName => {
                                const param = OBD_PARAMS[paramName];
                                const stats = getStats(paramName);
                                if (!param || !stats) return null;
                                const isSelected = selectedParam === paramName;
                                const periodAlert = paramAlerts[paramName] || 'normal';
                                const alertColor = periodAlert === 'critical' ? '#ef4444' : periodAlert === 'warning' ? '#f59e0b' : '#22c55e';
                                
                                return (
                                    <div
                                        key={paramName}
                                        onClick={() => setSelectedParam(paramName)}
                                        className={`obd-card ${isSelected ? 'selected' : ''} alert-${periodAlert}`}
                                    >
                                        {periodAlert !== 'normal' && (
                                            <div 
                                                className={`obd-card-status-dot ${periodAlert === 'critical' ? 'pulse' : ''}`}
                                                style={{ background: alertColor }}
                                            />
                                        )}
                                        <div className="obd-card-icon">{param.icon}</div>
                                        <div className="obd-card-label">{param.label}</div>
                                        <div className="obd-card-value" style={{ color: param.color }}>
                                            {stats.avg.toFixed(paramName === 'battery_voltage' ? 1 : 0)}
                                            <span className="obd-card-unit">{param.unit}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right - Chart */}
                        <div className="obd-chart-panel">
                            {selConfig && selStats ? (
                                <>
                                    <div className="obd-chart-header">
                                        <div className="obd-chart-title-row">
                                            <span className="obd-chart-icon">{selConfig.icon}</span>
                                            <span className="obd-chart-title">{selConfig.label}</span>
                                            <span className={`obd-status-badge status-${selStats.status}`}>
                                                {selStats.status === 'normal' ? '✓ OK' : selStats.status === 'warning' ? '⚠ Įspėjimas' : '🚨 Kritinis'}
                                            </span>
                                        </div>
                                        <div className="obd-chart-stats">
                                            <div className="obd-stat">
                                                <div className="obd-stat-label">Dabartinis</div>
                                                <div className="obd-stat-value" style={{ color: statusColors[selStats.status] }}>{selStats.current.toFixed(1)}</div>
                                            </div>
                                            <div className="obd-stat">
                                                <div className="obd-stat-label">Min</div>
                                                <div className="obd-stat-value">{selStats.min.toFixed(1)}</div>
                                            </div>
                                            <div className="obd-stat">
                                                <div className="obd-stat-label">Vid</div>
                                                <div className="obd-stat-value">{selStats.avg.toFixed(1)}</div>
                                            </div>
                                            <div className="obd-stat">
                                                <div className="obd-stat-label">Max</div>
                                                <div className="obd-stat-value">{selStats.max.toFixed(1)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="obd-chart-container">
                                        <OBDChart data={telemetry} paramName={selectedParam} paramConfig={selConfig} />
                                    </div>

                                    <div className="obd-chart-legend">
                                        <span className="legend-item"><span className="legend-dot normal" />Normalus</span>
                                        <span className="legend-item"><span className="legend-dot warning" />Įspėjimas</span>
                                        <span className="legend-item"><span className="legend-dot critical" />Kritinis</span>
                                    </div>
                                </>
                            ) : (
                                <div className="obd-chart-empty">Pasirinkite parametrą</div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                {telemetry.length > 0 && (
                    <div className="obd-footer">
                        <span>Atnaujinta: {telemetry[telemetry.length - 1]?.timestamp.toLocaleString('lt-LT')}</span>
                        <span>{telemetry.length} taškų</span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

function OBDChart({ data, paramName, paramConfig }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !data.length) return;

        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);

        const pad = { top: 20, right: 20, bottom: 35, left: 50 };
        const cw = width - pad.left - pad.right;
        const ch = height - pad.top - pad.bottom;

        ctx.fillStyle = "rgba(10,1,24,0.15)";
        ctx.fillRect(0, 0, width, height);

        const values = data.map((p, i) => ({ value: p[paramName], timestamp: p.timestamp, i })).filter(p => p.value !== undefined);
        if (values.length < 2) {
            ctx.fillStyle = "rgba(184,180,212,0.5)";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Nepakanka duomenų", width / 2, height / 2);
            return;
        }

        const minVal = paramConfig.min, maxVal = paramConfig.max, range = maxVal - minVal || 1;

        // Threshold zones
        if (paramConfig.thresholds && !paramConfig.inverted) {
            const { thresholds } = paramConfig;
            const normalY = pad.top + ch - ((thresholds.normal.max - minVal) / range) * ch;
            ctx.fillStyle = "rgba(34,197,94,0.06)";
            ctx.fillRect(pad.left, normalY, cw, pad.top + ch - normalY);

            if (thresholds.warning) {
                const warnY = pad.top + ch - ((thresholds.warning.max - minVal) / range) * ch;
                ctx.fillStyle = "rgba(245,158,11,0.1)";
                ctx.fillRect(pad.left, warnY, cw, normalY - warnY);
                ctx.strokeStyle = "rgba(245,158,11,0.4)";
                ctx.lineWidth = 1;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(pad.left, normalY);
                ctx.lineTo(width - pad.right, normalY);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            if (thresholds.critical) {
                const critY = thresholds.warning ? pad.top + ch - ((thresholds.warning.max - minVal) / range) * ch : normalY;
                ctx.fillStyle = "rgba(239,68,68,0.1)";
                ctx.fillRect(pad.left, pad.top, cw, critY - pad.top);
                ctx.strokeStyle = "rgba(239,68,68,0.5)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(pad.left, critY);
                ctx.lineTo(width - pad.right, critY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }

        // Grid
        ctx.strokeStyle = "rgba(102,126,234,0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = pad.top + (ch / 5) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(width - pad.right, y);
            ctx.stroke();
            ctx.fillStyle = "rgba(184,180,212,0.6)";
            ctx.font = "11px monospace";
            ctx.textAlign = "right";
            ctx.fillText((maxVal - (range / 5) * i).toFixed(0), pad.left - 8, y + 4);
        }

        // Line
        ctx.beginPath();
        ctx.strokeStyle = paramConfig.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        values.forEach((p, i) => {
            const x = pad.left + (i / (values.length - 1)) * cw;
            const y = pad.top + ch - ((p.value - minVal) / range) * ch;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Fill
        const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
        grad.addColorStop(0, paramConfig.color + "25");
        grad.addColorStop(1, paramConfig.color + "00");
        ctx.lineTo(pad.left + cw, pad.top + ch);
        ctx.lineTo(pad.left, pad.top + ch);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Warning/critical dots
        values.forEach((p, i) => {
            const status = getValueStatus(p.value, paramConfig);
            if (status === 'warning' || status === 'critical') {
                const x = pad.left + (i / (values.length - 1)) * cw;
                const y = pad.top + ch - ((p.value - minVal) / range) * ch;
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = status === 'critical' ? '#ef4444' : '#f59e0b';
                ctx.fill();
            }
        });

        // Current dot
        const last = values[values.length - 1];
        const lx = pad.left + cw, ly = pad.top + ch - ((last.value - minVal) / range) * ch;
        ctx.beginPath();
        ctx.arc(lx, ly, 7, 0, Math.PI * 2);
        ctx.fillStyle = paramConfig.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lx, ly, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();

        // Time labels
        ctx.fillStyle = "rgba(184,180,212,0.6)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        const first = values[0].timestamp, lastT = values[values.length - 1].timestamp;
        ctx.fillText(first.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), pad.left, height - 10);
        ctx.fillText(lastT.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), width - pad.right, height - 10);
        if (values.length > 2) {
            const mid = values[Math.floor(values.length / 2)].timestamp;
            ctx.fillText(mid.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), pad.left + cw / 2, height - 10);
        }
    }, [data, paramName, paramConfig]);

    return (
        <div ref={containerRef} className="obd-chart-canvas-container">
            <canvas ref={canvasRef} />
        </div>
    );
}

export default OBDPage;
