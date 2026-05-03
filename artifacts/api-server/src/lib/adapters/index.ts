import { sampleAdapter } from "./sample";
import { awsAdapter } from "./aws";
import { azureAdapter } from "./azure";
import { gcpAdapter } from "./gcp";
import type { ProviderAdapter } from "./types";

export const ADAPTERS: Record<string, ProviderAdapter> = {
  sample: sampleAdapter,
  aws: awsAdapter,
  azure: azureAdapter,
  gcp: gcpAdapter,
};

export function getAdapter(provider: string): ProviderAdapter | null {
  return ADAPTERS[provider] ?? null;
}

export type { ProviderAdapter, CanonicalFocusRow, AdapterFetchResult } from "./types";
