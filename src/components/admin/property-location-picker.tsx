"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { MapboxMap } from "@/components/maps/mapbox-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/public-env";

export type PropertyLocationPickerValue = {
  addressLine1: string;
  formattedAddress: string;
  city: string;
  state: string;
  country: string;
  latitude: string;
  longitude: string;
  mapboxPlaceId: string;
  neighborhood: string;
  postalCode: string;
};

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
    context?: Record<string, { name?: string } | undefined>;
  };
};

export function PropertyLocationPicker({
  value,
  onChange,
}: {
  value: PropertyLocationPickerValue;
  onChange: (value: PropertyLocationPickerValue) => void;
}) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [query, setQuery] = useState(value.formattedAddress || value.addressLine1);
  const [features, setFeatures] = useState<MapboxFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const center = useMemo<[number, number] | null>(() => {
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return [longitude, latitude];
  }, [value.latitude, value.longitude]);

  useEffect(() => {
    if (!token || query.trim().length < 3) {
      setFeatures([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q: query.trim(),
          access_token: token,
          limit: "5",
          country: "ng",
          types: "address,place,locality,neighborhood,postcode",
        });
        const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setFeatures([]);
          return;
        }
        const payload = (await response.json()) as { features?: MapboxFeature[] };
        setFeatures(payload.features ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[maps] address search failed", error);
          setFeatures([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, token]);

  function selectFeature(feature: MapboxFeature) {
    const properties = feature.properties ?? {};
    const context = properties.context ?? {};
    const coordinates = feature.geometry?.coordinates;
    const formattedAddress = properties.full_address || properties.place_formatted || properties.name || query;

    onChange({
      ...value,
      addressLine1: properties.full_address || properties.name || value.addressLine1,
      formattedAddress,
      city: context.place?.name || context.locality?.name || value.city,
      state: context.region?.name || value.state,
      country: context.country?.name || value.country || "Nigeria",
      latitude: coordinates ? String(Number(coordinates[1].toFixed(7))) : value.latitude,
      longitude: coordinates ? String(Number(coordinates[0].toFixed(7))) : value.longitude,
      mapboxPlaceId: properties.mapbox_id || feature.id || value.mapboxPlaceId,
      neighborhood: context.neighborhood?.name || value.neighborhood,
      postalCode: context.postcode?.name || value.postalCode,
    });
    setQuery(formattedAddress);
    setFeatures([]);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-400)]" />
        <Input
          className="pl-9"
          placeholder="Search address"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange({ ...value, formattedAddress: event.target.value });
          }}
          disabled={!token}
        />
        {isSearching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--ink-400)]" />
        ) : null}
      </div>

      {features.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {features.map((feature) => {
            const label = feature.properties?.full_address || feature.properties?.place_formatted || feature.properties?.name || feature.id || "Address";
            return (
              <Button
                key={feature.properties?.mapbox_id ?? feature.id ?? label}
                type="button"
                variant="ghost"
                className="flex h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left"
                onClick={() => selectFeature(feature)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-700)]" />
                <span className="text-sm text-[var(--ink-800)]">{label}</span>
              </Button>
            );
          })}
        </div>
      ) : null}

      <MapboxMap
        center={center}
        markerLabel={value.formattedAddress || value.addressLine1 || "Property location"}
        className="min-h-[260px]"
        fallbackTitle="Property map"
        fallbackDescription="Pick a location after entering coordinates."
        onPick={(coordinates) => {
          onChange({
            ...value,
            longitude: String(coordinates[0]),
            latitude: String(coordinates[1]),
          });
        }}
      />
    </div>
  );
}

