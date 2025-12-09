import { useState } from "react";
import { useToast } from "../context/ToastContext";

function AddServiceModal({ vehicleId, onClose, onAdded }) {
    const { showToast } = useToast();

    const [serviceType, setServiceType] = useState("");
    const [date, setDate] = useState("");
    const [km, setKm] = useState("");
    const [location, setLocation] = useState("");
    const [notes, setNotes] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();

        if (!serviceType || !date || !km) {
            showToast("Užpildykite privalomus laukus!", "error");
            return;
        }

        const payload = {
            service_type: serviceType,
            performed_date: date,
            performed_km: km,
            location,
            notes,
        };

        const res = await fetch(`http://localhost:5000/api/vehicles/${vehicleId}/service`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (res.ok) {
            showToast("Serviso įrašas pridėtas", "success");
            onAdded();   // Reload service records
            onClose();   // Close modal
        } else {
            showToast("Nepavyko pridėti serviso įrašo", "error");
        }
    }

    return (
        <div className="modal-overlay">
            <div className="modal-card">
                <h2>Pridėti serviso įrašą</h2>

                <form onSubmit={handleSubmit} className="modal-form">

                    <div className="form-field">
                        <label>Serviso tipas *</label>
                        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
                            <option value="">Pasirinkite...</option>
                            <option value="oil">Tepalų keitimas</option>
                            <option value="tires">Padangų keitimas</option>
                            <option value="inspection">Techninė apžiūra</option>
                            <option value="other">Kita</option>
                        </select>
                    </div>

                    <div className="form-field">
                        <label>Atlikimo data *</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>

                    <div className="form-field">
                        <label>Rida (km) *</label>
                        <input
                            type="number"
                            value={km}
                            onChange={(e) => setKm(e.target.value)}
                            min="0"
                        />
                    </div>

                    <div className="form-field">
                        <label>Lokacija (nebūtina)</label>
                        <input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="Serviso vieta"
                        />
                    </div>

                    <div className="form-field">
                        <label>Pastabos</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Papildoma informacija..."
                        />
                    </div>

                    <div className="modal-buttons">
                        <button type="button" className="btn-ghost" onClick={onClose}>
                            Atšaukti
                        </button>

                        <button type="submit" className="btn-primary">
                            Išsaugoti
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}

export default AddServiceModal;
