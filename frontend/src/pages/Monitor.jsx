import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
  Polygon,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchMissions, pauseMission, resumeMission, abortMission } from '../services/api';
import { socket } from '../services/socket';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// --- Utility functions ---
function normalizePoint(pt) {
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const a = Number(pt[0]),
      b = Number(pt[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    if (Math.abs(a) > 90 && Math.abs(b) <= 90) return [b, a];
    return [a, b];
  }
  if (typeof pt === 'object' && pt !== null && ('lat' in pt || 'lng' in pt)) {
    const lat = Number(pt.lat ?? pt.latitude ?? pt[0]);
    const lng = Number(pt.lng ?? pt.longitude ?? pt[1]);
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return [lat, lng];
  }
  return null;
}

function closePolygon(coords) {
  if (!coords || coords.length < 3) return coords;
  const first = coords[0],
    last = coords[coords.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) return coords;
  return [...coords, first];
}

function FitToBounds({ mission }) {
  const map = useMap();
  useEffect(() => {
    if (!mission) return;
    const area = closePolygon((mission.area || []).map(pt => normalizePoint(pt)).filter(Boolean));
    if (area.length >= 3) {
      const bounds = L.latLngBounds(area);
      map.fitBounds(bounds, { padding: [24, 24] });
      return;
    }
    const coords = (mission.flightPath || []).map(wp => [wp.lat, wp.lng]);
    if (coords.length >= 2) {
      map.fitBounds(L.latLngBounds(coords), { padding: [24, 24] });
      return;
    }
    const start = mission.flightPath?.[0];
    if (start) map.setView([start.lat, start.lng], 15);
  }, [mission, map]);
  return null;
}

function SmallAltitudeChart({ history = [] }) {
  const data = history.slice(-80).map(h => ({ t: h.t, alt: h.pos?.alt ?? 0 }));
  if (data.length === 0) return <div className="text-xs text-gray-500">No altitude data</div>;
  const min = Math.min(...data.map(d => d.alt));
  const max = Math.max(...data.map(d => d.alt));
  const w = 300,
    h = 80;
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d.alt - min) / (max - min || 1)) * h;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="rounded overflow-hidden bg-gray-50">
      <polyline fill="none" stroke="#2563eb" strokeWidth="2" points={points} />
    </svg>
  );
}

