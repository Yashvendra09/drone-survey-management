// frontend/src/utils/waypointGenerator.js
import * as turf from '@turf/turf';

const metersToDegLat = (meters) => meters / 111320;
const metersToDegLon = (meters, lat) => {
  const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  return metersPerDegLon <= 0 ? 0 : meters / metersPerDegLon;
};

export function generatePerimeter(polygonLatLngs = [], altitude = 30) {
  return polygonLatLngs.map((p, idx) => ({
    lat: p[0],
    lng: p[1],
    alt: altitude,
    order: idx,
  }));
}

export function generateLawnmower(polygonLatLngs = [], spacingMeters = 30, altitude = 30, maxWaypoints = 200) {
  if (!polygonLatLngs || polygonLatLngs.length < 3) return [];

  const coords = polygonLatLngs.map((p) => [p[1], p[0]]);
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  const polygon = turf.polygon([coords]);

  const bbox = turf.bbox(polygon);
  const [minLng, minLat, maxLng, maxLat] = bbox;

  const midLat = (minLat + maxLat) / 2;
  const deltaLatDeg = metersToDegLat(spacingMeters);

  const lines = [];
  for (let lat = minLat; lat <= maxLat + deltaLatDeg; lat += deltaLatDeg) {
    const line = turf.lineString([
      [minLng - 1, lat],
      [maxLng + 1, lat],
    ]);
    lines.push(line);
  }

  const sweepPoints = [];
  let flip = false;

  for (const line of lines) {
    const intersects = turf.lineIntersect(line, polygon);
    if (!intersects || intersects.features.length === 0) continue;

    const pts = intersects.features.map((f) => f.geometry.coordinates);
    pts.sort((a, b) => a[0] - b[0]);

    for (let i = 0; i + 1 < pts.length; i += 2) {
      const a = pts[i];
      const b = pts[i + 1];

      if (!flip) {
        sweepPoints.push({ lat: a[1], lng: a[0], alt: altitude });
        sweepPoints.push({ lat: b[1], lng: b[0], alt: altitude });
      } else {
        sweepPoints.push({ lat: b[1], lng: b[0], alt: altitude });
        sweepPoints.push({ lat: a[1], lng: a[0], alt: altitude });
      }
    }

    flip = !flip;
  }

  // ✅ Downsample waypoints if too many
  let filtered = [];
  for (let i = 0; i < sweepPoints.length; i++) {
    const cur = sweepPoints[i];
    const prev = filtered[filtered.length - 1];
    if (!prev || prev.lat !== cur.lat || prev.lng !== cur.lng) {
      filtered.push(cur);
    }
  }

  // ✅ Reduce to maxWaypoints evenly
  if (filtered.length > maxWaypoints) {
    const step = Math.ceil(filtered.length / maxWaypoints);
    filtered = filtered.filter((_, i) => i % step === 0 || i === filtered.length - 1);
  }

  return filtered.map((p, idx) => ({ ...p, order: idx }));
}
