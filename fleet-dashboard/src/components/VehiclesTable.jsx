function VehiclesTable() {
  return (
    <div className="card vehicles-table-card">
      <div className="card-header">
        <div>
          <div className="card-title">Automobilių sąrašas</div>
          <div className="card-sub">
            Statusas, nuvažiuoti kilometrai, šiandienos rida
          </div>
        </div>
      </div>

      <table className="vehicles-table">
        <thead>
          <tr>
            <th>Auto</th>
            <th>Statusas</th>
            <th>Šiandien</th>
            <th>Iš viso</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>BMW 530d</td>
            <td>
              <span className="status-tag status-online">Online</span>
            </td>
            <td>32 km</td>
            <td>1842 km</td>
          </tr>

          <tr>
            <td>Audi A4</td>
            <td>
              <span className="status-tag status-offline">Offline</span>
            </td>
            <td>0</td>
            <td>653 km</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default VehiclesTable;
