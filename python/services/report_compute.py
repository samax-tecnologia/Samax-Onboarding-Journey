"""
Report computation service (pure port of ``report-compute.ts`` +
``report-unit-economics.ts`` from the source repo).

Deterministic, byte-identical semantics to the TS implementation:
Math.round half-up rounding (``_r2``/``_r4``), JS ``Date.UTC`` month
arithmetic (``_add_months``), ``toISOString`` formatting, pt-BR period
labels, and the scope-diff realized-savings attribution algorithm.

Accepts duck-typed ``baseline`` and ``applied_changes`` objects (Django
ORM instances or lightweight stubs) so the module stays pure and testable.
"""

from __future__ import annotations

import calendar
import math
import re
from datetime import datetime, timedelta, timezone

from services.focus import (
    FocusRow,
    apply_filters,
    cost_of,
    get_savings,
    load_dataset,
    naive_sum,
    sum_cost,
    ym_key,
)

# ``datetime.UTC`` alias only exists on Python 3.11+; CI/production run 3.10.
UTC = timezone.utc

CURRENCY = "USD"

# CLDR pt-BR short month names - matches Node ICU output of
# ``toLocaleDateString("pt-BR", { month: "short", year: "numeric" })``.
PT_BR_MONTHS_SHORT = [
    "jan.", "fev.", "mar.", "abr.", "mai.", "jun.",
    "jul.", "ago.", "set.", "out.", "nov.", "dez.",
]

_DAY_KEY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _r2(n: float) -> float:
    """``Math.round(n*100)/100`` (half-up)."""
    return math.floor(n * 100 + 0.5) / 100


def _r4(n: float) -> float:
    """``Math.round(n*10000)/10000`` (half-up)."""
    return math.floor(n * 10000 + 0.5) / 10000


def _js_num_str(n: float) -> str:
    """Format a float like JS ``String(n)`` (no trailing ``.0`` on integers)."""
    if n == int(n) and abs(n) < 2**53:
        return str(int(n))
    return repr(n)


def _utc(d: datetime) -> datetime:
    """Normalize to aware UTC; naive datetimes are treated as UTC."""
    if d.tzinfo is None:
        return d.replace(tzinfo=UTC)
    return d.astimezone(UTC)


def _iso_full(d: datetime) -> str:
    """``Date.toISOString()`` (always ``.sssZ``)."""
    d = _utc(d)
    return (
        f"{d.year:04d}-{d.month:02d}-{d.day:02d}"
        f"T{d.hour:02d}:{d.minute:02d}:{d.second:02d}"
        f".{d.microsecond // 1000:03d}Z"
    )


def _iso_date(d: datetime) -> str:
    d = _utc(d)
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def _add_months(dt: datetime, months: int) -> datetime:
    """First of month, ``months`` away from ``dt`` - ``Date.UTC`` month
    index arithmetic (overflows/underflows across year boundaries)."""
    total = dt.year * 12 + (dt.month - 1) + months
    year, month = divmod(total, 12)
    return datetime(year, month + 1, 1, tzinfo=UTC)  # noqa: FKA100


def months_between(start: datetime, end: datetime) -> int:
    s = start.year * 12 + (start.month - 1)
    e = end.year * 12 + (end.month - 1)
    return max(1, e - s)


def period_label(start: datetime, end: datetime) -> str:
    start = _utc(start)
    end = _utc(end)
    last_included = _add_months(end, -1)  # noqa: FKA100

    def fmt(d: datetime) -> str:
        return f"{PT_BR_MONTHS_SHORT[d.month - 1]} de {d.year}"

    return f"{fmt(start)} – {fmt(last_included)}"


def bucket_by(rows: list[FocusRow], cost_type: str, key_fn) -> dict[str, float]:
    out: dict[str, float] = {}
    for r in rows:
        k = key_fn(r)
        out[k] = out.get(k, 0) + cost_of(r, cost_type)  # noqa: FKA100
    return out


