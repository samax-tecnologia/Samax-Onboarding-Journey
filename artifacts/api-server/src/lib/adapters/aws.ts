import type { ProviderAdapter } from "./types";

// AWS CUR 2.0 adapter. Real implementation outline (left as TODO until we
// have a customer bucket + cross-account IAM role to test against):
//   1. Read connection.config: { roleArn, bucket, prefix, region }
//   2. Use @aws-sdk/client-sts to assume `roleArn`.
//   3. Use @aws-sdk/client-s3 to list new Parquet partitions under `prefix`
//      since connection.lastSyncedAt (with a 5-day re-pull for restatements).
//   4. Stream each Parquet object via apache-arrow / parquet-wasm and map
//      FOCUS columns to CanonicalFocusRow.
// For now the adapter refuses to run so the connection card surfaces a clear
// "configuração pendente" state until the SDK wiring is enabled.
export const awsAdapter: ProviderAdapter = {
  id: "aws",
  async probe(connection) {
    const cfg = (connection.config ?? {}) as Record<string, unknown>;
    if (!cfg["roleArn"] || !cfg["bucket"]) {
      return { ok: false, error: "Configure roleArn e bucket antes de validar." };
    }
    return {
      ok: false,
      error: "Adaptador AWS aguardando credenciais. Use o template CloudFormation e finalize a conexão.",
    };
  },
  async fetch() {
    throw new Error(
      "AWS adapter not yet enabled. Use the 'sample' provider to round-trip data through the pipeline.",
    );
  },
};
