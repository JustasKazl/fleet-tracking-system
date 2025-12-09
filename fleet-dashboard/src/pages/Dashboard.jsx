import DashboardLayout from "../layout/DashboardLayout";
import KpiBar from "../components/KpiBar";
import AlertsPanel from "../components/AlertsPanel";
import TopVehicles from "../components/TopVehicles";
import VehiclesTable from "../components/VehiclesTable";
import MapView from "../components/MapView";




function Dashboard() {
  return (
    <DashboardLayout>
      <KpiBar />

      {/* Kairė: įspėjimai + TOP3 + lentelė, dešinė: žemėlapis */}
      <div className="row row-main">
        {/* KAIRĖ KOLUMNA */}
        <div className="left-column">
          {/* Viršuje: Naujiausi įspėjimai + Daugiausiai pravažiavę */}
          <div className="row row-left-top">
            <AlertsPanel />
            <TopVehicles />
          </div>

          {/* Apačioje: automobilių sąrašas per visą kairę pusę */}
            <div className="vehicles-table-wrapper">
                 <VehiclesTable />
            </div>

        </div>

        {/* DEŠINĖ: žemėlapis per visą šitos eilės aukštį */}
        <MapView />
      </div>
    </DashboardLayout>
  );
}

export default Dashboard;
