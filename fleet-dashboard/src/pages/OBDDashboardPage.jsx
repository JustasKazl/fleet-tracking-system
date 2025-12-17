// OBD PAGE - Health Score, Driving Style, Fuel Efficiency, Export
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "../layout/DashboardLayout";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import API_BASE_URL from "../api";
import "../styles/obd-dashboard.css";

const OBD_PARAMS = {
    rpm: { label: "Variklio RPM", unit: "rpm", icon: "🔄", color: "#667eea", min: 0, max: 8000, thresholds: { normal: { max: 4000 }, warning: { max: 5500 }, critical: { max: 8000 } }, alertMessage: "Variklio apsukos per didelės" },
    coolant_temp: { label: "Aušinimo skystis", unit: "°C", icon: "🌡️", color: "#f59e0b", min: -40, max: 130, thresholds: { normal: { max: 95 }, warning: { max: 105 }, critical: { max: 130 } }, alertMessage: "Variklio temperatūra per aukšta" },
    speed_kmh: { label: "Greitis", unit: "km/h", icon: "🚗", color: "#3b82f6", min: 0, max: 200, thresholds: { normal: { max: 90 }, warning: { max: 130 }, critical: { max: 200 } }, alertMessage: "Viršytas greičio limitas" },
    engine_load: { label: "Variklio apkrova", unit: "%", icon: "⚡", color: "#8b5cf6", min: 0, max: 100, thresholds: { normal: { max: 70 }, warning: { max: 85 }, critical: { max: 100 } }, alertMessage: "Variklio apkrova per didelė" },
    intake_air_temp: { label: "Įsiurb. oro temp.", unit: "°C", icon: "🌬️", color: "#06b6d4", min: -40, max: 80, thresholds: { normal: { max: 45 }, warning: { max: 60 }, critical: { max: 80 } }, alertMessage: "Temperatūra per aukšta" },
    maf: { label: "MAF sensorius", unit: "g/s", icon: "💨", color: "#10b981", min: 0, max: 500, thresholds: { normal: { max: 250 }, warning: { max: 400 }, critical: { max: 500 } }, alertMessage: "MAF nenormali" },
    throttle: { label: "Akseleratoriaus pad.", unit: "%", icon: "🎚️", color: "#f43f5e", min: 0, max: 100, thresholds: null, alertMessage: null },
    fuel_level: { label: "Kuro lygis", unit: "%", icon: "⛽", color: "#eab308", min: 0, max: 100, thresholds: { normal: { min: 25 }, warning: { min: 10 }, critical: { min: 0 } }, alertMessage: "Žemas kuro lygis", inverted: true },
    battery_voltage: { label: "Akumuliatorius", unit: "V", icon: "🔋", color: "#22c55e", min: 10, max: 16, thresholds: { normal: { min: 13.5 }, warning: { min: 12.0 }, critical: { min: 10 } }, alertMessage: "Įtampa per žema", inverted: true },
    fuel_rate: { label: "Kuro sąnaudos", unit: "L/100", icon: "📊", color: "#ec4899", min: 0, max: 30, thresholds: { normal: { max: 12 }, warning: { max: 18 }, critical: { max: 30 } }, alertMessage: "Sąnaudos per didelės" },
};

function getValueStatus(v, p) {
    if (!p?.thresholds) return 'normal';
    const { thresholds: t, inverted } = p;
    if (inverted) { if (v < (t.critical?.min ?? -Infinity)) return 'critical'; if (v < (t.warning?.min ?? -Infinity)) return 'warning'; if (v < (t.normal?.min ?? -Infinity)) return 'warning'; return 'normal'; }
    else { if (v >= (t.critical?.max ?? Infinity)) return 'critical'; if (v >= (t.warning?.max ?? Infinity)) return 'critical'; if (v > (t.normal?.max ?? Infinity)) return 'warning'; return 'normal'; }
}

const statusColors = { normal: '#22c55e', warning: '#f59e0b', critical: '#ef4444' };

