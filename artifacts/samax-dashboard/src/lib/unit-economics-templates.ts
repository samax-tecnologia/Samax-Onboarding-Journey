export type TemplateId = "cost-per-employee" | "cost-per-tech-fte" | "tech-cost-pct-revenue";

export type UnitMetricTemplate = {
  id: TemplateId;
  name: string;
  description: string;
  category: "resource_efficiency" | "business";
  unitLabel: string;
  format: "currency" | "percent";
  sampleValueColumn: string;
};

export const TEMPLATES: UnitMetricTemplate[] = [
  {
    id: "cost-per-employee",
    name: "Custo por colaborador",
    description: "Gasto total de tecnologia dividido pelo número de colaboradores no período.",
    category: "business",
    unitLabel: "colaborador",
    format: "currency",
    sampleValueColumn: "headcount",
  },
  {
    id: "cost-per-tech-fte",
    name: "Custo por FTE de tecnologia",
    description:
      "Gasto total dividido pelo número de FTEs de tecnologia (engenharia, SRE, dados, etc.).",
    category: "business",
    unitLabel: "FTE de tecnologia",
    format: "currency",
    sampleValueColumn: "tech_fte",
  },
  {
    id: "tech-cost-pct-revenue",
    name: "Custo de tecnologia como % da receita",
    description: "Gasto total de tecnologia dividido pela receita do período, exibido em %.",
    category: "business",
    unitLabel: "receita",
    format: "percent",
    sampleValueColumn: "revenue",
  },
];
