import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, ShoppingCart, Package, AlertTriangle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export const Route = createFileRoute("/_authenticated/reportes")({ component: ReportesPage });

const fmt = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;
const today = new Date();
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const defaultDesde = isoDay(new Date(today.getFullYear(), today.getMonth(), 1));
const defaultHasta = isoDay(today);

function ReportesPage() {
  const [desde, setDesde] = useState(defaultDesde);
  const [hasta, setHasta] = useState(defaultHasta);

  const ventasQ = useQuery({
    queryKey: ["reporte-ventas", desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("id, fecha, total, subtotal, igv, metodo_pago, estado")
        .gte("fecha", `${desde}T00:00:00`)
        .lte("fecha", `${hasta}T23:59:59`)
        .neq("estado", "anulada");
      if (error) throw error;
      return data ?? [];
    },
  });

  const detalleQ = useQuery({
    queryKey: ["reporte-detalle-ventas", desde, hasta],
    queryFn: async () => {
      const ids = (ventasQ.data ?? []).map((v) => v.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("detalle_ventas")
        .select("producto_id, cantidad, subtotal, venta_id")
        .in("venta_id", ids);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!ventasQ.data,
  });

  const productosQ = useQuery({
    queryKey: ["productos-lookup-rep"],
    queryFn: async () => (await supabase.from("productos").select("id, nombre, codigo, stock, stock_minimo, precio_venta").eq("estado", true)).data ?? [],
  });

  const comprasQ = useQuery({
    queryKey: ["reporte-compras", desde, hasta],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("compras")
        .select("id, fecha, total")
        .gte("fecha", `${desde}T00:00:00`)
        .lte("fecha", `${hasta}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const ventas = ventasQ.data ?? [];
    const compras = comprasQ.data ?? [];
    const totalVentas = ventas.reduce((a, v) => a + Number(v.total), 0);
    const totalCompras = compras.reduce((a, c) => a + Number(c.total), 0);
    const igv = ventas.reduce((a, v) => a + Number(v.igv), 0);
    const margen = totalVentas - totalCompras;
    return { totalVentas, totalCompras, igv, margen, nVentas: ventas.length, nCompras: compras.length };
  }, [ventasQ.data, comprasQ.data]);

  const ventasPorDia = useMemo(() => {
    const map = new Map<string, number>();
    (ventasQ.data ?? []).forEach((v) => {
      const d = v.fecha.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(v.total));
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, total]) => ({ fecha: fecha.slice(5), total: Number(total.toFixed(2)) }));
  }, [ventasQ.data]);

  const ventasPorMetodo = useMemo(() => {
    const map = new Map<string, number>();
    (ventasQ.data ?? []).forEach((v) => {
      map.set(v.metodo_pago, (map.get(v.metodo_pago) ?? 0) + Number(v.total));
    });
    return Array.from(map.entries()).map(([metodo, total]) => ({ metodo, total: Number(total.toFixed(2)) }));
  }, [ventasQ.data]);

  const topProductos = useMemo(() => {
    const map = new Map<string, { cantidad: number; total: number }>();
    (detalleQ.data ?? []).forEach((d) => {
      if (!d.producto_id) return;
      const cur = map.get(d.producto_id) ?? { cantidad: 0, total: 0 };
      cur.cantidad += Number(d.cantidad);
      cur.total += Number(d.subtotal);
      map.set(d.producto_id, cur);
    });
    const prods = productosQ.data ?? [];
    return Array.from(map.entries())
      .map(([id, v]) => {
        const p = prods.find((x) => x.id === id);
        return { id, nombre: p?.nombre ?? "—", codigo: p?.codigo ?? "—", cantidad: v.cantidad, total: v.total };
      })
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10);
  }, [detalleQ.data, productosQ.data]);

  const stockBajo = useMemo(() => {
    return (productosQ.data ?? [])
      .filter((p) => Number(p.stock) <= Number(p.stock_minimo))
      .sort((a, b) => Number(a.stock) - Number(b.stock));
  }, [productosQ.data]);

  const COLORS = ["hsl(var(--primary))", "hsl(var(--chart-2, 173 58% 39%))", "hsl(var(--chart-3, 197 37% 24%))", "hsl(var(--chart-4, 43 74% 66%))", "hsl(var(--chart-5, 27 87% 67%))"];

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description="Análisis de ventas, productos e inventario." icon={BarChart3} />

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /><span className="text-sm font-medium">Periodo</span></div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Ventas totales" value={fmt(stats.totalVentas)} sub={`${stats.nVentas} tickets`} accent="emerald" />
        <StatCard icon={ShoppingCart} label="Compras totales" value={fmt(stats.totalCompras)} sub={`${stats.nCompras} órdenes`} accent="blue" />
        <StatCard icon={BarChart3} label="Margen bruto" value={fmt(stats.margen)} sub={stats.totalVentas > 0 ? `${((stats.margen / stats.totalVentas) * 100).toFixed(1)}%` : "—"} accent={stats.margen >= 0 ? "emerald" : "red"} />
        <StatCard icon={Package} label="IGV recaudado" value={fmt(stats.igv)} sub="18%" accent="violet" />
      </div>

      <Tabs defaultValue="ventas">
        <TabsList>
          <TabsTrigger value="ventas">Ventas</TabsTrigger>
          <TabsTrigger value="productos">Top productos</TabsTrigger>
          <TabsTrigger value="stock">Stock bajo</TabsTrigger>
        </TabsList>

        <TabsContent value="ventas" className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Ventas por día</h3>
            {ventasQ.isLoading ? <Skeleton className="h-64" /> : ventasPorDia.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin ventas en el periodo.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="fecha" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Ventas por método de pago</h3>
            {ventasPorMetodo.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin datos.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ventasPorMetodo}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="metodo" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                    {ventasPorMetodo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="productos">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3">Top 10 productos vendidos</h3>
            {detalleQ.isLoading ? <Skeleton className="h-64" /> : topProductos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin ventas en el periodo.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProductos.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-semibold">{i + 1}</TableCell>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell className="text-right font-mono">{p.cantidad}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(p.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="stock">
          <Card className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" /> Productos con stock bajo
            </h3>
            {productosQ.isLoading ? <Skeleton className="h-64" /> : stockBajo.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Todos los productos tienen stock suficiente.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Producto</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead className="text-right">Stock actual</TableHead>
                    <TableHead className="text-right">Stock mínimo</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stockBajo.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.nombre}</TableCell>
                      <TableCell className="font-mono text-xs">{p.codigo}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{Number(p.stock)}</TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">{Number(p.stock_minimo)}</TableCell>
                      <TableCell>
                        <Badge variant={Number(p.stock) === 0 ? "destructive" : "secondary"}>
                          {Number(p.stock) === 0 ? "Agotado" : "Bajo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string;
  accent: "emerald" | "blue" | "violet" | "red";
}) {
  const accents = {
    emerald: "text-emerald-600 bg-emerald-500/10",
    blue: "text-blue-600 bg-blue-500/10",
    violet: "text-violet-600 bg-violet-500/10",
    red: "text-red-600 bg-red-500/10",
  };
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold font-mono mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
        <div className={`size-10 rounded-lg flex items-center justify-center ${accents[accent]}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}
