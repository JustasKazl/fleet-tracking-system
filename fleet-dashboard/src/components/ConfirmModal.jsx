function ConfirmModal({ open, title, message, onConfirm, onCancel }) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal-window" onClick={(e) => e.stopPropagation()}>
        
        <h2 className="modal-title">{title}</h2>
        <p className="modal-message">{message}</p>

        <div className="modal-buttons">
          <button className="btn-danger" onClick={onConfirm}>
            Taip, ištrinti
          </button>
          <button className="btn-ghost" onClick={onCancel}>
            Atšaukti
          </button>
        </div>

      </div>
    </div>
  );
}

export default ConfirmModal;
