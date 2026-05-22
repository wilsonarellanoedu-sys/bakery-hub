import { createFileRoute, Outlet, redirect, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Bell, Moon, Sun, Search, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAccessRoute } from "@/lib/access";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;

    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, user, roles } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const allowed = canAccessRoute(pathname, roles);
  const nav = useNavigate();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/login" });
  }, [loading, user, nav]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border bg-card/50 backdrop-blur px-3 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1 max-w-md relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 h-9 bg-background" />
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Cambiar tema">
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
              <Button variant="ghost" size="icon" aria-label="Notificaciones">
                <Bell className="size-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {allowed ? (
              <Outlet />
            ) : (
              <div className="max-w-md mx-auto mt-16 text-center space-y-4">
                <div className="size-14 rounded-full bg-destructive/10 mx-auto flex items-center justify-center">
                  <ShieldAlert className="size-7 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold">Sin acceso</h2>
                <p className="text-sm text-muted-foreground">
                  Tu rol no tiene permiso para ver este módulo. Contacta al administrador si crees que es un error.
                </p>
                <Button asChild><Link to="/dashboard">Ir al dashboard</Link></Button>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
