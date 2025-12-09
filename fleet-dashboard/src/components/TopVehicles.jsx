function TopVehicles() {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">Daugiausiai pravažiavę</div>
        <div className="card-sub">Šios savaitės TOP3</div>
      </div>

      <div className="top-list">
        <div className="top-item">
          <span>BMW 530d</span>
          <span>183 km</span>
        </div>

        <div className="top-item">
          <span>Golf 2010</span>
          <span>162 km</span>
        </div>

        <div className="top-item">
          <span>Tesla 3</span>
          <span>145 km</span>
        </div>
      </div>
    </div>
  );
}

export default TopVehicles;
