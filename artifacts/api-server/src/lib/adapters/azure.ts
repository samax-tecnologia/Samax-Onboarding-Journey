import type { ProviderAdapter } from "./types";

// Azure Cost Management Exports (FOCUS) → Storage Account adapter. Real
// implementation outline:
//   1. Read connection.config: { tenantId, clientId, subscriptionId,
//      storageAccount, container, exportName }
//   2. Resolve client secret from Replit Secret referenced by secretRef.
//   3. Use @azure/identity ClientSecretCredential + @azure/storage-blob
//      to list new export blobs since lastSyncedAt.
//   4. Parse CSV/Parquet exports, map FOCUS columns → CanonicalFocusRow.
// 4-hour refresh is enabled here (refreshIntervalHours=4 allowed only for
// this provider) once the SDK calls are wired.
export const azureAdapter: ProviderAdapter = {
  id: "azure",
  async probe() {
    return {
      ok: false,
      error: "Adaptador Azure aguardando credenciais (App Registration + Storage Account).",
    };
  },
  async fetch() {
    throw new Error("Azure adapter not yet enabled.");
  },
};
