import type { AppRole } from "@/hooks/useAuth";

// Mapa de rutas → roles permitidos. Si una ruta no está aquí, es accesible para cualquier autenticado.
export const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/dashboard": ["admin", "supervisor", "cajero", "panadero", "almacen"],
  "/ventas": ["admin", "supervisor", "cajero"],
  "/caja": ["admin", "supervisor", "cajero"],
  "/pedidos": ["admin", "supervisor", "cajero", "panadero"],
  "/clientes": ["admin", "supervisor", "cajero"],
  "/productos": ["admin", "supervisor", "almacen"],
  "/categorias": ["admin", "supervisor", "almacen"],
  "/inventario": ["admin", "supervisor", "almacen"],
  "/produccion": ["admin", "supervisor", "panadero"],
  "/compras": ["admin", "supervisor", "almacen"],
  "/proveedores": ["admin", "supervisor", "almacen"],
  "/empleados": ["admin"],
  "/usuarios": ["admin", "supervisor"],
  "/reportes": ["admin", "supervisor"],
  "/configuracion": ["admin"],
};

export function canAccessRoute(pathname: string, roles: AppRole[]): boolean {
  const allowed = ROUTE_ACCESS[pathname];
  if (!allowed) return true;
  if (roles.includes("admin")) return true;
  return allowed.some((r) => roles.includes(r));
}
