export type Coordinates = [number, number];

export type BoundaryGeoJson = {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: Coordinates[][];
  };
  properties?: Record<string, unknown>;
};

function isCoordinate(value: unknown): value is Coordinates {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [longitude, latitude] = value;
  return (
    typeof longitude === "number" &&
    typeof latitude === "number" &&
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

export function closeBoundaryRing(points: Coordinates[]) {
  if (points.length === 0) return [];
  const [firstLongitude, firstLatitude] = points[0];
  const [lastLongitude, lastLatitude] = points[points.length - 1];
  const isClosed = firstLongitude === lastLongitude && firstLatitude === lastLatitude;

  return isClosed ? points : [...points, points[0]];
}

export function buildBoundaryGeoJson(points: Coordinates[]): BoundaryGeoJson | null {
  const uniquePoints = points.filter(isCoordinate);
  if (uniquePoints.length < 3) return null;

  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [closeBoundaryRing(uniquePoints)],
    },
    properties: {},
  };
}

export function isValidBoundaryGeoJson(value: unknown): value is BoundaryGeoJson {
  if (!value || typeof value !== "object") return false;
  const feature = value as BoundaryGeoJson;
  if (feature.type !== "Feature" || feature.geometry?.type !== "Polygon") return false;
  const ring = feature.geometry.coordinates?.[0];
  if (!Array.isArray(ring) || ring.length < 4) return false;
  if (!ring.every(isCoordinate)) return false;

  const [firstLongitude, firstLatitude] = ring[0];
  const [lastLongitude, lastLatitude] = ring[ring.length - 1];
  return firstLongitude === lastLongitude && firstLatitude === lastLatitude;
}

export function extractBoundaryPoints(value: unknown): Coordinates[] {
  const parsed =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return null;
          }
        })()
      : value;

  if (!isValidBoundaryGeoJson(parsed)) return [];
  const ring = parsed.geometry.coordinates[0];
  return ring.slice(0, -1);
}