def compare_buckets(
    current: dict[str, float],
    baseline: dict[str, float],
    baseline_months: int,
    current_months: int,
    humanize,
    top_n: int = 12,
) -> list[dict]:
    def projected(v: float) -> float:
        return (v / baseline_months) * current_months

    rows = []
    for key in set(current) | set(baseline):
        cur = current.get(key, 0)  # noqa: FKA100
        base = projected(baseline.get(key, 0))  # noqa: FKA100
        delta = cur - base
        delta_pct = delta / base if base != 0 else 0
        rows.append(
            {
                "key": key,
                "label": humanize(key),
                "current": _r2(cur),
                "baseline": _r2(base),
                "delta": _r2(delta),
                "deltaPct": _r4(delta_pct),
            }
        )
    # JS sorts on the rounded delta value stored in the row.
    rows.sort(key=lambda r: abs(r["delta"]), reverse=True)
    return rows[:top_n]


def humanize_key(k: str) -> str:
    return " ".join(
        w[:1].upper() + w[1:] for w in re.split(r"[-_]", k)  # noqa: FKA100
    )


# ---------- realized savings attribution (report-compute.ts) ----------


def _active_months_for(c, months_current: int, period_start: datetime, period_end: datetime) -> int:
    applied_at = _utc(c.applied_at)
    if applied_at >= period_end:
        return 0
    effective_start = applied_at if applied_at > period_start else period_start
    return max(
        0,
        min(months_current, months_between(effective_start, period_end)),  # noqa: FKA100
    )


def _scope_of(c) -> tuple[str, str]:
    if c.scope_service:
        return ("service", c.scope_service)
    if c.scope_provider:
        return ("provider", c.scope_provider)
    if c.scope_category:
        return ("category", c.scope_category)
    return ("global", "__all__")


def _scope_diff(
    kind: str,
    key: str,
    rows: list[FocusRow],
    cost_type: str,
    baseline,
    current_by_service: dict,
    current_by_provider: dict,
    current_by_category: dict,
    months_current: int,
) -> float:
    def projected(v: float) -> float:
        return (v / baseline.metrics["months"]) * months_current

    if kind == "service":
        cur = current_by_service.get(key, 0)  # noqa: FKA100
        base = projected(baseline.metrics["byService"].get(key, 0))  # noqa: FKA100
        return base - cur
    if kind == "provider":
        cur = current_by_provider.get(key, 0)  # noqa: FKA100
        base = projected(baseline.metrics["byProvider"].get(key, 0))  # noqa: FKA100
        return base - cur
    if kind == "category":
        cur = current_by_category.get(key, 0)  # noqa: FKA100
        base = projected(baseline.metrics["byCategory"].get(key, 0))  # noqa: FKA100
        return base - cur
    cur_all = sum_cost(rows, cost_type)  # noqa: FKA100
    base_all = projected(baseline.total_cost)
    return base_all - cur_all


