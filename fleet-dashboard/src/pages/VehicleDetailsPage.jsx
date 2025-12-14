import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import AddDocumentForm from "../components/AddDocumentForm";
import AddServiceModal from "../components/AddServiceModal";
import ConfirmModal from "../components/ConfirmModal";
import MapComponent from "../components/MapComponent";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../api";

function VehicleDetailsPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const { token } = useAuth();

    const [vehicle, setVehicle] = useState(null);
    const [loading, setLoading] = useState(true);

    const [documents, setDocuments] = useState([]);
    const [serviceRecords, setServiceRecords] = useState([]);

    const [showServiceModal, setShowServiceModal] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);

    // ---------------------- LOAD VEHICLE ----------------------
    useEffect(() => {
        if (!token) return;
        
        fetch(`${API_BASE_URL}/api/vehicles/${id}`, {
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        })
            .then(res => res.json())
            .then(data => setVehicle(data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, [id, token]);

    // ---------------------- LOAD DOCUMENTS ----------------------
    async function loadDocuments() {
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}/documents`, {
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });
        setDocuments(await res.json());
    }
    useEffect(() => { 
        if (token) loadDocuments(); 
    }, [id, token]);

    // ---------------------- LOAD SERVICE RECORDS ----------------------
    async function loadService() {
        if (!token) return;
        const res = await fetch(`${API_BASE_URL}/api/vehicles/${id}/service`, {
            headers: {
                "Authorization": `Bearer ${token}`,
            },
        });
        setServiceRecords(await res.json());
    }
    useEffect(() => { 
        if (token) loadService(); 
    }, [id, token]);

    // Helper to get document expiry status
    function getDocumentStatus(validUntil) {
        if (!validUntil) return "none";
        const today = new Date();
        const expiryDate = new Date(validUntil);
        const daysUntilExpiry = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        
        if (daysUntilExpiry < 0) return "expired";
        if (daysUntilExpiry <= 30) return "expiring-soon";
        return "valid";
    }

    // Separate key documents
    const keyDocTypes = ["Draudimas", "Techninė apžiūra", "Registracijos liudijimas"];
    const keyDocuments = documents.filter(doc => keyDocTypes.includes(doc.doc_type));
    const otherDocuments = documents.filter(doc => !keyDocTypes.includes(doc.doc_type));

    if (loading) return <DashboardLayout><div className="loading-page">Kraunama...</div></DashboardLayout>;
    if (!vehicle) return <DashboardLayout><div className="error-page">Automobilis nerastas.</div></DashboardLayout>;

    const statusClass =
        vehicle.status === "online"
            ? "vehicle-status-badge vehicle-status-online"
            : vehicle.status === "warning"
                ? "vehicle-status-badge vehicle-status-warn"
                : "vehicle-status-badge vehicle-status-offline";

    return (
        <DashboardLayout>
            <div className="vehicle-details-page">
                
                {/* BACK BUTTON */}
                <button className="btn-back" onClick={() => navigate("/vehicles")}>
                    ← Grįžti į sąrašą
                </button>

                {/* HERO SECTION */}
                <div className="vehicle-hero">
                    <div className="vehicle-hero-avatar">
                        {vehicle.brand?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="vehicle-hero-content">
                        <h1 className="vehicle-hero-title">
                            {vehicle.brand} {vehicle.model}
                        </h1>
                        <div className="vehicle-hero-meta">
                            <span className="hero-meta-item">
                                📋 {vehicle.plate || "Nėra numerių"}
                            </span>
                            <span className="hero-meta-item">
                                🏷️ {vehicle.custom_name || "Be pavadinimo"}
                            </span>
                            <span className={statusClass}>{vehicle.status}</span>
                        </div>
                    </div>
                </div>

                {/* INFO GRID */}
                <div className="details-info-grid">
                    <div className="info-card">
                        <div className="info-card-label">IMEI numeris</div>
                        <div className="info-card-value">{vehicle.imei || vehicle.fmb_serial || "-"}</div>
                    </div>
                    <div className="info-card">
                        <div className="info-card-label">Rida</div>
                        <div className="info-card-value">{vehicle.total_km?.toLocaleString('lt-LT') || "0"} km</div>
                    </div>
                    <div className="info-card">
                        <div className="info-card-label">Sukurta</div>
                        <div className="info-card-value">
                            {vehicle.created_at ? new Date(vehicle.created_at).toLocaleDateString('lt-LT') : "-"}
                        </div>
                    </div>
                    <div className="info-card">
                        <div className="info-card-label">Būsena</div>
                        <div className="info-card-value" style={{ textTransform: "capitalize" }}>
                            {vehicle.status}
                        </div>
                    </div>
                </div>

                {/* MAP SECTION */}
                <div className="details-section">
                    <MapComponent 
                        vehicleId={id} 
                        vehicleImei={vehicle.imei || vehicle.fmb_serial}
                        token={token}
                    />
                </div>

                {/* KEY DOCUMENTS SECTION */}
                <div className="details-section">
                    <div className="section-header">
                        <h2 className="section-title">📄 Pagrindiniai dokumentai</h2>
                        <p className="section-subtitle">Draudimas, techninė apžiūra ir registracija</p>
                    </div>

                    <div className="key-documents-grid">
                        {["Draudimas", "Techninė apžiūra", "Registracijos liudijimas"].map(docType => {
                            const doc = keyDocuments.find(d => d.doc_type === docType);
                            const status = doc ? getDocumentStatus(doc.valid_until) : "missing";
                            
                            return (
                                <div key={docType} className={`key-doc-card key-doc-${status}`}>
                                    <div className="key-doc-icon">
                                        {docType === "Draudimas" && "🛡️"}
                                        {docType === "Techninė apžiūra" && "🔧"}
                                        {docType === "Registracijos liudijimas" && "📋"}
                                    </div>
                                    <div className="key-doc-content">
                                        <div className="key-doc-type">{docType}</div>
                                        {doc ? (
                                            <>
                                                <div className="key-doc-title">{doc.title}</div>
                                                <div className="key-doc-expiry">
                                                    {status === "expired" && <span className="expiry-badge expired">❌ Baigėsi</span>}
                                                    {status === "expiring-soon" && <span className="expiry-badge expiring">⚠️ Baigiasi greitai</span>}
                                                    {status === "valid" && <span className="expiry-badge valid">✓ Galioja</span>}
                                                    <span className="expiry-date">
                                                        iki {new Date(doc.valid_until).toLocaleDateString('lt-LT')}
                                                    </span>
                                                </div>
                                                <div className="key-doc-actions">
                                                    <a
                                                        href={`${API_BASE_URL}/uploads/${doc.file_path}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-doc-view"
                                                    >
                                                        Peržiūrėti
                                                    </a>
                                                    <button
                                                        className="btn-doc-delete"
                                                        onClick={() =>
                                                            setConfirmDelete({
                                                                type: "document",
                                                                id: doc.id
                                                            })
                                                        }
                                                    >
                                                        Pašalinti
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="key-doc-missing">
                                                <span className="missing-badge">⚠️ Trūksta</span>
                                                <p className="missing-text">Įkelkite dokumentą žemiau</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* OTHER DOCUMENTS SECTION */}
                <div className="details-section">
                    <div className="section-header">
                        <h2 className="section-title">📑 Kiti dokumentai</h2>
                        <p className="section-subtitle">Sutartys, sąskaitos ir kiti failai</p>
                    </div>

                    {otherDocuments.length > 0 ? (
                        <div className="other-documents-list">
                            {otherDocuments.map(doc => {
                                const status = getDocumentStatus(doc.valid_until);
                                return (
                                    <div key={doc.id} className="other-doc-item">
                                        <div className="other-doc-icon">📄</div>
                                        <div className="other-doc-content">
                                            <div className="other-doc-header">
                                                <span className="other-doc-type">{doc.doc_type}</span>
                                                {doc.valid_until && (
                                                    <span className={`other-doc-status status-${status}`}>
                                                        {status === "expired" && "❌ Baigėsi"}
                                                        {status === "expiring-soon" && "⚠️ Baigiasi"}
                                                        {status === "valid" && "✓ Galioja"}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="other-doc-title">{doc.title}</div>
                                            {doc.valid_until && (
                                                <div className="other-doc-date">
                                                    Galioja iki: {new Date(doc.valid_until).toLocaleDateString('lt-LT')}
                                                </div>
                                            )}
                                        </div>
                                        <div className="other-doc-actions">
                                            <a
                                                href={`${API_BASE_URL}/uploads/${doc.file_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-link"
                                            >
                                                Peržiūrėti
                                            </a>
                                            <button
                                                className="btn-danger-sm"
                                                onClick={() =>
                                                    setConfirmDelete({
                                                        type: "document",
                                                        id: doc.id
                                                    })
                                                }
                                            >
                                                Pašalinti
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="empty-state-small">
                            <p>Nėra kitų dokumentų</p>
                        </div>
                    )}
                </div>

                {/* UPLOAD DOCUMENT SECTION */}
                <div className="details-section">
                    <AddDocumentForm vehicleId={id} onUploaded={loadDocuments} />
                </div>

                {/* SERVICE HISTORY SECTION */}
                <div className="details-section">
                    <div className="section-header">
                        <h2 className="section-title">🔧 Serviso istorija</h2>
                        <button className="btn-primary" onClick={() => setShowServiceModal(true)}>
                            ➕ Pridėti servisą
                        </button>
                    </div>

                    {serviceRecords.length > 0 ? (
                        <div className="service-timeline">
                            {serviceRecords.map(rec => (
                                <div key={rec.id} className="service-timeline-item">
                                    <div className="service-timeline-dot"></div>
                                    <div className="service-timeline-content">
                                        <div className="service-timeline-header">
                                            <span className={`service-type-badge service-type-${rec.service_type}`}>
                                                {rec.service_type === "oil" && "🛢️ Tepalai"}
                                                {rec.service_type === "tires" && "🛞 Padangos"}
                                                {rec.service_type === "inspection" && "🔍 Apžiūra"}
                                                {rec.service_type === "other" && "🔧 Kita"}
                                            </span>
                                            <button
                                                className="btn-delete-icon"
                                                onClick={() =>
                                                    setConfirmDelete({
                                                        type: "service",
                                                        id: rec.id
                                                    })
                                                }
                                                title="Pašalinti"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                        <div className="service-timeline-meta">
                                            📅 {new Date(rec.performed_date).toLocaleDateString('lt-LT')} 
                                            • 🚗 {rec.performed_km?.toLocaleString('lt-LT')} km
                                            {rec.location && ` • 📍 ${rec.location}`}
                                        </div>
                                        {rec.notes && (
                                            <div className="service-timeline-notes">{rec.notes}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state-small">
                            <p>Nėra serviso įrašų</p>
                        </div>
                    )}
                </div>

                {/* SERVICE MODAL */}
                {showServiceModal && (
                    <AddServiceModal
                        vehicleId={id}
                        onClose={() => setShowServiceModal(false)}
                        onAdded={loadService}
                    />
                )}

                {/* CONFIRM DELETE MODAL */}
                {confirmDelete && (
                    <ConfirmModal
                        open={true}
                        title="Ar tikrai norite ištrinti?"
                        message={
                            confirmDelete.type === "document"
                                ? "Šis dokumentas bus visam laikui pašalintas."
                                : "Serviso įrašas bus negrįžtamai ištrintas."
                        }
                        onCancel={() => setConfirmDelete(null)}
                        onConfirm={async () => {
                            if (confirmDelete.type === "document") {
                                await fetch(`${API_BASE_URL}/api/documents/${confirmDelete.id}`, {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Bearer ${token}`,
                                    },
                                });
                                loadDocuments();
                            } else {
                                await fetch(`${API_BASE_URL}/api/service/${confirmDelete.id}`, {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Bearer ${token}`,
                                    },
                                });
                                loadService();
                            }

                            showToast("Sėkmingai ištrinta", "success");
                            setConfirmDelete(null);
                        }}
                    />
                )}

            </div>
        </DashboardLayout>
    );
}

export default VehicleDetailsPage;
