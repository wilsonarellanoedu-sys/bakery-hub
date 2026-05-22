import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChefHat, Plus, Play, CheckCircle2, X, Loader2, Calendar, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/produccion")({ component: ProduccionPage });

type Estado = "pendiente" | "en_proceso" | "completado" | "cancelado";

const ESTADOS: { value: Estado; label: string; variant: "default" | "secondary" | "destructive" | "outline"; className?: string }[] = [
  { value: "pendiente", label: "Pendiente", variant: "secondary" },
  { value: "en_proceso", label: "En proceso", variant: "outline" },
  { value: "completado", label: "Completado", variant: "default", className: "bg-emerald-600 hover:bg-emerald-700" },
  { value: "cancelado", label: "Cancelado", variant: "destructive" },
];

const schema = z.object({
  producto_id: z.string().uuid("Selecciona un producto"),
  cantidad_programada: z.coerce.number().positive("Mayor a 0"),
  fecha_programada: z.string().min(1, "Requerido"),
  observaciones: z.string().max(500).optional().or(z.literal("")),
});
type FormVals = z.infer<typeof schema>;

function ProduccionPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [openForm, setOpenForm] = useState(false);
  const [completar, setCompletar] = useState<{ id: string; programada: number; productoNombre: string } | null>(null);
  const [cantidadReal, setCantidadReal] = useState<string>("");
  const [confirmCancel, setConfirmCancel] = useState<string | null>(null);

  const produccionQ = useQuery({
    queryKey: ["produccion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produccion")
        .select("id, producto_id, cantidad_programada, cantidad_producida, fecha_programada, estado, observaciones, created_at")
        .order("fecha_programada", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const productosQ = useQuery({
    queryKey: ["productos-lookup-prod"],
    queryFn: async () => (await supabase.from("productos").select("id, nombre, codigo, stock").eq("estado", true).order("nombre")).data ?? [],
  });
  const productosMap = useMemo(
    () => Object.fromEntries((productosQ.data ?? []).map((p) => [p.id, p])),
    [productosQ.data],
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (produccionQ.data ?? []).filter((p) => {
      const nombre = productosMap[p.producto_id]?.nombre?.toLowerCase() ?? "";
      const ms = !q || nombre.includes(q);
      const me = filterEstado === "all" || p.estado === filterEstado;
      return ms && me;
    });
  }, [produccionQ.data, search, filterEstado, productosMap]);

  const grupos = useMemo(() => {
    return {
      pendiente: filtered.filter((p) => p.estado === "pendiente"),
      en_proceso: filtered.filter((p) => p.estado === "en_proceso"),
      completado: filtered.filter((p) => p.estado === "completado"),
      cancelado: filtered.filter((p) => p.estado === "cancelado"),
    };
  }, [filtered]);

  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Estado }) => {
      const { error } = await supabase.from("produccion").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["produccion"] });
      setConfirmCancel(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completarMut = useMutation({
    mutationFn: async ({ id, cantidad }: { id: string; cantidad: number }) => {
      const { data, error } = await supabase.rpc("completar_produccion", {
        _produccion_id: id,
        _cantidad_real: cantidad,
        _user_id: user?.id ?? "",
      });
      if (error) throw error;
      return data as { ok: boolean; stock_anterior: number; stock_nuevo: number };
    },
    onSuccess: (r) => {
      toast.success(`Producción completada. Stock: ${r.stock_anterior} → ${r.stock_nuevo}`);
      qc.invalidateQueries({ queryKey: ["produccion"] });
      qc.invalidateQueries({ queryKey: ["pos-productos"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      qc.invalidateQueries({ queryKey: ["productos-lookup-prod"] });
      setCompletar(null);
      setCantidadReal("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCompletar(p: { id: string; cantidad_programada: number; producto_id: string }) {
    setCompletar({
      id: p.id,
      programada: Number(p.cantidad_programada),
      productoNombre: productosMap[p.producto_id]?.nombre ?? "—",
    });
    setCantidadReal(String(p.cantidad_programada));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Producción"
        description="Tandas de panadería. Al completar una tanda, el stock se incrementa automáticamente y se registra en el Kardex."
        icon={ChefHat}
      />

      <Card className="p-4 space-y-4">
        <DataToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por producto..."
          onNew={() => setOpenForm(true)}
          newLabel="Nueva tanda"
        >
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </DataToolbar>

        {produccionQ.isLoading ? (
          <Skeleton className="h-64" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ChefHat} title="Sin tandas" description="Aún no hay tandas de producción programadas." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {(["pendiente", "en_proceso", "completado", "cancelado"] as Estado[]).map((est) => {
              const cfg = ESTADOS.find((e) => e.value === est)!;
              const lista = grupos[est];
              return (
                <div key={est} className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold">{cfg.label}</h3>
                    <Badge variant="outline" className="text-xs">{lista.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[100px]">
                    {lista.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Sin tandas</p>
                    ) : (
                      lista.map((p) => {
                        const prod = productosMap[p.producto_id];
                        return (
                          <Card key={p.id} className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{prod?.nombre ?? "—"}</p>
                                <p className="text-xs text-muted-foreground font-mono">{prod?.codigo}</p>
                              </div>
                              <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1"><Calendar className="size-3" />{new Date(p.fecha_programada).toLocaleDateString("es-PE")}</span>
                              <span className="flex items-center gap-1"><Package className="size-3" />{Number(p.cantidad_programada)} u.</span>
                            </div>
                            {p.estado === "completado" && (
                              <p className="text-xs"><span className="text-muted-foreground">Producido:</span> <span className="font-mono font-semibold text-emerald-600">{Number(p.cantidad_producida)} u.</span></p>
                            )}
                            {p.observaciones && <p className="text-xs text-muted-foreground line-clamp-2">{p.observaciones}</p>}
                            <div className="flex gap-1 pt-1">
                              {p.estado === "pendiente" && (
                                <>
                                  <Button size="sm" variant="outline" className="flex-1" onClick={() => cambiarEstado.mutate({ id: p.id, estado: "en_proceso" })}>
                                    <Play className="size-3" /> Iniciar
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(p.id)}>
                                    <X className="size-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                              {p.estado === "en_proceso" && (
                                <>
                                  <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => openCompletar(p)}>
                                    <CheckCircle2 className="size-3" /> Completar
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(p.id)}>
                                    <X className="size-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <TandaForm
        open={openForm}
        onOpenChange={setOpenForm}
        userId={user?.id}
        productos={productosQ.data ?? []}
        onDone={() => qc.invalidateQueries({ queryKey: ["produccion"] })}
      />

      <Dialog open={!!completar} onOpenChange={(v) => { if (!v) { setCompletar(null); setCantidadReal(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Completar tanda</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm"><span className="text-muted-foreground">Producto:</span> <span className="font-medium">{completar?.productoNombre}</span></p>
            <p className="text-sm"><span className="text-muted-foreground">Cantidad programada:</span> <span className="font-mono">{completar?.programada} u.</span></p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Cantidad real producida</label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={cantidadReal}
                onChange={(e) => setCantidadReal(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">El stock del producto se incrementará en esta cantidad y se registrará en el Kardex automáticamente.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompletar(null)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={completarMut.isPending || !Number(cantidadReal)}
              onClick={() => completar && completarMut.mutate({ id: completar.id, cantidad: Number(cantidadReal) })}
            >
              {completarMut.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Confirmar y sumar stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(v) => { if (!v) setConfirmCancel(null); }}
        title="¿Cancelar tanda?"
        description="La tanda quedará en estado cancelado. No se afectará el stock."
        confirmLabel="Cancelar tanda"
        onConfirm={() => confirmCancel && cambiarEstado.mutate({ id: confirmCancel, estado: "cancelado" })}
      />
    </div>
  );
}

function TandaForm({ open, onOpenChange, userId, productos, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  userId?: string;
  productos: { id: string; nombre: string; codigo: string; stock: number }[];
  onDone: () => void;
}) {
  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      producto_id: "",
      cantidad_programada: 1,
      fecha_programada: new Date().toISOString().slice(0, 10),
      observaciones: "",
    },
  });

  const mut = useMutation({
    mutationFn: async (v: FormVals) => {
      const { error } = await supabase.from("produccion").insert({
        producto_id: v.producto_id,
        cantidad_programada: v.cantidad_programada,
        fecha_programada: v.fecha_programada,
        observaciones: v.observaciones || null,
        estado: "pendiente",
        cantidad_producida: 0,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Tanda creada"); onDone(); onOpenChange(false); form.reset(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nueva tanda de producción</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="producto_id" render={({ field }) => (
              <FormItem><FormLabel>Producto</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un producto" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {productos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.nombre} <span className="text-xs text-muted-foreground">(stock: {p.stock})</span></SelectItem>
                    ))}
                  </SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="cantidad_programada" render={({ field }) => (
                <FormItem><FormLabel>Cantidad programada</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="fecha_programada" render={({ field }) => (
                <FormItem><FormLabel>Fecha programada</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="observaciones" render={({ field }) => (
              <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Crear tanda
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
