function AlertsPanel() {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Naujiausi įspėjimai</div>
          <div className="card-sub">Paskutinės 24 val.</div>
        </div>
      </div>

      <div className="alert-list">
        <div className="alert-item">
          <span className="alert-dot bad"></span>
          <div className="alert-main">
            <div className="alert-title">Audi A4 – Offline</div>
            <div className="alert-meta">Ryšys nutrūko prieš 2h</div>
          </div>
          <div className="alert-time">2h</div>
        </div>

        <div className="alert-item">
          <span className="alert-dot warn"></span>
          <div className="alert-main">
            <div className="alert-title">Toyota Yaris – Tepalai</div>
            <div className="alert-meta">Liko 600 km</div>
          </div>
          <div className="alert-time">1h</div>
        </div>
      </div>
    </div>
  );
}

export default AlertsPanel;
