import { useNavigate } from "react-router-dom";

function VehicleCard({ vehicle, onDelete }) {
  const {
    id,
    brand,
    model,
    custom_name,
    plate,
    imei,
    fmb_serial,
    device_id,
    status,
    total_km,
    created_at,
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
          <div className="vehicle-meta-label">FMB130</div>
          <div className="vehicle-meta-value">{fmb_serial || device_id}</div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">IMEI</div>
          <div className="vehicle-meta-value">{imei || "-"}</div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Iš viso km</div>
          <div className="vehicle-meta-value">
            {total_km != null ? `${total_km} km` : "-"}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Aktyvus nuo</div>
          <div className="vehicle-meta-value">
            {created_at ? created_at.split("T")[0] : "-"}
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
            onClick={() => navigate(`/vehicles/edit/${id}`)}
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
