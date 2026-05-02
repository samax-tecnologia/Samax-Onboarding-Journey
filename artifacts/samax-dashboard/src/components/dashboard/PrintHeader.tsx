import { useGetFocusFilters } from "@workspace/api-client-react";
import { useFilters, deriveWindow } from "@/lib/filters-store";
import { humanize } from "@/lib/format";

function formatList(values: string[], allLabel: string, fmt: (s: string) => string = (s) => s) {
  if (values.length === 0) return allLabel;
  return values.map(fmt).join(", ");
}

export function PrintHeader() {
  const { filters, anchorEnd } = useFilters();
  const { data } = useGetFocusFilters();

  const window = deriveWindow(filters.range, anchorEnd);
  const periodText =
    filters.range.mode === "preset"
      ? `Últimos ${filters.range.months} meses${
          window.startDate && window.endDate
            ? ` (${window.startDate} → ${window.endDate})`
            : ""
        }`
      : `${filters.range.startDate} → ${filters.range.endDate}`;

  const generatedAt = new Date().toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="hidden print:block border-b pb-4 mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Samax · FinOps
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Snapshot da Visão Geral
          </h1>
        </div>
        <div className="text-xs text-muted-foreground text-right">
          Gerado em {generatedAt}
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Período:</dt>
          <dd className="font-medium">{periodText}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Custo:</dt>
          <dd className="font-medium">{filters.costType}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Provedores:</dt>
          <dd className="font-medium">
            {formatList(
              filters.providers,
              data ? `Todos (${data.providers.join(", ")})` : "Todos",
            )}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted-foreground w-20">Times:</dt>
          <dd className="font-medium">
            {formatList(filters.teams, "Todos", humanize)}
          </dd>
        </div>
        <div className="flex gap-2 col-span-2">
          <dt className="text-muted-foreground w-20">Produtos:</dt>
          <dd className="font-medium">
            {formatList(filters.products, "Todos", humanize)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
