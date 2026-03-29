"use client";

import { MapPin } from "lucide-react";

import { Card } from "@/components/ui/card";

export function MapSection({
  title,
  coordinates,
}: {
  title: string;
  coordinates: [number, number];
}) {
  const hasMapbox = Boolean(process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN);
  return (
    <Card className="overflow-hidden">
      <div className="flex h-[340px] items-center justify-center bg-[radial-gradient(circle_at_top_left,_rgba(11,93,72,0.2),_transparent_35%),linear-gradient(135deg,#0b1724,#14344a,#1e5f74)] text-white">
        <div className="space-y-3 text-center">
          <MapPin className="mx-auto h-10 w-10" />
          <p className="text-xl font-semibold">{title}</p>
          <p className="text-sm text-white/75">
            {hasMapbox
              ? "Mapbox token detected. Replace this card with an interactive map component."
              : "Mapbox is scaffolded. Add `MAPBOX_ACCESS_TOKEN` to enable live maps."}
          </p>
          <p className="text-sm text-white/60">
            {coordinates[1].toFixed(4)}, {coordinates[0].toFixed(4)}
          </p>
        </div>
      </div>
    </Card>
  );
}
