import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wallet, Loader2, ArrowUp, ArrowDown, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/caja")({ component: CajaPage });

const fmt = (n: number) => `S/ ${Number(n || 0).toFixed(2)}`;

function CajaPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openAbrir, setOpenAbrir] = useState(false);
  const [openCerrar, setOpenCerrar] = useState(false);
  const [openMov, setOpenMov] = useState(false);

  const cajaQ = useQuery({
    queryKey: ["caja-abierta", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caja")
        .select("*")
        .eq("estado", "abierta")
        .order("fecha_apertura", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const histQ = useQuery({
    queryKey: ["caja-historial"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caja")
        .select("*")
        .order("fecha_apertura", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const movQ = useQuery({
    queryKey: ["caja-mov", cajaQ.data?.id],
    enabled: !!cajaQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimientos_caja")
        .select("*")
        .eq("caja_id", cajaQ.data!.id)
        .order("fecha", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const ventasQ = useQuery({
    queryKey: ["caja-ventas", cajaQ.data?.id],
    enabled: !!cajaQ.data?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas")
        .select("total, metodo_pago")
        .eq("caja_id", cajaQ.data!.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalVentas = (ventasQ.data ?? []).reduce((a, v) => a + Number(v.total), 0);
  const ingresos = (movQ.data ?? []).filter((m) => m.tipo === "ingreso").reduce((a, m) => a + Number(m.monto), 0);
  const egresos = (movQ.data ?? []).filter((m) => m.tipo === "egreso").reduce((a, m) => a + Number(m.monto), 0);
  const efectivoEsperado = Number(cajaQ.data?.monto_apertura ?? 0) + totalVentas + ingresos - egresos;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Caja"
        description="Control de apertura, movimientos y cierre"
        icon={Wallet}
        actions={
          cajaQ.data ? (
            <>
              <Button variant="outline" onClick={() => setOpenMov(true)}>Movimiento</Button>
              <Button variant="destructive" onClick={() => setOpenCerrar(true)}>
                <Lock className="size-4" /> Cerrar caja
              </Button>
            </>
          ) : (
            <Button onClick={() => setOpenAbrir(true)}>
              <Unlock className="size-4" /> Abrir caja
            </Button>
          )
        }
      />

      {cajaQ.isLoading ? (
        <Skeleton className="h-32" />
      ) : !cajaQ.data ? (
        <EmptyState icon={Wallet} title="No hay caja abierta" description="Abre la caja para empezar a registrar ventas y movimientos." />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Apertura</p>
              <p className="text-2xl font-bold">{fmt(Number(cajaQ.data.monto_apertura))}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Ventas</p>
              <p className="text-2xl font-bold text-primary">{fmt(totalVentas)}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Ingresos / Egresos</p>
              <p className="text-lg font-semibold"><span className="text-emerald-600">+{fmt(ingresos)}</span> / <span className="text-destructive">-{fmt(egresos)}</span></p>
            </Card>
            <Card className="p-4 bg-gradient-warm text-primary-foreground">
              <p className="text-xs opacity-90">Efectivo esperado</p>
              <p className="text-2xl font-bold">{fmt(efectivoEsperado)}</p>
            </Card>
          </div>

          <Card className="p-0 overflow-hidden">
            <Tabs defaultValue="mov">
              <TabsList className="m-2">
                <TabsTrigger value="mov">Movimientos</TabsTrigger>
                <TabsTrigger value="hist">Historial</TabsTrigger>
              </TabsList>
              <TabsContent value="mov" className="m-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Concepto</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(movQ.data ?? []).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{new Date(m.fecha).toLocaleString("es-PE")}</TableCell>
                        <TableCell>
                          <Badge variant={m.tipo === "ingreso" ? "default" : "destructive"} className="gap-1">
                            {m.tipo === "ingreso" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                            {m.tipo}
                          </Badge>
                        </TableCell>
                        <TableCell>{m.concepto}</TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(m.monto))}</TableCell>
                      </TableRow>
                    ))}
                    {(movQ.data ?? []).length === 0 && (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sin movimientos</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
              <TabsContent value="hist" className="m-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apertura</TableHead>
                      <TableHead>Cierre</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Monto apertura</TableHead>
                      <TableHead className="text-right">Monto cierre</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(histQ.data ?? []).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{new Date(c.fecha_apertura).toLocaleString("es-PE")}</TableCell>
                        <TableCell className="text-xs">{c.fecha_cierre ? new Date(c.fecha_cierre).toLocaleString("es-PE") : "-"}</TableCell>
                        <TableCell><Badge variant={c.estado === "abierta" ? "default" : "secondary"}>{c.estado}</Badge></TableCell>
                        <TableCell className="text-right font-mono">{fmt(Number(c.monto_apertura))}</TableCell>
                        <TableCell className="text-right font-mono">{c.monto_cierre != null ? fmt(Number(c.monto_cierre)) : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </Card>
        </>
      )}

      <AbrirDialog open={openAbrir} onOpenChange={setOpenAbrir} userId={user?.id} onDone={() => qc.invalidateQueries({ queryKey: ["caja-abierta"] })} />
      {cajaQ.data && (
        <>
          <CerrarDialog open={openCerrar} onOpenChange={setOpenCerrar} caja={cajaQ.data} esperado={efectivoEsperado} onDone={() => { qc.invalidateQueries({ queryKey: ["caja-abierta"] }); qc.invalidateQueries({ queryKey: ["caja-historial"] }); }} />
          <MovDialog open={openMov} onOpenChange={setOpenMov} cajaId={cajaQ.data.id} userId={user?.id} onDone={() => qc.invalidateQueries({ queryKey: ["caja-mov", cajaQ.data!.id] })} />
        </>
      )}
    </div>
  );
}

const abrirSchema = z.object({ monto_apertura: z.coerce.number().min(0), observaciones: z.string().max(300).optional().or(z.literal("")) });
function AbrirDialog({ open, onOpenChange, userId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; userId?: string; onDone: () => void }) {
  const form = useForm<z.infer<typeof abrirSchema>>({ resolver: zodResolver(abrirSchema), defaultValues: { monto_apertura: 0, observaciones: "" } });
  const mut = useMutation({
    mutationFn: async (v: z.infer<typeof abrirSchema>) => {
      const { error } = await supabase.from("caja").insert({ monto_apertura: v.monto_apertura, observaciones: v.observaciones || null, user_id: userId, estado: "abierta" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caja abierta"); onDone(); onOpenChange(false); form.reset(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Abrir caja</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="monto_apertura" render={({ field }) => (
              <FormItem><FormLabel>Monto inicial (S/)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="observaciones" render={({ field }) => (
              <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending && <Loader2 className="size-4 animate-spin" />} Abrir</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const cerrarSchema = z.object({ monto_cierre: z.coerce.number().min(0), observaciones: z.string().max(300).optional().or(z.literal("")) });
function CerrarDialog({ open, onOpenChange, caja, esperado, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; caja: { id: string }; esperado: number; onDone: () => void }) {
  const form = useForm<z.infer<typeof cerrarSchema>>({ resolver: zodResolver(cerrarSchema), defaultValues: { monto_cierre: esperado, observaciones: "" } });
  const mut = useMutation({
    mutationFn: async (v: z.infer<typeof cerrarSchema>) => {
      const { error } = await supabase.from("caja").update({ monto_cierre: v.monto_cierre, fecha_cierre: new Date().toISOString(), estado: "cerrada", observaciones: v.observaciones || null }).eq("id", caja.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Caja cerrada"); onDone(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const diff = Number(form.watch("monto_cierre") || 0) - esperado;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <div className="p-3 rounded bg-muted text-sm">Efectivo esperado: <strong>{fmt(esperado)}</strong></div>
            <FormField control={form.control} name="monto_cierre" render={({ field }) => (
              <FormItem><FormLabel>Monto contado (S/)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <div className={`text-sm font-semibold ${diff === 0 ? "text-emerald-600" : diff > 0 ? "text-blue-600" : "text-destructive"}`}>
              Diferencia: {fmt(diff)}
            </div>
            <FormField control={form.control} name="observaciones" render={({ field }) => (
              <FormItem><FormLabel>Observaciones</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" variant="destructive" disabled={mut.isPending}>{mut.isPending && <Loader2 className="size-4 animate-spin" />} Cerrar caja</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const movSchema = z.object({ tipo: z.enum(["ingreso", "egreso"]), concepto: z.string().min(1).max(200), monto: z.coerce.number().positive() });
function MovDialog({ open, onOpenChange, cajaId, userId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; cajaId: string; userId?: string; onDone: () => void }) {
  const form = useForm<z.infer<typeof movSchema>>({ resolver: zodResolver(movSchema), defaultValues: { tipo: "ingreso", concepto: "", monto: 0 } });
  const mut = useMutation({
    mutationFn: async (v: z.infer<typeof movSchema>) => {
      const { error } = await supabase.from("movimientos_caja").insert({ caja_id: cajaId, tipo: v.tipo, concepto: v.concepto, monto: v.monto, user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Movimiento registrado"); onDone(); onOpenChange(false); form.reset({ tipo: "ingreso", concepto: "", monto: 0 }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo movimiento</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="space-y-4">
            <FormField control={form.control} name="tipo" render={({ field }) => (
              <FormItem><FormLabel>Tipo</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="concepto" render={({ field }) => (
              <FormItem><FormLabel>Concepto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="monto" render={({ field }) => (
              <FormItem><FormLabel>Monto (S/)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={mut.isPending}>{mut.isPending && <Loader2 className="size-4 animate-spin" />} Registrar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
