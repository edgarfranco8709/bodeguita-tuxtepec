"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Eye, ShoppingCart } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type Cliente = { id: string; name: string };
type Venta = {
  id: string;
  customer_id: string;
  sale_date: string;
  total_amount: number;
  total_cost: number;
  customers: { name: string } | null;
  cartones?: number;
};
type Filtro = "hoy" | "semana" | "mes" | "rango";

export default function VentasPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [cartonesVendidos, setCartonesVendidos] = useState(0);
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [datosGrafica, setDatosGrafica] = useState<{ fecha: string; total: number; cartones: number }[]>([]);

  useEffect(() => { cargarDatos(); cargarVentas(); }, [filtro, fechaInicio, fechaFin]);

  async function cargarDatos() {
    const { data: cli } = await supabase.from("customers").select("id, name").order("name");
    setClientes(cli || []);
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

  async function cargarVentas() {
    const rango = obtenerRango(filtro);
    let query = supabase.from("sales").select("*, customers(name)").order("sale_date", { ascending: false });
    if (rango.inicio) query = query.gte("sale_date", rango.inicio);
    if (rango.fin) query = query.lte("sale_date", rango.fin);
    const { data } = await query;

    if (data && data.length > 0) {
      const ventasIds = data.map((v) => v.id);
      const { data: items } = await supabase.from("sale_items").select("sale_id, quantity").in("sale_id", ventasIds);

      const cartonesPorVenta: Record<string, number> = {};
      let totalCartones = 0;
      if (items) {
        items.forEach((item) => {
          cartonesPorVenta[item.sale_id] = (cartonesPorVenta[item.sale_id] || 0) + Number(item.quantity);
          totalCartones += Number(item.quantity);
        });
      }
      setCartonesVendidos(totalCartones);

      const ventasConCartones = data.map((v) => ({
        ...v,
        cartones: cartonesPorVenta[v.id] || 0,
      }));
      setVentas(ventasConCartones);
    } else {
      setVentas([]);
      setCartonesVendidos(0);
    }
  }

  useEffect(() => {
    if (ventas.length === 0) {
      setDatosGrafica([]);
      return;
    }
    const porDia: Record<string, { total: number; cartones: number }> = {};
    ventas.forEach((v) => {
      const fecha = v.sale_date.split("T")[0];
      if (!porDia[fecha]) porDia[fecha] = { total: 0, cartones: 0 };
      porDia[fecha].total += Number(v.total_amount);
      porDia[fecha].cartones += v.cartones || 0;
    });

    const datos = Object.entries(porDia)
      .map(([fecha, vals]) => ({ fecha, total: vals.total, cartones: vals.cartones }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    setDatosGrafica(datos);
  }, [ventas]);

  async function eliminarVenta(id: string) {
    if (!confirm("¿Eliminar venta?")) return;
    const { error } = await supabase.from("sales").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargarVentas();
  }

  const ventasFiltradas = ventas.filter((v) => !filtroCliente || v.customer_id === filtroCliente);
  const totalVentas = ventasFiltradas.reduce((sum, v) => sum + Number(v.total_amount), 0);
  const totalCosto = ventasFiltradas.reduce((sum, v) => sum + Number(v.total_cost), 0);
  const utilidad = totalVentas - totalCosto;
  const perdidaPorCarton = cartonesVendidos > 0 ? utilidad / cartonesVendidos : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ventas</h1>
          <p className="text-muted-foreground">Historial y análisis de ventas</p>
        </div>
        <Button onClick={() => window.location.href = "/ventas/nueva"}>+ Nueva venta</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <button
          onClick={() => setFiltro("hoy")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filtro === "hoy"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Hoy
        </button>
        <button
          onClick={() => setFiltro("semana")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filtro === "semana"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Esta semana
        </button>
        <button
          onClick={() => setFiltro("mes")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filtro === "mes"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Este mes
        </button>
        <button
          onClick={() => setFiltro("rango")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filtro === "rango"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          Rango
        </button>

        {filtro === "rango" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label className="text-xs">Cliente</Label>
          <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)}>
            <option value="">Todos los clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total ventas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${Math.round(totalVentas).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Cartones vendidos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{cartonesVendidos.toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Pérdida / cartón</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${perdidaPorCarton >= 0 ? "text-green-600" : "text-orange-600"}`}>
              ${Math.round(Math.abs(perdidaPorCarton)).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utilidad</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${utilidad >= 0 ? "text-green-600" : "text-red-600"}`}>${Math.round(utilidad).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Número de ventas</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{ventasFiltradas.length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Ventas por día</CardTitle></CardHeader>
        <CardContent>
          {datosGrafica.length === 0 ? <p className="text-muted-foreground">Sin datos</p> : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosGrafica}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                      const cartones = props.payload?.cartones || 0;
                      return [`$${Math.round(value).toLocaleString()}  |  ${Math.round(cartones).toLocaleString()} cartones`, "Total"];
                    }}
                  />
                  <Bar dataKey="total" fill="#3b82f6" name="Dinero" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Historial de ventas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ventasFiltradas.length === 0 ? <p className="text-muted-foreground">Sin ventas</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Fecha</th>
                  <th className="text-left py-3">Cliente</th>
                  <th className="text-right py-3">Cartones</th>
                  <th className="text-right py-3">Total</th>
                  <th className="text-right py-3">Utilidad</th>
                  <th className="text-right py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.map((venta) => {
                  const util = Number(venta.total_amount) - Number(venta.total_cost);
                  return (
                    <tr key={venta.id} className="border-b hover:bg-slate-50">
                      <td className="py-3">{venta.sale_date.split("T")[0]}</td>
                      <td className="py-3 font-medium">{venta.customers?.name || "-"}</td>
                      <td className="py-3 text-right font-medium">{venta.cartones || 0}</td>
                      <td className="py-3 text-right">${Math.round(Number(venta.total_amount)).toLocaleString()}</td>
                      <td className={`py-3 text-right ${util >= 0 ? "text-green-600" : "text-red-600"}`}>${Math.round(util).toLocaleString()}</td>
                      <td className="py-3 text-right">
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => window.location.href = `/ventas/${venta.id}`}
                            className="p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => window.location.href = `/ventas/${venta.id}/editar`}
                            className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => eliminarVenta(venta.id)}
                            className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}