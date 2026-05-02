import { useMemo, useState } from "react";
import { useGetFocusFilters } from "@workspace/api-client-react";
import {
  useFilters,
  useSyncAnchor,
  type CostType,
  type DateRange,
  type PresetMonths,
} from "@/lib/filters-store";
import { humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { CalendarRange, ChevronDown, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DateRange as RDPDateRange } from "react-day-picker";

type MultiProps = {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  formatLabel?: (raw: string) => string;
};

function MultiSelect({ label, options, value, onChange, formatLabel }: MultiProps) {
  const fmt = formatLabel ?? ((s: string) => s);
  const summary =
    value.length === 0
      ? "Todos"
      : value.length === 1
        ? fmt(value[0])
        : `${value.length} selecionados`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 justify-between min-w-[160px] gap-2"
        >
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm font-medium truncate">{summary}</span>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {value.length > 0 && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => onChange([])}
            >
              Limpar
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {options.map((opt) => {
            const checked = value.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover-elevate cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onChange([...value, opt]);
                    else onChange(value.filter((v) => v !== opt));
                  }}
                />
                <span className="text-sm">{fmt(opt)}</span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toIsoDate(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}

function fromIsoDate(iso: string): Date | undefined {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatHumanDate(iso: string): string {
  const dt = fromIsoDate(iso);
  if (!dt) return iso;
  return dt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type CustomRangePickerProps = {
  range: DateRange;
  onApply: (next: DateRange) => void;
};

function CustomRangePicker({ range, onApply }: CustomRangePickerProps) {
  const [open, setOpen] = useState(false);
  const initialSelected: RDPDateRange | undefined = useMemo(() => {
    if (range.mode !== "custom") return undefined;
    return {
      from: fromIsoDate(range.startDate),
      to: fromIsoDate(range.endDate),
    };
  }, [range]);
  const [selected, setSelected] = useState<RDPDateRange | undefined>(
    initialSelected,
  );

  const isActive = range.mode === "custom";
  const summary =
    range.mode === "custom"
      ? `${formatHumanDate(range.startDate)} → ${formatHumanDate(range.endDate)}`
      : "Personalizado";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setSelected(initialSelected);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className="h-9 gap-2"
        >
          <CalendarRange className="w-3.5 h-3.5" />
          <span className="text-sm font-medium truncate">{summary}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-3">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={selected}
          onSelect={setSelected}
          captionLayout="dropdown"
        />
        <div className="flex items-center justify-between gap-2 pt-3 border-t mt-2">
          <span className="text-xs text-muted-foreground">
            {selected?.from && selected?.to
              ? `${formatHumanDate(toIsoDate(selected.from))} → ${formatHumanDate(toIsoDate(selected.to))}`
              : "Escolha início e fim"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelected(undefined);
              }}
            >
              Limpar
            </Button>
            <Button
              size="sm"
              disabled={!selected?.from || !selected?.to}
              onClick={() => {
                if (!selected?.from || !selected?.to) return;
                onApply({
                  mode: "custom",
                  startDate: toIsoDate(selected.from),
                  endDate: toIsoDate(selected.to),
                });
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar() {
  const { data, isLoading } = useGetFocusFilters();
  useSyncAnchor(data?.periodEnd);
  const { filters, setProviders, setTeams, setProducts, setCostType, setRange, reset } =
    useFilters();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 px-8 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>
    );
  }

  const activeCount =
    filters.providers.length + filters.teams.length + filters.products.length;

  const presetValue = filters.range.mode === "preset" ? String(filters.range.months) : "";

  return (
    <div className="flex items-center gap-2 flex-wrap px-8 py-4 border-b bg-background/80 backdrop-blur sticky top-0 z-10 print:hidden">
      <div className="flex items-center gap-2 mr-2">
        <Tabs
          value={presetValue}
          onValueChange={(v) =>
            setRange({ mode: "preset", months: Number(v) as PresetMonths })
          }
        >
          <TabsList className="h-9">
            <TabsTrigger value="3" className="text-xs px-3">
              Últimos 3 meses
            </TabsTrigger>
            <TabsTrigger value="6" className="text-xs px-3">
              6 meses
            </TabsTrigger>
            <TabsTrigger value="12" className="text-xs px-3">
              12 meses
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <CustomRangePicker range={filters.range} onApply={setRange} />
      </div>

      <MultiSelect
        label="Provedor"
        options={data.providers}
        value={filters.providers}
        onChange={setProviders}
      />
      <MultiSelect
        label="Time"
        options={data.teams}
        value={filters.teams}
        onChange={setTeams}
        formatLabel={humanize}
      />
      <MultiSelect
        label="Produto"
        options={data.products}
        value={filters.products}
        onChange={setProducts}
        formatLabel={humanize}
      />

      <div className="ml-auto flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Custo</Label>
        <Select
          value={filters.costType}
          onValueChange={(v) => setCostType(v as CostType)}
        >
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EffectiveCost">EffectiveCost</SelectItem>
            <SelectItem value="BilledCost">BilledCost</SelectItem>
          </SelectContent>
        </Select>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={reset} className="h-9 gap-1">
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar filtros
            <Badge variant="secondary" className="ml-1">
              {activeCount}
            </Badge>
          </Button>
        )}
      </div>
    </div>
  );
}
