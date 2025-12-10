import { useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import { carData } from "./carDataShared";
import API_BASE_URL from "../api";

function AddVehiclePage() {
  const nav = useNavigate();
  const { showToast } = useToast();

  // Formos state
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customName, setCustomName] = useState("");
  const [plate, setPlate] = useState("");
  const [fmbSerial, setFmbSerial] = useState("");
  const [odo, setOdo] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();

    // Backend reikalauja device_id ir imei → darome automatiškai
    const payload = {
      brand,
      model,
      custom_name: customName,
      plate,
      fmb_serial: fmbSerial,
      imei: fmbSerial,         // kol kas IMEI = FMB serial
      device_id: fmbSerial,    // device_id = FMB serial
      total_km: odo,
      status: "offline"
    };

    console.log("Payload:", payload);

    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Bad request");

      showToast("Automobilis sėkmingai pridėtas!", "success");
      nav("/vehicles");

    } catch (err) {
      console.error(err);
      showToast("Nepavyko pridėti automobilio", "error");
    }
  }

  return (
    <DashboardLayout>
      <h1 className="vehicles-page-title">Pridėti naują automobilį</h1>
      <p className="vehicles-page-sub">Užpildykite duomenis apačioje</p>

      <form className="add-vehicle-form" onSubmit={handleSubmit}>
        
        {/* Markė + Modelis */}
        <div className="form-row">
          <div className="form-field">
            <label>Markė</label>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setModel("");
              }}
            >
              <option value="">Pasirinkite...</option>
              {Object.keys(carData).map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Modelis</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              disabled={!brand}
            >
              <option value="">Pasirinkite modelį...</option>
              {brand &&
                carData[brand].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
            </select>
          </div>
        </div>

        {/* Pavadinimas + numeriai */}
        <div className="form-row">
          <div className="form-field">
            <label>Automobilio pavadinimas</label>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Pvz.: Direktoriaus BMW"
            />
          </div>

          <div className="form-field">
            <label>Valstybiniai numeriai</label>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </div>
        </div>

        {/* FMB + rida */}
        <div className="form-row">
          <div className="form-field">
            <label>FMB130 serija</label>
            <input
              value={fmbSerial}
              onChange={(e) => setFmbSerial(e.target.value)}
              placeholder="Pvz: FMB130-001234"
            />
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

        <button className="btn-primary submit-full" type="submit">
          ✓ Pridėti automobilį
        </button>

      </form>
    </DashboardLayout>
  );
}

export default AddVehiclePage;