def attribute_realized_savings(
    rows: list[FocusRow],
    cost_type: str,
    baseline,
    months_current: int,
    period_start: datetime,
    period_end: datetime,
    changes: list,
) -> dict[str, dict]:
    """Scope-level realized savings per change.

    For each applied change with a scope (provider/service/category),
    compare actual in-period cost for that scope against the projected
    baseline cost for the same scope; the positive difference is credited
    across the changes covering it, proportionally to their estimated
    monthly savings. Overrides bypass the diff entirely.
    """
    current_by_service = bucket_by(rows, cost_type, lambda r: r.ServiceName)  # noqa: FKA100
    current_by_provider = bucket_by(rows, cost_type, lambda r: r.ProviderName)  # noqa: FKA100
    current_by_category = bucket_by(rows, cost_type, lambda r: r.ServiceCategory)  # noqa: FKA100

    realized_by_change: dict[str, dict] = {}
    groups: dict[str, list] = {}

    for c in changes:
        m = _active_months_for(c, months_current, period_start, period_end)  # noqa: FKA100
        if m == 0:
            realized_by_change[c.id] = {"monthly": 0, "activeMonths": 0}
            continue
        if c.realized_monthly_savings_override is not None:
            realized_by_change[c.id] = {
                "monthly": c.realized_monthly_savings_override,
                "activeMonths": m,
            }
            continue
        kind, key = _scope_of(c)
        groups.setdefault(f"{kind}::{key}", []).append(c)  # noqa: FKA100

    for group_key, group in groups.items():
        kind, key = group_key.split("::")
        full_diff = _scope_diff(  # noqa: FKA100
            kind,
            key,
            rows,
            cost_type,
            baseline,
            current_by_service,
            current_by_provider,
            current_by_category,
            months_current,
        )
        total_est_period = naive_sum(
            c.estimated_monthly_savings
            * _active_months_for(c, months_current, period_start, period_end)  # noqa: FKA100
            for c in group
        )
        credited_period = max(0, min(full_diff, total_est_period))
        if total_est_period <= 0:
            for c in group:
                realized_by_change[c.id] = {
                    "monthly": 0,
                    "activeMonths": _active_months_for(c, months_current, period_start, period_end),  # noqa: FKA100
                }
            continue
        for c in group:
            m = _active_months_for(c, months_current, period_start, period_end)  # noqa: FKA100
            share_period = (
                credited_period * (c.estimated_monthly_savings * m)
            ) / total_est_period
            realized_by_change[c.id] = {
                "monthly": share_period / m if m > 0 else 0,
                "activeMonths": m,
            }

    return realized_by_change


def build_time_series(
    rows: list[FocusRow],
    cost_type: str,
    start: datetime,
    end: datetime,
    baseline,
) -> list[dict]:
    monthly_base = baseline.metrics["monthlyAvg"]
    months: list[dict] = []
    d = _add_months(start, 0)  # noqa: FKA100
    while d < end:
        months.append(
            {
                "month": ym_key(d),
                "actual": 0,
                "projectedNoOptimization": _r2(monthly_base),
            }
        )
        d = _add_months(d, 1)  # noqa: FKA100
    idx = {m["month"]: m for m in months}
    for row in rows:
        p = idx.get(ym_key(row.ChargePeriodStart))
        if p:
            # r2 applied incrementally, mirroring the TS accumulator.
            p["actual"] = _r2(p["actual"] + cost_of(row, cost_type))  # noqa: FKA100
    return months


