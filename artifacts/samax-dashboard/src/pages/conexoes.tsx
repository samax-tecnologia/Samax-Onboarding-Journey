import { useState } from "react";
import {
  useListConnections,
  useCreateConnection,
  useDeleteConnection,
  useSyncConnection,
  type Connection,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/lib/tenant-store";
import {
  Plug,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";

type ProviderId = "sample" | "aws" | "azure" | "gcp";

const PROVIDER_INFO: Record<
  ProviderId,
  { label: string; description: string; setupUrl: string; setupHelp: string }
> = {
  sample: {
    label: "Dados de exemplo",
    description: "Carrega o dataset FOCUS de demonstração — útil para validar a esteira ponta a ponta.",
    setupUrl: "",
    setupHelp: "Sem credenciais. Pode ser sincronizado imediatamente.",
  },
  aws: {
    label: "AWS (CUR 2.0)",
    description: "Importa o Cost & Usage Report 2.0 entregue em S3 via Athena/Parquet.",
    setupUrl: "https://docs.aws.amazon.com/cur/latest/userguide/dataexports-create-cur.html",
    setupHelp:
      "Crie um Data Export FOCUS 1.0 em S3 e provisione a role IAM com o template CloudFormation.",
  },
  azure: {
    label: "Azure Cost Management",
    description: "Lê o export FOCUS do Cost Management para uma Storage Account.",
    setupUrl: "https://learn.microsoft.com/azure/cost-management-billing/costs/tutorial-improved-exports",
    setupHelp:
      "Configure um export FOCUS recorrente, registre um App + Storage Blob Data Reader e cole as credenciais como Replit Secret.",
  },
  gcp: {
    label: "GCP Cloud Billing",
    description: "Consulta a view FOCUS do export detalhado de billing no BigQuery.",
    setupUrl: "https://cloud.google.com/billing/docs/how-to/export-data-bigquery-setup",
    setupHelp:
      "Habilite o export para BigQuery, conceda BigQuery Data Viewer a uma service account e armazene o JSON como Replit Secret.",
  },
};

function StatusBadge({ status }: { status: string }) {
  if (status === "ok")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100" variant="outline">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Conectado
      </Badge>
    );
  if (status === "syncing")
    return (
      <Badge variant="outline">
        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Sincronizando
      </Badge>
    );
  if (status === "error")
    return (
      <Badge variant="destructive">
        <AlertCircle className="w-3 h-3 mr-1" /> Erro
      </Badge>
    );
  return (
    <Badge variant="secondary">
      <AlertCircle className="w-3 h-3 mr-1" /> Pendente
    </Badge>
  );
}

function ConnectionRow({ c, tenantId }: { c: Connection; tenantId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const sync = useSyncConnection();
  const remove = useDeleteConnection();
  const info = PROVIDER_INFO[c.provider as ProviderId] ?? PROVIDER_INFO.sample;

  const onSync = async () => {
    try {
      const res = await sync.mutateAsync({ id: c.id });
      if (res.status === "ok") {
        toast({
          title: "Sincronização concluída",
          description: `${res.rowsUpserted.toLocaleString("pt-BR")} linhas atualizadas em ${res.partitionsRead} partições.`,
        });
      } else {
        toast({ title: "Falha na sincronização", description: res.error ?? "Erro desconhecido", variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Falha na sincronização", description: String(err), variant: "destructive" });
    }
    qc.invalidateQueries();
  };

  const onDelete = async () => {
    if (!window.confirm(`Remover a conexão "${c.displayName}"?`)) return;
    await remove.mutateAsync({ id: c.id });
    qc.invalidateQueries();
    toast({ title: "Conexão removida" });
  };

  return (
    <Card key={c.id}>
      <CardContent className="flex flex-col md:flex-row gap-4 md:items-center justify-between p-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{c.displayName}</span>
            <Badge variant="outline" className="text-[11px]">{info.label}</Badge>
            <StatusBadge status={c.status} />
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            Última sincronização: {c.lastSyncedAt ? new Date(c.lastSyncedAt).toLocaleString("pt-BR") : "—"}
            {" · "}Intervalo: {c.refreshIntervalHours}h
          </div>
          {c.lastError && (
            <div className="text-xs text-destructive mt-2">⚠ {c.lastError}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onSync} disabled={sync.isPending} data-testid={`sync-${c.id}`}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${sync.isPending ? "animate-spin" : ""}`} />
            Sincronizar agora
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} title="Remover conexão">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddConnectionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [provider, setProvider] = useState<ProviderId>("sample");
  const [displayName, setDisplayName] = useState("");
  const [secretRef, setSecretRef] = useState("");
  const [refreshIntervalHours, setRefreshIntervalHours] = useState<"24" | "4">("24");
  const create = useCreateConnection();
  const qc = useQueryClient();
  const { toast } = useToast();
  const info = PROVIDER_INFO[provider];

  const onSubmit = async () => {
    if (!displayName.trim()) {
      toast({ title: "Informe um nome para a conexão", variant: "destructive" });
      return;
    }
    try {
      await create.mutateAsync({
        data: {
          provider,
          displayName: displayName.trim(),
          ...(secretRef ? { secretRef } : {}),
          refreshIntervalHours,
        },
      });
      qc.invalidateQueries();
      toast({ title: "Conexão criada" });
      onOpenChange(false);
      setDisplayName("");
      setSecretRef("");
      setProvider("sample");
      setRefreshIntervalHours("24");
    } catch (err) {
      toast({ title: "Falha ao criar", description: String(err), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar conexão</DialogTitle>
          <DialogDescription>Importa custos FOCUS do provedor para esta organização.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(PROVIDER_INFO) as ProviderId[]).map((p) => (
                  <SelectItem key={p} value={p}>{PROVIDER_INFO[p].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{info.description}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Nome de exibição</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={provider === "sample" ? "Round-trip de exemplo" : "Conta produção"}
              data-testid="conn-display-name"
            />
          </div>

          {provider !== "sample" && (
            <div className="space-y-1.5">
              <Label>Replit Secret (opcional)</Label>
              <Input
                value={secretRef}
                onChange={(e) => setSecretRef(e.target.value)}
                placeholder="ex: ACME_AWS_ROLE"
              />
              <p className="text-xs text-muted-foreground">
                Nome do segredo que guarda as credenciais. Adicione o valor pelo painel de Secrets do Replit.
              </p>
            </div>
          )}

          {provider === "azure" && (
            <div className="space-y-1.5">
              <Label>Frequência de atualização</Label>
              <Select value={refreshIntervalHours} onValueChange={(v) => setRefreshIntervalHours(v as "24" | "4")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="24">24 horas (padrão)</SelectItem>
                  <SelectItem value="4">4 horas (somente Azure)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
            <div className="font-medium">Como configurar</div>
            <p className="text-muted-foreground text-xs">{info.setupHelp}</p>
            {info.setupUrl && (
              <a
                href={info.setupUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="w-3 h-3" /> Ver documentação oficial
              </a>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={create.isPending} data-testid="conn-create">
            {create.isPending ? "Criando…" : "Criar conexão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ConexoesPage() {
  const { tenantId } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useListConnections();
  const connections = data?.connections ?? [];

  return (
    <div className="px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Conexões de dados</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte AWS, Azure e GCP para alimentar o painel com seus dados FOCUS reais.
            Tenant atual: <span className="font-medium text-foreground">{tenantId}</span>{" "}
            ({data?.dataSource === "live" ? "modo live" : "modo demo"}).
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="add-connection">
          <Plug className="w-4 h-4 mr-1.5" /> Adicionar conexão
        </Button>
      </div>

      {isLoading ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">Carregando…</CardContent></Card>
      ) : connections.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma conexão ainda</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Crie uma conexão de exemplo para popular o painel com dados FOCUS de demonstração e validar a esteira ponta a ponta.
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plug className="w-4 h-4 mr-1.5" /> Criar primeira conexão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {connections.map((c) => <ConnectionRow key={c.id} c={c} tenantId={tenantId} />)}
        </div>
      )}

      <AddConnectionDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
