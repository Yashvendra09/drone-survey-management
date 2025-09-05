// frontend/src/components/LiveMap.jsx
import React, { useEffect, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  CircleMarker,
  Polygon,
  LayersControl,
  ScaleControl,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AnimatedMarker from './AnimatedMarker';

// Fix leaflet icons for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// Fit-to-bounds helper component
function FitToData({ bounds, fitToMission }) {
  const map = useMap();
  useEffect(() => {
    if (!bounds || !bounds.isValid()) return;
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 17, animate: true });
  }, [bounds, map, fitToMission]);
  return null;
}

// ensure polygon closed and coords are [lat,lng], robust filtering
function normalizePoint(pt) {
  if (!pt) return null;
  if (Array.isArray(pt) && pt.length >= 2) {
    const a = Number(pt[0]), b = Number(pt[1]);
    if (!isFinite(a) || !isFinite(b)) return null;
    // heuristic swap if likely [lng,lat]
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
  const first = coords[0], last = coords[coords.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-9 && Math.abs(first[1] - last[1]) < 1e-9) {
    return coords;
  }
  return [...coords, first];
}

export default function LiveMap({
  missions = [],
  livePositions = {},
  center = [20, 0],
  zoom = 2,
  replayPos,
  selectedMission = null, // pass the selected mission object (not just id)
  showWaypointsForSelected = true,
  areaOpacity = 0.28, 
}) {
  // Areas
  const areas = useMemo(() => {
    return missions
      .map((m) => {
        const raw = m.areaCoordinates ?? m.area ?? m.areaCoords ?? m.polygon ?? [];
        const coords = (Array.isArray(raw) ? raw : [])
          .map(normalizePoint)
          .filter(Boolean);
        return { id: m._id ?? m.id ?? m.name, name: m.name, coords: closePolygon(coords) };
      })
      .filter((a) => a.coords && a.coords.length >= 3);
  }, [missions]);

  // Flight paths
  const polylines = useMemo(() => {
    return missions.map((m) => {
      const raw = m.flightPath ?? m.flight_path ?? m.path ?? [];
      const coords = (Array.isArray(raw) ? raw : [])
        .map(normalizePoint)
        .filter(Boolean);
      return { id: m._id ?? m.id ?? m.name, name: m.name, coords };
    });
  }, [missions]);

  // Waypoint dots (sparse)
  const waypointDots = useMemo(() => {
    return missions.map((m) => {
      const fps = Array.isArray(m.flightPath ?? m.flight_path ?? m.path) ? (m.flightPath ?? m.flight_path ?? m.path) : [];
      const step = Math.max(1, Math.floor(fps.length / 60));
      const pts = fps
        .map((wp, i) => ({ i, wp }))
        .filter((p) => p.i % step === 0 || p.i === 0 || p.i === fps.length - 1);
      return { id: m._id ?? m.id ?? m.name, pts };
    });
  }, [missions]);

  // Build bounds from everything we can
  const bounds = useMemo(() => {
    const b = new L.LatLngBounds();
    let any = false;
    areas.forEach((a) => {
      a.coords.forEach((c) => {
        b.extend(c);
        any = true;
      });
    });
    polylines.forEach((p) => p.coords.forEach((c) => {
      b.extend(c);
      any = true;
    }));
    Object.values(livePositions).forEach((pos) => {
      if (pos && Number.isFinite(Number(pos.lat)) && Number.isFinite(Number(pos.lng))) {
        b.extend([Number(pos.lat), Number(pos.lng)]);
        any = true;
      }
    });
    if (replayPos && Number.isFinite(Number(replayPos.lat)) && Number.isFinite(Number(replayPos.lng))) {
      b.extend([Number(replayPos.lat), Number(replayPos.lng)]);
      any = true;
    }
    return any ? b : null;
  }, [areas, polylines, livePositions, replayPos]);

  const selectedId = selectedMission?._id ?? selectedMission?.id ?? null;

  return (
    <div className="w-full h-[70vh] rounded-lg overflow-hidden shadow">
      <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }} zoomControl={true}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Esri Satellite">
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="Tiles &copy; Esri" />
          </LayersControl.BaseLayer>

          <LayersControl.Overlay checked name="Survey Areas">
            <>
              {areas.map((a) => {
                const isSel = selectedId && String(a.id) === String(selectedId);
                // stronger non-selected opacity so it is visible on bright maps
                const nonSelOpacity = Math.max(0.12, areaOpacity * 0.35);
                return (
                  <Polygon
                    key={`area-${a.id}`}
                    positions={a.coords}
                    pathOptions={{
                      color: isSel ? '#059669' : '#64748b',
                      weight: isSel ? 2.5 : 1.5,
                      // explicit fill flag and slightly stronger colors
                      fill: true,
                      fillColor: isSel ? '#10b981' : '#94a3b8',
                      fillOpacity: isSel ? areaOpacity : nonSelOpacity,
                      dashArray: isSel ? null : '6 6',
                    }}
                  >
                    <Tooltip direction="center" permanent opacity={0.9} className="!bg-transparent !border-0">
                      <span className="text-xs font-medium">{a.name || `Mission ${a.id}`}</span>
                    </Tooltip>
                  </Polygon>
                );
              })}
            </>
          </LayersControl.Overlay>

          <LayersControl.Overlay checked name="Flight Paths">
            <>
              {polylines.map((p) =>
                p.coords.length > 1 ? (
                  <Polyline
                    key={`line-${p.id}`}
                    positions={p.coords}
                    pathOptions={{
                      color: selectedId && String(p.id) === String(selectedId) ? '#2563eb' : '#9ca3af',
                      weight: selectedId && String(p.id) === String(selectedId) ? 3 : 2,
                      opacity: selectedId && String(p.id) === String(selectedId) ? 1 : 0.8,
                      dashArray: selectedId && String(p.id) === String(selectedId) ? null : '4 6',
                    }}
                  />
                ) : null
              )}
            </>
          </LayersControl.Overlay>

          <LayersControl.Overlay name="Waypoint Dots">
            <>
              {showWaypointsForSelected && selectedId && (() => {
                const sel = missions.find(m => String(m._id ?? m.id) === String(selectedId));
                if (!sel) return null;
                const fps = sel.flightPath ?? sel.flight_path ?? sel.path ?? [];
                return fps.map((wp, i) => {
                  const p = normalizePoint(wp);
                  if (!p) return null;
                  return (
                    <CircleMarker key={`wp-${selectedId}-${i}`} center={p} radius={4} pathOptions={{ color: '#2563eb', fillColor: '#2563eb' }}>
                      <Tooltip direction="top" offset={[0, -6]}>
                        <div className="text-[10px]">
                          WP {i + 1} <br /> alt {Number(wp.alt ?? wp.altitude ?? wp[2] ?? 0)}m
                        </div>
                      </Tooltip>
                    </CircleMarker>
                  );
                });
              })()}
            </>
          </LayersControl.Overlay>
        </LayersControl>

        {/* Start markers */}
        {polylines.map((p) => {
          if (!p.coords || p.coords.length === 0) return null;
          const start = p.coords[0];
          return (
            <Marker key={`start-${p.id}`} position={start}>
              <Popup>
                <div className="text-sm font-semibold">{p.name || `Mission ${p.id}`}</div>
                <div className="text-xs">Start point</div>
              </Popup>
            </Marker>
          );
        })}

        {/* Animated live markers */}
        {Object.entries(livePositions).map(([missionId, pos]) => {
          if (!pos) return null;
          const n = normalizePoint(pos);
          if (!n) return null;
          const payload = { lat: Number(n[0]), lng: Number(n[1]) };
          return (
            <AnimatedMarker key={`live-${missionId}`} id={missionId} position={payload}>
              <div>
                <div className="font-medium truncate max-w-[160px]">Mission {missionId}</div>
                <div className="text-xs">Lat: {Number(payload.lat).toFixed(5)} | Lng: {Number(payload.lng).toFixed(5)}</div>
                {Number.isFinite(Number(pos.alt)) && <div className="text-xs">Alt: {Math.round(pos.alt)} m</div>}
              </div>
            </AnimatedMarker>
          );
        })}

        {/* Replay marker */}
        {replayPos && Number.isFinite(Number(replayPos.lat)) && Number.isFinite(Number(replayPos.lng)) && (
          <CircleMarker center={[Number(replayPos.lat), Number(replayPos.lng)]} radius={8} pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.9 }}>
            <Popup>
              <div className="text-xs">Replay</div>
            </Popup>
          </CircleMarker>
        )}

        <ScaleControl position="bottomleft" />
        <FitToData bounds={bounds} fitToMission={selectedMission} />
      </MapContainer>
    </div>
  );
}
