import { useState, useEffect } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";

function SettingsPage() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState("notifications");
  const [loading, setLoading] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    // Notifications
    notifications: {
      emailAlerts: true,
      documentExpiry: true,
      serviceReminders: true,
      vehicleOffline: true,
      weeklyReports: false,
    },
    // Display
    display: {
      language: "lt",
      timezone: "Europe/Vilnius",
      dateFormat: "DD/MM/YYYY",
      distanceUnit: "km",
    },
    // Map
    map: {
      defaultZoom: 13,
      trackHistory: 24,
      autoRefresh: true,
      refreshInterval: 10,
    },
  });

  // Load settings from API
  useEffect(() => {
    if (token) {
      loadSettings();
    }
  }, [token]);

  const loadSettings = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const saveSettings = async () => {
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        showToast("Nustatymai išsaugoti!", "success");
      } else {
        showToast("Nepavyko išsaugoti nustatymų", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Klaida saugant nustatymus", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle toggle changes
  const handleToggle = (category, setting) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [setting]: !settings[category][setting],
      },
    });
  };

  // Handle select/input changes
  const handleChange = (category, setting, value) => {
    setSettings({
      ...settings,
      [category]: {
        ...settings[category],
        [setting]: value,
      },
    });
  };

  return (
    <DashboardLayout>
      <div className="settings-page">
        {/* Page Header */}
        <div className="settings-header">
          <div>
            <h1 className="settings-page-title">Nustatymai</h1>
            <p className="settings-page-subtitle">
              Pritaikykite sistemą savo poreikiams
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={saveSettings}
            disabled={loading}
          >
            {loading ? "Išsaugoma..." : "💾 Išsaugoti pakeitimus"}
          </button>
        </div>

        {/* Tabs Navigation */}
        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === "notifications" ? "settings-tab-active" : ""}`}
            onClick={() => setActiveTab("notifications")}
          >
            🔔 Pranešimai
          </button>
          <button
            className={`settings-tab ${activeTab === "display" ? "settings-tab-active" : ""}`}
            onClick={() => setActiveTab("display")}
          >
            🎨 Vaizdas
          </button>
          <button
            className={`settings-tab ${activeTab === "map" ? "settings-tab-active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            🗺️ Žemėlapis
          </button>
          <button
            className={`settings-tab ${activeTab === "advanced" ? "settings-tab-active" : ""}`}
            onClick={() => setActiveTab("advanced")}
          >
            ⚙️ Išplėstiniai
          </button>
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="settings-section">
              <h2 className="settings-section-title">Pranešimų nustatymai</h2>
              <p className="settings-section-subtitle">
                Valdykite, kaip ir kada norite gauti pranešimus
              </p>

              <div className="settings-list">
                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">El. pašto įspėjimai</div>
                    <div className="settings-item-description">
                      Gaukite pranešimus į el. paštą apie svarbius įvykius
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notifications.emailAlerts}
                      onChange={() => handleToggle("notifications", "emailAlerts")}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Dokumentų galiojimas</div>
                    <div className="settings-item-description">
                      Įspėjimai apie besibaigiantį dokumentų galiojimą
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notifications.documentExpiry}
                      onChange={() => handleToggle("notifications", "documentExpiry")}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Serviso priminimai</div>
                    <div className="settings-item-description">
                      Priminimai apie artėjantį techninės priežiūros laiką
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notifications.serviceReminders}
                      onChange={() => handleToggle("notifications", "serviceReminders")}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Automobilio offline</div>
                    <div className="settings-item-description">
                      Pranešimai kai automobilis nebesiunčia duomenų
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notifications.vehicleOffline}
                      onChange={() => handleToggle("notifications", "vehicleOffline")}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Savaitinės ataskaitos</div>
                    <div className="settings-item-description">
                      Gauti savaitines naudojimo ataskaitas el. paštu
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.notifications.weeklyReports}
                      onChange={() => handleToggle("notifications", "weeklyReports")}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === "display" && (
            <div className="settings-section">
              <h2 className="settings-section-title">Vaizdo nustatymai</h2>
              <p className="settings-section-subtitle">
                Pritaikykite, kaip matote informaciją sistemoje
              </p>

              <div className="settings-grid">
                <div className="settings-field">
                  <label className="settings-field-label">Kalba</label>
                  <select
                    className="settings-select"
                    value={settings.display.language}
                    onChange={(e) => handleChange("display", "language", e.target.value)}
                  >
                    <option value="lt">Lietuvių</option>
                    <option value="en">English</option>
                    <option value="ru">Русский</option>
                  </select>
                </div>

                <div className="settings-field">
                  <label className="settings-field-label">Laiko juosta</label>
                  <select
                    className="settings-select"
                    value={settings.display.timezone}
                    onChange={(e) => handleChange("display", "timezone", e.target.value)}
                  >
                    <option value="Europe/Vilnius">Europe/Vilnius (GMT+2)</option>
                    <option value="Europe/London">Europe/London (GMT+0)</option>
                    <option value="America/New_York">America/New_York (GMT-5)</option>
                  </select>
                </div>

                <div className="settings-field">
                  <label className="settings-field-label">Datos formatas</label>
                  <select
                    className="settings-select"
                    value={settings.display.dateFormat}
                    onChange={(e) => handleChange("display", "dateFormat", e.target.value)}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div className="settings-field">
                  <label className="settings-field-label">Atstumo vienetai</label>
                  <select
                    className="settings-select"
                    value={settings.display.distanceUnit}
                    onChange={(e) => handleChange("display", "distanceUnit", e.target.value)}
                  >
                    <option value="km">Kilometrai (km)</option>
                    <option value="mi">Mylios (mi)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Map Tab */}
          {activeTab === "map" && (
            <div className="settings-section">
              <h2 className="settings-section-title">Žemėlapio nustatymai</h2>
              <p className="settings-section-subtitle">
                Konfigūruokite žemėlapio rodymo parinktis
              </p>

              <div className="settings-grid">
                <div className="settings-field">
                  <label className="settings-field-label">Numatytasis priartinimas</label>
                  <input
                    type="number"
                    className="settings-input"
                    value={settings.map.defaultZoom}
                    onChange={(e) => handleChange("map", "defaultZoom", parseInt(e.target.value))}
                    min="1"
                    max="20"
                  />
                  <small className="settings-field-hint">
                    1 (labai toli) - 20 (labai arti)
                  </small>
                </div>

                <div className="settings-field">
                  <label className="settings-field-label">Maršruto istorija (valandos)</label>
                  <input
                    type="number"
                    className="settings-input"
                    value={settings.map.trackHistory}
                    onChange={(e) => handleChange("map", "trackHistory", parseInt(e.target.value))}
                    min="1"
                    max="168"
                  />
                  <small className="settings-field-hint">
                    Kiek valandų maršrutų rodyti žemėlapyje
                  </small>
                </div>
              </div>

              <div className="settings-list" style={{ marginTop: "24px" }}>
                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Automatinis atnaujinimas</div>
                    <div className="settings-item-description">
                      Automatiškai atnaujinti automobilių pozicijas žemėlapyje
                    </div>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={settings.map.autoRefresh}
                      onChange={() => handleToggle("map", "autoRefresh")}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              {settings.map.autoRefresh && (
                <div className="settings-field" style={{ marginTop: "16px" }}>
                  <label className="settings-field-label">Atnaujinimo intervalas (sekundės)</label>
                  <input
                    type="number"
                    className="settings-input"
                    value={settings.map.refreshInterval}
                    onChange={(e) => handleChange("map", "refreshInterval", parseInt(e.target.value))}
                    min="5"
                    max="60"
                  />
                  <small className="settings-field-hint">
                    Kaip dažnai atnaujinti pozicijas (5-60 sekundžių)
                  </small>
                </div>
              )}
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === "advanced" && (
            <div className="settings-section">
              <h2 className="settings-section-title">Išplėstiniai nustatymai</h2>
              <p className="settings-section-subtitle">
                Papildomos funkcijos ir techniniai nustatymai
              </p>

              <div className="settings-list">
                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">API prieiga</div>
                    <div className="settings-item-description">
                      Generuokite API raktą duomenų eksportavimui ir integracijai
                    </div>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => showToast("API funkcija dar neįgyvendinta", "warning")}
                  >
                    Generuoti API raktą
                  </button>
                </div>

                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Duomenų eksportas</div>
                    <div className="settings-item-description">
                      Atsisiųsti visus savo duomenis CSV arba JSON formatu
                    </div>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => showToast("Eksporto funkcija dar neįgyvendinta", "warning")}
                  >
                    Eksportuoti duomenis
                  </button>
                </div>

                <div className="settings-item">
                  <div className="settings-item-content">
                    <div className="settings-item-title">Valyti talpyklą</div>
                    <div className="settings-item-description">
                      Išvalyti vietinę talpyklą ir atnaujinti duomenis
                    </div>
                  </div>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      localStorage.clear();
                      showToast("Talpykla išvalyta!", "success");
                      setTimeout(() => window.location.reload(), 1000);
                    }}
                  >
                    Valyti talpyklą
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export default SettingsPage;
