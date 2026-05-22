import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Boxes, AlertTriangle, ArrowDown, ArrowUp, Settings2, Loader2, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/inventario")({
  component: InventarioPage,
});

type TipoMov = "entrada" | "salida" | "ajuste";

const schema = z.object({
  producto_id: z.string().uuid("Seleccione un producto"),
  tipo: z.enum(["entrada", "salida", "ajuste"]),
  cantidad: z.coerce.number().refine((n) => n !== 0, "Cantidad no puede ser 0"),
  observaciones: z.string().trim().max(300).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

function InventarioPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: productos = [], isLoading } = useQuery({
    queryKey: ["productos-inv"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("id,codigo,nombre,stock,stock_minimo,estado,categorias(nombre)")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: movs = [], isLoading: loadingMovs } = useQuery({
    queryKey: ["movimientos_inventario"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos_inventario")
        .select("id,fecha,tipo,cantidad,stock_anterior,stock_nuevo,observaciones,productos(nombre,codigo)")
        .order("fecha", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { producto_id: "", tipo: "entrada", cantidad: 0, observaciones: "" },
  });

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const prod = productos.find((p: any) => p.id === v.producto_id);
      if (!prod) throw new Error("Producto no encontrado");
      const stockAnterior = Number(prod.stock);
      let stockNuevo = stockAnterior;
      const cant = Math.abs(Number(v.cantidad));
      if (v.tipo === "entrada") stockNuevo = stockAnterior + cant;
      else if (v.tipo === "salida") {
        if (cant > stockAnterior) throw new Error("Stock insuficiente para salida");
        stockNuevo = stockAnterior - cant;
      } else stockNuevo = Number(v.cantidad);

      const { error: upErr } = await supabase
        .from("productos")
        .update({ stock: stockNuevo })
        .eq("id", v.producto_id);
      if (upErr) throw upErr;

      const { error: movErr } = await supabase.from("movimientos_inventario").insert({
        producto_id: v.producto_id,
        tipo: v.tipo,
        cantidad: v.tipo === "ajuste" ? stockNuevo - stockAnterior : cant,
        stock_anterior: stockAnterior,
        stock_nuevo: stockNuevo,
        observaciones: v.observaciones || null,
        referencia_tipo: "manual",
        user_id: user?.id ?? null,
      });
      if (movErr) throw movErr;
    },
    onSuccess: () => {
      toast.success("Movimiento registrado");
      qc.invalidateQueries({ queryKey: ["productos-inv"] });
      qc.invalidateQueries({ queryKey: ["productos"] });
      qc.invalidateQueries({ queryKey: ["movimientos_inventario"] });
      setOpen(false);
      form.reset({ producto_id: "", tipo: "entrada", cantidad: 0, observaciones: "" });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al registrar"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return productos.filter(
      (p: any) => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q),
    );
  }, [productos, search]);

  const lowStock = productos.filter((p: any) => Number(p.stock) <= Number(p.stock_minimo));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Control de stock, kardex y movimientos"
        icon={Boxes}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Productos</p>
          <p className="text-2xl font-bold mt-1">{productos.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Stock total (unidades)</p>
          <p className="text-2xl font-bold mt-1">
            {productos.reduce((s: number, p: any) => s + Number(p.stock || 0), 0)}
          </p>
        </Card>
        <Card className="p-4 border-destructive/40">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertTriangle className="size-3.5 text-destructive" /> Stock bajo
          </p>
          <p className="text-2xl font-bold mt-1 text-destructive">{lowStock.length}</p>
        </Card>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock"><Boxes className="size-4 mr-2" />Stock</TabsTrigger>
          <TabsTrigger value="kardex"><History className="size-4 mr-2" />Kardex</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="space-y-4 mt-4">
          <DataToolbar
            search={search}
            onSearch={setSearch}
            placeholder="Buscar por nombre o código..."
            onNew={() => setOpen(true)}
            newLabel="Movimiento"
          />
          <Card className="overflow-hidden">
            {isLoading ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={Boxes} title="Sin productos" description="Crea productos primero en el módulo de Productos." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Mínimo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p: any) => {
                    const low = Number(p.stock) <= Number(p.stock_minimo);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                        <TableCell className="font-medium">{p.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{p.categorias?.nombre ?? "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(p.stock)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{Number(p.stock_minimo)}</TableCell>
                        <TableCell>
                          {low ? (
                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="size-3" />Bajo</Badge>
                          ) : (
                            <Badge variant="secondary">OK</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="kardex" className="mt-4">
          <Card className="overflow-hidden">
            {loadingMovs ? (
              <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : movs.length === 0 ? (
              <EmptyState icon={History} title="Sin movimientos" description="Aún no se han registrado movimientos." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Anterior</TableHead>
                    <TableHead className="text-right">Nuevo</TableHead>
                    <TableHead>Obs.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movs.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.fecha).toLocaleString("es-PE")}
                      </TableCell>
                      <TableCell className="font-medium">
                        {m.productos?.nombre ?? "—"}
                        <div className="text-xs text-muted-foreground font-mono">{m.productos?.codigo}</div>
                      </TableCell>
                      <TableCell>
                        {m.tipo === "entrada" && <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><ArrowDown className="size-3" />Entrada</Badge>}
                        {m.tipo === "salida" && <Badge variant="destructive" className="gap-1"><ArrowUp className="size-3" />Salida</Badge>}
                        {m.tipo === "ajuste" && <Badge variant="secondary" className="gap-1"><Settings2 className="size-3" />Ajuste</Badge>}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{Number(m.cantidad)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{Number(m.stock_anterior ?? 0)}</TableCell>
                      <TableCell className="text-right font-semibold">{Number(m.stock_nuevo ?? 0)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{m.observaciones ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimiento</DialogTitle>
            <DialogDescription>Entradas suman stock, salidas restan, ajustes fijan el stock al valor indicado.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
              <FormField control={form.control} name="producto_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Producto</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {productos.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.nombre} ({p.codigo}) — stock {Number(p.stock)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="entrada">Entrada</SelectItem>
                      <SelectItem value="salida">Salida</SelectItem>
                      <SelectItem value="ajuste">Ajuste (fijar stock)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cantidad" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cantidad</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="observaciones" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observaciones</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="size-4 animate-spin" />} Registrar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
