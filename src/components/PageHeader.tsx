import type { LucideIcon } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, actions }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-xl bg-gradient-warm shadow-warm flex items-center justify-center">
          <Icon className="size-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
