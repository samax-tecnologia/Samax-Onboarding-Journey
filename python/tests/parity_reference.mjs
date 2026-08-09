#!/usr/bin/env node
/**
 * Parity reference generator — standalone (no workspace deps).
 * Reimplements the core TS functions from focus-mock.ts / focus-aggregate.ts
 * to produce deterministic JSON fixtures that the Python port must match.
 *
 * Usage:  node parity_reference.mjs > parity_fixtures.json
 */

"use strict";

const MASK32 = 0xFFFFFFFF;

// ---------- PRNG / seeds (bit-exact with JS focus-mock.ts) ----------

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
  }
  return h >>> 0;
}

function round2(n) { return Math.round(n * 100) / 100; }
function round4(n) { return Math.round(n * 10000) / 10000; }

// ---------- Constants (exact mirrors of Python focus.py) ----------

const TEAMS = ["platform", "data", "growth", "payments", "ml"];
const PRODUCTS = [
  "checkout", "marketplace", "analytics", "mobile-app",
  "search", "recommendations", "fraud", "internal-tools",
];
const PROVIDERS = ["AWS", "Azure", "GCP"];

const SERVICES = {
  AWS: [
    { name: "Amazon EC2", category: "Compute", baseDailyCost: 1800 },
    { name: "Amazon S3", category: "Storage", baseDailyCost: 420 },
    { name: "Amazon RDS", category: "Database", baseDailyCost: 950 },
    { name: "Amazon CloudFront", category: "Networking", baseDailyCost: 260 },
    { name: "AWS Lambda", category: "Compute", baseDailyCost: 180, productBias: { checkout: 1.4, fraud: 1.2 } },
    { name: "Amazon SageMaker", category: "AI and Machine Learning", baseDailyCost: 540, teamBias: { ml: 3, data: 1.5 }, productBias: { recommendations: 2.5, fraud: 1.8 } },
    { name: "AWS Data Transfer", category: "Networking", baseDailyCost: 210 },
  ],
  Azure: [
    { name: "Azure Virtual Machines", category: "Compute", baseDailyCost: 1100 },
    { name: "Azure Blob Storage", category: "Storage", baseDailyCost: 280 },
    { name: "Azure SQL Database", category: "Database", baseDailyCost: 690 },
    { name: "Azure OpenAI", category: "AI and Machine Learning", baseDailyCost: 360, teamBias: { ml: 2.5 }, productBias: { recommendations: 2, search: 1.6 } },
    { name: "Azure Kubernetes Service", category: "Compute", baseDailyCost: 540 },
    { name: "Azure Front Door", category: "Networking", baseDailyCost: 150 },
  ],
  GCP: [
    { name: "Compute Engine", category: "Compute", baseDailyCost: 980 },
    { name: "Cloud Storage", category: "Storage", baseDailyCost: 220 },
    { name: "BigQuery", category: "Analytics", baseDailyCost: 720, teamBias: { data: 3, ml: 1.5 }, productBias: { analytics: 2.5, recommendations: 1.4 } },
    { name: "Cloud SQL", category: "Database", baseDailyCost: 410 },
    { name: "Vertex AI", category: "AI and Machine Learning", baseDailyCost: 320, teamBias: { ml: 3 }, productBias: { recommendations: 2.2 } },
    { name: "Cloud Load Balancing", category: "Networking", baseDailyCost: 130 },
  ],
};

function seasonalMultiplier(date) {
  const m = date.getUTCMonth();
  const yoy = 1 + 0.18 * ((date.getUTCFullYear() - 2025) + m / 12);
  const seasonal = 1 + 0.12 * Math.sin(((m - 2) * Math.PI) / 6) + (m === 10 || m === 11 ? 0.18 : 0);
  return yoy * seasonal;
}

// ---------- Dataset builder (focus-mock.ts buildDataset) ----------

let cachedDataset = null;

