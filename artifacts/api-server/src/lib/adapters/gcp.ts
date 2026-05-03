import type { ProviderAdapter } from "./types";

// GCP Cloud Billing detailed/FOCUS export → BigQuery adapter. Real
// implementation outline:
//   1. Read connection.config: { projectId, datasetId, tableId }
//   2. Resolve service account JSON key from Replit Secret (secretRef).
//   3. Use @google-cloud/bigquery to query the FOCUS view between
//      lastSyncedAt - 5d and now, page through results, map → CanonicalFocusRow.
export const gcpAdapter: ProviderAdapter = {
  id: "gcp",
  async probe() {
    return {
      ok: false,
      error: "Adaptador GCP aguardando service account com BigQuery Data Viewer.",
    };
  },
  async fetch() {
    throw new Error("GCP adapter not yet enabled.");
  },
};
