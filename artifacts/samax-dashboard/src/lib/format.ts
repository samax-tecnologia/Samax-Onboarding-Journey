export function formatCurrency(
  amount: number,
  currency: string = "USD",
  opts: { compact?: boolean; signed?: boolean } = {},
): string {
  const { compact = false, signed = false } = opts;
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
    signDisplay: signed ? "exceptZero" : "auto",
  });
  return formatter.format(amount);
}

export function formatPercent(ratio: number, fractionDigits = 1): string {
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

export function formatPeriod(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map((v) => Number(v));
  if (!y || !m) return yyyymm;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function humanize(key: string): string {
  return key
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
