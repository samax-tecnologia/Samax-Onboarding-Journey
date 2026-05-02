export const CUSTOMER_PROFILE = { 
  name: "Luana", 
  company: "Acme Cloud", 
  contractAnnual: 60000, 
  spendAnnual: 1500000, 
  kickoffDate: "2026-04-15", 
  consultant: { name: "Rafael Mendes", role: "Senior FinOps Consultant", photoInitials: "RM", nextMeeting: "2026-05-08T15:00" }, 
  environment: { connectedSince: "2026-04-29", resourcesMonitored: 1847, monthlySpend: 94320, providers: ["AWS"] } 
};

export const CUSTOMER_STAGES = [
  { 
    id: "conectar", 
    number: 1, 
    title: "Conectar", 
    summary: "Você nos dá acesso e validamos a leitura do seu ambiente", 
    ownership: "voce", 
    mapsToPhases: ["3", "4"], 
    customerSteps: [
      { id: "step-1-1", label: "Realizar reunião de kickoff técnico", ownership: "ambos", linkedTaskIds: ["3.1"] },
      { id: "step-1-2", label: "Fornecer acessos de leitura ao billing e inventário", ownership: "voce", linkedTaskIds: ["3.3", "4.1", "4.4"] },
      { id: "step-1-3", label: "Validar lista de contas/projetos no escopo", ownership: "ambos", linkedTaskIds: ["3.2", "4.2"] },
      { id: "step-1-4", label: "Acordar governança de reuniões e baseline temporal", ownership: "ambos", linkedTaskIds: ["3.4", "3.5"] }
    ] 
  },
  { 
    id: "descobrir", 
    number: 2, 
    title: "Descobrir", 
    summary: "Samax lê seu ambiente e identifica onde está o dinheiro", 
    ownership: "samax", 
    mapsToPhases: ["5", "6"], 
    customerSteps: [
      { id: "step-2-1", label: "Ingerir e processar dados históricos", ownership: "samax", linkedTaskIds: ["4.3"] },
      { id: "step-2-2", label: "Analisar top drivers de custo e baseline", ownership: "samax", linkedTaskIds: ["5.1", "5.2", "5.3"] },
      { id: "step-2-3", label: "Validar baseline e distribuição de gastos", ownership: "voce", linkedTaskIds: ["5.4"] },
      { id: "step-2-4", label: "Mapear backlog de oportunidades de quick win", ownership: "samax", linkedTaskIds: ["6.1", "6.2", "6.3", "6.4", "6.5", "6.6"] }
    ] 
  },
  { 
    id: "decidir", 
    number: 3, 
    title: "Decidir", 
    summary: "Você revisa e aprova as ações que vão gerar economia", 
    ownership: "voce", 
    mapsToPhases: ["7"], 
    customerSteps: [
      { id: "step-3-1", label: "Estimar impacto financeiro das oportunidades", ownership: "samax", linkedTaskIds: ["7.1", "7.2"] },
      { id: "step-3-2", label: "Definir equipe responsável por cada ação", ownership: "ambos", linkedTaskIds: ["7.3"] },
      { id: "step-3-3", label: "Agendar janelas de execução seguras", ownership: "ambos", linkedTaskIds: ["7.4"] },
      { id: "step-3-4", label: "Aprovar formalmente as recomendações", ownership: "voce", linkedTaskIds: ["7.5"] }
    ] 
  },
  { 
    id: "capturar", 
    number: 4, 
    title: "Capturar valor", 
    summary: "Executamos juntos e comprovamos o valor anualizado", 
    ownership: "ambos", 
    mapsToPhases: ["8", "9"], 
    customerSteps: [
      { id: "step-4-1", label: "Executar as ações aprovadas", ownership: "ambos", linkedTaskIds: ["8.1"] },
      { id: "step-4-2", label: "Medir e registrar economia realizada na fatura", ownership: "samax", linkedTaskIds: ["8.2", "8.3", "8.4", "8.5"] },
      { id: "step-4-3", label: "Comprovar alcance da meta mínima de valor", ownership: "samax", linkedTaskIds: ["8.6"] },
      { id: "step-4-4", label: "Definir rotina FinOps e próximos passos", ownership: "ambos", linkedTaskIds: ["9.1", "9.2", "9.3", "9.4", "9.5"] }
    ] 
  }
];

