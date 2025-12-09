import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import VehiclesPage from "./pages/VehiclesPage";
import AddVehiclePage from "./pages/AddVehiclePage";
import EditVehiclePage from "./pages/EditVehiclePage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />

        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/vehicles/add" element={<AddVehiclePage />} />
        <Route path="/vehicles/edit/:id" element={<EditVehiclePage />} />
        <Route path="/vehicles/:id" element={<VehicleDetailsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
