"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { publicEnv } from "@/lib/public-env";
import { Select } from "@/components/ui/select";

type LocationSuggestion = {
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

export function PropertyLocationSearch({
  defaultLocation,
  defaultLatitude,
  defaultLongitude,
  defaultRadiusKm,
}: {
  defaultLocation?: string;
  defaultLatitude?: number;
  defaultLongitude?: number;
  defaultRadiusKm?: number;
}) {
  const token = publicEnv.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const [query, setQuery] = useState(defaultLocation ?? "");
  const [latitude, setLatitude] = useState(defaultLatitude == null ? "" : String(defaultLatitude));
  const [longitude, setLongitude] = useState(defaultLongitude == null ? "" : String(defaultLongitude));
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!token || query.trim().length < 3) {
      setSuggestions([]);
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
          types: "address,place,locality,neighborhood",
        });
        const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const payload = (await response.json()) as { features?: LocationSuggestion[] };
        setSuggestions(payload.features ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error("[maps] property location search failed", error);
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, token]);

  function selectSuggestion(suggestion: LocationSuggestion) {
    const label =
      suggestion.properties?.full_address ||
      suggestion.properties?.place_formatted ||
      suggestion.properties?.name ||
      query;
    const coordinates = suggestion.geometry?.coordinates;

    setQuery(label);
    if (coordinates) {
      setLongitude(String(Number(coordinates[0].toFixed(7))));
      setLatitude(String(Number(coordinates[1].toFixed(7))));
    }
    setSuggestions([]);
  }

  return (
    <div className="space-y-3 lg:col-span-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-400)]" />
        <Input
          name="location"
          className="pl-9"
          placeholder="Location"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setLatitude("");
            setLongitude("");
          }}
        />
        {isSearching ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--ink-400)]" />
        ) : null}
      </div>
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
      <Select
        name="radiusKm"
        defaultValue={defaultRadiusKm == null ? "" : String(defaultRadiusKm)} className="w-full"
      >
        <option value="">Any distance</option>
        <option value="2">Within 2 km</option>
        <option value="5">Within 5 km</option>
        <option value="10">Within 10 km</option>
        <option value="25">Within 25 km</option>
        <option value="50">Within 50 km</option>
      </Select>
      {suggestions.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
          {suggestions.map((suggestion) => {
            const label =
              suggestion.properties?.full_address ||
              suggestion.properties?.place_formatted ||
              suggestion.properties?.name ||
              suggestion.id ||
              "Location";
            return (
              <Button
                key={suggestion.properties?.mapbox_id ?? suggestion.id ?? label}
                type="button"
                variant="ghost"
                className="flex h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left"
                onClick={() => selectSuggestion(suggestion)}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-700)]" />
                <span className="text-sm text-[var(--ink-800)]">{label}</span>
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