function buildDataset(referenceDate) {
  if (cachedDataset) return cachedDataset;
  referenceDate = referenceDate || new Date();

  const end = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 12, 1));

  const rows = [];

  for (let cursor = new Date(start); cursor < end; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const daysInMonth = Math.round((monthEnd.getTime() - cursor.getTime()) / 86400000);
    const seasonal = seasonalMultiplier(cursor);

    for (const provider of PROVIDERS) {
      for (const svc of SERVICES[provider]) {
        for (const team of TEAMS) {
          for (const product of PRODUCTS) {
            const seed = hashSeed(cursor.toISOString(), provider, svc.name, team, product);
            const rand = mulberry32(seed);

            const teamWeight = svc.teamBias?.[team] ?? 1;
            const productWeight = svc.productBias?.[product] ?? 1;
            const presence = rand();
            const presenceThreshold = Math.min(0.92, 0.35 + 0.12 * (teamWeight + productWeight));
            if (presence > presenceThreshold) continue;

            const noise = 0.7 + rand() * 0.6;
            const monthlyBase = svc.baseDailyCost * daysInMonth * seasonal * noise * 0.04 * teamWeight * productWeight;

            const usageEffective = monthlyBase;
            const usageBilled = usageEffective * (1.03 + rand() * 0.08);

            rows.push({
              ChargePeriodStart: cursor.toISOString(),
              ChargePeriodEnd: monthEnd.toISOString(),
              ProviderName: provider,
              ServiceCategory: svc.category,
              ServiceName: svc.name,
              ChargeCategory: "Usage",
              BilledCost: round2(usageBilled),
              EffectiveCost: round2(usageEffective),
              BillingCurrency: "USD",
              x_Team: team,
              x_Product: product,
              x_ResourceId: `${provider.toLowerCase()}-${svc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${team}-${product}`,
            });

            if (rand() < 0.08) {
              const purchase = monthlyBase * (0.4 + rand() * 0.3);
              rows.push({
                ChargePeriodStart: cursor.toISOString(),
                ChargePeriodEnd: monthEnd.toISOString(),
                ProviderName: provider,
                ServiceCategory: svc.category,
                ServiceName: svc.name,
                ChargeCategory: "Purchase",
                BilledCost: round2(purchase),
                EffectiveCost: round2(purchase * 0.78),
                BillingCurrency: "USD",
                x_Team: team,
                x_Product: product,
                x_ResourceId: `commit-${provider.toLowerCase()}-${team}`,
              });
            }
            if (rand() < 0.06) {
              const credit = monthlyBase * (0.05 + rand() * 0.05);
              rows.push({
                ChargePeriodStart: cursor.toISOString(),
                ChargePeriodEnd: monthEnd.toISOString(),
                ProviderName: provider,
                ServiceCategory: svc.category,
                ServiceName: svc.name,
                ChargeCategory: "Credit",
                BilledCost: round2(-credit),
                EffectiveCost: round2(-credit),
                BillingCurrency: "USD",
                x_Team: team,
                x_Product: product,
                x_ResourceId: `credit-${provider.toLowerCase()}`,
              });
            }
            if (rand() < 0.5) {
              const tax = monthlyBase * 0.03;
              rows.push({
                ChargePeriodStart: cursor.toISOString(),
                ChargePeriodEnd: monthEnd.toISOString(),
                ProviderName: provider,
                ServiceCategory: svc.category,
                ServiceName: svc.name,
                ChargeCategory: "Tax",
                BilledCost: round2(tax),
                EffectiveCost: round2(tax),
                BillingCurrency: "USD",
                x_Team: team,
                x_Product: product,
                x_ResourceId: `tax-${provider.toLowerCase()}`,
              });
            }
          }
        }
      }
    }
  }

  cachedDataset = { startDate: start.toISOString(), endDate: end.toISOString(), monthlyRows: rows };
  return cachedDataset;
}

// ---------- Savings (focus-mock.ts buildSavingsOpportunities) ----------

