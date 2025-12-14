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
  const [error, setError] = useState(null);
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
    setError(null);
    
    try {
      console.log('Loading vehicles from:', `${API_BASE_URL}/api/vehicles`);
      
      const res = await fetch(`${API_BASE_URL}/api/vehicles`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log('Response status:', res.status);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      console.log('Received vehicles:', data);

      // Ensure data is an array
      if (Array.isArray(data)) {
        setVehicles(data);
      } else if (data && Array.isArray(data.vehicles)) {
        setVehicles(data.vehicles);
      } else {
        console.error('Invalid data format:', data);
        setVehicles([]);
        setError('Invalid data format received from server');
      }
    } catch (err) {
      console.error('Error loading vehicles:', err);
      setError(err.message);
      showToast("Nepavyko užkrauti automobilių: " + err.message, "error");
      setVehicles([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
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
        const errorText = await res.text();
        showToast("Nepavyko pašalinti automobilio: " + errorText, "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Klaida šalinant automobilį: " + err.message, "error");
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

      {/* Error Message */}
      {error && (
        <div style={{
          background: 'rgba(242, 68, 68, 0.1)',
          border: '1px solid rgba(242, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px',
          color: '#f24444'
        }}>
          <strong>Klaida:</strong> {error}
          <button 
            onClick={loadVehicles}
            style={{
              marginLeft: '16px',
              padding: '4px 12px',
              background: 'transparent',
              border: '1px solid rgba(242, 68, 68, 0.5)',
              borderRadius: '4px',
              color: '#f24444',
              cursor: 'pointer'
            }}
          >
            Bandyti dar kartą
          </button>
        </div>
      )}

      {/* Search Results Info */}
      {searchQuery && !loading && !error && (
        <div className="search-results-info">
          Rasta <strong>{filteredVehicles.length}</strong> iš <strong>{vehicles.length}</strong> automobilių
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-message">
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
            <p>Kraunama...</p>
          </div>
        </div>
      ) : error ? (
        // Error state - already shown above
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <h2 className="empty-state-title">Klaida kraunant duomenis</h2>
          <p className="empty-state-text">
            Patikrinkite serverio būseną ir bandykite dar kartą
          </p>
        </div>
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
