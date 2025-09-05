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
 * polygon: array of [lat, lng] or GeoJSON polygon coordinates.
 */
export function generatePerimeter(polygonLatLngs = [], altitude = 30) {
  // polygonLatLngs: [[lat, lng], ...]
  return polygonLatLngs.map((p, idx) => ({
    lat: p[0],
    lng: p[1],
    alt: altitude,
    order: idx,
  }));
}

/**
 * Generate lawnmower/crosshatch (sweep) pattern across polygon.
 * polygonLatLngs: array of [lat, lng]
 * spacingMeters: distance between adjacent sweep lines in meters
 * altitude: in meters
 *
 * Approach:
 *  - Build turf polygon
 *  - Compute bbox
 *  - Sweep horizontal lines across bbox at step = metersToDegLat(spacingMeters)
 *  - For each line, compute intersection points with polygon
 *  - Pair intersections and push endpoints as waypoints; alternate direction between lines
 *
 * Note: This creates endpoints for sweep segments which is sufficient for demo/mission preview.
 */
export function generateLawnmower(polygonLatLngs = [], spacingMeters = 30, altitude = 30) {
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
  const midLat = (minLat + maxLat) / 2;
  const deltaLatDeg = metersToDegLat(spacingMeters);

  const lines = [];
  for (let lat = minLat; lat <= maxLat + deltaLatDeg; lat += deltaLatDeg) {
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
    for (let i = 0; i + 1 < pts.length; i += 2) {
      const a = pts[i];
      const b = pts[i + 1];

      // endpoints as waypoints; convert to {lat,lng}
      // Determine ordering based on flip to make continuous path
      if (!flip) {
        sweepPoints.push({ lat: a[1], lng: a[0], alt: altitude });
        sweepPoints.push({ lat: b[1], lng: b[0], alt: altitude });
      } else {
        sweepPoints.push({ lat: b[1], lng: b[0], alt: altitude });
        sweepPoints.push({ lat: a[1], lng: a[0], alt: altitude });
      }
    }

    // toggle flip each line so path snakes back and forth
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

  return filtered;
}
