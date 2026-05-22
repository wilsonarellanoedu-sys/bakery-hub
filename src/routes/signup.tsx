import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Croissant, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
});

function SignupPage() {
  const nav = useNavigate();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error("No se pudo crear la cuenta", { description: error.message });
      return;
    }
    toast.success("Cuenta creada", { description: "Revisa tu correo para confirmar." });
    nav({ to: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-16 rounded-2xl bg-gradient-warm shadow-warm flex items-center justify-center mb-4">
            <Croissant className="size-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">PANIFICADORA ERP</h1>
        </div>

        <Card className="shadow-warm">
          <CardHeader>
            <CardTitle>Crear cuenta</CardTitle>
            <CardDescription>Registra al primer usuario del sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre completo</Label>
                <Input id="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Crear cuenta
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground mt-6">
              ¿Ya tienes cuenta?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">Inicia sesión</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
