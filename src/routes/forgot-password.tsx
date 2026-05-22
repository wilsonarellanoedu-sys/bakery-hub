import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("Error", { description: error.message });
      return;
    }
    toast.success("Revisa tu correo", { description: "Te enviamos un enlace para restablecer tu contraseña." });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-soft px-4 py-12">
      <Card className="w-full max-w-md shadow-warm">
        <CardHeader>
          <CardTitle>Recuperar contraseña</CardTitle>
          <CardDescription>Ingresa tu correo para recibir el enlace de recuperación.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Enviar enlace
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-6">
            <Link to="/login" className="text-primary hover:underline">Volver a iniciar sesión</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
