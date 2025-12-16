import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import '../styles/obd-dashboard.css';

// OBD-II Parameter definitions
const OBD_PARAMS = {
  rpm: { label: "Variklio RPM", unit: "rpm", icon: "🔄", color: "#667eea", min: 0, max: 8000 },
  coolant_temp: { label: "Aušinimo skystis", unit: "°C", icon: "🌡️", color: "#f59e0b", min: -40, max: 120 },
  speed_kmh: { label: "Greitis", unit: "km/h", icon: "🚗", color: "#3b82f6", min: 0, max: 200 },
  engine_load: { label: "Variklio apkrova", unit: "%", icon: "⚡", color: "#8b5cf6", min: 0, max: 100 },
  intake_air_temp: { label: "Įsiurbimo oro temp.", unit: "°C", icon: "🌬️", color: "#06b6d4", min: -40, max: 80 },
  maf: { label: "MAF", unit: "g/s", icon: "💨", color: "#10b981", min: 0, max: 500 },
  throttle: { label: "Pedalo padėtis", unit: "%", icon: "🎚️", color: "#f43f5e", min: 0, max: 100 },
  fuel_level: { label: "Kuro lygis", unit: "%", icon: "⛽", color: "#eab308", min: 0, max: 100 },
  battery_voltage: { label: "Akumuliatorius", unit: "V", icon: "🔋", color: "#22c55e", min: 10, max: 15 },
  fuel_rate: { label: "Kuro sąnaudos", unit: "l/100km", icon: "📊", color: "#ec4899", min: 0, max: 30 },
};

function OBDDashboardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { showToast } = useToast();

  const [vehicle, setVehicle] = useState(null);
  const [telemetry, setTelemetry] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState("1h"); // 1h, 6h, 24h, 7d
  const [availableParams, setAvailableParams] = useState([]);
  const [selectedParam, setSelectedParam] = useState(null);

  // Load vehicle info
  useEffect(() => {
    if (!token) return;

    fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setVehicle(data))
      .catch((err) => console.error(err));
  }, [id, token]);

  // Load telemetry data
  useEffect(() => {
    if (!vehicle?.imei || !token) return;

    loadTelemetry();
    const interval = setInterval(loadTelemetry, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [vehicle, token, timeRange]);

  async function loadTelemetry() {
    if (!vehicle?.imei) return;

    try {
      const limits = { "1h": 120, "6h": 720, "24h": 2880, "7d": 10000 };
      const limit = limits[timeRange] || 120;

      const res = await fetch(
        `${API_BASE_URL}/api/telemetry/${vehicle.imei}?limit=${limit}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) throw new Error("Failed to fetch");

      const data = await res.json();

      // Process and extract OBD data
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
        .reverse(); // Chronological order

      setTelemetry(processed);

      // Detect available parameters
      const params = new Set();
      processed.forEach((p) => {
        Object.keys(OBD_PARAMS).forEach((key) => {
          if (p[key] !== undefined && p[key] !== null) {
            params.add(key);
          }
        });
      });
      setAvailableParams(Array.from(params));

      // Auto-select first param if none selected
      if (!selectedParam && params.size > 0) {
        setSelectedParam(Array.from(params)[0]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading telemetry:", err);
      showToast("Nepavyko įkelti OBD duomenų", "error");
      setLoading(false);
    }
  }

  function extractOBDData(ioElements) {
    if (!ioElements) return {};

    const data = {};

    // Map IO element IDs to parameter names
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

    // Conversion functions
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

  // Get latest values
  function getLatestValues() {
    if (telemetry.length === 0) return {};
    return telemetry[telemetry.length - 1];
  }

  // Calculate stats for a parameter
  function getParamStats(paramName) {
    const values = telemetry
      .map((p) => p[paramName])
      .filter((v) => v !== undefined && v !== null);

    if (values.length === 0) return null;

    return {
      current: values[values.length - 1],
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
    };
  }

  const latest = getLatestValues();

  return (
    <DashboardLayout>
      <div className="obd-dashboard-page">
        {/* Header */}
        <div className="obd-header">
          <button className="btn-back" onClick={() => navigate(`/vehicles/${id}`)}>
            ← Grįžti
          </button>
          <div className="obd-title-section">
            <h1 className="obd-title">🔧 OBD-II Diagnostika</h1>
            <p className="obd-subtitle">
              {vehicle ? `${vehicle.brand} ${vehicle.model} • ${vehicle.plate}` : "Kraunama..."}
            </p>
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

        {loading ? (
          <div className="obd-loading">
            <div className="spinner"></div>
            <p>Kraunami OBD-II duomenys...</p>
          </div>
        ) : availableParams.length === 0 ? (
          <div className="obd-empty">
            <div className="empty-icon">🔌</div>
            <h3>Nėra OBD-II duomenų</h3>
            <p>Šis automobilis dar neperdavė OBD-II diagnostikos duomenų.</p>
          </div>
        ) : (
          <>
            {/* Live Gauges */}
            <div className="obd-gauges-grid">
              {availableParams.map((paramName) => {
                const param = OBD_PARAMS[paramName];
                const stats = getParamStats(paramName);
                if (!param || !stats) return null;

                const percentage = ((stats.current - param.min) / (param.max - param.min)) * 100;

                return (
                  <div
                    key={paramName}
                    className={`obd-gauge-card ${selectedParam === paramName ? "selected" : ""}`}
                    onClick={() => setSelectedParam(paramName)}
                  >
                    <div className="gauge-header">
                      <span className="gauge-icon">{param.icon}</span>
                      <span className="gauge-label">{param.label}</span>
                    </div>
                    <div className="gauge-value" style={{ color: param.color }}>
                      {stats.current.toFixed(paramName === "battery_voltage" ? 2 : 1)}
                      <span className="gauge-unit">{param.unit}</span>
                    </div>
                    <div className="gauge-bar">
                      <div
                        className="gauge-bar-fill"
                        style={{
                          width: `${Math.min(Math.max(percentage, 0), 100)}%`,
                          background: param.color,
                        }}
                      ></div>
                    </div>
                    <div className="gauge-stats">
                      <span>Min: {stats.min.toFixed(1)}</span>
                      <span>Vid: {stats.avg.toFixed(1)}</span>
                      <span>Max: {stats.max.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Chart Section */}
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

            {/* DTC Codes Section */}
            <div className="obd-dtc-section">
              <h2 className="section-title">⚠️ Diagnostikos kodai (DTC)</h2>
              <div className="dtc-status">
                <span className="dtc-icon">✅</span>
                <span>Klaidų kodų nerasta</span>
              </div>
            </div>

            {/* Last Update */}
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

// Chart Component using Canvas
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

    // Clear
    ctx.fillStyle = "rgba(10, 1, 24, 0.3)";
    ctx.fillRect(0, 0, width, height);

    // Get values
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

    const minVal = Math.min(...values.map((v) => v.value));
    const maxVal = Math.max(...values.map((v) => v.value));
    const range = maxVal - minVal || 1;

    // Draw grid
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
      ctx.fillText(val.toFixed(1), padding.left - 8, y + 4);
    }

    // Draw line
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

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
    gradient.addColorStop(0, paramConfig.color + "40");
    gradient.addColorStop(1, paramConfig.color + "00");

    ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
    ctx.lineTo(padding.left, padding.top + chartHeight);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

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

export default OBDDashboardPage;
