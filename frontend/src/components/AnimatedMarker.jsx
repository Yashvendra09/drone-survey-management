// AnimatedMarker.jsx
import { useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet icons for Vite
export default function AnimatedMarker({ id, position, children, duration = 600 }) {
  const markerRef = useRef(null);
  const lastPosRef = useRef(position);
  const animRef = useRef(null);
  const map = useMap();

  useEffect(() => {
    // ensure lastPosRef is initialized
    if (!lastPosRef.current) lastPosRef.current = position;
  }, []);

  useEffect(() => {
    if (!position) return;
    const start = lastPosRef.current;
    const end = position;
    const startTs = performance.now();

    const step = (now) => {
      const t = Math.min(1, (now - startTs) / duration);
      const lat = start.lat + (end.lat - start.lat) * t;
      const lng = start.lng + (end.lng - start.lng) * t;

      if (markerRef.current && markerRef.current.setLatLng) {
        markerRef.current.setLatLng([lat, lng]);
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(step);
      } else {
        lastPosRef.current = end;
        animRef.current = null;
      }
    };

    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(step);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [position, duration]);

  // when marker created, center it at position (avoid jump)
  return (
    <Marker
      ref={markerRef}
      position={[position.lat, position.lng]}
      eventHandlers={{
        add() {
          // ensure map keeps marker in view if desired
        }
      }}
      // shadowless small circle icon (optional)
      icon={new L.DivIcon({
        className: 'animated-marker',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid white;box-shadow:0 0 6px rgba(0,0,0,0.15)"></div>`
      })}
    >
      {children && <Popup>{children}</Popup>}
    </Marker>
  );
}
