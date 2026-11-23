"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, DollarSign, TrendingDown, TrendingUp, ShoppingCart, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Filtro = "hoy" | "semana" | "mes" | "rango";

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalVentas, setTotalVentas] = useState(0);
  const [totalDiferencia, setTotalDiferencia] = useState(0);
  const [totalGastos, setTotalGastos] = useState(0);
  const [cartonesVendidos, setCartonesVendidos] = useState(0);
  const [cartonesGrupoModelo, setCartonesGrupoModelo] = useState(0);
  const [numeroVentas, setNumeroVentas] = useState(0);
  const [numeroClientes, setNumeroClientes] = useState(0);
  const [stockTotal, setStockTotal] = useState(0);
  const [valorInventario, setValorInventario] = useState(0);
  const [inventarioInicial, setInventarioInicial] = useState(0);
  const [bonificacion, setBonificacion] = useState(0);
  const [bonificacionValor, setBonificacionValor] = useState(0);
  const [utilidadBonificacion, setUtilidadBonificacion] = useState(0);
  const [topClientes, setTopClientes] = useState<{ nombre: string; cartones: number; monto: number }[]>([]);
  const [ventasPorDia, setVentasPorDia] = useState<{ fecha: string; total: number }[]>([]);
  const [productosBajos, setProductosBajos] = useState<{ name: string; stock: number }[]>([]);

  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const metaGrupoModelo = 12500;

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

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const rango = obtenerRango(filtro);
      const hoy = new Date();
      const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split("T")[0];
      const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split("T")[0];
      const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

      const [
        { data: ventas },
        { data: items },
        { data: gastos },
        { data: lotes },
        { data: prods },
        { data: comprasGM },
        { data: bonif },
        { data: inicial },
        { data: ventasItems },
      ] = await Promise.all([
        supabase.from("sales").select("id, total_amount, customer_id, sale_date, customers(name)").gte("sale_date", rango.inicio).lte("sale_date", rango.fin),
        supabase.from("sale_items").select("sale_id, quantity, unit_price, unit_cost, lot_id"),
        supabase.from("expenses").select("amount").gte("expense_date", rango.inicio).lte("expense_date", rango.fin),
        supabase.from("purchase_lots").select("id, product_id, quantity_initial, quantity_remaining, quantity_merma, unit_cost, supplier, purchase_date"),
        supabase.from("products").select("id, name"),
        supabase.from("purchase_lots").select("quantity_initial").gte("purchase_date", inicioMes).lte("purchase_date", finMes).eq("supplier", "Grupo Modelo Tuxtepec"),
        supabase.from("purchase_lots").select("id, quantity_initial, product_id, unit_cost").gte("purchase_date", inicioMes).lte("purchase_date", finMes).eq("supplier", "Grupo Modelo Tuxtepec-Bonificación"),
        supabase.from("initial_inventory").select("product_id, quantity, unit_cost").eq("month", mes),
        supabase.from("sale_items").select("product_id, quantity"),
      ]);

      // Calcular stock con fórmula
      let stockTotalCalc = 0;
      let valorTotalCalc = 0;
      const bajos: { name: string; stock: number }[] = [];

      if (prods) {
        for (const prod of prods) {
          const lotesProd = lotes?.filter((l) => l.product_id === prod.id) || [];
          const mermaProd = lotesProd.reduce((sum, l) => sum + Number(l.quantity_merma || 0), 0);
          const valorProd = lotesProd.reduce((sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost), 0);

          const invInicial = inicial?.find((i) => i.product_id === prod.id);
          const stockInicial = Number(invInicial?.quantity || 0);

          const lotesMesProd = lotes?.filter((l) => l.product_id === prod.id && l.purchase_date >= inicioMes) || [];
          const totalLotesMes = lotesMesProd.reduce((sum, l) => sum + Number(l.quantity_initial), 0);
          const totalCompras = Math.max(0, totalLotesMes - stockInicial);

          const ventasProd = ventasItems?.filter((v) => v.product_id === prod.id) || [];
          const totalVentas = ventasProd.reduce((sum, v) => sum + Number(v.quantity), 0);

          const stockFormula = Math.max(0, stockInicial + totalCompras - totalVentas - mermaProd);
          stockTotalCalc += stockFormula;
          valorTotalCalc += valorProd;

          if (stockFormula > 0 && stockFormula < 50) {
            bajos.push({ name: prod.name, stock: stockFormula });
          }
        }
      }

      setStockTotal(stockTotalCalc);
      setValorInventario(valorTotalCalc);
      setProductosBajos(bajos);

      let stockInicialTotal = 0;
      if (inicial) {
        stockInicialTotal = inicial.reduce((sum, i) => sum + Number(i.quantity), 0);
      }
      setInventarioInicial(stockInicialTotal);

      setCartonesGrupoModelo(comprasGM ? comprasGM.reduce((sum, c) => sum + Number(c.quantity_initial), 0) : 0);

      const idsLotesBonif = new Set(bonif?.map((b) => b.id) || []);
      if (bonif && bonif.length > 0) {
        const totalCartones = bonif.reduce((sum, b) => sum + Number(b.quantity_initial), 0);
        setBonificacion(totalCartones);
        const valorTotal = bonif.reduce((sum, b) => sum + Number(b.quantity_initial) * Number(b.unit_cost || 0), 0);
        setBonificacionValor(valorTotal);
      } else {
        setBonificacion(0);
        setBonificacionValor(0);
      }

      // Ventas - calcular desde sale_items
      if (ventas && items) {
        const ventasIds = new Set(ventas.map((v) => v.id));
        const itemsFiltrados = items.filter((i) => ventasIds.has(i.sale_id));

        const ventasMes = itemsFiltrados.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
        const costoMes = itemsFiltrados.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_cost || 0), 0);

        setNumeroVentas(ventas.length);
        setTotalVentas(ventasMes);
        setTotalDiferencia(ventasMes - costoMes);
        setNumeroClientes(new Set(ventas.map((v) => v.customer_id)).size);
        setCartonesVendidos(itemsFiltrados.reduce((sum, i) => sum + Number(i.quantity), 0));

        // Utilidad de bonificación (solo de lotes de bonificación)
        let utilidadBonif = 0;
        for (const item of itemsFiltrados) {
          if (item.lot_id && idsLotesBonif.has(item.lot_id)) {
            utilidadBonif += Number(item.quantity) * Number(item.unit_price);
          }
        }
        setUtilidadBonificacion(utilidadBonif);

        // Ventas por día
        const porDia: Record<string, number> = {};
        ventas.forEach((v) => {
          const fecha = v.sale_date.split("T")[0];
          const itemsVenta = itemsFiltrados.filter((i) => i.sale_id === v.id);
          const totalVenta = itemsVenta.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
          porDia[fecha] = (porDia[fecha] || 0) + totalVenta;
        });
        setVentasPorDia(Object.entries(porDia).map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha)));

        // Top clientes
        const clientesMap: Record<string, { nombre: string; cartones: number; monto: number }> = {};
        ventas.forEach((v) => {
          const nombre = (v.customers as any)?.name || "Sin nombre";
          const itemsVenta = itemsFiltrados.filter((i) => i.sale_id === v.id);
          const cartonesCliente = itemsVenta.reduce((sum, i) => sum + Number(i.quantity), 0);
          const montoCliente = itemsVenta.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);
          if (!clientesMap[v.customer_id]) clientesMap[v.customer_id] = { nombre, cartones: 0, monto: 0 };
          clientesMap[v.customer_id].cartones += cartonesCliente;
          clientesMap[v.customer_id].monto += montoCliente;
        });
        setTopClientes(Object.values(clientesMap).sort((a, b) => b.cartones - a.cartones).slice(0, 10));
      } else {
        setTotalVentas(0);
        setTotalDiferencia(0);
        setNumeroVentas(0);
        setNumeroClientes(0);
        setVentasPorDia([]);
        setCartonesVendidos(0);
        setUtilidadBonificacion(0);
        setTopClientes([]);
      }

      setTotalGastos(gastos ? gastos.reduce((sum, g) => sum + Number(g.amount), 0) : 0);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, [filtro, fechaInicio, fechaFin]);

  const utilidadNeta = totalDiferencia - totalGastos + utilidadBonificacion;
  const diferenciaPorCarton = cartonesVendidos > 0 ? totalDiferencia / cartonesVendidos : 0;
  const esPositivo = totalDiferencia >= 0;
  const porcentajeMeta = Math.min((cartonesGrupoModelo / metaGrupoModelo) * 100, 100);
  const faltan = Math.max(metaGrupoModelo - cartonesGrupoModelo, 0);

  if (loading) return <div className="p-6 text-center">Cargando dashboard...</div>;

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg max-w-md mx-auto">
          <p className="font-medium">No se pudo cargar</p>
          <p className="text-sm mt-1">{error}</p>
          <button onClick={cargar} className="mt-3 text-sm underline">Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Resumen de tu negocio</p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
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

      <div className="grid gap-4 md:grid-cols-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Ventas del período</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${Math.round(totalVentas).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{esPositivo ? "Ganancia" : "Diferencia"}</CardTitle>{esPositivo ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-orange-600" />}</CardHeader><CardContent><div className={`text-2xl font-bold ${esPositivo ? "text-green-600" : "text-orange-600"}`}>${Math.round(Math.abs(totalDiferencia)).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">{esPositivo ? "Ganancia" : "Diferencia"} / cartón</CardTitle>{esPositivo ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-orange-600" />}</CardHeader><CardContent><div className={`text-2xl font-bold ${esPositivo ? "text-green-600" : "text-orange-600"}`}>${Math.round(Math.abs(diferenciaPorCarton)).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Gastos</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">${Math.round(totalGastos).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Utilidad bonificación</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">${Math.round(utilidadBonificacion).toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Utilidad Neta</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className={`text-2xl font-bold ${utilidadNeta < 0 ? "text-orange-600" : "text-green-600"}`}>${Math.round(utilidadNeta).toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-6">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Cartones vendidos</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{cartonesVendidos.toLocaleString()}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Número de ventas</CardTitle><ShoppingCart className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{numeroVentas}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Clientes activos</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{numeroClientes}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Stock actual</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{stockTotal.toLocaleString()}</div><p className="text-xs text-muted-foreground">${Math.round(valorInventario).toLocaleString()}</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Inventario inicial</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{inventarioInicial.toLocaleString()}</div><p className="text-xs text-muted-foreground">cartones al inicio del mes</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Bonificación</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{bonificacion.toLocaleString()}</div><p className="text-xs text-muted-foreground">${Math.round(bonificacionValor).toLocaleString()} en cartones</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Meta Grupo Modelo - {new Date().toLocaleString("es-MX", { month: "long" })}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm"><span>{cartonesGrupoModelo.toLocaleString()} / {metaGrupoModelo.toLocaleString()} cartones</span><span>{porcentajeMeta.toFixed(0)}%</span></div>
          <div className="h-3 w-full rounded-full bg-slate-200"><div className="h-3 rounded-full bg-blue-600" style={{ width: `${porcentajeMeta}%` }} /></div>
          <p className="text-sm text-muted-foreground">Faltan {faltan.toLocaleString()} cartones para la bonificación</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ventas por día</CardTitle></CardHeader>
        <CardContent>
          {ventasPorDia.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas en este período</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ventasPorDia}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `$${Math.round(Number(value)).toLocaleString()}`} />
                  <Bar dataKey="total" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {productosBajos.length > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700">⚠️ Stock bajo (menos de 50 cartones)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {productosBajos.map((p, i) => (
                <span key={i} className="text-sm bg-white px-3 py-1 rounded border border-orange-200">
                  {p.name}: <strong>{p.stock}</strong>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Top 10 clientes del período</CardTitle></CardHeader>
        <CardContent>
          {topClientes.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas en este período</p> : (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground border-b pb-2"><span>Cliente</span><div className="flex gap-4"><span className="w-24 text-right">Cartones</span><span className="w-28 text-right">Monto</span></div></div>
              {topClientes.map((c, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span>{i + 1}. {c.nombre}</span>
                  <div className="flex gap-4"><span className="w-24 text-right">{c.cartones.toLocaleString()}</span><span className="w-28 text-right font-medium">${Math.round(c.monto).toLocaleString()}</span></div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}