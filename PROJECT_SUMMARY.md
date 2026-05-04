# PROJECT_SUMMARY

> Resumo derivado direto do código do monorepo.
> Itens marcados como **(não confirmado)** não foram verificados no código nesta análise — podem ou não estar implementados.

## 1. Visão geral

Monorepo pnpm em TypeScript que entrega a plataforma **Samax** (FinOps em pt-BR), composta por:

- `samax-onboarding` — app web do fluxo de onboarding/jornada do cliente.
- `samax-dashboard` — app web operacional (dashboard FOCUS, conexões, unit economics, relatórios).
- `api-server` — API Express 5 que serve os dois apps.
- `mockup-sandbox` — sandbox de preview de componentes (uso interno de design).
- `lib/*` — bibliotecas compartilhadas (contrato OpenAPI, hooks gerados, schemas Zod, schema de DB, contexto de tenant).

Propósito de produto, posicionamento de mercado, modelo de negócio e personas: **(não confirmado)** — não há documento de produto no repositório lido.

## 2. Stack confirmada

Confirmado em `replit.md` e nos `package.json` lidos:

- pnpm workspaces, Node.js 24, TypeScript 5.9.
- Backend: Express 5.
- Banco: PostgreSQL via Drizzle ORM (schemas em `lib/db/src/schema/`).
- Validação: Zod (`zod/v4`) + `drizzle-zod`.
- Codegen de API: Orval, a partir de `lib/api-spec/openapi.yaml`.
- Build do servidor: esbuild (CJS bundle).
- Frontend (confirmado nos imports): React + Vite, wouter (router), TanStack Query, Recharts, shadcn/ui (componentes em `components/ui`), lucide-react.

## 3. Estrutura do monorepo

```
artifacts/
  api-server/         # Express 5, rotas em src/routes/
  samax-dashboard/    # web app — dashboard
  samax-onboarding/   # web app — onboarding
  mockup-sandbox/     # design sandbox
lib/
  api-spec/           # OpenAPI (fonte de verdade)
  api-client-react/   # hooks React Query gerados
  api-zod/            # schemas Zod gerados
  db/                 # Drizzle schemas
  tenant-context/     # contexto multi-tenant
scripts/              # utilitários de workspace
```

## 4. API (confirmado em `lib/api-spec/openapi.yaml` e `artifacts/api-server/src/routes/`)

Tags e rotas observadas:

- `health` — `/healthz`.
- `focus` — `/focus/filters`, `/focus/summary`, `/focus/timeseries` (parâmetros: `months` 3/6/12 ou `startDate`/`endDate`; `granularity` month/day; filtros `providers`/`teams`/`products`/`costType`), `/focus/breakdown` (dimensão = `serviceCategory`/`chargeCategory`/`serviceName`/`team`/`product`/`provider`).
- `connections` — gestão de conexões de provedor.
- Rotas adicionais com arquivo próprio: `reports.ts`, `tenants.ts`, `health.ts`.

Schemas e operações específicas além do listado: **(não confirmado)** — só foi lida a parte inicial do OpenAPI.

## 5. Banco de dados (`lib/db/src/schema/`)

Arquivos de schema confirmados (por `ls`):

- `tenants.ts`
- `provider-connections.ts`
- `sync-runs.ts`
- `focus-billing.ts`
- `baselines.ts`
- `applied-changes.ts`
- `optimization-reports.ts`

Colunas, índices e relações de cada schema: **(não confirmado)** — arquivos não foram abertos nesta análise.

## 6. Dashboard (`artifacts/samax-dashboard`)

Roteamento confirmado em `src/App.tsx`:

- `/` → `DashboardPage` (`pages/dashboard.tsx`).
- `/conexoes` → `ConexoesPage`.
- `/unit-economics` → `UnitEconomicsPage`.
- `/relatorios` → `RelatoriosPage`.

Providers globais: `QueryClientProvider` (TanStack), `TooltipProvider`, `TenantProvider`, `UnitEconomicsProvider`, `FiltersProvider`, `WouterRouter` com base em `import.meta.env.BASE_URL`.

Componentes confirmados em `src/components/dashboard/`:
`BudgetForecastCard`, `PastCostsChart`, `SavingsCard`, `SavingsTable`, `Sparkline`, `FilterBar`, `FocusBreakdownCard`, `DimensionListCard`, `EmptyLiveBanner`, `PrintHeader`, `savings-style.ts`.

Componentes confirmados em `src/components/unit-economics/`:
`MetricEditor`, `UnitMetricDetail`, `DataPointTable`, `CsvImportDialog`.

Bibliotecas de apoio em `src/lib/` confirmadas:
`filters-store.tsx`, `tenant-store.tsx`, `unit-economics-store.tsx`, `unit-economics-compute.ts`, `report-pdf-url.ts`, `format.ts`, `export.ts`, `csv-parse.ts`, `utils.ts`.

### Página Relatórios (`pages/relatorios.tsx`)

Confirmado por inspeção do arquivo:

