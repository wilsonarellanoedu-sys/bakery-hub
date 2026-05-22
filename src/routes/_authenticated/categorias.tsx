import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Tag, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/categorias")({
  component: CategoriasPage,
});

const schema = z.object({
  nombre: z.string().trim().min(1, "Requerido").max(100),
  descripcion: z.string().trim().max(300).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
interface Categoria { id: string; nombre: string; descripcion: string | null; created_at: string; count?: number }

function CategoriasPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Categoria | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Categoria | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias").select("*").order("nombre");
      if (error) throw error;
      return data as Categoria[];
    },
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { nombre: "", descripcion: "" } });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = { nombre: v.nombre, descripcion: v.descripcion || null };
      if (editing) {
        const { error } = await supabase.from("categorias").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categorias").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Categoría actualizada" : "Categoría creada");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      setOpen(false); setEditing(null); form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoría eliminada");
      qc.invalidateQueries({ queryKey: ["categorias"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setEditing(null); form.reset({ nombre: "", descripcion: "" }); setOpen(true); }
  function openEdit(c: Categoria) { setEditing(c); form.reset({ nombre: c.nombre, descripcion: c.descripcion ?? "" }); setOpen(true); }

  const filtered = items.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader title="Categorías" description="Clasificación de productos" icon={Tag}
        actions={<Button variant="outline" asChild><Link to="/productos">Ver productos</Link></Button>} />
      <DataToolbar search={search} onSearch={setSearch} placeholder="Buscar categoría..." onNew={openNew} newLabel="Nueva categoría" />

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Tag} title={search ? "Sin resultados" : "Sin categorías"} description="Crea categorías como Panes, Pasteles, Bebidas, etc." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Nombre</TableHead><TableHead>Descripción</TableHead><TableHead className="w-24 text-right">Acciones</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{c.descripcion || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar categoría" : "Nueva categoría"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="descripcion" render={({ field }) => (
                <FormItem><FormLabel>Descripción</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={save.isPending}>{save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}Guardar</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar categoría?" description={`"${toDelete?.nombre}" será eliminada. Los productos quedarán sin categoría.`}
        confirmLabel="Eliminar" destructive onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}
