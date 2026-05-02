import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface HeroStripProps {
  totalTasks: number;
  completedTasks: number;
}

export function HeroStrip({ totalTasks, completedTasks }: HeroStripProps) {
  const [contractValue, setContractValue] = useState<number>(60000);
  const [spendValue, setSpendValue] = useState<number>(1500000);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(val);
  };

  const spendTarget = spendValue * 0.1;
  const contractTarget = contractValue * 2;
  const finalTarget = Math.min(spendTarget, contractTarget);

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <Card className="mb-8 border-border shadow-sm">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="flex-1 space-y-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Sua meta de 1º valor</h2>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                A Samax considera o 1st Time Value atingido quando o cliente comprova economia anualizada equivalente a no mínimo 10% do baseline de cloud OU 2x o contrato anual.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Progresso da jornada</span>
                <span className="text-primary">{progressPercent}% concluído</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </div>

          <div className="lg:w-80 bg-muted/50 rounded-lg p-4 border flex flex-col justify-center space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="contract" className="text-xs text-muted-foreground">Contrato Anual</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">R$</span>
                  <Input 
                    id="contract" 
                    type="number" 
                    className="h-8 text-sm pl-8" 
                    value={contractValue} 
                    onChange={(e) => setContractValue(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spend" className="text-xs text-muted-foreground">Spend Anual</Label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs text-muted-foreground">R$</span>
                  <Input 
                    id="spend" 
                    type="number" 
                    className="h-8 text-sm pl-8" 
                    value={spendValue} 
                    onChange={(e) => setSpendValue(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Meta mínima</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(finalTarget)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
