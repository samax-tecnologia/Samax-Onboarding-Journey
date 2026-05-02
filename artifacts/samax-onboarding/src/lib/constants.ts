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
