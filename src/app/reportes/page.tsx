"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer } from "lucide-react";

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

type VentaLote = {
  lot_id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
};

type Producto = { id: string; name: string };
type Filtro = "hoy" | "semana" | "mes" | "rango";

export default function ReportesPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [ventasLotes, setVentasLotes] = useState<VentaLote[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loteSeleccionado, setLoteSeleccionado] = useState("");
  const [productoId, setProductoId] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [historialVentas, setHistorialVentas] = useState<any[]>([]);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (productoId) cargarHistorialProducto();
  }, [productoId, filtro, fechaInicio, fechaFin]);

  async function cargar() {
    setLoading(true);

    const { data: lotesData } = await supabase
      .from("purchase_lots")
      .select("*, products(name)")
      .order("purchase_date", { ascending: false });

    const { data: ventasData } = await supabase
      .from("sale_items")
      .select("lot_id, quantity, unit_price, unit_cost")
      .not("lot_id", "is", null);

    const { data: prods } = await supabase.from("products").select("id, name").order("name");

    setLotes(lotesData || []);
    setVentasLotes(ventasData || []);
    setProductos(prods || []);
    setLoading(false);
  }

  function obtenerRango(filtro: Filtro) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (filtro === "hoy") return { inicio: hoy.toISOString().split("T")[0], fin: hoy.toISOString().split("T")[0] };
    if (filtro === "semana") {
      const inicio = new Date(hoy);
      inicio.setDate(hoy.getDate() - hoy.getDay());
      const fin = new Date(inicio);
      fin.setDate(inicio.getDate() + 6);
      return { inicio: inicio.toISOString().split("T")[0], fin: fin.toISOString().split("T")[0] };
    }
    if (filtro === "mes") {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      return { inicio: inicio.toISOString().split("T")[0], fin: fin.toISOString().split("T")[0] };
    }
    return { inicio: fechaInicio, fin: fechaFin };
  }

  async function cargarHistorialProducto() {
    if (!productoId) return;
    const rango = obtenerRango(filtro);

    const { data: items } = await supabase
      .from("sale_items")
      .select("quantity, unit_price, sale_id, sales(sale_date, customers(name))")
      .eq("product_id", productoId);

    if (items) {
      const historial = items
        .filter((item) => {
          const sale = item.sales as any;
          if (!sale?.sale_date) return false;
          const fecha = sale.sale_date.split("T")[0];
          if (rango.inicio && fecha < rango.inicio) return false;
          if (rango.fin && fecha > rango.fin) return false;
          return true;
        })
        .map((item) => {
          const sale = item.sales as any;
          return {
            fecha: sale?.sale_date?.split("T")[0] || "-",
            cliente: sale?.customers?.name || "-",
            cantidad: Number(item.quantity),
            precio: Number(item.unit_price),
            total: Number(item.quantity) * Number(item.unit_price),
          };
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

      setHistorialVentas(historial);
    }
  }

  function calcularResultadoLote(loteId: string) {
    const lote = lotes.find((l) => l.id === loteId);
    if (!lote) return { cantidadVendida: 0, totalVenta: 0, totalCosto: 0, utilidad: 0 };

    const ventas = ventasLotes.filter((v) => v.lot_id === loteId);
    const cantidadVendida = ventas.reduce((sum, v) => sum + Number(v.quantity || 0), 0);
    const totalVenta = ventas.reduce((sum, v) => sum + Number(v.quantity || 0) * Number(v.unit_price || 0), 0);
    
    const costoLote = Number(lote.unit_cost || 0);
    const totalCosto = cantidadVendida * costoLote;
    const utilidad = totalVenta - totalCosto;

    return { cantidadVendida, totalVenta, totalCosto, utilidad };
  }

  function imprimir() {
    window.print();
  }

  const loteActual = lotes.find((l) => l.id === loteSeleccionado);
  const resultado = loteSeleccionado ? calcularResultadoLote(loteSeleccionado) : null;

  const vendidoReal = loteActual ? Math.max(0, loteActual.quantity_initial - loteActual.quantity_remaining - (loteActual.quantity_merma || 0)) : 0;

  const resumenLotes = lotes.map((lote) => {
    const res = calcularResultadoLote(lote.id);
    const vendido = Math.max(0, lote.quantity_initial - lote.quantity_remaining - (lote.quantity_merma || 0));
    return { ...lote, ...res, vendidoReal: vendido };
  }).filter((l) => l.vendidoReal > 0 || l.quantity_remaining > 0 || (l.quantity_merma || 0) > 0);

  const totalCartonesProducto = historialVentas.reduce((sum, v) => sum + v.cantidad, 0);
  const totalMontoProducto = historialVentas.reduce((sum, v) => sum + v.total, 0);
  const promedioProducto = totalCartonesProducto > 0 ? totalMontoProducto / totalCartonesProducto : 0;

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="space-y-6 print:p-4">
      <style jsx global>{`
        @media print {
          aside, nav, .print\\:hidden { display: none !important; }
          main { margin-left: 0 !important; width: 100% !important; }
        }
      `}</style>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Análisis de lotes y ventas por producto</p>
        </div>
        <Button variant="outline" size="icon" onClick={imprimir} className="print:hidden">
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-end print:hidden">
        <button onClick={() => setFiltro("hoy")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "hoy" ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Hoy</button>
        <button onClick={() => setFiltro("semana")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "semana" ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Esta semana</button>
        <button onClick={() => setFiltro("mes")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "mes" ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Este mes</button>
        <button onClick={() => setFiltro("rango")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "rango" ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Rango</button>
        {filtro === "rango" && (
          <>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
          </>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Análisis por producto</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 print:hidden">
            <Label>Selecciona un producto</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
            >
              <option value="">Selecciona...</option>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {productoId && (
            <>
              <div className="grid gap-4 md:grid-cols-4 pt-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Cartones vendidos</div>
                  <div className="text-2xl font-bold">{totalCartonesProducto.toLocaleString()}</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Total vendido</div>
                  <div className="text-2xl font-bold text-blue-600">${Math.round(totalMontoProducto).toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Promedio por cartón</div>
                  <div className="text-2xl font-bold">${Math.round(promedioProducto).toLocaleString()}</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Número de ventas</div>
                  <div className="text-2xl font-bold">{historialVentas.length}</div>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left py-2 px-3">Fecha</th>
                      <th className="text-left py-2 px-3">Cliente</th>
                      <th className="text-right py-2 px-3">Cartones</th>
                      <th className="text-right py-2 px-3">Precio</th>
                      <th className="text-right py-2 px-3">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialVentas.length === 0 ? (
                      <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sin ventas en este período</td></tr>
                    ) : (
                      historialVentas.map((v, i) => (
                        <tr key={i} className="border-t">
                          <td className="py-2 px-3">{v.fecha}</td>
                          <td className="py-2 px-3">{v.cliente}</td>
                          <td className="py-2 px-3 text-right font-medium">{v.cantidad}</td>
                          <td className="py-2 px-3 text-right">${v.precio.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right font-medium">${Math.round(v.total).toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Analizar lote específico</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 print:hidden">
            <Label>Selecciona un lote</Label>
            <select
              className="flex h-10 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={loteSeleccionado}
              onChange={(e) => setLoteSeleccionado(e.target.value)}
            >
              <option value="">Selecciona...</option>
              {lotes.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.products?.name} - {l.purchase_date} - ${l.unit_cost} (Inicial: {l.quantity_initial}, Restante: {l.quantity_remaining})
                </option>
              ))}
            </select>
          </div>

          {loteActual && (
            <div className="grid gap-4 md:grid-cols-4 pt-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Cantidad inicial</div>
                <div className="text-2xl font-bold">{loteActual.quantity_initial}</div>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Vendido</div>
                <div className="text-2xl font-bold text-orange-600">{vendidoReal}</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Restante</div>
                <div className="text-2xl font-bold text-green-600">{loteActual.quantity_remaining}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Costo unitario</div>
                <div className="text-2xl font-bold">${loteActual.unit_cost.toFixed(2)}</div>
              </div>
              {(loteActual.quantity_merma || 0) > 0 && (
                <div className="bg-red-50 p-4 rounded-lg">
                  <div className="text-sm text-muted-foreground">Merma</div>
                  <div className="text-2xl font-bold text-red-600">{loteActual.quantity_merma}</div>
                </div>
              )}
              {resultado && resultado.cantidadVendida > 0 && (
                <>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total vendido (vinculado)</div>
                    <div className="text-2xl font-bold text-blue-600">${resultado.totalVenta.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-sm text-muted-foreground">Costo total vendido</div>
                    <div className="text-2xl font-bold">${resultado.totalCosto.toLocaleString()}</div>
                  </div>
                  <div className={`p-4 rounded-lg ${resultado.utilidad >= 0 ? "bg-green-50" : "bg-orange-50"}`}>
                    <div className="text-sm text-muted-foreground">{resultado.utilidad >= 0 ? "Utilidad" : "Diferencia"}</div>
                    <div className={`text-2xl font-bold ${resultado.utilidad >= 0 ? "text-green-600" : "text-orange-600"}`}>
                      ${Math.abs(resultado.utilidad).toLocaleString()}
                    </div>
                  </div>
                </>
              )}
              <div className="bg-slate-50 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground">Proveedor</div>
                <div className="text-lg font-bold">{loteActual.supplier || "-"}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resumen de lotes</CardTitle></CardHeader>
        <CardContent>
          {resumenLotes.length === 0 ? (
            <p className="text-muted-foreground">Sin lotes</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Producto</th>
                  <th className="text-left py-3">Fecha compra</th>
                  <th className="text-right py-3">Inicial</th>
                  <th className="text-right py-3">Vendido</th>
                  <th className="text-right py-3">Merma</th>
                  <th className="text-right py-3">Restante</th>
                  <th className="text-right py-3">Costo</th>
                </tr>
              </thead>
              <tbody>
                {resumenLotes.map((lote) => (
                  <tr key={lote.id} className="border-b cursor-pointer hover:bg-slate-50" onClick={() => setLoteSeleccionado(lote.id)}>
                    <td className="py-3">{lote.products?.name || "-"}</td>
                    <td className="py-3">{lote.purchase_date}</td>
                    <td className="py-3 text-right">{lote.quantity_initial}</td>
                    <td className="py-3 text-right text-orange-600">{lote.vendidoReal}</td>
                    <td className="py-3 text-right text-red-600">{lote.quantity_merma || 0}</td>
                    <td className="py-3 text-right font-medium text-green-600">{lote.quantity_remaining}</td>
                    <td className="py-3 text-right">${lote.unit_cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}