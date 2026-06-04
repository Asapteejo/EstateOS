"use client";

import { MapboxMap } from "@/components/maps/mapbox-map";

export function MapSection({
  title,
  coordinates,
  hasCoordinates,
  boundaryCoordinates,
}: {
  title: string;
  coordinates: [number, number];
  hasCoordinates: boolean;
  boundaryCoordinates?: [number, number][];
}) {
  return (
    <MapboxMap
      center={hasCoordinates ? coordinates : null}
      markerLabel={title}
      polygon={boundaryCoordinates}
      className="min-h-[340px]"
      fallbackTitle={title}
      fallbackDescription="Map coordinates are not available for this property."
      interactive
    />
  );
}
