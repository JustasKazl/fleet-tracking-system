import { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import VehicleCard from "../components/VehicleCard";
import VehicleFormModal from "../components/VehicleFormModal";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../api";

function VehiclesPage() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();
  const { token } = useAuth();

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    if (token) {
      loadVehicles();
    }
  }, [token]);

  async function loadVehicles() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch vehicles: ${res.status}`);
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
      const res = await fetch(`${API_BASE_URL}/api/vehicles/${deleteTarget}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        throw new Error("Delete failed");
      }

      setVehicles(prev => prev.filter(v => v.id !== deleteTarget));
      showToast("Automobilis sėkmingai ištrintas!", "success");
    } catch (err) {
      console.error(err);
      showToast("Nepavyko ištrinti automobilio", "error");
    }

    setDeleteTarget(null);
  }

  const openAddModal = () => {
    setEditingVehicle(null);
    setFormModalOpen(true);
  };

  const openEditModal = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormModalOpen(true);
  };

  const closeModal = () => {
    setFormModalOpen(false);
    setEditingVehicle(null);
  };

  const handleFormSuccess = () => {
    loadVehicles();
  };

  return (
    <DashboardLayout>
      {/* Modals */}
      <VehicleFormModal
        isOpen={formModalOpen}
        onClose={closeModal}
        onSuccess={handleFormSuccess}
        vehicle={editingVehicle}
      />

      {deleteTarget !== null && (
        <ConfirmModal
          open={true}
          title="Ištrinti automobilį?"
          message="Ar tikrai norite pašalinti šią transporto priemonę? Šio veiksmo atšaukti negalėsite."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={performDelete}
        />
      )}

      {/* Page Header */}
      <div className="vehicles-page-header">
        <div>
          <h1 className="vehicles-page-title">Transporto priemonės</h1>
          <p className="vehicles-page-sub">
            Valdykite automobilius, FMB003 įrenginius ir dokumentus.
          </p>
        </div>

        <div className="vehicles-page-actions">
          <input
            className="vehicles-search"
            placeholder="Ieškoti pagal numerius, modelį ar imei..."
          />
          <button
            className="btn-primary"
            onClick={openAddModal}
          >
            + Pridėti naują auto
          </button>
        </div>
      </div>

      {/* Content */}
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
              <br />
              <button 
                className="btn-primary" 
                style={{ marginTop: 10 }}
                onClick={openAddModal}
              >
                Pridėti pirmąjį automobilį
              </button>
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
