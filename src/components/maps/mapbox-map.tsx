"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { closeBoundaryRing, type Coordinates } from "@/lib/maps/geojson";
import { publicEnv } from "@/lib/public-env";
import { cn } from "@/lib/utils";

type MapboxMapProps = {
  center?: Coordinates | null;
  markerLabel?: string;
  polygon?: Coordinates[];
  zoom?: number;
  interactive?: boolean;
  className?: string;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onPick?: (coordinates: Coordinates) => void;
};

function hasValidCoordinates(coordinates: Coordinates | null | undefined) {
  if (!coordinates) return false;
  const [longitude, latitude] = coordinates;
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

function buildPolygonData(points: Coordinates[]): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  return {
    type: "FeatureCollection",
    features: points.length >= 3
      ? [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [closeBoundaryRing(points)],
            },
            properties: {},
          },
        ]
      : [],
  };
}

function syncPolygonLayer(map: import("mapbox-gl").Map, points: Coordinates[]) {
  const sourceId = "estateos-property-boundary";
  const fillLayerId = "estateos-property-boundary-fill";
  const lineLayerId = "estateos-property-boundary-line";
  const data = buildPolygonData(points);

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, {
      type: "geojson",
      data,
    });
  } else {
    (map.getSource(sourceId) as import("mapbox-gl").GeoJSONSource).setData(data);
  }

  if (!map.getLayer(fillLayerId)) {
    map.addLayer({
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      paint: {
        "fill-color": "#0b5d48",
        "fill-opacity": 0.18,
      },
    });
  }

  if (!map.getLayer(lineLayerId)) {
    map.addLayer({
      id: lineLayerId,
      type: "line",
      source: sourceId,
      paint: {
        "line-color": "#0b5d48",
        "line-width": 3,
      },
    });
  }
}

export function MapboxMap({
  center,
  markerLabel,
  polygon = [],
  zoom = 14,
  interactive = true,
  className,
  fallbackTitle = "Map unavailable",
  fallbackDescription = "Location coordinates are not available yet.",
  onPick,
}: MapboxMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const markerRef = useRef<import("mapbox-gl").Marker | null>(null);
  const polygonRef = useRef(polygon);
  const [error, setError] = useState<string | null>(null);
  const [inView, setInView] = useState(false);
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const enabled = Boolean(token) && hasValidCoordinates(center);
  const polygonKey = JSON.stringify(polygon);

  useEffect(() => {
    polygonRef.current = polygon;
  }, [polygon]);

  // Lazy-mount: only download the mapbox-gl bundle and initialize the map once
  // the container scrolls near the viewport. On a long property page this keeps
  // the heavy map library out of the initial load until the visitor reaches it.
  useEffect(() => {
    const node = containerRef.current;
    if (!enabled || !node || inView) return;

    if (typeof IntersectionObserver === "undefined") {
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, inView]);

  useEffect(() => {
    if (!enabled || !inView || !containerRef.current || !center) return;

    let cancelled = false;

    async function mountMap() {
      try {
        const { default: mapboxgl } = await import("mapbox-gl");
        if (cancelled || !containerRef.current || !center) return;

        mapboxgl.accessToken = token ?? "";
        mapRef.current?.remove();

        const map = new mapboxgl.Map({
          container: containerRef.current,
          style: "mapbox://styles/mapbox/streets-v12",
          center,
          zoom,
          interactive,
          attributionControl: false,
        });

        const markerElement = document.createElement("div");
        markerElement.className = "h-4 w-4 rounded-full border-2 border-white bg-[var(--brand-700)] shadow-lg";
        markerElement.setAttribute("aria-label", markerLabel ?? "Property location");

        markerRef.current = new mapboxgl.Marker({ element: markerElement }).setLngLat(center).addTo(map);

        map.on("load", () => syncPolygonLayer(map, polygonRef.current));

        if (onPick) {
          map.on("click", (event) => {
            onPick([Number(event.lngLat.lng.toFixed(7)), Number(event.lngLat.lat.toFixed(7))]);
          });
        }

        mapRef.current = map;
        setError(null);
      } catch (mapError) {
        console.error("[maps] mapbox render failed", mapError);
        setError("Map could not be loaded.");
      }
    }

    void mountMap();

    return () => {
      cancelled = true;
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [center, enabled, inView, interactive, markerLabel, onPick, token, zoom]);

  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    syncPolygonLayer(mapRef.current, polygonRef.current);
  }, [polygonKey]);

  if (!enabled || error) {
    return (
      <Card className={cn("flex min-h-[300px] items-center justify-center overflow-hidden border-dashed bg-[var(--sand-50)]", className)}>
        <div className="space-y-3 px-6 text-center">
          <MapPin className="mx-auto h-9 w-9 text-[var(--brand-700)]" />
          <p className="text-base font-semibold text-[var(--ink-900)]">{fallbackTitle}</p>
          <p className="max-w-sm text-sm text-[var(--ink-600)]">
            {error ?? (token ? fallbackDescription : "Mapbox is not configured for this environment.")}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn("min-h-[300px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sand-100)]", className)}>
      <div ref={containerRef} className="h-full min-h-[300px] w-full" />
    </div>
  );
}
