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

export function formatPeriod(period: string): string {
  // Accepts "YYYY-MM" or "YYYY-MM-DD".
  const parts = period.split("-").map((v) => Number(v));
  const [y, m, d] = parts;
  if (!y || !m) return period;
  if (d && parts.length >= 3) {
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
  }
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function humanize(key: string): string {
  return key
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
