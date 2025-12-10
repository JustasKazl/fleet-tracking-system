import { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import VehicleCard from "../components/VehicleCard";
import ConfirmModal from "../components/ConfirmModal";
import { useNavigate } from "react-router-dom";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";

function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadVehicles();
  }, []);

async function loadVehicles() {
  try {
    setLoading(true);
    setError(null);
    const res = await fetch(`${API_BASE_URL}/api/vehicles`); // ✅ Added (
    
    if (!res.ok) {
      throw new Error(`Failed to fetch vehicles: ${res.status}`); // ✅ Added (
    }
    
    const data = await res.json();
    setVehicles(data);
  } catch (err) {
    console.error("Failed to load vehicles:", err);
    setError(err.message);
    showToast("Nepavyko užkrauti automobilių", "error");
  } finally {
    setLoading(false);
  }
}

async function performDelete() {
  if (!deleteTarget) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${deleteTarget}`, { // ✅ Added (
      method: "DELETE",
    });

    if (!res.ok) {
      throw new Error("Delete failed");
    }

    setVehicles((prev) => prev.filter((v) => v.id !== deleteTarget));
    showToast("Automobilis sėkmingai ištrintas!", "success");
  } catch (err) {
    console.error(err);
    showToast("Nepavyko ištrinti automobilio", "error");
  }

  setDeleteTarget(null);
}

  return (
    <DashboardLayout>
      {deleteTarget !== null && (
        <ConfirmModal
          open={true}
          title="Ištrinti automobilį?"
          message="Ar tikrai norite pašalinti šią transporto priemonę? Šio veiksmo atšaukti negalėsite."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={performDelete}
        />
      )}

      <div className="vehicles-page-header">
        <div>
          <h1 className="vehicles-page-title">Transporto priemonės</h1>
          <p className="vehicles-page-sub">
            Valdykite automobilius, FMB130 įrenginius ir dokumentus.
          </p>
        </div>

        <div className="vehicles-page-actions">
          <input
            className="vehicles-search"
            placeholder="Ieškoti pagal numerius, modelį ar imei..."
          />
          <button
            className="btn-primary"
            onClick={() => navigate("/vehicles/add")}
          >
            + Pridėti naują auto
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div className="loading-spinner">Kraunama...</div>
        </div>
      ) : error ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--bad)' }}>
          Klaida: {error}
          <button 
            className="btn-primary" 
            style={{ marginLeft: 10 }}
            onClick={loadVehicles}
          >
            Bandyti dar kartą
          </button>
        </div>
      ) : (
        <div className="vehicle-grid">
          {vehicles.length === 0 ? (
            <div style={{ padding: 20, opacity: 0.7 }}>
              Nėra įtrauktų transporto priemonių.
            </div>
          ) : (
            vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onDelete={() => setDeleteTarget(v.id)}
              />
            ))
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

export default VehiclesPage;
