import { useState, useEffect } from "react";
import API_BASE_URL from "../api";

function ServerStatus() {
  const [status, setStatus] = useState("checking"); // checking, online, offline
  const [responseTime, setResponseTime] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  // Check server health every 30 seconds
  useEffect(() => {
    const checkHealth = async () => {
      const startTime = performance.now();
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, {
          signal: AbortSignal.timeout(5000), // 5 second timeout
        });
        
        const endTime = performance.now();
        const time = Math.round(endTime - startTime);
        
        setResponseTime(time);
        setStatus(res.ok ? "online" : "offline");
        setLastChecked(new Date());
      } catch (err) {
        setStatus("offline");
        setResponseTime(null);
        setLastChecked(new Date());
        console.error("Health check failed:", err);
      }
    };

    // Check immediately on mount
    checkHealth();

    // Then check every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    if (status === "online") return "#3bf28c"; // green
    if (status === "offline") return "#f24444"; // red
    return "#f2e63b"; // yellow for checking
  };

  const getStatusLabel = () => {
    if (status === "online") return "Serveris online";
    if (status === "offline") return "Serveris offline";
    return "Tikrinimas...";
  };

  return (
    <div className="server-status-wrapper">
      <button
        type="button"
        className="server-status-button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span 
          className={`status-dot ${status}`}
          style={{ 
            background: getStatusColor(),
            boxShadow: `0 0 8px ${getStatusColor()}`
          }}
        ></span>
        <span className="server-status-text">{getStatusLabel()}</span>
      </button>

      {showTooltip && (
        <div className="server-status-tooltip">
          <div className="tooltip-row">
            <span className="tooltip-label">Statusas:</span>
            <span className={`tooltip-value status-${status}`}>
              {status === "online" ? "🟢 Online" : status === "offline" ? "🔴 Offline" : "🟡 Checking"}
            </span>
          </div>

          {responseTime !== null && (
            <div className="tooltip-row">
              <span className="tooltip-label">Atsakymo laikas:</span>
              <span className="tooltip-value">{responseTime}ms</span>
            </div>
          )}

          {lastChecked && (
            <div className="tooltip-row">
              <span className="tooltip-label">Patikrinta:</span>
              <span className="tooltip-value">
                {lastChecked.toLocaleTimeString("lt-LT")}
              </span>
            </div>
          )}

          <div className="tooltip-row tooltip-info">
            <span className="tooltip-label">Patikra kas:</span>
            <span className="tooltip-value">30 sekundžių</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServerStatus;
