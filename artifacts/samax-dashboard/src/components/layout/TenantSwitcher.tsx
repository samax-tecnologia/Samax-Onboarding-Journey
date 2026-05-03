import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/lib/tenant-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TenantSwitcher() {
  const { tenantId, setTenantId, options } = useTenant();
  const qc = useQueryClient();
  return (
    <Select
      value={tenantId}
      onValueChange={(v) => {
        setTenantId(v);
        // All cached responses are tenant-specific — invalidate everything.
        qc.invalidateQueries();
      }}
    >
      <SelectTrigger className="h-9 w-[180px]" data-testid="tenant-switcher">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
