import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FiltersProvider } from "@/lib/filters-store";
import { TenantProvider } from "@/lib/tenant-store";
import { UnitEconomicsProvider } from "@/lib/unit-economics-store";
import { AppLayout } from "@/components/layout/AppLayout";
import DashboardPage from "@/pages/dashboard";
import ConexoesPage from "@/pages/conexoes";
import UnitEconomicsPage from "@/pages/unit-economics";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/conexoes" component={ConexoesPage} />
      <Route path="/unit-economics" component={UnitEconomicsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <TenantProvider>
          <UnitEconomicsProvider>
            <FiltersProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <AppLayout>
                  <Router />
                </AppLayout>
              </WouterRouter>
            </FiltersProvider>
          </UnitEconomicsProvider>
        </TenantProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
