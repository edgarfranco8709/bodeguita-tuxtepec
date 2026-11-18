"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";

type Venta = {
  id: string;
  sale_date: string;
  total_amount: number;
  total_cost: number;
  payment_method: string | null;
  cash_amount: number | null;
  bank_amount: number | null;
  customers: { name: string } | null;
};

type Item = {
  id: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  products: { name: string } | null;
};

function DetalleVentaContent() {
  const params = useParams();
  const router = useRouter();
  const [venta, setVenta] = useState<Venta | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    if (id) cargar();
  }, [id]);

  async function cargar() {
    setLoading(true);

    const { data: v } = await supabase
      .from("sales")
      .select("*, customers(name)")
      .eq("id", id)
      .single();

    const { data: i } = await supabase
      .from("sale_items")
      .select("*, products(name)")
      .eq("sale_id", id);

    setVenta(v);
    setItems(i || []);
    setLoading(false);
  }

  async function eliminarVenta() {
    if (!confirm("¿Eliminar esta venta? Se restaurará el inventario.")) return;

    const { data: saleItems } = await supabase
      .from("sale_items")
      .select("lot_id, quantity")
      .eq("sale_id", id);

    if (saleItems) {
      for (const item of saleItems) {
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

    await supabase.from("sale_items").delete().eq("sale_id", id);
    await supabase.from("sales").delete().eq("id", id);

    router.push("/ventas");
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!venta) return <div className="p-6">Venta no encontrada</div>;

  const totalCartones = items.reduce((s, i) => s + Number(i.quantity), 0);
  const diferencia = Number(venta.total_amount) - Number(venta.total_cost);
  const fechaLimpia = venta.sale_date ? venta.sale_date.split("T")[0] : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Detalle de Venta</h1>
          <p className="text-muted-foreground">{venta.customers?.name || "Cliente"}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          <Button variant="outline" onClick={() => router.push(`/ventas/nueva?editar=${id}`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="destructive" onClick={eliminarVenta}>
            <Trash2 className="h-4 w-4 mr-2" />
            Eliminar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fecha</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fechaLimpia}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Venta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Number(venta.total_amount).toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cartones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCartones.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Diferencia</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${diferencia >= 0 ? "text-green-600" : "text-orange-600"}`}>
              ${diferencia.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Productos</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3">Producto</th>
                <th className="text-right py-3">Cantidad</th>
                <th className="text-right py-3">Precio</th>
                <th className="text-right py-3">Costo</th>
                <th className="text-right py-3">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-3">{item.products?.name || "-"}</td>
                  <td className="py-3 text-right">{item.quantity}</td>
                  <td className="py-3 text-right">${Number(item.unit_price).toFixed(2)}</td>
                  <td className="py-3 text-right">${Number(item.unit_cost).toFixed(2)}</td>
                  <td className="py-3 text-right">${(Number(item.quantity) * Number(item.unit_price)).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {venta.payment_method && (
        <Card>
          <CardHeader>
            <CardTitle>Forma de pago</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Método</span>
                <span className="font-medium">{venta.payment_method}</span>
              </div>
              {venta.payment_method === "Mixta" && (
                <>
                  <div className="flex justify-between">
                    <span>Efectivo</span>
                    <span>${Number(venta.cash_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transferencia</span>
                    <span>${Number(venta.bank_amount || 0).toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DetalleVentaPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <DetalleVentaContent />
    </Suspense>
  );
}