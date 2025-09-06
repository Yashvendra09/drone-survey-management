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

export function generateLawnmower(polygonLatLngs = [], spacingMeters = 30, altitude = 30, maxPoints = 800) {
  if (!polygonLatLngs || polygonLatLngs.length < 3) return [];

  // Convert to GeoJSON polygon: turf expects [ [lng,lat], ... ]
  const coords = polygonLatLngs.map((p) => [p[1], p[0]]);
  // ensure closed polygon
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  const polygon = turf.polygon([coords]);

  const bbox = turf.bbox(polygon); // [minX, minY, maxX, maxY] in [lng, lat]
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // We'll step latitude from minLat to maxLat
  const deltaLatDeg = metersToDegLat(spacingMeters);

  const lines = [];
  // safety: guard against infinite loops by computing an upper bound
  const maxLines = Math.max(1, Math.ceil((maxLat - minLat) / Math.max(1e-9, deltaLatDeg)) + 2);
  const effectiveLines = Math.min(maxLines, 5000); // absolute safety cap

  for (let i = 0; i <= effectiveLines; i++) {
    const lat = minLat + i * deltaLatDeg;
    if (lat > maxLat + deltaLatDeg) break;
    const line = turf.lineString([
      [minLng - 1, lat], // extend slightly beyond bbox to ensure intersection
      [maxLng + 1, lat],
    ]);
    lines.push(line);
  }

  const sweepPoints = [];
  let flip = false; // alternate direction

  for (const line of lines) {
    const intersects = turf.lineIntersect(line, polygon);

    if (!intersects || intersects.features.length === 0) continue;

    // get intersection points as [lng, lat]
    const pts = intersects.features.map((f) => f.geometry.coordinates);
    // sort by longitude
    pts.sort((a, b) => a[0] - b[0]);

    // Pair the points sequentially (0-1, 2-3, etc.)
    for (let j = 0; j + 1 < pts.length; j += 2) {
      const a = pts[j];
      const b = pts[j + 1];

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

  // Remove consecutive duplicates
  const filtered = [];
  for (let i = 0; i < sweepPoints.length; i++) {
    const cur = sweepPoints[i];
    const prev = filtered[filtered.length - 1];
    if (!prev || prev.lat !== cur.lat || prev.lng !== cur.lng) {
      filtered.push({ ...cur, order: filtered.length });
    }
  }

  // If too many waypoints, downsample uniformly to maxPoints
  if (filtered.length > maxPoints) {
    const step = Math.ceil(filtered.length / maxPoints);
    const downsampled = filtered.filter((_, idx) => idx % step === 0).map((p, idx) => ({ ...p, order: idx }));
    return downsampled;
  }

  return filtered;
}

