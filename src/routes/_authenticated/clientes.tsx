import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Users, Pencil, Trash2, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/clientes")({
  component: ClientesPage,
});

const schema = z.object({
  nombre: z.string().trim().min(1, "Requerido").max(100),
  apellidos: z.string().trim().max(100).optional().or(z.literal("")),
  dni: z.string().trim().max(20).optional().or(z.literal("")),
  telefono: z.string().trim().max(20).optional().or(z.literal("")),
  correo: z.string().trim().email("Correo inválido").max(255).optional().or(z.literal("")),
  direccion: z.string().trim().max(255).optional().or(z.literal("")),
});
type FormValues = z.infer<typeof schema>;

interface Cliente extends FormValues {
  id: string;
  created_at: string;
}

function ClientesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Cliente | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clientes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nombre: "", apellidos: "", dni: "", telefono: "", correo: "", direccion: "" },
  });

  const save = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        nombre: values.nombre,
        apellidos: values.apellidos || null,
        dni: values.dni || null,
        telefono: values.telefono || null,
        correo: values.correo || null,
        direccion: values.direccion || null,
      };
      if (editing) {
        const { error } = await supabase.from("clientes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente actualizado" : "Cliente creado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setOpen(false);
      setEditing(null);
      form.reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente eliminado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    form.reset({ nombre: "", apellidos: "", dni: "", telefono: "", correo: "", direccion: "" });
    setOpen(true);
  }

  function openEdit(c: Cliente) {
    setEditing(c);
    form.reset({
      nombre: c.nombre ?? "",
      apellidos: c.apellidos ?? "",
      dni: c.dni ?? "",
      telefono: c.telefono ?? "",
      correo: c.correo ?? "",
      direccion: c.direccion ?? "",
    });
    setOpen(true);
  }

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.apellidos ?? "").toLowerCase().includes(q) ||
      (c.dni ?? "").toLowerCase().includes(q) ||
      (c.telefono ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <PageHeader title="Clientes" description="Gestión de clientes de la panadería" icon={Users} />
      <DataToolbar
        search={search}
        onSearch={setSearch}
        placeholder="Buscar por nombre, DNI, teléfono..."
        onNew={openNew}
        newLabel="Nuevo cliente"
      />

      <Card className="shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "Sin resultados" : "Aún no hay clientes"}
            description={search ? "Prueba con otro término." : "Comienza registrando tu primer cliente."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nombre} {c.apellidos}</TableCell>
                  <TableCell>{c.dni || "—"}</TableCell>
                  <TableCell>{c.telefono || "—"}</TableCell>
                  <TableCell>{c.correo || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setToDelete(c)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Nuevo cliente"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="nombre" render={({ field }) => (
                  <FormItem><FormLabel>Nombre *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="apellidos" render={({ field }) => (
                  <FormItem><FormLabel>Apellidos</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="dni" render={({ field }) => (
                  <FormItem><FormLabel>DNI</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="telefono" render={({ field }) => (
                  <FormItem><FormLabel>Teléfono</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="correo" render={({ field }) => (
                <FormItem><FormLabel>Correo</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="direccion" render={({ field }) => (
                <FormItem><FormLabel>Dirección</FormLabel><FormControl><Textarea rows={2} {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={save.isPending}>
                  {save.isPending && <Loader2 className="size-4 mr-1 animate-spin" />}
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="¿Eliminar cliente?"
        description={`Se eliminará "${toDelete?.nombre}". Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => toDelete && del.mutate(toDelete.id)}
      />
    </div>
  );
}
