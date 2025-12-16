import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/Dashboard";
import VehiclesPage from "./pages/VehiclesPage";
import VehicleDetailsPage from "./pages/VehicleDetailsPage";
import TripsHistoryPage from "./pages/TripsHistoryPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";

function ProtectedRoute({ children }) {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <div className="loading-page">Kraunama...</div>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/" replace />;
    }

    return children;
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    {/* Public - Landing with login/register popups */}
                    <Route path="/" element={<LandingPage />} />

                    {/* Protected Routes */}
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
                    
                    {/* Vehicles */}
                    <Route path="/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
                    <Route path="/vehicles/:id" element={<ProtectedRoute><VehicleDetailsPage /></ProtectedRoute>} />
                    
                    {/* Trips */}
                    <Route path="/trips" element={<ProtectedRoute><TripsHistoryPage /></ProtectedRoute>} />
                    
                    {/* User */}
                    <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