const SAVINGS_OPPORTUNITIES = [
  { id: "sav-001", title: "Idle EC2 fleet in us-east-1 (24 instances)", category: "idle", provider: "AWS", service: "Amazon EC2", resourceId: "i-0a1b2c-cluster-staging", team: "platform", product: "internal-tools", monthlySavings: 8420, currency: "USD", recommendedAction: "Stop or terminate 24 m5.2xlarge instances with <2% CPU over the last 30 days.", effort: "low", details: "These instances belong to a deprecated staging cluster. Average CPU 1.4%, average network <50 KB/s." },
  { id: "sav-002", title: "Rightsize RDS db.r6g.4xlarge → db.r6g.2xlarge", category: "rightsizing", provider: "AWS", service: "Amazon RDS", resourceId: "checkout-prod-rds-1", team: "payments", product: "checkout", monthlySavings: 5210, currency: "USD", recommendedAction: "Downsize the checkout primary RDS to half the vCPU/memory; p95 utilization is 38%.", effort: "medium", details: "p95 CPU 38%, p95 memory 41%. Storage IOPS unchanged. Recommend test in staging first." },
  { id: "sav-003", title: "Compute commitment coverage gap in Azure", category: "commitment", provider: "Azure", service: "Azure Virtual Machines", team: "platform", product: "marketplace", monthlySavings: 12780, currency: "USD", recommendedAction: "Purchase a 1-year Reserved Instance for D-series VMs covering the steady 62% baseline.", effort: "low", details: "Current on-demand spend is $19,400/mo with stable baseline since March. RI saves ~33% on the covered portion." },
  { id: "sav-004", title: "Untagged GCP spend ($14.2k/mo unattributed)", category: "untagged", provider: "GCP", service: "Compute Engine", team: "platform", product: "internal-tools", monthlySavings: 3100, currency: "USD", recommendedAction: "Apply x_Team and x_Product tags to 47 untagged instances in projects shared-infra-* to surface ownership.", effort: "medium", details: "Showback assigns this spend to platform by default. Once tagged, ~$3.1k/mo can be attributed and reclaimed." },
  { id: "sav-005", title: "Move cold S3 data to Glacier Instant Retrieval", category: "storage-tier", provider: "AWS", service: "Amazon S3", resourceId: "data-lake-archive-2024", team: "data", product: "analytics", monthlySavings: 2640, currency: "USD", recommendedAction: "Apply lifecycle rule: objects in archive/ prefix not accessed in 60 days → Glacier IR.", effort: "low", details: "82 TB eligible. No object accessed since November." },
  { id: "sav-006", title: "Idle SageMaker notebook instances", category: "idle", provider: "AWS", service: "Amazon SageMaker", team: "ml", product: "recommendations", monthlySavings: 1980, currency: "USD", recommendedAction: "Auto-stop 11 ml.m5.xlarge notebooks with no kernel activity for 14+ days.", effort: "low", details: "Notebooks left running by data scientists; lifecycle policy not applied." },
  { id: "sav-007", title: "BigQuery slot commitment underused", category: "commitment", provider: "GCP", service: "BigQuery", team: "data", product: "analytics", monthlySavings: 4350, currency: "USD", recommendedAction: "Reduce annual flex slot commitment from 2,000 to 1,200; peak usage is 1,180 slots.", effort: "medium", details: "30-day p99 slot utilization is 1,180. Excess capacity is paid but unused." },
  { id: "sav-008", title: "Rightsize AKS node pool", category: "rightsizing", provider: "Azure", service: "Azure Kubernetes Service", team: "growth", product: "marketplace", monthlySavings: 2270, currency: "USD", recommendedAction: "Switch general-pool from Standard_D8s_v5 to Standard_D4s_v5; HPA p95 is 39%.", effort: "medium", details: "Cluster autoscaler set to min=4. Node CPU p95 39%, memory p95 44%." },
  { id: "sav-009", title: "Old Azure SQL backups (LTR retention too long)", category: "storage-tier", provider: "Azure", service: "Azure SQL Database", team: "payments", product: "checkout", monthlySavings: 880, currency: "USD", recommendedAction: "Reduce long-term retention from 10y → 3y on non-regulated databases (3 dbs).", effort: "low", details: "Compliance requires 3y. Current 10y retention adds ~$880/mo." },
  { id: "sav-010", title: "Untagged AWS Lambda functions", category: "untagged", provider: "AWS", service: "AWS Lambda", team: "platform", product: "internal-tools", monthlySavings: 540, currency: "USD", recommendedAction: "Tag 38 Lambda functions missing x_Team/x_Product. ~$540/mo currently shows as platform default.", effort: "low", details: "Mostly cron jobs and webhooks created via console." },
];

