import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users2, Shield, Loader2, Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { DataToolbar } from "@/components/DataToolbar";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  createUser, updateUser, deleteUser, listUsersWithEmail,
} from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/usuarios")({ component: UsuariosPage });

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "cajero", label: "Cajero" },
  { value: "panadero", label: "Panadero" },
  { value: "almacen", label: "Almacén" },
];

type UserRow = {
  id: string;
  nombre: string | null;
  apellidos: string | null;
  telefono: string | null;
  email: string;
  roles: AppRole[];
};

function UsuariosPage() {
  const qc = useQueryClient();
  const { isAdmin, hasRole, user: me } = useAuth();
  const canManage = isAdmin || hasRole("supervisor");
  const [search, setSearch] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);

  const listFn = useServerFn(listUsersWithEmail);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const deleteFn = useServerFn(deleteUser);

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ["usuarios-admin"],
    queryFn: () => listFn() as Promise<UserRow[]>,
  });

  const createMut = useMutation({
    mutationFn: (data: any) => createFn({ data }),
    onSuccess: () => {
      toast.success("Usuario creado");
      setOpenCreate(false);
      qc.invalidateQueries({ queryKey: ["usuarios-admin"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al crear"),
  });

  const updateMut = useMutation({
    mutationFn: (data: any) => updateFn({ data }),
    onSuccess: () => {
      toast.success("Usuario actualizado");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["usuarios-admin"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al actualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("Usuario eliminado");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["usuarios-admin"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Error al eliminar"),
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return usuarios.filter(
      (u) =>
        (u.nombre ?? "").toLowerCase().includes(q) ||
        (u.apellidos ?? "").toLowerCase().includes(q) ||
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.telefono ?? "").toLowerCase().includes(q),
    );
  }, [usuarios, search]);

  return (
    <div className="space-y-6">
      <PageHeader title="Usuarios" description="Crea usuarios del sistema y asigna sus roles" icon={Users2} />

      {!canManage && (
        <Card className="p-4 text-sm text-muted-foreground">
          Solo administradores y supervisores pueden gestionar usuarios.
        </Card>
      )}

      <DataToolbar search={search} onSearch={setSearch} placeholder="Buscar por nombre, correo o teléfono...">
        {canManage && (
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="gap-1"><Plus className="size-4" /> Nuevo usuario</Button>
            </DialogTrigger>
            <UserFormDialog
              title="Crear usuario"
              submitLabel="Crear"
              pending={createMut.isPending}
              onSubmit={(v) => createMut.mutate(v)}
              requirePassword
              requireEmail
            />
          </Dialog>
        )}
      </DataToolbar>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Users2} title="Sin usuarios" description="No se encontraron usuarios." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const initials = `${u.nombre?.[0] ?? "?"}${u.apellidos?.[0] ?? ""}`.toUpperCase();
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8"><AvatarFallback>{initials}</AvatarFallback></Avatar>
                        <div className="font-medium">{u.nombre ?? "—"} {u.apellidos ?? ""}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email || "—"}</TableCell>
                    <TableCell className="text-sm">{u.telefono ?? "—"}</TableCell>
                    <TableCell>
                      {u.roles.length === 0 ? (
                        <Badge variant="outline" className="text-xs">Sin rol</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Shield className="size-3" /> {u.roles[0]}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      {canManage && (
                        <>
                          <Dialog open={editing?.id === u.id} onOpenChange={(o) => !o && setEditing(null)}>
                            <DialogTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => setEditing(u)}>
                                <Pencil className="size-4" />
                              </Button>
                            </DialogTrigger>
                            {editing?.id === u.id && (
                              <UserFormDialog
                                title="Editar usuario"
                                submitLabel="Guardar"
                                pending={updateMut.isPending}
                                initial={{
                                  nombre: u.nombre ?? "",
                                  apellidos: u.apellidos ?? "",
                                  telefono: u.telefono ?? "",
                                  email: u.email,
                                  role: (u.roles[0] ?? "cajero") as AppRole,
                                }}
                                onSubmit={(v) => updateMut.mutate({
                                  userId: u.id,
                                  nombre: v.nombre,
                                  apellidos: v.apellidos,
                                  telefono: v.telefono,
                                  role: v.role,
                                  ...(v.password ? { password: v.password } : {}),
                                })}
                              />
                            )}
                          </Dialog>
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={u.id === me?.id}
                            onClick={() => setDeleting(u)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará {deleting?.nombre} {deleting?.apellidos} ({deleting?.email}). Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMut.isPending}
              onClick={() => deleting && deleteMut.mutate(deleting.id)}
            >
              {deleteMut.isPending ? <Loader2 className="size-4 animate-spin" /> : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type FormValues = {
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
  telefono: string;
  role: AppRole;
};

function UserFormDialog({
  title, submitLabel, pending, onSubmit, initial, requirePassword, requireEmail,
}: {
  title: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (v: FormValues) => void;
  initial?: Partial<FormValues>;
  requirePassword?: boolean;
  requireEmail?: boolean;
}) {
  const [v, setV] = useState<FormValues>({
    email: initial?.email ?? "",
    password: "",
    nombre: initial?.nombre ?? "",
    apellidos: initial?.apellidos ?? "",
    telefono: initial?.telefono ?? "",
    role: initial?.role ?? "cajero",
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!v.nombre.trim()) return toast.error("Nombre requerido");
          if (requireEmail && !v.email.trim()) return toast.error("Correo requerido");
          if (requirePassword && v.password.length < 6) return toast.error("Contraseña mín. 6 caracteres");
          onSubmit(v);
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Nombre *</Label>
            <Input value={v.nombre} onChange={(e) => setV({ ...v, nombre: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Apellidos</Label>
            <Input value={v.apellidos} onChange={(e) => setV({ ...v, apellidos: e.target.value })} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Correo {requireEmail && "*"}</Label>
          <Input
            type="email"
            value={v.email}
            disabled={!requireEmail}
            onChange={(e) => setV({ ...v, email: e.target.value })}
          />
          {!requireEmail && <p className="text-xs text-muted-foreground">El correo no se puede modificar.</p>}
        </div>
        <div className="space-y-1">
          <Label>Contraseña {requirePassword ? "*" : "(dejar vacío para no cambiar)"}</Label>
          <Input
            type="password"
            value={v.password}
            onChange={(e) => setV({ ...v, password: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Teléfono</Label>
            <Input value={v.telefono} onChange={(e) => setV({ ...v, telefono: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Rol *</Label>
            <Select value={v.role} onValueChange={(r) => setV({ ...v, role: r as AppRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : submitLabel}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
