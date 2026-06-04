"use client";

import { MapboxMap } from "@/components/maps/mapbox-map";

export function MapSection({
  title,
  coordinates,
  hasCoordinates,
}: {
  title: string;
  coordinates: [number, number];
  hasCoordinates: boolean;
}) {
  return (
    <MapboxMap
      center={hasCoordinates ? coordinates : null}
      markerLabel={title}
      className="min-h-[340px]"
      fallbackTitle={title}
      fallbackDescription="Map coordinates are not available for this property."
      interactive
    />
  );
}