function getSavings(filters) {
  return SAVINGS_OPPORTUNITIES.filter(o => {
    if (filters.providers && !filters.providers.includes(o.provider)) return false;
    if (filters.teams && !filters.teams.includes(o.team)) return false;
    if (filters.products && !filters.products.includes(o.product)) return false;
    return true;
  });
}

// ---------- Aggregation (focus-aggregate.ts) ----------

function ymKey(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

function costOf(row, costType) {
  return costType === "BilledCost" ? row.BilledCost : row.EffectiveCost;
}

function sumCost(rows, costType) {
  let total = 0;
  for (const r of rows) total += costOf(r, costType);
  return total;
}

function applyFilters(rows, filters) {
  return rows.filter(r => {
    const start = filters.startDate ? new Date(filters.startDate) : null;
    const end = filters.endDate ? new Date(filters.endDate) : null;
    const rowStart = new Date(r.ChargePeriodStart);
    if (start && rowStart < start) return false;
    if (end && rowStart >= end) return false;
    if (filters.providers && !filters.providers.includes(r.ProviderName)) return false;
    if (filters.teams && !filters.teams.includes(r.x_Team)) return false;
    if (filters.products && !filters.products.includes(r.x_Product)) return false;
    return true;
  });
}

// ---------- Generate fixture scenarios ----------

const ds = buildDataset();
const rows = ds.monthlyRows;

// Scenario 1: Dataset stats
const totalRows = rows.length;
const categories = [...new Set(rows.map(r => r.ServiceCategory))].sort();

// Scenario 2: Filter by provider
const awsRows = applyFilters(rows, { providers: ["AWS"], costType: "EffectiveCost" });
const awsEffectiveSum = round2(sumCost(awsRows, "EffectiveCost"));
const awsBilledSum = round2(sumCost(awsRows, "BilledCost"));

// Scenario 3: Filter by team
const mlRows = applyFilters(rows, { teams: ["ml"], costType: "EffectiveCost" });
const mlEffectiveSum = round2(sumCost(mlRows, "EffectiveCost"));

// Scenario 4: Filter by date range (single month)
const jan2026Start = "2026-01-01T00:00:00.000Z";
const jan2026End = "2026-02-01T00:00:00.000Z";
const jan2026Rows = applyFilters(rows, { startDate: jan2026Start, endDate: jan2026End, costType: "EffectiveCost" });
const jan2026Sum = round2(sumCost(jan2026Rows, "EffectiveCost"));

// Scenario 5: Combined filters (AWS + ml team)
const awsMlRows = applyFilters(rows, { providers: ["AWS"], teams: ["ml"], costType: "EffectiveCost" });
const awsMlSum = round2(sumCost(awsMlRows, "EffectiveCost"));

// Scenario 6: YmKey
const ymKeyTests = [
  ymKey("2026-01-15T00:00:00.000Z"),
  ymKey("2025-12-31T23:59:59.000Z"),
  ymKey("2025-03-01T00:00:00.000Z"),
];

// Scenario 7: hashSeed determinism
const seedTests = [
  hashSeed("2026-01-01T00:00:00.000Z", "AWS", "Amazon EC2", "platform", "checkout"),
  hashSeed("2026-01-01T00:00:00.000Z", "Azure", "Azure OpenAI", "ml", "recommendations"),
  hashSeed("2025-06-01T00:00:00.000Z", "GCP", "BigQuery", "data", "analytics"),
];

// Scenario 8: Mulberry32 determinism
const prngTests = [];
for (const seed of seedTests) {
  const rand = mulberry32(seed);
  prngTests.push([round4(rand()), round4(rand()), round4(rand())]);
}

// Scenario 9: Savings (all + filtered)
const allSavings = getSavings({});
const savingsTotal = round2(allSavings.reduce((a, s) => a + s.monthlySavings, 0));
const awsSavings = getSavings({ providers: ["AWS"] });
const awsSavingsTotal = round2(awsSavings.reduce((a, s) => a + s.monthlySavings, 0));
const mlSavings = getSavings({ teams: ["ml"] });
const mlSavingsTotal = round2(mlSavings.reduce((a, s) => a + s.monthlySavings, 0));

// Scenario 10: Breakdown by provider
const byProvider = {};
for (const r of rows) {
  const c = costOf(r, "EffectiveCost");
  byProvider[r.ProviderName] = (byProvider[r.ProviderName] || 0) + c;
}
const byProviderRounded = {};
for (const [k, v] of Object.entries(byProvider)) {
  byProviderRounded[k] = round2(v);
}

// Scenario 11: Per-month totals (for timeseries parity)
const byMonth = {};
for (const r of rows) {
  const key = ymKey(r.ChargePeriodStart);
  byMonth[key] = (byMonth[key] || 0) + costOf(r, "EffectiveCost");
}
const byMonthRounded = {};
for (const [k, v] of Object.entries(byMonth)) {
  byMonthRounded[k] = round2(v);
}

// Scenario 12: ResourceId generation pattern
const resourceIdSamples = rows.slice(0, 5).map(r => r.x_ResourceId);

// Scenario 13: Savings resourceId presence (some have it, some don't)
const savingsResourceIdPresence = SAVINGS_OPPORTUNITIES.map(s => ({
  id: s.id,
  hasResourceId: s.resourceId !== undefined && s.resourceId !== null,
}));

// ---------- Output fixture ----------

const fixture = {
  meta: {
    generatedAt: new Date().toISOString(),
    tsVersion: "reference",
    description: "Parity reference fixtures for Python → TS comparison",
  },
  dataset: {
    startDate: ds.startDate,
    endDate: ds.endDate,
    totalRows,
    categories,
  },
  prng: {
    seeds: seedTests,
    outputs: prngTests,
  },
  aggregation: {
    allProviders: {
      effectiveCost: round2(sumCost(rows, "EffectiveCost")),
      billedCost: round2(sumCost(rows, "BilledCost")),
    },
    awsOnly: {
      effectiveCost: awsEffectiveSum,
      billedCost: awsBilledSum,
      rowCount: awsRows.length,
    },
    mlTeamOnly: {
      effectiveCost: mlEffectiveSum,
      rowCount: mlRows.length,
    },
    jan2026Only: {
      effectiveCost: jan2026Sum,
      rowCount: jan2026Rows.length,
    },
    awsAndMl: {
      effectiveCost: awsMlSum,
      rowCount: awsMlRows.length,
    },
  },
  ymKey: ymKeyTests,
  savings: {
    totalCount: allSavings.length,
    totalMonthlySavings: savingsTotal,
    awsCount: awsSavings.length,
    awsTotalMonthlySavings: awsSavingsTotal,
    mlCount: mlSavings.length,
    mlTotalMonthlySavings: mlSavingsTotal,
    resourceIdPresence: savingsResourceIdPresence,
  },
  breakdown: {
    byProvider: byProviderRounded,
  },
  timeseries: {
    byMonth: byMonthRounded,
  },
  resourceIdSamples,
};

// Output JSON to stdout
process.stdout.write(JSON.stringify(fixture, null, 2) + "\n");
