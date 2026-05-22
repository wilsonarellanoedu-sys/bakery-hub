import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  hint?: string;
  trend?: string;
  variant?: "default" | "warm" | "success" | "warning" | "destructive";
  loading?: boolean;
}

const variantStyles: Record<NonNullable<KpiCardProps["variant"]>, string> = {
  default: "bg-card",
  warm: "bg-gradient-warm text-primary-foreground border-transparent",
  success: "bg-success/10 border-success/30",
  warning: "bg-warning/15 border-warning/40",
  destructive: "bg-destructive/10 border-destructive/30",
};

export function KpiCard({ title, value, icon: Icon, hint, trend, variant = "default", loading }: KpiCardProps) {
  return (
    <Card className={cn("p-5 shadow-card transition-all hover:shadow-warm hover:-translate-y-0.5", variantStyles[variant])}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className={cn("text-xs font-medium uppercase tracking-wide", variant === "warm" ? "text-primary-foreground/80" : "text-muted-foreground")}>
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight">
            {loading ? <span className="inline-block h-8 w-20 animate-pulse rounded bg-muted-foreground/20" /> : value}
          </p>
          {hint && <p className={cn("text-xs", variant === "warm" ? "text-primary-foreground/70" : "text-muted-foreground")}>{hint}</p>}
        </div>
        <div className={cn("rounded-xl p-2.5", variant === "warm" ? "bg-white/20" : "bg-primary/10")}>
          <Icon className={cn("size-5", variant === "warm" ? "text-primary-foreground" : "text-primary")} />
        </div>
      </div>
      {trend && (
        <p className={cn("mt-3 text-xs font-medium", variant === "warm" ? "text-primary-foreground/90" : "text-success")}>
          {trend}
        </p>
      )}
    </Card>
  );
}
