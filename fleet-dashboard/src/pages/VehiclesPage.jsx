import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../layout/DashboardLayout";
import VehicleCard from "../components/VehicleCard";
import VehicleFormModal from "../components/VehicleFormModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../api";

function VehiclesPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { token } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);

  useEffect(() => {
    if (token) {
      loadVehicles();
    }
  }, [token]);

  async function loadVehicles() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json();
      setVehicles(data);
    } catch (err) {
      console.error(err);
      showToast("Nepavyko užkrauti automobilių", "error");
    }
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Ar tikrai norite pašalinti šį automobilį?")) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (res.ok) {
        showToast("Automobilis pašalintas", "success");
        loadVehicles();
      } else {
        showToast("Nepavyko pašalinti automobilio", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Klaida šalinant automobilį", "error");
    }
  }

  function openAddModal() {
    setEditingVehicle(null);
    setIsModalOpen(true);
  }

  function openEditModal(vehicle) {
    setEditingVehicle(vehicle);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingVehicle(null);
  }

  function handleModalSuccess() {
    loadVehicles();
    closeModal();
  }

  return (
    <DashboardLayout>
      <div className="vehicles-header">
        <div>
          <h1 className="vehicles-page-title">Automobiliai</h1>
          <p className="vehicles-page-sub">
            Valdykite savo automobilių parką
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={openAddModal}
        >
          ➕ Pridėti automobilį
        </button>
      </div>

      {loading ? (
        <div className="loading-message">Kraunama...</div>
      ) : vehicles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🚗</div>
          <h2 className="empty-state-title">Nėra automobilių</h2>
          <p className="empty-state-text">
            Pradėkite pridėdami pirmą automobilį į savo parką
          </p>
          <button
            className="btn-primary"
            onClick={openAddModal}
          >
            ➕ Pridėti automobilį
          </button>
        </div>
      ) : (
        <div className="vehicles-grid">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onDelete={handleDelete}
              onEdit={openEditModal}
            />
          ))}
        </div>
      )}

      <VehicleFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        vehicle={editingVehicle}
      />
    </DashboardLayout>
  );
}

export default VehiclesPage;
