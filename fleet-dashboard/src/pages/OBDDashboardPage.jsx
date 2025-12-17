// =============================================
// OBD PAGE - Redesigned: Cards Left, Chart Right
// Fleet Tracking Dashboard
// =============================================

import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";

// OBD-II Parameter definitions with thresholds
const OBD_PARAMS = {
    rpm: { 
        label: "Variklio RPM", 
        unit: "rpm", 
        icon: "🔄", 
        color: "#667eea", 
        min: 0, 
        max: 8000,
        thresholds: { normal: { max: 4000 }, warning: { max: 5500 }, critical: { max: 8000 } },
        alertMessage: "Variklio apsukos per didelės"
    },
    coolant_temp: { 
        label: "Aušinimo skystis", 
        unit: "°C", 
        icon: "🌡️", 
        color: "#f59e0b", 
        min: -40, 
        max: 130,
        thresholds: { normal: { max: 95 }, warning: { max: 105 }, critical: { max: 130 } },
        alertMessage: "Variklio temperatūra per aukšta"
    },
    speed_kmh: { 
        label: "Greitis", 
        unit: "km/h", 
        icon: "🚗", 
        color: "#3b82f6", 
        min: 0, 
        max: 200,
        thresholds: { normal: { max: 90 }, warning: { max: 130 }, critical: { max: 200 } },
        alertMessage: "Viršytas greičio limitas"
    },
    engine_load: { 
        label: "Variklio apkrova", 
        unit: "%", 
        icon: "⚡", 
        color: "#8b5cf6", 
        min: 0, 
        max: 100,
        thresholds: { normal: { max: 70 }, warning: { max: 85 }, critical: { max: 100 } },
        alertMessage: "Variklio apkrova per didelė"
    },
    intake_air_temp: { 
        label: "Įsiurb. oro temp.", 
        unit: "°C", 
        icon: "🌬️", 
        color: "#06b6d4", 
        min: -40, 
        max: 80,
        thresholds: { normal: { max: 45 }, warning: { max: 60 }, critical: { max: 80 } },
        alertMessage: "Įsiurbimo oro temperatūra per aukšta"
    },
    maf: { 
        label: "MAF", 
        unit: "g/s", 
        icon: "💨", 
        color: "#10b981", 
        min: 0, 
        max: 500,
        thresholds: { normal: { max: 250 }, warning: { max: 400 }, critical: { max: 500 } },
        alertMessage: "MAF reikšmė nenormali"
    },
    throttle: { 
        label: "Akceleratoriaus padėtis", 
        unit: "%", 
        icon: "🎚️", 
        color: "#f43f5e", 
        min: 0, 
        max: 100,
        thresholds: null,
        alertMessage: null
    },
    fuel_level: { 
        label: "Kuro lygis", 
        unit: "%", 
        icon: "⛽", 
        color: "#eab308", 
        min: 0, 
        max: 100,
        thresholds: { normal: { min: 25 }, warning: { min: 10 }, critical: { min: 0 } },
        alertMessage: "Žemas kuro lygis",
        inverted: true
    },
    battery_voltage: { 
        label: "Akumuliatorius", 
        unit: "V", 
        icon: "🔋", 
        color: "#22c55e", 
        min: 10, 
        max: 16,
        thresholds: { normal: { min: 13.5 }, warning: { min: 12.0 }, critical: { min: 10 } },
        alertMessage: "Akumuliatoriaus įtampa per žema",
        inverted: true
    },
    fuel_rate: { 
        label: "Kuro sąnaudos", 
        unit: "L/100km", 
        icon: "📊", 
        color: "#ec4899", 
        min: 0, 
        max: 30,
        thresholds: { normal: { max: 12 }, warning: { max: 18 }, critical: { max: 30 } },
        alertMessage: "Kuro sąnaudos per didelės"
    },
};

