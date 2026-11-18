"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, DollarSign, Printer, Home as HomeIcon, AlertTriangle } from "lucide-react";

type Producto = {
  id: string;
  name: string;
  stock_actual: number;
  valor_actual: number;
  inv_inicial: number;
  costo_inicial: number;
  ventas: number;
  compras: number;
  merma: number;
};

type Lote = {
  id: string;
  product_id: string;
  quantity_initial: number;
  quantity_remaining: number;
  quantity_merma: number | null;
  unit_cost: number;
  purchase_date: string;
  supplier: string | null;
  products: { name: string } | null;
};

type MermaHistorial = {
  id: string;
  quantity: number;
  reason: string | null;
  created_at: string;
  products: { name: string } | null;
};

export default function InventarioPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [mes, setMes] = useState("");
  const [mostrarFormInicial, setMostrarFormInicial] = useState(false);
  const [mostrarMerma, setMostrarMerma] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [mostrarDiagnostico, setMostrarDiagnostico] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const [costos, setCostos] = useState<Record<string, string>>({});
  const [lotesMerma, setLotesMerma] = useState<Lote[]>([]);
  const [loteSeleccionado, setLoteSeleccionado] = useState("");
  const [cantidadMerma, setCantidadMerma] = useState("");
  const [motivoMerma, setMotivoMerma] = useState("");
  const [historialMerma, setHistorialMerma] = useState<MermaHistorial[]>([]);
  const [todosLotes, setTodosLotes] = useState<Lote[]>([]);

  useEffect(() => {
    const hoy = new Date();
    const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
    setMes(mesActual);
  }, []);

  useEffect(() => {
    if (mes) cargar();
  }, [mes]);

  async function cargar() {
    setLoading(true);
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];

    const { data: prods } = await supabase.from("products").select("id, name").order("name");

    const { data: lotesTodos } = await supabase
      .from("purchase_lots")
      .select("id, product_id, quantity_initial, quantity_remaining, quantity_merma, unit_cost, purchase_date, supplier, products(name)")
      .order("purchase_date", { ascending: false });

    const { data: lotesMes } = await supabase
      .from("purchase_lots")
      .select("product_id, quantity_initial")
      .gte("purchase_date", inicioMes);

    const { data: inicial } = await supabase
      .from("initial_inventory")
      .select("product_id, quantity, unit_cost")
      .eq("month", mes);

    const { data: ventas } = await supabase.from("sale_items").select("product_id, quantity");

    const { data: mermaHist } = await supabase
      .from("merma_history")
      .select("id, quantity, reason, created_at, products(name)")
      .order("created_at", { ascending: false })
      .limit(50);

    const productosConStock: Producto[] = [];
    const cantMap: Record<string, string> = {};
    const costMap: Record<string, string> = {};

    if (prods) {
      for (const prod of prods) {
        const lotesProd = lotesTodos?.filter((l) => l.product_id === prod.id) || [];
        const stockReal = lotesProd.reduce((sum, l) => sum + Number(l.quantity_remaining), 0);
        const valorReal = lotesProd.reduce((sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost), 0);
        const mermaProd = lotesProd.reduce((sum, l) => sum + Number(l.quantity_merma || 0), 0);

        const invInicial = inicial?.find((i) => i.product_id === prod.id);
        const stockInicial = Number(invInicial?.quantity || 0);
        const costoIni = Number(invInicial?.unit_cost || 0);

        const lotesMesProd = lotesMes?.filter((l) => l.product_id === prod.id) || [];
        const totalLotesMes = lotesMesProd.reduce((sum, l) => sum + Number(l.quantity_initial), 0);
        const totalCompras = Math.max(0, totalLotesMes - stockInicial);

        const ventasProd = ventas?.filter((v) => v.product_id === prod.id) || [];
        const totalVentas = ventasProd.reduce((sum, v) => sum + Number(v.quantity), 0);

        // Fórmula original para comparar
        const stockFormula = stockInicial + totalCompras - totalVentas - mermaProd;

        productosConStock.push({
          id: prod.id,
          name: prod.name,
          stock_actual: Math.max(0, stockFormula),
          valor_actual: valorReal,
          inv_inicial: stockInicial,
          costo_inicial: costoIni,
          ventas: totalVentas,
          compras: totalCompras,
          merma: mermaProd,
        });

        cantMap[prod.id] = stockInicial > 0 ? stockInicial.toString() : "";
        costMap[prod.id] = costoIni > 0 ? costoIni.toString() : "";
      }
    }

    setProductos(productosConStock);
    setCantidades(cantMap);
    setCostos(costMap);
    setLotesMerma(lotesTodos?.filter((l) => l.quantity_remaining > 0) || []);
    setTodosLotes(lotesTodos || []);
    setHistorialMerma(mermaHist || []);
    setLoading(false);
  }

  async function guardarInicial() {
    const registros = productos
      .filter((p) => cantidades[p.id] && Number(cantidades[p.id]) > 0)
      .map((p) => ({
        product_id: p.id,
        quantity: Number(cantidades[p.id]),
        unit_cost: Number(costos[p.id]) || 0,
        month: mes,
      }));

    if (registros.length === 0) {
      alert("Ingresa al menos una cantidad");
      return;
    }

    const { error } = await supabase.from("initial_inventory").upsert(registros, { onConflict: "product_id,month" });

    if (error) alert("Error: " + error.message);
    else {
      alert("Inventario inicial guardado");
      setMostrarFormInicial(false);
      cargar();
    }
  }

  async function trasladarALotes() {
    if (!confirm("¿Trasladar el inventario inicial a lotes para venta?")) return;

    const { data: iniciales } = await supabase
      .from("initial_inventory")
      .select("*")
      .eq("month", mes);

    if (!iniciales || iniciales.length === 0) {
      alert("No hay inventario inicial capturado");
      return;
    }

    const hoy = new Date().toISOString().split("T")[0];

    for (const ini of iniciales) {
      await supabase.from("purchase_lots").insert({
        product_id: ini.product_id,
        quantity_initial: ini.quantity,
        quantity_remaining: ini.quantity,
        unit_cost: ini.unit_cost,
        purchase_date: hoy,
        supplier: "Inventario Inicial",
        payment_method: "Efectivo",
        cash_amount: 0,
        bank_amount: 0,
      });
    }

    alert("Inventario inicial trasladado a lotes");
    cargar();
  }

  async function registrarMerma() {
    if (!loteSeleccionado || !cantidadMerma || Number(cantidadMerma) <= 0) {
      alert("Selecciona un lote y cantidad válida");
      return;
    }

    const lote = lotesMerma.find((l) => l.id === loteSeleccionado);
    if (!lote) return;

    if (Number(cantidadMerma) > lote.quantity_remaining) {
      alert("La merma no puede ser mayor al disponible");
      return;
    }

    const nuevaMerma = Number(lote.quantity_merma || 0) + Number(cantidadMerma);
    const nuevoRemaining = lote.quantity_remaining - Number(cantidadMerma);

    const { error } = await supabase
      .from("purchase_lots")
      .update({ quantity_merma: nuevaMerma, quantity_remaining: nuevoRemaining })
      .eq("id", loteSeleccionado);

    if (error) {
      alert("Error: " + error.message);
      return;
    }

    await supabase.from("merma_history").insert({
      lot_id: loteSeleccionado,
      product_id: lote.product_id,
      quantity: Number(cantidadMerma),
      reason: motivoMerma || null,
    });

    alert("Merma registrada");
    setMostrarMerma(false);
    setLoteSeleccionado("");
    setCantidadMerma("");
    setMotivoMerma("");
    cargar();
  }

  function imprimir() {
    window.print();
  }

  function irAInicio() {
    setMostrarFormInicial(false);
    setMostrarMerma(false);
    setMostrarHistorial(false);
    setMostrarDiagnostico(false);
    setFiltro("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const productosFiltrados = filtro
    ? productos.filter((p) => p.name === filtro)
    : productos;

  const stockTotal = productosFiltrados.reduce((sum, p) => sum + p.stock_actual, 0);
  const valorTotal = productosFiltrados.reduce((sum, p) => sum + p.valor_actual, 0);
  const invInicialTotal = productosFiltrados.reduce((sum, p) => sum + p.inv_inicial, 0);
  const valorInicialTotal = productosFiltrados.reduce((sum, p) => sum + p.inv_inicial * p.costo_inicial, 0);
  const mermaTotal = productosFiltrados.reduce((sum, p) => sum + p.merma, 0);

  // Diagnóstico: lotes de Media Victoria
  const productoMedia = productos.find((p) => p.name.toLowerCase().includes("media victoria"));
  const lotesMedia = productoMedia
    ? todosLotes.filter((l) => l.product_id === productoMedia.id)
    : [];

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="space-y-6 print:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={irAInicio} className="print:hidden">
            <HomeIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Inventario</h1>
            <p className="text-muted-foreground">Stock actual y valor de inventario</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={imprimir}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setMostrarDiagnostico(!mostrarDiagnostico)}>
            Diagnóstico
          </Button>
          <Button variant="outline" onClick={() => setMostrarHistorial(!mostrarHistorial)}>
            Historial Merma
          </Button>
          <Button variant="outline" onClick={() => setMostrarMerma(!mostrarMerma)}>
            <AlertTriangle className="h-4 w-4 mr-2" /> Merma
          </Button>
          <Button variant="outline" onClick={() => setMostrarFormInicial(!mostrarFormInicial)}>
            + Inventario Inicial
          </Button>
          <Button onClick={trasladarALotes}>
            Trasladar a Lotes
          </Button>
        </div>
      </div>

      {mostrarDiagnostico && productoMedia && (
        <Card className="print:hidden border-orange-300">
          <CardHeader>
            <CardTitle className="text-orange-600">Diagnóstico: {productoMedia.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 mb-4">
              <div className="bg-slate-100 p-3 rounded">
                <p className="text-sm text-muted-foreground">Stock por fórmula</p>
                <p className="text-xl font-bold">{productoMedia.stock_actual.toLocaleString()}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded">
                <p className="text-sm text-muted-foreground">Suma remaining (todos los lotes)</p>
                <p className="text-xl font-bold">{lotesMedia.reduce((s, l) => s + Number(l.quantity_remaining), 0).toLocaleString()}</p>
              </div>
              <div className="bg-green-100 p-3 rounded">
                <p className="text-sm text-muted-foreground">Suma remaining (solo &gt; 0)</p>
                <p className="text-xl font-bold">{lotesMedia.filter(l => l.quantity_remaining > 0).reduce((s, l) => s + Number(l.quantity_remaining), 0).toLocaleString()}</p>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Fecha</th>
                  <th className="text-left py-2">Proveedor</th>
                  <th className="text-right py-2">Inicial</th>
                  <th className="text-right py-2">Remaining</th>
                  <th className="text-right py-2">Merma</th>
                  <th className="text-right py-2">Costo</th>
                </tr>
              </thead>
              <tbody>
                {lotesMedia.map((l) => (
                  <tr key={l.id} className="border-b">
                    <td className="py-2">{l.purchase_date}</td>
                    <td className="py-2">{l.supplier || "-"}</td>
                    <td className="py-2 text-right">{l.quantity_initial}</td>
                    <td className={`py-2 text-right font-medium ${l.quantity_remaining > 0 ? "text-green-600" : "text-red-500"}`}>{l.quantity_remaining}</td>
                    <td className="py-2 text-right">{l.quantity_merma || 0}</td>
                    <td className="py-2 text-right">${Number(l.unit_cost).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {mostrarMerma && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Registrar merma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Lote</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={loteSeleccionado}
                  onChange={(e) => setLoteSeleccionado(e.target.value)}
                >
                  <option value="">Selecciona un lote</option>
                  {lotesMerma.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.products?.name} | {l.purchase_date} | Disp: {l.quantity_remaining}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input
                  type="number"
                  value={cantidadMerma}
                  onChange={(e) => setCantidadMerma(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Input
                  value={motivoMerma}
                  onChange={(e) => setMotivoMerma(e.target.value)}
                  placeholder="Daño, vencimiento..."
                />
              </div>
              <div className="flex items-end gap-2">
                <Button onClick={registrarMerma}>Registrar</Button>
                <Button variant="outline" onClick={() => setMostrarMerma(false)}>Cancelar</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {mostrarHistorial && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Historial de mermas</CardTitle>
          </CardHeader>
          <CardContent>
            {historialMerma.length === 0 ? (
              <p className="text-muted-foreground">Sin registros de merma</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Fecha</th>
                    <th className="text-left py-2">Producto</th>
                    <th className="text-right py-2">Cantidad</th>
                    <th className="text-left py-2">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {historialMerma.map((m) => (
                    <tr key={m.id} className="border-b">
                      <td className="py-2">{new Date(m.created_at).toLocaleDateString("es-MX")}</td>
                      <td className="py-2">{m.products?.name || "-"}</td>
                      <td className="py-2 text-right text-red-600 font-medium">{m.quantity}</td>
                      <td className="py-2">{m.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {mostrarFormInicial && (
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Capturar inventario inicial del mes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Producto</th>
                  <th className="text-right py-2 w-32">Cantidad</th>
                  <th className="text-right py-2 w-32">Costo</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((prod) => (
                  <tr key={prod.id} className="border-b">
                    <td className="py-2">{prod.name}</td>
                    <td className="py-2">
                      <Input
                        type="number"
                        className="h-8 text-right"
                        value={cantidades[prod.id] || ""}
                        onChange={(e) => setCantidades({ ...cantidades, [prod.id]: e.target.value })}
                        placeholder="0"
                      />
                    </td>
                    <td className="py-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-right"
                        value={costos[prod.id] || ""}
                        onChange={(e) => setCostos({ ...costos, [prod.id]: e.target.value })}
                        placeholder="0.00"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex gap-2">
              <Button onClick={guardarInicial}>Guardar inventario inicial</Button>
              <Button variant="outline" onClick={() => setMostrarFormInicial(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2 items-end print:hidden">
        <div className="space-y-1">
          <Label className="text-xs">Producto</Label>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[250px]"
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
          >
            <option value="">Todos los productos</option>
            {productos.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">cartones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Inventario $</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.round(valorTotal).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">valor en inventario</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inventario inicial</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invInicialTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">cartones al inicio</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Merma total</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{mermaTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">cartones</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Valor inicial $</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.round(valorInicialTotal).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">valor al inicio</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3">Producto</th>
                <th className="text-right py-3">Inv. inicial</th>
                <th className="text-right py-3">Compras</th>
                <th className="text-right py-3">Ventas</th>
                <th className="text-right py-3">Merma</th>
                <th className="text-right py-3">Stock actual</th>
                <th className="text-right py-3">Valor actual</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltrados.map((prod) => (
                <tr key={prod.id} className="border-b">
                  <td className="py-3">{prod.name}</td>
                  <td className="py-3 text-right">{prod.inv_inicial.toLocaleString()}</td>
                  <td className="py-3 text-right text-green-600">{prod.compras.toLocaleString()}</td>
                  <td className="py-3 text-right text-orange-600">{prod.ventas.toLocaleString()}</td>
                  <td className="py-3 text-right text-red-600">{prod.merma.toLocaleString()}</td>
                  <td className="py-3 text-right font-medium">{prod.stock_actual.toLocaleString()}</td>
                  <td className="py-3 text-right">${Math.round(prod.valor_actual).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}