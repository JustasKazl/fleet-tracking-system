import { createContext, useContext, useState, useEffect } from "react";
import API_BASE_URL from "../api";

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load token from localStorage on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("authToken");
    if (storedToken) {
      setToken(storedToken);
      // Verify token by fetching user data
      verifyToken(storedToken);
    } else {
      setLoading(false);
    }
  }, []);

  async function verifyToken(authToken) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        // Token expired or invalid
        localStorage.removeItem("authToken");
        setToken(null);
      }
    } catch (err) {
      console.error("Token verification failed:", err);
    } finally {
      setLoading(false);
    }
  }

  async function register(email, password, name, company) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name, company }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return { ok: false };
      }

      // Save token
      localStorage.setItem("authToken", data.token);
      setToken(data.token);
      setUser(data.user);
      setError(null);

      return { ok: true };
    } catch (err) {
      setError("Network error during registration");
      return { ok: false };
    }
  }

  async function login(email, password) {
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return { ok: false };
      }

      // Save token
      localStorage.setItem("authToken", data.token);
      setToken(data.token);
      setUser(data.user);
      setError(null);

      return { ok: true };
    } catch (err) {
      setError("Network error during login");
      return { ok: false };
    }
  }

  function logout() {
    localStorage.removeItem("authToken");
    setToken(null);
    setUser(null);
    setError(null);
  }

  const value = {
    user,
    token,
    loading,
    error,
    isAuthenticated: !!token,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
