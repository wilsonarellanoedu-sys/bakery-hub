import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClipboardList, Plus, Trash2, Eye, Loader2, CheckCircle2, PackageCheck, Truck, X, AlertTriangle } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/pedidos")({ component: PedidosPage });

const fmt = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

type Estado = "pendiente" | "preparando" | "listo" | "entregado" | "cancelado";

const ESTADOS: { value: Estado; label: string; variant: "default" | "secondary" | "destructive" | "outline" }[] = [
  { value: "pendiente", label: "Pendiente", variant: "secondary" },
  { value: "preparando", label: "Preparando", variant: "outline" },
  { value: "listo", label: "Listo", variant: "default" },
  { value: "entregado", label: "Entregado", variant: "default" },
  { value: "cancelado", label: "Cancelado", variant: "destructive" },
];

const itemSchema = z.object({
  producto_id: z.string().uuid("Selecciona un producto"),
  cantidad: z.coerce.number().positive("Mayor a 0"),
  precio_unitario: z.coerce.number().min(0),
  observaciones: z.string().max(200).optional().or(z.literal("")),
});
const schema = z.object({
  cliente_id: z.string().uuid().optional().or(z.literal("none")),
  fecha_entrega: z.string().optional().or(z.literal("")),
  observaciones: z.string().max(500).optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Agrega al menos un producto"),
});
type FormVals = z.infer<typeof schema>;

function PedidosPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [openForm, setOpenForm] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirmListo, setConfirmListo] = useState<{ id: string; numero: number } | null>(null);
  const [stockWarning, setStockWarning] = useState<string[]>([]);

  const pedidosQ = useQuery({
    queryKey: ["pedidos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero, cliente_id, estado, fecha_entrega, total, observaciones, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientesQ = useQuery({
    queryKey: ["clientes-lookup"],
    queryFn: async () => (await supabase.from("clientes").select("id, nombre, apellidos").order("nombre")).data ?? [],
  });
  const clientesMap = useMemo(() => Object.fromEntries((clientesQ.data ?? []).map((c) => [c.id, `${c.nombre} ${c.apellidos ?? ""}`.trim()])), [clientesQ.data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (pedidosQ.data ?? []).filter((p) => {
      const ms = !q || String(p.numero).includes(q) || (p.cliente_id && clientesMap[p.cliente_id]?.toLowerCase().includes(q));
      const me = filterEstado === "all" || p.estado === filterEstado;
      return ms && me;
    });
  }, [pedidosQ.data, search, filterEstado, clientesMap]);

  // Mark as ready -> atomic RPC: validates stock, deducts and writes kardex in one transaction
  const marcarListo = useMutation({
    mutationFn: async ({ pedidoId }: { pedidoId: string }) => {
      const { data, error } = await supabase.rpc("marcar_pedido_listo", {
        _pedido_id: pedidoId,
        _user_id: user?.id ?? "",
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string; detalles?: { nombre: string; stock: number; requerido: number }[] };
      if (!result.ok) {
        if (result.error === "stock_insuficiente" && result.detalles) {
          const err = new Error("Stock insuficiente");
          (err as Error & { detalles?: string[] }).detalles = result.detalles.map(
            (d) => `${d.nombre} (stock: ${d.stock}, requiere: ${d.requerido})`
          );
          throw err;
        }
        throw new Error(result.error ?? "Error al marcar como listo");
      }
      return result;
    },
    onSuccess: () => {
      toast.success("Pedido marcado como listo. Stock descontado y kardex actualizado.");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
      qc.invalidateQueries({ queryKey: ["pos-productos"] });
      qc.invalidateQueries({ queryKey: ["inventario"] });
      setConfirmListo(null);
      setStockWarning([]);
    },
    onError: (e: Error & { detalles?: string[] }) => {
      if (e.detalles) {
        setStockWarning(e.detalles);
        toast.error("Stock insuficiente para marcar como listo");
      } else {
        toast.error(e.message);
      }
    },
  });

  // Change status (without stock side effects, except for cancelar -> reverse if was listo/entregado)
  const cambiarEstado = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: Estado }) => {
      const { error } = await supabase.from("pedidos").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["pedidos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pedidos"
        description="Pedidos personalizados de clientes. Al marcar como listo se descuenta stock automáticamente."
        icon={ClipboardList}
      />

      <Card className="p-4 space-y-4">
        <DataToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por número o cliente..."
          onNew={() => setOpenForm(true)}
          newLabel="Nuevo pedido"
        >
          <Select value={filterEstado} onValueChange={setFilterEstado}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </DataToolbar>

        {pedidosQ.isLoading ? (
          <Skeleton className="h-64" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Sin pedidos" description="Aún no hay pedidos registrados." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const estadoCfg = ESTADOS.find((e) => e.value === p.estado);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-semibold">#{p.numero}</TableCell>
                    <TableCell>{p.cliente_id ? clientesMap[p.cliente_id] ?? "—" : "Cliente general"}</TableCell>
                    <TableCell className="text-xs">{p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString("es-PE") : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={estadoCfg?.variant ?? "secondary"} className={p.estado === "listo" ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                        {estadoCfg?.label ?? p.estado}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(p.total))}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" onClick={() => setViewId(p.id)}><Eye className="size-4" /></Button>
                        {p.estado === "pendiente" && (
                          <Button variant="outline" size="sm" onClick={() => cambiarEstado.mutate({ id: p.id, estado: "preparando" })}>
                            <PackageCheck className="size-4" /> Preparar
                          </Button>
                        )}
                        {p.estado === "preparando" && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setConfirmListo({ id: p.id, numero: p.numero })}>
                            <CheckCircle2 className="size-4" /> Listo
                          </Button>
                        )}
                        {p.estado === "listo" && (
                          <Button variant="outline" size="sm" onClick={() => cambiarEstado.mutate({ id: p.id, estado: "entregado" })}>
                            <Truck className="size-4" /> Entregar
                          </Button>
                        )}
                        {(p.estado === "pendiente" || p.estado === "preparando") && (
                          <Button variant="ghost" size="icon" onClick={() => cambiarEstado.mutate({ id: p.id, estado: "cancelado" })}>
                            <X className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <PedidoForm open={openForm} onOpenChange={setOpenForm} userId={user?.id} clientes={clientesQ.data ?? []} onDone={() => qc.invalidateQueries({ queryKey: ["pedidos"] })} />
      {viewId && <PedidoDetalle pedidoId={viewId} onClose={() => setViewId(null)} clientesMap={clientesMap} />}

      <ConfirmDialog
        open={!!confirmListo}
        onOpenChange={(v) => { if (!v) { setConfirmListo(null); setStockWarning([]); } }}
        title={`¿Marcar pedido #${confirmListo?.numero} como listo?`}
        description="Esta acción descontará el stock de los productos y registrará los movimientos en el Kardex automáticamente."
        confirmLabel={marcarListo.isPending ? "Procesando..." : "Confirmar y descontar stock"}
        onConfirm={() => confirmListo && marcarListo.mutate({ pedidoId: confirmListo.id })}
      />

      {stockWarning.length > 0 && (
        <Dialog open={stockWarning.length > 0} onOpenChange={() => setStockWarning([])}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" /> Stock insuficiente
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p className="text-sm">No se puede marcar el pedido como listo porque los siguientes productos no tienen stock suficiente:</p>
              <ul className="space-y-1 text-sm bg-muted p-3 rounded">
                {stockWarning.map((s, i) => <li key={i} className="font-mono">• {s}</li>)}
              </ul>
              <p className="text-xs text-muted-foreground">Registra una compra o ajusta el inventario antes de continuar.</p>
            </div>
            <DialogFooter>
              <Button onClick={() => setStockWarning([])}>Entendido</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PedidoForm({ open, onOpenChange, userId, clientes, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  userId?: string;
  clientes: { id: string; nombre: string; apellidos: string | null }[];
  onDone: () => void;
}) {
  const productosQ = useQuery({
    queryKey: ["productos-lookup"],
    queryFn: async () => (await supabase.from("productos").select("id, nombre, codigo, precio_venta, stock").eq("estado", true).order("nombre")).data ?? [],
  });

  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { cliente_id: "none", fecha_entrega: "", observaciones: "", items: [{ producto_id: "", cantidad: 1, precio_unitario: 0, observaciones: "" }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = form.watch("items");
  const total = items.reduce((a, i) => a + (Number(i.cantidad) || 0) * (Number(i.precio_unitario) || 0), 0);

  const mut = useMutation({
    mutationFn: async (v: FormVals) => {
      const { data: pedido, error: pErr } = await supabase.from("pedidos").insert({
        cliente_id: v.cliente_id && v.cliente_id !== "none" ? v.cliente_id : null,
        fecha_entrega: v.fecha_entrega || null,
        observaciones: v.observaciones || null,
        estado: "pendiente",
        total,
        user_id: userId,
      }).select("id").single();
      if (pErr) throw pErr;
      const detalles = v.items.map((i) => ({
        pedido_id: pedido.id,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.cantidad * i.precio_unitario,
        observaciones: i.observaciones || null,
      }));
      const { error: dErr } = await supabase.from("detalle_pedidos").insert(detalles);
      if (dErr) throw dErr;
    },
    onSuccess: () => { toast.success("Pedido creado"); onDone(); onOpenChange(false); form.reset(); },
    onError: (e: Error) => toast.error(e.message),
  });

  function onPickProducto(idx: number, prodId: string) {
    const p = productosQ.data?.find((x) => x.id === prodId);
    if (p) form.setValue(`items.${idx}.precio_unitario`, Number(p.precio_venta));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo pedido</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="cliente_id" render={({ field }) => (
                <FormItem><FormLabel>Cliente</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Cliente general" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Cliente general</SelectItem>
                      {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} {c.apellidos ?? ""}</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="fecha_entrega" render={({ field }) => (
                <FormItem><FormLabel>Fecha de entrega</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Productos</label>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ producto_id: "", cantidad: 1, precio_unitario: 0, observaciones: "" })}>
                  <Plus className="size-3" /> Agregar
                </Button>
              </div>
              {fields.map((f, idx) => (
                <div key={f.id} className="grid grid-cols-[1fr_80px_100px_auto] gap-2 items-start p-2 rounded border border-border">
                  <FormField control={form.control} name={`items.${idx}.producto_id`} render={({ field }) => (
                    <FormItem><Select value={field.value} onValueChange={(v) => { field.onChange(v); onPickProducto(idx, v); }}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Producto" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(productosQ.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre} <span className="text-xs text-muted-foreground">(stock: {p.stock})</span></SelectItem>
                        ))}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${idx}.cantidad`} render={({ field }) => (
                    <FormItem><FormControl><Input type="number" step="0.01" placeholder="Cant." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name={`items.${idx}.precio_unitario`} render={({ field }) => (
                    <FormItem><FormControl><Input type="number" step="0.01" placeholder="Precio" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="button" variant="ghost" size="icon" onClick={() => fields.length > 1 && remove(idx)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {form.formState.errors.items?.message && <p className="text-xs text-destructive">{form.formState.errors.items.message}</p>}
            </div>

            <FormField control={form.control} name="observaciones" render={({ field }) => (
              <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="flex items-center justify-between p-3 rounded bg-muted">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-bold text-primary">{fmt(total)}</span>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending && <Loader2 className="size-4 animate-spin" />} Crear pedido
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function PedidoDetalle({ pedidoId, onClose, clientesMap }: { pedidoId: string; onClose: () => void; clientesMap: Record<string, string> }) {
  const { data, isLoading } = useQuery({
    queryKey: ["pedido-detalle", pedidoId],
    queryFn: async () => {
      const [{ data: ped }, { data: items }] = await Promise.all([
        supabase.from("pedidos").select("*").eq("id", pedidoId).single(),
        supabase.from("detalle_pedidos").select("*, productos(nombre, codigo)").eq("pedido_id", pedidoId),
      ]);
      return { pedido: ped, items: items ?? [] };
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Pedido #{data?.pedido?.numero}</DialogTitle></DialogHeader>
        {isLoading ? <Skeleton className="h-40" /> : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Cliente:</span> {data?.pedido?.cliente_id ? clientesMap[data.pedido.cliente_id] : "General"}</div>
              <div><span className="text-muted-foreground">Estado:</span> <Badge>{data?.pedido?.estado}</Badge></div>
              <div><span className="text-muted-foreground">Entrega:</span> {data?.pedido?.fecha_entrega ?? "—"}</div>
              <div><span className="text-muted-foreground">Total:</span> <strong>{fmt(Number(data?.pedido?.total ?? 0))}</strong></div>
            </div>
            {data?.pedido?.observaciones && <p className="text-sm bg-muted p-2 rounded">{data.pedido.observaciones}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">P. Unit</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{(i as { productos?: { nombre?: string } }).productos?.nombre ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{Number(i.cantidad)}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(i.precio_unitario))}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(Number(i.subtotal))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