function OBDPage() {
    const { token } = useAuth();
    const { showToast } = useToast();
    const [vehicles, setVehicles] = useState([]);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [loadingVehicles, setLoadingVehicles] = useState(true);
    const [telemetry, setTelemetry] = useState([]);
    const [loading, setLoading] = useState(false);
    const [timeRange, setTimeRange] = useState("24h");
    const [availableParams, setAvailableParams] = useState([]);
    const [selectedParam, setSelectedParam] = useState(null);
    const [paramAlerts, setParamAlerts] = useState({});
    const [healthScore, setHealthScore] = useState(null);
    const [drivingStyle, setDrivingStyle] = useState(null);
    const [fuelEfficiency, setFuelEfficiency] = useState(null);
    const [tripStats, setTripStats] = useState(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetch(`${API_BASE_URL}/api/vehicles`, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(d => { const l = Array.isArray(d) ? d : []; setVehicles(l); if (l.length) setSelectedVehicle(l[0]); })
            .finally(() => setLoadingVehicles(false));
    }, [token]);

    useEffect(() => { if (selectedVehicle?.imei && token) loadTelemetry(); }, [selectedVehicle, token, timeRange]);

    function analyzeAlerts(data) {
        const alerts = {};
        data.forEach(pt => Object.keys(OBD_PARAMS).forEach(p => {
            const v = pt[p]; if (v === undefined) return;
            const s = getValueStatus(v, OBD_PARAMS[p]);
            if (s === 'critical') alerts[p] = 'critical'; else if (s === 'warning' && alerts[p] !== 'critical') alerts[p] = 'warning';
        }));
        Object.keys(OBD_PARAMS).forEach(p => { if (!alerts[p]) alerts[p] = 'normal'; });
        setParamAlerts(alerts);
    }

    function calcHealth(data) {
        if (!data.length) return null;
        
        // Health score weights - what actually matters for engine health
        // Higher weight = more impact on health score when in warning/critical
        const healthWeights = {
            // CRITICAL for engine health - these destroy engines
            coolant_temp: { weight: 5.0, name: 'Aušinimo skystis', critical: true },
            battery_voltage: { weight: 3.0, name: 'Akumuliatoriaus įtampa', critical: true },
            
            // IMPORTANT - indicates problems but less severe
            engine_load: { weight: 1.5, name: 'Variklio apkrova', critical: false },
            intake_air_temp: { weight: 1.0, name: 'Įsiurbiamo oro temp.', critical: false },
            
            // MINOR - high values are normal during driving, only prolonged extremes matter
            rpm: { weight: 0.3, name: 'RPM', critical: false },
            fuel_rate: { weight: 0.2, name: 'Kuro sąnaudos', critical: false },
            
            // INFORMATIONAL - doesn't affect engine health directly
            fuel_level: { weight: 0.5, name: 'Kuro lygis', critical: false },
            
            // IGNORE for health - these are driving style, not engine health
            speed_kmh: { weight: 0, name: 'Greitis', critical: false },
            throttle: { weight: 0, name: 'Akseleratorius', critical: false },
            maf: { weight: 0, name: 'MAF', critical: false },
        };
        
        let score = 100;
        const issues = [];
        
        Object.keys(OBD_PARAMS).forEach(param => {
            const pm = OBD_PARAMS[param];
            if (!pm.thresholds) return;
            
            const config = healthWeights[param];
            if (!config || config.weight === 0) return; // Skip ignored params
            
            const vals = data.map(d => d[param]).filter(v => v !== undefined);
            if (!vals.length) return;
            
            let warningCount = 0, criticalCount = 0;
            vals.forEach(v => {
                const status = getValueStatus(v, pm);
                if (status === 'warning') warningCount++;
                if (status === 'critical') criticalCount++;
            });
            
            const warningPct = (warningCount / vals.length) * 100;
            const criticalPct = (criticalCount / vals.length) * 100;
            
            // Calculate penalty based on severity and weight
            let penalty = 0;
            
            if (criticalPct > 0) {
                // Critical issues - heavy penalty, especially for critical params
                penalty = criticalPct * config.weight * (config.critical ? 2.0 : 0.8);
                
                if (criticalPct > 1) { // More than 1% of time in critical
                    issues.push({
                        param: config.name,
                        severity: 'critical',
                        pct: criticalPct,
                        weight: config.weight
                    });
                }
            } else if (warningPct > 5) {
                // Warning issues - moderate penalty, only if significant
                penalty = warningPct * config.weight * 0.15;
                
                if (warningPct > 10) { // More than 10% of time in warning
                    issues.push({
                        param: config.name,
                        severity: 'warning',
                        pct: warningPct,
                        weight: config.weight
                    });
                }
            }
            
            score -= penalty;
        });
        
        // Sort issues by severity and weight
        issues.sort((a, b) => {
            if (a.severity === 'critical' && b.severity !== 'critical') return -1;
            if (b.severity === 'critical' && a.severity !== 'critical') return 1;
            return (b.pct * b.weight) - (a.pct * a.weight);
        });
        
        return {
            score: Math.max(0, Math.min(100, Math.round(score))),
            issues: issues.slice(0, 5)
        };
    }

    function calcDriving(data) {
        if (data.length < 2) return null;
        
        let hardAccelerations = 0;  // Sudden speed increase
        let hardBraking = 0;        // Sudden speed decrease
        let highRpmEvents = 0;      // Very high RPM (>5000)
        let overspeedEvents = 0;    // Over 130 km/h
        let highLoadEvents = 0;     // Engine load > 85%
        let idlePoints = 0;         // Stationary with engine running
        let movingPoints = 0;       // Actually driving
        
        for (let i = 1; i < data.length; i++) {
            const prev = data[i - 1];
            const curr = data[i];
            
            // Calculate time delta to avoid counting slow changes
            const timeDelta = curr.timestamp - prev.timestamp;
            const seconds = timeDelta / 1000;
            
            // Skip if too much time between points (different trip)
            if (seconds > 60) continue;
            
            // Hard acceleration: >20 km/h gain in short time
            if (curr.speed_kmh !== undefined && prev.speed_kmh !== undefined) {
                const speedChange = curr.speed_kmh - prev.speed_kmh;
                
                // Only count as hard if rapid change (within a few seconds)
                if (seconds < 10) {
                    if (speedChange > 20) hardAccelerations++;
                    if (speedChange < -25) hardBraking++;
                }
            }
            
            // High RPM: only count very high (>5000, not 4500)
            if (curr.rpm > 5000) highRpmEvents++;
            
            // Overspeed: >140 km/h (130 is normal on highways)
            if (curr.speed_kmh > 140) overspeedEvents++;
            
            // High load: >85% sustained
            if (curr.engine_load > 85) highLoadEvents++;
            
            // Idle vs moving
            if (curr.speed_kmh !== undefined) {
                if (curr.speed_kmh < 5 && curr.rpm > 0) {
                    idlePoints++;
                } else if (curr.speed_kmh >= 5) {
                    movingPoints++;
                }
            }
        }
        
        const totalPoints = movingPoints + idlePoints || 1;
        
        // Calculate eco score - more forgiving formula
        // Base score of 100, subtract penalties
        let ecoScore = 100;
        
        // Penalties (per 100 data points, max 50 points total penalty)
        const pointsPer100 = 100 / Math.max(totalPoints, 1);
        
        ecoScore -= Math.min(15, hardAccelerations * pointsPer100 * 0.5);   // Max -15 for hard accelerations
        ecoScore -= Math.min(15, hardBraking * pointsPer100 * 0.5);         // Max -15 for hard braking  
        ecoScore -= Math.min(10, highRpmEvents * pointsPer100 * 0.2);       // Max -10 for high RPM
        ecoScore -= Math.min(10, highLoadEvents * pointsPer100 * 0.1);      // Max -10 for high load
        
        // Overspeed is informational, doesn't heavily affect eco score
        // (you can drive efficiently at high speed)
        
        ecoScore = Math.max(0, Math.min(100, Math.round(ecoScore)));
        
        // Calculate idle percentage
        const idlePercent = Math.round((idlePoints / totalPoints) * 100);
        
        return {
            eco: ecoScore,
            aggressive: 100 - ecoScore,
            ha: hardAccelerations,
            hb: hardBraking,
            hr: highRpmEvents,
            os: overspeedEvents,
            hl: highLoadEvents,
            idle: idlePercent
        };
    }

    function calcFuel(data) {
        // Get fuel rate readings (instantaneous L/100km from OBD)
        const rates = data.map(p => p.fuel_rate).filter(v => v !== undefined && v > 0);
        
        // Get fuel level readings
        const levels = data.map(p => p.fuel_level).filter(v => v !== undefined);
        
        if (!rates.length && !levels.length) return null;
        
        // Calculate average from OBD fuel rate sensor
        const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
        const min = rates.length ? Math.min(...rates) : null;
        const max = rates.length ? Math.max(...rates) : null;
        
        // Fuel used (percentage)
        const fuelUsedPercent = levels.length >= 2 ? Math.max(0, levels[0] - levels[levels.length - 1]) : null;
        
        // Rating based on average
        let rating = 'average';
        if (avg !== null) {
            if (avg < 7) rating = 'excellent';
            else if (avg < 10) rating = 'good';
            else if (avg < 15) rating = 'average';
            else rating = 'poor';
        }
        
        return { avg, min, max, fuelUsedPercent, rating };
    }

    // Calculate distance using Haversine formula
    function calcTripStats(data) {
        if (data.length < 2) return null;
        
        let totalDistance = 0;
        let movingTime = 0;
        let idleTime = 0;
        let maxSpeed = 0;
        
        // Track trip segments (break at >1 hour gaps)
        const TRIP_GAP_MS = 60 * 60 * 1000;
        
        for (let i = 1; i < data.length; i++) {
            const prev = data[i-1], curr = data[i];
            const timeDiff = curr.timestamp - prev.timestamp;
            
            // Skip if different trip
            if (timeDiff > TRIP_GAP_MS) continue;
            
            // Distance calculation from GPS (if lat/lng available) or speed*time
            if (prev.latitude && prev.longitude && curr.latitude && curr.longitude) {
                const dist = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
                // Sanity check - skip if impossible jump (>10km in one interval)
                if (dist < 10) {
                    totalDistance += dist;
                }
            } else if (curr.speed_kmh !== undefined && curr.speed_kmh > 0) {
                // Estimate from speed
                const timeDiffHours = timeDiff / 1000 / 3600;
                totalDistance += curr.speed_kmh * timeDiffHours;
            }
            
            // Time tracking
            const timeDiffMin = timeDiff / 1000 / 60;
            if (timeDiffMin < 60) { // Only count reasonable intervals
                if (curr.speed_kmh > 5) {
                    movingTime += timeDiffMin;
                } else {
                    idleTime += timeDiffMin;
                }
            }
            
            // Max speed
            if (curr.speed_kmh > maxSpeed) maxSpeed = curr.speed_kmh;
        }
        
        // Fuel stats from level changes
        const levels = data.map(p => p.fuel_level).filter(v => v !== undefined);
        const fuelUsedPercent = levels.length >= 2 ? Math.max(0, levels[0] - levels[levels.length - 1]) : 0;
        
        // Calculate actual consumption: L/100km from fuel level % and distance
        // Assuming typical 50L tank, but show only if we have meaningful data
        let actualConsumption = null;
        if (totalDistance > 5 && fuelUsedPercent > 1) {
            // fuelUsedPercent% of 50L tank / distance in km * 100
            const litersUsed = (fuelUsedPercent / 100) * 50;
            actualConsumption = (litersUsed / totalDistance) * 100;
        }
        
        return {
            distance: totalDistance,
            movingTime: Math.round(movingTime),
            idleTime: Math.round(idleTime),
            maxSpeed: Math.round(maxSpeed),
            fuelUsedPercent,
            actualConsumption
        };
    }

    // Haversine formula for distance between two GPS points
    function haversine(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    async function loadTelemetry() {
        setLoading(true);
        try {
            const limits = { '24h': 2880, '7d': 10000, '30d': 20000, 'all': 50000 };
            const res = await fetch(`${API_BASE_URL}/api/telemetry/${selectedVehicle.imei}?limit=${limits[timeRange]}`, { headers: { Authorization: `Bearer ${token}` } });
            const data = await res.json();
            const proc = data.map(p => { let io = p.io_elements; if (typeof io === "string") try { io = JSON.parse(io); } catch { io = {}; } return { timestamp: new Date(p.received_at || p.timestamp), speed: p.speed, latitude: p.latitude, longitude: p.longitude, ...extractOBD(io) }; }).reverse();
            setTelemetry(proc);
            
            // Filter data by time range for analytics
            const now = new Date();
            let cutoff;
            if (timeRange === '24h') cutoff = new Date(now - 24 * 60 * 60 * 1000);
            else if (timeRange === '7d') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
            else if (timeRange === '30d') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
            else cutoff = null; // 'all'
            
            const filtered = cutoff ? proc.filter(d => d.timestamp && d.timestamp >= cutoff) : proc;
            
            analyzeAlerts(filtered); 
            setHealthScore(calcHealth(filtered)); 
            setDrivingStyle(calcDriving(filtered)); 
            setFuelEfficiency(calcFuel(filtered)); 
            setTripStats(calcTripStats(filtered));
            
            const params = new Set(); proc.forEach(p => Object.keys(OBD_PARAMS).forEach(k => { if (p[k] !== undefined) params.add(k); }));
            const pl = Array.from(params); setAvailableParams(pl); if (!selectedParam && pl.length) setSelectedParam(pl[0]);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    }

    function extractOBD(io) {
        if (!io) return {};
        const map = { 36: "rpm", 32: "coolant_temp", 37: "speed_kmh", 31: "engine_load", 39: "intake_air_temp", 40: "maf", 41: "throttle", 48: "fuel_level", 51: "battery_voltage", 60: "fuel_rate" };
        const conv = { maf: v => v*0.01, battery_voltage: v => v*0.001, fuel_rate: v => v*0.01 };
        const d = {}; Object.entries(map).forEach(([id,n]) => { const v = io[id] || io[parseInt(id)]; if (v !== undefined) d[n] = conv[n] ? conv[n](v) : v; }); return d;
    }

    // Filter telemetry by selected time range
    function getFilteredTelemetry() {
        if (!telemetry.length) return [];
        const now = new Date();
        let cutoff;
        if (timeRange === '24h') cutoff = new Date(now - 24 * 60 * 60 * 1000);
        else if (timeRange === '7d') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
        else if (timeRange === '30d') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
        else return telemetry; // 'all' - no filter
        return telemetry.filter(d => d.timestamp && d.timestamp >= cutoff);
    }
    
    function getStats(p) {
        const filtered = getFilteredTelemetry();
        const vals = filtered.map(d => d[p]).filter(v => v !== undefined);
        if (!vals.length) return null;
        const c = vals[vals.length - 1];
        return {
            current: c,
            min: Math.min(...vals),
            max: Math.max(...vals),
            avg: vals.reduce((a, b) => a + b, 0) / vals.length,
            status: getValueStatus(c, OBD_PARAMS[p])
        };
    }

    async function generateAIAnalysis() {
        if (!healthScore || !drivingStyle) return;
        
        setAiLoading(true);
        setAiAnalysis(null);
        
        const timeLabel = { '24h': 'pastarąją dieną', '7d': 'pastarąją savaitę', '30d': 'pastarąjį mėnesį', 'all': 'visą laikotarpį' }[timeRange];
        const vehicle = selectedVehicle;
        
        // Build context for AI
        const requestData = {
            vehicle: `${vehicle?.brand} ${vehicle?.model} (${vehicle?.year || 'N/A'})`,
            period: timeLabel,
            healthScore: healthScore.score,
            issues: healthScore.issues.map(i => `${i.param}: ${i.severity} (${i.pct.toFixed(1)}% laiko)`),
            driving: {
                ecoScore: drivingStyle.eco,
                hardAccelerations: drivingStyle.ha,
                hardBraking: drivingStyle.hb,
                highRpmEvents: drivingStyle.hr,
                overspeedEvents: drivingStyle.os,
                idlePercent: drivingStyle.idle
            },
            fuel: fuelEfficiency ? {
                avgConsumption: fuelEfficiency.avg?.toFixed(1),
                minConsumption: fuelEfficiency.min?.toFixed(1),
                maxConsumption: fuelEfficiency.max?.toFixed(1),
                rating: fuelEfficiency.rating
            } : {},
            trip: tripStats ? {
                distance: tripStats.distance?.toFixed(1),
                movingTime: tripStats.movingTime,
                idleTime: tripStats.idleTime,
                maxSpeed: tripStats.maxSpeed
            } : {},
            parameters: availableParams.map(p => {
                const stats = getStats(p);
                const param = OBD_PARAMS[p];
                return {
                    name: param.label,
                    avg: stats?.avg?.toFixed(1),
                    min: stats?.min?.toFixed(1),
                    max: stats?.max?.toFixed(1),
                    status: paramAlerts[p] || 'normal'
                };
            })
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/ai/analyze-obd`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestData)
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'API request failed');
            }
            
            setAiAnalysis(data.analysis || 'Nepavyko sugeneruoti analizės.');
        } catch (err) {
            console.error('AI Analysis error:', err);
            setAiAnalysis('❌ Klaida: ' + err.message);
        } finally {
            setAiLoading(false);
        }
    }

    function exportCSV() {
        const h = ['Laikas', ...availableParams.map(p => OBD_PARAMS[p]?.label || p)];
        const r = telemetry.map(p => [p.timestamp.toLocaleString('lt-LT'), ...availableParams.map(k => p[k]?.toFixed(2) || '')]);
        const csv = [h.join(','), ...r.map(x => x.join(','))].join('\n');
        const b = new Blob([csv], { type: 'text/csv' }), u = URL.createObjectURL(b), l = document.createElement('a');
        l.href = u; l.download = `obd_${selectedVehicle?.plate}_${timeRange}.csv`; l.click(); showToast('✅ CSV eksportuotas', 'success');
    }

    function exportPDF() {
        const w = window.open('', '_blank'), v = selectedVehicle, t = { '24h': 'Diena', '7d': 'Savaitė', '30d': 'Mėnuo', 'all': 'Viskas' }[timeRange];
        w.document.write(`<!DOCTYPE html><html><head><title>OBD</title><style>body{font-family:Arial;padding:40px}h1{color:#667eea;border-bottom:2px solid #667eea;padding-bottom:10px}.score{font-size:48px;font-weight:bold;text-align:center;padding:20px;background:#f0f9ff;border-radius:12px;margin:20px 0;color:${healthScore?.score >= 80 ? '#22c55e' : healthScore?.score >= 60 ? '#f59e0b' : '#ef4444'}}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px}.card h3{margin:0 0 10px;color:#667eea}.stat{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}.good{color:#22c55e}.warning{color:#f59e0b}.bad{color:#ef4444}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #eee;text-align:left}th{background:#f1f5f9}</style></head><body><h1>🔧 OBD-II Ataskaita</h1><p><b>${v?.brand} ${v?.model}</b> | ${v?.plate} | ${t}</p><div class="score">${healthScore?.score||0}% Sveikata</div>${healthScore?.issues?.length?`<h3>Problemos</h3><ul>${healthScore.issues.map(i=>`<li class="${i.severity}">${i.param}: ${i.pct.toFixed(1)}%</li>`).join('')}</ul>`:'<p class="good">✓ OK</p>'}<div class="grid"><div class="card"><h3>🎯 Vairavimas</h3><div class="stat"><span>Eko</span><span>${drivingStyle?.eco}%</span></div><div class="stat"><span>Pagreičiai</span><span>${drivingStyle?.ha}</span></div><div class="stat"><span>Stabdymai</span><span>${drivingStyle?.hb}</span></div></div><div class="card"><h3>⛽ Kuras</h3><div class="stat"><span>Vid</span><span>${fuelEfficiency?.avg?.toFixed(1)||'-'} L/100</span></div><div class="stat"><span>Min</span><span>${fuelEfficiency?.min?.toFixed(1)||'-'}</span></div><div class="stat"><span>Max</span><span>${fuelEfficiency?.max?.toFixed(1)||'-'}</span></div></div></div><h3>Parametrai</h3><table><tr><th>Param</th><th>Vid</th><th>Min</th><th>Max</th></tr>${availableParams.map(p=>{const s=getStats(p),m=OBD_PARAMS[p];return`<tr><td>${m?.icon} ${m?.label}</td><td>${s?.avg?.toFixed(1)} ${m?.unit}</td><td>${s?.min?.toFixed(1)}</td><td>${s?.max?.toFixed(1)}</td></tr>`;}).join('')}</table><p style="color:#666;margin-top:30px">${new Date().toLocaleString('lt-LT')} | ${telemetry.length} taškų</p><script>window.print()</script></body></html>`);
        w.document.close(); showToast('✅ PDF', 'success');
    }

    const selConfig = selectedParam ? OBD_PARAMS[selectedParam] : null, selStats = selectedParam ? getStats(selectedParam) : null;

    return (
        <DashboardLayout>
            <div className="obd-dashboard-page">
                <div className="obd-header">
                    <div className="obd-title-section"><h1 className="obd-title">🔧 OBD-II Diagnostika</h1><p className="obd-subtitle">Realaus laiko variklio parametrai</p></div>
                    <select className="obd-vehicle-select" value={selectedVehicle?.id||''} onChange={e=>{setSelectedVehicle(vehicles.find(v=>v.id===parseInt(e.target.value)));setSelectedParam(null);setAvailableParams([]);}} disabled={loadingVehicles}>
                        {loadingVehicles?<option>Kraunama...</option>:vehicles.length===0?<option>Nėra automobilių</option>:vehicles.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} {v.plate?`(${v.plate})`:''}</option>)}
                    </select>
                    <div className="obd-time-selector">{[{key:"24h",label:"Diena"},{key:"7d",label:"Savaitė"},{key:"30d",label:"Mėnuo"},{key:"all",label:"Viskas"}].map(t=><button key={t.key} onClick={()=>setTimeRange(t.key)} className={`time-btn ${timeRange===t.key?'active':''}`}>{t.label}</button>)}</div>
                </div>

                {loading?<div className="obd-loading"><div className="spinner"/><p>Kraunami duomenys...</p></div>
                :availableParams.length===0?<div className="obd-empty"><div className="empty-icon">🔌</div><h3>Nėra OBD-II duomenų</h3><p>Patikrinkite FMB įrenginį.</p></div>
                :<>
                    <div className="obd-main-grid">
                        <div className="obd-cards-grid">
                            {availableParams.map(p=>{const pm=OBD_PARAMS[p],st=getStats(p);if(!pm||!st)return null;const al=paramAlerts[p]||'normal',col=al==='critical'?'#ef4444':al==='warning'?'#f59e0b':'#22c55e';
                                return <div key={p} onClick={()=>setSelectedParam(p)} className={`obd-card ${selectedParam===p?'selected':''} alert-${al}`}>
                                    {al!=='normal'&&<div className={`obd-card-status-dot ${al==='critical'?'pulse':''}`} style={{background:col}}/>}
                                    <div className="obd-card-icon">{pm.icon}</div><div className="obd-card-label">{pm.label}</div>
                                    <div className="obd-card-value" style={{color:pm.color}}>{st.avg.toFixed(p==='battery_voltage'?1:0)}<span className="obd-card-unit">{pm.unit}</span></div>
                                </div>;})}
                        </div>
                        <div className="obd-chart-panel">
                            {selConfig&&selStats?<>
                                <div className="obd-chart-header">
                                    <div className="obd-chart-title-row"><span className="obd-chart-icon">{selConfig.icon}</span><span className="obd-chart-title">{selConfig.label}</span><span className={`obd-status-badge status-${selStats.status}`}>{selStats.status==='normal'?'✓ OK':selStats.status==='warning'?'⚠ Įspėjimas':'🚨 Kritinis'}</span></div>
                                    <div className="obd-chart-stats">
                                        <div className="obd-stat"><div className="obd-stat-label">Dabartinis</div><div className="obd-stat-value" style={{color:statusColors[selStats.status]}}>{selStats.current.toFixed(1)}</div></div>
                                        <div className="obd-stat"><div className="obd-stat-label">Min</div><div className="obd-stat-value">{selStats.min.toFixed(1)}</div></div>
                                        <div className="obd-stat"><div className="obd-stat-label">Vid</div><div className="obd-stat-value">{selStats.avg.toFixed(1)}</div></div>
                                        <div className="obd-stat"><div className="obd-stat-label">Max</div><div className="obd-stat-value">{selStats.max.toFixed(1)}</div></div>
                                    </div>
                                </div>
                                <div className="obd-chart-container"><OBDChart data={telemetry} paramName={selectedParam} paramConfig={selConfig} timeRange={timeRange}/></div>
                                <div className="obd-chart-legend"><span className="legend-item"><span className="legend-dot normal"/>Normalus</span><span className="legend-item"><span className="legend-dot warning"/>Įspėjimas</span><span className="legend-item"><span className="legend-dot critical"/>Kritinis</span></div>
                            </>:<div className="obd-chart-empty">Pasirinkite parametrą</div>}
                        </div>
                    </div>

                    <div className="obd-analytics-grid">
                        <div className="obd-analytics-card health-card">
                            <h3>🏥 Variklio Sveikata</h3>
                            <div className="health-score-container">
                                <div className={`health-score ${healthScore?.score>=80?'good':healthScore?.score>=60?'warning':'bad'}`}>{healthScore?.score||0}%</div>
                                <div className="health-bar"><div className="health-bar-fill" style={{width:`${healthScore?.score||0}%`,background:healthScore?.score>=80?'#22c55e':healthScore?.score>=60?'#f59e0b':'#ef4444'}}/></div>
                            </div>
                            <div className="health-issues">{healthScore?.issues?.length?healthScore.issues.map((i,x)=><div key={x} className={`health-issue ${i.severity}`}><span>{i.severity==='critical'?'🚨':'⚠️'}</span><span>{i.param}</span></div>):<div className="health-issue good"><span>✓</span><span>Visi parametrai normalūs</span></div>}</div>
                        </div>

                        <div className="obd-analytics-card driving-card">
                            <h3>🎯 Vairavimo Stilius</h3>
                            <div className="driving-meters">
                                <div className="driving-meter"><span className="meter-label">Ekonomiškas</span><div className="meter-bar"><div className="meter-fill eco" style={{width:`${drivingStyle?.eco||0}%`}}/></div><span className="meter-value">{drivingStyle?.eco||0}%</span></div>
                                <div className="driving-meter"><span className="meter-label">Agresyvus</span><div className="meter-bar"><div className="meter-fill aggressive" style={{width:`${drivingStyle?.aggressive||0}%`}}/></div><span className="meter-value">{drivingStyle?.aggressive||0}%</span></div>
                            </div>
                            <div className="driving-stats">
                                <div className="driving-stat"><span>🚀</span><span>Staigūs pagreičiai</span><span>{drivingStyle?.ha||0}</span></div>
                                <div className="driving-stat"><span>🛑</span><span>Staigūs stabdymai</span><span>{drivingStyle?.hb||0}</span></div>
                                <div className="driving-stat"><span>🔄</span><span>Aukšti RPM</span><span>{drivingStyle?.hr||0}</span></div>
                                <div className="driving-stat"><span>🏎️</span><span>Greitis &gt;130</span><span>{drivingStyle?.os||0}</span></div>
                                <div className="driving-stat"><span>⏸️</span><span>Tuščia eiga</span><span>{drivingStyle?.idle||0}%</span></div>
                            </div>
                        </div>

                        <div className="obd-analytics-card fuel-card">
                            <h3>⛽ Kuro Efektyvumas</h3>
                            <div className="fuel-gauge-container">
                                <FuelGauge value={fuelEfficiency?.avg} optimal={8} max={20} />
                            </div>
                            <div className="fuel-comparison">
                                <div className="fuel-comp-item">
                                    <span className="comp-label">Min</span>
                                    <span className="comp-value">{fuelEfficiency?.min?.toFixed(1) || '-'}</span>
                                    <span className="comp-unit">L/100km</span>
                                </div>
                                <div className="fuel-comp-divider">vs</div>
                                <div className="fuel-comp-item">
                                    <span className="comp-label">Max</span>
                                    <span className="comp-value actual">{fuelEfficiency?.max?.toFixed(1) || '-'}</span>
                                    <span className="comp-unit">L/100km</span>
                                </div>
                            </div>
                            <div className="fuel-stats">
                                <div className="fuel-stat"><span>📏 Nuvažiuota</span><span>{tripStats?.distance?.toFixed(1) || '-'} km</span></div>
                                <div className="fuel-stat"><span>⛽ Sunaudota</span><span>{tripStats?.fuelUsedPercent?.toFixed(0) || '-'}%</span></div>
                                <div className="fuel-stat"><span>🚗 Judėjimas</span><span>{tripStats?.movingTime || '-'} min</span></div>
                                <div className="fuel-stat"><span>⏸️ Tuščia eiga</span><span>{tripStats?.idleTime || '-'} min</span></div>
                                <div className="fuel-stat"><span>🏎️ Max greitis</span><span>{tripStats?.maxSpeed || '-'} km/h</span></div>
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="obd-ai-section">
                        <div className="ai-header">
                            <h3>🤖 AI Apžvalga</h3>
                            <button 
                                className={`ai-generate-btn ${aiLoading ? 'loading' : ''}`} 
                                onClick={generateAIAnalysis}
                                disabled={aiLoading}
                            >
                                {aiLoading ? (<><span className="ai-spinner" /> Analizuojama...</>) : aiAnalysis ? (<>🔄 Atnaujinti</>) : (<>✨ Generuoti analizę</>)}
                            </button>
                        </div>
                        
                        {aiLoading && (
                            <div className="ai-loading">
                                <div className="ai-loading-bar" />
                                <p>Claude analizuoja jūsų duomenis...</p>
                            </div>
                        )}
                        
                        {aiAnalysis && !aiLoading && (
                            <div className="ai-content">
                                {aiAnalysis.split('\n').map((line, i) => {
                                    if (!line.trim()) return <br key={i} />;
                                    // Headers
                                    if (line.startsWith('## ')) return <h3 key={i} className="ai-heading">{line.replace('## ', '')}</h3>;
                                    if (line.startsWith('**') && line.endsWith('**')) return <h4 key={i} className="ai-subheading">{line.replace(/\*\*/g, '')}</h4>;
                                    // Parse inline formatting
                                    let formatted = line
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/- /g, '• ');
                                    return <p key={i} dangerouslySetInnerHTML={{ __html: formatted }} />;
                                })}
                            </div>
                        )}
                        
                        {!aiAnalysis && !aiLoading && (
                            <div className="ai-placeholder">
                                <span className="ai-placeholder-icon">🧠</span>
                                <p>Paspauskite mygtuką, kad Claude išanalizuotų jūsų automobilio duomenis ir pateiktų personalizuotas įžvalgas bei rekomendacijas.</p>
                            </div>
                        )}
                    </div>

                    <div className="obd-export-section">
                        <span className="export-title">📥 Eksportuoti</span>
                        <button className="export-btn" onClick={exportCSV}>📄 CSV</button>
                        <button className="export-btn" onClick={exportPDF}>📊 PDF Ataskaita</button>
                    </div>
                </>}

                {telemetry.length>0&&<div className="obd-footer"><span>Atnaujinta: {telemetry[telemetry.length-1]?.timestamp.toLocaleString('lt-LT')}</span><span>{telemetry.length} taškų</span></div>}
            </div>
        </DashboardLayout>
    );
}

// Fuel Gauge Component
function FuelGauge({ value, optimal = 8, max = 20 }) {
    const canvasRef = useRef(null);
    
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const width = 200;
        const height = 160;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);
        
        const cx = width / 2;
        const cy = 75;
        const radius = 65;
        const startAngle = Math.PI;
        const endAngle = 2 * Math.PI;
        
        // Background arc
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.lineWidth = 18;
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Colored segments
        const segments = [
            { start: 0, end: 0.4, color: '#22c55e' },
            { start: 0.4, end: 0.6, color: '#f59e0b' },
            { start: 0.6, end: 1, color: '#ef4444' }
        ];
        
        segments.forEach(seg => {
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle + seg.start * Math.PI, startAngle + seg.end * Math.PI);
            ctx.lineWidth = 18;
            ctx.strokeStyle = seg.color + '40';
            ctx.lineCap = 'butt';
            ctx.stroke();
        });
        
        // Value arc
        if (value !== null && value !== undefined) {
            const valuePercent = Math.min(1, Math.max(0, value / max));
            const valueAngle = startAngle + valuePercent * Math.PI;
            const valueColor = value <= optimal ? '#22c55e' : value <= 12 ? '#f59e0b' : '#ef4444';
            
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, valueAngle);
            ctx.lineWidth = 18;
            ctx.strokeStyle = valueColor;
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Needle
            const needleAngle = valueAngle - Math.PI / 2;
            const needleLength = radius - 28;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + Math.cos(needleAngle + Math.PI/2) * needleLength, cy + Math.sin(needleAngle + Math.PI/2) * needleLength);
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#fff';
            ctx.lineCap = 'round';
            ctx.stroke();
            
            // Center dot
            ctx.beginPath();
            ctx.arc(cx, cy, 8, 0, Math.PI * 2);
            ctx.fillStyle = valueColor;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }
        
        // Labels on edges
        ctx.fillStyle = 'rgba(184,180,212,0.7)';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('0', 25, cy + 10);
        ctx.textAlign = 'right';
        ctx.fillText(max.toString(), width - 25, cy + 10);
        
        // Value text below gauge
        if (value !== null && value !== undefined) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px Monaco, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(value.toFixed(1), cx, 125);
            ctx.font = '12px sans-serif';
            ctx.fillStyle = 'rgba(184,180,212,0.8)';
            ctx.fillText('L/100km', cx, 145);
        }
    }, [value, optimal, max]);
    
    return <canvas ref={canvasRef} />;
}

