import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  Boxes,
  Truck,
  ShoppingCart,
  ChefHat,
  Wallet,
  UserCog,
  ClipboardList,
  BarChart3,
  Settings,
  Store,
  Croissant,
  Tag,
  LogOut,
  Users2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[]; // if omitted: any authenticated user
};

const operacion: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Punto de venta", url: "/ventas", icon: Store, roles: ["admin", "cajero", "supervisor"] },
  { title: "Caja", url: "/caja", icon: Wallet, roles: ["admin", "cajero", "supervisor"] },
  { title: "Pedidos", url: "/pedidos", icon: ClipboardList, roles: ["admin", "cajero", "supervisor", "panadero"] },
];

const gestion: NavItem[] = [
  { title: "Clientes", url: "/clientes", icon: Users, roles: ["admin", "cajero", "supervisor"] },
  { title: "Productos", url: "/productos", icon: Package, roles: ["admin", "almacen", "supervisor"] },
  { title: "Categorías", url: "/categorias", icon: Tag, roles: ["admin", "almacen"] },
  { title: "Inventario", url: "/inventario", icon: Boxes, roles: ["admin", "almacen", "supervisor"] },
  { title: "Producción", url: "/produccion", icon: ChefHat, roles: ["admin", "panadero", "supervisor"] },
  { title: "Categorías", url: "/categorias", icon: Tag, roles: ["admin", "almacen", "supervisor"] },
  { title: "Compras", url: "/compras", icon: ShoppingCart, roles: ["admin", "almacen", "supervisor"] },
  { title: "Proveedores", url: "/proveedores", icon: Truck, roles: ["admin", "almacen", "supervisor"] },
];

const administracion: NavItem[] = [
  { title: "Empleados", url: "/empleados", icon: UserCog, roles: ["admin"] },
  { title: "Usuarios", url: "/usuarios", icon: Users2, roles: ["admin", "supervisor"] },
  { title: "Reportes", url: "/reportes", icon: BarChart3, roles: ["admin", "supervisor"] },
  { title: "Configuración", url: "/configuracion", icon: Settings, roles: ["admin"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut, roles, isAdmin } = useAuth();

  const visible = (items: NavItem[]) =>
    items.filter((it) => !it.roles || isAdmin || it.roles.some((r) => roles.includes(r)));

  const renderGroup = (label: string, items: NavItem[]) => {
    const list = visible(items);
    if (list.length === 0) return null;
    return (
      <SidebarGroup>
        {!collapsed && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
        <SidebarGroupContent>
          <SidebarMenu>
            {list.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={pathname === item.url} tooltip={item.title}>
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="size-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="size-9 rounded-lg bg-gradient-warm shadow-warm flex items-center justify-center shrink-0">
            <Croissant className="size-5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-sidebar-foreground text-sm">PANIFICADORA</span>
              <span className="text-xs text-sidebar-foreground/60">ERP Sistema</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Operación", operacion)}
        {renderGroup("Gestión", gestion)}
        {renderGroup("Administración", administracion)}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && user && (
          <div className="px-2 py-2 text-xs text-sidebar-foreground/70 truncate">
            {user.email}
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
          {!collapsed && "Cerrar sesión"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
