import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Search, Plus, Minus, Trash2, ShoppingCart, Loader2, Printer, AlertTriangle, Download } from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/ventas")({ component: VentasPage });

const fmt = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

interface CartItem {
  producto_id: string;
  codigo: string;
  nombre: string;
  precio: number;
  cantidad: number;
  stock: number;
}

function VentasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("pos");

  return (
    <div className="space-y-6">
      <PageHeader title="Punto de Venta" description="Registra ventas y consulta el historial" icon={Store} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pos">POS</TabsTrigger>
          <TabsTrigger value="hist">Historial</TabsTrigger>
        </TabsList>
        <TabsContent value="pos" className="mt-4">
          <POS userId={user?.id} onSold={() => { qc.invalidateQueries({ queryKey: ["pos-productos"] }); qc.invalidateQueries({ queryKey: ["ventas-hist"] }); }} />
        </TabsContent>
        <TabsContent value="hist" className="mt-4">
          <Historial />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function POS({ userId, onSold }: { userId?: string; onSold: () => void }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const cajaQ = useQuery({
    queryKey: ["caja-abierta-pos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("caja").select("id").eq("estado", "abierta").order("fecha_apertura", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const cats = useQuery({
    queryKey: ["pos-cats"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("id, nombre").order("nombre");
      return data ?? [];
    },
  });

  const prods = useQuery({
    queryKey: ["pos-productos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("productos").select("id, codigo, nombre, precio_venta, stock, categoria_id, imagen_url").eq("estado", true).order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return (prods.data ?? []).filter((p) => {
      const ms = !q || p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q);
      const mc = catFilter === "all" || p.categoria_id === catFilter;
      return ms && mc;
    });
  }, [prods.data, search, catFilter]);

  function addToCart(p: typeof filtered[number]) {
    setCart((c) => {
      const ex = c.find((i) => i.producto_id === p.id);
      if (ex) {
        if (ex.cantidad + 1 > Number(p.stock)) { toast.error("Sin stock suficiente"); return c; }
        return c.map((i) => i.producto_id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      }
      if (Number(p.stock) <= 0) { toast.error("Producto sin stock"); return c; }
      return [...c, { producto_id: p.id, codigo: p.codigo, nombre: p.nombre, precio: Number(p.precio_venta), cantidad: 1, stock: Number(p.stock) }];
    });
  }
  function setQty(id: string, q: number) {
    setCart((c) => c.map((i) => i.producto_id === id ? { ...i, cantidad: Math.max(1, Math.min(i.stock, q)) } : i));
  }
  function remove(id: string) { setCart((c) => c.filter((i) => i.producto_id !== id)); }

  const subtotal = cart.reduce((a, i) => a + i.precio * i.cantidad, 0);
  const igv = subtotal - subtotal / 1.18;
  const base = subtotal - igv;
  const total = subtotal;

  if (cajaQ.isLoading) return <Skeleton className="h-96" />;
  if (!cajaQ.data) {
    return (
      <Card className="p-8">
        <EmptyState icon={AlertTriangle} title="No hay caja abierta" description="Debes abrir la caja antes de registrar ventas." />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar producto o código..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {prods.isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Store} title="Sin productos" description="No se encontraron productos." />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {filtered.map((p) => {
              const noStock = Number(p.stock) <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  disabled={noStock}
                  className="text-left p-3 rounded-lg border border-border bg-card hover:border-primary hover:shadow-warm transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="aspect-square rounded-md bg-muted mb-2 overflow-hidden flex items-center justify-center">
                    {p.imagen_url ? <img src={p.imagen_url} alt={p.nombre} className="w-full h-full object-cover" /> : <Store className="size-8 text-muted-foreground" />}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">{p.codigo}</p>
                  <p className="font-medium line-clamp-2 text-sm">{p.nombre}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-bold text-primary">{fmt(Number(p.precio_venta))}</span>
                    <Badge variant={noStock ? "destructive" : "secondary"} className="text-xs">Stock: {Number(p.stock)}</Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="p-4 flex flex-col sticky top-4 self-start max-h-[calc(100vh-8rem)]">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart className="size-5 text-primary" />
          <h3 className="font-bold">Carrito ({cart.length})</h3>
          {cart.length > 0 && <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setCart([])}>Vaciar</Button>}
        </div>
        <div className="flex-1 overflow-auto space-y-2 -mx-2 px-2">
          {cart.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Carrito vacío</p>
          ) : (
            cart.map((i) => (
              <div key={i.producto_id} className="flex items-center gap-2 p-2 rounded border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{i.nombre}</p>
                  <p className="text-xs text-muted-foreground">{fmt(i.precio)} c/u</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(i.producto_id, i.cantidad - 1)}><Minus className="size-3" /></Button>
                  <Input className="w-12 h-7 text-center text-sm" value={i.cantidad} onChange={(e) => setQty(i.producto_id, Number(e.target.value) || 1)} />
                  <Button variant="outline" size="icon" className="size-7" onClick={() => setQty(i.producto_id, i.cantidad + 1)}><Plus className="size-3" /></Button>
                </div>
                <p className="w-20 text-right font-mono text-sm">{fmt(i.precio * i.cantidad)}</p>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(i.producto_id)}><Trash2 className="size-3" /></Button>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-border mt-3 pt-3 space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Base</span><span className="font-mono">{fmt(base)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>IGV (18%)</span><span className="font-mono">{fmt(igv)}</span></div>
          <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="font-mono text-primary">{fmt(total)}</span></div>
        </div>
        <Button className="w-full mt-3" size="lg" disabled={cart.length === 0} onClick={() => setCheckoutOpen(true)}>Cobrar</Button>
      </Card>

      <Checkout
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        cart={cart}
        cajaId={cajaQ.data.id}
        userId={userId}
        subtotal={base}
        igv={igv}
        total={total}
        onDone={() => { setCart([]); onSold(); }}
      />
    </div>
  );
}

interface ClienteSel { id: string; nombre: string; apellidos: string | null; dni: string | null; telefono: string | null; }

function Checkout({ open, onOpenChange, cart, cajaId, userId, subtotal, igv, total, onDone }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  cart: CartItem[]; cajaId: string; userId?: string;
  subtotal: number; igv: number; total: number; onDone: () => void;
}) {
  const qc = useQueryClient();
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState<number>(0);
  const [cliente, setCliente] = useState<ClienteSel | null>(null);
  const [dniQuery, setDniQuery] = useState("");
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTel, setNuevoTel] = useState("");
  const [lastTicket, setLastTicket] = useState<{ numero: number; fecha: string } | null>(null);

  const config = useQuery({
    queryKey: ["config-empresa"],
    queryFn: async () => (await supabase.from("configuracion").select("*").eq("id", 1).maybeSingle()).data,
  });

  const buscarCliente = useQuery({
    queryKey: ["cliente-dni", dniQuery],
    enabled: dniQuery.length >= 3,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre, apellidos, dni, telefono")
        .or(`dni.ilike.%${dniQuery}%,nombre.ilike.%${dniQuery}%,apellidos.ilike.%${dniQuery}%`)
        .limit(8);
      return (data ?? []) as ClienteSel[];
    },
  });

  const crearCliente = useMutation({
    mutationFn: async () => {
      if (!nuevoNombre.trim()) throw new Error("El nombre es obligatorio");
      if (!dniQuery.trim() || dniQuery.length < 6) throw new Error("DNI inválido");
      const { data, error } = await supabase.from("clientes").insert({
        nombre: nuevoNombre.trim(),
        dni: dniQuery.trim(),
        telefono: nuevoTel.trim() || null,
      }).select("id, nombre, apellidos, dni, telefono").single();
      if (error) throw error;
      return data as ClienteSel;
    },
    onSuccess: (c) => {
      toast.success("Cliente registrado");
      setCliente(c);
      setNuevoNombre(""); setNuevoTel("");
      qc.invalidateQueries({ queryKey: ["cliente-dni"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const vuelto = metodo === "efectivo" ? Math.max(0, recibido - total) : 0;

  const mut = useMutation({
    mutationFn: async () => {
      const monto_recibido = metodo === "efectivo" ? recibido : total;
      if (metodo === "efectivo" && recibido < total) throw new Error("Monto recibido insuficiente");

      const { data: venta, error: vErr } = await supabase.from("ventas").insert({
        cliente_id: cliente?.id ?? null,
        caja_id: cajaId,
        user_id: userId,
        subtotal,
        igv,
        descuento: 0,
        total,
        metodo_pago: metodo,
        monto_recibido,
        vuelto,
        estado: "completada",
      }).select("id, numero_ticket, fecha").single();
      if (vErr) throw vErr;

      const detalles = cart.map((i) => ({
        venta_id: venta.id,
        producto_id: i.producto_id,
        cantidad: i.cantidad,
        precio_unitario: i.precio,
        subtotal: i.precio * i.cantidad,
      }));
      const { error: dErr } = await supabase.from("detalle_ventas").insert(detalles);
      if (dErr) throw dErr;

      for (const i of cart) {
        const stockAnterior = i.stock;
        const stockNuevo = stockAnterior - i.cantidad;
        await supabase.from("productos").update({ stock: stockNuevo }).eq("id", i.producto_id);
        await supabase.from("movimientos_inventario").insert({
          producto_id: i.producto_id,
          tipo: "salida",
          cantidad: i.cantidad,
          stock_anterior: stockAnterior,
          stock_nuevo: stockNuevo,
          referencia_tipo: "venta",
          referencia_id: venta.id,
          observaciones: `Venta #${venta.numero_ticket}`,
          user_id: userId,
        });
      }
      return venta;
    },
    onSuccess: (v) => {
      toast.success(`Venta #${v.numero_ticket} registrada`);
      setLastTicket({ numero: v.numero_ticket, fecha: v.fecha });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function close() {
    onOpenChange(false);
    if (lastTicket) onDone();
    setLastTicket(null);
    setRecibido(0);
    setMetodo("efectivo");
    setCliente(null);
    setDniQuery("");
    setNuevoNombre(""); setNuevoTel("");
  }

  function imprimir() {
    window.print();
  }

  const noResults = dniQuery.length >= 3 && !buscarCliente.isLoading && (buscarCliente.data ?? []).length === 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-lg print:hidden">
        <DialogHeader><DialogTitle>{lastTicket ? `Boleta #${lastTicket.numero}` : "Cobrar venta"}</DialogTitle></DialogHeader>
        {lastTicket ? (
          <div className="space-y-3 text-center py-4">
            <div className="size-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">✓</div>
            <p className="font-semibold">Venta completada</p>
            <p className="text-3xl font-bold text-primary">{fmt(total)}</p>
            {metodo === "efectivo" && <p className="text-sm">Vuelto: <strong>{fmt(vuelto)}</strong></p>}
            <DialogFooter className="sm:justify-center">
              <Button variant="outline" onClick={imprimir}><Printer className="size-4" /> Imprimir boleta</Button>
              <Button onClick={close}>Nueva venta</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded bg-muted flex items-center justify-between">
              <span className="text-sm">Total a cobrar</span>
              <span className="text-2xl font-bold text-primary">{fmt(total)}</span>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Cliente (buscar por DNI o nombre)</label>
              {cliente ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded border border-border bg-muted/30">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{cliente.nombre} {cliente.apellidos ?? ""}</p>
                    <p className="text-xs text-muted-foreground">DNI: {cliente.dni ?? "—"} {cliente.telefono ? `· ${cliente.telefono}` : ""}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setCliente(null); setDniQuery(""); }}>Cambiar</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="DNI o nombre... (vacío = cliente general)"
                      value={dniQuery}
                      onChange={(e) => setDniQuery(e.target.value)}
                      maxLength={50}
                    />
                  </div>
                  {dniQuery.length >= 3 && (buscarCliente.data ?? []).length > 0 && (
                    <div className="max-h-40 overflow-auto border border-border rounded divide-y divide-border">
                      {(buscarCliente.data ?? []).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCliente(c); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{c.nombre} {c.apellidos ?? ""}</span>
                          <span className="text-xs text-muted-foreground ml-2">DNI: {c.dni ?? "—"}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {noResults && (
                    <div className="border border-dashed border-border rounded p-3 space-y-2">
                      <p className="text-xs text-muted-foreground">No se encontró. Registrar cliente nuevo:</p>
                      <Input placeholder="Nombre completo *" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} maxLength={100} />
                      <Input placeholder="Teléfono (opcional)" value={nuevoTel} onChange={(e) => setNuevoTel(e.target.value)} maxLength={20} />
                      <Button size="sm" className="w-full" onClick={() => crearCliente.mutate()} disabled={crearCliente.isPending}>
                        {crearCliente.isPending && <Loader2 className="size-3 animate-spin" />} Registrar DNI {dniQuery}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Método de pago</label>
              <Select value={metodo} onValueChange={setMetodo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="yape">Yape</SelectItem>
                  <SelectItem value="plin">Plin</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {metodo === "efectivo" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Monto recibido</label>
                <Input type="number" step="0.01" value={recibido || ""} onChange={(e) => setRecibido(Number(e.target.value) || 0)} />
                <div className="flex gap-1 flex-wrap">
                  {[total, Math.ceil(total / 10) * 10, Math.ceil(total / 20) * 20, Math.ceil(total / 50) * 50, 100, 200].filter((v, i, a) => a.indexOf(v) === i && v >= total).slice(0, 5).map((v) => (
                    <Button key={v} variant="outline" size="sm" onClick={() => setRecibido(v)}>{fmt(v)}</Button>
                  ))}
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-sm text-muted-foreground">Vuelto</span>
                  <span className="font-bold text-lg">{fmt(vuelto)}</span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={close}>Cancelar</Button>
              <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
                {mut.isPending && <Loader2 className="size-4 animate-spin" />} Confirmar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>

      {lastTicket && (
        <BoletaPrint
          numero={lastTicket.numero}
          fecha={lastTicket.fecha}
          empresa={config.data}
          cliente={cliente}
          items={cart}
          subtotal={subtotal}
          igv={igv}
          total={total}
          metodo={metodo}
          recibido={metodo === "efectivo" ? recibido : total}
          vuelto={vuelto}
        />
      )}
    </Dialog>
  );
}

function BoletaPrint({ numero, fecha, empresa, cliente, items, subtotal, igv, total, metodo, recibido, vuelto }: {
  numero: number; fecha: string;
  empresa: { nombre_empresa?: string; ruc?: string | null; direccion?: string | null; telefono?: string | null } | null | undefined;
  cliente: ClienteSel | null;
  items: CartItem[];
  subtotal: number; igv: number; total: number;
  metodo: string; recibido: number; vuelto: number;
}) {
  return (
    <div className="boleta-print hidden print:block text-[12px] font-mono">
      <div className="text-center mb-3">
        <p className="font-bold text-base uppercase">{empresa?.nombre_empresa ?? "PANIFICADORA"}</p>
        {empresa?.ruc && <p>RUC: {empresa.ruc}</p>}
        {empresa?.direccion && <p>{empresa.direccion}</p>}
        {empresa?.telefono && <p>Tel: {empresa.telefono}</p>}
        <p className="mt-2 font-bold">BOLETA DE VENTA</p>
        <p>N° {String(numero).padStart(8, "0")}</p>
      </div>
      <div className="border-t border-b border-black py-1 mb-2">
        <p>Fecha: {new Date(fecha).toLocaleString("es-PE")}</p>
        <p>Cliente: {cliente ? `${cliente.nombre} ${cliente.apellidos ?? ""}` : "Cliente general"}</p>
        {cliente?.dni && <p>DNI: {cliente.dni}</p>}
      </div>
      <table className="w-full mb-2">
        <thead>
          <tr className="border-b border-black">
            <th className="text-left">Cant</th>
            <th className="text-left">Descripción</th>
            <th className="text-right">P.U.</th>
            <th className="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.producto_id}>
              <td>{i.cantidad}</td>
              <td>{i.nombre}</td>
              <td className="text-right">{i.precio.toFixed(2)}</td>
              <td className="text-right">{(i.precio * i.cantidad).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-black pt-1 space-y-0.5">
        <div className="flex justify-between"><span>Subtotal:</span><span>S/ {subtotal.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>IGV (18%):</span><span>S/ {igv.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-sm border-t border-black pt-1"><span>TOTAL:</span><span>S/ {total.toFixed(2)}</span></div>
        <div className="flex justify-between mt-2"><span>Pago ({metodo}):</span><span>S/ {recibido.toFixed(2)}</span></div>
        {metodo === "efectivo" && <div className="flex justify-between"><span>Vuelto:</span><span>S/ {vuelto.toFixed(2)}</span></div>}
      </div>
      <p className="text-center mt-4">¡Gracias por su compra!</p>
    </div>
  );
}

function Historial() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [desde, setDesde] = useState(monthAgo);
  const [hasta, setHasta] = useState(today);
  const [clienteQ, setClienteQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["ventas-hist", desde, hasta, clienteQ],
    queryFn: async () => {
      let clienteIds: string[] | null = null;
      if (clienteQ.trim().length >= 2) {
        const q = clienteQ.trim();
        const { data: cs } = await supabase
          .from("clientes")
          .select("id")
          .or(`dni.ilike.%${q}%,nombre.ilike.%${q}%,apellidos.ilike.%${q}%`);
        clienteIds = (cs ?? []).map((c) => c.id);
        if (clienteIds.length === 0) return [];
      }

      let query = supabase
        .from("ventas")
        .select("id, numero_ticket, fecha, subtotal, igv, total, metodo_pago, estado, cliente_id, clientes(nombre, apellidos, dni)")
        .gte("fecha", `${desde}T00:00:00`)
        .lte("fecha", `${hasta}T23:59:59`)
        .order("fecha", { ascending: false })
        .limit(1000);
      if (clienteIds) query = query.in("cliente_id", clienteIds);

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totales = useMemo(() => {
    const list = data ?? [];
    return {
      count: list.length,
      total: list.reduce((a, v) => a + Number(v.total || 0), 0),
    };
  }, [data]);

  async function exportarExcel() {
    if (!data || data.length === 0) { toast.error("No hay ventas para exportar"); return; }
    setExporting(true);
    try {
      const ids = data.map((v) => v.id);
      const { data: detalles, error } = await supabase
        .from("detalle_ventas")
        .select("venta_id, cantidad, precio_unitario, subtotal, productos(codigo, nombre)")
        .in("venta_id", ids);
      if (error) throw error;

      const ventasRows = data.map((v) => {
        const c = (v as any).clientes;
        return {
          "Ticket": v.numero_ticket,
          "Fecha": new Date(v.fecha).toLocaleString("es-PE"),
          "Cliente": c ? `${c.nombre} ${c.apellidos ?? ""}`.trim() : "Cliente general",
          "DNI": c?.dni ?? "",
          "Método pago": v.metodo_pago,
          "Estado": v.estado,
          "Subtotal": Number(v.subtotal),
          "IGV": Number(v.igv),
          "Total": Number(v.total),
        };
      });
      ventasRows.push({
        "Ticket": "" as any, "Fecha": "", "Cliente": "TOTALES", "DNI": "", "Método pago": "", "Estado": "",
        "Subtotal": ventasRows.reduce((a, r) => a + Number(r["Subtotal"] || 0), 0),
        "IGV": ventasRows.reduce((a, r) => a + Number(r["IGV"] || 0), 0),
        "Total": ventasRows.reduce((a, r) => a + Number(r["Total"] || 0), 0),
      });

      const ventasMap = new Map(data.map((v) => [v.id, v]));
      const detalleRows = (detalles ?? []).map((d) => {
        const v = ventasMap.get(d.venta_id);
        const p = (d as any).productos;
        return {
          "Ticket": v?.numero_ticket ?? "",
          "Fecha": v ? new Date(v.fecha).toLocaleString("es-PE") : "",
          "Código": p?.codigo ?? "",
          "Producto": p?.nombre ?? "",
          "Cantidad": Number(d.cantidad),
          "P. Unitario": Number(d.precio_unitario),
          "Subtotal": Number(d.subtotal),
        };
      });

      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(ventasRows);
      const ws2 = XLSX.utils.json_to_sheet(detalleRows);
      ws1["!cols"] = [{ wch: 10 }, { wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
      ws2["!cols"] = [{ wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws1, "Ventas");
      XLSX.utils.book_append_sheet(wb, ws2, "Detalle");
      XLSX.writeFile(wb, `ventas_${desde}_a_${hasta}.xlsx`);
      toast.success(`Exportadas ${data.length} ventas`);
    } catch (e: any) {
      toast.error(e.message ?? "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-col md:flex-row gap-2 md:items-end">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hasta</label>
            <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium text-muted-foreground">Cliente (DNI o nombre)</label>
            <div className="relative">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Filtrar por DNI o nombre..." value={clienteQ} onChange={(e) => setClienteQ(e.target.value)} />
            </div>
          </div>
          <Button onClick={exportarExcel} disabled={exporting || !data || data.length === 0} className="gap-1">
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Exportar Excel
          </Button>
        </div>
        <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
          <span><strong className="text-foreground">{totales.count}</strong> ventas</span>
          <span>Total: <strong className="text-primary">{fmt(totales.total)}</strong></span>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (data ?? []).length === 0 ? (
        <Card className="p-8"><EmptyState icon={Store} title="Sin ventas" description="No hay ventas en este rango/filtro." /></Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ticket</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((v) => {
                const c = (v as any).clientes;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono">#{v.numero_ticket}</TableCell>
                    <TableCell className="text-xs">{new Date(v.fecha).toLocaleString("es-PE")}</TableCell>
                    <TableCell className="text-sm">{c ? `${c.nombre} ${c.apellidos ?? ""}` : <span className="text-muted-foreground">Cliente general</span>}{c?.dni && <span className="text-xs text-muted-foreground ml-1">({c.dni})</span>}</TableCell>
                    <TableCell><Badge variant="outline">{v.metodo_pago}</Badge></TableCell>
                    <TableCell><Badge variant={v.estado === "completada" ? "default" : "secondary"}>{v.estado}</Badge></TableCell>
                    <TableCell className="text-right font-mono font-semibold">{fmt(Number(v.total))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
