import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Croissant, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav({ to: "/dashboard" });
    });
  }, [nav]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Credenciales inválidas", { description: error.message });
      return;
    }
    if (!remember) {
      // Clear persisted session after this window closes
      window.addEventListener("beforeunload", () => supabase.auth.signOut());
    }
    toast.success("Bienvenido");
    nav({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 rounded-2xl bg-gradient-warm shadow-warm flex items-center justify-center mb-4">
            <Croissant className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">PANIFICADORA ERP</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestión integral para tu panadería</p>
        </div>

        <Card className="shadow-warm">
          <CardHeader>
            <CardTitle>Iniciar sesión</CardTitle>
            <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@panaderia.com" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
                </div>
                <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded border-border" />
                Recordar sesión
              </label>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Ingresar
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              ¿No tienes cuenta?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline">Regístrate</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
