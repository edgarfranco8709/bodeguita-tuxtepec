"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, TrendingUp, TrendingDown } from "lucide-react";

export default function ResultadosPage() {
  const [loading, setLoading] = useState(true);
  const [ingresos, setIngresos] = useState(0);
  const [costoVentas, setCostoVentas] = useState(0);
  const [gastos, setGastos] = useState(0);
  const [gastosPorCategoria, setGastosPorCategoria] = useState<{ nombre: string; monto: number }[]>([]);
  const [bonificacion, setBonificacion] = useState(0);
  const [cartones, setCartones] = useState(0);
  const [ingresosAnt, setIngresosAnt] = useState(0);
  const [costoAnt, setCostoAnt] = useState(0);
  const [gastosAnt, setGastosAnt] = useState(0);
  const [bonificacionAnt, setBonificacionAnt] = useState(0);
  const [mesActual, setMesActual] = useState("");
  const [mesAnterior, setMesAnterior] = useState("");

  useEffect(() => {
    const hoy = new Date();
    setMesActual(hoy.toLocaleString("es-MX", { month: "long", year: "numeric" }));
    const ant = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    setMesAnterior(ant.toLocaleString("es-MX", { month: "long", year: "numeric" }));
    cargar();
  }, []);

  function obtenerRango(anterior = false) {
    const hoy = new Date();
    const mes = anterior ? hoy.getMonth() - 1 : hoy.getMonth();
    const anio = mes < 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    const mesReal = mes < 0 ? 11 : mes;
    const inicio = new Date(anio, mesReal, 1);
    const fin = new Date(anio, mesReal + 1, 0);
    return { inicio: inicio.toISOString().split("T")[0], fin: fin.toISOString().split("T")[0] };
  }

  async function cargar() {
    setLoading(true);
    const rango = obtenerRango();
    const rangoAnt = obtenerRango(true);

    // Cargar ventas y sale_items para calcular costos correctamente
    const { data: ventas } = await supabase.from("sales").select("id").gte("sale_date", rango.inicio).lte("sale_date", rango.fin);
    const { data: ventasAnt } = await supabase.from("sales").select("id").gte("sale_date", rangoAnt.inicio).lte("sale_date", rangoAnt.fin);
    const { data: items } = await supabase.from("sale_items").select("sale_id, quantity, unit_price, unit_cost, lot_id");
    
    // Cargar lotes de bonificación
    const { data: lotesBonif } = await supabase.from("purchase_lots").select("id").eq("supplier", "Grupo Modelo Tuxtepec-Bonificación");
    const idsLotesBonif = new Set(lotesBonif?.map((l) => l.id) || []);

    // Cargar categorías y gastos
    const { data: categorias } = await supabase.from("expense_categories").select("id, name");
    const { data: gastosData } = await supabase.from("expenses").select("amount, category_id").gte("expense_date", rango.inicio).lte("expense_date", rango.fin);
    const { data: gastosAntData } = await supabase.from("expenses").select("amount").gte("expense_date", rangoAnt.inicio).lte("expense_date", rangoAnt.fin);

    // Calcular mes actual desde sale_items
    let ing = 0, costo = 0, cart = 0, bonif = 0;
    if (ventas && items) {
      const ids = new Set(ventas.map((v) => v.id));
      const itemsFiltrados = items.filter((i) => ids.has(i.sale_id));
      
      ing = itemsFiltrados.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
      costo = itemsFiltrados.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost || 0), 0);
      cart = itemsFiltrados.reduce((s, i) => s + Number(i.quantity), 0);
      
      // Bonificación vendida
      for (const item of itemsFiltrados) {
        if (item.lot_id && idsLotesBonif.has(item.lot_id)) {
          bonif += Number(item.quantity) * Number(item.unit_price);
        }
      }
    }

    // Calcular mes anterior desde sale_items
    let ingAnt = 0, costoA = 0, bonifAnt = 0;
    if (ventasAnt && items) {
      const idsAnt = new Set(ventasAnt.map((v) => v.id));
      const itemsFiltradosAnt = items.filter((i) => idsAnt.has(i.sale_id));
      
      ingAnt = itemsFiltradosAnt.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
      costoA = itemsFiltradosAnt.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost || 0), 0);
      
      for (const item of itemsFiltradosAnt) {
        if (item.lot_id && idsLotesBonif.has(item.lot_id)) {
          bonifAnt += Number(item.quantity) * Number(item.unit_price);
        }
      }
    }

    // Agrupar gastos por categoría
    const gastosMap: Record<string, number> = {};
    if (gastosData && categorias) {
      gastosData.forEach((g) => {
        const cat = categorias.find((c) => c.id === g.category_id);
        const nombre = cat?.name || "Otros";
        gastosMap[nombre] = (gastosMap[nombre] || 0) + Number(g.amount);
      });
    }

    setIngresos(ing);
    setCostoVentas(costo);
    setGastos(gastosData ? gastosData.reduce((s, g) => s + Number(g.amount), 0) : 0);
    setGastosPorCategoria(Object.entries(gastosMap).map(([nombre, monto]) => ({ nombre, monto })).sort((a, b) => b.monto - a.monto));
    setBonificacion(bonif);
    setCartones(cart);
    setIngresosAnt(ingAnt);
    setCostoAnt(costoA);
    setGastosAnt(gastosAntData ? gastosAntData.reduce((s, g) => s + Number(g.amount), 0) : 0);
    setBonificacionAnt(bonifAnt);
    setLoading(false);
  }

  function imprimir() { window.print(); }

  const utilidadBruta = ingresos - costoVentas;
  const utilidadNeta = utilidadBruta - gastos + bonificacion;
  const utilidadBrutaAnt = ingresosAnt - costoAnt;
  const utilidadNetaAnt = utilidadBrutaAnt - gastosAnt + bonificacionAnt;

  function variacion(actual: number, anterior: number) {
    if (anterior === 0) return actual > 0 ? 100 : 0;
    return ((actual - anterior) / Math.abs(anterior)) * 100;
  }

  function pct(valor: number, base: number) {
    if (base === 0) return 0;
    return (valor / base) * 100;
  }

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
          <h1 className="text-3xl font-bold">Estado de Resultados (P&L)</h1>
          <p className="text-muted-foreground">Vista contable — {mesActual}</p>
        </div>
        <Button variant="outline" size="icon" onClick={imprimir} className="print:hidden"><Printer className="h-4 w-4" /></Button>
      </div>

      <div className="text-sm text-muted-foreground print:hidden">Comparando vs: {mesAnterior}</div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-700">Ventas Netas</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${Math.round(ingresos).toLocaleString()}</div>
            <div className={`text-sm flex items-center gap-1 ${variacion(ingresos, ingresosAnt) >= 0 ? "text-green-600" : "text-red-600"}`}>
              {variacion(ingresos, ingresosAnt) >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {variacion(ingresos, ingresosAnt) >= 0 ? "+" : ""}{variacion(ingresos, ingresosAnt).toFixed(1)}% vs anterior
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utilidad Bruta</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${utilidadBruta >= 0 ? "text-green-600" : "text-orange-600"}`}>${Math.round(utilidadBruta).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Margen {pct(utilidadBruta, ingresos).toFixed(1)}%</div>
          </CardContent>
        </Card>
        <Card className={utilidadNeta >= 0 ? "bg-green-50 border-green-200" : "bg-orange-50 border-orange-200"}>
          <CardHeader className="pb-2"><CardTitle className={`text-sm font-medium ${utilidadNeta >= 0 ? "text-green-700" : "text-orange-700"}`}>Utilidad Neta</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${utilidadNeta >= 0 ? "text-green-600" : "text-orange-600"}`}>${Math.round(utilidadNeta).toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Margen {pct(utilidadNeta, ingresos).toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Detalle - Estado de Resultados</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-green-600 text-white">
                <th className="text-left py-2 px-2">Concepto</th>
                <th className="text-right py-2 px-2">{mesActual}</th>
                <th className="text-right py-2 px-2">% Ventas</th>
                <th className="text-right py-2 px-2">{mesAnterior}</th>
                <th className="text-right py-2 px-2">% Ventas</th>
                <th className="text-right py-2 px-2">Variación</th>
                <th className="text-right py-2 px-2">% Var.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b bg-slate-100 font-medium">
                <td className="py-2 px-2">INGRESOS</td>
                <td className="py-2 px-2 text-right">${Math.round(ingresos).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">100%</td>
                <td className="py-2 px-2 text-right">${Math.round(ingresosAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">100%</td>
                <td className={`py-2 px-2 text-right ${ingresos - ingresosAnt >= 0 ? "text-green-600" : "text-red-600"}`}>${Math.round(ingresos - ingresosAnt).toLocaleString()}</td>
                <td className={`py-2 px-2 text-right ${variacion(ingresos, ingresosAnt) >= 0 ? "text-green-600" : "text-red-600"}`}>{variacion(ingresos, ingresosAnt).toFixed(1)}%</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-2">(-) Costo de ventas</td>
                <td className="py-2 px-2 text-right text-red-600">-${Math.round(costoVentas).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{pct(costoVentas, ingresos).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-red-600">-${Math.round(costoAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{pct(costoAnt, ingresosAnt).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right">${Math.round(costoVentas - costoAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{variacion(costoVentas, costoAnt).toFixed(1)}%</td>
              </tr>
              <tr className="border-b bg-green-100 font-medium">
                <td className="py-2 px-2">Utilidad Bruta</td>
                <td className={`py-2 px-2 text-right font-bold ${utilidadBruta >= 0 ? "text-green-700" : "text-orange-700"}`}>${Math.round(utilidadBruta).toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-bold">{pct(utilidadBruta, ingresos).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right">${Math.round(utilidadBrutaAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{pct(utilidadBrutaAnt, ingresosAnt).toFixed(1)}%</td>
                <td className={`py-2 px-2 text-right ${utilidadBruta - utilidadBrutaAnt >= 0 ? "text-green-600" : "text-red-600"}`}>${Math.round(utilidadBruta - utilidadBrutaAnt).toLocaleString()}</td>
                <td className={`py-2 px-2 text-right ${variacion(utilidadBruta, utilidadBrutaAnt) >= 0 ? "text-green-600" : "text-red-600"}`}>{variacion(utilidadBruta, utilidadBrutaAnt).toFixed(1)}%</td>
              </tr>
              <tr className="border-b bg-slate-100 font-medium"><td className="py-2 px-2" colSpan={7}>GASTOS DE OPERACIÓN</td></tr>
              {gastosPorCategoria.map((g, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 px-2 pl-4">{g.nombre}</td>
                  <td className="py-2 px-2 text-right text-red-600">-${Math.round(g.monto).toLocaleString()}</td>
                  <td className="py-2 px-2 text-right">{pct(g.monto, ingresos).toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right">-</td>
                  <td className="py-2 px-2 text-right">-</td>
                  <td className="py-2 px-2 text-right">-</td>
                  <td className="py-2 px-2 text-right">-</td>
                </tr>
              ))}
              <tr className="border-b bg-yellow-100 font-medium">
                <td className="py-2 px-2">Total Gastos de Operación</td>
                <td className="py-2 px-2 text-right text-red-600 font-bold">-${Math.round(gastos).toLocaleString()}</td>
                <td className="py-2 px-2 text-right font-bold">{pct(gastos, ingresos).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-red-600">-${Math.round(gastosAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{pct(gastosAnt, ingresosAnt).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right">${Math.round(gastos - gastosAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{variacion(gastos, gastosAnt).toFixed(1)}%</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 px-2">(+) Utilidad bonificación</td>
                <td className="py-2 px-2 text-right text-green-600">+${Math.round(bonificacion).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{pct(bonificacion, ingresos).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right text-green-600">+${Math.round(bonificacionAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{pct(bonificacionAnt, ingresosAnt).toFixed(1)}%</td>
                <td className="py-2 px-2 text-right">${Math.round(bonificacion - bonificacionAnt).toLocaleString()}</td>
                <td className="py-2 px-2 text-right">{variacion(bonificacion, bonificacionAnt).toFixed(1)}%</td>
              </tr>
              <tr className="bg-green-600 text-white font-bold">
                <td className="py-3 px-2">Utilidad Neta</td>
                <td className="py-3 px-2 text-right">${Math.round(utilidadNeta).toLocaleString()}</td>
                <td className="py-3 px-2 text-right">{pct(utilidadNeta, ingresos).toFixed(1)}%</td>
                <td className="py-3 px-2 text-right">${Math.round(utilidadNetaAnt).toLocaleString()}</td>
                <td className="py-3 px-2 text-right">{pct(utilidadNetaAnt, ingresosAnt).toFixed(1)}%</td>
                <td className="py-3 px-2 text-right">${Math.round(utilidadNeta - utilidadNetaAnt).toLocaleString()}</td>
                <td className="py-3 px-2 text-right">{variacion(utilidadNeta, utilidadNetaAnt).toFixed(1)}%</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Cartones vendidos: {cartones.toLocaleString()} | Margen por cartón: ${Math.round(cartones > 0 ? utilidadNeta / cartones : 0).toLocaleString()}</p>
    </div>
  );
}