function getValueStatus(value, paramConfig) {
    if (!paramConfig.thresholds) return 'normal';
    const { thresholds, inverted } = paramConfig;
    
    if (inverted) {
        if (value < thresholds.critical.min) return 'critical';
        if (value < thresholds.warning.min) return 'warning';
        if (value < thresholds.normal.min) return 'low';
        return 'normal';
    } else {
        if (value >= thresholds.warning.max) return thresholds.critical && value >= thresholds.critical.max ? 'critical' : 'warning';
        if (thresholds.critical && value >= thresholds.critical.max) return 'critical';
        return 'normal';
    }
}

const statusColors = {
    normal: '#22c55e',
    warning: '#f59e0b', 
    critical: '#ef4444',
    low: '#3b82f6'
};

function OBDPage() {
    const { token } = useAuth();
    const { showToast } = useToast();

    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [telemetry, setTelemetry] = useState([]);
    const [loading, setLoading] = useState(false);
    const [timeRange, setTimeRange] = useState("1h");
    const [availableParams, setAvailableParams] = useState([]);
    const [selectedParam, setSelectedParam] = useState(null);
    const [createdAlerts, setCreatedAlerts] = useState(new Set());

    // Load vehicles
    useEffect(() => {
        if (!token) return;
        fetch(`${API_BASE_URL}/api/vehicles`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data) ? data : [];
                setVehicles(list);
                if (list.length > 0) setSelectedVehicle(list[0]);
            })
            .catch(err => console.error(err))
            .finally(() => setLoadingVehicles(false));
    }, [token]);

    // Load telemetry
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
                    vehicle_id: selectedVehicle.id,
                    alert_type: type,
                    severity,
                    title: message,
                    message: `${message} - ${selectedVehicle.brand} ${selectedVehicle.model}`,
                    metadata: { ...metadata, vehicle_name: `${selectedVehicle.brand} ${selectedVehicle.model}`, source: 'obd' }
                })
            });
            if (res.ok) {
                setCreatedAlerts(prev => new Set([...prev, alertKey]));
                showToast(`⚠️ ${message}`, severity === 'critical' ? 'error' : 'warning');
            }
        } catch (err) { console.error('Alert error:', err); }
    }

    function checkThresholdsAndAlert(paramName, value) {
        const param = OBD_PARAMS[paramName];
        if (!param?.alertMessage || !param.thresholds) return;
        const status = getValueStatus(value, param);
        if (status === 'critical') createAlert('critical', `obd_${paramName}`, param.alertMessage, { parameter: paramName, value, unit: param.unit });
        else if (status === 'warning') createAlert('warning', `obd_${paramName}`, param.alertMessage, { parameter: paramName, value, unit: param.unit });
    }

    async function loadTelemetry() {
        if (!selectedVehicle?.imei) return;
        setLoading(true);
        try {
            const limits = { "1h": 120, "6h": 720, "24h": 2880, "7d": 10000 };
            const res = await fetch(`${API_BASE_URL}/api/telemetry/${selectedVehicle.imei}?limit=${limits[timeRange] || 120}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed");
            const data = await res.json();

            const processed = data.map(point => {
                let io = point.io_elements;
                if (typeof io === "string") try { io = JSON.parse(io); } catch { io = {}; }
                return { timestamp: new Date(point.received_at || point.timestamp), speed: point.speed, ...extractOBDData(io) };
            }).reverse();

            setTelemetry(processed);

            if (processed.length > 0) {
                const latest = processed[processed.length - 1];
                Object.keys(OBD_PARAMS).forEach(p => {
                    if (latest[p] !== undefined) checkThresholdsAndAlert(p, latest[p]);
                });
            }

            const params = new Set();
            processed.forEach(p => Object.keys(OBD_PARAMS).forEach(k => { if (p[k] !== undefined) params.add(k); }));
            setAvailableParams(Array.from(params));
            if (!selectedParam && params.size > 0) setSelectedParam(Array.from(params)[0]);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    }

    function extractOBDData(io) {
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

    function getParamStats(paramName) {
        const values = telemetry.map(p => p[paramName]).filter(v => v !== undefined);
        if (!values.length) return null;
        const current = values[values.length - 1];
        return {
            current,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            status: getValueStatus(current, OBD_PARAMS[paramName])
        };
    }

    const selectedParamConfig = selectedParam ? OBD_PARAMS[selectedParam] : null;
    const selectedStats = selectedParam ? getParamStats(selectedParam) : null;

    // Styles
    const styles = {
        page: {
            padding: '24px',
            maxWidth: '1600px',
            margin: '0 auto'
        },
        header: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px'
        },
        title: {
            fontSize: '24px',
            fontWeight: '700',
            color: 'var(--text-main)',
            margin: 0
        },
        subtitle: {
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginTop: '4px'
        },
        controls: {
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap'
        },
        select: {
            padding: '10px 14px',
            background: 'rgba(26, 15, 46, 0.6)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            color: 'var(--text-main)',
            fontSize: '14px',
            minWidth: '200px'
        },
        timeButtons: {
            display: 'flex',
            background: 'rgba(26, 15, 46, 0.4)',
            borderRadius: '8px',
            padding: '4px'
        },
        timeBtn: (active) => ({
            padding: '8px 16px',
            border: 'none',
            background: active ? 'var(--accent)' : 'transparent',
            color: active ? 'white' : 'var(--text-muted)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            transition: 'all 0.2s'
        }),
        mainGrid: {
            display: 'grid',
            gridTemplateColumns: '320px 1fr',
            gap: '24px',
            minHeight: '500px'
        },
        paramsPanel: {
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxHeight: '600px',
            overflowY: 'auto',
            paddingRight: '8px'
        },
        paramCard: (isSelected, status) => ({
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 16px',
            background: isSelected ? 'rgba(102, 126, 234, 0.15)' : 'rgba(26, 15, 46, 0.5)',
            border: `2px solid ${isSelected ? 'var(--accent)' : status !== 'normal' ? statusColors[status] : 'var(--border-color)'}`,
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            position: 'relative'
        }),
        paramIcon: {
            fontSize: '24px',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(102, 126, 234, 0.1)',
            borderRadius: '10px'
        },
        paramInfo: {
            flex: 1,
            minWidth: 0
        },
        paramLabel: {
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginBottom: '2px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
        },
        paramValue: (color) => ({
            fontSize: '20px',
            fontWeight: '700',
            color: color,
            display: 'flex',
            alignItems: 'baseline',
            gap: '4px'
        }),
        paramUnit: {
            fontSize: '12px',
            fontWeight: '400',
            color: 'var(--text-muted)'
        },
        statusDot: (color) => ({
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: color,
            flexShrink: 0
        }),
        chartPanel: {
            background: 'rgba(26, 15, 46, 0.5)',
            border: '1px solid var(--border-color)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column'
        },
        chartHeader: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px'
        },
        chartTitle: {
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
        },
        chartStats: {
            display: 'flex',
            gap: '24px'
        },
        statItem: {
            textAlign: 'center'
        },
        statLabel: {
            fontSize: '11px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: '2px'
        },
        statValue: (color) => ({
            fontSize: '16px',
            fontWeight: '600',
            color: color || 'var(--text-main)'
        }),
        chartContainer: {
            flex: 1,
            minHeight: '400px',
            position: 'relative'
        },
        legend: {
            display: 'flex',
            gap: '20px',
            marginTop: '16px',
            justifyContent: 'center',
            flexWrap: 'wrap'
        },
        legendItem: {
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            color: 'var(--text-muted)'
        },
        legendDot: (color) => ({
            width: '12px',
            height: '12px',
            borderRadius: '3px',
            background: color
        }),
        emptyState: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            textAlign: 'center',
            padding: '40px'
        },
        emptyIcon: {
            fontSize: '64px',
            marginBottom: '16px',
            opacity: 0.5
        }
    };

    return (
        <DashboardLayout>
            <div style={styles.page}>
                {/* Header */}
                <div style={styles.header}>
                    <div>
                        <h1 style={styles.title}>🔧 OBD-II Diagnostika</h1>
                        <p style={styles.subtitle}>Realaus laiko variklio parametrai</p>
                    </div>
                    <div style={styles.controls}>
                        <select
                            style={styles.select}
                            value={selectedVehicle?.id || ''}
                            onChange={(e) => {
                                const v = vehicles.find(v => v.id === parseInt(e.target.value));
                                setSelectedVehicle(v);
                                setSelectedParam(null);
                                setAvailableParams([]);
                                setCreatedAlerts(new Set());
                            }}
                            disabled={loadingVehicles}
                        >
                            {loadingVehicles ? <option>Kraunama...</option> :
                             vehicles.length === 0 ? <option>Nėra automobilių</option> :
                             vehicles.map(v => (
                                <option key={v.id} value={v.id}>
                                    {v.brand} {v.model} {v.plate ? `(${v.plate})` : ''}
                                </option>
                             ))}
                        </select>
                        <div style={styles.timeButtons}>
                            {["1h", "6h", "24h", "7d"].map(t => (
                                <button key={t} style={styles.timeBtn(timeRange === t)} onClick={() => setTimeRange(t)}>
                                    {t}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                {loading ? (
                    <div style={styles.emptyState}>
                        <div className="spinner" style={{ width: '48px', height: '48px' }}></div>
                        <p style={{ marginTop: '16px' }}>Kraunami OBD duomenys...</p>
                    </div>
                ) : availableParams.length === 0 ? (
                    <div style={styles.emptyState}>
                        <div style={styles.emptyIcon}>🔌</div>
                        <h3 style={{ margin: '0 0 8px', color: 'var(--text-main)' }}>Nėra OBD-II duomenų</h3>
                        <p>Šis automobilis dar neperdavė diagnostikos duomenų.</p>
                        <p style={{ fontSize: '13px', marginTop: '8px' }}>Patikrinkite, ar FMB įrenginys prijungtas prie OBD-II lizdo.</p>
                    </div>
                ) : (
                    <div style={styles.mainGrid}>
                        {/* Left Panel - Parameters */}
                        <div style={styles.paramsPanel}>
                            {availableParams.map(paramName => {
                                const param = OBD_PARAMS[paramName];
                                const stats = getParamStats(paramName);
                                if (!param || !stats) return null;
                                const isSelected = selectedParam === paramName;
                                const color = statusColors[stats.status] || param.color;

                                return (
                                    <div
                                        key={paramName}
                                        style={styles.paramCard(isSelected, stats.status)}
                                        onClick={() => setSelectedParam(paramName)}
                                    >
                                        <div style={styles.paramIcon}>{param.icon}</div>
                                        <div style={styles.paramInfo}>
                                            <div style={styles.paramLabel}>{param.label}</div>
                                            <div style={styles.paramValue(color)}>
                                                {stats.current.toFixed(paramName === 'battery_voltage' ? 2 : 1)}
                                                <span style={styles.paramUnit}>{param.unit}</span>
                                            </div>
                                        </div>
                                        <div style={styles.statusDot(color)} />
                                    </div>
                                );
                            })}
                        </div>

                        {/* Right Panel - Chart */}
                        <div style={styles.chartPanel}>
                            {selectedParamConfig && selectedStats ? (
                                <>
                                    <div style={styles.chartHeader}>
                                        <div style={styles.chartTitle}>
                                            <span>{selectedParamConfig.icon}</span>
                                            <span>{selectedParamConfig.label}</span>
                                            <span style={{
                                                fontSize: '12px',
                                                padding: '4px 10px',
                                                borderRadius: '12px',
                                                background: statusColors[selectedStats.status] + '20',
                                                color: statusColors[selectedStats.status],
                                                fontWeight: '600'
                                            }}>
                                                {selectedStats.status === 'normal' ? '✓ Normalus' :
                                                 selectedStats.status === 'warning' ? '⚠ Įspėjimas' :
                                                 selectedStats.status === 'critical' ? '🚨 Kritinis' : '↓ Žemas'}
                                            </span>
                                        </div>
                                        <div style={styles.chartStats}>
                                            <div style={styles.statItem}>
                                                <div style={styles.statLabel}>Dabartinis</div>
                                                <div style={styles.statValue(statusColors[selectedStats.status])}>
                                                    {selectedStats.current.toFixed(1)} {selectedParamConfig.unit}
                                                </div>
                                            </div>
                                            <div style={styles.statItem}>
                                                <div style={styles.statLabel}>Min</div>
                                                <div style={styles.statValue()}>{selectedStats.min.toFixed(1)}</div>
                                            </div>
                                            <div style={styles.statItem}>
                                                <div style={styles.statLabel}>Vid</div>
                                                <div style={styles.statValue()}>{selectedStats.avg.toFixed(1)}</div>
                                            </div>
                                            <div style={styles.statItem}>
                                                <div style={styles.statLabel}>Max</div>
                                                <div style={styles.statValue()}>{selectedStats.max.toFixed(1)}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={styles.chartContainer}>
                                        <OBDChart
                                            data={telemetry}
                                            paramName={selectedParam}
                                            paramConfig={selectedParamConfig}
                                        />
                                    </div>
                                    <div style={styles.legend}>
                                        <div style={styles.legendItem}>
                                            <div style={styles.legendDot('#22c55e')} />
                                            <span>Normalus</span>
                                        </div>
                                        <div style={styles.legendItem}>
                                            <div style={styles.legendDot('#f59e0b')} />
                                            <span>Įspėjimas</span>
                                        </div>
                                        <div style={styles.legendItem}>
                                            <div style={styles.legendDot('#ef4444')} />
                                            <span>Kritinis</span>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div style={styles.emptyState}>
                                    <div style={styles.emptyIcon}>📊</div>
                                    <p>Pasirinkite parametrą kairėje</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Footer */}
                {telemetry.length > 0 && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '20px',
                        padding: '12px 16px',
                        background: 'rgba(26, 15, 46, 0.3)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--text-muted)'
                    }}>
                        <span>Paskutinis atnaujinimas: {telemetry[telemetry.length - 1]?.timestamp.toLocaleString('lt-LT')}</span>
                        <span>{telemetry.length} duomenų taškų</span>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// Big Chart Component with threshold zones
function OBDChart({ data, paramName, paramConfig }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!canvasRef.current || !data.length) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const height = rect.height;
        const padding = { top: 30, right: 30, bottom: 50, left: 70 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        // Clear
        ctx.fillStyle = "rgba(10, 1, 24, 0.2)";
        ctx.fillRect(0, 0, width, height);

        const values = data
            .map((p, i) => ({ value: p[paramName], timestamp: p.timestamp, index: i }))
            .filter(p => p.value !== undefined && p.value !== null);

        if (values.length < 2) {
            ctx.fillStyle = "rgba(184, 180, 212, 0.5)";
            ctx.font = "16px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Nepakanka duomenų", width / 2, height / 2);
            return;
        }

        const minVal = paramConfig.min;
        const maxVal = paramConfig.max;
        const range = maxVal - minVal || 1;

        // Draw threshold zones
        if (paramConfig.thresholds) {
            const { thresholds, inverted } = paramConfig;
            
            if (!inverted) {
                // Normal zone (green) - from min to warning threshold
                const normalY = padding.top + chartHeight - ((thresholds.normal.max - minVal) / range) * chartHeight;
                ctx.fillStyle = "rgba(34, 197, 94, 0.08)";
                ctx.fillRect(padding.left, normalY, chartWidth, padding.top + chartHeight - normalY);
                
                // Warning zone (yellow)
                if (thresholds.warning) {
                    const warningY = padding.top + chartHeight - ((thresholds.warning.max - minVal) / range) * chartHeight;
                    ctx.fillStyle = "rgba(245, 158, 11, 0.12)";
                    ctx.fillRect(padding.left, warningY, chartWidth, normalY - warningY);
                    
                    // Warning line
                    ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
                    ctx.lineWidth = 1;
                    ctx.setLineDash([8, 4]);
                    ctx.beginPath();
                    ctx.moveTo(padding.left, normalY);
                    ctx.lineTo(width - padding.right, normalY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                
                // Critical zone (red)
                if (thresholds.critical) {
                    const criticalY = padding.top + chartHeight - ((thresholds.critical.max - minVal) / range) * chartHeight;
                    const warningY = thresholds.warning ? 
                        padding.top + chartHeight - ((thresholds.warning.max - minVal) / range) * chartHeight : normalY;
                    ctx.fillStyle = "rgba(239, 68, 68, 0.12)";
                    ctx.fillRect(padding.left, padding.top, chartWidth, warningY - padding.top);
                    
                    // Critical line
                    ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
                    ctx.lineWidth = 2;
                    ctx.setLineDash([8, 4]);
                    ctx.beginPath();
                    ctx.moveTo(padding.left, warningY);
                    ctx.lineTo(width - padding.right, warningY);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    
                    // Label
                    ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
                    ctx.font = "bold 11px sans-serif";
                    ctx.textAlign = "right";
                    ctx.fillText("KRITINIS", width - padding.right - 8, warningY - 6);
                }
            }
        }

        // Grid lines
        ctx.strokeStyle = "rgba(102, 126, 234, 0.1)";
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const y = padding.top + (chartHeight / 5) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            const val = maxVal - (range / 5) * i;
            ctx.fillStyle = "rgba(184, 180, 212, 0.7)";
            ctx.font = "12px monospace";
            ctx.textAlign = "right";
            ctx.fillText(val.toFixed(0), padding.left - 12, y + 4);
        }

        // Draw line
        ctx.beginPath();
        ctx.strokeStyle = paramConfig.color;
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        values.forEach((point, i) => {
            const x = padding.left + (i / (values.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((point.value - minVal) / range) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Gradient fill
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, paramConfig.color + "30");
        gradient.addColorStop(1, paramConfig.color + "00");
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Highlight warning/critical points
        values.forEach((point, i) => {
            const status = getValueStatus(point.value, paramConfig);
            if (status === 'warning' || status === 'critical') {
                const x = padding.left + (i / (values.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((point.value - minVal) / range) * chartHeight;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = status === 'critical' ? '#ef4444' : '#f59e0b';
                ctx.fill();
            }
        });

        // Current value dot
        const lastPoint = values[values.length - 1];
        const lastX = padding.left + chartWidth;
        const lastY = padding.top + chartHeight - ((lastPoint.value - minVal) / range) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(lastX, lastY, 8, 0, Math.PI * 2);
        ctx.fillStyle = paramConfig.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();

        // Time labels
        ctx.fillStyle = "rgba(184, 180, 212, 0.7)";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";

        if (values.length > 0) {
            const first = values[0].timestamp;
            const last = values[values.length - 1].timestamp;
            const mid = values[Math.floor(values.length / 2)]?.timestamp;

            ctx.fillText(first.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), padding.left, height - 15);
            if (mid) ctx.fillText(mid.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), padding.left + chartWidth / 2, height - 15);
            ctx.fillText(last.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), width - padding.right, height - 15);
        }

        // Y-axis label
        ctx.save();
        ctx.translate(20, padding.top + chartHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = "rgba(184, 180, 212, 0.6)";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(paramConfig.unit, 0, 0);
        ctx.restore();

    }, [data, paramName, paramConfig]);

    return (
        <canvas 
            ref={canvasRef} 
            style={{ width: '100%', height: '100%', display: 'block', borderRadius: '8px' }}
        />
    );
}

export default OBDPage;