def build_efficiency_metrics(
    current_rows: list[FocusRow],
    baseline_rows: list[FocusRow],
    cost_type: str,
    months_current: int,
    months_baseline: int,
) -> list[dict]:
    total_cur = sum_cost(current_rows, cost_type)  # noqa: FKA100
    total_base = sum_cost(baseline_rows, cost_type)  # noqa: FKA100

    res_cur = {r.x_ResourceId for r in current_rows if r.x_ResourceId}
    res_base = {r.x_ResourceId for r in baseline_rows if r.x_ResourceId}
    cpr_cur = total_cur / months_current / len(res_cur) if res_cur else 0
    cpr_base = total_base / months_baseline / len(res_base) if res_base else 0

    purchase_cur = naive_sum(
        cost_of(r, cost_type)  # noqa: FKA100
        for r in current_rows
        if r.ChargeCategory == "Purchase"
    )
    purchase_base = naive_sum(
        cost_of(r, cost_type)  # noqa: FKA100
        for r in baseline_rows
        if r.ChargeCategory == "Purchase"
    )
    cov_cur = purchase_cur / total_cur if total_cur > 0 else 0
    cov_base = purchase_base / total_base if total_base > 0 else 0

    untagged_cur = naive_sum(
        cost_of(r, cost_type)  # noqa: FKA100
        for r in current_rows
        if not r.x_Team or r.x_Team == "unknown"
    )
    untagged_base = naive_sum(
        cost_of(r, cost_type)  # noqa: FKA100
        for r in baseline_rows
        if not r.x_Team or r.x_Team == "unknown"
    )
    untag_cur = untagged_cur / total_cur if total_cur > 0 else 0
    untag_base = untagged_base / total_base if total_base > 0 else 0

    run_cur = total_cur / months_current if months_current > 0 else 0
    run_base = total_base / months_baseline if months_baseline > 0 else 0

    return [
        {
            "key": "monthly_run_rate",
            "label": "Run-rate mensal",
            "value": _r2(run_cur),
            "unit": "USD",
            "baselineValue": _r2(run_base),
            "delta": _r2(run_cur - run_base),
            "hint": "Custo médio por mês no período vs no baseline.",
        },
        {
            "key": "cost_per_resource",
            "label": "Custo / recurso ativo / mês",
            "value": _r2(cpr_cur),
            "unit": "USD",
            "baselineValue": _r2(cpr_base),
            "delta": _r2(cpr_cur - cpr_base),
            "hint": "Custo mensal médio dividido pelo número de recursos únicos com cobrança.",
        },
        {
            "key": "commitment_coverage",
            "label": "Cobertura de commitments",
            "value": _r4(cov_cur),
            "unit": "ratio",
            "baselineValue": _r4(cov_base),
            "delta": _r4(cov_cur - cov_base),
            "hint": "Parcela do custo classificada como Purchase (RIs/SPs/CUDs).",
        },
        {
            "key": "untagged_share",
            "label": "Custo sem time atribuído",
            "value": _r4(untag_cur),
            "unit": "ratio",
            "baselineValue": _r4(untag_base),
            "delta": _r4(untag_cur - untag_base),
            "hint": "Parcela do custo sem rótulo de time — alvo de governança.",
        },
    ]


