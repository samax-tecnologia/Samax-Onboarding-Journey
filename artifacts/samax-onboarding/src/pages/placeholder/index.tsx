import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
      </div>
      
      <div className="flex-1 flex items-center justify-center">
        <Card className="border-dashed shadow-sm w-full max-w-md bg-muted/10">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <Construction className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Em breve</h2>
            <p className="text-muted-foreground">{description}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
