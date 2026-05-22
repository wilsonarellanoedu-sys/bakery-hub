import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  ShoppingBag,
  Package,
  Users,
  AlertTriangle,
  ChefHat,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { KpiCard } from "@/components/KpiCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const PEN = (n: number) => `S/ ${n.toFixed(2)}`;

function Dashboard() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);

      const [
        ventasHoy,
        ventasMes,
        pedidosPend,
        clientesTotal,
        productosLow,
        produccionHoy,
        ventasWeek,
        topProds,
        ultimasVentas,
      ] = await Promise.all([
        supabase.from("ventas").select("total").gte("fecha", today.toISOString()).eq("estado", "completada"),
        supabase.from("ventas").select("total").gte("fecha", monthStart.toISOString()).eq("estado", "completada"),
        supabase.from("pedidos").select("id", { count: "exact", head: true }).in("estado", ["pendiente", "preparando"]),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
        supabase.from("productos").select("id, nombre, stock, stock_minimo").eq("estado", true),
        supabase.from("produccion").select("cantidad_producida").gte("fecha_programada", today.toISOString().slice(0, 10)),
        supabase.from("ventas").select("fecha, total").gte("fecha", weekStart.toISOString()).eq("estado", "completada"),
        supabase
          .from("detalle_ventas")
          .select("cantidad, subtotal, productos(nombre)")
          .limit(100)
          .order("id", { ascending: false }),
        supabase
          .from("ventas")
          .select("id, numero_ticket, total, metodo_pago, fecha, clientes(nombre)")
          .order("fecha", { ascending: false })
          .limit(5),
      ]);

      const sumVentasHoy = (ventasHoy.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const sumVentasMes = (ventasMes.data ?? []).reduce((s, r) => s + Number(r.total), 0);
      const produccionDia = (produccionHoy.data ?? []).reduce((s, r) => s + Number(r.cantidad_producida), 0);
      const stockBajo = (productosLow.data ?? []).filter((p) => Number(p.stock) <= Number(p.stock_minimo));

      // Build week chart (7 days)
      const dias: { dia: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const label = d.toLocaleDateString("es-PE", { weekday: "short" });
        const dayStr = d.toISOString().slice(0, 10);
        const total = (ventasWeek.data ?? [])
          .filter((v) => v.fecha?.startsWith(dayStr))
          .reduce((s, r) => s + Number(r.total), 0);
        dias.push({ dia: label, total });
      }

      // Top productos
      const topMap = new Map<string, { nombre: string; cantidad: number; total: number }>();
      for (const r of topProds.data ?? []) {
        const nom = (r.productos as { nombre?: string } | null)?.nombre ?? "—";
        const cur = topMap.get(nom) ?? { nombre: nom, cantidad: 0, total: 0 };
        cur.cantidad += Number(r.cantidad);
        cur.total += Number(r.subtotal);
        topMap.set(nom, cur);
      }
      const top = Array.from(topMap.values())
        .sort((a, b) => b.cantidad - a.cantidad)
        .slice(0, 5);

      return {
        sumVentasHoy,
        sumVentasMes,
        pedidosPendientes: pedidosPend.count ?? 0,
        clientesTotal: clientesTotal.count ?? 0,
        productosAgotados: stockBajo.length,
        produccionDia,
        dias,
        top,
        stockBajo: stockBajo.slice(0, 5),
        ultimasVentas: ultimasVentas.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bienvenido{user?.email ? `, ${user.email}` : ""}. Resumen del día.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {new Date().toLocaleDateString("es-PE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Ventas hoy"
          value={PEN(data?.sumVentasHoy ?? 0)}
          icon={Wallet}
          variant="warm"
          loading={isLoading}
        />
        <KpiCard title="Ventas del mes" value={PEN(data?.sumVentasMes ?? 0)} icon={TrendingUp} loading={isLoading} />
        <KpiCard title="Pedidos pendientes" value={data?.pedidosPendientes ?? 0} icon={ShoppingBag} loading={isLoading} />
        <KpiCard title="Clientes" value={data?.clientesTotal ?? 0} icon={Users} loading={isLoading} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          title="Producción del día"
          value={data?.produccionDia ?? 0}
          hint="unidades producidas"
          icon={ChefHat}
          loading={isLoading}
        />
        <KpiCard
          title="Productos en stock bajo"
          value={data?.productosAgotados ?? 0}
          icon={AlertTriangle}
          variant={(data?.productosAgotados ?? 0) > 0 ? "warning" : "default"}
          loading={isLoading}
        />
        <KpiCard
          title="Productos activos"
          value="—"
          icon={Package}
          hint="ver módulo productos"
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader>
            <CardTitle>Ventas de los últimos 7 días</CardTitle>
            <CardDescription>Tendencia diaria en soles</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dias ?? []}>
                <defs>
                  <linearGradient id="warmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" stroke="var(--muted-foreground)" fontSize={12} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--popover-foreground)",
                  }}
                  formatter={(v: number) => PEN(v)}
                />
                <Area type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} fill="url(#warmGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Top productos</CardTitle>
            <CardDescription>Más vendidos</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {data?.top?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.top} layout="vertical" margin={{ left: 8, right: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="nombre" stroke="var(--muted-foreground)" fontSize={11} width={90} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                  <Bar dataKey="cantidad" fill="var(--primary)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Sin datos de ventas aún
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Últimas ventas</CardTitle>
            <CardDescription>Movimientos recientes</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.ultimasVentas?.length ? (
              <ul className="divide-y divide-border">
                {data.ultimasVentas.map((v) => (
                  <li key={v.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        #{v.numero_ticket} — {(v.clientes as { nombre?: string } | null)?.nombre ?? "Cliente general"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(v.fecha).toLocaleString("es-PE")} · {v.metodo_pago}
                      </p>
                    </div>
                    <span className="font-semibold text-primary">{PEN(Number(v.total))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Aún no hay ventas registradas.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning" />
              Alertas de stock
            </CardTitle>
            <CardDescription>Productos por debajo del mínimo</CardDescription>
          </CardHeader>
          <CardContent>
            {data?.stockBajo?.length ? (
              <ul className="divide-y divide-border">
                {data.stockBajo.map((p) => (
                  <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{p.nombre}</span>
                    <Badge variant="destructive">
                      {Number(p.stock)} / mín {Number(p.stock_minimo)}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Todo el stock está en orden.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