function OBDChart({data, paramName, paramConfig, timeRange}) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [viewState, setViewState] = useState({ zoom: 1, panX: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, panX: 0 });
    
    // Reset view when timeRange or param changes
    useEffect(() => {
        setViewState({ zoom: 1, panX: 0 });
    }, [timeRange, paramName]);
    
    // Handle mouse wheel zoom
    const handleWheel = (e) => {
        e.preventDefault();
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const chartWidth = rect.width - 70; // Account for padding
        const mouseRatio = (mouseX - 50) / chartWidth; // Where on chart (0-1)
        
        setViewState(prev => {
            const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1; // Zoom out/in
            const newZoom = Math.max(1, Math.min(20, prev.zoom * zoomDelta));
            
            if (newZoom === 1) {
                return { zoom: 1, panX: 0 };
            }
            
            // Adjust pan to zoom toward mouse position
            const zoomChange = newZoom / prev.zoom;
            const newPanX = mouseRatio - (mouseRatio - prev.panX) * zoomChange;
            
            // Clamp pan to valid range
            const maxPan = 1 - 1/newZoom;
            const clampedPanX = Math.max(0, Math.min(maxPan, newPanX));
            
            return { zoom: newZoom, panX: clampedPanX };
        });
    };
    
    // Handle drag to pan
    const handleMouseDown = (e) => {
        if (viewState.zoom <= 1) return;
        isDragging.current = true;
        dragStart.current = { x: e.clientX, panX: viewState.panX };
        containerRef.current.style.cursor = 'grabbing';
    };
    
    const handleMouseMove = (e) => {
        if (!isDragging.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const chartWidth = rect.width - 70;
        const dx = e.clientX - dragStart.current.x;
        const panDelta = -dx / (chartWidth * viewState.zoom);
        
        const maxPan = 1 - 1/viewState.zoom;
        const newPanX = Math.max(0, Math.min(maxPan, dragStart.current.panX + panDelta));
        
        setViewState(prev => ({ ...prev, panX: newPanX }));
    };
    
    const handleMouseUp = () => {
        isDragging.current = false;
        if (containerRef.current) {
            containerRef.current.style.cursor = viewState.zoom > 1 ? 'grab' : 'default';
        }
    };
    
    // Double-click to reset
    const handleDoubleClick = () => {
        setViewState({ zoom: 1, panX: 0 });
    };
    
    useEffect(() => {
        if (!canvasRef.current || !containerRef.current || !data.length) return;
        
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext("2d");
        const dpr = window.devicePixelRatio || 1;
        const width = container.offsetWidth;
        const height = container.offsetHeight;
        
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        ctx.scale(dpr, dpr);
        
        const pad = { top: 20, right: 20, bottom: 45, left: 50 };
        const cw = width - pad.left - pad.right;
        const ch = height - pad.top - pad.bottom;
        
        // Background
        ctx.fillStyle = "rgba(10,1,24,0.15)";
        ctx.fillRect(0, 0, width, height);
        
        // Get values with timestamps
        const values = data
            .map(p => ({ value: p[paramName], timestamp: p.timestamp }))
            .filter(p => p.value !== undefined && p.timestamp)
            .sort((a, b) => a.timestamp - b.timestamp);
        
        if (values.length < 2) {
            ctx.fillStyle = "rgba(184,180,212,0.5)";
            ctx.font = "14px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Nepakanka duomenų", width / 2, height / 2);
            return;
        }
        
        // Calculate full time range
        const now = new Date();
        let fullTimeStart, fullTimeEnd;
        
        if (timeRange === '24h') {
            fullTimeEnd = now;
            fullTimeStart = new Date(now - 24 * 60 * 60 * 1000);
        } else if (timeRange === '7d') {
            fullTimeEnd = now;
            fullTimeStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
        } else if (timeRange === '30d') {
            fullTimeEnd = now;
            fullTimeStart = new Date(now - 30 * 24 * 60 * 60 * 1000);
        } else if (timeRange === 'all') {
            // Use actual data range
            fullTimeStart = values[0].timestamp;
            fullTimeEnd = now; // End at now, not last data point
        } else {
            fullTimeStart = values[0].timestamp;
            fullTimeEnd = values[values.length - 1].timestamp;
        }
        
        const fullTimeSpan = fullTimeEnd - fullTimeStart;
        
        // Apply zoom and pan
        const { zoom, panX } = viewState;
        const visibleSpan = fullTimeSpan / zoom;
        const timeStart = new Date(fullTimeStart.getTime() + panX * fullTimeSpan);
        const timeEnd = new Date(timeStart.getTime() + visibleSpan);
        const timeSpan = visibleSpan;
        
        // Y axis range
        const minVal = paramConfig.min;
        const maxVal = paramConfig.max;
        const range = maxVal - minVal || 1;
        
        // Draw threshold zones
        if (paramConfig.thresholds && !paramConfig.inverted) {
            const { thresholds } = paramConfig;
            const normalY = pad.top + ch - ((thresholds.normal.max - minVal) / range) * ch;
            
            ctx.fillStyle = "rgba(34,197,94,0.06)";
            ctx.fillRect(pad.left, normalY, cw, pad.top + ch - normalY);
            
            if (thresholds.warning) {
                const warnY = pad.top + ch - ((thresholds.warning.max - minVal) / range) * ch;
                ctx.fillStyle = "rgba(245,158,11,0.1)";
                ctx.fillRect(pad.left, warnY, cw, normalY - warnY);
                
                ctx.strokeStyle = "rgba(245,158,11,0.4)";
                ctx.lineWidth = 1;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(pad.left, normalY);
                ctx.lineTo(width - pad.right, normalY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            
            if (thresholds.critical) {
                const critY = thresholds.warning 
                    ? pad.top + ch - ((thresholds.warning.max - minVal) / range) * ch 
                    : normalY;
                ctx.fillStyle = "rgba(239,68,68,0.1)";
                ctx.fillRect(pad.left, pad.top, cw, critY - pad.top);
                
                ctx.strokeStyle = "rgba(239,68,68,0.5)";
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
                ctx.beginPath();
                ctx.moveTo(pad.left, critY);
                ctx.lineTo(width - pad.right, critY);
                ctx.stroke();
                ctx.setLineDash([]);
            }
        }
        
        // Draw Y axis grid
        ctx.strokeStyle = "rgba(102,126,234,0.08)";
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = pad.top + (ch / 5) * i;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(width - pad.right, y);
            ctx.stroke();
            
            ctx.fillStyle = "rgba(184,180,212,0.6)";
            ctx.font = "11px monospace";
            ctx.textAlign = "right";
            ctx.fillText((maxVal - (range / 5) * i).toFixed(0), pad.left - 8, y + 4);
        }
        
        // Draw X axis time labels (adaptive based on zoom)
        ctx.fillStyle = "rgba(184,180,212,0.5)";
        ctx.font = "10px sans-serif";
        ctx.textAlign = "center";
        
        let numLabels, labelFormat;
        const visibleHours = visibleSpan / (60 * 60 * 1000);
        
        if (visibleHours <= 2) {
            numLabels = 8;
            labelFormat = { hour: '2-digit', minute: '2-digit' };
        } else if (visibleHours <= 24) {
            numLabels = 6;
            labelFormat = { hour: '2-digit', minute: '2-digit' };
        } else if (visibleHours <= 24 * 7) {
            numLabels = 7;
            labelFormat = { weekday: 'short', hour: '2-digit' };
        } else {
            numLabels = 6;
            labelFormat = { month: 'short', day: 'numeric' };
        }
        
        // Draw vertical grid lines and time labels
        ctx.strokeStyle = "rgba(102,126,234,0.05)";
        for (let i = 0; i <= numLabels; i++) {
            const x = pad.left + (cw / numLabels) * i;
            const labelTime = new Date(timeStart.getTime() + (timeSpan / numLabels) * i);
            
            ctx.beginPath();
            ctx.moveTo(x, pad.top);
            ctx.lineTo(x, pad.top + ch);
            ctx.stroke();
            
            ctx.fillStyle = "rgba(184,180,212,0.5)";
            ctx.fillText(labelTime.toLocaleString("lt-LT", labelFormat), x, height - 8);
        }
        
        // Helper to convert timestamp to X position
        const timeToX = (timestamp) => {
            const t = timestamp.getTime();
            const ratio = (t - timeStart.getTime()) / timeSpan;
            return pad.left + ratio * cw;
        };
        
        // Helper to convert value to Y position
        const valueToY = (value) => {
            return pad.top + ch - ((value - minVal) / range) * ch;
        };
        
        // Filter values to visible range (with some margin)
        const margin = timeSpan * 0.05;
        const visibleValues = values.filter(v => {
            const t = v.timestamp.getTime();
            return t >= timeStart.getTime() - margin && t <= timeEnd.getTime() + margin;
        });
        
        if (visibleValues.length < 1) {
            ctx.fillStyle = "rgba(184,180,212,0.4)";
            ctx.font = "12px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Šiame periode nėra duomenų", width / 2, height / 2);
            return;
        }
        
        // Use absolute gap (1 hour) to detect trip boundaries - never connect across trips
        const TRIP_GAP_MS = 60 * 60 * 1000; // 1 hour in milliseconds
        
        // Draw data line - break at trip boundaries
        ctx.strokeStyle = paramConfig.color;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        
        const drawnPoints = [];
        let segments = []; // Array of segments (each segment is an array of points)
        let currentSegment = [];
        
        visibleValues.forEach((p, i) => {
            const x = timeToX(p.timestamp);
            const y = valueToY(p.value);
            const point = { x, y, value: p.value, timestamp: p.timestamp };
            
            drawnPoints.push(point);
            
            if (i === 0) {
                currentSegment.push(point);
            } else {
                const prevTime = visibleValues[i - 1].timestamp;
                const gap = p.timestamp - prevTime;
                
                if (gap > TRIP_GAP_MS) {
                    // Trip boundary detected - start new segment
                    if (currentSegment.length > 0) {
                        segments.push(currentSegment);
                    }
                    currentSegment = [point];
                } else {
                    currentSegment.push(point);
                }
            }
        });
        
        // Push last segment
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }
        
        // Draw each segment separately
        segments.forEach(segment => {
            if (segment.length < 1) return;
            
            ctx.beginPath();
            ctx.moveTo(segment[0].x, segment[0].y);
            
            for (let i = 1; i < segment.length; i++) {
                ctx.lineTo(segment[i].x, segment[i].y);
            }
            ctx.stroke();
        });
        
        // Draw fill gradient for each segment
        segments.forEach(segment => {
            if (segment.length < 2) return;
            
            ctx.beginPath();
            ctx.moveTo(segment[0].x, segment[0].y);
            
            for (let i = 1; i < segment.length; i++) {
                ctx.lineTo(segment[i].x, segment[i].y);
            }
            
            // Close the fill path
            ctx.lineTo(segment[segment.length - 1].x, pad.top + ch);
            ctx.lineTo(segment[0].x, pad.top + ch);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
            grad.addColorStop(0, paramConfig.color + "20");
            grad.addColorStop(1, paramConfig.color + "00");
            ctx.fillStyle = grad;
            ctx.fill();
        });
        
        // Draw warning/critical points
        drawnPoints.forEach(p => {
            const status = getValueStatus(p.value, paramConfig);
            if (status === 'warning' || status === 'critical') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = status === 'critical' ? '#ef4444' : '#f59e0b';
                ctx.fill();
            }
        });
        
        // Draw last point indicator
        if (drawnPoints.length > 0) {
            const last = drawnPoints[drawnPoints.length - 1];
            ctx.beginPath();
            ctx.arc(last.x, last.y, 7, 0, Math.PI * 2);
            ctx.fillStyle = paramConfig.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(last.x, last.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }
        
        // Draw zoom indicator if zoomed
        if (zoom > 1) {
            ctx.fillStyle = "rgba(102,126,234,0.9)";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "right";
            ctx.fillText(`${zoom.toFixed(1)}x 🔍`, width - pad.right, pad.top - 5);
            
            // Draw minimap
            const mmWidth = 80;
            const mmHeight = 20;
            const mmX = width - pad.right - mmWidth;
            const mmY = pad.top;
            
            ctx.fillStyle = "rgba(10,1,24,0.8)";
            ctx.fillRect(mmX, mmY, mmWidth, mmHeight);
            ctx.strokeStyle = "rgba(102,126,234,0.3)";
            ctx.strokeRect(mmX, mmY, mmWidth, mmHeight);
            
            // Visible region on minimap
            const visibleWidth = mmWidth / zoom;
            const visibleX = mmX + panX * (mmWidth - visibleWidth);
            ctx.fillStyle = "rgba(102,126,234,0.4)";
            ctx.fillRect(visibleX, mmY, visibleWidth, mmHeight);
        }
        
        // Update cursor
        container.style.cursor = zoom > 1 ? 'grab' : 'default';
        
    }, [data, paramName, paramConfig, timeRange, viewState]);
    
    return (
        <div 
            ref={containerRef} 
            className="obd-chart-canvas-container"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
        >
            <canvas ref={canvasRef} />
            {viewState.zoom > 1 && (
                <div className="chart-zoom-hint">
                    Vilkite panoramuoti • Dukart spustelėkite atstatyti
                </div>
            )}
        </div>
    );
}

export default OBDPage;
