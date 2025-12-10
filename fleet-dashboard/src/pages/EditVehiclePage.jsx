import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import { carData } from "./carDataShared";

function EditVehiclePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);

  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [customName, setCustomName] = useState("");
  const [plate, setPlate] = useState("");
  const [fmbSerial, setFmbSerial] = useState("");
  const [odo, setOdo] = useState(0);

  useEffect(() => {
    async function loadVehicle() {
      try {
        const res = await fetch(`https://fleet-tracking-system-production-2cd5.up.railway.app}/vehicles`);
        const data = await res.json();
        const v = data.find(item => String(item.id) === id);

        if (!v) {
          showToast("Transporto priemonė nerasta", "error");
          navigate("/vehicles");
          return;
        }

        setBrand(v.brand);
        setModel(v.model);
        setCustomName(v.custom_name);
        setPlate(v.plate);
        setFmbSerial(v.fmb_serial);
        setOdo(v.total_km || 0);
      } catch (err) {
        showToast("Klaida kraunant duomenis", "error");
      }
      setLoading(false);
    }

    loadVehicle();
  }, [id]);

  async function handleSave(e) {
    e.preventDefault();

    const payload = {
      brand,
      model,
      custom_name: customName,
      plate,
      imei: fmbSerial,
      fmb_serial: fmbSerial,
      total_km: odo,
      status: "offline",
    };

    const res = await fetch(`https://fleet-tracking-system-production-2cd5.up.railway.app/vehicles/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      showToast("Transporto priemonė atnaujinta!", "success");
      navigate("/vehicles");
    } else {
      showToast("Klaida atnaujinant", "error");
    }
  }

  if (loading) return <DashboardLayout>Kraunama...</DashboardLayout>;

  return (
    <DashboardLayout>
      <h1 className="vehicles-page-title">Redaguoti automobilį</h1>
      <p className="vehicles-page-sub">Pakeiskite informaciją apačioje</p>

      <form className="add-vehicle-form" onSubmit={handleSave}>
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
            />
          </div>

          <div className="form-field">
            <label>Valstybiniai numeriai</label>
            <input
              value={plate}
              onChange={(e) => setPlate(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {/* FMB + rida */}
        <div className="form-row">
          <div className="form-field">
            <label>FMB130 serija</label>
            <input
              value={fmbSerial}
              disabled
              style={{ opacity: 0.6 }}
            />
          </div>

          <div className="form-field">
            <label>Rida (km)</label>
            <input
              type="number"
              value={odo}
              onChange={(e) => setOdo(Number(e.target.value))}
            />
          </div>
        </div>

        <button className="btn-primary submit-full" type="submit">
          💾 Išsaugoti pakeitimus
        </button>
      </form>
    </DashboardLayout>
  );
}

export default EditVehiclePage;
