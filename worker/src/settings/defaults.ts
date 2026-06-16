import desqtaDefaultsJson from "./desqta-defaults.json";
import bsplusDefaultsJson from "./bsplus-known-defaults.json";

export const desqtaDefaults = desqtaDefaultsJson as Record<string, unknown>;
export const bsplusKnownDefaults = bsplusDefaultsJson as Record<string, unknown>;
