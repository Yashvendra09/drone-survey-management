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
 * Generate perimeter waypoints (just polygon vertices).
 * polygonLatLngs: array of [lat, lng] pairs
 */
export function generatePerimeter(polygonLatLngs = [], altitude = 30) {
  if (!Array.isArray(polygonLatLngs)) return [];
  return polygonLatLngs.map((p, idx) => ({
    lat: Number(p[0]),
    lng: Number(p[1]),
    alt: altitude,
    order: idx,
  }));
}

/**
 * Generate lawnmower/crosshatch (sweep) pattern across polygon.
 *
 * - polygonLatLngs: array of [lat, lng]
 * - spacingMeters: desired spacing between adjacent sweep lines (meters)
 * - altitude: altitude meters
 * - opts: { maxPoints, minSpacingMeters }
 *
 * Strategy:
 *  - Build turf polygon (GeoJSON) and bounding box.
 *  - Sweep horizontal lines across bbox with step = metersToDegLat(spacingMeters).
 *  - For each line, compute intersection points with polygon, pair them and emit end points.
 *  - If estimated points > maxPoints, increase spacingMeters automatically to limit output size.
 *  - Finally, defensively downsample the resulting waypoint list if it's still > maxPoints.
 */
export function generateLawnmower(
  polygonLatLngs = [],
  spacingMeters = 30,
  altitude = 30,
  opts = {}
) {
  const maxPoints = Number(opts.maxPoints ?? 600); // default to 600 to be safer than 800
  const minSpacingMeters = Number(opts.minSpacingMeters ?? 5); // never go below this

  if (!Array.isArray(polygonLatLngs) || polygonLatLngs.length < 3) return [];

  // Normalize coords for turf: [lng, lat]
  const coords = polygonLatLngs.map((p) => [Number(p[1]), Number(p[0])]);

  // close polygon if needed
  if (
    coords.length > 0 &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    coords.push(coords[0]);
  }

  const polygon = turf.polygon([coords]);

  // bbox: [minLng, minLat, maxLng, maxLat]
  const bbox = turf.bbox(polygon);
  const [minLng, minLat, maxLng, maxLat] = bbox;

  // clamp spacing
  spacingMeters = Math.max(minSpacingMeters, spacingMeters || minSpacingMeters);

  // estimate number of sweep lines and points so we can increase spacing if needed
  const latSpanMeters = (maxLat - minLat) * 111320; // rough meters for latitude span
  const estLineCount = Math.max(1, Math.ceil(latSpanMeters / spacingMeters));
  // rough estimate: each line could produce up to 4 points in complex polygons, but typically 2
  const estPoints = estLineCount * 2;

  if (estPoints > maxPoints) {
    // increase spacing proportionally to reduce estimated points
    const factor = estPoints / maxPoints;
    spacingMeters = Math.max(minSpacingMeters, Math.ceil(spacingMeters * factor));
  }

  // Now compute delta in degrees latitude
  const deltaLatDeg = metersToDegLat(spacingMeters);

  const lines = [];
  // iterate from minLat - small epsilon to maxLat + epsilon to ensure intersections near borders
  for (let lat = minLat - deltaLatDeg; lat <= maxLat + deltaLatDeg; lat += deltaLatDeg) {
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
    if (!intersects || !intersects.features || intersects.features.length === 0) continue;

    // intersection points are [lng, lat]
    const pts = intersects.features.map((f) => f.geometry.coordinates);
    // sort by longitude to produce left->right
    pts.sort((a, b) => a[0] - b[0]);

    // pair sequential points (0-1, 2-3,...)
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

  // Remove consecutive duplicates
  const filtered = [];
  for (let i = 0; i < sweepPoints.length; i++) {
    const cur = sweepPoints[i];
    const prev = filtered[filtered.length - 1];
    if (!prev || prev.lat !== cur.lat || prev.lng !== cur.lng) {
      filtered.push({ ...cur, order: filtered.length });
    }
  }

  // Defensive downsample if still too many points
  if (filtered.length > maxPoints) {
    // uniform downsample to maxPoints preserving endpoints
    const n = filtered.length;
    const step = (n - 1) / (maxPoints - 1);
    const out = [];
    for (let i = 0; i < maxPoints; i++) {
      const idx = Math.round(i * step);
      out.push({ ...filtered[Math.min(idx, n - 1)], order: i });
    }
    return out;
  }

  return filtered;
}