- ~1.4 k linhas, sem subpasta `components/relatorios/` ainda.
- Abas: `reports`, `baselines`, `changes`.
- Fluxo: criar baseline → criar relatório (snapshot congelado) → abrir viewer → exportar PDF.
- Hooks usados (de `@workspace/api-client-react`): `useListOptimizationReports`, `useCreateOptimizationReport`, `useGetOptimizationReport`, `useDeleteOptimizationReport`, `useListBaselines`, `useCreateBaseline`.
- Tipos consumidos: `OptimizationReportSummary`, `OptimizationReport`, `Baseline`.
- Seções de comparação no viewer: `byCategory` (categoria FOCUS), `byProvider`, `byService` (top por variação), `byTeam`, `byProduct`, mais `efficiency` e `appliedChanges`.
- Cada `ComparisonCard` renderiza um gráfico de barras horizontais agrupadas (Atual vs Baseline, top 8 por |delta|) acima da tabela, com `role="img"` + `aria-label`, tooltip mostrando rótulo completo, e legenda com cores fixas dos tokens `--chart-1` / `--chart-2`.

### Unit Economics (`pages/unit-economics.tsx`)

Confirmado por inspeção indireta (task #17 entregue):

- Métricas customizadas com pontos de dado importáveis via CSV.
- Thresholds (target, lowerBound, upperBound) persistidos em localStorage.
- Avaliação de breach exposta via `evaluateThreshold` / `hasThresholds` em `unit-economics-compute.ts`.
- Alertas visuais: ReferenceLine, badge "Fora do alvo", tint de linha, toast deduplicado por métrica|período|status.

## 7. Onboarding (`artifacts/samax-onboarding`)

Roteamento confirmado em `src/App.tsx`:

- `/` → `CustomerPage` (`pages/customer/`).
- `/jornada-samax` → `InternalPage` (`pages/internal/`).
- `/inicio`, `/financeiro`, `/otimizacao`, `/recursos`, `/tags`, `/usuarios`, `/configuracoes` → `PlaceholderPage` (descrições em pt-BR; ainda não implementadas).
- Fallback → `NotFound`.

Providers: `QueryClientProvider`, `TooltipProvider`, `TenantProvider`, `JourneyProvider`, `WouterRouter`, `AppLayout`, `NotificationToaster`.

Diretórios confirmados:
- `pages/`: `customer/`, `internal/`, `onboarding/` (com subpasta `components/`), `placeholder/`, `not-found.tsx`.
- `components/`: `layout/`, `notifications/`, `ui/`.

Conteúdo de `lib/journey-store.tsx`, `lib/constants.ts` e detalhe das páginas: **(não confirmado)** — não abertos nesta análise.

## 8. Convenções confirmadas

- **Contrato-primeiro**: `openapi.yaml` é a fonte; clientes consomem `@workspace/api-client-react`; servidor valida com `@workspace/api-zod`. Regenerar com `pnpm --filter @workspace/api-spec run codegen`.
- **Multi-tenant via `?tenant=...`** na URL do dashboard (visto nos testes e exemplos de uso da página de relatórios). Auth real / sessão / SSO: **(não confirmado)** — nenhum skill de auth (Clerk / Replit Auth) aparece em `replit.md`.
- **Logs**: `pnpm-workspace` skill proíbe `console.log` no servidor (usar `req.log` / `logger`). Aplicação prática caso a caso: **(não confirmado)**.
- **Workflows Replit** rodam cada artifact: `api-server`, `samax-dashboard`, `samax-onboarding`, `mockup-sandbox`.

## 9. Comandos confirmados (em `replit.md`)

| Comando | Finalidade |
|---|---|
| `pnpm run typecheck` | Typecheck completo (todos os pacotes) |
| `pnpm run build` | Typecheck + build de todos os pacotes |
| `pnpm --filter @workspace/api-spec run codegen` | Regerar hooks e schemas a partir do OpenAPI |
| `pnpm --filter @workspace/db run push` | Push do schema de DB (somente dev) |
| `pnpm --filter @workspace/api-server run dev` | Rodar API localmente |

## 10. Itens não confirmados (para revisão futura)

| Item | Por que não confirmado |
|---|---|
| Integração com provedores reais (AWS/Azure/GCP) vs. mock | `focus-mock.ts` existe; código de ingestão não foi aberto |
| Mecanismo de geração de PDF | `report-pdf-url.ts` não foi lido |
| Schema completo das tabelas (`lib/db/src/schema/`) | Arquivos não foram abertos |
| Endpoints completos de baselines / applied-changes / optimization-reports | Apenas vistos via hooks consumidos no front |
| Testes automatizados, CI ou pipeline de deploy | Nenhum arquivo de test/CI encontrado na listagem |
| Auth/autorização e propagação real do tenant no servidor | Nenhuma biblioteca de auth em `replit.md`; tenant só visto via query string |
| Internacionalização | UI em pt-BR, mas i18n configurado não verificado |
| Conteúdo das páginas placeholder do onboarding | `PlaceholderPage` confirmada, mas plano de implementação vs. remoção não está no código |
