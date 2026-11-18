"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Package } from "lucide-react";

type Producto = {
  id: string;
  name: string;
  stock?: number;
  valor?: number;
};

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [nombre, setNombre] = useState("");
  const [editando, setEditando] = useState<Producto | null>(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [stockTotal, setStockTotal] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);

  async function cargar() {
    const { data: prods } = await supabase.from("products").select("id, name").order("name");
    const { data: lotes } = await supabase.from("purchase_lots").select("product_id, quantity_initial, quantity_remaining, quantity_merma, unit_cost");
    const { data: inicial } = await supabase.from("initial_inventory").select("product_id, quantity, unit_cost");
    const { data: ventasItems } = await supabase.from("sale_items").select("product_id, quantity");

    const productosConStock = (prods || []).map((p) => {
      const lotesProd = lotes?.filter((l) => l.product_id === p.id) || [];
      const totalLotes = lotesProd.reduce((sum, l) => sum + Number(l.quantity_initial), 0);
      const mermaProd = lotesProd.reduce((sum, l) => sum + Number(l.quantity_merma || 0), 0);
      const valorLotes = lotesProd.reduce((sum, l) => sum + Number(l.quantity_remaining) * Number(l.unit_cost), 0);

      const invInicial = inicial?.find((i) => i.product_id === p.id);
      const stockInicial = Number(invInicial?.quantity || 0);

      const totalCompras = Math.max(0, totalLotes - stockInicial);

      const ventasProd = ventasItems?.filter((v) => v.product_id === p.id) || [];
      const totalVentas = ventasProd.reduce((sum, v) => sum + Number(v.quantity), 0);

      const stockCalculado = Math.max(0, stockInicial + totalCompras - totalVentas - mermaProd);

      return {
        ...p,
        stock: stockCalculado,
        valor: valorLotes,
      };
    });

    setProductos(productosConStock);

    const totalStock = productosConStock.reduce((sum, p) => sum + (p.stock || 0), 0);
    const totalValor = productosConStock.reduce((sum, p) => sum + (p.valor || 0), 0);
    setStockTotal(totalStock);
    setValorTotal(totalValor);
  }

  useEffect(() => { cargar(); }, []);

  async function guardar() {
    if (!nombre.trim()) { alert("Ingresa el nombre"); return; }
    
    if (editando) {
      const { error } = await supabase.from("products").update({
        name: nombre.trim(),
      }).eq("id", editando.id);
      if (error) alert("Error: " + error.message);
      else { alert("Actualizado"); limpiar(); cargar(); }
    } else {
      const { error } = await supabase.from("products").insert({
        name: nombre.trim(),
      });
      if (error) alert("Error: " + error.message);
      else { alert("Producto creado"); limpiar(); cargar(); }
    }
  }

  function iniciarEdicion(prod: Producto) {
    setEditando(prod);
    setNombre(prod.name);
    setMostrarForm(true);
  }

  async function eliminarProducto(id: string) {
    if (!confirm("¿Eliminar producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargar();
  }

  function limpiar() {
    setEditando(null);
    setNombre("");
    setMostrarForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Productos</h1>
          <p className="text-muted-foreground">Catálogo y stock actual</p>
        </div>
        <Button onClick={() => { setMostrarForm(!mostrarForm); setEditando(null); }}>
          + Nuevo producto
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Total</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">cartones en inventario</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${Math.round(valorTotal).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">valor total en stock</p>
          </CardContent>
        </Card>
      </div>

      {mostrarForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editando ? "Editar producto" : "Nuevo producto"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del producto" />
            </div>
            <div className="flex gap-2">
              <Button onClick={guardar}>{editando ? "Actualizar" : "Guardar"}</Button>
              <Button variant="outline" onClick={limpiar}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Lista de productos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productos.length === 0 ? (
            <p className="text-muted-foreground">Sin productos</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3">Producto</th>
                  <th className="text-right py-3">Stock</th>
                  <th className="text-right py-3">Valor</th>
                  <th className="text-right py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productos.map((prod) => (
                  <tr key={prod.id} className="border-b hover:bg-slate-50">
                    <td className="py-3 font-medium">{prod.name}</td>
                    <td className="py-3 text-right font-medium">{(prod.stock || 0).toLocaleString()}</td>
                    <td className="py-3 text-right">${Math.round(prod.valor || 0).toLocaleString()}</td>
                    <td className="py-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => iniciarEdicion(prod)}
                          className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => eliminarProducto(prod.id)}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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