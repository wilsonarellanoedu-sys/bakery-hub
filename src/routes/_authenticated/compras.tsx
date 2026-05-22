import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShoppingCart, Plus, Trash2, Loader2, Eye, Receipt } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/compras")({
  component: ComprasPage,
});

const IGV_PCT = 0.18;

const itemSchema = z.object({
  producto_id: z.string().uuid("Producto requerido"),
  cantidad: z.coerce.number().positive("Cantidad > 0"),
  precio_unitario: z.coerce.number().min(0, "Precio inválido"),
});

const schema = z.object({
  proveedor_id: z.string().uuid("Seleccione un proveedor"),
  items: z.array(itemSchema).min(1, "Agregue al menos un producto"),
});
type FormValues = z.infer<typeof schema>;

function ComprasPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const { data: compras = [], isLoading } = useQuery({
    queryKey: ["compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("id,numero,fecha,subtotal,igv,total,proveedores(nombre,ruc)")
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: proveedores = [] } = useQuery({
    queryKey: ["proveedores-compras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proveedores").select("id,nombre,ruc").order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: productos = [] } = useQuery({
    queryKey: ["productos-compras"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id,codigo,nombre,precio_compra,stock")
        .eq("estado", true)
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { proveedor_id: "", items: [{ producto_id: "", cantidad: 1, precio_unitario: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const items = form.watch("items");
  const totals = useMemo(() => {
    const subtotal = items.reduce((s, it) => s + (Number(it.cantidad) || 0) * (Number(it.precio_unitario) || 0), 0);
    const base = subtotal / (1 + IGV_PCT);
    const igv = subtotal - base;
    return { subtotal: base, igv, total: subtotal };
  }, [items]);

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const subtotalTotal = v.items.reduce((s, it) => s + it.cantidad * it.precio_unitario, 0);
      const baseImponible = subtotalTotal / (1 + IGV_PCT);
      const igv = subtotalTotal - baseImponible;

      const { data: compra, error: cErr } = await supabase
        .from("compras")
        .insert({
          proveedor_id: v.proveedor_id,
          subtotal: baseImponible,
          igv,
          total: subtotalTotal,
          user_id: user?.id ?? null,
        })
        .select("id,numero")
        .single();
      if (cErr) throw cErr;

      const detalles = v.items.map((it) => ({
        compra_id: compra.id,
        producto_id: it.producto_id,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario,
        subtotal: it.cantidad * it.precio_unitario,
      }));
      const { error: dErr } = await supabase.from("detalle_compras").insert(detalles);
      if (dErr) throw dErr;

      // Update stock + register inventory movements
      for (const it of v.items) {
        const prod = productos.find((p: any) => p.id === it.producto_id);
        if (!prod) continue;
        const stockAnterior = Number(prod.stock);
        const stockNuevo = stockAnterior + Number(it.cantidad);
        await supabase.from("productos").update({ stock: stockNuevo, precio_compra: it.precio_unitario }).eq("id", it.producto_id);
        await supabase.from("movimientos_inventario").insert({
          producto_id: it.producto_id,
          tipo: "entrada",
          cantidad: it.cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          referencia_tipo: "compra",
          referencia_id: compra.id,
          observaciones: `Compra N° ${compra.numero}`,
          user_id: user?.id ?? null,
        });
      }
      return compra;
    },
    onSuccess: () => {
      toast.success("Compra registrada e inventario actualizado");
      qc.invalidateQueries({ queryKey: ["compras"] });
      qc.invalidateQueries({ queryKey: ["productos"] });
      qc.invalidateQueries({ queryKey: ["productos-inv"] });
      qc.invalidateQueries({ queryKey: ["productos-compras"] });
      qc.invalidateQueries({ queryKey: ["movimientos_inventario"] });
      setOpen(false);
      form.reset({ proveedor_id: "", items: [{ producto_id: "", cantidad: 1, precio_unitario: 0 }] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al registrar compra"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return compras.filter(
      (c: any) =>
        String(c.numero).includes(q) ||
        c.proveedores?.nombre?.toLowerCase().includes(q) ||
        c.proveedores?.ruc?.toLowerCase().includes(q),
    );
  }, [compras, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Compras" description="Compras a proveedores e insumos" icon={ShoppingCart} />

      <DataToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por N°, proveedor o RUC..."
        onNew={() => setOpen(true)}
        newLabel="Nueva compra"
      />

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Receipt} title="Sin compras" description="Registra tu primera compra para empezar." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N°</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">IGV</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell><Badge variant="outline" className="font-mono">#{c.numero}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(c.fecha).toLocaleString("es-PE")}</TableCell>
                  <TableCell className="font-medium">
                    {c.proveedores?.nombre ?? "—"}
                    <div className="text-xs text-muted-foreground">{c.proveedores?.ruc}</div>
                  </TableCell>
                  <TableCell className="text-right">S/ {Number(c.subtotal).toFixed(2)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">S/ {Number(c.igv).toFixed(2)}</TableCell>
                  <TableCell className="text-right font-semibold">S/ {Number(c.total).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => setViewing(c.id)}><Eye className="size-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nueva compra</DialogTitle>
            <DialogDescription>Los precios incluyen IGV (18%). El stock se actualiza automáticamente.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="proveedor_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Proveedor</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {proveedores.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre} {p.ruc ? `· ${p.ruc}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Detalle</label>
                  <Button type="button" size="sm" variant="outline" onClick={() => append({ producto_id: "", cantidad: 1, precio_unitario: 0 })}>
                    <Plus className="size-4" /> Agregar
                  </Button>
                </div>
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="w-24">Cantidad</TableHead>
                        <TableHead className="w-32">Precio U.</TableHead>
                        <TableHead className="text-right w-28">Subtotal</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((f, idx) => {
                        const it = items[idx];
                        const sub = (Number(it?.cantidad) || 0) * (Number(it?.precio_unitario) || 0);
                        return (
                          <TableRow key={f.id}>
                            <TableCell>
                              <FormField control={form.control} name={`items.${idx}.producto_id`} render={({ field }) => (
                                <FormItem>
                                  <Select value={field.value} onValueChange={(val) => {
                                    field.onChange(val);
                                    const prod = productos.find((p: any) => p.id === val);
                                    if (prod && !form.getValues(`items.${idx}.precio_unitario`)) {
                                      form.setValue(`items.${idx}.precio_unitario`, Number(prod.precio_compra) || 0);
                                    }
                                  }}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                      {productos.map((p: any) => (
                                        <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.codigo})</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`items.${idx}.cantidad`} render={({ field }) => (
                                <FormItem><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                            </TableCell>
                            <TableCell>
                              <FormField control={form.control} name={`items.${idx}.precio_unitario`} render={({ field }) => (
                                <FormItem><FormControl><Input type="number" step="0.01" min="0" {...field} /></FormControl><FormMessage /></FormItem>
                              )} />
                            </TableCell>
                            <TableCell className="text-right font-medium">S/ {sub.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button type="button" size="icon" variant="ghost" disabled={fields.length === 1} onClick={() => remove(idx)}>
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>S/ {totals.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IGV (18%)</span><span>S/ {totals.igv.toFixed(2)}</span></div>
                  <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>S/ {totals.total.toFixed(2)}</span></div>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Registrar compra
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ViewCompraDialog id={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

function ViewCompraDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["compra-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data: compra, error } = await supabase
        .from("compras")
        .select("id,numero,fecha,subtotal,igv,total,proveedores(nombre,ruc)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      const { data: det, error: dErr } = await supabase
        .from("detalle_compras")
        .select("cantidad,precio_unitario,subtotal,productos(nombre,codigo)")
        .eq("compra_id", id!);
      if (dErr) throw dErr;
      return { compra, det: det ?? [] };
    },
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Compra #{data?.compra?.numero ?? "—"}</DialogTitle>
          <DialogDescription>
            {data?.compra?.proveedores?.nombre} {data?.compra?.proveedores?.ruc && `· RUC ${data.compra.proveedores.ruc}`}
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Cant.</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.det.map((d: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>
                      {d.productos?.nombre}
                      <div className="text-xs text-muted-foreground font-mono">{d.productos?.codigo}</div>
                    </TableCell>
                    <TableCell className="text-right">{Number(d.cantidad)}</TableCell>
                    <TableCell className="text-right">S/ {Number(d.precio_unitario).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-medium">S/ {Number(d.subtotal).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>S/ {Number(data.compra.subtotal).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">IGV</span><span>S/ {Number(data.compra.igv).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base pt-1 border-t"><span>Total</span><span>S/ {Number(data.compra.total).toFixed(2)}</span></div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
