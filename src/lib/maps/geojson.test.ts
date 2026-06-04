import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBoundaryGeoJson,
  closeBoundaryRing,
  extractBoundaryPoints,
  isValidBoundaryGeoJson,
} from "@/lib/maps/geojson";

test("boundary helper closes polygon rings", () => {
  const ring = closeBoundaryRing([
    [3.4723, 6.4474],
    [3.4733, 6.4474],
    [3.4733, 6.4484],
  ]);

  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.equal(ring.length, 4);
});

test("boundary helper builds and extracts valid GeoJSON polygons", () => {
  const boundary = buildBoundaryGeoJson([
    [3.4723, 6.4474],
    [3.4733, 6.4474],
    [3.4733, 6.4484],
  ]);

  assert.ok(boundary);
  assert.equal(isValidBoundaryGeoJson(boundary), true);
  assert.deepEqual(extractBoundaryPoints(boundary), [
    [3.4723, 6.4474],
    [3.4733, 6.4474],
    [3.4733, 6.4484],
  ]);
});

test("boundary helper rejects invalid polygons", () => {
  assert.equal(buildBoundaryGeoJson([[3.4723, 6.4474], [3.4733, 6.4474]]), null);
  assert.equal(isValidBoundaryGeoJson({ type: "Feature", geometry: { type: "Point", coordinates: [3, 6] } }), false);
  assert.deepEqual(extractBoundaryPoints("{bad json"), []);
});

