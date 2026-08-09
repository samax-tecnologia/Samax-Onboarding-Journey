"""
FOCUS aggregation service (pure port of the source repo).

Ports ``focus-mock.ts`` + ``focus-aggregate.ts`` from
``Samax-Onboarding-Journey/artifacts/api-server/src/lib/`` to Python with
deterministic, byte-identical semantics (mulberry32 PRNG, FNV-1a seeds,
Math.round half-up rounding, UTC date handling).

Mock-backed for now; the live path will swap to ``allocation.Resource``
(see migration plan §4 Phase 2 item 3).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

# ``datetime.UTC`` alias only exists on Python 3.11+; CI/production run 3.10.
UTC = timezone.utc

MASK32 = 0xFFFFFFFF

# ---------- deterministic PRNG / seeds (JS bitwise-faithful) ----------


def _imul(a: int, b: int) -> int:
    """``Math.imul``: low 32 bits of the product as an unsigned int."""
    return (a * b) & MASK32


def mulberry32(seed: int):
    """JS ``mulberry32`` PRNG; returns ``() -> float`` in [0, 1)."""

    def gen() -> float:
        nonlocal seed
        seed = (seed + 0x6D2B79F5) & MASK32
        t = seed
        t = _imul(t ^ (t >> 15), t | 1)  # noqa: FKA100
        t = (t ^ ((t + _imul(t ^ (t >> 7), t | 61)) & MASK32)) & MASK32  # noqa: FKA100
        return ((t ^ (t >> 14)) & MASK32) / 4294967296.0

    return gen


def hash_seed(*parts) -> int:
    """FNV-1a over ``String(part)`` joins, matching JS ``hashSeed``."""
    h = 2166136261
    for part in parts:
        for ch in str(part):
            h = _imul(h ^ ord(ch), 16777619)  # noqa: FKA100
    return h


# ---------- dataset types ----------


@dataclass
class FocusRow:
    ChargePeriodStart: datetime
    ChargePeriodEnd: datetime
    ProviderName: str
    ServiceCategory: str
    ServiceName: str
    ChargeCategory: str
    BilledCost: float
    EffectiveCost: float
    BillingCurrency: str
    x_Team: str
    x_Product: str
    x_ResourceId: str


@dataclass
class SavingOpportunity:
    id: str
    title: str
    category: str
    provider: str
    service: str
    resourceId: str | None
    team: str
    product: str
    monthlySavings: float
    currency: str
    recommendedAction: str
    effort: str
    details: str


TEAMS = ["platform", "data", "growth", "payments", "ml"]
PRODUCTS = [
    "checkout",
    "marketplace",
    "analytics",
    "mobile-app",
    "search",
    "recommendations",
    "fraud",
    "internal-tools",
]
PROVIDERS = ["AWS", "Azure", "GCP"]
ALL_PROVIDERS = PROVIDERS


def _iso(dt: datetime) -> str:
    """``Date.toISOString()`` for UTC midnight timestamps (always .000Z)."""
    return f"{dt.year:04d}-{dt.month:02d}-{dt.day:02d}T00:00:00.000Z"


SERVICES = {
    "AWS": [
        ("Amazon EC2", "Compute", 1800, None, None),
        ("Amazon S3", "Storage", 420, None, None),
        ("Amazon RDS", "Database", 950, None, None),
        ("Amazon CloudFront", "Networking", 260, None, None),
        ("AWS Lambda", "Compute", 180, None, {"checkout": 1.4, "fraud": 1.2}),
        (
            "Amazon SageMaker",
            "AI and Machine Learning",
            540,
            {"ml": 3, "data": 1.5},
            {"recommendations": 2.5, "fraud": 1.8},
        ),
        ("AWS Data Transfer", "Networking", 210, None, None),
    ],
    "Azure": [
        ("Azure Virtual Machines", "Compute", 1100, None, None),
        ("Azure Blob Storage", "Storage", 280, None, None),
        ("Azure SQL Database", "Database", 690, None, None),
        (
            "Azure OpenAI",
            "AI and Machine Learning",
            360,
            {"ml": 2.5},
            {"recommendations": 2, "search": 1.6},
        ),
        ("Azure Kubernetes Service", "Compute", 540, None, None),
        ("Azure Front Door", "Networking", 150, None, None),
    ],
    "GCP": [
        ("Compute Engine", "Compute", 980, None, None),
        ("Cloud Storage", "Storage", 220, None, None),
        (
            "BigQuery",
            "Analytics",
            720,
            {"data": 3, "ml": 1.5},
            {"analytics": 2.5, "recommendations": 1.4},
        ),
        ("Cloud SQL", "Database", 410, None, None),
        (
            "Vertex AI",
            "AI and Machine Learning",
            320,
            {"ml": 3},
            {"recommendations": 2.2},
        ),
        ("Cloud Load Balancing", "Networking", 130, None, None),
    ],
}


def _seasonal_multiplier(dt: datetime) -> float:
    """Higher load late in the year (holiday traffic), small midyear bump."""
    m = dt.month - 1  # JS getUTCMonth() 0..11
    yoy = 1 + 0.18 * ((dt.year - 2025) + m / 12)
    seasonal = (
        1
        + 0.12 * math.sin(((m - 2) * math.pi) / 6)
        + (0.18 if m in (10, 11) else 0)
    )
    return yoy * seasonal


def _round2(n: float) -> float:
    """``Math.round(n*100)/100`` (half-up)."""
    return math.floor(n * 100 + 0.5) / 100


# ---------- dataset build ----------

_cached_dataset = None


def build_dataset(reference_date: datetime | None = None):
    """Build the mocked FOCUS dataset (12 months, aggregated per month).

    Mirrors the JS module-level cache: the first call wins.
    """
    global _cached_dataset
    if _cached_dataset is not None:
        return _cached_dataset

    ref = reference_date or datetime.now(UTC)
    end = datetime(ref.year, ref.month + 1, 1, tzinfo=UTC) if ref.month < 12 else datetime(  # noqa: FKA100
        ref.year + 1, 1, 1, tzinfo=UTC
    )
    start = datetime(end.year, end.month - 12, 1, tzinfo=UTC) if end.month > 12 else datetime(  # noqa: FKA100
        end.year - 1, end.month, 1, tzinfo=UTC
    )

    rows: list[FocusRow] = []
    cursor = start
    while cursor < end:
        if cursor.month < 12:
            month_end = datetime(cursor.year, cursor.month + 1, 1, tzinfo=UTC)  # noqa: FKA100
        else:
            month_end = datetime(cursor.year + 1, 1, 1, tzinfo=UTC)  # noqa: FKA100
        days_in_month = round((month_end - cursor).total_seconds() / 86_400)
        seasonal = _seasonal_multiplier(cursor)

        for provider in PROVIDERS:
            for name, category, base_daily_cost, team_bias, product_bias in SERVICES[provider]:
                for team in TEAMS:
                    for product in PRODUCTS:
                        seed = hash_seed(_iso(cursor), provider, name, team, product)  # noqa: FKA100
                        rand = mulberry32(seed)

                        team_weight = (team_bias or {}).get(team, 1)  # noqa: FKA100
                        product_weight = (product_bias or {}).get(product, 1)  # noqa: FKA100
                        presence = rand()
                        presence_threshold = min(
                            0.92, 0.35 + 0.12 * (team_weight + product_weight)
                        )
                        if presence > presence_threshold:
                            continue

                        noise = 0.7 + rand() * 0.6
                        monthly_base = (
                            base_daily_cost
                            * days_in_month
                            * seasonal
                            * noise
                            * 0.04
                            * team_weight
                            * product_weight
                        )

                        usage_effective = monthly_base
                        usage_billed = usage_effective * (1.03 + rand() * 0.08)

                        rows.append(
                            FocusRow(
                                ChargePeriodStart=cursor,
                                ChargePeriodEnd=month_end,
                                ProviderName=provider,
                                ServiceCategory=category,
                                ServiceName=name,
                                ChargeCategory="Usage",
                                BilledCost=_round2(usage_billed),
                                EffectiveCost=_round2(usage_effective),
                                BillingCurrency="USD",
                                x_Team=team,
                                x_Product=product,
                                x_ResourceId=(
                                    f"{provider.lower()}-"
                                    f"{name.lower().replace(' ', '-').replace('/', '-')}-"
                                    f"{team}-{product}"
                                ),
                            )
                        )

                        if rand() < 0.08:
                            purchase = monthly_base * (0.4 + rand() * 0.3)
                            rows.append(
                                FocusRow(
                                    ChargePeriodStart=cursor,
                                    ChargePeriodEnd=month_end,
                                    ProviderName=provider,
                                    ServiceCategory=category,
                                    ServiceName=name,
                                    ChargeCategory="Purchase",
                                    BilledCost=_round2(purchase),
                                    EffectiveCost=_round2(purchase * 0.78),
                                    BillingCurrency="USD",
                                    x_Team=team,
                                    x_Product=product,
                                    x_ResourceId=f"commit-{provider.lower()}-{team}",
                                )
                            )
                        if rand() < 0.06:
                            credit = monthly_base * (0.05 + rand() * 0.05)
                            rows.append(
                                FocusRow(
                                    ChargePeriodStart=cursor,
                                    ChargePeriodEnd=month_end,
                                    ProviderName=provider,
                                    ServiceCategory=category,
                                    ServiceName=name,
                                    ChargeCategory="Credit",
                                    BilledCost=_round2(-credit),
                                    EffectiveCost=_round2(-credit),
                                    BillingCurrency="USD",
                                    x_Team=team,
                                    x_Product=product,
                                    x_ResourceId=f"credit-{provider.lower()}",
                                )
                            )
                        if rand() < 0.5:
                            tax = monthly_base * 0.03
                            rows.append(
                                FocusRow(
                                    ChargePeriodStart=cursor,
                                    ChargePeriodEnd=month_end,
                                    ProviderName=provider,
                                    ServiceCategory=category,
                                    ServiceName=name,
                                    ChargeCategory="Tax",
                                    BilledCost=_round2(tax),
                                    EffectiveCost=_round2(tax),
                                    BillingCurrency="USD",
                                    x_Team=team,
                                    x_Product=product,
                                    x_ResourceId=f"tax-{provider.lower()}",
                                )
                            )
        cursor = month_end

    _cached_dataset = {"startDate": start, "endDate": end, "monthlyRows": rows}
    return _cached_dataset


def reset_dataset_cache() -> None:
    """Test-only: clear the module-level dataset cache."""
    global _cached_dataset
    _cached_dataset = None


# ---------- savings opportunities (deterministic) ----------

_cached_savings = None


def build_savings_opportunities() -> list[SavingOpportunity]:
    global _cached_savings
    if _cached_savings is not None:
        return _cached_savings
    _cached_savings = [
        SavingOpportunity(
            id="sav-001",
            title="Idle EC2 fleet in us-east-1 (24 instances)",
            category="idle",
            provider="AWS",
            service="Amazon EC2",
            resourceId="i-0a1b2c-cluster-staging",
            team="platform",
            product="internal-tools",
            monthlySavings=8420,
            currency="USD",
            recommendedAction=(
                "Stop or terminate 24 m5.2xlarge instances with <2% CPU over "
                "the last 30 days."
            ),
            effort="low",
            details=(
                "These instances belong to a deprecated staging cluster. "
                "Average CPU 1.4%, average network <50 KB/s."
            ),
        ),
        SavingOpportunity(
            id="sav-002",
            title="Rightsize RDS db.r6g.4xlarge → db.r6g.2xlarge",
            category="rightsizing",
            provider="AWS",
            service="Amazon RDS",
            resourceId="checkout-prod-rds-1",
            team="payments",
            product="checkout",
            monthlySavings=5210,
            currency="USD",
            recommendedAction=(
                "Downsize the checkout primary RDS to half the vCPU/memory; "
                "p95 utilization is 38%."
            ),
            effort="medium",
            details=(
                "p95 CPU 38%, p95 memory 41%. Storage IOPS unchanged. "
                "Recommend test in staging first."
            ),
        ),
        SavingOpportunity(
            id="sav-003",
            title="Compute commitment coverage gap in Azure",
            category="commitment",
            provider="Azure",
            service="Azure Virtual Machines",
            resourceId=None,
            team="platform",
            product="marketplace",
            monthlySavings=12780,
            currency="USD",
            recommendedAction=(
                "Purchase a 1-year Reserved Instance for D-series VMs "
                "covering the steady 62% baseline."
            ),
            effort="low",
            details=(
                "Current on-demand spend is $19,400/mo with stable baseline "
                "since March. RI saves ~33% on the covered portion."
            ),
        ),
        SavingOpportunity(
            id="sav-004",
            title="Untagged GCP spend ($14.2k/mo unattributed)",
            category="untagged",
            provider="GCP",
            service="Compute Engine",
            resourceId=None,
            team="platform",
            product="internal-tools",
            monthlySavings=3100,
            currency="USD",
            recommendedAction=(
                "Apply x_Team and x_Product tags to 47 untagged instances in "
                "projects shared-infra-* to surface ownership."
            ),
            effort="medium",
            details=(
                "Showback assigns this spend to platform by default. Once "
                "tagged, ~$3.1k/mo can be attributed and reclaimed."
            ),
        ),
        SavingOpportunity(
            id="sav-005",
            title="Move cold S3 data to Glacier Instant Retrieval",
            category="storage-tier",
            provider="AWS",
            service="Amazon S3",
            resourceId="data-lake-archive-2024",
            team="data",
            product="analytics",
            monthlySavings=2640,
            currency="USD",
            recommendedAction=(
                "Apply lifecycle rule: objects in archive/ prefix not accessed "
                "in 60 days → Glacier IR."
            ),
            effort="low",
            details="82 TB eligible. No object accessed since November.",
        ),
        SavingOpportunity(
            id="sav-006",
            title="Idle SageMaker notebook instances",
            category="idle",
            provider="AWS",
            service="Amazon SageMaker",
            resourceId=None,
            team="ml",
            product="recommendations",
            monthlySavings=1980,
            currency="USD",
            recommendedAction=(
                "Auto-stop 11 ml.m5.xlarge notebooks with no kernel activity "
                "for 14+ days."
            ),
            effort="low",
            details=(
                "Notebooks left running by data scientists; lifecycle policy "
                "not applied."
            ),
        ),
        SavingOpportunity(
            id="sav-007",
            title="BigQuery slot commitment underused",
            category="commitment",
            provider="GCP",
            service="BigQuery",
            resourceId=None,
            team="data",
            product="analytics",
            monthlySavings=4350,
            currency="USD",
            recommendedAction=(
                "Reduce annual flex slot commitment from 2,000 to 1,200; peak "
                "usage is 1,180 slots."
            ),
            effort="medium",
            details=(
                "30-day p99 slot utilization is 1,180. Excess capacity is paid "
                "but unused."
            ),
        ),
        SavingOpportunity(
            id="sav-008",
            title="Rightsize AKS node pool",
            category="rightsizing",
            provider="Azure",
            service="Azure Kubernetes Service",
            resourceId=None,
            team="growth",
            product="marketplace",
            monthlySavings=2270,
            currency="USD",
            recommendedAction=(
                "Switch general-pool from Standard_D8s_v5 to Standard_D4s_v5; "
                "HPA p95 is 39%."
            ),
            effort="medium",
            details=(
                "Cluster autoscaler set to min=4. Node CPU p95 39%, memory "
                "p95 44%."
            ),
        ),
        SavingOpportunity(
            id="sav-009",
            title="Old Azure SQL backups (LTR retention too long)",
            category="storage-tier",
            provider="Azure",
            service="Azure SQL Database",
            resourceId=None,
            team="payments",
            product="checkout",
            monthlySavings=880,
            currency="USD",
            recommendedAction=(
                "Reduce long-term retention from 10y → 3y on non-regulated "
                "databases (3 dbs)."
            ),
            effort="low",
            details=(
                "Compliance requires 3y. Current 10y retention adds ~$880/mo."
            ),
        ),
        SavingOpportunity(
            id="sav-010",
            title="Untagged AWS Lambda functions",
            category="untagged",
            provider="AWS",
            service="AWS Lambda",
            resourceId=None,
            team="platform",
            product="internal-tools",
            monthlySavings=540,
            currency="USD",
            recommendedAction=(
                "Tag 38 Lambda functions missing x_Team/x_Product. ~$540/mo "
                "currently shows as platform default."
            ),
            effort="low",
            details="Mostly cron jobs and webhooks created via console.",
        ),
    ]
    return _cached_savings


# ---------- aggregation primitives (focus-aggregate.ts) ----------


def parse_list_param(raw) -> list[str] | None:
    if raw is None:
        return None
    items = [s.strip() for s in str(raw).split(",") if s.strip()]
    return items if items else None


def parse_date(raw) -> datetime | None:
    """``new Date(raw)`` semantics: ISO date/datetime → aware UTC datetime."""
    if raw is None or raw == "":
        return None
    try:
        value = str(raw).strip().rstrip("Z")
        if len(value) == 10:  # YYYY-MM-DD
            return datetime.strptime(value, "%Y-%m-%d").replace(tzinfo=UTC)  # noqa: FKA100
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=UTC)
        return dt.astimezone(UTC)
    except ValueError:
        return None


def apply_filters(rows: list[FocusRow], filters: dict) -> list[FocusRow]:
    start = filters.get("startDate")
    end = filters.get("endDate")
    providers = filters.get("providers")
    teams = filters.get("teams")
    products = filters.get("products")
    out = []
    for r in rows:
        if start and r.ChargePeriodStart < start:
            continue
        if end and r.ChargePeriodStart >= end:
            continue
        if providers and r.ProviderName not in providers:
            continue
        if teams and r.x_Team not in teams:
            continue
        if products and r.x_Product not in products:
            continue
        out.append(r)
    return out


def cost_of(row: FocusRow, cost_type: str) -> float:
    return row.BilledCost if cost_type == "BilledCost" else row.EffectiveCost


def sum_cost(rows: list[FocusRow], cost_type: str) -> float:
    total = 0.0
    for r in rows:
        total += cost_of(r, cost_type)  # noqa: FKA100
    return total


def naive_sum(values) -> float:
    """Sequential accumulation matching JS ``a + b`` reduce loops (NOT builtin sum())."""
    total = 0.0
    for v in values:
        total += v
    return total


def ym_key(d: datetime) -> str:
    return f"{d.year}-{d.month:02d}"


def get_dataset():
    return build_dataset()


def get_savings(filters: dict | None = None) -> list[SavingOpportunity]:
    filters = filters or {}
    providers = filters.get("providers")
    teams = filters.get("teams")
    products = filters.get("products")
    return [
        o
        for o in build_savings_opportunities()
        if not (providers and o.provider not in providers)
        and not (teams and o.team not in teams)
        and not (products and o.product not in products)
    ]


def default_period():
    ds = get_dataset()
    end = ds["endDate"]
    start = datetime(end.year, end.month - 1, 1, tzinfo=UTC) if end.month > 1 else datetime(  # noqa: FKA100
        end.year - 1, 12, 1, tzinfo=UTC
    )
    return {"start": start, "end": end}


def default_period_for_dataset(ds: dict):
    end = ds["endDate"]
    start = datetime(end.year, end.month - 1, 1, tzinfo=UTC) if end.month > 1 else datetime(  # noqa: FKA100
        end.year - 1, 12, 1, tzinfo=UTC
    )
    return {"start": start, "end": end}


def provisional_until() -> str:
    d = datetime.now(UTC) - timedelta(days=3)
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def load_dataset(tenant_id: int, data_source: str = "mock") -> dict:
    """Unified loader mirroring ``loadDataset``.

    Mock-backed for now (per migration plan). The live path will query
    ``allocation.Resource`` rows instead; until then, a live tenant with no
    ingested rows behaves exactly like the JS fallback (empty dataset).
    """
    if data_source == "live":
        # TODO(Phase 2 swap): query allocation.Resource for tenant rows and
        # map to FocusRow; for now mirror the JS no-rows fallback.
        return {
            "monthlyRows": [],
            "startDate": datetime.now(UTC),
            "endDate": datetime.now(UTC),
            "source": "live",
        }
    ds = build_dataset()
    return {
        "monthlyRows": ds["monthlyRows"],
        "startDate": ds["startDate"],
        "endDate": ds["endDate"],
        "source": "mock",
    }


# ---------- focus endpoint computations (routes/focus.ts) ----------

CURRENCY = "USD"


def _round4(n: float) -> float:
    return math.floor(n * 10000 + 0.5) / 10000


def _round_to(n: float, step: float) -> float:
    return math.floor(n / step + 0.5) * step


def _iso_date(d: datetime) -> str:
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def build_filters_from_query(q: dict, fallback: dict | None = None) -> dict:
    cost_type = "BilledCost" if q.get("costType") == "BilledCost" else "EffectiveCost"
    fallback = fallback or {}
    return {
        "startDate": parse_date(q.get("startDate")) or fallback.get("start"),
        "endDate": parse_date(q.get("endDate")) or fallback.get("end"),
        "providers": parse_list_param(q.get("providers")),
        "teams": parse_list_param(q.get("teams")),
        "products": parse_list_param(q.get("products")),
        "costType": cost_type,
    }


def compute_filters(tenant_id: int, data_source: str = "mock") -> dict:
    ds = load_dataset(tenant_id, data_source)  # noqa: FKA100
    if ds["monthlyRows"]:
        period = default_period_for_dataset(ds)
    else:
        now = datetime.now(UTC)
        period = {"start": now, "end": now}
    categories = sorted({r.ServiceCategory for r in ds["monthlyRows"]})
    return {
        "providers": list(ALL_PROVIDERS),
        "teams": list(TEAMS),
        "products": list(PRODUCTS),
        "categories": categories,
        "currency": CURRENCY,
        "periodStart": _iso_date(period["start"]),
        "periodEnd": _iso_date(period["end"]),
    }


def _empty_summary(cost_type: str | None, source: str) -> dict:
    today = _iso_date(datetime.now(UTC))
    return {
        "currency": CURRENCY,
        "periodStart": today,
        "periodEnd": today,
        "costType": "BilledCost" if cost_type == "BilledCost" else "EffectiveCost",
        "actualSpend": 0,
        "forecastSpend": 0,
        "budget": 0,
        "percentConsumed": 0,
        "projectedDelta": 0,
        "savingsTotal": 0,
        "savingsCount": 0,
        "topSavings": [],
        "dataSource": source,
        "provisionalUntil": provisional_until(),
        "hasLiveData": False,
    }


def _serialize_saving(s: SavingOpportunity) -> dict:
    data = {
        "id": s.id,
        "title": s.title,
        "category": s.category,
        "provider": s.provider,
        "service": s.service,
        "resourceId": s.resourceId,
        "team": s.team,
        "product": s.product,
        "monthlySavings": _round2(s.monthlySavings),
        "currency": s.currency,
        "recommendedAction": s.recommendedAction,
        "effort": s.effort,
        "details": s.details,
    }
    if data["resourceId"] is None:
        # JS serializes `resourceId: undefined` as a missing key (JSON.stringify
        # omits undefined values) - mirror that exactly for contract parity.
        del data["resourceId"]
    return data


def compute_summary(tenant_id: int, q: dict, data_source: str = "mock") -> dict:
    ds = load_dataset(tenant_id, data_source)  # noqa: FKA100
    if not ds["monthlyRows"]:
        return _empty_summary(q.get("costType"), ds["source"])  # noqa: FKA100
    period = default_period_for_dataset(ds)
    filters = build_filters_from_query(q, {"start": period["start"], "end": period["end"]})  # noqa: FKA100
    window_start = filters["startDate"] or period["start"]
    window_end = filters["endDate"] or period["end"]
    in_range = apply_filters(ds["monthlyRows"], filters)  # noqa: FKA100
    actual_spend = sum_cost(in_range, filters["costType"])  # noqa: FKA100

    last_month_start = datetime(  # noqa: FKA100
        window_end.year, window_end.month - 1, 1, tzinfo=UTC
    ) if window_end.month > 1 else datetime(window_end.year - 1, 12, 1, tzinfo=UTC)  # noqa: FKA100
    last_month_rows = apply_filters(  # noqa: FKA100
        ds["monthlyRows"],
        {**filters, "startDate": last_month_start, "endDate": window_end},
    )
    last_month_spend = sum_cost(last_month_rows, filters["costType"])  # noqa: FKA100
    ds_last_month_start = datetime(  # noqa: FKA100
        ds["endDate"].year, ds["endDate"].month - 1, 1, tzinfo=UTC
    ) if ds["endDate"].month > 1 else datetime(ds["endDate"].year - 1, 12, 1, tzinfo=UTC)  # noqa: FKA100
    is_current_open_window = ym_key(last_month_start) == ym_key(ds_last_month_start)
    elapsed_ratio = 0.7 if is_current_open_window else 1
    remainder = actual_spend - last_month_spend
    forecast_spend = remainder + last_month_spend / elapsed_ratio

    window_months = max(
        1,
        (window_end.year - window_start.year) * 12
        + (window_end.month - window_start.month),
    )
    prev_start = datetime(  # noqa: FKA100
        window_start.year, window_start.month - window_months, 1, tzinfo=UTC
    ) if window_start.month - window_months >= 1 else datetime(  # noqa: FKA100
        window_start.year - 1, window_start.month - window_months + 12, 1, tzinfo=UTC
    )
    prev_rows = apply_filters(  # noqa: FKA100
        ds["monthlyRows"],
        {**filters, "startDate": prev_start, "endDate": window_start},
    )
    prev_spend = sum_cost(prev_rows, filters["costType"])  # noqa: FKA100
    budget = _round_to(max(forecast_spend, prev_spend) * 1.05, 1000)  # noqa: FKA100
    percent_consumed = actual_spend / budget if budget > 0 else 0
    projected_delta = forecast_spend - budget

    savings = get_savings(
        {
            "providers": filters["providers"],
            "teams": filters["teams"],
            "products": filters["products"],
        }
    )
    savings_total = naive_sum(s.monthlySavings for s in savings)
    top_savings = sorted(savings, key=lambda s: s.monthlySavings, reverse=True)[:3]

    return {
        "currency": CURRENCY,
        "periodStart": _iso_date(window_start),
        "periodEnd": _iso_date(window_end),
        "costType": filters["costType"],
        "actualSpend": _round2(actual_spend),
        "forecastSpend": _round2(forecast_spend),
        "budget": _round2(budget),
        "percentConsumed": _round4(percent_consumed),
        "projectedDelta": _round2(projected_delta),
        "savingsTotal": _round2(savings_total),
        "savingsCount": len(savings),
        "topSavings": [_serialize_saving(s) for s in top_savings],
        "dataSource": ds["source"],
        "provisionalUntil": provisional_until(),
        "hasLiveData": ds["source"] == "live",
    }


def compute_timeseries(tenant_id: int, q: dict, data_source: str = "mock") -> dict:
    ds = load_dataset(tenant_id, data_source)  # noqa: FKA100
    if not ds["monthlyRows"]:
        return {
            "currency": CURRENCY,
            "costType": q.get("costType") or "EffectiveCost",
            "points": [],
            "momDelta": 0,
            "momDeltaPercent": 0,
            "totalRange": 0,
            "previousRangeTotal": 0,
        }
    custom_start = parse_date(q.get("startDate"))
    custom_end = parse_date(q.get("endDate"))
    has_custom_range = bool(custom_start and custom_end)
    months = int(q.get("months")) if q.get("months") else 6
    fallback_end = ds["endDate"]
    fallback_start = datetime(  # noqa: FKA100
        fallback_end.year, fallback_end.month - months, 1, tzinfo=UTC
    ) if fallback_end.month - months >= 1 else datetime(  # noqa: FKA100
        fallback_end.year - 1, fallback_end.month - months + 12, 1, tzinfo=UTC
    )
    filters = build_filters_from_query(  # noqa: FKA100
        q, {"start": fallback_start, "end": fallback_end}
    )
    start = custom_start if has_custom_range else fallback_start
    end = custom_end if has_custom_range else fallback_end
    filters["startDate"] = start
    filters["endDate"] = end

    in_range = apply_filters(ds["monthlyRows"], filters)  # noqa: FKA100
    granularity = "day" if q.get("granularity") == "day" else "month"

    month_buckets: dict[str, dict] = {}
    cursor = start
    while cursor < end:
        key = ym_key(cursor)
        month_buckets[key] = {"total": 0.0, "byProvider": {p: 0.0 for p in ALL_PROVIDERS}}
        if cursor.month < 12:
            cursor = datetime(cursor.year, cursor.month + 1, 1, tzinfo=UTC)  # noqa: FKA100
        else:
            cursor = datetime(cursor.year + 1, 1, 1, tzinfo=UTC)  # noqa: FKA100

    for r in in_range:
        key = ym_key(r.ChargePeriodStart)
        bucket = month_buckets.get(key)
        if not bucket:
            continue
        c = cost_of(r, filters["costType"])  # noqa: FKA100
        bucket["total"] += c
        bucket["byProvider"][r.ProviderName] = bucket["byProvider"].get(r.ProviderName, 0) + c  # noqa: FKA100

    points = []
    if granularity == "day":
        for period, b in month_buckets.items():
            y_str, m_str = period.split("-")
            y, mo = int(y_str), int(m_str)
            month_start = datetime(y, mo, 1, tzinfo=UTC)  # noqa: FKA100
            if mo < 12:
                month_end = datetime(y, mo + 1, 1, tzinfo=UTC)  # noqa: FKA100
            else:
                month_end = datetime(y + 1, 1, 1, tzinfo=UTC)  # noqa: FKA100
            days_in_month = round((month_end - month_start).total_seconds() / 86_400)
            if days_in_month <= 0:
                continue
            day_total = b["total"] / days_in_month
            day_by_provider = {k: v / days_in_month for k, v in b["byProvider"].items()}
            for d in range(1, days_in_month + 1):
                day = datetime(y, mo, d, tzinfo=UTC)  # noqa: FKA100
                if day < start or day >= end:
                    continue
                day_key = f"{y}-{mo:02d}-{d:02d}"
                points.append(
                    {
                        "period": day_key,
                        "total": _round2(day_total),
                        "byProvider": {k: _round2(v) for k, v in day_by_provider.items()},
                    }
                )
        points.sort(key=lambda p: p["period"])
    else:
        for period, b in month_buckets.items():
            points.append(
                {
                    "period": period,
                    "total": _round2(b["total"]),
                    "byProvider": {k: _round2(v) for k, v in b["byProvider"].items()},
                }
            )

    total_range = naive_sum(p["total"] for p in points)

    if granularity == "day":
        window_days = max(1, round((end - start).total_seconds() / 86_400))
        prev_start = start - timedelta(days=window_days)
        prev_end = start
    else:
        window_months = max(
            1,
            (end.year - start.year) * 12 + (end.month - start.month),
        )
        prev_start = datetime(  # noqa: FKA100
            start.year, start.month - window_months, 1, tzinfo=UTC
        ) if start.month - window_months >= 1 else datetime(  # noqa: FKA100
            start.year - 1, start.month - window_months + 12, 1, tzinfo=UTC
        )
        prev_end = start
    prev_rows = apply_filters(  # noqa: FKA100
        ds["monthlyRows"],
        {**filters, "startDate": prev_start, "endDate": prev_end},
    )
    previous_range_total = 0.0
    if granularity == "day":
        for r in prev_rows:
            month_start = r.ChargePeriodStart
            month_end = datetime(  # noqa: FKA100
                month_start.year, month_start.month + 1, 1, tzinfo=UTC
            ) if month_start.month < 12 else datetime(month_start.year + 1, 1, 1, tzinfo=UTC)  # noqa: FKA100
            days_in_month = round((month_end - month_start).total_seconds() / 86_400)
            overlap_start = month_start if month_start > prev_start else prev_start
            overlap_end = month_end if month_end < prev_end else prev_end
            overlap_days = max(
                0, round((overlap_end - overlap_start).total_seconds() / 86_400)
            )
            if overlap_days == 0 or days_in_month == 0:
                continue
            previous_range_total += cost_of(r, filters["costType"]) * (overlap_days / days_in_month)  # noqa: FKA100
    else:
        previous_range_total = sum_cost(prev_rows, filters["costType"])  # noqa: FKA100

    last = points[-1] if points else None
    prev = points[-2] if len(points) >= 2 else None
    mom_delta = (last["total"] - prev["total"]) if last and prev else 0
    mom_delta_percent = (mom_delta / prev["total"]) if last and prev and prev["total"] > 0 else 0

    return {
        "currency": CURRENCY,
        "costType": filters["costType"],
        "points": points,
        "momDelta": _round2(mom_delta),
        "momDeltaPercent": _round4(mom_delta_percent),
        "totalRange": _round2(total_range),
        "previousRangeTotal": _round2(previous_range_total),
    }


def _humanize_key(dimension: str, key: str) -> str:
    if dimension in ("team", "product"):
        return " ".join(w[:1].upper() + w[1:] for w in key.replace("-", "_").split("_"))  # noqa: FKA100
    return key


def compute_breakdown(tenant_id: int, q: dict, data_source: str = "mock") -> dict:
    dimension = q.get("dimension")
    parent = q.get("parent")
    try:
        limit = int(q.get("limit")) if q.get("limit") is not None else 12
    except (TypeError, ValueError):
        limit = 12

    ds = load_dataset(tenant_id, data_source)  # noqa: FKA100
    if not ds["monthlyRows"]:
        out = {
            "dimension": dimension,
            "currency": CURRENCY,
            "costType": q.get("costType") or "EffectiveCost",
            "totalAmount": 0,
            "items": [],
        }
        if parent is not None:
            out["parent"] = parent
        return out
    period = default_period_for_dataset(ds)
    trailing_start = datetime(  # noqa: FKA100
        period["end"].year, period["end"].month - 3, 1, tzinfo=UTC
    ) if period["end"].month > 3 else datetime(  # noqa: FKA100
        period["end"].year - 1, period["end"].month - 3 + 12, 1, tzinfo=UTC
    )
    filters = build_filters_from_query(  # noqa: FKA100
        q, {"start": trailing_start, "end": period["end"]}
    )

    rows = apply_filters(ds["monthlyRows"], filters)  # noqa: FKA100
    if dimension == "serviceName" and parent:
        rows = [r for r in rows if r.ServiceCategory == parent]

    def key_of(r: FocusRow) -> str:
        return {  # noqa: FKA100
            "serviceCategory": r.ServiceCategory,
            "chargeCategory": r.ChargeCategory,
            "serviceName": r.ServiceName,
            "team": r.x_Team,
            "product": r.x_Product,
            "provider": r.ProviderName,
        }.get(dimension, "")

    totals: dict[str, float] = {}
    months: list[str] = []
    cursor = filters["startDate"] or trailing_start
    end_cursor = filters["endDate"] or period["end"]
    while cursor < end_cursor:
        months.append(ym_key(cursor))
        if cursor.month < 12:
            cursor = datetime(cursor.year, cursor.month + 1, 1, tzinfo=UTC)  # noqa: FKA100
        else:
            cursor = datetime(cursor.year + 1, 1, 1, tzinfo=UTC)  # noqa: FKA100
    per_month: dict[str, dict[str, float]] = {}

    for r in rows:
        k = key_of(r)
        c = cost_of(r, filters["costType"])  # noqa: FKA100
        totals[k] = totals.get(k, 0) + c  # noqa: FKA100
        m = ym_key(r.ChargePeriodStart)
        mm = per_month.setdefault(k, {})  # noqa: FKA100
        mm[m] = mm.get(m, 0) + c  # noqa: FKA100

    total_amount = naive_sum(totals.values())

    items = []
    for key, amount in sorted(totals.items(), key=lambda kv: abs(kv[1]), reverse=True)[:limit]:
        sparkline = [_round2(per_month.get(key, {}).get(m, 0)) for m in months]  # noqa: FKA100
        items.append(
            {
                "key": key,
                "label": _humanize_key(dimension, key),  # noqa: FKA100
                "amount": _round2(amount),
                "percent": _round4(amount / total_amount) if total_amount != 0 else 0,
                "sparkline": sparkline,
            }
        )

    out = {
        "dimension": dimension,
        "currency": CURRENCY,
        "costType": filters["costType"],
        "totalAmount": _round2(total_amount),
        "items": items,
    }
    if parent is not None:
        out["parent"] = parent
    return out


def compute_savings(q: dict) -> dict:
    filters = {
        "providers": parse_list_param(q.get("providers")),
        "teams": parse_list_param(q.get("teams")),
        "products": parse_list_param(q.get("products")),
    }
    all_opps = get_savings(filters)
    total_monthly_savings = naive_sum(o.monthlySavings for o in all_opps)
    return {
        "currency": CURRENCY,
        "totalMonthlySavings": _round2(total_monthly_savings),
        "count": len(all_opps),
        "opportunities": [
            _serialize_saving(o)
            for o in sorted(all_opps, key=lambda s: s.monthlySavings, reverse=True)
        ],
    }
