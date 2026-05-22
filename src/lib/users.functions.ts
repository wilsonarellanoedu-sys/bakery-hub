import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ROLES = ["admin", "supervisor", "cajero", "panadero", "almacen"] as const;

async function assertManager(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.includes("admin") && !roles.includes("supervisor")) {
    throw new Error("No autorizado: solo admin o supervisor pueden gestionar usuarios");
  }
  return roles as string[];
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      email: z.string().email().max(255),
      password: z.string().min(6).max(72),
      nombre: z.string().min(1).max(100),
      apellidos: z.string().max(100).optional().default(""),
      telefono: z.string().max(30).optional().default(""),
      role: z.enum(ROLES),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nombre: data.nombre },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Error al crear usuario");

    const uid = created.user.id;

    // Profile is auto-created by trigger; update extras
    await supabaseAdmin
      .from("profiles")
      .update({ nombre: data.nombre, apellidos: data.apellidos, telefono: data.telefono })
      .eq("id", uid);

    // Replace default role assigned by trigger with requested role
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: data.role });
    if (rErr) throw new Error(rErr.message);

    return { id: uid };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      nombre: z.string().min(1).max(100).optional(),
      apellidos: z.string().max(100).optional(),
      telefono: z.string().max(30).optional(),
      password: z.string().min(6).max(72).optional().or(z.literal("")),
      role: z.enum(ROLES).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);

    const profileUpdate: { nombre?: string; apellidos?: string; telefono?: string } = {};
    if (data.nombre !== undefined) profileUpdate.nombre = data.nombre;
    if (data.apellidos !== undefined) profileUpdate.apellidos = data.apellidos;
    if (data.telefono !== undefined) profileUpdate.telefono = data.telefono;
    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", data.userId);
    }

    if (data.password && data.password.length >= 6) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.password,
      });
      if (error) throw new Error(error.message);
    }

    if (data.role) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role });
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    if (data.userId === context.userId) {
      throw new Error("No puedes eliminar tu propio usuario");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsersWithEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertManager(context.supabase, context.userId);

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,nombre,apellidos,telefono,created_at")
      .order("created_at", { ascending: false });

    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id,role");

    const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailById = new Map<string, string>();
    (authUsers?.users ?? []).forEach((u) => emailById.set(u.id, u.email ?? ""));

    const rolesByUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    });

    return (profiles ?? []).map((p: any) => ({
      ...p,
      email: emailById.get(p.id) ?? "",
      roles: rolesByUser.get(p.id) ?? [],
    }));
  });