def compute_report(
    *,
    tenant_id: int,
    data_source: str = "mock",
    period_start: datetime,
    period_end: datetime,
    cost_type: str,
    baseline,
    applied_changes: list,
    unit_economics: list | None = None,
) -> dict:
    period_start = _utc(period_start)
    period_end = _utc(period_end)

    ds = load_dataset(tenant_id, data_source)  # noqa: FKA100
    rows = apply_filters(  # noqa: FKA100
        ds["monthlyRows"],
        {
            "startDate": period_start,
            "endDate": period_end,
            "costType": cost_type,
        },
    )
    baseline_rows = apply_filters(  # noqa: FKA100
        ds["monthlyRows"],
        {
            "startDate": _utc(baseline.period_start),
            "endDate": _utc(baseline.period_end),
            "costType": cost_type,
        },
    )
    total_cost = sum_cost(rows, cost_type)  # noqa: FKA100
    months_current = months_between(period_start, period_end)  # noqa: FKA100
    months_baseline = baseline.metrics["months"]
    baseline_projected_cost = (baseline.total_cost / months_baseline) * months_current

    applied_in_period = [
        c
        for c in applied_changes
        if _utc(c.applied_at) >= period_start and _utc(c.applied_at) < period_end
    ]
    active_changes = [
        c
        for c in applied_changes
        if c.status == "active" and _utc(c.applied_at) < period_end
    ]
    active_in_period_ids = {
        c.id for c in applied_in_period if c.status == "active"
    }

    realized_by_change = attribute_realized_savings(
        rows=rows,
        cost_type=cost_type,
        baseline=baseline,
        months_current=months_current,
        period_start=period_start,
        period_end=period_end,
        changes=active_changes,
    )
    realized_savings = naive_sum(
        v["monthly"] * v["activeMonths"]
        for v in realized_by_change.values()
    )

    applied_opp_ids = {
        c.opportunity_id
        for c in applied_changes
        if c.opportunity_id and len(c.opportunity_id) > 0
    }
    opps = [o for o in get_savings({}) if o.id not in applied_opp_ids]
    open_opps_total = naive_sum(o.monthlySavings for o in opps)

    top_wins = []
    for c in active_changes:
        if c.id not in active_in_period_ids:
            continue
        v = realized_by_change.get(c.id)
        monthly = v["monthly"] if v else 0
        period_total = monthly * (v["activeMonths"] if v else 0)
        scope = " · ".join(
            s for s in (c.scope_provider, c.scope_service, c.scope_category) if s
        )
        top_wins.append(
            {
                "id": c.id,
                "title": c.title,
                "realizedMonthlySavings": _r2(monthly),
                "realizedPeriodSavings": _r2(period_total),
                "scope": scope or None,
            }
        )
    top_wins = [
        w for w in top_wins if w["realizedPeriodSavings"] > 0
    ]
    top_wins.sort(key=lambda w: w["realizedPeriodSavings"], reverse=True)
    top_wins = top_wins[:3]
    top_wins_label = (
        " · ".join(
            f"{i + 1}. {w['title']} ({_js_num_str(_r2(w['realizedPeriodSavings']))})"
            for i, w in enumerate(top_wins)
        )
        if top_wins
        else None
    )

    by_category = compare_buckets(  # noqa: FKA100
        bucket_by(rows, cost_type, lambda r: r.ServiceCategory),  # noqa: FKA100
        baseline.metrics["byCategory"],
        months_baseline,
        months_current,
        lambda k: k,
    )
    by_provider = compare_buckets(  # noqa: FKA100
        bucket_by(rows, cost_type, lambda r: r.ProviderName),  # noqa: FKA100
        baseline.metrics["byProvider"],
        months_baseline,
        months_current,
        lambda k: k,
    )
    by_service = compare_buckets(  # noqa: FKA100
        bucket_by(rows, cost_type, lambda r: r.ServiceName),  # noqa: FKA100
        baseline.metrics["byService"],
        months_baseline,
        months_current,
        lambda k: k,
    )
    by_team = compare_buckets(  # noqa: FKA100
        bucket_by(rows, cost_type, lambda r: r.x_Team),  # noqa: FKA100
        baseline.metrics["byTeam"],
        months_baseline,
        months_current,
        humanize_key,
    )
    by_product = compare_buckets(  # noqa: FKA100
        bucket_by(rows, cost_type, lambda r: r.x_Product),  # noqa: FKA100
        baseline.metrics["byProduct"],
        months_baseline,
        months_current,
        humanize_key,
    )

    time_series = build_time_series(rows, cost_type, period_start, period_end, baseline)  # noqa: FKA100
    efficiency = build_efficiency_metrics(
        current_rows=rows,
        baseline_rows=baseline_rows,
        cost_type=cost_type,
        months_current=months_current,
        months_baseline=months_baseline,
    )
    unit_economics_metrics = None
    if unit_economics:
        unit_economics_metrics = build_unit_economics_for_report(
            ds=ds,
            period_start=period_start,
            period_end=period_end,
            cost_type=cost_type,
            inputs=unit_economics,
        )

    sections = {
        "executiveSummary": {
            "periodLabel": period_label(period_start, period_end),  # noqa: FKA100
            "baselineLabel": baseline.label,
            "totalCost": _r2(total_cost),
            "baselineProjectedCost": _r2(baseline_projected_cost),
            "realizedSavings": _r2(realized_savings),
            "savingsPercent": (
                _r4((baseline_projected_cost - total_cost) / baseline_projected_cost)
                if baseline_projected_cost > 0
                else 0
            ),
            "appliedChangesCount": len(applied_in_period),
            "openOpportunitiesCount": len(opps),
            "openOpportunitiesMonthlySavings": _r2(open_opps_total),
            "topWinsLabel": top_wins_label,
        },
        "topWins": top_wins,
        "timeSeries": time_series,
        "efficiency": efficiency,
        "byCategory": by_category,
        "byProvider": by_provider,
        "byService": by_service,
        "byTeam": by_team,
        "byProduct": by_product,
        "appliedChanges": [
            {
                "id": c.id,
                "title": c.title,
                "status": c.status,
                "opportunityId": c.opportunity_id,
                "appliedAt": _iso_full(c.applied_at),
                "author": c.author or None,
                "estimatedMonthlySavings": _r2(c.estimated_monthly_savings),
                "realizedMonthlySavings": _r2(v["monthly"] if v else 0),
                "realizedPeriodSavings": _r2(
                    (v["monthly"] * v["activeMonths"]) if v else 0
                ),
                "activeMonths": v["activeMonths"] if v else 0,
                "scopeProvider": c.scope_provider or None,
                "scopeService": c.scope_service or None,
                "scopeCategory": c.scope_category or None,
            }
            for c in applied_in_period
            for v in [realized_by_change.get(c.id)]
        ],
        "openOpportunities": [
            {
                "id": o.id,
                "title": o.title,
                "category": o.category,
                "provider": o.provider,
                "service": o.service,
                "monthlySavings": _r2(o.monthlySavings),
                "effort": o.effort,
                "team": o.team,
                "product": o.product,
            }
            for o in sorted(opps, key=lambda o: o.monthlySavings, reverse=True)[:20]
        ],
        "baselineSnapshot": {
            "periodStart": _iso_date(baseline.period_start),
            "periodEnd": _iso_date(baseline.period_end),
            "totalCost": _r2(baseline.total_cost),
            "monthlyAvg": _r2(baseline.metrics["monthlyAvg"]),
            "months": baseline.metrics["months"],
        },
    }
    if unit_economics_metrics is not None:
        # JS spreads `unitEconomics` only when present - absent otherwise.
        sections["unitEconomics"] = unit_economics_metrics

    return {
        "currency": CURRENCY,
        "periodStart": _iso_date(period_start),
        "periodEnd": _iso_date(period_end),
        "totalCost": _r2(total_cost),
        "baselineProjectedCost": _r2(baseline_projected_cost),
        "realizedSavings": _r2(realized_savings),
        "appliedChangesCount": len(applied_in_period),
        "monthsCurrent": months_current,
        "sections": sections,
    }


