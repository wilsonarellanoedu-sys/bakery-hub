import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Package, Pencil, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/productos")({
  component: ProductosPage,
});

const schema = z.object({
  codigo: z.string().trim().min(1, "Requerido").max(50),
  nombre: z.string().trim().min(1, "Requerido").max(150),
  descripcion: z.string().trim().max(500).optional().or(z.literal("")),
  categoria_id: z.string().uuid().optional().or(z.literal("")).or(z.literal("none")),
  precio_compra: z.coerce.number().min(0, "Mayor o igual a 0"),
  precio_venta: z.coerce.number().min(0, "Mayor o igual a 0"),
  stock: z.coerce.number().min(0),
  stock_minimo: z.coerce.number().min(0),
  imagen_url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https?:\/\/.+/i.test(v), "Debe iniciar con http:// o https://")
    .optional()
    .or(z.literal("")),
  estado: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface Producto {
  id: string; codigo: string; nombre: string; descripcion: string | null;
  categoria_id: string | null; precio_compra: number; precio_venta: number;
  stock: number; stock_minimo: number; imagen_url: string | null; estado: boolean;
  categorias?: { nombre: string } | null;
}

const PEN = (n: number) => `S/ ${Number(n).toFixed(2)}`;

function ProductosPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Producto | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Producto | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["productos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("productos")
        .select("*, categorias(nombre)")
        .order("nombre");
      if (error) throw error;
      return data as Producto[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("id, nombre").order("nombre");
      if (error) throw error;
      return data as { id: string; nombre: string }[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      codigo: "", nombre: "", descripcion: "", categoria_id: "none",
      precio_compra: 0, precio_venta: 0, stock: 0, stock_minimo: 0,
      imagen_url: "", estado: true,
    },
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = {
        codigo: v.codigo, nombre: v.nombre,
        descripcion: v.descripcion || null,
        categoria_id: v.categoria_id && v.categoria_id !== "none" ? v.categoria_id : null,
        precio_compra: v.precio_compra, precio_venta: v.precio_venta,
        stock: v.stock, stock_minimo: v.stock_minimo,
        imagen_url: v.imagen_url || null, estado: v.estado,
      };
      if (editing) {
        const { error } = await supabase.from("productos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("productos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Producto actualizado" : "Producto creado");
      qc.invalidateQueries({ queryKey: ["productos"] });
      setOpen(false); setEditing(null); form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("productos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Producto eliminado");
      qc.invalidateQueries({ queryKey: ["productos"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function genCode() {
    return "P" + Date.now().toString().slice(-6);
  }
  function openNew() {
    setEditing(null);
    form.reset({
      codigo: genCode(), nombre: "", descripcion: "", categoria_id: "none",
      precio_compra: 0, precio_venta: 0, stock: 0, stock_minimo: 0,
      imagen_url: "", estado: true,
    });
    setOpen(true);
  }
  function openEdit(p: Producto) {
    setEditing(p);
    form.reset({
      codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion ?? "",
      categoria_id: p.categoria_id ?? "none",
      precio_compra: Number(p.precio_compra), precio_venta: Number(p.precio_venta),
      stock: Number(p.stock), stock_minimo: Number(p.stock_minimo),
      imagen_url: p.imagen_url ?? "", estado: p.estado,
    });
    setOpen(true);
  }

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
    const matchCat = catFilter === "all" || p.categoria_id === catFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader title="Productos" description="Catálogo de panes, pasteles, postres y bebidas" icon={Package} />

      <DataToolbar search={search} onSearch={setSearch} placeholder="Buscar por nombre o código..." onNew={openNew} newLabel="Nuevo producto">
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Categoría" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las categorías</SelectItem>
            {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </DataToolbar>

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Package} title={search || catFilter !== "all" ? "Sin resultados" : "Aún no hay productos"} description="Comienza añadiendo tus productos al catálogo." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead><TableHead>Producto</TableHead><TableHead>Categoría</TableHead>
                <TableHead className="text-right">P. Venta</TableHead><TableHead className="text-right">Stock</TableHead>
                <TableHead>Estado</TableHead><TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const low = Number(p.stock) <= Number(p.stock_minimo);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.imagen_url ? (
                          <img
                            src={p.imagen_url}
                            alt={p.nombre}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="size-9 rounded object-cover bg-muted"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = "none";
                              const fb = img.nextElementSibling as HTMLElement | null;
                              if (fb) fb.style.display = "flex";
                            }}
                          />
                        ) : null}
                        {!p.imagen_url ? (
                          <div className="size-9 rounded bg-muted flex items-center justify-center"><Package className="size-4 text-muted-foreground" /></div>
                        ) : (
                          <div style={{ display: "none" }} className="size-9 rounded bg-muted items-center justify-center"><Package className="size-4 text-muted-foreground" /></div>
                        )}
                        <span className="font-medium">{p.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.categorias?.nombre || "—"}</TableCell>
                    <TableCell className="text-right font-medium">{PEN(p.precio_venta)}</TableCell>
                    <TableCell className="text-right">
                      <span className={low ? "text-destructive font-medium" : ""}>
                        {Number(p.stock)}
                        {low && <AlertTriangle className="size-3 inline ml-1" />}
                      </span>
                    </TableCell>
                    <TableCell>
                      {p.estado ? (
                        <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />Activo</Badge>
                      ) : (
                        <Badge variant="outline">Inactivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}><Trash2 className="size-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="codigo" render={({ field }) => (
                  <FormItem><FormLabel>Código *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="categoria_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select value={field.value || "none"} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">Sin categoría</SelectItem>
                      {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="descripcion" render={({ field }) => (
                <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="precio_compra" render={({ field }) => (
                  <FormItem><FormLabel>Precio compra (S/) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="precio_venta" render={({ field }) => (
                  <FormItem><FormLabel>Precio venta (S/) *</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stock" render={({ field }) => (
                  <FormItem><FormLabel>Stock actual</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="stock_minimo" render={({ field }) => (
                  <FormItem><FormLabel>Stock mínimo</FormLabel><FormControl><Input type="number" step="1" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="imagen_url" render={({ field }) => (
                <FormItem><FormLabel>URL de imagen</FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="estado" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div><FormLabel>Producto activo</FormLabel><p className="text-xs text-muted-foreground">Disponible en el punto de venta</p></div>
                  <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar producto?" description={`Se eliminará "${toDelete?.nombre}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar" destructive onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}
