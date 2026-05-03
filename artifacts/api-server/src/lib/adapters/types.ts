import type { ProviderConnection } from "@workspace/db";

export type CanonicalFocusRow = {
  chargePeriodStart: Date;
  chargePeriodEnd: Date;
  providerName: "AWS" | "Azure" | "GCP";
  serviceCategory: string;
  serviceName: string;
  chargeCategory: "Usage" | "Purchase" | "Tax" | "Credit" | "Adjustment";
  billedCost: number;
  effectiveCost: number;
  billingCurrency: string;
  resourceId?: string | null;
  regionName?: string | null;
  xTeam?: string | null;
  xProduct?: string | null;
  tags?: Record<string, string> | null;
  // Stable per-line identifier from the upstream export (used to compute the
  // dedupe hash). For sample/mock data we synthesize one.
  upstreamLineId: string;
};

export type AdapterFetchResult = {
  rows: CanonicalFocusRow[];
  partitionsRead: number;
};

export interface ProviderAdapter {
  readonly id: "sample" | "aws" | "azure" | "gcp";
  /**
   * Cheap probe used at connection-create time. Should not move large amounts
   * of data; it just verifies that the credentials & permissions work.
   */
  probe(connection: ProviderConnection): Promise<{ ok: true } | { ok: false; error: string }>;
  /**
   * Pull all rows that should be ingested in this run. The aggregator handles
   * idempotency via the line-item hash so it's safe to return overlapping
   * windows (we always re-pull the trailing 5 days for late adjustments).
   */
  fetch(connection: ProviderConnection): Promise<AdapterFetchResult>;
}
