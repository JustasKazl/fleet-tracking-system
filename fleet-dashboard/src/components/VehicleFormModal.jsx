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
  const [fmbSerial, setFmbSerial] = useState("");
  const [vin, setVin] = useState("");
  const [odo, setOdo] = useState(0);
  const [loading, setLoading] = useState(false);

  // Load existing vehicle data if editing
  useEffect(() => {
    if (vehicle && isEditMode) {
      setBrand(vehicle.brand || "");
      setModel(vehicle.model || "");
      setCustomName(vehicle.custom_name || "");
      setPlate(vehicle.plate || "");
      setFmbSerial(vehicle.fmb_serial || "");
      setVin(vehicle.vin || "");
      setOdo(vehicle.total_km || 0);
    } else {
      // Reset form for add mode
      setBrand("");
      setModel("");
      setCustomName("");
      setPlate("");
      setFmbSerial("");
      setVin("");
      setOdo(0);
    }
  }, [vehicle, isEditMode, isOpen]);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!brand || !model || !fmbSerial) {
      showToast("Užpildykite privalomus laukus (markė, modelis, FMB serija)", "error");
      return;
    }

    setLoading(true);

    const payload = {
      brand,
      model,
      custom_name: customName,
      plate,
      fmb_serial: fmbSerial,
      imei: fmbSerial,
      device_id: fmbSerial,
      vin: vin || "",
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

      if (!res.ok) throw new Error("Failed");

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
        isEditMode
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
          {/* VIN Code */}
          <div className="form-field">
            <label>VIN kodas (nebūtina)</label>
            <input
              type="text"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase())}
              placeholder="Pvz: WBA3A5G50GW123456"
              maxLength="17"
            />
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

          {/* FMB Serial & Mileage Row */}
          <div className="form-row">
            <div className="form-field">
              <label>FMB003 serija *</label>
              <input
                type="text"
                value={fmbSerial}
                onChange={(e) => setFmbSerial(e.target.value)}
                placeholder="Pvz: FMB130-001234"
                required
                disabled={isEditMode}
                style={isEditMode ? { opacity: 0.6 } : {}}
              />
              {isEditMode && (
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  Negalima keisti redagavimo metu
                </div>
              )}
            </div>

            <div className="form-field">
              <label>Rida (km)</label>
              <input
                type="number"
                value={odo}
                onChange={(e) => setOdo(Number(e.target.value))}
                min="0"
              />
            </div>
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
