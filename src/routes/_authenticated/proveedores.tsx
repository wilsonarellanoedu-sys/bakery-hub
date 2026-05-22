import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Truck, Pencil, Trash2, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/proveedores")({
  component: ProveedoresPage,
});

const schema = z.object({
  nombre: z.string().trim().min(1, "Requerido").max(150),
  ruc: z.string().trim().max(20).optional().or(z.literal("")),
  contacto: z.string().trim().max(100).optional().or(z.literal("")),
  telefono: z.string().trim().max(20).optional().or(z.literal("")),
  correo: z.string().trim().email("Correo inválido").max(255).optional().or(z.literal("")),
  direccion: z.string().trim().max(255).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;
interface Proveedor extends FormValues { id: string; created_at: string }

function ProveedoresPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Proveedor | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Proveedor | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["proveedores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("proveedores").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Proveedor[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", ruc: "", contacto: "", telefono: "", correo: "", direccion: "" },
  });

  const save = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload = {
        nombre: v.nombre,
        ruc: v.ruc || null,
        contacto: v.contacto || null,
        telefono: v.telefono || null,
        correo: v.correo || null,
        direccion: v.direccion || null,
      };
      if (editing) {
        const { error } = await supabase.from("proveedores").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("proveedores").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Proveedor actualizado" : "Proveedor creado");
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      setOpen(false); setEditing(null); form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("proveedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proveedor eliminado");
      qc.invalidateQueries({ queryKey: ["proveedores"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    form.reset({ nombre: "", ruc: "", contacto: "", telefono: "", correo: "", direccion: "" });
    setOpen(true);
  }
  function openEdit(p: Proveedor) {
    setEditing(p);
    form.reset({
      nombre: p.nombre ?? "", ruc: p.ruc ?? "", contacto: p.contacto ?? "",
      telefono: p.telefono ?? "", correo: p.correo ?? "", direccion: p.direccion ?? "",
    });
    setOpen(true);
  }

  const filtered = items.filter((p) => {
    const q = search.toLowerCase();
    return p.nombre.toLowerCase().includes(q) || (p.ruc ?? "").toLowerCase().includes(q) || (p.contacto ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader title="Proveedores" description="Gestión de proveedores de insumos" icon={Truck} />
      <DataToolbar search={search} onSearch={setSearch} placeholder="Buscar por nombre, RUC..." onNew={openNew} newLabel="Nuevo proveedor" />

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Truck} title={search ? "Sin resultados" : "Aún no hay proveedores"} description={search ? "Prueba con otro término." : "Registra tu primer proveedor."} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead><TableHead>RUC</TableHead><TableHead>Contacto</TableHead><TableHead>Teléfono</TableHead><TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell>{p.ruc || "—"}</TableCell>
                  <TableCell>{p.contacto || "—"}</TableCell>
                  <TableCell>{p.telefono || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(p)}><Trash2 className="size-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <FormField control={form.control} name="nombre" render={({ field }) => (
                <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="ruc" render={({ field }) => (
                  <FormItem><FormLabel>RUC</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="contacto" render={({ field }) => (
                  <FormItem><FormLabel>Contacto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="telefono" render={({ field }) => (
                  <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="correo" render={({ field }) => (
                  <FormItem><FormLabel>Correo</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="direccion" render={({ field }) => (
                <FormItem><FormLabel>Dirección</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
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
        title="¿Eliminar proveedor?" description={`Se eliminará "${toDelete?.nombre}".`}
        confirmLabel="Eliminar" destructive onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}
