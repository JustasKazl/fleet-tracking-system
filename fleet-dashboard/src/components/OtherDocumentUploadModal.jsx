import { useState } from "react";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../api";

function DocumentUploadModal({ vehicleId, documentType, onClose, onSuccess }) {
    const { showToast } = useToast();
    const { token } = useAuth();

    const [title, setTitle] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Get icon for document type
    const getDocumentIcon = () => {
        switch (documentType) {
            case "Draudimas": return "🛡️";
            case "Techninė apžiūra": return "🔧";
            case "Registracijos liudijimas": return "📋";
            default: return "📄";
        }
    };

    async function handleSubmit(e) {
        e.preventDefault();

        if (!file) {
            showToast("Pasirinkite failą", "error");
            return;
        }

        if (!title.trim()) {
            showToast("Įveskite dokumento pavadinimą", "error");
            return;
        }

        if (!validUntil) {
            showToast("Pasirinkite galiojimo datą", "error");
            return;
        }

        // Validate file type (PDF or images)
        const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
        if (!allowedTypes.includes(file.type)) {
            showToast("Leidžiami tik PDF, JPG arba PNG failai", "error");
            return;
        }

        // Validate file size (max 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            showToast("Failas per didelis (maks. 10MB)", "error");
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append("doc_type", documentType);
        formData.append("title", title.trim());
        formData.append("valid_until", validUntil);
        formData.append("file", file);

        try {
            const res = await fetch(`${API_BASE_URL}/api/vehicles/${vehicleId}/documents`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                },
                body: formData,
            });

            if (res.ok) {
                showToast("Dokumentas sėkmingai įkeltas!", "success");
                onSuccess();
                onClose();
            } else {
                const errorData = await res.json();
                showToast(errorData.error || "Nepavyko įkelti dokumento", "error");
            }
        } catch (err) {
            console.error(err);
            showToast("Klaida įkeliant dokumentą", "error");
        } finally {
            setUploading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {getDocumentIcon()} Įkelti: {documentType}
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
                    <div className="form-field">
                        <label>Dokumento pavadinimas *</label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={`Pvz: ${documentType} 2025`}
                            required
                            disabled={uploading}
                        />
                    </div>

                    <div className="form-field">
                        <label>Galioja iki *</label>
                        <input
                            type="date"
                            value={validUntil}
                            onChange={(e) => setValidUntil(e.target.value)}
                            required
                            disabled={uploading}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>

                    <div className="form-field">
                        <label>Failas (PDF, JPG, PNG) *</label>
                        <input
                            type="file"
                            accept="application/pdf,image/jpeg,image/jpg,image/png"
                            onChange={(e) => setFile(e.target.files[0])}
                            required
                            disabled={uploading}
                        />
                        {file && (
                            <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>
                                📎 {file.name} ({(file.size / 1024).toFixed(0)} KB)
                            </div>
                        )}
                    </div>

                    <div className="modal-buttons">
                        <button
                            type="button"
                            className="btn-ghost"
                            onClick={onClose}
                            disabled={uploading}
                        >
                            Atšaukti
                        </button>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={uploading}
                        >
                            {uploading ? "Įkeliama..." : "📤 Įkelti dokumentą"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default DocumentUploadModal;