export const OPPORTUNITIES = [
  { id: "opp-1", title: "Desligar ambiente dev fora do horário", category: "Ambientes não produtivos", monthly: 6000, annual: 72000, risk: "Baixo", action: "Aplicar schedule 20h-7h e fins de semana" },
  { id: "opp-2", title: "Reduzir retenção de logs de 365 para 90 dias", category: "Logs", monthly: 4000, annual: 48000, risk: "Baixo", action: "Validar compliance e alterar retenção" },
  { id: "opp-3", title: "Remover 12 volumes EBS órfãos", category: "Recursos ociosos", monthly: 2500, annual: 30000, risk: "Baixo", action: "Snapshot final e remoção" },
  { id: "opp-4", title: "Lifecycle em bucket de dados antigos", category: "Storage", monthly: 3000, annual: 36000, risk: "Médio", action: "Mover objetos antigos para classe mais barata" }
];

export const PRE_CONTRACT_MILESTONES = [
  { id: "diagnostico", label: "Diagnóstico realizado", date: "2026-03-10", icon: "search" },
  { id: "contrato", label: "Contrato assinado", date: "2026-04-01", icon: "file-check" },
  { id: "meta", label: "Meta de valor definida", date: "2026-04-15", icon: "target" }
];

export const PHASES = [
  {
    id: "1.1",
    title: "Pré-contrato: Educação e percepção de oportunidade",
    objective: "Fazer o cliente perceber que há valor escondido na cloud",
    outcome: "Hipótese inicial de valor",
    tasks: [
      { id: "1.1.1", title: "Identificar crenças implícitas do cliente sobre cloud (\"é caro mesmo\", \"infra sabe o que faz\", \"fatura cresce com o negócio\")" },
      { id: "1.1.2", title: "Apresentar exemplos de desperdícios não-óbvios mas rastreáveis" },
      { id: "1.1.3", title: "Mostrar como organização do ambiente influencia diretamente o custo" },
      { id: "1.1.4", title: "Posicionar cloud como alavanca financeira, não só técnica" },
      { id: "1.1.5", title: "Levantar hipótese inicial de valor escondido" },
    ],
    milestone: null
  },
  {
    id: "1.2",
    title: "Diagnóstico comercial",
    objective: "Qualificar potencial econômico e urgência",
    outcome: "Business case preliminar",
    tasks: [
      { id: "1.2.1", title: "Cloud é dor percebida ou apenas oportunidade de melhoria?" },
      { id: "1.2.2", title: "Cliente já tentou reduzir custos? O que funcionou e o que não funcionou?" },
      { id: "1.2.3", title: "Existe budget para setup fee, mensalidade e/ou success fee?" },
      { id: "1.2.4", title: "Quem decide a contratação e quem valida tecnicamente?" },
      { id: "1.2.5", title: "Quais oportunidades iniciais parecem mais prováveis de gerar economia relevante?" },
    ],
    milestone: 1
  },
  {
    id: "2",
    title: "Contratação e alinhamento executivo",
    objective: "Formalizar escopo, meta e responsabilidades",
    outcome: "Contrato + meta de valor",
    tasks: [
      { id: "2.1", title: "Formalizar escopo do trabalho" },
      { id: "2.2", title: "Definir meta de valor (min entre 10% spend anual e 2x contrato anual)" },
      { id: "2.3", title: "Mapear responsabilidades (sponsor, decisor, validador técnico)" },
      { id: "2.4", title: "Alinhar critérios de prova de valor (economia realizada, aprovada, evitada, governança)" },
    ],
    milestone: null
  },
  {
    id: "3",
    title: "Kickoff e preparação",
    objective: "Organizar acessos, baseline e governança",
    outcome: "Plano de onboarding",
    tasks: [
      { id: "3.1", title: "Reunião de kickoff com sponsor e time técnico" },
      { id: "3.2", title: "Mapear contas/projetos/subscriptions no escopo" },
      { id: "3.3", title: "Solicitar permissões e roles necessárias" },
      { id: "3.4", title: "Definir baseline temporal (30/60/90 dias)" },
      { id: "3.5", title: "Acordar governança e cadência de reuniões" },
    ],
    milestone: null
  },
  {
    id: "4",
    title: "Conexão e ingestão de dados",
    objective: "Trazer billing, inventário e tags para a plataforma",
    outcome: "Dados confiáveis na Samax",
    tasks: [
      { id: "4.1", title: "Validar acesso ao billing, inventário, tags e recomendações nativas" },
      { id: "4.2", title: "Listar contas, projetos, subscriptions ou linked accounts no escopo" },
      { id: "4.3", title: "Puxar custo dos últimos 30, 60 e 90 dias" },
      { id: "4.4", title: "Confirmar billing export habilitado e role/service account configurada" },
    ],
    milestone: 2
  },
  {
    id: "5",
    title: "Definição do baseline e top drivers",
    objective: "Entender para onde o dinheiro está indo",
    outcome: "Baseline validado",
    tasks: [
      { id: "5.1", title: "Ordenar gastos por provedor, conta, serviço, SKU e região" },
      { id: "5.2", title: "Identificar se 80% do custo está concentrado em poucos serviços" },
      { id: "5.3", title: "Verificar se há dados suficientes por recurso ou só por serviço/SKU" },
      { id: "5.4", title: "Validar baseline com cliente (financeiro + técnico)" },
    ],
    milestone: null
  },
  {
    id: "6",
    title: "Identificação de oportunidades",
    objective: "Gerar backlog priorizando por impacto e risco",
    outcome: "Lista de quick wins e oportunidades",
    tasks: [
      { id: "6.1", title: "Top 5 serviços por custo (compute, banco, storage, logs, analytics, rede)" },
      { id: "6.2", title: "Recursos claramente ociosos (volumes desanexados, snapshots antigos, IPs sem uso, load balancers sem tráfego, discos sem I/O, instâncias paradas)" },
      { id: "6.3", title: "Ambientes não produtivos rodando 24/7 (dev/homolog, scheduling, autoscaling)" },
      { id: "6.4", title: "Logs e retenção (grupos de alto custo, retenção excessiva, ingestão anormal)" },
      { id: "6.5", title: "Storage e lifecycle (buckets sem lifecycle, objetos antigos em Standard, snapshots antigos)" },
      { id: "6.6", title: "Compromissos financeiros (Savings Plans, RIs, CUDs, Reservations)" },
    ],
    milestone: 3
  },
  {
    id: "7",
    title: "Plano de execução",
    objective: "Transformar recomendação em decisão",
    outcome: "Ações aprovadas com equipe responsável",
    tasks: [
      { id: "7.1", title: "Estimar economia mensal e anualizada de cada oportunidade" },
      { id: "7.2", title: "Classificar por risco (baixo/médio/alto) e complexidade" },
      { id: "7.3", title: "Definir responsável por cada ação" },
      { id: "7.4", title: "Agendar janela de execução" },
      { id: "7.5", title: "Obter aprovação formal do sponsor" },
    ],
    milestone: null
  },
  {
    id: "8",
    title: "Captura e comprovação de valor (1st Time Value)",
    objective: "Medir economia ou valor anualizado",
    outcome: "1st Time Value comprovado",
    tasks: [
      { id: "8.1", title: "Executar ações aprovadas" },
      { id: "8.2", title: "Medir economia realizada na fatura" },
      { id: "8.3", title: "Registrar economia aprovada (data de implementação + cálculo validado)" },
      { id: "8.4", title: "Registrar valor evitado (anomalias corrigidas)" },
      { id: "8.5", title: "Registrar valor de governança com proxy financeiro (tagging, showback, FinOps Score)" },
      { id: "8.6", title: "Comparar resultado com a meta mínima" },
    ],
    milestone: 5
  },
  {
    id: "9",
    title: "Expansão e operação contínua",
    objective: "Transformar quick win em rotina FinOps",
    outcome: "Roadmap contínuo de otimização",
    tasks: [
      { id: "9.1", title: "Definir cadência de revisão (semanal/quinzenal/mensal)" },
      { id: "9.2", title: "Construir roadmap de novas oportunidades" },
      { id: "9.3", title: "Implementar alertas de anomalia e budgets" },
      { id: "9.4", title: "Estabelecer cultura FinOps (showback, chargeback)" },
      { id: "9.5", title: "Renovar meta de valor para o próximo ciclo" },
    ],
    milestone: null
  }
];

export const MILESTONES = [
  { id: 1, title: "Primeiro insight", description: "Cliente percebe que há desperdício" },
  { id: 2, title: "Onboarding concluído", description: "Samax já lê custo, inventário, tags" },
  { id: 3, title: "Backlog inicial pronto", description: "Sabemos o que fazer e em que ordem" },
  { id: 4, title: "Primeira economia", description: "Pelo menos uma ação começou a gerar saving" },
  { id: 5, title: "1st Time Value", description: "Saving anualizado atingiu o patamar material" },
];
