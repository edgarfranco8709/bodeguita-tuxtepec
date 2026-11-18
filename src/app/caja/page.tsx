"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Building2, Plus, Minus, ArrowRightLeft } from "lucide-react";

type Movimiento = {
  id: string;
  movement_date: string;
  type: string;
  amount: number;
  description: string | null;
  source: string;
};

type Filtro = "hoy" | "semana" | "mes" | "rango";
type FiltroFuente = "todos" | "efectivo" | "banco";

export default function CajaPage() {
  const [loading, setLoading] = useState(true);
  const [saldoInicialEf, setSaldoInicialEf] = useState(0);
  const [saldoInicialBa, setSaldoInicialBa] = useState(0);
  const [saldoEfectivo, setSaldoEfectivo] = useState(0);
  const [saldoBanco, setSaldoBanco] = useState(0);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [tipo, setTipo] = useState("entrada");
  const [fuente, setFuente] = useState("efectivo");
  const [destino, setDestino] = useState("banco");
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState("");
  const [saldoEfectivoEdit, setSaldoEfectivoEdit] = useState("");
  const [saldoBancoEdit, setSaldoBancoEdit] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("mes");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [editandoSaldo, setEditandoSaldo] = useState(false);
  const [filtroFuente, setFiltroFuente] = useState<FiltroFuente>("todos");

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setFecha(hoy);
  }, []);

  function obtenerRango(filtro: Filtro) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    if (filtro === "hoy") {
      return { inicio: hoy.toISOString().split("T")[0], fin: hoy.toISOString().split("T")[0] };
    }
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

    const { data: caja } = await supabase.from("cash_balance").select("*").single();
    const inicialEf = Number(caja?.cash_balance || 0);
    const inicialBa = Number(caja?.bank_balance || 0);
    setSaldoInicialEf(inicialEf);
    setSaldoInicialBa(inicialBa);
    setSaldoEfectivoEdit(String(inicialEf));
    setSaldoBancoEdit(String(inicialBa));

    const { data: ventas } = await supabase.from("sales").select("id, sale_date, total_amount, cash_amount, bank_amount, payment_method");
    const { data: compras } = await supabase.from("purchase_lots").select("id, purchase_date, quantity_initial, unit_cost, cash_amount, bank_amount, payment_method, supplier").or("supplier.is.null,supplier.not.ilike.%inventario%");
    const { data: gastos } = await supabase.from("expenses").select("id, expense_date, amount, cash_amount, bank_amount, payment_method");
    const { data: movs } = await supabase.from("cash_movements").select("*");

    const todosMovimientos: Movimiento[] = [];

    if (ventas) {
      ventas.forEach((v) => {
        const cashAmt = v.payment_method === "Efectivo" ? Number(v.total_amount) : v.payment_method === "Mixta" ? Number(v.cash_amount || 0) : 0;
        const bankAmt = v.payment_method === "Transferencia" ? Number(v.total_amount) : v.payment_method === "Mixta" ? Number(v.bank_amount || 0) : 0;
        if (cashAmt > 0) todosMovimientos.push({ id: `venta-ef-${v.id}`, movement_date: v.sale_date, type: "entrada", amount: cashAmt, description: "Venta (efectivo)", source: "efectivo" });
        if (bankAmt > 0) todosMovimientos.push({ id: `venta-ba-${v.id}`, movement_date: v.sale_date, type: "entrada", amount: bankAmt, description: "Venta (transferencia)", source: "banco" });
      });
    }

    if (compras) {
      compras.forEach((c) => {
        const total = Number(c.quantity_initial) * Number(c.unit_cost);
        const cashAmt = c.payment_method === "Efectivo" ? total : c.payment_method === "Mixta" ? Number(c.cash_amount || 0) : 0;
        const bankAmt = c.payment_method === "Transferencia" ? total : c.payment_method === "Mixta" ? Number(c.bank_amount || 0) : 0;
        if (cashAmt > 0) todosMovimientos.push({ id: `compra-ef-${c.id}`, movement_date: c.purchase_date, type: "salida", amount: cashAmt, description: "Compra (efectivo)", source: "efectivo" });
        if (bankAmt > 0) todosMovimientos.push({ id: `compra-ba-${c.id}`, movement_date: c.purchase_date, type: "salida", amount: bankAmt, description: "Compra (transferencia)", source: "banco" });
      });
    }

    if (gastos) {
      gastos.forEach((g) => {
        const cashAmt = g.payment_method === "Efectivo" ? Number(g.amount) : g.payment_method === "Mixta" ? Number(g.cash_amount || 0) : 0;
        const bankAmt = g.payment_method === "Transferencia" ? Number(g.amount) : g.payment_method === "Mixta" ? Number(g.bank_amount || 0) : 0;
        if (cashAmt > 0) todosMovimientos.push({ id: `gasto-ef-${g.id}`, movement_date: g.expense_date, type: "salida", amount: cashAmt, description: "Gasto (efectivo)", source: "efectivo" });
        if (bankAmt > 0) todosMovimientos.push({ id: `gasto-ba-${g.id}`, movement_date: g.expense_date, type: "salida", amount: bankAmt, description: "Gasto (transferencia)", source: "banco" });
      });
    }

    if (movs) todosMovimientos.push(...movs);

    const rango = obtenerRango(filtro);
    let movimientosFiltrados = todosMovimientos.filter((m) => {
      const fechaMov = m.movement_date?.split("T")[0] || "";
      if (rango.inicio && fechaMov < rango.inicio) return false;
      if (rango.fin && fechaMov > rango.fin) return false;
      return true;
    });

    if (filtroFuente !== "todos") {
      movimientosFiltrados = movimientosFiltrados.filter((m) => m.source === filtroFuente);
    }

    let entradasEf = 0, entradasBa = 0, salidasEf = 0, salidasBa = 0;
    const movimientosPeriodo = todosMovimientos.filter((m) => {
      const fechaMov = m.movement_date?.split("T")[0] || "";
      if (rango.inicio && fechaMov < rango.inicio) return false;
      if (rango.fin && fechaMov > rango.fin) return false;
      return true;
    });

    movimientosPeriodo.forEach((m) => {
      if (m.type === "entrada") {
        if (m.source === "efectivo") entradasEf += Number(m.amount);
        else entradasBa += Number(m.amount);
      } else if (m.type === "salida") {
        if (m.source === "efectivo") salidasEf += Number(m.amount);
        else salidasBa += Number(m.amount);
      }
    });

    const saldoEfFinal = inicialEf + entradasEf - salidasEf;
    const saldoBaFinal = inicialBa + entradasBa - salidasBa;

    setSaldoEfectivo(saldoEfFinal);
    setSaldoBanco(saldoBaFinal);

    movimientosFiltrados.sort((a, b) => (b.movement_date || "").localeCompare(a.movement_date || ""));
    setMovimientos(movimientosFiltrados);

    setLoading(false);
  }

  useEffect(() => { cargar(); }, [filtro, fechaInicio, fechaFin, filtroFuente]);

  async function registrarMovimiento() {
    if (!monto || Number(monto) <= 0) { alert("Ingresa un monto válido"); return; }
    const montoNum = Number(monto);

    const { error } = await supabase.from("cash_movements").insert({
      movement_date: fecha,
      type: tipo,
      amount: montoNum,
      description: descripcion || null,
      source: fuente,
      account: fuente,
    });

    if (error) { alert("Error: " + error.message); return; }

    setMonto("");
    setDescripcion("");
    setMostrarForm(false);
    cargar();
  }

  async function guardarSaldos() {
    const { error } = await supabase.from("cash_balance").update({
      cash_balance: Number(saldoEfectivoEdit) || 0,
      bank_balance: Number(saldoBancoEdit) || 0,
    }).eq("id", 1);

    if (error) alert("Error: " + error.message);
    else { setEditandoSaldo(false); cargar(); }
  }

  async function transferir() {
    if (!monto || Number(monto) <= 0) { alert("Ingresa un monto válido"); return; }
    const montoNum = Number(monto);

    const { error: error1 } = await supabase.from("cash_movements").insert({
      movement_date: fecha,
      type: "salida",
      amount: montoNum,
      description: descripcion ? `${descripcion} (salida)` : `Transferencia a ${destino}`,
      source: fuente,
      account: fuente,
    });

    if (error1) { alert("Error: " + error1.message); return; }

    const { error: error2 } = await supabase.from("cash_movements").insert({
      movement_date: fecha,
      type: "entrada",
      amount: montoNum,
      description: descripcion ? `${descripcion} (entrada)` : `Transferencia de ${fuente}`,
      source: destino,
      account: destino,
    });

    if (error2) { alert("Error: " + error2.message); return; }

    setMonto("");
    setDescripcion("");
    setMostrarForm(false);
    cargar();
  }

  const totalEntradas = movimientos.filter((m) => m.type === "entrada").reduce((s, m) => s + Number(m.amount), 0);
  const totalSalidas = movimientos.filter((m) => m.type === "salida").reduce((s, m) => s + Number(m.amount), 0);

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Caja</h1>
          <p className="text-muted-foreground">Control de efectivo y banco</p>
        </div>
        <Button onClick={() => setMostrarForm(!mostrarForm)}>+ Movimiento</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Efectivo</CardTitle>
            <Wallet className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            {editandoSaldo ? (
              <Input type="number" value={saldoEfectivoEdit} onChange={(e) => setSaldoEfectivoEdit(e.target.value)} className="text-2xl font-bold" />
            ) : (
              <>
                <div className={`text-3xl font-bold ${saldoEfectivo >= 0 ? "text-green-600" : "text-red-600"}`}>${Math.round(saldoEfectivo).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Inicial: ${Math.round(saldoInicialEf).toLocaleString()}</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Banco</CardTitle>
            <Building2 className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            {editandoSaldo ? (
              <Input type="number" value={saldoBancoEdit} onChange={(e) => setSaldoBancoEdit(e.target.value)} className="text-2xl font-bold" />
            ) : (
              <>
                <div className={`text-3xl font-bold ${saldoBanco >= 0 ? "text-blue-600" : "text-red-600"}`}>${Math.round(saldoBanco).toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Inicial: ${Math.round(saldoInicialBa).toLocaleString()}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2">
        {editandoSaldo ? (
          <>
            <Button onClick={guardarSaldos}>Guardar saldos</Button>
            <Button variant="outline" onClick={() => setEditandoSaldo(false)}>Cancelar</Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => setEditandoSaldo(true)}>Ajustar saldos iniciales</Button>
        )}
      </div>

      {mostrarForm && (
        <Card>
          <CardHeader><CardTitle>Nuevo movimiento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
                  <option value="entrada">Entrada</option>
                  <option value="salida">Salida</option>
                  <option value="transferencia">Transferencia</option>
                </select>
              </div>
              {tipo === "transferencia" ? (
                <>
                  <div className="space-y-2">
                    <Label>De</Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fuente} onChange={(e) => { setFuente(e.target.value); setDestino(e.target.value === "efectivo" ? "banco" : "efectivo"); }}>
                      <option value="efectivo">Efectivo</option>
                      <option value="banco">Banco</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>A</Label>
                    <div className="flex h-10 items-center px-3 rounded-md border bg-slate-50 text-sm font-medium">
                      {destino === "efectivo" ? "Efectivo" : "Banco"}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label>Fuente</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={fuente} onChange={(e) => setFuente(e.target.value)}>
                    <option value="efectivo">Efectivo</option>
                    <option value="banco">Banco</option>
                  </select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Monto</Label>
                <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del movimiento" />
              </div>
            </div>
            <div className="flex gap-2">
              {tipo === "transferencia" ? (
                <Button onClick={transferir}><ArrowRightLeft className="h-4 w-4 mr-2" />Transferir</Button>
              ) : (
                <Button onClick={registrarMovimiento}>
                  {tipo === "entrada" ? <Plus className="h-4 w-4 mr-2" /> : <Minus className="h-4 w-4 mr-2" />}
                  Registrar
                </Button>
              )}
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <Button variant={filtro === "hoy" ? "default" : "outline"} onClick={() => setFiltro("hoy")}>Hoy</Button>
        <Button variant={filtro === "semana" ? "default" : "outline"} onClick={() => setFiltro("semana")}>Esta semana</Button>
        <Button variant={filtro === "mes" ? "default" : "outline"} onClick={() => setFiltro("mes")}>Este mes</Button>
        <Button variant={filtro === "rango" ? "default" : "outline"} onClick={() => setFiltro("rango")}>Rango</Button>
        {filtro === "rango" && (
          <>
            <div className="space-y-1"><Label className="text-xs">Desde</Label><Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Hasta</Label><Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} /></div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setFiltroFuente("todos")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtroFuente === "todos" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
        >
          Todos
        </button>
        <button
          onClick={() => setFiltroFuente("efectivo")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filtroFuente === "efectivo" ? "bg-green-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-green-50"}`}
        >
          <Wallet className="h-4 w-4" /> Efectivo
        </button>
        <button
          onClick={() => setFiltroFuente("banco")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filtroFuente === "banco" ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-blue-50"}`}
        >
          <Building2 className="h-4 w-4" /> Banco
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Entradas del período</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">${Math.round(totalEntradas).toLocaleString()}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-red-600">Salidas del período</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">${Math.round(totalSalidas).toLocaleString()}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Movimientos {filtroFuente !== "todos" ? `(${filtroFuente})` : ""}</CardTitle></CardHeader>
        <CardContent>
          {movimientos.length === 0 ? <p className="text-muted-foreground">Sin movimientos</p> : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Fecha</th>
                  <th className="text-left py-3">Tipo</th>
                  <th className="text-left py-3">Fuente</th>
                  <th className="text-left py-3">Descripción</th>
                  <th className="text-right py-3">Monto</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} className="border-b">
                    <td className="py-3">{mov.movement_date?.split("T")[0]}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${mov.type === "entrada" ? "bg-green-100 text-green-700" : mov.type === "salida" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}>
                        {mov.type}
                      </span>
                    </td>
                    <td className="py-3">{mov.source}</td>
                    <td className="py-3">{mov.description || "-"}</td>
                    <td className={`py-3 text-right font-medium ${mov.type === "entrada" ? "text-green-600" : mov.type === "salida" ? "text-red-600" : ""}`}>
                      ${Math.round(Number(mov.amount)).toLocaleString()}
                    </td>
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