# ---------- unit economics (report-unit-economics.ts) ----------


def previous_period_key(period: str, granularity: str) -> str:
    if granularity == "month":
        y_str, m_str = period.split("-")
        y, mo = int(y_str), int(m_str)
        # Date.UTC(y, mo - 2, 1): month index (mo - 2), underflow-safe.
        return ym_key(_add_months(datetime(y, 1, 1, tzinfo=UTC), mo - 2))  # noqa: FKA100
    y_str, m_str, d_str = period.split("-")
    y, mo, dd = int(y_str), int(m_str), int(d_str)
    prev = datetime(y, mo, dd, tzinfo=UTC) - timedelta(days=1)  # noqa: FKA100
    return f"{prev.year:04d}-{prev.month:02d}-{prev.day:02d}"


def month_keys_between(start: datetime, end: datetime) -> list[str]:
    out: list[str] = []
    d = _add_months(start, 0)  # noqa: FKA100
    while d < end:
        out.append(ym_key(d))
        d = _add_months(d, 1)  # noqa: FKA100
    return out


def bucket_cost_by_month(rows: list[FocusRow], cost_type: str) -> dict[str, float]:
    out: dict[str, float] = {}
    for r in rows:
        k = ym_key(r.ChargePeriodStart)
        out[k] = out.get(k, 0) + cost_of(r, cost_type)  # noqa: FKA100
    return out


