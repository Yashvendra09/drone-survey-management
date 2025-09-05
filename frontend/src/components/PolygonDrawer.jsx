// frontend/src/components/PolygonDrawer.jsx
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// simple small marker icon to be consistent
const smallIcon = new L.DivIcon({
  className: 'drawer-marker',
  html: `<div style="width:10px;height:10px;border-radius:50%;background:#2563eb;border:2px solid white"></div>`
});

/**
 * Map click handler component
 */
function ClickHandler({ onMapClick, drawing }) {
  useMapEvents({
    click(e) {
      if (drawing) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

/**
 * Props:
 *  - initialCenter [lat, lng]
 *  - initialZoom
 *  - onPolygonComplete(polygonLatLngs) called when user finishes polygon
 */
export default function PolygonDrawer({
  initialCenter = [20, 0],
  initialZoom = 4,
  onPolygonComplete = () => {},
}) {
  const [drawing, setDrawing] = useState(true);
  const [points, setPoints] = useState([]);

  useEffect(() => {
    // reset when drawing toggles off? no-op
  }, [drawing]);

  const handleMapClick = (latlng) => {
    setPoints((p) => [...p, latlng]);
  };

  const undo = () => {
    setPoints((p) => p.slice(0, -1));
  };

  const clear = () => {
    setPoints([]);
  };

  const finish = () => {
    if (points.length < 3) {
      alert('Draw at least 3 points to form a polygon.');
      return;
    }
    setDrawing(false);
    onPolygonComplete(points);
  };

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <button onClick={() => setDrawing(true)} className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Draw</button>
        <button onClick={undo} className="px-3 py-1 rounded bg-gray-100 text-sm">Undo</button>
        <button onClick={clear} className="px-3 py-1 rounded bg-gray-100 text-sm">Clear</button>
        <button onClick={finish} className="px-3 py-1 rounded bg-green-600 text-white text-sm">Finish Polygon</button>
        <div className="text-sm text-gray-500 ml-auto">{points.length} points</div>
      </div>

      <div className="w-full h-96 rounded overflow-hidden shadow-sm">
        <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <ClickHandler onMapClick={handleMapClick} drawing={drawing} />
          {points.length > 0 && (
            <>
              {points.map((pt, i) => (
                <Marker key={i} position={[pt[0], pt[1]]} icon={smallIcon} />
              ))}
              <Polyline positions={points.map((p) => [p[0], p[1]])} />
            </>
          )}
          {points.length >= 3 && (
            <Polygon positions={points.map((p) => [p[0], p[1]])} pathOptions={{ color: '#10b981', fillOpacity: 0.08 }} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}