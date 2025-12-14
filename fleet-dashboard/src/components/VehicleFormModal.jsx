import { useState, useEffect } from "react";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { carData } from "../pages/carDataShared";
import API_BASE_URL from "../api";

function VehicleFormModal({ isOpen, onClose, onSuccess, vehicle = null }) {
  const { showToast } = useToast();
  const { token } = useAuth();
  const isEditMode = !!vehicle;

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customName, setCustomName] = useState("");
  const [plate, setPlate] = useState("");
  const [imei, setImei] = useState("");
  const [odo, setOdo] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load existing vehicle data if editing
  useEffect(() => {
    if (vehicle && isEditMode) {
      setBrand(vehicle.brand || "");
      setModel(vehicle.model || "");
      setCustomName(vehicle.custom_name || "");
      setPlate(vehicle.plate || "");
      setImei(vehicle.imei || "");
      setOdo(vehicle.total_km || 0);
    } else {
      // Reset form for add mode
      setBrand("");
      setModel("");
      setCustomName("");
      setPlate("");
      setImei("");
      setOdo(0);
    }
  }, [vehicle, isEditMode, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();

    // Validate required fields
    if (!brand || !model || !imei) {
      showToast("Užpildykite privalomus laukus (markė, modelis, IMEI)", "error");
      return;
    }

    // Validate IMEI format (15 digits)
    if (!/^\d{15}$/.test(imei)) {
      showToast("IMEI turi būti 15 skaitmenų", "error");
      return;
    }

    setLoading(true);

    const payload = {
      brand,
      model,
      custom_name: customName,
      plate,
      imei,
      total_km: odo,
      status: "offline"
    };

    try {
      const url = isEditMode
        ? `${API_BASE_URL}/api/vehicles/${vehicle.id}`
        : `${API_BASE_URL}/api/vehicles`;

      const method = isEditMode ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed");
      }

      showToast(
        isEditMode
          ? "Automobilis sėkmingai atnaujintas!"
          : "Automobilis sėkmingai pridėtas!",
        "success"
      );
      onSuccess();
      onClose();

    } catch (err) {
      console.error(err);
      showToast(
        err.message === "IMEI already registered to another vehicle"
          ? "Šis IMEI jau registruotas kitam automobiliui"
          : isEditMode
            ? "Nepavyko atnaujinti automobilio"
            : "Nepavyko pridėti automobilio",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditMode ? "Redaguoti automobilį" : "Pridėti naują automobilį"}
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {/* IMEI - Required Field */}
          <div className="form-field">
            <label>IMEI numeris *</label>
            <input
              type="text"
              value={imei}
              onChange={(e) => setImei(e.target.value.replace(/\D/g, ''))} // Only digits
              placeholder="860123456789012 (15 skaitmenų)"
              maxLength="15"
              required
              disabled={isEditMode}
              style={isEditMode ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
            />
            {isEditMode && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                ⚠️ IMEI negalima keisti po sukūrimo
              </div>
            )}
            {!isEditMode && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                💡 Teltonika FMB įrenginio IMEI numeris (15 skaitmenų)
              </div>
            )}
          </div>

          {/* Brand & Model Row */}
          <div className="form-row">
            <div className="form-field">
              <label>Markė *</label>
              <select
                value={brand}
                onChange={(e) => {
                  setBrand(e.target.value);
                  setModel(""); // Reset model when brand changes
                }}
                required
              >
                <option value="">Pasirinkite...</option>
                {Object.keys(carData).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label>Modelis *</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                disabled={!brand}
                required
              >
                <option value="">Pasirinkite modelį...</option>
                {brand &&
                  carData[brand].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
              </select>
            </div>
          </div>

          {/* Custom Name & Plate Row */}
          <div className="form-row">
            <div className="form-field">
              <label>Automobilio pavadinimas</label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Pvz: Direktoriaus BMW"
              />
            </div>

            <div className="form-field">
              <label>Valstybiniai numeriai</label>
              <input
                type="text"
                value={plate}
                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                placeholder="ABC123"
              />
            </div>
          </div>

          {/* Mileage */}
          <div className="form-field">
            <label>Rida (km)</label>
            <input
              type="number"
              value={odo}
              onChange={(e) => setOdo(Number(e.target.value))}
              min="0"
              placeholder="0"
            />
          </div>

          {/* Form Actions */}
          <div className="modal-buttons">
            <button
              type="button"
              className="btn-ghost"
              onClick={onClose}
              disabled={loading}
            >
              Atšaukti
            </button>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? "Kraunama..." : (isEditMode ? "💾 Išsaugoti" : "✓ Pridėti automobilį")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default VehicleFormModal;
