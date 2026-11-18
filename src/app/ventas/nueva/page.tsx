"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, X } from "lucide-react";

type Cliente = { id: string; name: string };
type Producto = { id: string; name: string };
type Lote = { id: string; product_id: string; quantity_remaining: number; unit_cost: number; purchase_date: string };
type ItemVenta = { productoId: string; productoNombre: string; loteId: string; loteFecha: string; cantidad: number; costo: number; precio: number };

export default function NuevaVentaPage() {
  const router = useRouter();
  const [editarId, setEditarId] = useState<string | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState("");
  const [formaPago, setFormaPago] = useState("Efectivo");
  const [montoEfectivo, setMontoEfectivo] = useState("");
  const [montoBanco, setMontoBanco] = useState("");
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [productoId, setProductoId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [precio, setPrecio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const hoy = new Date().toISOString().split("T")[0];
    setFecha(hoy);
    cargarDatos();

    const params = new URLSearchParams(window.location.search);
    const id = params.get("editar");
    if (id) setEditarId(id);
  }, []);

  useEffect(() => {
    if (editarId) {
      cargarVentaParaEditar(editarId);
    }
  }, [editarId]);

  async function cargarDatos() {
    const { data: c } = await supabase.from("customers").select("id, name").order("name");
    const { data: p } = await supabase.from("products").select("id, name").order("name");
    setClientes(c || []);
    setProductos(p || []);
  }

  async function cargarVentaParaEditar(id: string) {
    const { data: venta } = await supabase.from("sales").select("*").eq("id", id).single();
    if (!venta) return;

    setClienteId(venta.customer_id);
    setFecha(venta.sale_date);
    setFormaPago(venta.payment_method || "Efectivo");
    setMontoEfectivo(venta.cash_amount?.toString() || "");
    setMontoBanco(venta.bank_amount?.toString() || "");

    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("*, products(name)")
      .eq("sale_id", id);

    if (saleItems) {
      const itemsCargados = saleItems.map((si: any) => ({
        productoId: si.product_id,
        productoNombre: si.products?.name || "",
        loteId: si.lot_id || "",
        loteFecha: "",
        cantidad: Number(si.quantity),
        costo: Number(si.unit_cost),
        precio: Number(si.unit_price),
      }));
      setItems(itemsCargados);
    }
  }

  useEffect(() => {
    if (productoId) cargarLotes(productoId);
    else setLotes([]);
  }, [productoId]);

  async function cargarLotes(prodId: string) {
    const { data } = await supabase
      .from("purchase_lots")
      .select("*")
      .eq("product_id", prodId)
      .gt("quantity_remaining", 0)
      .order("purchase_date", { ascending: true });
    setLotes(data || []);
  }

  function agregarItem() {
    if (!productoId || !cantidad || !precio) {
      setError("Completa producto, cantidad y precio");
      return;
    }
    const cantidadNum = Number(cantidad);
    const precioNum = Number(precio);
    const producto = productos.find((p) => p.id === productoId);
    let restante = cantidadNum;
    const nuevos: ItemVenta[] = [];

    for (const lote of lotes) {
      if (restante <= 0) break;
      const usar = Math.min(restante, Number(lote.quantity_remaining));
      if (usar > 0) {
        nuevos.push({
          productoId,
          productoNombre: producto?.name || "",
          loteId: lote.id,
          loteFecha: lote.purchase_date,
          cantidad: usar,
          costo: Number(lote.unit_cost),
          precio: precioNum,
        });
        restante -= usar;
      }
    }

    if (restante > 0) {
      setError(`No hay suficiente stock. Faltan ${restante} cartones.`);
      return;
    }

    setItems([...items, ...nuevos]);
    setProductoId("");
    setCantidad("");
    setPrecio("");
    setLotes([]);
    setError("");
  }

  function eliminarItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  const totalVenta = items.reduce((s, i) => s + i.cantidad * i.precio, 0);
  const totalCosto = items.reduce((s, i) => s + i.cantidad * i.costo, 0);
  const diferencia = totalVenta - totalCosto;

  async function guardarVenta() {
    setError("");
    if (!clienteId) {
      setError("Selecciona un cliente");
      return;
    }
    if (items.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }
    if (formaPago === "Mixta") {
      const ef = Number(montoEfectivo) || 0;
      const ba = Number(montoBanco) || 0;
      if (ef + ba !== totalVenta) {
        setError(`Efectivo ($${ef}) + Transferencia ($${ba}) debe ser $${totalVenta}`);
        return;
      }
    }

    setGuardando(true);
    try {
      const cashAmt = formaPago === "Efectivo" ? totalVenta : formaPago === "Mixta" ? Number(montoEfectivo) : 0;
      const bankAmt = formaPago === "Transferencia" ? totalVenta : formaPago === "Mixta" ? Number(montoBanco) : 0;

      if (editarId) {
        // Restaurar stock de los items anteriores antes de borrar
        const { data: itemsAnteriores } = await supabase
          .from("sale_items")
          .select("lot_id, quantity")
          .eq("sale_id", editarId);

        if (itemsAnteriores) {
          for (const item of itemsAnteriores) {
            if (item.lot_id) {
              const { data: lote } = await supabase
                .from("purchase_lots")
                .select("quantity_remaining")
                .eq("id", item.lot_id)
                .single();
              if (lote) {
                await supabase
                  .from("purchase_lots")
                  .update({ quantity_remaining: Number(lote.quantity_remaining) + Number(item.quantity) })
                  .eq("id", item.lot_id);
              }
            }
          }
        }

        // Actualizar venta
        await supabase
          .from("sales")
          .update({
            customer_id: clienteId,
            sale_date: fecha,
            total_amount: totalVenta,
            total_cost: totalCosto,
            payment_method: formaPago,
            cash_amount: cashAmt,
            bank_amount: bankAmt,
          })
          .eq("id", editarId);

        // Borrar items anteriores
        await supabase.from("sale_items").delete().eq("sale_id", editarId);

        // Insertar nuevos items y descontar de lotes
        for (const item of items) {
          await supabase.from("sale_items").insert({
            sale_id: editarId,
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
              const nuevoRemaining = Number(lote.quantity_remaining) - item.cantidad;
              if (nuevoRemaining < 0) {
                setError("Error: stock insuficiente al actualizar");
                setGuardando(false);
                return;
              }
              await supabase
                .from("purchase_lots")
                .update({ quantity_remaining: nuevoRemaining })
                .eq("id", item.loteId);
            }
          }
        }
      } else {
        // Venta nueva
        const { data: venta, error: e1 } = await supabase
          .from("sales")
          .insert({
            customer_id: clienteId,
            sale_date: fecha,
            total_amount: totalVenta,
            total_cost: totalCosto,
            payment_method: formaPago,
            cash_amount: cashAmt,
            bank_amount: bankAmt,
          })
          .select()
          .single();

        if (e1 || !venta) {
          setError("Error venta: " + (e1?.message || "desconocido"));
          setGuardando(false);
          return;
        }

        for (const item of items) {
          const { error: e2 } = await supabase.from("sale_items").insert({
            sale_id: venta.id,
            product_id: item.productoId,
            lot_id: item.loteId,
            quantity: item.cantidad,
            unit_price: item.precio,
            unit_cost: item.costo,
          });

          if (e2) {
            setError("Error item: " + e2.message);
            setGuardando(false);
            return;
          }

          if (item.loteId) {
            const { data: lote } = await supabase
              .from("purchase_lots")
              .select("quantity_remaining")
              .eq("id", item.loteId)
              .single();
            if (lote) {
              const nuevoRemaining = Number(lote.quantity_remaining) - item.cantidad;
              if (nuevoRemaining < 0) {
                setError("Error: stock insuficiente");
                setGuardando(false);
                return;
              }
              await supabase
                .from("purchase_lots")
                .update({ quantity_remaining: nuevoRemaining })
                .eq("id", item.loteId);
            }
          }
        }
      }

      router.push("/ventas");
    } catch (err: any) {
      setError("Error: " + (err.message || "desconocido"));
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{editarId ? "Editar Venta" : "Nueva Venta"}</h1>
          <p className="text-muted-foreground">{editarId ? "Modificar venta existente" : "Registrar venta"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Button onClick={guardarVenta} disabled={guardando}>
            {guardando ? "Guardando..." : editarId ? "Actualizar" : "Guardar"}
          </Button>
        </div>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Datos de la venta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
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
              </div>
              {formaPago === "Mixta" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Monto en efectivo</Label>
                    <Input
                      type="number"
                      value={montoEfectivo}
                      onChange={(e) => setMontoEfectivo(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Monto en transferencia</Label>
                    <Input
                      type="number"
                      value={montoBanco}
                      onChange={(e) => setMontoBanco(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Agregar producto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Producto</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={productoId}
                    onChange={(e) => setProductoId(e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {productos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24 space-y-2">
                  <Label>Cantidad</Label>
                  <Input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="1" />
                </div>
                <div className="w-32 space-y-2">
                  <Label>Precio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    placeholder="Precio"
                  />
                </div>
                <Button onClick={agregarItem}>Agregar</Button>
              </div>
              {lotes.length > 0 && (
                <div className="bg-slate-50 p-3 rounded-lg text-sm">
                  <p className="font-medium mb-2">Lotes disponibles (FIFO):</p>
                  {lotes.map((l, i) => (
                    <div key={l.id} className={i === 0 ? "font-medium" : "text-muted-foreground"}>
                      {i === 0 && "→ "}Fecha: {l.purchase_date} | Costo: ${Number(l.unit_cost).toFixed(2)} | Disponible:{" "}
                      {l.quantity_remaining}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Productos</CardTitle>
            </CardHeader>
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
                        <td className="py-2 text-right">${item.precio.toFixed(2)}</td>
                        <td className="py-2 text-right">{item.cantidad}</td>
                        <td className="py-2 text-right">${(item.cantidad * item.precio).toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <Button size="icon" variant="ghost" onClick={() => eliminarItem(i)}>
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
          <CardHeader>
            <CardTitle>Resumen</CardTitle>
          </CardHeader>
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