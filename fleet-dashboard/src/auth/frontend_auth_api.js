import API_BASE_URL from "./api";

export async function registerUser(email, password, name, company) {
  const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, company }),
  });
  return res.json();
}

export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function getCurrentUser(token) {
  const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return res.json();
}

export function getAuthToken() {
  return localStorage.getItem("authToken");
}

export function setAuthToken(token) {
  localStorage.setItem("authToken", token);
}

export function removeAuthToken() {
  localStorage.removeItem("authToken");
}
