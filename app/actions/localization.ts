"use server";

import { LANGUAGES, REGIONS } from "@/app/global-config";

// Get available regions and languages
export async function getRegions() {
  return { regions: REGIONS, languages: LANGUAGES };
}
