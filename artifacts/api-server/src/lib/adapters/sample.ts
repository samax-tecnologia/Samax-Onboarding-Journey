import { buildDataset } from "../focus-mock";
import type { ProviderAdapter, AdapterFetchResult, CanonicalFocusRow } from "./types";

// `sample` adapter: round-trips the deterministic mock dataset through the
// real ingestion pipeline. Lets us prove the end-to-end DB + query flow
// without needing real cloud credentials.
export const sampleAdapter: ProviderAdapter = {
  id: "sample",
  async probe() {
    return { ok: true } as const;
  },
  async fetch(connection): Promise<AdapterFetchResult> {
    const dataset = buildDataset();
    const rows: CanonicalFocusRow[] = dataset.monthlyRows.map((r, idx) => ({
      chargePeriodStart: r.ChargePeriodStart,
      chargePeriodEnd: r.ChargePeriodEnd,
      providerName: r.ProviderName,
      serviceCategory: r.ServiceCategory,
      serviceName: r.ServiceName,
      chargeCategory: r.ChargeCategory,
      billedCost: r.BilledCost,
      effectiveCost: r.EffectiveCost,
      billingCurrency: r.BillingCurrency,
      resourceId: r.x_ResourceId,
      regionName: null,
      xTeam: r.x_Team,
      xProduct: r.x_Product,
      tags: { team: r.x_Team, product: r.x_Product },
      upstreamLineId: `sample:${connection.id}:${idx}`,
    }));
    return { rows, partitionsRead: 12 };
  },
};
