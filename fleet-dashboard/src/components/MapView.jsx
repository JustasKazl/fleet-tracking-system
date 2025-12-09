function MapView() {
  return (
    <div className="card map-card">
      <div className="card-header">
        <div>
          <div className="card-title">Žemėlapis</div>
          <div className="card-sub">
            Visų automobilių pozicijos • galimybė padidinti per visą ekraną
          </div>
        </div>
        <button className="chip" type="button">
          Padidinti
        </button>
      </div>

      <div className="map-placeholder">
        Žemėlapio zona (prototipas)
        <div className="map-marker" />
        <div className="map-marker" />
        <div className="map-marker" />
      </div>
    </div>
  );
}

export default MapView;
