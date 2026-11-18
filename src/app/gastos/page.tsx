"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Pencil, Trash2, Home as HomeIcon, Printer, Settings, Fuel, Truck, Zap, Users, Package, MoreHorizontal, Wrench } from "lucide-react";
import * as XLSX from "xlsx";

type Categoria = { id: string; name: string; icon: string | null };
type Gasto = {
  id: string;
  amount: number;
  description: string | null;
  expense_date: string;
  category_id: string | null;
  payment_method: string | null;
  cash_amount: number | null;
  bank_amount: number | null;
  categoria_nombre?: string;
};
type Filtro = "hoy" | "semana" | "mes" | "rango";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

const ICONOS: Record<string, any> = {
  "combustible": Fuel,
  "gas": Fuel,
  "transporte": Truck,
  "compras": Package,
  "mantenimiento": Wrench,
  "servicios": Zap,
  "luz": Zap,
  "renta": HomeIcon,
  "sueldos": Users,
  "nómina": Users,
  "nomina": Users,
  "otros": MoreHorizontal,
};

function getIcono(nombre: string) {
  const nombreLower = nombre.toLowerCase();
  for (const key of Object.keys(ICONOS)) {
    if (nombreLower.includes(key)) return ICONOS[key];
  }
  return MoreHorizontal;
}

