import { useRef } from "react";
import { Users, Package } from "lucide-react";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { BudgetForecastCard } from "@/components/dashboard/BudgetForecastCard";
import { SavingsCard } from "@/components/dashboard/SavingsCard";
import { PastCostsChart } from "@/components/dashboard/PastCostsChart";
import { FocusBreakdownCard } from "@/components/dashboard/FocusBreakdownCard";
import { DimensionListCard } from "@/components/dashboard/DimensionListCard";
import { SavingsTable } from "@/components/dashboard/SavingsTable";
import { PrintHeader } from "@/components/dashboard/PrintHeader";

export default function DashboardPage() {
  const savingsRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <FilterBar />
      <div className="px-8 py-6 space-y-6 print:px-4 print:py-2 print:space-y-3">
        <PrintHeader />
        <div className="print:hidden">
          <h1 className="text-2xl font-semibold tracking-tight">FinOps Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visão multi-cloud do seu gasto, organizada pelo padrão FOCUS.
          </p>
        </div>

        {/* Top-of-page priority */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <BudgetForecastCard />
          <SavingsCard
            onViewAll={() =>
              savingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          />
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
