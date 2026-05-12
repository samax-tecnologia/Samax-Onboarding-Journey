import { useRef } from "react";
import { Users, Package, Bot, AlertTriangle, Info } from "lucide-react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { BudgetForecastCard } from "@/components/dashboard/BudgetForecastCard";
import { SavingsCard } from "@/components/dashboard/SavingsCard";
import { PastCostsChart } from "@/components/dashboard/PastCostsChart";
import { FocusBreakdownCard } from "@/components/dashboard/FocusBreakdownCard";
import { DimensionListCard } from "@/components/dashboard/DimensionListCard";
import { SavingsTable } from "@/components/dashboard/SavingsTable";
import { PrintHeader } from "@/components/dashboard/PrintHeader";
import { EmptyLiveBanner, ProvisionalBadge } from "@/components/dashboard/EmptyLiveBanner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

// =============================================================================
// BobBot card — hardcoded mock, no API calls
// =============================================================================
const BOBBOT_ALERTS = [
  {
    id: "a1",
    icon: "⚠️",
    text: "Custo de EC2 subiu 23% em relação à semana passada — R$ 4.200 → R$ 5.160",
    age: "há 2h",
  },
  {
    id: "a2",
    icon: "ℹ️",
    text: "Lambda: 3 funções sem invocação há 30+ dias. Economia potencial: R$ 280/mês",
    age: "há 1 dia",
  },
  {
    id: "a3",
    icon: "⚠️",
    text: "RDS: snapshot automático acumulou 240 GB além do esperado — R$ 190 extra/mês",
    age: "há 2 dias",
  },
];

const BUDGET_MOCK = { budget: 30000, atual: 23480, projecao: 27000 };

function BobBotCard() {
  const pctAtual = Math.round((BUDGET_MOCK.atual / BUDGET_MOCK.budget) * 100);
  const pctProj = Math.round((BUDGET_MOCK.projecao / BUDGET_MOCK.budget) * 100);
  const fmtBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(v);

  return (
    <Card className="lg:col-span-1 flex flex-col">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/15 flex items-center justify-center">
            <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <CardTitle className="text-base">BobBot</CardTitle>
          <Badge className="ml-auto bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px]">
            Ativo
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-3 flex-1 min-h-0">
        <Tabs defaultValue="alertas">
          <TabsList className="w-full h-8 text-xs mb-3">
            <TabsTrigger value="alertas" className="flex-1 text-xs">Alertas</TabsTrigger>
            <TabsTrigger value="recap" className="flex-1 text-xs">Weekly Recap</TabsTrigger>
            <TabsTrigger value="budget" className="flex-1 text-xs">Budget</TabsTrigger>
          </TabsList>

          <TabsContent value="alertas" className="mt-0 space-y-2">
            {BOBBOT_ALERTS.map((a) => (
              <div key={a.id} className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5">
                <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground leading-relaxed">{a.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{a.age}</p>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="recap" className="mt-0">
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-foreground space-y-1.5 leading-relaxed">
              <p className="font-semibold text-sm">📊 Recap da semana — 05 a 11 mai</p>
              <div className="h-px bg-border my-1.5" />
              <p>Gasto total: <span className="font-medium">R$ 23.480</span> <span className="text-muted-foreground">(+7% vs semana anterior)</span></p>
              <p>Top serviço: <span className="font-medium">EC2 — R$ 11.200</span></p>
              <p>Savings aplicados: <span className="font-medium text-emerald-600">R$ 800</span></p>
              <p className="text-muted-foreground">2 oportunidades abertas · R$ 5.500/mês em potencial</p>
            </div>
          </TabsContent>

          <TabsContent value="budget" className="mt-0 space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">Gasto atual</span>
                <span className="font-semibold tabular-nums">{fmtBRL(BUDGET_MOCK.atual)}</span>
              </div>
              <Progress value={pctAtual} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{pctAtual}% do budget</span>
                <span>Budget: {fmtBRL(BUDGET_MOCK.budget)}</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" /> Projeção do mês
                </span>
                <span className="font-semibold tabular-nums">{fmtBRL(BUDGET_MOCK.projecao)}</span>
              </div>
              <Progress value={pctProj} className="h-2 [&>div]:bg-amber-500" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>{pctProj}% do budget</span>
                <span className="text-amber-600">{fmtBRL(BUDGET_MOCK.budget - BUDGET_MOCK.projecao)} de folga</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Page
// =============================================================================
export default function DashboardPage() {
  const savingsRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <FilterBar />
      <div className="px-8 py-6 space-y-6 print:px-4 print:py-2 print:space-y-3">
        <PrintHeader />
        <div className="print:hidden flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">FinOps Overview</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão multi-cloud do seu gasto, organizada pelo padrão FOCUS.
            </p>
          </div>
          <ProvisionalBadge />
        </div>

        <EmptyLiveBanner />

        {/* Top-of-page priority */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BudgetForecastCard />
          <SavingsCard
            onViewAll={() =>
              savingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
          <BobBotCard />
        </div>

        {/* Past costs trend */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <PastCostsChart />
        </div>

        {/* Breakdowns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <FocusBreakdownCard />
          <div className="grid grid-cols-1 gap-4">
            <DimensionListCard
              dimension="team"
              title="Custo por time"
              icon={<Users className="w-3.5 h-3.5" />}
              limit={5}
            />
            <DimensionListCard
              dimension="product"
              title="Custo por produto"
              icon={<Package className="w-3.5 h-3.5" />}
              limit={6}
            />
          </div>
        </div>

        {/* Savings opportunities table */}
        <div ref={savingsRef} className="grid grid-cols-1 gap-4 scroll-mt-20">
          <SavingsTable />
        </div>

        <div className="text-center text-xs text-muted-foreground pt-4 pb-2 print:hidden">
          Dados ilustrativos gerados a partir de uma amostra FOCUS-formatted ·
          Substituição por exports reais (AWS CUR 2.0, Azure Cost Management, GCP Billing)
          em uma próxima entrega.
        </div>
      </div>
    </div>
  );
}
