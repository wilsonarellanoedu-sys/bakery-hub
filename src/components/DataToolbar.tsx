import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  search: string;
  onSearch: (v: string) => void;
  placeholder?: string;
  onNew?: () => void;
  newLabel?: string;
  children?: React.ReactNode;
}

export function DataToolbar({ search, onSearch, placeholder = "Buscar...", onNew, newLabel = "Nuevo", children }: Props) {
  return (
    <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
      <div className="relative flex-1 max-w-sm">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="pl-9" />
      </div>
      <div className="flex items-center gap-2">
        {children}
        {onNew && (
          <Button onClick={onNew} className="gap-1">
            <Plus className="size-4" /> {newLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
