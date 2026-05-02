import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout/AppLayout";
import CustomerPage from "@/pages/customer";
import InternalPage from "@/pages/internal";
import PlaceholderPage from "@/pages/placeholder";
import { JourneyProvider } from "@/lib/journey-store";
import { NotificationToaster } from "@/components/notifications/NotificationToaster";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={CustomerPage} />
      <Route path="/jornada-samax" component={InternalPage} />
      <Route path="/inicio">
        <PlaceholderPage title="Início" description="Seu dashboard principal está sendo preparado." />
      </Route>
      <Route path="/financeiro">
        <PlaceholderPage title="Financeiro" description="Visão geral de faturas, budgets e compromissos financeiros." />
      </Route>
      <Route path="/otimizacao">
        <PlaceholderPage title="Otimização" description="Recomendações e quick wins de redução de custo." />
      </Route>
      <Route path="/recursos">
        <PlaceholderPage title="Recursos" description="Inventário detalhado da sua infraestrutura em cloud." />
      </Route>
      <Route path="/tags">
        <PlaceholderPage title="Tags" description="Gestão de tags, showback e chargeback." />
      </Route>
      <Route path="/usuarios">
        <PlaceholderPage title="Usuários" description="Gerencie o acesso da sua equipe à Samax." />
      </Route>
      <Route path="/configuracoes">
        <PlaceholderPage title="Configurações" description="Configurações da conta, integrações e faturamento." />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <JourneyProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppLayout>
              <Router />
            </AppLayout>
            <NotificationToaster />
          </WouterRouter>
        </JourneyProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;