import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

function DashboardLayout({ children }) {
  const navigate = useNavigate();
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

  const handleUserMenuClick = (action) => {
    console.log("User menu:", action);
    setUserMenuOpen(false);

    if (action === "logout") {
      logout();
      showToast("Atsijungėte sėkmingai", "success");
      navigate("/");
    } else if (action === "profilis") {
      // TODO: Navigate to profile page
    } else if (action === "nustatymai") {
      // TODO: Navigate to settings page
    }
  };

  const handleSidebarItemClick = (target) => {
    console.log("Sidebar nav:", target);
    setSidebarOpen(false);

    if (target === "dashboard") {
      navigate("/dashboard");
    } else if (target === "vehicles") {
      navigate("/vehicles");
    } else if (target === "trips") {
      // kol kas niekur neveda, vėliau pridėsim
    } else if (target === "alerts") {
    } else if (target === "reports") {
    } else if (target === "settings") {
    } else if (target === "logout") {
      logout();
      showToast("Atsijungėte sėkmingai", "success");
      navigate("/");
    }
  };

  // Uždaryti dropdown ir sidebar paspaudus šalia arba ESC
  useEffect(() => {
    function handleClickOutside(e) {
      // user dropdown
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
      // sidebar
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
      {/* ŠONINIS MENIU (sidebar) */}
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
                className="sidebar-item sidebar-item-active"
                onClick={() => handleSidebarItemClick("dashboard")}
              >
                Dashboard
              </button>
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("vehicles")}
              >
                Transporto priemonės
              </button>
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("trips")}
              >
                Kelionių istorija
              </button>
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("alerts")}
              >
                Įspėjimai
              </button>
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("reports")}
              >
                Ataskaitos
              </button>
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-label">Vartotojas</div>
              <button
                type="button"
                className="sidebar-item"
                onClick={() => handleSidebarItemClick("settings")}
              >
                Nustatymai
              </button>
              <button
                type="button"
                className="sidebar-item sidebar-item-danger"
                onClick={() => handleSidebarItemClick("logout")}
              >
                Atsijungti
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* VIRŠUTINĖ JUOSTA */}
      <header className="topbar">
        {/* Kairė – burger + pavadinimas */}
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
            <div className="topbar-title">Transporto stebėjimo sistema</div>
            <div className="topbar-sub">Pagrindinis valdymo skydelis</div>
          </div>
        </div>

        {/* Dešinė – serverio statusas + vartotojo meniu */}
        <div className="topbar-right">
          <span className="status-dot"></span>
          <span>Serveris online</span>

          <div className="user-menu-wrapper" ref={userMenuRef}>
            <button
              className="user-info"
              type="button"
              onClick={toggleUserMenu}
            >
              <div className="user-avatar">{userName.charAt(0).toUpperCase()}</div>
              <div className="user-text">
                <div className="user-name">{userName}</div>
                <div className="user-role">Naudotojas</div>
              </div>
            </button>

            {userMenuOpen && (
              <div className="user-menu-dropdown">
                <div style={{ padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', fontSize: '12px', color: 'var(--text-muted)' }}>
                  {userEmail}
                </div>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => handleUserMenuClick("profilis")}
                >
                  Profilis
                </button>
                <button
                  type="button"
                  className="user-menu-item"
                  onClick={() => handleUserMenuClick("nustatymai")}
                >
                  Nustatymai
                </button>
                <div className="user-menu-separator" />
                <button
                  type="button"
                  className="user-menu-item user-menu-danger"
                  onClick={() => handleUserMenuClick("logout")}
                >
                  Atsijungti
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}

export default DashboardLayout;
