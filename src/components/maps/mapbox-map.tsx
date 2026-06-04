"use client";

import { MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import { publicEnv } from "@/lib/public-env";
import { cn } from "@/lib/utils";

type Coordinates = [number, number];

type MapboxMapProps = {
  center?: Coordinates | null;
  markerLabel?: string;
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

export function MapboxMap({
  center,
  markerLabel,
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
  const [error, setError] = useState<string | null>(null);
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const enabled = Boolean(token) && hasValidCoordinates(center);

  useEffect(() => {
    if (!enabled || !containerRef.current || !center) return;

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
  }, [center, enabled, interactive, markerLabel, onPick, token, zoom]);

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

