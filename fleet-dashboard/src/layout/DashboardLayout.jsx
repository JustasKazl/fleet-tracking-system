import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import ServerStatus from "../components/ServerStatus";

function DashboardLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userMenuRef = useRef(null);
  const sidebarRef = useRef(null);

  const toggleUserMenu = () => {
    setUserMenuOpen((prev) => !prev);
  };

  const toggleSidebar = () => {
    setSidebarOpen((prev) => !prev);
  };

  // Helper function to check if a route is active
  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  // Check if on main vehicles list page only
  const isVehiclesListPage = location.pathname === "/vehicles";

  const handleUserMenuClick = (action) => {
    setUserMenuOpen(false);

    if (action === "logout") {
      logout();
      showToast("Atsijungėte sėkmingai", "success");
      navigate("/");
    } else if (action === "profilis") {
      navigate("/profile")
    } else if (action === "nustatymai") {
      navigate("/settings")
    }
  };

  const handleSidebarItemClick = (target) => {
    setSidebarOpen(false);

    if (target === "dashboard") {
      navigate("/dashboard");
    } else if (target === "vehicles") {
      navigate("/vehicles");
    } else if (target === "trips") {
      navigate("/trips");
    } else if (target === "alerts") {
      navigate("/alerts");
    } else if (target === "reports") {
      showToast("Nebaigta - netrukus bus prieinamas", "warning");
    } else if (target === "settings") {
      navigate("/settings");
    } else if (target === "logout") {
      logout();
      showToast("Atsijungėte sėkmingai", "success");
      navigate("/");
    }
  };

  // Close dropdown and sidebar on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target) &&
        !(e.target.closest && e.target.closest(".burger"))
      ) {
        setSidebarOpen(false);
      }
    }

    function handleEsc(e) {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setSidebarOpen(false);
      }
    }

    if (userMenuOpen || sidebarOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEsc);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [userMenuOpen, sidebarOpen]);

  const userName = user?.name || "Vartotojas";
  const userEmail = user?.email || "";

  return (
    <div className="page">
      {/* SIDEBAR WITH ACTIVE STATE */}
      {sidebarOpen && (
        <div className="sidebar-backdrop">
          <nav className="sidebar" ref={sidebarRef}>
            <div className="sidebar-header">
              <div className="sidebar-title">Meniu</div>
              <button
                type="button"
                className="sidebar-close"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-label">Puslapiai</div>
              
              <button
                type="button"
                className={`sidebar-item ${isActive("/dashboard") ? "sidebar-item-active" : ""}`}
                onClick={() => handleSidebarItemClick("dashboard")}
              >
                📊 Dashboard
              </button>
              
              <button
                type="button"
                className={`sidebar-item ${isVehiclesListPage ? "sidebar-item-active" : ""}`}
                onClick={() => handleSidebarItemClick("vehicles")}
              >
                🚗 Transporto priemonės
              </button>
              
              <button
                type="button"
                className={`sidebar-item ${isActive("/trips") ? "sidebar-item-active" : ""}`}
                onClick={() => handleSidebarItemClick("trips")}
              >
                📍 Kelionių istorija
              </button>
              
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("alerts")}
              >
                🔔 Įspėjimai
              </button>
              
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("reports")}
              >
                📈 Ataskaitos
              </button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-label">Vartotojas</div>
              
              <button
                type="button"
                className={`sidebar-item ${isActive("/settings") ? "sidebar-item-active" : ""}`}
                onClick={() => handleSidebarItemClick("settings")}
              >
                ⚙️ Nustatymai
              </button>
              
              <button
                type="button"
                className="sidebar-item sidebar-item-danger"
                onClick={() => handleSidebarItemClick("logout")}
              >
                🚪 Atsijungti
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* TOPBAR */}
      <header className="topbar">
        {/* LEFT SIDE */}
        <div className="topbar-left">
          <button
            type="button"
            className="burger"
            onClick={toggleSidebar}
          >
            <div className="burger-line" />
            <div className="burger-line" />
            <div className="burger-line" />
          </button>

          <div className="topbar-main">
            <div className="topbar-title">FleetTrack</div>
            <div className="topbar-sub">
              {location.pathname === "/dashboard" && "Pagrindinis valdymo skydelis"}
              {location.pathname === "/vehicles" && "Transporto priemonių sąrašas"}
              {location.pathname === "/vehicles/add" && "Pridėti naują automobilį"}
              {location.pathname.includes("/vehicles/edit/") && "Redaguoti automobilį"}
              {location.pathname.includes("/vehicles/") && !location.pathname.includes("/edit") && location.pathname !== "/vehicles/add" && "Transporto priemonės detalės"}
              {location.pathname === "/trips" && "Kelionių istorija"}
              {location.pathname === "/profile" && "Profilio nustatymai"}
              {location.pathname === "/settings" && "Sistemos nustatymai"}
              {!location.pathname.startsWith("/vehicles") && !location.pathname.startsWith("/dashboard") && !location.pathname.startsWith("/profile") && !location.pathname.startsWith("/settings") && "Valdymo skydelis"}
            </div>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="topbar-right">
          {/* SERVER STATUS INDICATOR */}
          <ServerStatus />

          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              className="user-info"
              type="button"
              onClick={toggleUserMenu}
            >
              <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
              <div className="user-text">
                <div className="user-name">{userName}</div>
                <div className="user-role">Vartotojas</div>
              </div>
            </button>

            {userMenuOpen && (
              <div className="user-menu-dropdown">
                <div className="user-menu-email">{userEmail}</div>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => handleUserMenuClick("profilis")}
                >
                  👤 Profilis
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => handleUserMenuClick("nustatymai")}
                >
                  ⚙️ Nustatymai
                </button>
                <div className="user-menu-separator" />
                <button
                  type="button"
                  className="user-menu-item user-menu-danger"
                  onClick={() => handleUserMenuClick("logout")}
                >
                  🚪 Atsijungti
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* PAGE CONTENT */}
      {children}
    </div>
  );
}

export default DashboardLayout;
