"use client";

import { Building2, GraduationCap, HeartPulse, MapPin, ShoppingBag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { publicEnv } from "@/lib/public-env";

type AmenityCategory = {
  query: string;
  label: string;
  icon: typeof MapPin;
};

type AmenityResult = {
  id: string;
  name: string;
  category: string;
  address?: string;
};

const AMENITY_CATEGORIES: AmenityCategory[] = [
  { query: "school", label: "Schools", icon: GraduationCap },
  { query: "hospital", label: "Healthcare", icon: HeartPulse },
  { query: "shopping mall", label: "Shopping", icon: ShoppingBag },
  { query: "office", label: "Business", icon: Building2 },
];

type MapboxFeature = {
  id?: string;
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    mapbox_id?: string;
    name?: string;
    full_address?: string;
    place_formatted?: string;
  };
};

export function NearbyAmenitiesSection({
  coordinates,
  hasCoordinates,
  landmarks,
}: {
  coordinates: [number, number];
  hasCoordinates: boolean;
  landmarks: string[];
}) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [results, setResults] = useState<AmenityResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fallbackLandmarks = useMemo(
    (): AmenityResult[] =>
      landmarks.slice(0, 8).map((landmark) => ({ id: landmark, name: landmark, category: "Landmark" })),
    [landmarks],
  );

  useEffect(() => {
    if (!token || !hasCoordinates) {
      setLoaded(true);
      return;
    }

    const controller = new AbortController();

    async function fetchAmenities() {
      try {
        const [longitude, latitude] = coordinates;
        const accessToken = token;
        if (!accessToken) return;
        const responses = await Promise.all(
          AMENITY_CATEGORIES.map(async (category) => {
            const params = new URLSearchParams({
              q: category.query,
              access_token: accessToken,
              proximity: `${longitude},${latitude}`,
              limit: "2",
              country: "ng",
              types: "poi",
            });
            const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`, {
              signal: controller.signal,
            });
            if (!response.ok) return [];
            const payload = (await response.json()) as { features?: MapboxFeature[] };
            return (payload.features ?? []).map((feature) => ({
              id: feature.properties?.mapbox_id ?? feature.id ?? `${category.label}-${feature.properties?.name}`,
              name: feature.properties?.name ?? category.query,
              category: category.label,
              address: feature.properties?.full_address ?? feature.properties?.place_formatted,
            }));
          }),
        );

        setResults(responses.flat().filter((item) => item.name));
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[maps] nearby amenities lookup failed", error);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }

    void fetchAmenities();

    return () => controller.abort();
  }, [coordinates, hasCoordinates, token]);

  const items = results.length > 0 ? results : fallbackLandmarks;

  return (
    <Card className="p-8">
      <h2 className="text-2xl font-semibold text-[var(--ink-950)]">Nearby amenities</h2>
      <div className="mt-6 space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const category = AMENITY_CATEGORIES.find((entry) => entry.label === item.category);
            const Icon = category?.icon ?? MapPin;
            return (
              <div key={item.id} className="flex gap-3 rounded-2xl bg-[var(--sand-100)] px-4 py-3 text-sm text-[var(--ink-700)]">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-700)]" />
                <div className="min-w-0">
                  <div className="font-medium text-[var(--ink-900)]">{item.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--ink-500)]">
                    <Badge>{item.category}</Badge>
                    {item.address ? <span>{item.address}</span> : null}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl bg-[var(--sand-100)] px-4 py-3 text-sm text-[var(--ink-600)]">
            {loaded ? "Nearby amenities have not been added yet." : "Loading nearby amenities..."}
          </div>
        )}
      </div>
    </Card>
  );
}
