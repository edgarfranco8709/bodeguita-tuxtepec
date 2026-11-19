"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, X } from "lucide-react";

type Cliente = { id: string; name: string };
type Producto = { id: string; name: string };
type Lote = { id: string; product_id: string; quantity_remaining: number; unit_cost: number; purchase_date: string };
type ItemVenta = { 
  id?: string;
  productoId: string; 
  productoNombre: string; 
  loteId: string; 
  loteFecha: string; 
  cantidad: number; 
  costo: number; 
  precio: number;
};

export default function EditarVentaPage() {
  const params = useParams();
  const router = useRouter();
  const ventaId = params.id as string;

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoBanco, setMontoBanco] = useState("");
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [itemsOriginales, setItemsOriginales] = useState<ItemVenta[]>([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    cargar();
  }, []);

  async function cargar() {
    setLoading(true);

    const { data: cli } = await supabase.from("customers").select("id, name").order("name");
    setClientes(cli || []);

    const { data: prods } = await supabase.from("products").select("id, name").order("name");
    setProductos(prods || []);

    const { data: lotesData } = await supabase
      .from("purchase_lots")
      .select("id, product_id, quantity_remaining, unit_cost, purchase_date");
    setLotes(lotesData || []);

    const { data: venta } = await supabase
      .from("sales")
      .select("*")
      .eq("id", ventaId)
      .single();

    if (venta) {
      setClienteId(venta.customer_id);
      setFecha(venta.sale_date?.split("T")[0] || "");
      setFormaPago(venta.payment_method || "Efectivo");
      setMontoEfectivo(venta.cash_amount?.toString() || "");
      setMontoBanco(venta.bank_amount?.toString() || "");
    }

    const { data: itemsData } = await supabase
      .from("sale_items")
      .select("*, products(name), purchase_lots(purchase_date)")
      .eq("sale_id", ventaId);

    if (itemsData) {
      const itemsCargados: ItemVenta[] = itemsData.map((item) => ({
        id: item.id,
        productoId: item.product_id,
        productoNombre: item.products?.name || "",
        loteId: item.lot_id || "",
        loteFecha: item.purchase_lots?.purchase_date || "",
        cantidad: Number(item.quantity),
        costo: Number(item.unit_cost),
        precio: Number(item.unit_price),
      }));
      setItems(itemsCargados);
      setItemsOriginales(JSON.parse(JSON.stringify(itemsCargados)));
    }

    setLoading(false);
  }

  function agregarItem() {
    if (!productoId || !cantidad || !precio) return;

    const prod = productos.find((p) => p.id === productoId);
    if (!prod) return;

    const lotesProd = lotes
      .filter((l) => l.product_id === productoId && l.quantity_remaining > 0)
      .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));

    if (lotesProd.length === 0) {
      alert("No hay lotes disponibles para este producto");
      return;
    }

    const lote = lotesProd[0];
    const cantNum = Number(cantidad);

    if (cantNum > lote.quantity_remaining) {
      alert(`Solo hay ${lote.quantity_remaining} disponibles en este lote`);
      return;
    }

    setItems([
      ...items,
      {
        productoId,
        productoNombre: prod.name,
        loteId: lote.id,
        loteFecha: lote.purchase_date,
        cantidad: cantNum,
        costo: lote.unit_cost,
        precio: Number(precio),
      },
    ]);

    setProductoId("");
    setCantidad("");
    setPrecio("");
  }

  function actualizarCantidad(index: number, nuevaCantidad: number) {
    const nuevosItems = [...items];
    nuevosItems[index].cantidad = nuevaCantidad;
    setItems(nuevosItems);
  }

  function actualizarPrecio(index: number, nuevoPrecio: number) {
    const nuevosItems = [...items];
    nuevosItems[index].precio = nuevoPrecio;
    setItems(nuevosItems);
  }

  function eliminarItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  async function guardar() {
    if (!clienteId || !fecha || items.length === 0) {
      alert("Completa todos los campos");
      return;
    }

    setGuardando(true);

    // 1. Restaurar inventario de items originales
    for (const itemOrig of itemsOriginales) {
      if (itemOrig.loteId && itemOrig.cantidad > 0) {
        const { data: lote } = await supabase
          .from("purchase_lots")
          .select("quantity_remaining")
          .eq("id", itemOrig.loteId)
          .single();

        if (lote) {
          await supabase
            .from("purchase_lots")
            .update({ quantity_remaining: Number(lote.quantity_remaining) + itemOrig.cantidad })
            .eq("id", itemOrig.loteId);
        }
      }
    }

    const totalVenta = items.reduce((sum, item) => sum + item.cantidad * item.precio, 0);
    const totalCosto = items.reduce((sum, item) => sum + item.cantidad * item.costo, 0);

    // 2. Actualizar venta
    await supabase
      .from("sales")
      .update({
        customer_id: clienteId,
        sale_date: fecha,
        total_amount: totalVenta,
        total_cost: totalCosto,
        payment_method: formaPago,
        cash_amount: formaPago === "Efectivo" ? totalVenta : formaPago === "Mixta" ? Number(montoEfectivo || 0) : 0,
        bank_amount: formaPago === "Transferencia" ? totalVenta : formaPago === "Mixta" ? Number(montoBanco || 0) : 0,
      })
      .eq("id", ventaId);

    // 3. Eliminar items anteriores
    await supabase.from("sale_items").delete().eq("sale_id", ventaId);

    // 4. Insertar nuevos items y descontar inventario
    for (const item of items) {
      await supabase.from("sale_items").insert({
        sale_id: ventaId,
        product_id: item.productoId,
        lot_id: item.loteId || null,
        quantity: item.cantidad,
        unit_price: item.precio,
        unit_cost: item.costo,
      });

      if (item.loteId) {
        const { data: lote } = await supabase
          .from("purchase_lots")
          .select("quantity_remaining")
          .eq("id", item.loteId)
          .single();

        if (lote) {
          await supabase
            .from("purchase_lots")
            .update({ quantity_remaining: Number(lote.quantity_remaining) - item.cantidad })
            .eq("id", item.loteId);
        }
      }
    }

    setGuardando(false);
    router.push("/ventas");
  }

  const totalVenta = items.reduce((sum, item) => sum + item.cantidad * item.precio, 0);
  const totalCosto = items.reduce((sum, item) => sum + item.cantidad * item.costo, 0);
  const diferencia = totalVenta - totalCosto;

  if (loading) {
    return <div className="flex items-center justify-center h-64">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar Venta</h1>
          <p className="text-muted-foreground">Modificar venta existente</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/ventas")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Volver
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Datos de la venta</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Forma de pago</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formaPago}
                  onChange={(e) => setFormaPago(e.target.value)}
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Mixta">Mixta</option>
                </select>
              </div>
              {formaPago === "Mixta" && (
                <>
                  <div className="space-y-2">
                    <Label>Monto efectivo</Label>
                    <Input type="number" value={montoEfectivo} onChange={(e) => setMontoEfectivo(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto transferencia</Label>
                    <Input type="number" value={montoBanco} onChange={(e) => setMontoBanco(e.target.value)} />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Agregar producto</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Producto</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={productoId}
                  onChange={(e) => setProductoId(e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cantidad</Label>
                <Input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Precio</Label>
                <Input type="number" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" />
              </div>
              <div className="md:col-span-4">
                <Button onClick={agregarItem}>Agregar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Productos</CardTitle></CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <p className="text-muted-foreground">Sin productos</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Producto</th>
                      <th className="text-left py-2">Lote</th>
                      <th className="text-right py-2">Costo</th>
                      <th className="text-right py-2">Precio</th>
                      <th className="text-right py-2">Cant.</th>
                      <th className="text-right py-2">Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-2">{item.productoNombre}</td>
                        <td className="py-2">{item.loteFecha || "-"}</td>
                        <td className="py-2 text-right">${item.costo.toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.precio}
                            onChange={(e) => actualizarPrecio(i, Number(e.target.value))}
                            className="w-24 text-right ml-auto h-8"
                          />
                        </td>
                        <td className="py-2 text-right">
                          <Input
                            type="number"
                            value={item.cantidad}
                            onChange={(e) => actualizarCantidad(i, Number(e.target.value))}
                            className="w-20 text-right ml-auto h-8"
                          />
                        </td>
                        <td className="py-2 text-right font-medium">
                          ${(item.cantidad * item.precio).toLocaleString()}
                        </td>
                        <td className="py-2 text-right">
                          <Button variant="ghost" size="icon" onClick={() => eliminarItem(i)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Resumen</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span>Total Venta</span>
              <span className="font-bold text-lg">${totalVenta.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Costo</span>
              <span>${totalCosto.toLocaleString()}</span>
            </div>
            <div className="border-t pt-4 flex justify-between">
              <span className="font-medium">{diferencia >= 0 ? "Ganancia" : "Diferencia"}</span>
              <span className={`font-bold text-lg ${diferencia >= 0 ? "text-green-600" : "text-orange-600"}`}>
                ${diferencia.toLocaleString()}
              </span>
            </div>
            {formaPago === "Mixta" && (
              <div className="border-t pt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Efectivo</span>
                  <span>${Number(montoEfectivo || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Transferencia</span>
                  <span>${Number(montoBanco || 0).toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}