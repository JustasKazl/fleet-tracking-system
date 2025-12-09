import { useState } from "react";
import { useToast } from "../context/ToastContext";

function AddDocumentForm({ vehicleId, onUploaded }) {
    const { showToast } = useToast();
    const [docType, setDocType] = useState("");
    const [title, setTitle] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [file, setFile] = useState(null);

    async function handleUpload(e) {
        e.preventDefault();

        if (!file) {
            showToast("Pasirinkite failą", "error");
            return;
        }

        const form = new FormData();
        form.append("doc_type", docType);
        form.append("title", title);
        form.append("valid_until", validUntil);
        form.append("file", file);

        const res = await fetch(`http://localhost:5000/api/vehicles/${vehicleId}/documents`, {
            method: "POST",
            body: form,
        });

        if (res.ok) {
            showToast("Dokumentas įkeltas!", "success");
            onUploaded();
            setDocType("");
            setTitle("");
            setValidUntil("");
            setFile(null);
        } else {
            showToast("Nepavyko įkelti", "error");
        }
    }

    return (
        <div className="doc-upload-box">
            <h3>Pridėti dokumentą</h3>

            <form onSubmit={handleUpload} className="doc-form">
                <select value={docType} onChange={e => setDocType(e.target.value)}>
                    <option value="">Pasirinkite tipą...</option>
                    <option>Draudimas</option>
                    <option>Techninė apžiūra</option>
                    <option>Registracijos liudijimas</option>
                    <option>Sutartis</option>
                    <option>Kita</option>
                </select>

                <input
                    placeholder="Pavadinimas"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                />

                <label>Galiojimo data</label>
                <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />

                <label>Failas:</label>
                <input
                    type="file"
                    accept="application/pdf, image/jpeg, image/jpg, image/png"
                    onChange={(e) => setFile(e.target.files[0])}
                />

                <button className="btn-primary full" type="submit">Įkelti dokumentą</button>
            </form>
        </div>
    );
}

export default AddDocumentForm;
