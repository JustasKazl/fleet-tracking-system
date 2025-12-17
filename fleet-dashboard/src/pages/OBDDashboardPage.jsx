import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import '../styles/obd-dashboard.css';

// OBD-II Parameter definitions with thresholds
const OBD_PARAMS = {
    rpm: { 
        label: "Variklio RPM", 
        unit: "rpm", 
        icon: "🔄", 
        color: "#667eea", 
        min: 0, 
        max: 8000,
        thresholds: {
            normal: { min: 0, max: 4000 },
            warning: { min: 4000, max: 5500 },
            critical: { min: 5500, max: 8000 }
        },
        alertMessage: "Variklio apsukos per didelės"
    },
    coolant_temp: { 
        label: "Aušinimo skystis", 
        unit: "°C", 
        icon: "🌡️", 
        color: "#f59e0b", 
        min: -40, 
        max: 130,
        thresholds: {
            normal: { min: 70, max: 95 },
            warning: { min: 95, max: 105 },
            critical: { min: 105, max: 130 },
            low: { min: -40, max: 70 } // Cold engine
        },
        alertMessage: "Variklio temperatūra per aukšta"
    },
    speed_kmh: { 
        label: "Greitis", 
        unit: "km/h", 
        icon: "🚗", 
        color: "#3b82f6", 
        min: 0, 
        max: 200,
        thresholds: {
            normal: { min: 0, max: 90 },
            warning: { min: 90, max: 130 },
            critical: { min: 130, max: 200 }
        },
        alertMessage: "Viršytas greičio limitas"
    },
    engine_load: { 
        label: "Variklio apkrova", 
        unit: "%", 
        icon: "⚡", 
        color: "#8b5cf6", 
        min: 0, 
        max: 100,
        thresholds: {
            normal: { min: 0, max: 70 },
            warning: { min: 70, max: 85 },
            critical: { min: 85, max: 100 }
        },
        alertMessage: "Variklio apkrova per didelė"
    },
    intake_air_temp: { 
        label: "Įsiurbimo oro temp.", 
        unit: "°C", 
        icon: "🌬️", 
        color: "#06b6d4", 
        min: -40, 
        max: 80,
        thresholds: {
            normal: { min: -40, max: 45 },
            warning: { min: 45, max: 60 },
            critical: { min: 60, max: 80 }
        },
        alertMessage: "Įsiurbimo oro temperatūra per aukšta"
    },
    maf: { 
        label: "MAF", 
        unit: "g/s", 
        icon: "💨", 
        color: "#10b981", 
        min: 0, 
        max: 500,
        thresholds: {
            normal: { min: 2, max: 250 },
            warning: { min: 250, max: 400 },
            critical: { min: 400, max: 500 },
            low: { min: 0, max: 2 } // Possible sensor issue
        },
        alertMessage: "MAF reikšmė nenormali"
    },
    throttle: { 
        label: "Pedalo padėtis", 
        unit: "%", 
        icon: "🎚️", 
        color: "#f43f5e", 
        min: 0, 
        max: 100,
        thresholds: {
            normal: { min: 0, max: 100 },
            warning: null,
            critical: null
        },
        alertMessage: null // No alerts for throttle
    },
    fuel_level: { 
        label: "Kuro lygis", 
        unit: "%", 
        icon: "⛽", 
        color: "#eab308", 
        min: 0, 
        max: 100,
        thresholds: {
            normal: { min: 25, max: 100 },
            warning: { min: 10, max: 25 },
            critical: { min: 0, max: 10 }
        },
        alertMessage: "Žemas kuro lygis",
        invertedThresholds: true // Lower is worse
    },
    battery_voltage: { 
        label: "Akumuliatorius", 
        unit: "V", 
        icon: "🔋", 
        color: "#22c55e", 
        min: 10, 
        max: 16,
        thresholds: {
            normal: { min: 13.5, max: 14.5 },
            warning: { min: 12.0, max: 13.5 },
            critical: { min: 10, max: 12.0 },
            high: { min: 14.5, max: 16 } // Overcharging
        },
        alertMessage: "Akumuliatoriaus įtampa nenormali",
        invertedThresholds: true
    },
    fuel_rate: { 
        label: "Kuro sąnaudos", 
        unit: "l/100km", 
        icon: "📊", 
        color: "#ec4899", 
        min: 0, 
        max: 30,
        thresholds: {
            normal: { min: 0, max: 12 },
            warning: { min: 12, max: 18 },
            critical: { min: 18, max: 30 }
        },
        alertMessage: "Kuro sąnaudos per didelės"
    },
};

