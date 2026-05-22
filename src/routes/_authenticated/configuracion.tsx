import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings, Loader2, Save, Building2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";

export const Route = createFileRoute("/_authenticated/configuracion")({ component: ConfiguracionPage });

const schema = z.object({
  nombre_empresa: z.string().min(2, "Requerido").max(100),
  ruc: z.string().max(20).optional().or(z.literal("")),
  direccion: z.string().max(200).optional().or(z.literal("")),
  telefono: z.string().max(30).optional().or(z.literal("")),
  correo: z.string().email("Correo inválido").or(z.literal("")).optional(),
  moneda: z.string().min(1).max(5),
  igv_porcentaje: z.coerce.number().min(0).max(100),
  logo_url: z.string().url("URL inválida").or(z.literal("")).optional(),
});
type FormVals = z.infer<typeof schema>;

function ConfiguracionPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const configQ = useQuery({
    queryKey: ["configuracion"],
    queryFn: async () => {
      const { data, error } = await supabase.from("configuracion").select("*").eq("id", 1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      nombre_empresa: "PANIFICADORA ERP",
      ruc: "", direccion: "", telefono: "", correo: "",
      moneda: "S/", igv_porcentaje: 18, logo_url: "",
    },
  });

  useEffect(() => {
    if (configQ.data) {
      form.reset({
        nombre_empresa: configQ.data.nombre_empresa ?? "",
        ruc: configQ.data.ruc ?? "",
        direccion: configQ.data.direccion ?? "",
        telefono: configQ.data.telefono ?? "",
        correo: configQ.data.correo ?? "",
        moneda: configQ.data.moneda ?? "S/",
        igv_porcentaje: Number(configQ.data.igv_porcentaje ?? 18),
        logo_url: configQ.data.logo_url ?? "",
      });
    }
  }, [configQ.data, form]);

  const mut = useMutation({
    mutationFn: async (v: FormVals) => {
      const payload = {
        id: 1,
        nombre_empresa: v.nombre_empresa,
        ruc: v.ruc || null,
        direccion: v.direccion || null,
        telefono: v.telefono || null,
        correo: v.correo || null,
        moneda: v.moneda,
        igv_porcentaje: v.igv_porcentaje,
        logo_url: v.logo_url || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("configuracion").upsert(payload, { onConflict: "id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configuración guardada"); qc.invalidateQueries({ queryKey: ["configuracion"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Configuración" description="Datos de la empresa" icon={Settings} />
        <Card className="p-12 text-center text-muted-foreground">Solo administradores pueden modificar la configuración.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" description="Datos de tu empresa y preferencias generales." icon={Settings} />

      {configQ.isLoading ? (
        <Card className="p-6"><Skeleton className="h-96" /></Card>
      ) : (
        <Card className="p-6 max-w-3xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="size-4" /> Datos de la empresa</h3>
                <FormField control={form.control} name="nombre_empresa" render={({ field }) => (
                  <FormItem><FormLabel>Nombre comercial</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="ruc" render={({ field }) => (
                    <FormItem><FormLabel>RUC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="telefono" render={({ field }) => (
                    <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="direccion" render={({ field }) => (
                  <FormItem><FormLabel>Dirección</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="correo" render={({ field }) => (
                  <FormItem><FormLabel>Correo de contacto</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="logo_url" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Logo (URL)</FormLabel>
                    <FormControl><Input placeholder="https://..." {...field} /></FormControl>
                    <FormDescription>URL pública de la imagen del logo.</FormDescription>
                    <FormMessage />
                    {field.value && (
                      <img src={field.value} alt="Logo" className="mt-2 h-16 w-auto rounded border border-border bg-white p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    )}
                  </FormItem>
                )} />
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold">Facturación</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="moneda" render={({ field }) => (
                    <FormItem><FormLabel>Símbolo de moneda</FormLabel><FormControl><Input {...field} /></FormControl><FormDescription>Ej: S/, $, €</FormDescription><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="igv_porcentaje" render={({ field }) => (
                    <FormItem><FormLabel>IGV (%)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormDescription>Por defecto 18% en Perú.</FormDescription><FormMessage /></FormItem>
                  )} />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={mut.isPending}>
                  {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  Guardar cambios
                </Button>
              </div>
            </form>
          </Form>
        </Card>
      )}
    </div>
  );
}
