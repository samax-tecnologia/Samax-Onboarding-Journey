export type SavingCategory =
  | "idle"
  | "rightsizing"
  | "commitment"
  | "untagged"
  | "storage-tier"
  | string;

export function categoryStyle(category: SavingCategory): { label: string; badge: string } {
  switch (category) {
    case "idle":
      return {
        label: "Recurso ocioso",
        badge: "border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-500/5",
      };
    case "rightsizing":
      return {
        label: "Rightsizing",
        badge: "border-sky-500/30 text-sky-700 dark:text-sky-400 bg-sky-500/5",
      };
    case "commitment":
      return {
        label: "Commitment",
        badge: "border-violet-500/30 text-violet-700 dark:text-violet-400 bg-violet-500/5",
      };
    case "untagged":
      return {
        label: "Untagged",
        badge: "border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-500/5",
      };
    case "storage-tier":
      return {
        label: "Storage tier",
        badge: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5",
      };
    default:
      return { label: category, badge: "border-muted-foreground/30 text-muted-foreground" };
  }
}

export function effortLabel(effort: "low" | "medium" | "high"): string {
  switch (effort) {
    case "low":
      return "Baixo esforço";
    case "medium":
      return "Médio esforço";
    case "high":
      return "Alto esforço";
  }
}
