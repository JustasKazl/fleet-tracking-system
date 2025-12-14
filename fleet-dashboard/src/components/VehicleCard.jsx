import { useNavigate } from "react-router-dom";

function VehicleCard({ vehicle, onDelete, onEdit }) {
  const {
    id,
    brand,
    model,
    custom_name,
    plate,
    imei,
    status,
    total_km,
    created_at,
    last_seen,        // From telemetry JOIN
    last_latitude,    // From telemetry JOIN
    last_longitude,   // From telemetry JOIN
  } = vehicle;

  const statusLabel =
    status === "online"
      ? "Online"
      : status === "offline"
      ? "Offline"
      : status === "warning"
      ? "Įspėjimas"
      : "Nežinoma";

  const statusClass =
    status === "online"
      ? "status-tag status-online"
      : status === "offline"
      ? "status-tag status-offline"
      : status === "warning"
      ? "status-tag status-warn"
      : "status-tag";

  const avatarLetter = brand?.[0]?.toUpperCase() || "?";
  const navigate = useNavigate();

  // Helper function to format the date nicely
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString('lt-LT');
    } catch (e) {
      return "-";
    }
  };

  // Helper to format last seen time
  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Niekada";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Dabar";
      if (diffMins < 60) return `Prieš ${diffMins} min.`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Prieš ${diffHours} val.`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `Prieš ${diffDays} d.`;
    } catch (e) {
      return "-";
    }
  };

  // Format IMEI for display (show last 6 digits for privacy)
  const formatImei = (imei) => {
    if (!imei) return "-";
    if (imei.length === 15) {
      return `•••••••••${imei.slice(-6)}`;
    }
    return imei;
  };

  return (
    <div className="vehicle-card">
      <div className="vehicle-card-top">
        <div className="vehicle-avatar">{avatarLetter}</div>
        <div className="vehicle-main">
          <div className="vehicle-name-row">
            <span className="vehicle-brand-model">{brand} {model}</span>
            <span className={statusClass}>{statusLabel}</span>
          </div>
          <div className="vehicle-custom-name">
            {custom_name || "(be pavadinimo)"}
          </div>
          <div className="vehicle-plate">Valst. nr.: {plate || " - "}</div>
        </div>
      </div>

      <div className="vehicle-meta">
        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">IMEI</div>
          <div className="vehicle-meta-value" title={imei}>
            {formatImei(imei)}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Iš viso km</div>
          <div className="vehicle-meta-value">
            {total_km != null ? `${total_km.toLocaleString('lt-LT')} km` : "-"}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Paskutinė vietovė</div>
          <div className="vehicle-meta-value">
            {formatLastSeen(last_seen)}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Pridėtas</div>
          <div className="vehicle-meta-value">
            {formatDate(created_at)}
          </div>
        </div>
      </div>

      <div className="vehicle-footer">
        <button
          type="button"
          className="btn-link"
          onClick={() => navigate(`/vehicles/${id}`)}
        >
          Peržiūrėti
        </button>
        <div className="vehicle-footer-right">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onEdit?.(vehicle)}
          >
            Redaguoti
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onDelete?.(id)}
          >
            Pašalinti
          </button>
        </div>
      </div>
    </div>
  );
}

export default VehicleCard;
