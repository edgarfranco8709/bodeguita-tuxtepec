"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Cliente = { id: string; name: string };
type Producto = { id: string; name: string };
type Item = { id: string; product_id: string; quantity: number; unit_price: number; unit_cost: number; lot_id: string | null };

function EditarVentaPageContent() {
  const params = useParams();
  const router = useRouter();
  const ventaId = params.id as string;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoBanco, setMontoBanco] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);
    const { data: cli } = await supabase.from("customers").select("id, name").order("name");
    const { data: prods } = await supabase.from("products").select("id, name").order("name");
    setClientes(cli || []);
    setProductos(prods || []);

    const { data: venta } = await supabase.from("sales").select("*").eq("id", ventaId).single();
    if (venta) {
      setClienteId(venta.customer_id);
      setFecha(venta.sale_date.split("T")[0]);
      setFormaPago(venta.payment_method || "Efectivo");
      setMontoEfectivo(venta.cash_amount?.toString() || "");
      setMontoBanco(venta.bank_amount?.toString() || "");
    }

    const { data: saleItems } = await supabase.from("sale_items").select("*").eq("sale_id", ventaId);
    if (saleItems && saleItems.length > 0) {
      setItems(saleItems.map((i) => ({
        id: i.id,
        product_id: i.product_id,
        quantity: Number(i.quantity),
        unit_price: Number(i.unit_price),
        unit_cost: Number(i.unit_cost || 0),
        lot_id: i.lot_id,
      })));
    } else {
      setItems([{ id: "", product_id: "", quantity: 1, unit_price: 0, unit_cost: 0, lot_id: null }]);
    }
    setLoading(false);
  }

  function actualizarItem(index: number, campo: string, valor: string) {
    const nuevos = [...items];
    if (campo === "quantity" || campo === "unit_price") {
      (nuevos[index] as any)[campo] = Number(valor) || 0;
    } else {
      (nuevos[index] as any)[campo] = valor;
    }
    setItems(nuevos);
  }

  function agregarItem() {
    setItems([...items, { id: "", product_id: "", quantity: 1, unit_price: 0, unit_cost: 0, lot_id: null }]);
  }

  function eliminarItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  const total = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0);
  const totalCosto = items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0);

  async function guardar() {
    if (!clienteId || items.filter(i => i.product_id).length === 0) {
      alert("Completa cliente y al menos un producto");
      return;
    }
    setGuardando(true);

    const { error: errVenta } = await supabase.from("sales").update({
      customer_id: clienteId,
      sale_date: fecha,
      total_amount: total,
      total_cost: totalCosto,
      payment_method: formaPago,
      cash_amount: formaPago === "Efectivo" ? total : formaPago === "Mixta" ? Number(montoEfectivo) : 0,
      bank_amount: formaPago === "Transferencia" ? total : formaPago === "Mixta" ? Number(montoBanco) : 0,
    }).eq("id", ventaId);

    if (errVenta) {
      alert("Error: " + errVenta.message);
      setGuardando(false);
      return;
    }

    await supabase.from("sale_items").delete().eq("sale_id", ventaId);

    const itemsValidos = items.filter(i => i.product_id && i.quantity > 0);
    for (const item of itemsValidos) {
      await supabase.from("sale_items").insert({
        sale_id: ventaId,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        unit_cost: item.unit_cost,
        lot_id: item.lot_id,
      });
    }

    alert("Venta actualizada");
    router.push("/ventas");
    setGuardando(false);
  }

  if (loading) return <div className="p-6">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Editar venta</h1>
        <Button variant="outline" onClick={() => router.push("/ventas")}>Cancelar</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Datos de la venta</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                <option value="">Selecciona</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Productos</CardTitle>
          <Button size="sm" onClick={agregarItem}>+ Agregar</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="grid gap-2 md:grid-cols-5 items-end border-b pb-3">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Producto</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={item.product_id} onChange={(e) => actualizarItem(i, "product_id", e.target.value)}>
                  <option value="">Selecciona</option>
                  {productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input type="number" value={item.quantity} onChange={(e) => actualizarItem(i, "quantity", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Precio</Label>
                <Input type="number" step="0.01" value={item.unit_price} onChange={(e) => actualizarItem(i, "unit_price", e.target.value)} />
              </div>
              <Button variant="outline" size="sm" onClick={() => eliminarItem(i)}>Quitar</Button>
            </div>
          ))}
          <div className="flex justify-end pt-2">
            <div className="text-lg font-bold">Total: ${Math.round(total).toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={guardar} disabled={guardando} className="w-full">
        {guardando ? "Guardando..." : "Guardar cambios"}
      </Button>
    </div>
  );
}

export default function EditarVentaPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <EditarVentaPageContent />
    </Suspense>
  );
}