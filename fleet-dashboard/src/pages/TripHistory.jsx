import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet';
import { Calendar, Filter, Download, MapPin, Clock, Route, TrendingUp, AlertTriangle } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const KeloniuIstorija = () => {
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [routeData, setRouteData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    minDuration: 5,
    minDistance: 1.0
  });

  const [showFilters, setShowFilters] = useState(false);

  // Fetch vehicles on component mount
  useEffect(() => {
    fetchVehicles();
  }, []);

  // Fetch trips when vehicle or filters change
  useEffect(() => {
    if (selectedVehicle) {
      fetchTrips();
      fetchStats();
    }
  }, [selectedVehicle, filters]);

  const fetchVehicles = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/vehicles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setVehicles(data);
      if (data.length > 0) {
        setSelectedVehicle(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    }
  };

  const fetchTrips = async () => {
    if (!selectedVehicle) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate,
        min_duration: filters.minDuration,
        min_distance: filters.minDistance
      });
      
      const response = await fetch(
        `/api/vehicles/${selectedVehicle}/trips?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setTrips(data);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedVehicle) return;
    
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        start_date: filters.startDate,
        end_date: filters.endDate
      });
      
      const response = await fetch(
        `/api/vehicles/${selectedVehicle}/trips/stats?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const fetchTripRoute = async (trip) => {
    try {
      const token = localStorage.getItem('token');
      const tripId = `${trip.start_time}_TO_${trip.end_time}`;
      
      const response = await fetch(
        `/api/vehicles/${selectedVehicle}/trips/${tripId}/route`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await response.json();
      setRouteData(data);
      setSelectedTrip(trip);
    } catch (error) {
      console.error('Error fetching trip route:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('lt-LT', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}val ${mins}min` : `${mins}min`;
  };

  const exportToCSV = () => {
    if (trips.length === 0) return;

    const headers = ['Pradžia', 'Pabaiga', 'Trukmė (min)', 'Atstumas (km)', 'Vid. greitis (km/h)', 'Maks. greitis (km/h)'];
    const rows = trips.map(trip => [
      formatDate(trip.start_time),
      formatDate(trip.end_time),
      trip.duration_minutes?.toFixed(1) || 0,
      trip.distance_km?.toFixed(2) || 0,
      trip.avg_speed?.toFixed(1) || 0,
      trip.max_speed?.toFixed(1) || 0
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kelioniu-istorija-${filters.startDate}-${filters.endDate}.csv`;
    a.click();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Kelionių istorija</h1>
        <p className="text-gray-600">Peržiūrėkite ir analizuokite savo kelionių duomenis</p>
      </div>

      {/* Vehicle selector and filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          {/* Vehicle selector */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transporto priemonė
            </label>
            <select
              value={selectedVehicle || ''}
              onChange={(e) => setSelectedVehicle(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {vehicles.map(vehicle => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.license_plate} - {vehicle.make} {vehicle.model}
                </option>
              ))}
            </select>
          </div>

          {/* Filter toggle button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <Filter size={20} />
            Filtrai
          </button>

          {/* Export button */}
          <button
            onClick={exportToCSV}
            disabled={trips.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            Eksportuoti CSV
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pradžios data
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pabaigos data
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min. trukmė (min)
              </label>
              <input
                type="number"
                value={filters.minDuration}
                onChange={(e) => setFilters({ ...filters, minDuration: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Min. atstumas (km)
              </label>
              <input
                type="number"
                step="0.1"
                value={filters.minDistance}
                onChange={(e) => setFilters({ ...filters, minDistance: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Statistics cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Route className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Kelionių skaičius</p>
                <p className="text-2xl font-bold text-gray-900">{trips.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <MapPin className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Bendras atstumas</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.summary?.total_distance_km?.toFixed(0) || 0} km
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Vid. greitis</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.summary?.avg_speed?.toFixed(0) || 0} km/h
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-orange-100 rounded-lg">
                <AlertTriangle className="text-orange-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Greičio viršijimai</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.summary?.speeding_events || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trip list */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Kelionės</h2>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '600px' }}>
            {loading ? (
              <div className="p-8 text-center text-gray-500">Kraunama...</div>
            ) : trips.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Kelionių nerasta pasirinktam laikotarpiui
              </div>
            ) : (
              trips.map((trip, index) => (
                <div
                  key={index}
                  onClick={() => fetchTripRoute(trip)}
                  className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedTrip === trip ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-900">
                        {formatDate(trip.start_time)}
                      </span>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                      {formatDuration(trip.duration_minutes)}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Atstumas</p>
                      <p className="font-semibold text-gray-900">
                        {trip.distance_km?.toFixed(1) || 0} km
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Vid. greitis</p>
                      <p className="font-semibold text-gray-900">
                        {trip.avg_speed?.toFixed(0) || 0} km/h
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Maks. greitis</p>
                      <p className={`font-semibold ${
                        trip.max_speed > 90 ? 'text-red-600' : 'text-gray-900'
                      }`}>
                        {trip.max_speed?.toFixed(0) || 0} km/h
                      </p>
                    </div>
                  </div>

                  {trip.start_lat && trip.start_lon && (
                    <div className="mt-2 text-xs text-gray-500">
                      <p>Pradžia: {trip.start_lat.toFixed(4)}, {trip.start_lon.toFixed(4)}</p>
                      {trip.end_lat && trip.end_lon && (
                        <p>Pabaiga: {trip.end_lat.toFixed(4)}, {trip.end_lon.toFixed(4)}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedTrip ? 'Kelionės maršrutas' : 'Žemėlapis'}
            </h2>
            {selectedTrip && (
              <p className="text-sm text-gray-600 mt-1">
                {formatDate(selectedTrip.start_time)} - {formatDuration(selectedTrip.duration_minutes)}
              </p>
            )}
          </div>
          <div style={{ height: '600px' }}>
            {selectedTrip && routeData.length > 0 ? (
              <MapContainer
                center={[routeData[0].latitude, routeData[0].longitude]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                
                {/* Route polyline */}
                <Polyline
                  positions={routeData.map(point => [point.latitude, point.longitude])}
                  color="blue"
                  weight={4}
                  opacity={0.7}
                />

                {/* Start marker */}
                <Marker position={[routeData[0].latitude, routeData[0].longitude]}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold">Pradžia</p>
                      <p>{formatDate(routeData[0].timestamp)}</p>
                    </div>
                  </Popup>
                </Marker>

                {/* End marker */}
                {routeData.length > 1 && (
                  <Marker position={[
                    routeData[routeData.length - 1].latitude,
                    routeData[routeData.length - 1].longitude
                  ]}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">Pabaiga</p>
                        <p>{formatDate(routeData[routeData.length - 1].timestamp)}</p>
                      </div>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Pasirinkite kelionę iš sąrašo
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KeloniuIstorija;