def build_series(
    cost_by_month: dict[str, float],
    months_in_period: list[str],
    denominator: dict,
    granularity: str,
    period_start: datetime,
    period_end: datetime,
) -> list[dict]:
    if granularity == "month":
        points = []
        for period in months_in_period:
            cost = _r2(cost_by_month.get(period, 0))  # noqa: FKA100
            volume = denominator.get(period)
            has_volume = isinstance(volume, (int, float)) and volume > 0
            points.append(
                {
                    "period": period,
                    "cost": cost,
                    "volume": volume if has_volume else None,
                    "unitCost": _r4(cost / volume) if has_volume else None,
                }
            )
        return points

    # Day granularity: only days with a denominator value, strictly inside
    # the [periodStart, periodEnd) window; month totals are pro-rated
    # uniformly across the days of that month.
    day_keys = []
    for k, _v in denominator.items():
        if _DAY_KEY_RE.match(k):
            y, mo, dd = (int(x) for x in k.split("-"))
            t = datetime(y, mo, dd, tzinfo=UTC)  # noqa: FKA100
            if t >= period_start and t < period_end:
                day_keys.append(k)
    day_keys.sort()

    points = []
    for day in day_keys:
        month = day[:7]
        y, mo = (int(x) for x in month.split("-"))
        days_in_month = calendar.monthrange(y, mo)[1]  # noqa: FKA100
        monthly_cost = cost_by_month.get(month, 0)  # noqa: FKA100
        day_cost = monthly_cost / days_in_month if days_in_month > 0 else 0
        volume = denominator.get(day)
        has_volume = isinstance(volume, (int, float)) and volume > 0
        points.append(
            {
                "period": day,
                "cost": _r2(day_cost),
                "volume": volume if has_volume else None,
                "unitCost": _r4(day_cost / volume) if has_volume else None,
            }
        )
    return points


def build_unit_economics_for_report(
    *,
    ds: dict,
    period_start: datetime,
    period_end: datetime,
    cost_type: str,
    inputs: list,
) -> list[dict]:
    if not inputs:
        return []
    period_start = _utc(period_start)
    period_end = _utc(period_end)
    months_in_period = month_keys_between(period_start, period_end)  # noqa: FKA100

    metrics = []
    for m in inputs:
        granularity = m.get("granularity") or "month"
        numerator = m.get("numerator") or {}
        rows = apply_filters(  # noqa: FKA100
            ds["monthlyRows"],
            {
                "startDate": period_start,
                "endDate": period_end,
                "costType": cost_type,
                "providers": numerator.get("providers") or None,
                "teams": numerator.get("teams") or None,
                "products": numerator.get("products") or None,
            },
        )
        cost_by_month = bucket_cost_by_month(rows, cost_type)  # noqa: FKA100
        series = build_series(  # noqa: FKA100
            cost_by_month,
            months_in_period,
            m.get("denominator") or {},
            granularity,
            period_start,
            period_end,
        )

        # KPI: most recent series point with a defined unitCost; previous must
        # be the immediately preceding calendar period (never non-adjacent).
        current = None
        for point in reversed(series):
            if point["unitCost"] is not None:
                current = point
                break
        previous = None
        if current:
            prev_period = previous_period_key(current["period"], granularity)  # noqa: FKA100
            found = next(
                (p for p in series if p["period"] == prev_period), None
            )
            previous = found if (found and found["unitCost"] is not None) else None

        delta = None
        delta_percent = None
        if (
            current
            and previous
            and current["unitCost"] is not None
            and previous["unitCost"] is not None
        ):
            delta = _r4(current["unitCost"] - previous["unitCost"])
            delta_percent = (
                _r4(
                    (current["unitCost"] - previous["unitCost"])
                    / previous["unitCost"]
                )
                if previous["unitCost"] != 0
                else None
            )

        metrics.append(
            {
                "id": m.get("id"),
                "name": m.get("name"),
                "unitLabel": m.get("unitLabel"),
                "format": m.get("format"),
                "granularity": granularity,
                "currentUnitCost": current["unitCost"] if current else None,
                "previousUnitCost": previous["unitCost"] if previous else None,
                "delta": delta,
                "deltaPercent": delta_percent,
                "currentPeriodLabel": current["period"] if current else None,
                "previousPeriodLabel": previous["period"] if previous else None,
                "series": series,
            }
        )
    return metrics
