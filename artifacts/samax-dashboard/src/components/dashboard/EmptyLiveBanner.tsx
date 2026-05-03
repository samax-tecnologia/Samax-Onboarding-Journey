import { Link } from "wouter";
import { useGetFocusSummary } from "@workspace/api-client-react";
import { useFilters, toCommonParams } from "@/lib/filters-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plug } from "lucide-react";

export function EmptyLiveBanner() {
  const { filters, anchorEnd } = useFilters();
  const { data } = useGetFocusSummary(toCommonParams(filters, anchorEnd));
  if (!data || data.dataSource !== "live" || data.hasLiveData) return null;
  return (
    <Card className="p-5 border-dashed bg-muted/30 flex flex-col md:flex-row md:items-center gap-3 justify-between print:hidden">
      <div>
        <div className="font-medium">Nenhum dado real ingerido ainda</div>
        <p className="text-sm text-muted-foreground">
          Conecte AWS, Azure ou GCP — ou crie uma conexão de exemplo — para ver os números reais aqui.
        </p>
      </div>
      <Link href="/conexoes">
        <Button>
          <Plug className="w-4 h-4 mr-1.5" /> Configurar conexões
        </Button>
      </Link>
    </Card>
  );
}

export function ProvisionalBadge() {
  const { filters, anchorEnd } = useFilters();
  const { data } = useGetFocusSummary(toCommonParams(filters, anchorEnd));
  if (!data?.provisionalUntil) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground border rounded px-1.5 py-0.5">
      Provisório até {new Date(data.provisionalUntil).toLocaleDateString("pt-BR")}
    </span>
  );
}
