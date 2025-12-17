// =============================================
// DASHBOARD MAP - Shows all vehicles on one map
// Fleet Tracking Dashboard
// =============================================

import { useEffect, useRef, useState } from "react";

function DashboardMap({ vehicles, token }) {
    const mapContainer = useRef(null);
    const map = useRef(null);
    const markersLayer = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load Leaflet dynamically
    const loadLeaflet = () =>
        new Promise((resolve) => {
            if (window.L) return resolve();

            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
            document.head.appendChild(link);

            const script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
            script.onload = resolve;
            document.head.appendChild(script);
        });

    // Create car marker icon
    const createCarIcon = (status) => {
        const color = status === 'online' ? '#3bf28c' : status === 'warning' ? '#f2e63b' : '#f24444';
        return `
            <div style="
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, ${color}, ${color}dd);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 3px solid white;
                box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            ">
                <span style="font-size: 18px;">🚗</span>
            </div>
        `;
    };

    // Initialize map
    useEffect(() => {
        if (!vehicles || vehicles.length === 0) {
            setLoading(false);
            return;
        }

        async function initMap() {
            try {
                await loadLeaflet();

                // Filter vehicles with valid coordinates
                const vehiclesWithCoords = vehicles.filter(v => 
                    v.last_latitude && v.last_longitude &&
                    !isNaN(parseFloat(v.last_latitude)) && 
                    !isNaN(parseFloat(v.last_longitude))
                );

                if (vehiclesWithCoords.length === 0) {
                    setError("Nėra automobilių su GPS duomenimis");
                    setLoading(false);
                    return;
                }

                // Calculate center point
                const lats = vehiclesWithCoords.map(v => parseFloat(v.last_latitude));
                const lons = vehiclesWithCoords.map(v => parseFloat(v.last_longitude));
                const centerLat = lats.reduce((a, b) => a + b, 0) / lats.length;
                const centerLon = lons.reduce((a, b) => a + b, 0) / lons.length;

                // Initialize map if not exists
                if (!map.current) {
                    map.current = window.L.map(mapContainer.current).setView([centerLat, centerLon], 10);

                    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                        maxZoom: 19,
                        attribution: '© OpenStreetMap'
                    }).addTo(map.current);

                    markersLayer.current = window.L.layerGroup().addTo(map.current);
                }

                // Clear existing markers
                markersLayer.current.clearLayers();

                // Add markers for each vehicle
                vehiclesWithCoords.forEach(vehicle => {
                    const lat = parseFloat(vehicle.last_latitude);
                    const lon = parseFloat(vehicle.last_longitude);

                    const marker = window.L.marker([lat, lon], {
                        icon: window.L.divIcon({
                            html: createCarIcon(vehicle.status),
                            iconSize: [36, 36],
                            iconAnchor: [18, 18],
                            className: 'vehicle-marker'
                        })
                    });

                    // Popup content
                    marker.bindPopup(`
                        <div style="font-family: Arial, sans-serif; min-width: 150px;">
                            <strong style="font-size: 14px;">${vehicle.brand} ${vehicle.model}</strong>
                            <div style="margin-top: 8px; font-size: 12px; color: #666;">
                                ${vehicle.plate || 'Be numerių'}
                            </div>
                            <div style="margin-top: 4px; font-size: 12px;">
                                <span style="color: ${vehicle.status === 'online' ? '#22c55e' : '#ef4444'};">
                                    ● ${vehicle.status === 'online' ? 'Online' : 'Offline'}
                                </span>
                            </div>
                            ${vehicle.total_km ? `<div style="margin-top: 4px; font-size: 12px;">📏 ${vehicle.total_km.toLocaleString()} km</div>` : ''}
                        </div>
                    `);

                    marker.addTo(markersLayer.current);
                });

                // Fit bounds to show all markers
                if (vehiclesWithCoords.length > 1) {
                    const bounds = window.L.latLngBounds(
                        vehiclesWithCoords.map(v => [parseFloat(v.last_latitude), parseFloat(v.last_longitude)])
                    );
                    map.current.fitBounds(bounds, { padding: [30, 30] });
                }

                setLoading(false);
            } catch (err) {
                console.error("Map error:", err);
                setError("Nepavyko įkelti žemėlapio");
                setLoading(false);
            }
        }

        initMap();

        // Cleanup
        return () => {
            if (map.current) {
                map.current.remove();
                map.current = null;
            }
        };
    }, [vehicles]);

    // No vehicles
    if (!vehicles || vehicles.length === 0) {
        return (
            <div style={{
                height: '100%',
                minHeight: '300px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.03) 100%)',
                borderRadius: '8px'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.5 }}>🗺️</div>
                <div>Pridėkite automobilį</div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', height: '100%', minHeight: '300px' }}>
            {/* Map container */}
            <div 
                ref={mapContainer} 
                style={{ 
                    height: '100%', 
                    minHeight: '300px',
                    borderRadius: '8px',
                    overflow: 'hidden'
                }}
            />

            {/* Loading overlay */}
            {loading && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(10, 1, 24, 0.8)',
                    borderRadius: '8px',
                    zIndex: 1000
                }}>
                    <div className="spinner"></div>
                    <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Kraunamas žemėlapis...</p>
                </div>
            )}

            {/* Error state */}
            {error && !loading && (
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(10, 1, 24, 0.9)',
                    borderRadius: '8px',
                    zIndex: 1000
                }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📍</div>
                    <p style={{ color: 'var(--text-muted)' }}>{error}</p>
                </div>
            )}

            {/* Vehicle count badge */}
            {!loading && !error && (
                <div style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(10, 1, 24, 0.8)',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    zIndex: 1000,
                    border: '1px solid var(--border-color)'
                }}>
                    🚗 {vehicles.filter(v => v.last_latitude && v.last_longitude).length} automobilių
                </div>
            )}
        </div>
    );
}

export default DashboardMap;
