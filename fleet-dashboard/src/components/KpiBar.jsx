function KpiBar() {
  return (
    <div className="kpi-row">
      <div className="kpi-card">
        <div className="kpi-label">Aktyvūs automobiliai</div>
        <div className="kpi-value">7</div>
        <div className="kpi-sub">iš 9 prisijungusių</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Offline</div>
        <div className="kpi-value">2</div>
        <div className="kpi-sub">Paskutinis ryšys prieš 1 val.</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Šiandien nuvažiuota</div>
        <div className="kpi-value">42.3</div>
        <div className="kpi-sub">Visų automobilių suma</div>
      </div>

      <div className="kpi-card">
        <div className="kpi-label">Įspėjimai</div>
        <div className="kpi-value">3</div>
        <div className="kpi-sub">Tepalai, RPM, sutarties pabaiga</div>
      </div>
    </div>
  );
}

export default KpiBar;
