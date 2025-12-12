import { useParams } from "react-router-dom";
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


    if (loading) return <DashboardLayout>Kraunama...</DashboardLayout>;
    if (!vehicle) return <DashboardLayout>Automobilis nerastas.</DashboardLayout>;

    const statusClass =
        vehicle.status === "online"
            ? "vehicle-status-badge vehicle-status-online"
            : vehicle.status === "warning"
                ? "vehicle-status-badge vehicle-status-warn"
                : "vehicle-status-badge vehicle-status-offline";

    return (
        <DashboardLayout>
            <div className="vehicle-details-container">

                {/* PAVADINIMAS */}
                <h1 className="vehicle-details-title">
                    {vehicle.brand} {vehicle.model} ({vehicle.plate})
                </h1>

                {/* TOPBAR: PAGRINDINĖ INFO + BŪSENA */}
                <div className="vehicle-details-topbar">
                    <div className="vehicle-details-section vehicle-info-section">
                        <div className="vehicle-section-title">Pagrindinė informacija</div>

                        <div className="vehicle-info-grid">
                            <div className="vehicle-info-item">
                                <div className="vehicle-info-label">Pavadinimas:</div>
                                <div className="vehicle-info-value">{vehicle.custom_name}</div>
                            </div>

                            <div className="vehicle-info-item">
                                <div className="vehicle-info-label">FMB130 serija:</div>
                                <div className="vehicle-info-value">{vehicle.fmb_serial}</div>
                            </div>

                            <div className="vehicle-info-item">
                                <div className="vehicle-info-label">IMEI:</div>
                                <div className="vehicle-info-value">{vehicle.imei || "nenurodytas"}</div>
                            </div>

                            <div className="vehicle-info-item">
                                <div className="vehicle-info-label">Sukurta:</div>
                                <div className="vehicle-info-value">
                                    {vehicle.created_at?.split("T")[0]}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="vehicle-details-section vehicle-status-section">
                        <div className="vehicle-section-title">Būsena</div>

                        <div className="vehicle-status-grid">
                            <div className="vehicle-info-item">
                                <div className="vehicle-info-label">Statusas:</div>
                                <span className={statusClass}>{vehicle.status}</span>
                            </div>

                            <div className="vehicle-info-item">
                                <div className="vehicle-info-label">Rida:</div>
                                <div className="vehicle-info-value">{vehicle.total_km ?? "-"} km</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MAP SECTION */}
                <div className="vehicle-details-section">
                    <MapComponent 
                        vehicleId={id} 
                        vehicleImei={vehicle.imei || vehicle.fmb_serial}
                        token={token}
                    />
                </div>

                {/* DOKUMENTAI */}
                <div className="vehicle-details-section">
                    <div className="vehicle-section-title">Dokumentai</div>

                    <div className="documents-area">
                        <div className="documents-list">
                            {documents.length === 0 ? (
                                <p className="empty-doc-text">Nėra pridėtų dokumentų.</p>
                            ) : (
                                documents.map(doc => (
                                    <div key={doc.id} className="document-card">

                                        <div className="document-info">
                                            <b>{doc.doc_type}</b> — {doc.title}
                                            <div className="doc-date">
                                                Galioja iki: {doc.valid_until || "Nenurodyta"}
                                            </div>
                                        </div>

                                        <div className="document-actions">
                                            <a
                                                href={`${API_BASE_URL}/uploads/${doc.file_path}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-link"
                                            >
                                                Peržiūrėti
                                            </a>

                                            <button
                                                className="btn-danger"
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
                                ))
                            )}
                        </div>

                        <AddDocumentForm vehicleId={id} onUploaded={loadDocuments} />
                    </div>
                </div>

                {/* SERVISO ISTORIJA */}
                <div className="vehicle-details-section">
                    <div className="vehicle-section-title">
                        Serviso istorija
                        <button className="btn-primary" onClick={() => setShowServiceModal(true)}>
                            + Pridėti servisą
                        </button>
                    </div>

                    <div className="service-list">
                        {serviceRecords.length === 0 ? (
                            <p>Nėra serviso įrašų.</p>
                        ) : (
                            serviceRecords.map(rec => (
                                <div key={rec.id} className="service-card">

                                    <div className="service-top">
                                        <span className={`service-badge service-${rec.service_type}`}>
                                            {rec.service_type.toUpperCase()}
                                        </span>

                                        <button
                                            className="btn-danger-sm"
                                            onClick={() =>
                                                setConfirmDelete({
                                                    type: "service",
                                                    id: rec.id
                                                })
                                            }
                                        >
                                            Pašalinti
                                        </button>
                                    </div>

                                    <div className="service-meta">
                                        Atlikta: {rec.performed_date} • Rida: {rec.performed_km} km
                                        {rec.location && <> • {rec.location}</>}
                                    </div>

                                    {rec.notes && (
                                        <div className="service-notes">{rec.notes}</div>
                                    )}

                                </div>
                            ))
                        )}
                    </div>
                </div>

                {showServiceModal && (
                    <AddServiceModal
                        vehicleId={id}
                        onClose={() => setShowServiceModal(false)}
                        onAdded={loadService}
                    />
                )}
            </div>

            {/* -------- CONFIRM DELETE MODAL -------- */}
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

        </DashboardLayout>
    );
}

export default VehicleDetailsPage;
