import { env, featureFlags } from "@/lib/env";

export const mapboxConfig = {
  token: env.MAPBOX_ACCESS_TOKEN,
  enabled: featureFlags.hasMapbox,
};
