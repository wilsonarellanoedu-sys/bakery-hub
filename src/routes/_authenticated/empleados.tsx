import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCog, Plus, Pencil, Trash2, Loader2, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_authenticated/empleados")({ component: EmpleadosPage });

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "cajero", label: "Cajero" },
  { value: "panadero", label: "Panadero" },
  { value: "almacen", label: "Almacén" },
];

const schema = z.object({
  nombre: z.string().min(2, "Mínimo 2 caracteres").max(100),
  dni: z.string().max(20).optional().or(z.literal("")),
  telefono: z.string().max(20).optional().or(z.literal("")),
  correo: z.string().email("Correo inválido").or(z.literal("")).optional(),
  cargo: z.string().max(50).optional().or(z.literal("")),
  salario: z.coerce.number().min(0).optional(),
  fecha_ingreso: z.string().optional().or(z.literal("")),
  estado: z.boolean(),
});
type FormVals = z.infer<typeof schema>;

type Empleado = {
  id: string;
  nombre: string;
  dni: string | null;
  telefono: string | null;
  correo: string | null;
  cargo: string | null;
  salario: number | null;
  fecha_ingreso: string | null;
  foto_url: string | null;
  user_id: string | null;
  estado: boolean;
};

function EmpleadosPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Empleado | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [rolesEmpleado, setRolesEmpleado] = useState<Empleado | null>(null);

  const empleadosQ = useQuery({
    queryKey: ["empleados"],
    queryFn: async (): Promise<Empleado[]> => {
      const { data, error } = await supabase
        .from("empleados")
        .select("id, nombre, dni, telefono, correo, cargo, salario, fecha_ingreso, foto_url, user_id, estado")
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (empleadosQ.data ?? []).filter((e) =>
      !q || e.nombre.toLowerCase().includes(q) || (e.dni ?? "").includes(q) || (e.cargo ?? "").toLowerCase().includes(q),
    );
  }, [empleadosQ.data, search]);

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("empleados").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Empleado eliminado"); qc.invalidateQueries({ queryKey: ["empleados"] }); setDeleteId(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Empleados" description="Personal de la panadería" icon={UserCog} />
        <Card className="p-12 text-center text-muted-foreground">Solo administradores pueden gestionar empleados.</Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Empleados" description="Gestiona el personal y sus roles de acceso." icon={UserCog} />

      <Card className="p-4 space-y-4">
        <DataToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar por nombre, DNI o cargo..."
          onNew={() => { setEditing(null); setOpenForm(true); }}
          newLabel="Nuevo empleado"
        />

        {empleadosQ.isLoading ? (
          <Skeleton className="h-64" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={UserCog} title="Sin empleados" description="Registra al personal de tu panadería." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empleado</TableHead>
                <TableHead>DNI</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead className="text-right">Salario</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-9">
                        <AvatarImage src={e.foto_url ?? undefined} />
                        <AvatarFallback>{e.nombre.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{e.nombre}</p>
                        <p className="text-xs text-muted-foreground">{e.correo ?? "—"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.dni ?? "—"}</TableCell>
                  <TableCell>{e.cargo ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.telefono ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{e.salario ? `S/ ${Number(e.salario).toFixed(2)}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={e.estado ? "default" : "secondary"} className={e.estado ? "bg-emerald-600 hover:bg-emerald-700" : ""}>
                      {e.estado ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      {e.user_id && (
                        <Button variant="ghost" size="icon" title="Gestionar roles" onClick={() => setRolesEmpleado(e)}>
                          <Shield className="size-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setOpenForm(true); }}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(e.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <EmpleadoForm
        open={openForm}
        onOpenChange={(v) => { setOpenForm(v); if (!v) setEditing(null); }}
        empleado={editing}
        onDone={() => qc.invalidateQueries({ queryKey: ["empleados"] })}
      />

      {rolesEmpleado && (
        <RolesDialog
          empleado={rolesEmpleado}
          onClose={() => setRolesEmpleado(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(v) => { if (!v) setDeleteId(null); }}
        title="¿Eliminar empleado?"
        description="Esta acción no se puede deshacer. No afecta a la cuenta de usuario asociada."
        confirmLabel="Eliminar"
        onConfirm={() => deleteId && delMut.mutate(deleteId)}
      />
    </div>
  );
}

function EmpleadoForm({ open, onOpenChange, empleado, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  empleado: Empleado | null;
  onDone: () => void;
}) {
  const form = useForm<FormVals>({
    resolver: zodResolver(schema),
    values: {
      nombre: empleado?.nombre ?? "",
      dni: empleado?.dni ?? "",
      telefono: empleado?.telefono ?? "",
      correo: empleado?.correo ?? "",
      cargo: empleado?.cargo ?? "",
      salario: empleado?.salario ?? 0,
      fecha_ingreso: empleado?.fecha_ingreso ?? "",
      estado: empleado?.estado ?? true,
    },
  });

  const mut = useMutation({
    mutationFn: async (v: FormVals) => {
      const payload = {
        nombre: v.nombre,
        dni: v.dni || null,
        telefono: v.telefono || null,
        correo: v.correo || null,
        cargo: v.cargo || null,
        salario: v.salario || null,
        fecha_ingreso: v.fecha_ingreso || null,
        estado: v.estado,
      };
      if (empleado) {
        const { error } = await supabase.from("empleados").update(payload).eq("id", empleado.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("empleados").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(empleado ? "Empleado actualizado" : "Empleado creado"); onDone(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{empleado ? "Editar empleado" : "Nuevo empleado"}</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="nombre" render={({ field }) => (
              <FormItem><FormLabel>Nombre completo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className="grid grid-cols-2 gap-4">
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
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="cargo" render={({ field }) => (
                <FormItem><FormLabel>Cargo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="salario" render={({ field }) => (
                <FormItem><FormLabel>Salario (S/)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="fecha_ingreso" render={({ field }) => (
                <FormItem><FormLabel>Fecha ingreso</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <FormField control={form.control} name="estado" render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="!mt-0">Activo</FormLabel>
              </FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                {empleado ? "Guardar cambios" : "Crear empleado"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({ empleado, onClose }: { empleado: Empleado; onClose: () => void }) {
  const qc = useQueryClient();
  const userId = empleado.user_id!;

  const rolesQ = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });

  const toggleMut = useMutation({
    mutationFn: async ({ role, enable }: { role: AppRole; enable: boolean }) => {
      if (enable) {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Roles actualizados");
      qc.invalidateQueries({ queryKey: ["user-roles", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const current = rolesQ.data ?? [];

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Shield className="size-5" /> Roles de {empleado.nombre}</DialogTitle>
        </DialogHeader>
        {rolesQ.isLoading ? (
          <Skeleton className="h-32" />
        ) : (
          <div className="space-y-2">
            {ROLES.map((r) => {
              const active = current.includes(r.value);
              return (
                <label key={r.value} className="flex items-center gap-3 p-3 rounded border border-border cursor-pointer hover:bg-muted/50">
                  <Checkbox
                    checked={active}
                    disabled={toggleMut.isPending}
                    onCheckedChange={(v) => toggleMut.mutate({ role: r.value, enable: !!v })}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{r.label}</p>
                  </div>
                  {active && <Badge className="bg-emerald-600 hover:bg-emerald-700">Asignado</Badge>}
                </label>
              );
            })}
            <p className="text-xs text-muted-foreground pt-2">Los cambios se guardan automáticamente. El usuario debe volver a iniciar sesión para que se reflejen.</p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
