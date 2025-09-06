// frontend/src/pages/MissionPlanner.jsx
import React, { useState, useMemo, useEffect } from 'react';
import PolygonDrawer from '../components/PolygonDrawer';
import { generatePerimeter, generateLawnmower } from '../utils/waypointGenerator';
import { fetchDrones, createMission } from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';
import LiveMap from '../components/LiveMap';

const PATTERN_LABEL = {
  grid: 'Lawnmower',
  crosshatch: 'Crosshatch',
  perimeter: 'Perimeter',
  lawnmower: 'Lawnmower',
};

export default function MissionPlanner() {
  const [polygon, setPolygon] = useState(null); // [[lat,lng], ...]
  const [name, setName] = useState('');
  // canonical values: 'grid' | 'perimeter' | 'crosshatch'
  const [pattern, setPattern] = useState('grid');
  const [altitude, setAltitude] = useState(40);
  const [overlap, setOverlap] = useState(20);
  const [swathWidth, setSwathWidth] = useState(60);
  const [generatedPath, setGeneratedPath] = useState([]); // waypoints {lat,lng,alt,order}
  const [previewOnMap, setPreviewOnMap] = useState(true);
  const [busy, setBusy] = useState(false);

  const [drones, setDrones] = useState([]);
  const [selectedDrone, setSelectedDrone] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [warningMsg, setWarningMsg] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  // load drones once, and if query param present pre-select drone
  useEffect(() => {
    let mounted = true;
    async function loadDrones() {
      try {
        const data = await fetchDrones();
        if (!mounted) return;
        setDrones(Array.isArray(data) ? data : []);
        // If only one drone available, select it
        if (Array.isArray(data) && data.length === 1) {
          setSelectedDrone(data[0]._id);
        }
      } catch (err) {
        console.error('Failed to load drones', err);
      }
    }
    loadDrones();
    return () => { mounted = false; };
  }, []);

  // Pre-select drone from query param when navigated from Drones page (e.g., /planner?drone=<id>)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const droneId = params.get('drone');
    if (droneId) {
      setSelectedDrone(droneId);
      // remove the query param from the URL to avoid confusion on refresh (non-destructive)
      const url = new URL(window.location.href);
      url.searchParams.delete('drone');
      window.history.replaceState({}, '', url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // -----------------------
  // Helpers
  // -----------------------
  function downsampleWaypoints(waypoints, maxPoints = 800) {
    if (!Array.isArray(waypoints) || waypoints.length <= maxPoints) return waypoints;
    const n = waypoints.length;
    const step = (n - 1) / (maxPoints - 1);
    const out = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.round(i * step);
      out.push(waypoints[Math.min(idx, n - 1)]);
    }
    return out;
  }

  function normalizeGeneratorOutput(rawPath, defaultAlt) {
    if (!Array.isArray(rawPath)) return [];
    return rawPath
      .map((p, idx) => {
        if (!p) return null;
        if (Array.isArray(p)) {
          const a = Number(p[0]), b = Number(p[1]), c = p.length > 2 ? Number(p[2]) : defaultAlt;
          if (Number.isFinite(a) && Number.isFinite(b)) {
            return { lat: a, lng: b, alt: Number.isFinite(c) ? c : defaultAlt, order: idx };
          }
          // try swapped
          if (Number.isFinite(Number(p[1])) && Number.isFinite(Number(p[0]))) {
            return { lat: Number(p[1]), lng: Number(p[0]), alt: Number.isFinite(Number(c)) ? c : defaultAlt, order: idx };
          }
        }
        if (typeof p === 'object') {
          const lat = Number(p.lat ?? p.latitude ?? p[0] ?? p[1]);
          const lng = Number(p.lng ?? p.longitude ?? p[1] ?? p[0]);
          const alt = Number(p.alt ?? p.altitude ?? defaultAlt);
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng, alt: Number.isFinite(alt) ? alt : defaultAlt, order: idx };
          }
        }
        return null;
      })
      .filter(Boolean);
  }

  // -----------------------
  // Generation
  // -----------------------
  const generate = () => {
    setErrorMsg('');
    setWarningMsg('');
    if (!polygon || polygon.length < 3) {
      setErrorMsg('Draw polygon first.');
      return;
    }

    const effSpacing = Math.max(5, swathWidth * (1 - (Number(overlap) || 0) / 100));

    const polyAsArrays = (polygon || []).map((pt) =>
      Array.isArray(pt) ? [Number(pt[0]), Number(pt[1])] : [Number(pt.lat ?? pt[0]), Number(pt.lng ?? pt[1])]
    );

    if (!polyAsArrays.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))) {
      console.error('polygon points invalid', polygon, polyAsArrays);
      setErrorMsg('Polygon contains invalid coordinates. Re-draw polygon.');
      return;
    }

    let rawPath = [];
    try {
      if (pattern === 'perimeter') {
        rawPath = generatePerimeter(polyAsArrays, altitude);
      } else {
        // For grid/lawnmower and crosshatch pattern, we use generateLawnmower for now
        rawPath = generateLawnmower(polyAsArrays, effSpacing, altitude);
      }
    } catch (err) {
      console.error('Generator threw error:', err);
      rawPath = [];
    }

    // fallback: try swapped lat/lng if empty
    if ((!rawPath || rawPath.length === 0) && polyAsArrays.length) {
      const swapped = polyAsArrays.map(p => [p[1], p[0]]);
      try {
        if (pattern === 'perimeter') {
          rawPath = generatePerimeter(swapped, altitude);
        } else {
          rawPath = generateLawnmower(swapped, effSpacing, altitude);
        }
        if (rawPath && rawPath.length) {
          console.warn('Generator succeeded after swapping lat/lng order — coordinate ordering mismatch.');
        }
      } catch (err) {
        console.error('Generator still threw after swapping:', err);
        rawPath = [];
      }
    }

    if (!rawPath || rawPath.length === 0) {
      console.error('Path generation failed. Inputs:', { polygon: polyAsArrays, effSpacing, altitude, pattern });
      setErrorMsg('Could not generate path: check polygon size/spacing or open console for details.');
      return;
    }

    const normalized = normalizeGeneratorOutput(rawPath, altitude);

    if (!normalized.length) {
      console.error('Normalized path empty after attempting to interpret generator output', rawPath);
      setErrorMsg('Generator produced an unrecognized output format. Check console for raw output.');
      return;
    }

    setGeneratedPath(normalized);

    // warn about payload size
    try {
      const payload = JSON.stringify(normalized);
      const bytes = new Blob([payload]).size;
      const kb = (bytes / 1024).toFixed(1);
      if (bytes > 500 * 1024) { // > 500KB
        setWarningMsg(`Generated path is large (${kb} KB). It may be slow to save. Consider downsampling or reducing swath/overlap.`);
      }
    } catch (e) {
      // ignore
    }
  };

  // -----------------------
  // Create mission (safe)
  // -----------------------
  const handleCreate = async () => {
    setErrorMsg('');
    setWarningMsg('');
    if (!selectedDrone) {
      setErrorMsg('Please select a drone before creating the mission.');
      return;
    }
    if (!generatedPath || generatedPath.length === 0) {
      setErrorMsg('Generate flight path before creating mission.');
      return;
    }

    setBusy(true);
    try {
      // downsample to keep payload reasonable
      const capped = downsampleWaypoints(generatedPath, 800);

      // sanitize & coerce types
      const safeFlightPath = capped.map((p, idx) => ({
        lat: Number(p.lat),
        lng: Number(p.lng),
        alt: Number(p.alt ?? altitude),
        order: Number(p.order ?? idx),
      }));

      // client-side validation
      for (let i = 0; i < safeFlightPath.length; i++) {
        const wp = safeFlightPath[i];
        if (!Number.isFinite(wp.lat) || !Number.isFinite(wp.lng)) {
          setErrorMsg(`Waypoint ${i + 1} has invalid coordinates. Aborting.`);
          setBusy(false);
          return;
        }
      }

      // payload uses canonical pattern value (pattern state is canonical)
      const payload = {
        name: name || `Mission ${new Date().toISOString()}`,
        drone: selectedDrone,
        pattern, // canonical: 'grid' | 'perimeter' | 'crosshatch'
        altitude,
        overlap,
        swathWidth,
        flightPath: safeFlightPath,
        areaCoordinates: polygon?.map((pt) =>
          Array.isArray(pt) ? { lat: pt[0], lng: pt[1] } : pt
        ),
        sensors: ['camera'],
      };

      // log payload size for debugging and warn user if > 1.5MB
      try {
        const size = new Blob([JSON.stringify(payload)]).size;
        console.log('Payload size (bytes):', size, '≈', (size / 1024 / 1024).toFixed(2), 'MB');
        if (size > 1.5 * 1024 * 1024) {
          setWarningMsg('Payload is very large (>1.5MB). Consider downsampling flight path to avoid request failures.');
          // don't block automatically — allow user to proceed if they want.
        }
      } catch (e) {
        console.warn('Could not compute payload size', e);
      }

      await createMission(payload);
      alert('Mission created successfully');
      navigate('/missions');
    } catch (err) {
      console.error('Create mission failed (client):', err);
      const msg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Unknown error';
      setErrorMsg('Failed to create mission: ' + String(msg));
    } finally {
      setBusy(false);
    }
  };

  // Preview for LiveMap
  const previewWaypoints = useMemo(() => {
    if (!generatedPath || !generatedPath.length) return [];
    // Show only a visually representative subset for map preview.
    const maxPreviewPoints = 800;
    if (generatedPath.length <= maxPreviewPoints) return generatedPath;
    // pick roughly evenly-spaced points for preview
    const step = (generatedPath.length - 1) / (maxPreviewPoints - 1);
    const out = [];
    for (let i = 0; i < maxPreviewPoints; i++) {
      const idx = Math.round(i * step);
      out.push(generatedPath[Math.min(idx, generatedPath.length - 1)]);
    }
    return out;
  }, [generatedPath]);

    const previewWaypoints = useMemo(() => {
    if (!generatedPath || !generatedPath.length) return [];
    // Show only a visually representative subset for map preview.
    const maxPreviewPoints = 800;
    if (generatedPath.length <= maxPreviewPoints) return generatedPath;
    // pick roughly evenly-spaced points for preview
    const step = (generatedPath.length - 1) / (maxPreviewPoints - 1);
    const out = [];
    for (let i = 0; i < maxPreviewPoints; i++) {
      const idx = Math.round(i * step);
      out.push(generatedPath[Math.min(idx, generatedPath.length - 1)]);
    }
    return out;
  }, [generatedPath]);

  const mapMissionsPreview = useMemo(() => {
    if (!previewOnMap || !previewWaypoints.length) return [];
    return [
      {
        _id: 'preview',
        name: name || 'Preview Mission',
        flightPath: previewWaypoints.map((p) => ({ lat: p.lat, lng: p.lng, alt: p.alt })),
        area: polygon?.map((pt) => (Array.isArray(pt) ? { lat: pt[0], lng: pt[1] } : pt)),
      },
    ];
  }, [previewWaypoints, previewOnMap, name, polygon]);


  // selected drone details for UI card
  const selectedDroneObj = useMemo(() => {
    return drones.find(d => d._id === selectedDrone) || null;
  }, [drones, selectedDrone]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Mission Planner</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT SIDE: Map + Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow p-4">
            <h2 className="font-medium mb-2">Draw Survey Area</h2>
            <PolygonDrawer
              initialCenter={[20, 0]}
              initialZoom={3}
              onPolygonComplete={(pts) => {
                setPolygon(pts);
                setGeneratedPath([]);
                setWarningMsg('');
                setErrorMsg('');
              }}
            />
            <div className="mt-2 text-xs text-gray-500">
              Tip: click the map to add polygon points. After finishing, press "Generate Path".
            </div>
          </div>

          <div className="mt-4 bg-white rounded-2xl shadow p-4">
            <h2 className="font-medium mb-2">Flight Path Preview</h2>

            <div className="flex items-center gap-2 mb-3">
              <button onClick={generate} className="px-3 py-2 bg-blue-600 text-white rounded">Generate Path</button>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={previewOnMap} onChange={(e) => setPreviewOnMap(e.target.checked)} />
                Show on map
              </label>

              <div className="ml-auto text-xs text-gray-500">
                Generated waypoints: {generatedPath?.length ?? 0}
              </div>
            </div>

            {warningMsg && <div className="mb-2 text-sm text-yellow-700 bg-yellow-50 p-2 rounded">{warningMsg}</div>}
            {errorMsg && <div className="mb-2 text-sm text-red-700 bg-red-50 p-2 rounded">{errorMsg}</div>}

            {generatedPath.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">First waypoints (showing up to 8):</div>
                <div className="text-xs bg-gray-50 p-2 rounded max-h-40 overflow-auto">
                  {generatedPath.slice(0, 8).map((wp, i) => (
                    <div key={i}>
                      {i + 1}. {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)} — alt {wp.alt}m
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDE: Form */}
        <div>
          <div className="bg-white rounded-2xl shadow p-4 space-y-3">
            <div>
              <label className="text-sm text-gray-600">Mission name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded px-2 py-2 mt-1 text-sm" placeholder="Optional mission name" />
            </div>

            <div>
              <label className="text-sm text-gray-600">Assign Drone</label>
              <select value={selectedDrone} onChange={(e) => setSelectedDrone(e.target.value)} className="w-full border rounded px-2 py-2 mt-1 text-sm">
                <option value="">-- Select a drone --</option>
                {drones.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name || `Drone ${d._id.substring(0, 6)}`} ({d.status})
                  </option>
                ))}
              </select>
              {drones.length === 0 && <div className="text-xs text-gray-400 mt-1">No drones available. Add one in Fleet.</div>}
            </div>

            {selectedDroneObj && (
              <div className="p-2 border rounded text-xs bg-gray-50">
                <div className="font-medium">{selectedDroneObj.name}</div>
                <div className="text-xs text-gray-500">Model: {selectedDroneObj.model || '—'}</div>
                <div className="text-xs">Status: <span className="font-medium">{selectedDroneObj.status}</span> • Battery: {selectedDroneObj.batteryLevel ?? '—'}%</div>
                <div className="text-xs text-gray-400 mt-1">ID: {selectedDroneObj._id}</div>
              </div>
            )}

            <div>
              <label className="text-sm text-gray-600">Pattern</label>
              <select value={pattern} onChange={(e) => setPattern(e.target.value)} className="w-full border rounded px-2 py-2 mt-1 text-sm">
                <option value="grid">Lawnmower (grid)</option>
                <option value="perimeter">Perimeter</option>
                <option value="crosshatch">Crosshatch</option>
              </select>
              <div className="text-xs text-gray-400 mt-1">Pattern: {PATTERN_LABEL[pattern]}</div>
            </div>

            <div>
              <label className="text-sm text-gray-600">Altitude (m)</label>
              <input type="number" value={altitude} onChange={(e) => setAltitude(Number(e.target.value))} className="w-full border rounded px-2 py-2 mt-1 text-sm" />
            </div>

            <div>
              <label className="text-sm text-gray-600">Swath width (m)</label>
              <input type="number" value={swathWidth} onChange={(e) => setSwathWidth(Number(e.target.value))} className="w-full border rounded px-2 py-2 mt-1 text-sm" />
              <div className="text-xs text-gray-400">Camera swath width at given altitude. Used for spacing.</div>
            </div>

            <div>
              <label className="text-sm text-gray-600">Overlap (%)</label>
              <input type="number" min={0} max={90} value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} className="w-full border rounded px-2 py-2 mt-1 text-sm" />
            </div>

            <div className="pt-2">
              <button onClick={handleCreate} disabled={busy || !selectedDrone || (generatedPath?.length === 0)} className="w-full px-3 py-2 bg-green-600 text-white rounded disabled:opacity-60">
                {busy ? 'Creating…' : 'Create Mission'}
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Note: you must select a drone and generate a flight path before creating a mission.
            </div>
          </div>
        </div>
      </div>

      {/* Map preview */}
      {previewOnMap && (
        <div className="bg-white rounded-2xl shadow p-4">
          <h3 className="font-medium mb-2">Map Preview</h3>
          <LiveMap
            missions={mapMissionsPreview}
            livePositions={{}}
            center={polygon?.length ? [polygon[0][0], polygon[0][1]] : [20, 0]}
            zoom={polygon ? 14 : 2}
          />
        </div>
      )}
    </div>
  );
}
