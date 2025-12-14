import { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import VehicleCard from "../components/VehicleCard";
import VehicleFormModal from "../components/VehicleFormModal";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../api";

function VehiclesPage() {
  const { showToast } = useToast();
  const { token } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

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

  function handleDeleteClick(id) {
    // Find the vehicle to show its details in the confirm modal
    const vehicle = vehicles.find(v => v.id === id);
    setDeleteConfirm({ id, vehicle });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/vehicles/${deleteConfirm.id}`, {
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
    } finally {
      setDeleteConfirm(null);
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

  // Filter vehicles based on search query
  const filteredVehicles = vehicles.filter((vehicle) => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    const searchFields = [
      vehicle.brand?.toLowerCase() || "",
      vehicle.model?.toLowerCase() || "",
      vehicle.custom_name?.toLowerCase() || "",
      vehicle.plate?.toLowerCase() || "",
      vehicle.imei?.toLowerCase() || "",
    ];
    
    return searchFields.some(field => field.includes(query));
  });

  return (
    <DashboardLayout>
      {/* Header Section */}
      <div className="vehicles-header">
        <div className="vehicles-title-block">
          <h1 className="vehicles-page-title">Automobiliai</h1>
          <p className="vehicles-page-sub">Valdykite savo automobilių parką</p>
        </div>
        
        {/* Search Bar */}
        <div className="vehicles-search-bar">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Ieškoti pagal markę, modelį, pavadinimą, numerius arba IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery("")}
              title="Išvalyti paiešką"
            >
              ✕
            </button>
          )}
        </div>

        {/* Add Button */}
        <button className="btn-primary" onClick={openAddModal}>
          ➕ Pridėti automobilį
        </button>
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="search-results-info">
          Rasta <strong>{filteredVehicles.length}</strong> iš <strong>{vehicles.length}</strong> automobilių
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-message">Kraunama...</div>
      ) : filteredVehicles.length === 0 ? (
        // Empty State
        searchQuery ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <h2 className="empty-state-title">Nieko nerasta</h2>
            <p className="empty-state-text">
              Bandykite pakeisti paieškos kriterijus
            </p>
            <button
              className="btn-ghost"
              onClick={() => setSearchQuery("")}
            >
              Išvalyti paiešką
            </button>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">🚗</div>
            <h2 className="empty-state-title">Nėra automobilių</h2>
            <p className="empty-state-text">
              Pradėkite pridėdami pirmą automobilį į savo parką
            </p>
            <button className="btn-primary" onClick={openAddModal}>
              ➕ Pridėti automobilį
            </button>
          </div>
        )
      ) : (
        // Vehicle Cards Grid
        <div className="vehicles-grid">
          {filteredVehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              onDelete={handleDeleteClick}
              onEdit={openEditModal}
            />
          ))}
        </div>
      )}

      {/* Vehicle Form Modal */}
      <VehicleFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleModalSuccess}
        vehicle={editingVehicle}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleteConfirm}
        title="Pašalinti automobilį?"
        message={
          deleteConfirm?.vehicle
            ? `Ar tikrai norite pašalinti "${deleteConfirm.vehicle.brand} ${deleteConfirm.vehicle.model}" (${deleteConfirm.vehicle.plate || 'be numerių'})? Šis veiksmas negrįžtamas.`
            : "Ar tikrai norite pašalinti šį automobilį?"
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </DashboardLayout>
  );
}

export default VehiclesPage;