export default function GastosPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarCategorias, setMostrarCategorias] = useState(false);
  const [categoriaId, setCategoriaId] = useState("");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoBanco, setMontoBanco] = useState("");
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [nuevaCategoria, setNuevaCategoria] = useState("");
  const [editandoCategoria, setEditandoCategoria] = useState<Categoria | null>(null);
  const [nombreCategoriaEdit, setNombreCategoriaEdit] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setFecha(hoy);
  }, []);

  async function cargarCategorias() {
    const { data } = await supabase.from("expense_categories").select("*").order("name");
    setCategorias(data || []);
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

  async function cargarGastos() {
    setLoading(true);
    const rango = obtenerRango(filtro);
    let query = supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (rango.inicio) query = query.gte("expense_date", rango.inicio);
    if (rango.fin) query = query.lte("expense_date", rango.fin);
    if (filtroCategoria) query = query.eq("category_id", filtroCategoria);
    const { data } = await query;
    
    const gastosConCategoria = (data || []).map((g) => {
      const cat = categorias.find((c) => c.id === g.category_id);
      return { ...g, categoria_nombre: cat?.name || "Sin categoría" };
    });
    
    setGastos(gastosConCategoria);
    setLoading(false);
  }

  useEffect(() => { cargarCategorias(); }, []);
  useEffect(() => { if (categorias.length > 0) cargarGastos(); }, [filtro, fechaInicio, fechaFin, categorias, filtroCategoria]);

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return;
    const { error } = await supabase.from("expense_categories").insert({ name: nuevaCategoria.trim() });
    if (error) alert("Error: " + error.message);
    else { setNuevaCategoria(""); cargarCategorias(); }
  }

  function iniciarEdicionCategoria(cat: Categoria) {
    setEditandoCategoria(cat);
    setNombreCategoriaEdit(cat.name);
  }

  async function guardarEdicionCategoria() {
    if (!editandoCategoria || !nombreCategoriaEdit.trim()) return;
    const { error } = await supabase.from("expense_categories").update({ name: nombreCategoriaEdit.trim() }).eq("id", editandoCategoria.id);
    if (error) alert("Error: " + error.message);
    else { setEditandoCategoria(null); setNombreCategoriaEdit(""); cargarCategorias(); }
  }

  async function eliminarCategoria(id: string) {
    if (!confirm("¿Eliminar categoría?")) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargarCategorias();
  }

  async function registrarGasto() {
    if (!monto || Number(monto) <= 0) { alert("Ingresa un monto válido"); return; }
    const montoNum = Number(monto);
    if (formaPago === "Mixta") {
      const ef = Number(montoEfectivo) || 0;
      const ba = Number(montoBanco) || 0;
      if (ef + ba !== montoNum) { alert(`Suma debe ser $${montoNum}`); return; }
    }
    const datos = {
      amount: montoNum,
      description: descripcion || null,
      expense_date: fecha,
      category_id: categoriaId || null,
      payment_method: formaPago,
      cash_amount: formaPago === "Efectivo" ? montoNum : formaPago === "Mixta" ? Number(montoEfectivo) : 0,
      bank_amount: formaPago === "Transferencia" ? montoNum : formaPago === "Mixta" ? Number(montoBanco) : 0,
    };
    if (editando) {
      const { error } = await supabase.from("expenses").update(datos).eq("id", editando.id);
      if (error) alert("Error: " + error.message);
    } else {
      const { error } = await supabase.from("expenses").insert(datos);
      if (error) alert("Error: " + error.message);
    }
    limpiarFormulario();
    cargarGastos();
  }

  function iniciarEdicion(gasto: Gasto) {
    setEditando(gasto);
    setMonto(gasto.amount.toString());
    setDescripcion(gasto.description || "");
    setFecha(gasto.expense_date);
    setCategoriaId(gasto.category_id || "");
    setFormaPago(gasto.payment_method || "Efectivo");
    setMontoEfectivo(gasto.cash_amount?.toString() || "");
    setMontoBanco(gasto.bank_amount?.toString() || "");
    setMostrarForm(true);
  }

  async function eliminarGasto(id: string) {
    if (!confirm("¿Eliminar gasto?")) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargarGastos();
  }

  function limpiarFormulario() {
    setEditando(null);
    setMonto("");
    setDescripcion("");
    setCategoriaId("");
    setFormaPago("Efectivo");
    setMontoEfectivo("");
    setMontoBanco("");
    setMostrarForm(false);
  }

  function irAInicio() {
    setMostrarForm(false);
    setMostrarCategorias(false);
    setFiltro("semana");
    setFiltroCategoria("");
  }

  function exportarExcel() {
    const datos = gastos.map((g) => ({
      Fecha: g.expense_date,
      Categoría: g.categoria_nombre || "-",
      Descripción: g.description || "-",
      Monto: g.amount,
      Pago: g.payment_method || "Efectivo",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Gastos");
    XLSX.writeFile(wb, `Gastos_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  function imprimir() { window.print(); }

  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.amount), 0);
  const gastosPorCategoria = gastos.reduce((acc, g) => {
    const nombre = g.categoria_nombre || "Sin categoría";
    acc[nombre] = (acc[nombre] || 0) + Number(g.amount);
    return acc;
  }, {} as Record<string, number>);
  const datosGrafica = Object.entries(gastosPorCategoria).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const top10 = datosGrafica.slice(0, 10);

  const categoriaSeleccionada = categorias.find((c) => c.id === filtroCategoria);

  return (
    <div className="space-y-6 print:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={irAInicio} className="print:hidden"><HomeIcon className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold">Gastos</h1>
            <p className="text-muted-foreground">Control de gastos del negocio</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={imprimir}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={exportarExcel}>Exportar</Button>
          <Button variant="outline" onClick={() => { setMostrarCategorias(!mostrarCategorias); setMostrarForm(false); }}><Settings className="h-4 w-4 mr-2" />Categorías</Button>
          <Button onClick={() => { setMostrarForm(!mostrarForm); setMostrarCategorias(false); setEditando(null); }}>+ Nuevo gasto</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end print:hidden">
        {(["hoy", "semana", "mes", "rango"] as Filtro[]).map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === f ? "bg-red-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
            {f === "hoy" ? "Hoy" : f === "semana" ? "Esta semana" : f === "mes" ? "Este mes" : "Rango"}
          </button>
        ))}
        {filtro === "rango" && (
          <>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center print:hidden">
        <Label className="text-sm">Filtrar por categoría:</Label>
        <select
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm min-w-[200px]"
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {filtroCategoria && (
          <Button variant="ghost" size="sm" onClick={() => setFiltroCategoria("")}>Limpiar</Button>
        )}
      </div>

      {mostrarCategorias && (
        <Card className="print:hidden">
          <CardHeader><CardTitle>Categorías</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={nuevaCategoria} onChange={(e) => setNuevaCategoria(e.target.value)} placeholder="Nueva categoría" />
              <Button onClick={crearCategoria}>Crear</Button>
            </div>
            <div className="space-y-2">
              {categorias.map((cat) => {
                const Icono = getIcono(cat.name);
                return (
                  <div key={cat.id} className="flex items-center justify-between border-b py-3">
                    {editandoCategoria?.id === cat.id ? (
                      <div className="flex gap-2 flex-1">
                        <Input value={nombreCategoriaEdit} onChange={(e) => setNombreCategoriaEdit(e.target.value)} className="h-8" />
                        <Button size="sm" onClick={guardarEdicionCategoria}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditandoCategoria(null)}>Cancelar</Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg"><Icono className="h-5 w-5 text-slate-600" /></div>
                          <span className="font-medium">{cat.name}</span>
                        </span>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => iniciarEdicionCategoria(cat)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => eliminarCategoria(cat.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {mostrarForm && (
        <Card className="print:hidden">
          <CardHeader><CardTitle>{editando ? "Editar gasto" : "Nuevo gasto"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Monto</Label><Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Descripción</Label><Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción" /></div>
              <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
              <Label>Forma de pago</Label>
              <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>
            {formaPago === "Mixta" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Efectivo</Label><Input type="number" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} /></div>
                <div className="space-y-2"><Label>Transferencia</Label><Input type="number" value={montoBanco} onChange={(e) => setMontoBanco(e.target.value)} /></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={registrarGasto}>{editando ? "Actualizar" : "Registrar"}</Button>
              <Button variant="outline" onClick={limpiarFormulario}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">{filtroCategoria ? `Total ${categoriaSeleccionada?.name || ""}` : "Total gastos"}</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">${Math.round(totalGastos).toLocaleString()}</div></CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-1"><CardTitle className="text-sm font-medium">Top 10 categorías</CardTitle></CardHeader>
          <CardContent className="pt-0">
            {top10.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
              <div className="space-y-0.5">
                {top10.map((cat, i) => {
                  const Icono = getIcono(cat.name);
                  return (
                    <div key={i} className="flex justify-between items-center text-sm py-1">
                      <span className="flex items-center gap-2">
                        <Icono className="h-4 w-4 text-slate-500" />
                        <span>{i + 1}. {cat.name}</span>
                      </span>
                      <span className="font-medium">${Math.round(cat.value).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {datosGrafica.length > 0 && !filtroCategoria && (
        <Card>
          <CardHeader><CardTitle>Distribución por categoría</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={datosGrafica} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {datosGrafica.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `$${Math.round(Number(v)).toLocaleString()}`} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Historial de gastos
            {filtroCategoria && categoriaSeleccionada && (
              <span className="ml-2 text-base font-normal text-muted-foreground">- {categoriaSeleccionada.name}</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : gastos.length === 0 ? <p className="text-muted-foreground">Sin gastos</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Fecha</th>
                  <th className="text-left py-3">Categoría</th>
                  <th className="text-left py-3">Descripción</th>
                  <th className="text-right py-3 pr-8">Monto</th>
                  <th className="text-left py-3 pl-8">Pago</th>
                  <th className="text-right py-3 print:hidden">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {gastos.map((gasto) => {
                  const Icono = getIcono(gasto.categoria_nombre || "");
                  return (
                    <tr key={gasto.id} className="border-b">
                      <td className="py-3">{gasto.expense_date}</td>
                      <td className="py-3">
                        <span className="flex items-center gap-2">
                          <Icono className="h-4 w-4 text-slate-500" />
                          {gasto.categoria_nombre || "-"}
                        </span>
                      </td>
                      <td className="py-3">{gasto.description || "-"}</td>
                      <td className="py-3 text-right font-medium pr-8">${Math.round(Number(gasto.amount)).toLocaleString()}</td>
                      <td className="py-3 pl-8">{gasto.payment_method || "Efectivo"}</td>
                      <td className="py-3 text-right print:hidden">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => iniciarEdicion(gasto)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => eliminarGasto(gasto.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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