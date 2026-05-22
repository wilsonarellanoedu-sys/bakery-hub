import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Props {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
  features: string[];
}

export function ModulePlaceholder({ title, description, icon: Icon, phase, features }: Props) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-gradient-warm shadow-warm flex items-center justify-center">
            <Icon className="size-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="secondary">{phase}</Badge>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Módulo en construcción</CardTitle>
          <CardDescription>
            La base de datos, los permisos y la navegación ya están listos. La interfaz completa de
            este módulo se construirá en la siguiente fase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm font-medium mb-3 text-foreground">Funcionalidades planeadas:</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