// Get status level for a value
function getValueStatus(value, paramConfig) {
    if (!paramConfig.thresholds) return 'normal';
    
    const { thresholds, invertedThresholds } = paramConfig;
    
    // Check critical first
    if (thresholds.critical && value >= thresholds.critical.min && value < thresholds.critical.max) {
        return invertedThresholds ? 'critical' : 'critical';
    }
    
    // Check warning
    if (thresholds.warning && value >= thresholds.warning.min && value < thresholds.warning.max) {
        return 'warning';
    }
    
    // Check low (if exists)
    if (thresholds.low && value >= thresholds.low.min && value < thresholds.low.max) {
        return 'low';
    }
    
    // Check high (if exists)
    if (thresholds.high && value >= thresholds.high.min && value <= thresholds.high.max) {
        return 'high';
    }
    
    return 'normal';
}

function OBDPage() {
    const navigate = useNavigate();
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
    
    // Track which alerts we've already created (to avoid duplicates)
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
                if (list.length > 0) {
                    setSelectedVehicle(list[0]);
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoadingVehicles(false));
    }, [token]);

    // Load telemetry when vehicle selected
    useEffect(() => {
        if (selectedVehicle?.imei && token) {
            loadTelemetry();
        }
    }, [selectedVehicle, token, timeRange]);

    // Create alert in database
    async function createAlert(severity, type, message, metadata = {}) {
        if (!selectedVehicle || !token) return;
        
        // Create unique key to prevent duplicate alerts
        const alertKey = `${selectedVehicle.id}-${type}-${Date.now().toString().slice(0, -4)}`; // ~10 second window
        
        if (createdAlerts.has(alertKey)) return;
        
        try {
            const res = await fetch(`${API_BASE_URL}/api/alerts`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    vehicle_id: selectedVehicle.id,
                    alert_type: type,
                    severity: severity,
                    title: message,
                    message: `${message} - ${selectedVehicle.brand} ${selectedVehicle.model} (${selectedVehicle.plate || 'Be numerių'})`,
                    metadata: {
                        ...metadata,
                        vehicle_name: `${selectedVehicle.brand} ${selectedVehicle.model}`,
                        vehicle_plate: selectedVehicle.plate,
                        source: 'obd_diagnostics'
                    }
                })
            });
            
            if (res.ok) {
                setCreatedAlerts(prev => new Set([...prev, alertKey]));
                showToast(`⚠️ Sukurtas įspėjimas: ${message}`, severity === 'critical' ? 'error' : 'warning');
            }
        } catch (err) {
            console.error('Error creating alert:', err);
        }
    }

    // Check values and create alerts if needed
    function checkThresholdsAndAlert(paramName, value, timestamp) {
        const param = OBD_PARAMS[paramName];
        if (!param || !param.alertMessage || !param.thresholds) return;
        
        const status = getValueStatus(value, param);
        
        if (status === 'critical') {
            createAlert('critical', `obd_${paramName}`, param.alertMessage, {
                parameter: paramName,
                value: value,
                unit: param.unit,
                threshold: param.thresholds.critical,
                timestamp: timestamp
            });
        } else if (status === 'warning') {
            createAlert('warning', `obd_${paramName}`, param.alertMessage, {
                parameter: paramName,
                value: value,
                unit: param.unit,
                threshold: param.thresholds.warning,
                timestamp: timestamp
            });
        }
    }

    async function loadTelemetry() {
        if (!selectedVehicle?.imei) return;

        setLoading(true);
        try {
            const limits = { "1h": 120, "6h": 720, "24h": 2880, "7d": 10000 };
            const limit = limits[timeRange] || 120;

            const res = await fetch(
                `${API_BASE_URL}/api/telemetry/${selectedVehicle.imei}?limit=${limit}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (!res.ok) throw new Error("Failed to fetch");

            const data = await res.json();

            const processed = data
                .map((point) => {
                    let ioElements = point.io_elements;
                    if (typeof ioElements === "string") {
                        try {
                            ioElements = JSON.parse(ioElements);
                        } catch {
                            ioElements = {};
                        }
                    }

                    return {
                        timestamp: new Date(point.received_at || point.timestamp),
                        speed: point.speed,
                        ...extractOBDData(ioElements),
                    };
                })
                .reverse();

            setTelemetry(processed);

            // Check latest values for alerts
            if (processed.length > 0) {
                const latest = processed[processed.length - 1];
                Object.keys(OBD_PARAMS).forEach(paramName => {
                    if (latest[paramName] !== undefined && latest[paramName] !== null) {
                        checkThresholdsAndAlert(paramName, latest[paramName], latest.timestamp);
                    }
                });
            }

            const params = new Set();
            processed.forEach((p) => {
                Object.keys(OBD_PARAMS).forEach((key) => {
                    if (p[key] !== undefined && p[key] !== null) {
                        params.add(key);
                    }
                });
            });
            setAvailableParams(Array.from(params));

            if (!selectedParam && params.size > 0) {
                setSelectedParam(Array.from(params)[0]);
            }

        } catch (err) {
            console.error("Error loading telemetry:", err);
        } finally {
            setLoading(false);
        }
    }

    function extractOBDData(ioElements) {
        if (!ioElements) return {};

        const data = {};
        const ioMap = {
            36: "rpm",
            32: "coolant_temp",
            37: "speed_kmh",
            31: "engine_load",
            39: "intake_air_temp",
            40: "maf",
            41: "throttle",
            48: "fuel_level",
            51: "battery_voltage",
            60: "fuel_rate",
        };

        const conversions = {
            maf: (v) => v * 0.01,
            battery_voltage: (v) => v * 0.001,
            fuel_rate: (v) => v * 0.01,
        };

        Object.entries(ioMap).forEach(([ioId, paramName]) => {
            const value = ioElements[ioId] || ioElements[parseInt(ioId)];
            if (value !== undefined && value !== null) {
                const convert = conversions[paramName];
                data[paramName] = convert ? convert(value) : value;
            }
        });

        return data;
    }

    function getParamStats(paramName) {
        const values = telemetry
            .map((p) => p[paramName])
            .filter((v) => v !== undefined && v !== null);

        if (values.length === 0) return null;

        const current = values[values.length - 1];
        const param = OBD_PARAMS[paramName];
        const status = getValueStatus(current, param);

        return {
            current,
            min: Math.min(...values),
            max: Math.max(...values),
            avg: values.reduce((a, b) => a + b, 0) / values.length,
            status
        };
    }

    // Status colors
    const statusColors = {
        normal: '#22c55e',
        warning: '#f59e0b',
        critical: '#ef4444',
        low: '#3b82f6',
        high: '#f59e0b'
    };

    return (
        <DashboardLayout>
            <div className="obd-dashboard-page">
                {/* Header */}
                <div className="obd-header">
                    <div className="obd-title-section">
                        <h1 className="obd-title">🔧 OBD-II Diagnostika</h1>
                        <p className="obd-subtitle">
                            Realaus laiko variklio diagnostika su įspėjimais
                        </p>
                    </div>
                </div>

                {/* Legend */}
                <div style={{
                    display: 'flex',
                    gap: '20px',
                    marginBottom: '16px',
                    padding: '12px 16px',
                    background: 'rgba(26, 15, 46, 0.3)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    flexWrap: 'wrap'
                }}>
                    <span style={{ color: 'var(--text-muted)' }}>Lygiai:</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '12px', height: '12px', background: '#22c55e', borderRadius: '3px' }}></span>
                        Normalus
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '12px', height: '12px', background: '#f59e0b', borderRadius: '3px' }}></span>
                        Įspėjimas
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '12px', height: '12px', background: '#ef4444', borderRadius: '3px' }}></span>
                        Kritinis
                    </span>
                </div>

                {/* Vehicle Selector */}
                <div style={{ 
                    display: 'flex', 
                    gap: '16px', 
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: '24px',
                    padding: '20px',
                    background: 'rgba(26, 15, 46, 0.5)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ flex: '1', minWidth: '200px' }}>
                        <label style={{ 
                            display: 'block', 
                            fontSize: '12px', 
                            color: 'var(--text-muted)',
                            marginBottom: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            Pasirinkite automobilį
                        </label>
                        <select
                            value={selectedVehicle?.id || ''}
                            onChange={(e) => {
                                const v = vehicles.find(v => v.id === parseInt(e.target.value));
                                setSelectedVehicle(v);
                                setSelectedParam(null);
                                setAvailableParams([]);
                                setCreatedAlerts(new Set()); // Reset alerts for new vehicle
                            }}
                            disabled={loadingVehicles}
                            style={{
                                width: '100%',
                                padding: '12px 16px',
                                background: 'rgba(10, 1, 24, 0.5)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '8px',
                                color: 'var(--text-main)',
                                fontSize: '14px'
                            }}
                        >
                            {loadingVehicles ? (
                                <option>Kraunama...</option>
                            ) : vehicles.length === 0 ? (
                                <option>Nėra automobilių</option>
                            ) : (
                                vehicles.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.brand} {v.model} {v.plate ? `(${v.plate})` : ''}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    <div className="obd-time-selector">
                        {["1h", "6h", "24h", "7d"].map((range) => (
                            <button
                                key={range}
                                className={`time-btn ${timeRange === range ? "active" : ""}`}
                                onClick={() => setTimeRange(range)}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                {!selectedVehicle ? (
                    <div className="obd-empty">
                        <div className="empty-icon">🚗</div>
                        <h3>Pasirinkite automobilį</h3>
                        <p>Pasirinkite automobilį iš sąrašo, kad matytumėte OBD-II duomenis.</p>
                    </div>
                ) : loading ? (
                    <div className="obd-loading">
                        <div className="spinner"></div>
                        <p>Kraunami OBD-II duomenys...</p>
                    </div>
                ) : availableParams.length === 0 ? (
                    <div className="obd-empty">
                        <div className="empty-icon">🔌</div>
                        <h3>Nėra OBD-II duomenų</h3>
                        <p>Šis automobilis dar neperdavė OBD-II diagnostikos duomenų.</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Patikrinkite, ar FMB įrenginys prijungtas prie OBD-II lizdo.
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Gauges Grid */}
                        <div className="obd-gauges-grid">
                            {availableParams.map((paramName) => {
                                const param = OBD_PARAMS[paramName];
                                const stats = getParamStats(paramName);
                                if (!param || !stats) return null;

                                const percentage = ((stats.current - param.min) / (param.max - param.min)) * 100;
                                const statusColor = statusColors[stats.status] || param.color;

                                return (
                                    <div
                                        key={paramName}
                                        className={`obd-gauge-card ${selectedParam === paramName ? "selected" : ""}`}
                                        onClick={() => setSelectedParam(paramName)}
                                        style={{
                                            borderColor: stats.status !== 'normal' ? statusColor : undefined,
                                            boxShadow: stats.status === 'critical' 
                                                ? `0 0 20px ${statusColor}40` 
                                                : stats.status === 'warning'
                                                    ? `0 0 10px ${statusColor}30`
                                                    : undefined
                                        }}
                                    >
                                        {/* Status indicator */}
                                        {stats.status !== 'normal' && (
                                            <div style={{
                                                position: 'absolute',
                                                top: '8px',
                                                right: '8px',
                                                width: '10px',
                                                height: '10px',
                                                borderRadius: '50%',
                                                background: statusColor,
                                                animation: stats.status === 'critical' ? 'pulse 1s infinite' : undefined
                                            }} />
                                        )}
                                        
                                        <div className="gauge-header">
                                            <span className="gauge-icon">{param.icon}</span>
                                            <span className="gauge-label">{param.label}</span>
                                        </div>
                                        <div className="gauge-value" style={{ color: statusColor }}>
                                            {stats.current.toFixed(paramName === "battery_voltage" ? 2 : 1)}
                                            <span className="gauge-unit">{param.unit}</span>
                                        </div>
                                        
                                        {/* Threshold bar */}
                                        <div className="gauge-bar" style={{ position: 'relative', height: '8px' }}>
                                            {/* Background zones */}
                                            {param.thresholds && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    display: 'flex',
                                                    borderRadius: '4px',
                                                    overflow: 'hidden'
                                                }}>
                                                    {param.thresholds.normal && (
                                                        <div style={{
                                                            flex: (param.thresholds.normal.max - param.thresholds.normal.min) / (param.max - param.min),
                                                            background: 'rgba(34, 197, 94, 0.3)'
                                                        }} />
                                                    )}
                                                    {param.thresholds.warning && (
                                                        <div style={{
                                                            flex: (param.thresholds.warning.max - param.thresholds.warning.min) / (param.max - param.min),
                                                            background: 'rgba(245, 158, 11, 0.3)'
                                                        }} />
                                                    )}
                                                    {param.thresholds.critical && (
                                                        <div style={{
                                                            flex: (param.thresholds.critical.max - param.thresholds.critical.min) / (param.max - param.min),
                                                            background: 'rgba(239, 68, 68, 0.3)'
                                                        }} />
                                                    )}
                                                </div>
                                            )}
                                            {/* Current value indicator */}
                                            <div
                                                style={{
                                                    position: 'absolute',
                                                    top: '-2px',
                                                    left: `${Math.min(Math.max(percentage, 0), 100)}%`,
                                                    width: '4px',
                                                    height: '12px',
                                                    background: statusColor,
                                                    borderRadius: '2px',
                                                    transform: 'translateX(-50%)',
                                                    boxShadow: `0 0 6px ${statusColor}`
                                                }}
                                            />
                                        </div>
                                        
                                        <div className="gauge-stats">
                                            <span>Min: {stats.min.toFixed(1)}</span>
                                            <span>Vid: {stats.avg.toFixed(1)}</span>
                                            <span>Max: {stats.max.toFixed(1)}</span>
                                        </div>
                                        
                                        {/* Status text */}
                                        <div style={{
                                            marginTop: '8px',
                                            fontSize: '11px',
                                            fontWeight: '600',
                                            textTransform: 'uppercase',
                                            color: statusColor
                                        }}>
                                            {stats.status === 'normal' && '✓ Normalus'}
                                            {stats.status === 'warning' && '⚠ Įspėjimas'}
                                            {stats.status === 'critical' && '🚨 Kritinis'}
                                            {stats.status === 'low' && '↓ Žemas'}
                                            {stats.status === 'high' && '↑ Aukštas'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Chart */}
                        {selectedParam && (
                            <div className="obd-chart-section">
                                <h2 className="chart-title">
                                    {OBD_PARAMS[selectedParam]?.icon} {OBD_PARAMS[selectedParam]?.label} - Istorija
                                </h2>
                                <OBDChart
                                    data={telemetry}
                                    paramName={selectedParam}
                                    paramConfig={OBD_PARAMS[selectedParam]}
                                />
                            </div>
                        )}

                        {/* DTC Section */}
                        <div className="obd-dtc-section">
                            <h2 className="section-title">⚠️ Diagnostikos kodai (DTC)</h2>
                            <div className="dtc-status">
                                <span className="dtc-icon">✅</span>
                                <span>Klaidų kodų nerasta</span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="obd-footer">
                            <span>
                                Paskutinis atnaujinimas:{" "}
                                {telemetry.length > 0
                                    ? telemetry[telemetry.length - 1].timestamp.toLocaleString("lt-LT")
                                    : "-"}
                            </span>
                            <span>{telemetry.length} duomenų taškų</span>
                        </div>
                    </>
                )}
            </div>
        </DashboardLayout>
    );
}

// Chart Component with threshold zones
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
        const padding = { top: 20, right: 20, bottom: 40, left: 60 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;

        ctx.fillStyle = "rgba(10, 1, 24, 0.3)";
        ctx.fillRect(0, 0, width, height);

        const values = data
            .map((p, i) => ({ value: p[paramName], timestamp: p.timestamp, index: i }))
            .filter((p) => p.value !== undefined && p.value !== null);

        if (values.length < 2) {
            ctx.fillStyle = "rgba(184, 180, 212, 0.5)";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Nepakanka duomenų", width / 2, height / 2);
            return;
        }

        // Use param min/max for consistent scale with thresholds
        const minVal = paramConfig.min;
        const maxVal = paramConfig.max;
        const range = maxVal - minVal || 1;

        // Draw threshold zones
        if (paramConfig.thresholds) {
            const { thresholds } = paramConfig;
            
            // Normal zone (green)
            if (thresholds.normal) {
                const y1 = padding.top + chartHeight - ((thresholds.normal.max - minVal) / range) * chartHeight;
                const y2 = padding.top + chartHeight - ((thresholds.normal.min - minVal) / range) * chartHeight;
                ctx.fillStyle = "rgba(34, 197, 94, 0.1)";
                ctx.fillRect(padding.left, y1, chartWidth, y2 - y1);
            }
            
            // Warning zone (yellow)
            if (thresholds.warning) {
                const y1 = padding.top + chartHeight - ((thresholds.warning.max - minVal) / range) * chartHeight;
                const y2 = padding.top + chartHeight - ((thresholds.warning.min - minVal) / range) * chartHeight;
                ctx.fillStyle = "rgba(245, 158, 11, 0.15)";
                ctx.fillRect(padding.left, y1, chartWidth, y2 - y1);
                
                // Warning threshold line
                ctx.strokeStyle = "rgba(245, 158, 11, 0.5)";
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(padding.left, y2);
                ctx.lineTo(width - padding.right, y2);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            // Critical zone (red)
            if (thresholds.critical) {
                const y1 = padding.top + chartHeight - ((thresholds.critical.max - minVal) / range) * chartHeight;
                const y2 = padding.top + chartHeight - ((thresholds.critical.min - minVal) / range) * chartHeight;
                ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
                ctx.fillRect(padding.left, y1, chartWidth, y2 - y1);
                
                // Critical threshold line
                ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(padding.left, y2);
                ctx.lineTo(width - padding.right, y2);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Label
                ctx.fillStyle = "rgba(239, 68, 68, 0.8)";
                ctx.font = "10px sans-serif";
                ctx.textAlign = "right";
                ctx.fillText("KRITINIS", width - padding.right - 5, y2 - 4);
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
            ctx.fillStyle = "rgba(184, 180, 212, 0.6)";
            ctx.font = "11px monospace";
            ctx.textAlign = "right";
            ctx.fillText(val.toFixed(0), padding.left - 8, y + 4);
        }

        // Draw data line
        ctx.beginPath();
        ctx.strokeStyle = paramConfig.color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        values.forEach((point, i) => {
            const x = padding.left + (i / (values.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((point.value - minVal) / range) * chartHeight;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

        // Gradient fill under line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, paramConfig.color + "40");
        gradient.addColorStop(1, paramConfig.color + "00");

        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();

        // Highlight points in warning/critical zones
        values.forEach((point, i) => {
            const status = getValueStatus(point.value, paramConfig);
            if (status === 'warning' || status === 'critical') {
                const x = padding.left + (i / (values.length - 1)) * chartWidth;
                const y = padding.top + chartHeight - ((point.value - minVal) / range) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = status === 'critical' ? '#ef4444' : '#f59e0b';
                ctx.fill();
            }
        });

        // Time labels
        ctx.fillStyle = "rgba(184, 180, 212, 0.6)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";

        if (values.length > 0) {
            const first = values[0].timestamp;
            const last = values[values.length - 1].timestamp;

            ctx.fillText(first.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), padding.left, height - 10);
            ctx.fillText(last.toLocaleTimeString("lt-LT", { hour: "2-digit", minute: "2-digit" }), width - padding.right, height - 10);
        }
    }, [data, paramName, paramConfig]);

    return <canvas ref={canvasRef} className="obd-chart-canvas"></canvas>;
}

export default OBDPage;