// --- Main Component ---
export default function MonitorRevamp() {
  const [missions, setMissions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [livePositions, setLivePositions] = useState({});
  const historyRef = useRef({});
  const [telemetry, setTelemetry] = useState({});

  const [showAll, setShowAll] = useState(true);
  const [showWaypoints, setShowWaypoints] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [areaOpacity, setAreaOpacity] = useState(0.22);
  const [basemap, setBasemap] = useState('osm');

  // --- Load missions & socket telemetry ---
  useEffect(() => {
    loadMissions();
    function handleProgress(data) {
      const { missionId, currentWaypoint, progress, status, battery, speed } = data;
      if (currentWaypoint) {
        setLivePositions(prev => ({ ...prev, [missionId]: currentWaypoint }));
        const entry = { t: Date.now(), pos: currentWaypoint, progress };
        historyRef.current[missionId] = historyRef.current[missionId] || [];
        historyRef.current[missionId].push(entry);
        if (historyRef.current[missionId].length > 5000) historyRef.current[missionId].shift();
        setTelemetry(prev => ({
          ...prev,
          [missionId]: {
            battery: typeof battery === 'number' ? battery : prev?.[missionId]?.battery ?? 100,
            alt: currentWaypoint.alt,
            speed: typeof speed === 'number' ? speed : prev?.[missionId]?.speed ?? 0,
            lastSeen: Date.now(),
          },
        }));
      }
      setMissions(prev =>
        prev.map(m => (m._id === missionId ? { ...m, progress, status } : m)),
      );
    }
    socket.on('missionProgress', handleProgress);
    return () => socket.off('missionProgress', handleProgress);
  }, []);

  async function loadMissions() {
    try {
      const data = await fetchMissions();
      setMissions(Array.isArray(data) ? data : []);
      if (data && data.length && !selected) setSelected(data[0]);
    } catch (e) {
      console.error('Failed to load missions', e);
    }
  }

  // --- Simulated fallback telemetry ---
  useEffect(() => {
    const id = setInterval(() => {
      missions.forEach(m => {
        if (!m) return;
        const mid = m._id;
        const last = livePositions[mid];
        if (!last && (m.status === 'in-progress' || m.status === 'started')) {
          const fp = m.flightPath || [];
          if (fp.length) {
            const sample = fp[Math.floor(fp.length * 0.2)];
            const fake = { lat: sample.lat, lng: sample.lng, alt: sample.alt ?? 30 };
            setLivePositions(prev => ({ ...prev, [mid]: fake }));
            historyRef.current[mid] = historyRef.current[mid] || [];
            historyRef.current[mid].push({ t: Date.now(), pos: fake, progress: m.progress ?? 0 });
            if (historyRef.current[mid].length > 5000) historyRef.current[mid].shift();
            setTelemetry(prev => ({
              ...prev,
              [mid]: {
                battery: (prev?.[mid]?.battery ?? 100) - 0.01,
                alt: fake.alt,
                speed: prev?.[mid]?.speed ?? 2,
                lastSeen: Date.now(),
              },
            }));
          }
        }
      });
    }, 1800);
    return () => clearInterval(id);
  }, [missions, livePositions]);

  const selectedMission = useMemo(
    () => missions.find(m => selected && m._id === selected._id) || selected,
    [missions, selected],
  );
  const selectedHistory = useMemo(
    () => (selectedMission ? (historyRef.current[selectedMission._id] || []).slice() : []),
    [selectedMission],
  );
  const selectedTelemetry = selectedMission ? telemetry[selectedMission._id] || {} : {};

  async function handleControl(action, missionId) {
    if (!missionId) return;
    try {
      if (action === 'pause') await pauseMission(missionId);
      if (action === 'resume') await resumeMission(missionId);
      if (action === 'abort') await abortMission(missionId);
      await loadMissions();
    } catch (err) {
      console.error(err);
      alert(`Failed to ${action} mission: ` + (err?.response?.data?.error || err.message));
    }
  }

  const missionsOnMap = showAll ? missions : selectedMission ? [selectedMission] : [];

  // --- Render ---
  return (
    <div className="h-full min-h-screen p-6 bg-gray-50">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Mission Monitor — Revamped</h1>
            <div className="text-sm text-gray-500">
              Clearer map, filled areas, trails, telemetry fallbacks & better controls
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadMissions}
              className="px-3 py-2 bg-white border rounded shadow-sm text-sm"
            >
              Refresh
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showAll}
                onChange={e => setShowAll(e.target.checked)}
              />{' '}
              Show all
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* LEFT: mission list */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow p-4 sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">Active Missions</div>
                <div className="text-xs text-gray-400">{missions.length}</div>
              </div>

              <div className="space-y-2 max-h-[60vh] overflow-auto pr-2">
                {missions.length === 0 && (
                  <div className="text-sm text-gray-500">No missions</div>
                )}
                {missions.map(m => {
                  const isSel = selected && selected._id === m._id;
                  return (
                    <button
                      key={m._id}
                      onClick={() => setSelected(m)}
                      className={`w-full text-left p-3 rounded-lg transition ${
                        isSel ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">
                          {m.name || `Mission ${m._id.substring(0, 6)}`}
                        </div>
                        <div className="text-xs text-gray-200">{m.progress ?? 0}%</div>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-gray-200">{m.status}</div>
                        <div className="text-xs text-gray-300">
                          WP: {(m.flightPath || []).length}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* telemetry summary for selected */}
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Telemetry</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div className="bg-gray-50 p-2 rounded">
                    Battery
                    <div className="font-semibold text-sm">
                      {selectedTelemetry.battery?.toFixed
                        ? selectedTelemetry.battery.toFixed(1) + '%'
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    Altitude<div className="font-semibold text-sm">{selectedTelemetry.alt ?? '—'}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    Speed<div className="font-semibold text-sm">{selectedTelemetry.speed ?? '—'}</div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    Last seen
                    <div className="font-semibold text-sm">
                      {selectedTelemetry.lastSeen
                        ? new Date(selectedTelemetry.lastSeen).toLocaleTimeString()
                        : '—'}
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <SmallAltitudeChart history={selectedHistory} />
                </div>
              </div>
            </div>

            <div className="mt-4 bg-white rounded-2xl shadow p-4">
              <div className="text-sm font-medium mb-2">Controls</div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleControl('pause', selectedMission?._id)}
                  className="px-3 py-2 bg-yellow-300 rounded text-xs"
                >
                  Pause
                </button>
                <button
                  onClick={() => handleControl('resume', selectedMission?._id)}
                  className="px-3 py-2 bg-indigo-600 text-white rounded text-xs"
                >
                  Resume
                </button>
                <button
                  onClick={() => handleControl('abort', selectedMission?._id)}
                  className="px-3 py-2 bg-red-500 text-white rounded text-xs"
                >
                  Abort
                </button>
              </div>
              <div className="mt-3 text-sm text-gray-500">Map Options</div>
              <div className="flex flex-col gap-2 mt-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showWaypoints}
                    onChange={e => setShowWaypoints(e.target.checked)}
                  />{' '}
                  Show waypoints
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showTrails}
                    onChange={e => setShowTrails(e.target.checked)}
                  />{' '}
                  Show trails
                </label>
                <label className="flex items-center gap-2">
                  Area opacity
                  <input
                    type="range"
                    min={0}
                    max={0.6}
                    step={0.02}
                    value={areaOpacity}
                    onChange={e => setAreaOpacity(Number(e.target.value))}
                    className="ml-2"
                  />
                </label>
                <label className="flex items-center gap-2">
                  Basemap
                  <select
                    value={basemap}
                    onChange={e => setBasemap(e.target.value)}
                    className="ml-2 text-sm border rounded px-2 py-1"
                  >
                    <option value="osm">OpenStreetMap</option>
                    <option value="sat">Satellite (Stamen Toner)</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {/* RIGHT: map + mission details */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-2xl shadow p-3">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-lg font-semibold">Map Preview</div>
                  <div className="text-xs text-gray-500">
                    Click a mission to focus it. Use controls to show all missions or fine-tune map.
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Selected: {selectedMission?.name ?? '—'}
                </div>
              </div>
              <div style={{ height: '68vh' }} className="rounded overflow-hidden">
                <MapContainer center={[20, 0]} zoom={2} style={{ height: '100%', width: '100%' }}>
                  {basemap === 'osm' ? (
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />
                  ) : (
                    <TileLayer
                      url="https://stamen-tiles.a.ssl.fastly.net/toner/{z}/{x}/{y}.png"
                      attribution="Map tiles by Stamen"
                    />
                  )}
                  {!showAll && selectedMission && <FitToBounds mission={selectedMission} />}

                  {/* Polygons */}
                  {missionsOnMap.map(m => {
                    const poly = closePolygon(
                      (m.area || []).map(pt => normalizePoint(pt)).filter(Boolean),
                    );
                    if (poly.length < 3) return null;
                    const highlight = selected && selected._id === m._id;
                    return (
                      <Polygon
                        key={`area-${m._id}`}
                        positions={poly}
                        pathOptions={{
                          color: highlight ? '#065f46' : '#10b981',
                          weight: highlight ? 3 : 2,
                          fillColor: highlight ? '#10b981' : '#34d399',
                          fillOpacity: areaOpacity,
                          dashArray: highlight ? null : '6 6',
                        }}
                      />
                    );
                  })}

                  {/* Flight paths */}
                  {missionsOnMap.map(m => {
                    const coords = (m.flightPath || []).map(wp => [wp.lat, wp.lng]);
                    if (!coords.length) return null;
                    const highlight = selected && selected._id === m._id;
                    return (
                      <Polyline
                        key={`path-${m._id}`}
                        positions={coords}
                        pathOptions={{
                          color: highlight ? '#1e40af' : '#2563eb',
                          weight: highlight ? 4 : 3,
                        }}
                      />
                    );
                  })}

                  {/* Waypoints */}
                  {showWaypoints &&
                    missionsOnMap.map(m =>
                      (m.flightPath || []).map((wp, i) => (
                        <Marker
                          key={`${m._id}-wp-${i}`}
                          position={[wp.lat, wp.lng]}
                          icon={L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background:#fff;border:1px solid #444;border-radius:4px;padding:1px 3px;font-size:10px;">${i + 1}</div>`,
                          })}
                        >
                          <Popup>
                            WP {i + 1}
                            <br /> Alt {wp.alt}
                          </Popup>
                        </Marker>
                      )),
                    )}

                  {/* Live positions & trails */}
                  {missionsOnMap.map(m => {
                    const pos = livePositions[m._id];
                    const highlight = selected && selected._id === m._id;
                    const trail = (historyRef.current[m._id] || []).map(h => h.pos);
                    return (
                      <React.Fragment key={`live-${m._id}`}>
                        {pos && (
                          <Marker
                            position={[pos.lat, pos.lng]}
                            icon={L.divIcon({
                              className: '',
                              html: `<div style="width:16px;height:16px;background:${
                                highlight ? '#dc2626' : '#ef4444'
                              };border-radius:50%;border:2px solid white;"></div>`,
                            })}
                          >
                            <Popup>
                              <div className="text-sm">
                                Drone<br />
                                Alt: {pos.alt}
                              </div>
                            </Popup>
                          </Marker>
                        )}
                        {showTrails && trail.length >= 2 && (
                          <Polyline
                            positions={trail.map(p => [p.lat, p.lng])}
                            pathOptions={{
                              color: highlight ? '#ef4444' : '#f87171',
                              weight: 2,
                              dashArray: '3 4',
                            }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </MapContainer>
              </div>
            </div>

            {/* Selected details */}
            {selectedMission && (
              <div className="bg-white rounded-2xl shadow p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">Mission Details</div>
                  <div className="text-sm text-gray-500">{selectedMission.status}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-700">
                  <div>
                    Name
                    <div className="font-semibold">{selectedMission.name}</div>
                  </div>
                  <div>
                    Progress
                    <div className="font-semibold">{selectedMission.progress ?? 0}%</div>
                  </div>
                  <div>
                    Waypoints
                    <div className="font-semibold">
                      {(selectedMission.flightPath || []).length}
                    </div>
                  </div>
                  <div>
                    Created
                    <div className="font-semibold">
                      {selectedMission.createdAt
                        ? new Date(selectedMission.createdAt).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
