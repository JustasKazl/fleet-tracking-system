import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

// Simple in-memory cache for reverse geocoding results
const locationCache = new Map();

function VehicleCard({ vehicle, onDelete, onEdit }) {
  const {
    id,
    brand,
    model,
    custom_name,
    plate,
    imei,
    status,
    total_km,
    created_at,
    last_seen,
    last_latitude,
    last_longitude,
  } = vehicle;

  const [locationName, setLocationName] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const statusLabel =
    status === "online"
      ? "Online"
      : status === "offline"
      ? "Offline"
      : status === "warning"
      ? "Įspėjimas"
      : "Nežinoma";

  const statusClass =
    status === "online"
      ? "status-tag status-online"
      : status === "offline"
      ? "status-tag status-offline"
      : status === "warning"
      ? "status-tag status-warn"
      : "status-tag";

  const avatarLetter = brand?.[0]?.toUpperCase() || "?";
  const navigate = useNavigate();

  // Reverse geocoding with caching
  const getLocationName = async (lat, lon) => {
    if (!lat || !lon) {
      setLocationName("Nežinoma vieta");
      return;
    }

    // Round coordinates to 2 decimal places for cache key (approx 1km accuracy)
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;

    // Check cache first
    if (locationCache.has(cacheKey)) {
      setLocationName(locationCache.get(cacheKey));
      return;
    }

    setLoadingLocation(true);
    
    try {
      // Using Nominatim API - Free, no API key required
      // Rate limit: 1 request/second, max 1 request per IP
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?` +
        `lat=${lat}&lon=${lon}&format=json&accept-language=lt&zoom=10`,
        {
          headers: {
            'User-Agent': 'FleetTrack/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error("Geocoding failed");
      }

      const data = await response.json();
      
      // Extract city/town/village name
      const city = 
        data.address?.city || 
        data.address?.town || 
        data.address?.village || 
        data.address?.municipality ||
        data.address?.county ||
        "Nežinoma vieta";
      
      // Cache the result
      locationCache.set(cacheKey, city);
      setLocationName(city);
      
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      const fallback = "Nežinoma vieta";
      locationCache.set(cacheKey, fallback);
      setLocationName(fallback);
    } finally {
      setLoadingLocation(false);
    }
  };

  // Fetch location name when component mounts
  useEffect(() => {
    if (last_latitude && last_longitude) {
      // Add random delay to respect Nominatim rate limits
      // Spread requests over time when loading multiple cards
      const delay = Math.random() * 2000; // 0-2 seconds
      const timer = setTimeout(() => {
        getLocationName(last_latitude, last_longitude);
      }, delay);

      return () => clearTimeout(timer);
    } else {
      setLocationName("Nėra duomenų");
    }
  }, [last_latitude, last_longitude]);

  // Helper functions
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString('lt-LT');
    } catch (e) {
      return "-";
    }
  };

  const formatLastSeen = (timestamp) => {
    if (!timestamp) return "Niekada";
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      
      if (diffMins < 1) return "Dabar";
      if (diffMins < 60) return `Prieš ${diffMins} min.`;
      
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Prieš ${diffHours} val.`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `Prieš ${diffDays} d.`;
    } catch (e) {
      return "-";
    }
  };

  const formatImei = (imei) => {
    if (!imei) return "-";
    if (imei.length === 15) {
      return `•••••••••${imei.slice(-6)}`;
    }
    return imei;
  };

  const getLocationDisplay = () => {
    if (loadingLocation) {
      return "🔄 Kraunama...";
    }
    if (!last_latitude || !last_longitude) {
      return "Nėra duomenų";
    }
    if (locationName) {
      return `📍 ${locationName}`;
    }
    return "Nežinoma vieta";
  };

  return (
    <div className="vehicle-card">
      <div className="vehicle-card-top">
        <div className="vehicle-avatar">{avatarLetter}</div>
        <div className="vehicle-main">
          <div className="vehicle-name-row">
            <span className="vehicle-brand-model">{brand} {model}</span>
            <span className={statusClass}>{statusLabel}</span>
          </div>
          <div className="vehicle-custom-name">
            {custom_name || "(be pavadinimo)"}
          </div>
          <div className="vehicle-plate">Valst. nr.: {plate || " - "}</div>
        </div>
      </div>

      <div className="vehicle-meta">
        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">IMEI</div>
          <div className="vehicle-meta-value" title={imei}>
            {formatImei(imei)}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Iš viso km</div>
          <div className="vehicle-meta-value">
            {total_km != null ? `${total_km.toLocaleString('lt-LT')} km` : "-"}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Paskutinė vietovė</div>
          <div 
            className="vehicle-meta-value" 
            style={{ fontSize: '11px' }}
            title={last_latitude && last_longitude ? `${last_latitude.toFixed(6)}°, ${last_longitude.toFixed(6)}°` : ''}
          >
            {getLocationDisplay()}
          </div>
        </div>

        <div className="vehicle-meta-item">
          <div className="vehicle-meta-label">Paskutinis ryšys</div>
          <div className="vehicle-meta-value">
            {formatLastSeen(last_seen)}
          </div>
        </div>
      </div>

      <div className="vehicle-footer">
        <button
          type="button"
          className="btn-link"
          onClick={() => navigate(`/vehicles/${id}`)}
        >
          Peržiūrėti
        </button>
        <div className="vehicle-footer-right">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => onEdit?.(vehicle)}
          >
            Redaguoti
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={() => onDelete?.(id)}
          >
            Pašalinti
          </button>
        </div>
      </div>
    </div>
  );
}

export default VehicleCard;
