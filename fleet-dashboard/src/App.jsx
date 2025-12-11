import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import VehiclesPage from "./pages/VehiclesPage";
import AddVehiclePage from "./pages/AddVehiclePage";
import EditVehiclePage from "./pages/EditVehiclePage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/Privacy";

function App() {
  // TODO: Replace with real authentication check
  const isAuthenticated = false;

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Protected Routes - Redirect to landing if not authenticated */}
        <Route 
          path="/dashboard" 
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/vehicles" 
          element={isAuthenticated ? <VehiclesPage /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/vehicles/add" 
          element={isAuthenticated ? <AddVehiclePage /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/vehicles/edit/:id" 
          element={isAuthenticated ? <EditVehiclePage /> : <Navigate to="/" replace />} 
        />
        <Route 
          path="/vehicles/:id" 
          element={isAuthenticated ? <VehicleDetailsPage /> : <Navigate to="/" replace />} 
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
