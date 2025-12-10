// src/config/api.js
// Create this new file to centralize API configuration
const API_BASE_URL = 'https://fleet-tracking-system-production.up.railway.app';

export const API_ENDPOINTS = {
  vehicles: `${API_BASE_URL}/api/vehicles`,
  documents: (vehicleId) => `${API_BASE_URL}/api/vehicles/${vehicleId}/documents`,
  service: (vehicleId) => `${API_BASE_URL}/api/vehicles/${vehicleId}/service`,
};

// Helper function for API calls with error handling
export async function apiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);  // ✅ Fixed
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}

export default API_BASE_URL;
