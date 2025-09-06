// frontend/src/utils/waypointGenerator.js
import * as turf from '@turf/turf';

/**
 * Convert spacing in meters to approx degrees latitude.
 * Rough approximation: 1 deg lat ≈ 111320 meters.
 */
const metersToDegLat = (meters) => meters / 111320;

/**
 * Convert degrees longitude spacing at a given latitude.
 * 1 deg lon ≈ 111320 * cos(lat)
 */
const metersToDegLon = (meters, lat) => {
  const metersPerDegLon = 111320 * Math.cos((lat * Math.PI) / 180);
  return metersPerDegLon <= 0 ? 0 : meters / metersPerDegLon;
};

/**
 * Helper: remove consecutive duplicates and tiny segments
 */
function filterAndLabel(points, minSegMeters = 1) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const cur = points[i];
    const prev = out[out.length - 1];
    if (!prev || prev.lat !== cur.lat || prev.lng !== cur.lng) {
      // filter out too-short segments if there's a prev
      if (prev) {
        const a = turf.point([prev.lng, prev.lat]);
        const b = turf.point([cur.lng, cur.lat]);
        const d = turf.distance(a, b, { units: 'meters' });
        if (d < minSegMeters) {
          // skip very short hop
          continue;
        }
      }
      out.push({ ...cur, order: out.length });
    }
  }
  return out;
}

/**
 * Downsample to a maximum number of points while keeping endpoints.
 */
function downsamplePoints(points, maxPoints = 1200) {
  if (!Array.isArray(points) || points.length <= maxPoints) return points;
  const n = points.length;
  const step = (n - 1) / (maxPoints - 1);
  const out = [];
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    out.push(points[Math.min(idx, n - 1)]);
  }
  return out.map((p, i) => ({ ...p, order: i }));
}

/**
 * Generate perimeter waypoints (just polygon vertices).
 */
export function generatePerimeter(polygonLatLngs = [], altitude = 30) {
  return polygonLatLngs.map((p, idx) => ({
    lat: p[0],
    lng: p[1],
    alt: altitude,
    order: idx,
  }));
}

/**
 * Safer generateLawnmower that limits lines & filters tiny segments.
 * Accepts optional options { spacingMeters, altitude, maxPoints, minSegMeters }.
 */
export function generateLawnmower(
  polygonLatLngs = [],
  spacingMeters = 30,
  altitude = 30,
  options = {}
) {
  if (!polygonLatLngs || polygonLatLngs.length < 3) return [];

  const { maxPoints = 1200, minSegMeters = 0.5, maxLines = 2000 } = options;

  // Convert to GeoJSON polygon: turf expects [ [lng,lat], ... ]
  const coords = polygonLatLngs.map((p) => [p[1], p[0]]);
  if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  const polygon = turf.polygon([coords]);

  const bbox = turf.bbox(polygon); // [minX, minY, maxX, maxY] => [minLng, minLat, maxLng, maxLat]
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // If bbox is tiny, ensure at least one line
  const midLat = (minLat + maxLat) / 2;
  const deltaLatDeg = Math.max(0.00001, metersToDegLat(spacingMeters));

  // Protect against extremely small spacing causing huge loops:
  const approxLines = Math.ceil((maxLat - minLat) / deltaLatDeg) + 2;
  if (approxLines > maxLines) {
    // bump spacing to limit line count
    const factor = Math.ceil(approxLines / maxLines);
    spacingMeters = Math.max(spacingMeters * factor, spacingMeters);
  }

  const lines = [];
  // use a small epsilon to avoid infinite loops
  for (let lat = minLat - deltaLatDeg; lat <= maxLat + deltaLatDeg; lat += deltaLatDeg) {
    lines.push(turf.lineString([[minLng - 1, lat], [maxLng + 1, lat]]));
    // safety guard
    if (lines.length > maxLines) break;
  }

  const sweepPoints = [];
  let flip = false;

  for (const line of lines) {
    const intersects = turf.lineIntersect(line, polygon);
    if (!intersects || intersects.features.length === 0) continue;

    const pts = intersects.features.map((f) => f.geometry.coordinates);
    pts.sort((a, b) => a[0] - b[0]); // sort by lng

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
    // quick cap: if sweepPoints already exceeds maxPoints*1.2 we stop generating more lines
    if (sweepPoints.length > maxPoints * 1.2) break;
  }

  // filter duplicates / tiny segments
  let filtered = filterAndLabel(sweepPoints, minSegMeters);

  // downsample if still large
  if (filtered.length > maxPoints) {
    filtered = downsamplePoints(filtered, maxPoints);
  } else {
    filtered = filtered.map((p, i) => ({ ...p, order: i }));
  }

  return filtered;
}
