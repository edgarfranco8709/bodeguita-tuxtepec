"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Home as HomeIcon, Wallet, Building2 } from "lucide-react";

export default function CierrePage() {
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(true);
  const [ventasEfectivo, setVentasEfectivo] = useState(0);
  const [ventasBanco, setVentasBanco] = useState(0);
  const [comprasEfectivo, setComprasEfectivo] = useState(0);
  const [comprasBanco, setComprasBanco] = useState(0);
  const [gastosEfectivo, setGastosEfectivo] = useState(0);
  const [gastosBanco, setGastosBanco] = useState(0);
  const [saldoEfectivo, setSaldoEfectivo] = useState(0);
  const [saldoBanco, setSaldoBanco] = useState(0);

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setFecha(hoy);
  }, []);

  useEffect(() => {
    if (fecha) cargar();
  }, [fecha]);

  async function cargar() {
    setLoading(true);

    const { data: ventas } = await supabase
      .from("sales")
      .select("total_amount, cash_amount, bank_amount, payment_method")
      .gte("sale_date", fecha)
      .lte("sale_date", fecha);

    let vEf = 0, vBa = 0;
    if (ventas) {
      ventas.forEach((v) => {
        if (v.payment_method === "Efectivo") vEf += Number(v.total_amount);
        else if (v.payment_method === "Transferencia") vBa += Number(v.total_amount);
        else if (v.payment_method === "Mixta") {
          vEf += Number(v.cash_amount || 0);
          vBa += Number(v.bank_amount || 0);
        }
      });
    }
    setVentasEfectivo(vEf);
    setVentasBanco(vBa);

    const { data: compras } = await supabase
      .from("purchase_lots")
      .select("quantity_initial, unit_cost, cash_amount, bank_amount, payment_method")
      .gte("purchase_date", fecha)
      .lte("purchase_date", fecha);

    let cEf = 0, cBa = 0;
    if (compras) {
      compras.forEach((c) => {
        const total = Number(c.quantity_initial) * Number(c.unit_cost);
        if (c.payment_method === "Efectivo") cEf += total;
        else if (c.payment_method === "Transferencia") cBa += total;
        else if (c.payment_method === "Mixta") {
          cEf += Number(c.cash_amount || 0);
          cBa += Number(c.bank_amount || 0);
        }
      });
    }
    setComprasEfectivo(cEf);
    setComprasBanco(cBa);

    const { data: gastos } = await supabase
      .from("expenses")
      .select("amount, cash_amount, bank_amount, payment_method")
      .gte("expense_date", fecha)
      .lte("expense_date", fecha);

    let gEf = 0, gBa = 0;
    if (gastos) {
      gastos.forEach((g) => {
        if (g.payment_method === "Efectivo") gEf += Number(g.amount);
        else if (g.payment_method === "Transferencia") gBa += Number(g.amount);
        else if (g.payment_method === "Mixta") {
          gEf += Number(g.cash_amount || 0);
          gBa += Number(g.bank_amount || 0);
        }
      });
    }
    setGastosEfectivo(gEf);
    setGastosBanco(gBa);

    const { data: caja } = await supabase.from("cash_balance").select("*").single();
    if (caja) {
      setSaldoEfectivo(Number(caja.cash_balance || 0));
      setSaldoBanco(Number(caja.bank_balance || 0));
    }

    setLoading(false);
  }

  function imprimir() { window.print(); }

  function irAInicio() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const netoEfectivo = ventasEfectivo - comprasEfectivo - gastosEfectivo;
  const netoBanco = ventasBanco - comprasBanco - gastosBanco;
  const totalIngresos = ventasEfectivo + ventasBanco;
  const totalEgresos = comprasEfectivo + comprasBanco + gastosEfectivo + gastosBanco;
  const netoDia = netoEfectivo + netoBanco;

  return (
    <div className="space-y-6 print:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={irAInicio} className="print:hidden">
            <HomeIcon className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Cierre de Caja</h1>
            <p className="text-muted-foreground">Resumen del día</p>
          </div>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="icon" onClick={imprimir}>
            <Printer className="h-4 w-4" />
          </Button>
          <Label>Fecha</Label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-40" />
        </div>
      </div>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="bg-green-50 border-green-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-green-700">Total ingresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">${Math.round(totalIngresos).toLocaleString()}</div>
                <p className="text-xs text-green-600/70">Ventas del día</p>
              </CardContent>
            </Card>
            <Card className="bg-red-50 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-red-700">Total egresos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">${Math.round(totalEgresos).toLocaleString()}</div>
                <p className="text-xs text-red-600/70">Compras + Gastos</p>
              </CardContent>
            </Card>
            <Card className={`${netoDia >= 0 ? "bg-blue-50 border-blue-200" : "bg-orange-50 border-orange-200"}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-sm font-medium ${netoDia >= 0 ? "text-blue-700" : "text-orange-700"}`}>Neto del día</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${netoDia >= 0 ? "text-blue-600" : "text-orange-600"}`}>
                  ${Math.round(netoDia).toLocaleString()}
                </div>
                <p className={`text-xs ${netoDia >= 0 ? "text-blue-600/70" : "text-orange-600/70"}`}>Resultado</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" />
                <CardTitle>Efectivo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between"><span>Ventas</span><span className="text-green-600 font-medium">+${Math.round(ventasEfectivo).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Compras</span><span className="text-red-600 font-medium">-${Math.round(comprasEfectivo).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Gastos</span><span className="text-red-600 font-medium">-${Math.round(gastosEfectivo).toLocaleString()}</span></div>
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Neto del día</span>
                  <span className={netoEfectivo >= 0 ? "text-green-600" : "text-red-600"}>${Math.round(netoEfectivo).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground bg-slate-50 p-2 rounded">
                  <span>Saldo actual</span>
                  <span className="font-medium">${Math.round(saldoEfectivo).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                <CardTitle>Banco / Transferencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between"><span>Ventas</span><span className="text-green-600 font-medium">+${Math.round(ventasBanco).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Compras</span><span className="text-red-600 font-medium">-${Math.round(comprasBanco).toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Gastos</span><span className="text-red-600 font-medium">-${Math.round(gastosBanco).toLocaleString()}</span></div>
                <div className="border-t pt-3 flex justify-between font-bold text-lg">
                  <span>Neto del día</span>
                  <span className={netoBanco >= 0 ? "text-green-600" : "text-red-600"}>${Math.round(netoBanco).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground bg-slate-50 p-2 rounded">
                  <span>Saldo actual</span>
                  <span className="font-medium">${Math.round(saldoBanco).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}