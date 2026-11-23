"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Printer, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

type Lote = {
  id: string;
  product_id: string;
  quantity_initial: number;
  quantity_remaining: number;
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
type Cliente = { id: string; name: string };
type Filtro = "hoy" | "semana" | "mes" | "rango";

type VentaDetalle = {
  id: string;
  fecha: string;
  cliente: string;
  clienteId: string;
  producto: string;
  cantidad: number;
  costoUnitario: number;
  precioUnitario: number;
  importe: number;
  totalCosto: number;
  diferencia: number;
  utilidad: number;
};

export default function ReportesPage() {
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [ventasLotes, setVentasLotes] = useState<VentaLote[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [loteSeleccionado, setLoteSeleccionado] = useState("");
  const [productoId, setProductoId] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [historialVentas, setHistorialVentas] = useState<any[]>([]);
  const [ventasDetalle, setVentasDetalle] = useState<VentaDetalle[]>([]);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (mostrarDetalle) cargarVentasDetalle();
  }, [filtro, fechaInicio, fechaFin, filtroCliente, mostrarDetalle]);

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

    const { data: lotesData } = await supabase
      .from("purchase_lots")
      .select("*, products(name)")
      .order("purchase_date", { ascending: false });

    const { data: ventasData } = await supabase
      .from("sale_items")
      .select("lot_id, quantity, unit_price, unit_cost")
      .not("lot_id", "is", null);

    const { data: prods } = await supabase.from("products").select("id, name").order("name");
    const { data: clis } = await supabase.from("customers").select("id, name").order("name");

    setLotes(lotesData || []);
    setVentasLotes(ventasData || []);
    setProductos(prods || []);
    setClientes(clis || []);
    setLoading(false);
  }

  async function cargarVentasDetalle() {
    const rango = obtenerRango(filtro);
    
    const { data } = await supabase
      .from("sale_items")
      .select("id, quantity, unit_price, unit_cost, sales(sale_date, customer_id, customers(name)), products(name)")
      .order("sales(sale_date)", { ascending: false });

    if (!data) {
      setVentasDetalle([]);
      return;
    }

    const detalle: VentaDetalle[] = data
      .filter((item: any) => {
        const fecha = item.sales?.sale_date?.split("T")[0];
        if (!fecha) return false;
        if (rango.inicio && fecha < rango.inicio) return false;
        if (rango.fin && fecha > rango.fin) return false;
        if (filtroCliente && item.sales?.customer_id !== filtroCliente) return false;
        return true;
      })
      .map((item: any) => {
        const cantidad = Number(item.quantity);
        const costo = Number(item.unit_cost);
        const precio = Number(item.unit_price);
        const importe = cantidad * precio;
        const totalCosto = cantidad * costo;
        const diferencia = precio - costo;
        const utilidad = importe - totalCosto;

        return {
          id: item.id,
          fecha: item.sales?.sale_date?.split("T")[0] || "-",
          cliente: item.sales?.customers?.name || "Sin cliente",
          clienteId: item.sales?.customer_id || "",
          producto: item.products?.name || "Sin producto",
          cantidad,
          costoUnitario: costo,
          precioUnitario: precio,
          importe,
          totalCosto,
          diferencia,
          utilidad,
        };
      });

    setVentasDetalle(detalle);
  }

  function calcularResultadoLote(loteId: string) {
    const ventas = ventasLotes.filter((v) => v.lot_id === loteId);
    const cantidadVendida = ventas.reduce((sum, v) => sum + Number(v.quantity), 0);
    const totalVenta = ventas.reduce((sum, v) => sum + Number(v.quantity) * Number(v.unit_price), 0);
    const totalCosto = ventas.reduce((sum, v) => sum + Number(v.quantity) * Number(v.unit_cost), 0);
    return { cantidadVendida, totalVenta, utilidad: totalVenta - totalCosto };
  }

  async function cargarHistorialProducto() {
    if (!productoId) {
      setHistorialVentas([]);
      return;
    }

    const { data } = await supabase
      .from("sale_items")
      .select("quantity, unit_price, sales(sale_date, customers(name))")
      .eq("product_id", productoId)
      .order("sales(sale_date)", { ascending: false });

    setHistorialVentas(data || []);
  }

  useEffect(() => {
    cargarHistorialProducto();
  }, [productoId]);

  function imprimir() {
    window.print();
  }

  function exportarExcel() {
    const datos = ventasDetalle.map((v) => ({
      Fecha: v.fecha,
      Cliente: v.cliente,
      Producto: v.producto,
      Cantidad: v.cantidad,
      "Costo Unit.": v.costoUnitario,
      "Precio Unit.": v.precioUnitario,
      "Importe Total": v.importe,
      "Total Costo": v.totalCosto,
      "Diferencia": v.diferencia,
      Utilidad: v.utilidad,
    }));

    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ventas Detalle");
    XLSX.writeFile(wb, `Ventas_Detalle_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  const resumenLotes = lotes.map((lote) => {
    const resultado = calcularResultadoLote(lote.id);
    return { ...lote, ...resultado };
  });

  const loteActual = resumenLotes.find((l) => l.id === loteSeleccionado);

  const totalCantidad = ventasDetalle.reduce((sum, v) => sum + v.cantidad, 0);
  const totalImporte = ventasDetalle.reduce((sum, v) => sum + v.importe, 0);
  const totalCostoSum = ventasDetalle.reduce((sum, v) => sum + v.totalCosto, 0);
  const totalUtilidad = ventasDetalle.reduce((sum, v) => sum + v.utilidad, 0);

  const clienteSeleccionado = clientes.find((c) => c.id === filtroCliente);

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="space-y-6 print:p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reportes</h1>
          <p className="text-muted-foreground">Análisis de lotes y ventas</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => setMostrarDetalle(!mostrarDetalle)}>
            {mostrarDetalle ? "Ver lotes" : "Detalle de ventas"}
          </Button>
          {mostrarDetalle && (
            <>
              <Button variant="outline" size="icon" onClick={imprimir}>
                <Printer className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={exportarExcel}>
                <FileSpreadsheet className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {mostrarDetalle && (
        <>
          <div className="flex flex-wrap gap-2 items-end print:hidden">
            {(["hoy", "semana", "mes", "rango"] as Filtro[]).map((f) => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filtro === f ? "bg-blue-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {f === "hoy" ? "Hoy" : f === "semana" ? "Semana" : f === "mes" ? "Mes" : "Rango"}
              </button>
            ))}
            {filtro === "rango" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">Desde</Label>
                  <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hasta</Label>
                  <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="h-9" />
                </div>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2 items-center print:hidden">
            <div className="space-y-1">
              <Label className="text-xs">Cliente</Label>
              <select
                className="flex h-9 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
                value={filtroCliente}
                onChange={(e) => setFiltroCliente(e.target.value)}
              >
                <option value="">Todos los clientes</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {filtroCliente && (
              <Button variant="ghost" size="sm" onClick={() => setFiltroCliente("")} className="mt-5">
                Limpiar
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total cartones</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalCantidad.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Importe total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(totalImporte).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total costo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${Math.round(totalCostoSum).toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total utilidad</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalUtilidad >= 0 ? "text-green-600" : "text-orange-600"}`}>
                  ${Math.round(totalUtilidad).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Detalle de ventas
                {clienteSeleccionado && <span className="ml-2 text-muted-foreground font-normal">- {clienteSeleccionado.name}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ventasDetalle.length === 0 ? (
                <p className="text-muted-foreground">Sin ventas en este período</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-2 px-2">Fecha</th>
                        <th className="text-left py-2 px-2">Cliente</th>
                        <th className="text-left py-2 px-2">Producto</th>
                        <th className="text-right py-2 px-2">Cantidad</th>
                        <th className="text-right py-2 px-2">Costo unit.</th>
                        <th className="text-right py-2 px-2">Precio unit.</th>
                        <th className="text-right py-2 px-2">Importe total</th>
                        <th className="text-right py-2 px-2">Total costo</th>
                        <th className="text-right py-2 px-2">Diferencia</th>
                        <th className="text-right py-2 px-2">Utilidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ventasDetalle.map((v) => (
                        <tr key={v.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-2">{v.fecha}</td>
                          <td className="py-2 px-2">{v.cliente}</td>
                          <td className="py-2 px-2">{v.producto}</td>
                          <td className="py-2 px-2 text-right">{v.cantidad}</td>
                          <td className="py-2 px-2 text-right">${v.costoUnitario.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right">${v.precioUnitario.toFixed(2)}</td>
                          <td className="py-2 px-2 text-right font-medium">${Math.round(v.importe).toLocaleString()}</td>
                          <td className="py-2 px-2 text-right">${Math.round(v.totalCosto).toLocaleString()}</td>
                          <td className={`py-2 px-2 text-right ${v.diferencia >= 0 ? "text-green-600" : "text-orange-600"}`}>
                            ${v.diferencia.toFixed(2)}
                          </td>
                          <td className={`py-2 px-2 text-right font-medium ${v.utilidad >= 0 ? "text-green-600" : "text-orange-600"}`}>
                            ${Math.round(v.utilidad).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 bg-slate-100 font-bold">
                        <td className="py-2 px-2" colSpan={3}>TOTAL</td>
                        <td className="py-2 px-2 text-right">{totalCantidad.toLocaleString()}</td>
                        <td className="py-2 px-2"></td>
                        <td className="py-2 px-2"></td>
                        <td className="py-2 px-2 text-right">${Math.round(totalImporte).toLocaleString()}</td>
                        <td className="py-2 px-2 text-right">${Math.round(totalCostoSum).toLocaleString()}</td>
                        <td className="py-2 px-2"></td>
                        <td className={`py-2 px-2 text-right ${totalUtilidad >= 0 ? "text-green-600" : "text-orange-600"}`}>
                          ${Math.round(totalUtilidad).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!mostrarDetalle && (
        <>
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Filtrar por producto</Label>
              <select
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
                value={productoId}
                onChange={(e) => setProductoId(e.target.value)}
              >
                <option value="">Todos</option>
                {productos.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {productoId && historialVentas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Historial de ventas del producto</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Fecha</th>
                      <th className="text-left py-2">Cliente</th>
                      <th className="text-right py-2">Cantidad</th>
                      <th className="text-right py-2">Precio</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialVentas.map((v: any, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{v.sales?.sale_date?.split("T")[0] || "-"}</td>
                        <td className="py-2">{v.sales?.customers?.name || "-"}</td>
                        <td className="py-2 text-right">{v.quantity}</td>
                        <td className="py-2 text-right">${Number(v.unit_price).toFixed(2)}</td>
                        <td className="py-2 text-right font-medium">${Math.round(Number(v.quantity) * Number(v.unit_price)).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {loteActual && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle del lote</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Producto</p>
                    <p className="font-medium">{loteActual.products?.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Fecha compra</p>
                    <p className="font-medium">{loteActual.purchase_date}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cantidad inicial</p>
                    <p className="font-medium">{loteActual.quantity_initial}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Restante</p>
                    <p className="font-medium">{loteActual.quantity_remaining}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Vendido</p>
                    <p className="font-medium text-orange-600">{loteActual.cantidadVendida}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total venta</p>
                    <p className="font-medium">${Math.round(loteActual.totalVenta).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Utilidad</p>
                    <p className={`font-medium ${loteActual.utilidad >= 0 ? "text-green-600" : "text-orange-600"}`}>
                      ${Math.round(loteActual.utilidad).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Resumen de lotes</CardTitle>
            </CardHeader>
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
                      <th className="text-right py-3">Restante</th>
                      <th className="text-right py-3">Total venta</th>
                      <th className="text-right py-3">Utilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumenLotes.map((lote) => (
                      <tr
                        key={lote.id}
                        className="border-b cursor-pointer hover:bg-slate-50"
                        onClick={() => setLoteSeleccionado(lote.id)}
                      >
                        <td className="py-3">{lote.products?.name || "-"}</td>
                        <td className="py-3">{lote.purchase_date}</td>
                        <td className="py-3 text-right">{lote.quantity_initial}</td>
                        <td className="py-3 text-right">{lote.cantidadVendida}</td>
                        <td className="py-3 text-right">{lote.quantity_remaining}</td>
                        <td className="py-3 text-right">${Math.round(lote.totalVenta).toLocaleString()}</td>
                        <td className={`py-3 text-right ${lote.utilidad >= 0 ? "text-green-600" : "text-orange-600"}`}>
                          ${Math.round(lote.utilidad).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}