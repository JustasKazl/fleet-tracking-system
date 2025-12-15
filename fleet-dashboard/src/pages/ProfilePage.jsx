import { useState } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";

function ProfilePage() {
  const { user, token } = useAuth();
  const { showToast } = useToast();

  // Profile form state
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    company: user?.company || "",
    phone: user?.phone || "",
  });

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [loading, setLoading] = useState(false);

  // Handle profile update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: profileData.name,
          company: profileData.company,
          phone: profileData.phone,
        }),
      });

      if (res.ok) {
        showToast("Profilis atnaujintas sėkmingai!", "success");
        setIsEditing(false);
      } else {
        const error = await res.json();
        showToast(error.error || "Nepavyko atnaujinti profilio", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Klaida atnaujinant profilį", "error");
    } finally {
      setLoading(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async (e) => {
    e.preventDefault();

    // Validation
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showToast("Užpildykite visus laukus", "error");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("Nauji slaptažodžiai nesutampa", "error");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showToast("Naujas slaptažodis turi būti bent 6 simbolių", "error");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (res.ok) {
        showToast("Slaptažodis pakeistas sėkmingai!", "success");
        setShowPasswordForm(false);
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const error = await res.json();
        showToast(error.error || "Nepavyko pakeisti slaptažodžio", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Klaida keičiant slaptažodį", "error");
    } finally {
      setLoading(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setProfileData({
      name: user?.name || "",
      email: user?.email || "",
      company: user?.company || "",
      phone: user?.phone || "",
    });
    setIsEditing(false);
  };

  return (
    <DashboardLayout>
      <div className="profile-page">
        {/* Page Header */}
        <div className="profile-header">
          <div className="profile-header-content">
            <div className="profile-avatar-large">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="profile-header-text">
              <h1 className="profile-page-title">Mano profilis</h1>
              <p className="profile-page-subtitle">
                Valdykite savo paskyros informaciją ir nustatymus
              </p>
            </div>
          </div>
        </div>

        <div className="profile-content">
          {/* Profile Information Card */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div>
                <h2 className="profile-card-title">👤 Asmeninė informacija</h2>
                <p className="profile-card-subtitle">
                  Atnaujinkite savo profilio duomenis
                </p>
              </div>
              {!isEditing ? (
                <button
                  className="btn-ghost"
                  onClick={() => setIsEditing(true)}
                >
                  ✏️ Redaguoti
                </button>
              ) : null}
            </div>

            <form onSubmit={handleProfileUpdate} className="profile-form">
              <div className="form-row">
                <div className="form-field">
                  <label>Vardas ir pavardė *</label>
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) =>
                      setProfileData({ ...profileData, name: e.target.value })
                    }
                    disabled={!isEditing || loading}
                    required
                  />
                </div>

                <div className="form-field">
                  <label>El. paštas</label>
                  <input
                    type="email"
                    value={profileData.email}
                    disabled
                    style={{ opacity: 0.6, cursor: "not-allowed" }}
                  />
                  <small style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    ℹ️ El. pašto keisti negalima
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-field">
                  <label>Įmonė</label>
                  <input
                    type="text"
                    value={profileData.company}
                    onChange={(e) =>
                      setProfileData({ ...profileData, company: e.target.value })
                    }
                    disabled={!isEditing || loading}
                    placeholder="UAB Pavyzdys"
                  />
                </div>

                <div className="form-field">
                  <label>Telefonas</label>
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) =>
                      setProfileData({ ...profileData, phone: e.target.value })
                    }
                    disabled={!isEditing || loading}
                    placeholder="+370 600 00000"
                  />
                </div>
              </div>

              {isEditing && (
                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={handleCancelEdit}
                    disabled={loading}
                  >
                    Atšaukti
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Išsaugoma..." : "💾 Išsaugoti pakeitimus"}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Password Change Card */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div>
                <h2 className="profile-card-title">🔒 Slaptažodis</h2>
                <p className="profile-card-subtitle">
                  Pakeiskite savo prisijungimo slaptažodį
                </p>
              </div>
              {!showPasswordForm ? (
                <button
                  className="btn-ghost"
                  onClick={() => setShowPasswordForm(true)}
                >
                  🔑 Keisti slaptažodį
                </button>
              ) : null}
            </div>

            {showPasswordForm && (
              <form onSubmit={handlePasswordChange} className="profile-form">
                <div className="form-field">
                  <label>Dabartinis slaptažodis *</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) =>
                      setPasswordData({
                        ...passwordData,
                        currentPassword: e.target.value,
                      })
                    }
                    disabled={loading}
                    required
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-row">
                  <div className="form-field">
                    <label>Naujas slaptažodis *</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          newPassword: e.target.value,
                        })
                      }
                      disabled={loading}
                      required
                      minLength={6}
                      placeholder="••••••••"
                    />
                    <small style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                      Mažiausiai 6 simboliai
                    </small>
                  </div>

                  <div className="form-field">
                    <label>Pakartokite naują slaptažodį *</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) =>
                        setPasswordData({
                          ...passwordData,
                          confirmPassword: e.target.value,
                        })
                      }
                      disabled={loading}
                      required
                      minLength={6}
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="profile-form-actions">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPasswordData({
                        currentPassword: "",
                        newPassword: "",
                        confirmPassword: "",
                      });
                    }}
                    disabled={loading}
                  >
                    Atšaukti
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Keičiama..." : "🔑 Pakeisti slaptažodį"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Account Information Card */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div>
                <h2 className="profile-card-title">📋 Paskyros informacija</h2>
                <p className="profile-card-subtitle">
                  Peržiūrėkite savo paskyros detales
                </p>
              </div>
            </div>

            <div className="profile-info-grid">
              <div className="profile-info-item">
                <div className="profile-info-label">Paskyra sukurta</div>
                <div className="profile-info-value">
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("lt-LT", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "-"}
                </div>
              </div>

              <div className="profile-info-item">
                <div className="profile-info-label">Paskutinis prisijungimas</div>
                <div className="profile-info-value">
                  {user?.last_login
                    ? new Date(user.last_login).toLocaleDateString("lt-LT", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Dabar"}
                </div>
              </div>

              <div className="profile-info-item">
                <div className="profile-info-label">Paskyros tipas</div>
                <div className="profile-info-value">
                  <span className="account-type-badge">Free</span>
                </div>
              </div>

              <div className="profile-info-item">
                <div className="profile-info-label">Vartotojo ID</div>
                <div className="profile-info-value" style={{ fontFamily: "monospace", fontSize: "12px" }}>
                  {user?.id || "-"}
                </div>
              </div>
            </div>
          </div>

          {/* Danger Zone Card */}
          <div className="profile-card profile-card-danger">
            <div className="profile-card-header">
              <div>
                <h2 className="profile-card-title">⚠️ Pavojinga zona</h2>
                <p className="profile-card-subtitle">
                  Negrįžtami veiksmai su paskyra
                </p>
              </div>
            </div>

            <div className="danger-zone-content">
              <div className="danger-zone-item">
                <div>
                  <div className="danger-zone-title">Ištrinti paskyrą</div>
                  <div className="danger-zone-text">
                    Visam laikui pašalinti paskyrą ir visus duomenis. Šis veiksmas
                    negrįžtamas.
                  </div>
                </div>
                <button
                  className="btn-danger"
                  onClick={() =>
                    showToast(
                      "Paskyros šalinimas dar neįgyvendintas",
                      "warning"
                    )
                  }
                >
                  Ištrinti paskyrą
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default ProfilePage;
