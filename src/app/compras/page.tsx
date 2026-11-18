"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Pencil, Trash2, Home as HomeIcon, Printer, Plus } from "lucide-react";
import * as XLSX from "xlsx";

type Producto = { id: string; name: string };
type Proveedor = { id: string; name: string };
type Lote = {
  id: string;
  product_id: string;
  quantity_initial: number;
  quantity_remaining: number;
  unit_cost: number;
  purchase_date: string;
  supplier: string | null;
  payment_method: string | null;
  cash_amount: number | null;
  bank_amount: number | null;
  products: { name: string } | null;
};
type ItemTemp = {
  productoId: string;
  nombre: string;
  cantidad: number;
  costo: number;
};
type Filtro = "hoy" | "semana" | "mes" | "rango";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

export default function ComprasPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [productoId, setProductoId] = useState("");
  const [proveedorId, setProveedorId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [fecha, setFecha] = useState("");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoBanco, setMontoBanco] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [editando, setEditando] = useState<Lote | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [mostrarProveedores, setMostrarProveedores] = useState(false);
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [editandoProveedor, setEditandoProveedor] = useState<Proveedor | null>(null);
  const [nombreProveedorEdit, setNombreProveedorEdit] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [editandoGrupo, setEditandoGrupo] = useState<{ fecha: string; proveedor: string } | null>(null);
  const [nuevaFechaGrupo, setNuevaFechaGrupo] = useState("");
  const [nuevoProveedorGrupo, setNuevoProveedorGrupo] = useState("");
  const [nuevaFormaPagoGrupo, setNuevaFormaPagoGrupo] = useState("Efectivo");
  const [nuevoMontoEfGrupo, setNuevoMontoEfGrupo] = useState("");
  const [nuevoMontoBaGrupo, setNuevoMontoBaGrupo] = useState("");
  const [itemsTemp, setItemsTemp] = useState<ItemTemp[]>([]);

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setFecha(hoy);
  }, []);

  async function cargarDatos() {
    const { data: prods } = await supabase.from("products").select("id, name").order("name");
    const { data: provs } = await supabase.from("suppliers").select("id, name").order("name");
    setProductos(prods || []);
    setProveedores(provs || []);
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

  async function cargarLotes() {
    const rango = obtenerRango(filtro);
    let query = supabase.from("purchase_lots").select("*, products(name)").order("purchase_date", { ascending: false });
    if (rango.inicio) query = query.gte("purchase_date", rango.inicio);
    if (rango.fin) query = query.lte("purchase_date", rango.fin);
    const { data } = await query;
    setLotes(data || []);
  }

  useEffect(() => { cargarDatos(); cargarLotes(); }, [filtro, fechaInicio, fechaFin]);

  async function crearProveedor() {
    if (!nuevoProveedor.trim()) return;
    const { error } = await supabase.from("suppliers").insert({ name: nuevoProveedor.trim() });
    if (error) alert("Error: " + error.message);
    else { setNuevoProveedor(""); cargarDatos(); }
  }

  function iniciarEdicionProveedor(prov: Proveedor) {
    setEditandoProveedor(prov);
    setNombreProveedorEdit(prov.name);
  }

  async function guardarEdicionProveedor() {
    if (!editandoProveedor || !nombreProveedorEdit.trim()) return;
    const { error } = await supabase.from("suppliers").update({ name: nombreProveedorEdit.trim() }).eq("id", editandoProveedor.id);
    if (error) alert("Error: " + error.message);
    else { setEditandoProveedor(null); setNombreProveedorEdit(""); cargarDatos(); }
  }

  async function eliminarProveedor(id: string) {
    if (!confirm("¿Eliminar proveedor?")) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargarDatos();
  }

  function irAInicio() { setMostrarForm(false); setMostrarProveedores(false); setEditando(null); setEditandoGrupo(null); setFiltro("mes"); setItemsTemp([]); }

  const cantidadNum = Number(cantidad) || 0;
  const costoNum = Number(costoUnitario) || 0;
  const productoSeleccionado = productos.find((p) => p.id === productoId);
  const proveedorSeleccionado = proveedores.find((p) => p.id === proveedorId);

  function agregarItem() {
    if (!productoId || !cantidad || !costoUnitario) { alert("Completa producto, cantidad y costo"); return; }
    const existe = itemsTemp.find((i) => i.productoId === productoId);
    if (existe) { alert("Este producto ya está en la lista"); return; }
    setItemsTemp([...itemsTemp, { productoId, nombre: productoSeleccionado?.name || "", cantidad: cantidadNum, costo: costoNum }]);
    setProductoId("");
    setCantidad("");
    setCostoUnitario("");
  }

  function quitarItem(idx: number) {
    setItemsTemp(itemsTemp.filter((_, i) => i !== idx));
  }

  const totalCompra = itemsTemp.reduce((sum, i) => sum + i.cantidad * i.costo, 0);

  async function registrarCompra() {
    if (itemsTemp.length === 0) { alert("Agrega al menos un producto"); return; }
    if (!proveedorId) { alert("Selecciona proveedor"); return; }
    if (formaPago === "Mixta") {
      const ef = Number(montoEfectivo) || 0;
      const ba = Number(montoBanco) || 0;
      if (Math.abs(ef + ba - totalCompra) > 0.01) { alert(`Suma debe ser $${totalCompra.toFixed(2)}`); return; }
    }
    setGuardando(true);
    
    for (const item of itemsTemp) {
      const totalItem = item.cantidad * item.costo;
      const proporcion = totalCompra > 0 ? totalItem / totalCompra : 0;
      let cashAmt = 0, bankAmt = 0;
      if (formaPago === "Efectivo") cashAmt = totalItem;
      else if (formaPago === "Transferencia") bankAmt = totalItem;
      else if (formaPago === "Mixta") {
        cashAmt = Number(montoEfectivo) * proporcion;
        bankAmt = Number(montoBanco) * proporcion;
      }
      await supabase.from("purchase_lots").insert({
        product_id: item.productoId,
        quantity_initial: item.cantidad,
        quantity_remaining: item.cantidad,
        unit_cost: item.costo,
        purchase_date: fecha,
        supplier: proveedorSeleccionado?.name || null,
        payment_method: formaPago,
        cash_amount: cashAmt,
        bank_amount: bankAmt,
      });
    }
    
    alert("Compra registrada");
    limpiarFormulario();
    cargarLotes();
    setGuardando(false);
  }

  function iniciarEdicion(lote: Lote) {
    setEditando(lote);
    setProductoId(lote.product_id);
    const prov = proveedores.find((p) => p.name === lote.supplier);
    setProveedorId(prov?.id || "");
    setCantidad(lote.quantity_initial.toString());
    setCostoUnitario(lote.unit_cost.toString());
    setFecha(lote.purchase_date);
    setFormaPago(lote.payment_method || "Efectivo");
    setMontoEfectivo(lote.cash_amount?.toString() || "");
    setMontoBanco(lote.bank_amount?.toString() || "");
    setItemsTemp([]);
    setMostrarForm(true);
  }

  async function guardarEdicion() {
    if (!editando || !productoId || !cantidad || !costoUnitario) { alert("Completa los campos"); return; }
    setGuardando(true);
    const total = cantidadNum * costoNum;
    const { error } = await supabase.from("purchase_lots").update({
      product_id: productoId, quantity_initial: cantidadNum, unit_cost: costoNum,
      purchase_date: fecha, supplier: proveedorSeleccionado?.name || null, payment_method: formaPago,
      cash_amount: formaPago === "Efectivo" ? total : formaPago === "Mixta" ? Number(montoEfectivo) : 0,
      bank_amount: formaPago === "Transferencia" ? total : formaPago === "Mixta" ? Number(montoBanco) : 0,
    }).eq("id", editando.id);
    if (error) alert("Error: " + error.message);
    else { alert("Actualizado"); limpiarFormulario(); cargarLotes(); }
    setGuardando(false);
  }

  async function eliminarCompra(id: string) {
    if (!confirm("¿Eliminar producto de la compra?")) return;
    const { error } = await supabase.from("purchase_lots").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargarLotes();
  }

  function limpiarFormulario() {
    setEditando(null); setProductoId(""); setProveedorId(""); setCantidad("");
    setCostoUnitario(""); setFormaPago("Efectivo");
    setMontoEfectivo(""); setMontoBanco(""); setMostrarForm(false);
    setItemsTemp([]);
  }

  function iniciarEdicionGrupo(fecha: string, proveedor: string) {
    setEditandoGrupo({ fecha, proveedor });
    setNuevaFechaGrupo(fecha);
    setNuevoProveedorGrupo(proveedor);
    const lotesDelGrupo = lotes.filter(
      (l) => l.purchase_date === fecha && (l.supplier || "Sin proveedor") === proveedor
    );
    if (lotesDelGrupo.length > 0) {
      setNuevaFormaPagoGrupo(lotesDelGrupo[0].payment_method || "Efectivo");
      const totalEf = lotesDelGrupo.reduce((sum, l) => sum + Number(l.cash_amount || 0), 0);
      const totalBa = lotesDelGrupo.reduce((sum, l) => sum + Number(l.bank_amount || 0), 0);
      setNuevoMontoEfGrupo(totalEf.toString());
      setNuevoMontoBaGrupo(totalBa.toString());
    }
  }

  async function guardarEdicionGrupo() {
    if (!editandoGrupo) return;
    const lotesDelGrupo = lotes.filter(
      (l) => l.purchase_date === editandoGrupo.fecha && (l.supplier || "Sin proveedor") === editandoGrupo.proveedor
    );
    const totalGrupo = lotesDelGrupo.reduce((sum, l) => sum + l.quantity_initial * l.unit_cost, 0);
    
    for (const lote of lotesDelGrupo) {
      const proporcion = totalGrupo > 0 ? (lote.quantity_initial * lote.unit_cost) / totalGrupo : 0;
      let cashAmt = 0, bankAmt = 0;
      
      if (nuevaFormaPagoGrupo === "Efectivo") {
        cashAmt = lote.quantity_initial * lote.unit_cost;
      } else if (nuevaFormaPagoGrupo === "Transferencia") {
        bankAmt = lote.quantity_initial * lote.unit_cost;
      } else if (nuevaFormaPagoGrupo === "Mixta") {
        cashAmt = Number(nuevoMontoEfGrupo) * proporcion;
        bankAmt = Number(nuevoMontoBaGrupo) * proporcion;
      }
      
      await supabase.from("purchase_lots").update({
        purchase_date: nuevaFechaGrupo,
        supplier: nuevoProveedorGrupo,
        payment_method: nuevaFormaPagoGrupo,
        cash_amount: cashAmt,
        bank_amount: bankAmt,
      }).eq("id", lote.id);
    }
    setEditandoGrupo(null);
    cargarLotes();
  }

  async function eliminarGrupo(fecha: string, proveedor: string) {
    if (!confirm(`¿Eliminar toda la compra del ${fecha} de ${proveedor}?`)) return;
    const lotesDelGrupo = lotes.filter(
      (l) => l.purchase_date === fecha && (l.supplier || "Sin proveedor") === proveedor
    );
    for (const lote of lotesDelGrupo) {
      await supabase.from("purchase_lots").delete().eq("id", lote.id);
    }
    cargarLotes();
  }

  function agregarProductoAGrupo(fecha: string, proveedor: string) {
    setEditando(null);
    setFecha(fecha);
    const prov = proveedores.find((p) => p.name === proveedor);
    setProveedorId(prov?.id || "");
    setProductoId("");
    setCantidad("");
    setCostoUnitario("");
    setItemsTemp([]);
    setMostrarForm(true);
  }

  function exportarExcel() {
    const datos = lotesFiltrados.map((l) => ({
      Fecha: l.purchase_date, Producto: l.products?.name || "-", Proveedor: l.supplier || "-",
      Cantidad: l.quantity_initial, CostoUnitario: l.unit_cost, Total: l.quantity_initial * l.unit_cost,
      Pago: l.payment_method || "Efectivo",
    }));
    const ws = XLSX.utils.json_to_sheet(datos);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Compras");
    XLSX.writeFile(wb, `Compras_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  function imprimir() { window.print(); }

  const lotesFiltrados = lotes.filter((l) => {
    if (filtroProducto && l.product_id !== filtroProducto) return false;
    const supplierLower = (l.supplier || "").toLowerCase();
    if (supplierLower.includes("inventario")) return false;
    return true;
  });
  const totalCompras = lotesFiltrados.reduce((sum, l) => sum + l.quantity_initial * l.unit_cost, 0);
  const totalCartones = lotesFiltrados.reduce((sum, l) => sum + l.quantity_initial, 0);

  const comprasPorProducto = lotesFiltrados.reduce((acc, lote) => {
    const nombre = lote.products?.name || "Sin nombre";
    acc[nombre] = (acc[nombre] || 0) + lote.quantity_initial * lote.unit_cost;
    return acc;
  }, {} as Record<string, number>);

  const datosGrafica = Object.entries(comprasPorProducto).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const porFechaProveedor: Record<string, { productos: Lote[]; total: number; cantidad: number }> = {};
  lotesFiltrados.forEach((l) => {
    const key = `${l.purchase_date}|${l.supplier || "Sin proveedor"}`;
    if (!porFechaProveedor[key]) porFechaProveedor[key] = { productos: [], total: 0, cantidad: 0 };
    porFechaProveedor[key].productos.push(l);
    porFechaProveedor[key].total += l.quantity_initial * l.unit_cost;
    porFechaProveedor[key].cantidad += l.quantity_initial;
  });
  const grupos = Object.entries(porFechaProveedor).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="space-y-6 print:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={irAInicio} className="print:hidden"><HomeIcon className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-3xl font-bold">Compras</h1>
            <p className="text-muted-foreground">Análisis y registro de compras</p>
          </div>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={imprimir}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={exportarExcel}>Exportar Excel</Button>
          <Button variant="outline" onClick={() => { setMostrarProveedores(!mostrarProveedores); setMostrarForm(false); }}>Proveedores</Button>
          <Button onClick={() => { setMostrarForm(!mostrarForm); setMostrarProveedores(false); setEditando(null); setItemsTemp([]); }}>+ Nueva Compra</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end print:hidden">
        <button onClick={() => setFiltro("hoy")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "hoy" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Hoy</button>
        <button onClick={() => setFiltro("semana")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "semana" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Esta semana</button>
        <button onClick={() => setFiltro("mes")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "mes" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Este mes</button>
        <button onClick={() => setFiltro("rango")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filtro === "rango" ? "bg-emerald-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>Rango</button>
        {filtro === "rango" && (
          <>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
          </>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Producto</Label>
          <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)}>
            <option value="">Todos los productos</option>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      {mostrarProveedores && (
        <Card className="print:hidden">
          <CardHeader><CardTitle>Proveedores</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input value={nuevoProveedor} onChange={(e) => setNuevoProveedor(e.target.value)} placeholder="Nombre del proveedor" />
              <Button onClick={crearProveedor}>Crear</Button>
            </div>
            <div className="space-y-2">
              {proveedores.map((prov) => (
                <div key={prov.id} className="flex items-center justify-between border-b py-2">
                  {editandoProveedor?.id === prov.id ? (
                    <div className="flex gap-2 flex-1">
                      <Input value={nombreProveedorEdit} onChange={(e) => setNombreProveedorEdit(e.target.value)} className="h-8" />
                      <Button size="sm" onClick={guardarEdicionProveedor}>Guardar</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditandoProveedor(null)}>Cancelar</Button>
                    </div>
                  ) : (
                    <>
                      <span>{prov.name}</span>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => iniciarEdicionProveedor(prov)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => eliminarProveedor(prov.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {editandoGrupo && (
        <Card>
          <CardHeader><CardTitle>Editar compra completa</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={nuevaFechaGrupo} onChange={(e) => setNuevaFechaGrupo(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={nuevoProveedorGrupo} onChange={(e) => setNuevoProveedorGrupo(e.target.value)}>
                  <option value="">Selecciona proveedor</option>
                  {proveedores.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Forma de pago</Label>
              <select className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm" value={nuevaFormaPagoGrupo} onChange={(e) => setNuevaFormaPagoGrupo(e.target.value)}>
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia">Transferencia</option>
                <option value="Mixta">Mixta</option>
              </select>
            </div>
            {nuevaFormaPagoGrupo === "Mixta" && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Monto en efectivo</Label><Input type="number" value={nuevoMontoEfGrupo} onChange={(e) => setNuevoMontoEfGrupo(e.target.value)} /></div>
                <div className="space-y-2"><Label>Monto en transferencia</Label><Input type="number" value={nuevoMontoBaGrupo} onChange={(e) => setNuevoMontoBaGrupo(e.target.value)} /></div>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={guardarEdicionGrupo}>Guardar cambios</Button>
              <Button variant="outline" onClick={() => setEditandoGrupo(null)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {mostrarForm && !editando && (
        <div className="grid gap-6 md:grid-cols-2 print:hidden">
          <Card>
            <CardHeader><CardTitle>Agregar productos a la compra</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                  <option value="">Selecciona</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Forma de pago</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Mixta">Mixta</option>
                </select>
              </div>
              {formaPago === "Mixta" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Efectivo</Label><Input type="number" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Transferencia</Label><Input type="number" value={montoBanco} onChange={(e) => setMontoBanco(e.target.value)} /></div>
                </div>
              )}
              <div className="border-t pt-4">
                <Label className="text-sm font-medium">Agregar producto</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <select className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                    <option value="">Producto</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Input type="number" placeholder="Cantidad" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
                  <Input type="number" step="0.01" placeholder="Costo" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} />
                </div>
                <Button className="mt-2" variant="outline" onClick={agregarItem}>+ Agregar a lista</Button>
              </div>
              {itemsTemp.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  <div className="text-sm font-medium">Productos en esta compra:</div>
                  {itemsTemp.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm border-b pb-1">
                      <span>{item.nombre}</span>
                      <span>{item.cantidad} x ${item.costo.toFixed(2)} = ${(item.cantidad * item.costo).toLocaleString()}</span>
                      <Button size="icon" variant="ghost" onClick={() => quitarItem(idx)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </div>
                  ))}
                  <div className="flex justify-between font-bold pt-2">
                    <span>Total:</span>
                    <span>${totalCompra.toLocaleString()}</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={registrarCompra} disabled={guardando || itemsTemp.length === 0}>{guardando ? "Guardando..." : "Guardar compra"}</Button>
                <Button variant="outline" onClick={limpiarFormulario}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Proveedor</span><span className="font-medium">{proveedorSeleccionado?.name || "-"}</span></div>
              <div className="flex justify-between"><span>Fecha</span><span className="font-medium">{fecha}</span></div>
              <div className="flex justify-between"><span>Forma de pago</span><span className="font-medium">{formaPago}</span></div>
              <div className="flex justify-between"><span>Productos</span><span className="font-medium">{itemsTemp.length}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>${totalCompra.toLocaleString()}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      {mostrarForm && editando && (
        <div className="grid gap-6 md:grid-cols-2 print:hidden">
          <Card>
            <CardHeader><CardTitle>Editar producto</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Producto</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={productoId} onChange={(e) => setProductoId(e.target.value)}>
                  <option value="">Selecciona</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Proveedor</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
                  <option value="">Selecciona</option>
                  {proveedores.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Cantidad</Label><Input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
                <div className="space-y-2"><Label>Costo unitario</Label><Input type="number" step="0.01" value={costoUnitario} onChange={(e) => setCostoUnitario(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Forma de pago</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Mixta">Mixta</option>
                </select>
              </div>
              {formaPago === "Mixta" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Efectivo</Label><Input type="number" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Transferencia</Label><Input type="number" value={montoBanco} onChange={(e) => setMontoBanco(e.target.value)} /></div>
                </div>
              )}
              <div className="flex gap-2">
                <Button className="flex-1" onClick={guardarEdicion} disabled={guardando}>{guardando ? "Guardando..." : "Actualizar"}</Button>
                <Button variant="outline" onClick={limpiarFormulario}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span>Producto</span><span className="font-medium">{productoSeleccionado?.name || "-"}</span></div>
              <div className="flex justify-between"><span>Proveedor</span><span className="font-medium">{proveedorSeleccionado?.name || "-"}</span></div>
              <div className="flex justify-between"><span>Cantidad</span><span className="font-medium">{cantidadNum} cartones</span></div>
              <div className="flex justify-between"><span>Costo unitario</span><span className="font-medium">${costoNum.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold"><span>Total</span><span>${(cantidadNum * costoNum).toLocaleString()}</span></div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total compras</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.round(totalCompras).toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">{totalCartones.toLocaleString()} cartones</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top productos</CardTitle></CardHeader>
          <CardContent>
            {datosGrafica.length === 0 ? <p className="text-sm text-muted-foreground">Sin datos</p> : (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={datosGrafica} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40} label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {datosGrafica.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()}`} />
                    <Legend layout="vertical" align="right" verticalAlign="middle" formatter={(v) => v.length > 20 ? v.substring(0, 18) + "..." : v} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Compras por fecha y proveedor</CardTitle></CardHeader>
        <CardContent>
          {grupos.length === 0 ? <p className="text-muted-foreground">Sin compras</p> : (
            <div className="space-y-2">
              {grupos.map(([key, data]) => {
                const [fecha, proveedor] = key.split("|");
                return (
                  <details key={key} className="border rounded-lg">
                    <summary className="p-3 cursor-pointer hover:bg-slate-50 flex justify-between items-center">
                      <div>
                        <span className="font-medium">{fecha}</span>
                        <span className="text-muted-foreground ml-2">• {proveedor}</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-sm text-muted-foreground">{data.cantidad} cartones</span>
                        <span className="font-bold">${data.total.toLocaleString()}</span>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); iniciarEdicionGrupo(fecha, proveedor); }} title="Editar compra"><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); agregarProductoAGrupo(fecha, proveedor); }} title="Agregar producto"><Plus className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={(e) => { e.preventDefault(); eliminarGrupo(fecha, proveedor); }} title="Eliminar compra"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                      </div>
                    </summary>
                    <div className="border-t p-3 bg-slate-50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-muted-foreground">
                            <th className="text-left py-1">Producto</th>
                            <th className="text-right py-1">Cantidad</th>
                            <th className="text-right py-1">Costo</th>
                            <th className="text-right py-1">Total</th>
                            <th className="text-right py-1">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.productos.map((p) => (
                            <tr key={p.id}>
                              <td className="py-1">{p.products?.name || "-"}</td>
                              <td className="py-1 text-right">{p.quantity_initial}</td>
                              <td className="py-1 text-right">${p.unit_cost.toFixed(2)}</td>
                              <td className="py-1 text-right">${(p.quantity_initial * p.unit_cost).toLocaleString()}</td>
                              <td className="py-1 text-right">
                                <Button size="icon" variant="ghost" onClick={() => iniciarEdicion(p)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                                <Button size="icon" variant="ghost" onClick={() => eliminarCompra(p.id)} title="Eliminar"><Trash2 className="h-4 w-4 text-red-500" /></Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}