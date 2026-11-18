"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Search, X } from "lucide-react";

type Cliente = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
};

type Venta = {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: string | null;
};

type SaleItem = {
  sale_id: string;
  quantity: number;
  products: { name: string } | null;
};

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [ventasCliente, setVentasCliente] = useState<Venta[]>([]);
  const [itemsCliente, setItemsCliente] = useState<SaleItem[]>([]);

  async function cargar() {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("name");
    setClientes(data || []);
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  async function verHistorial(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    const { data: ventas } = await supabase
      .from("sales")
      .select("*")
      .eq("customer_id", cliente.id)
      .order("sale_date", { ascending: false });
    setVentasCliente(ventas || []);

    if (ventas && ventas.length > 0) {
      const ids = ventas.map((v) => v.id);
      const { data: items } = await supabase
        .from("sale_items")
        .select("sale_id, quantity, products(name)")
        .in("sale_id", ids);
      setItemsCliente(items || []);
    } else {
      setItemsCliente([]);
    }
  }

  function abrirNuevo() {
    setEditando(null);
    setNombre("");
    setTelefono("");
    setDireccion("");
    setMostrarForm(true);
  }

  function iniciarEdicion(cliente: Cliente) {
    setEditando(cliente);
    setNombre(cliente.name);
    setTelefono(cliente.phone || "");
    setDireccion(cliente.address || "");
    setMostrarForm(true);
  }

  async function guardar() {
    if (!nombre.trim()) { alert("El nombre es obligatorio"); return; }

    if (editando) {
      const { error } = await supabase.from("customers").update({
        name: nombre.trim(),
        phone: telefono.trim() || null,
        address: direccion.trim() || null,
      }).eq("id", editando.id);
      if (error) alert("Error: " + error.message);
    } else {
      const { error } = await supabase.from("customers").insert({
        name: nombre.trim(),
        phone: telefono.trim() || null,
        address: direccion.trim() || null,
      });
      if (error) alert("Error: " + error.message);
    }
    setMostrarForm(false);
    setEditando(null);
    cargar();
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este cliente?")) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) alert("Error: " + error.message);
    else cargar();
  }

  const clientesFiltrados = clientes.filter((c) =>
    c.name.toLowerCase().includes(busqueda.toLowerCase()) ||
    (c.phone && c.phone.includes(busqueda)) ||
    (c.address && c.address.toLowerCase().includes(busqueda.toLowerCase()))
  );

  const totalCartonesCliente = itemsCliente.reduce((sum, i) => sum + Number(i.quantity), 0);
  const totalVentasCliente = ventasCliente.reduce((sum, v) => sum + Number(v.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Administra tu cartera de clientes</p>
        </div>
        <Button onClick={abrirNuevo}>+ Nuevo Cliente</Button>
      </div>

      {/* Buscador */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre, teléfono o dirección..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pl-10"
        />
      </div>

      {mostrarForm && (
        <Card>
          <CardHeader><CardTitle>{editando ? "Editar cliente" : "Nuevo cliente"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" />
            </div>
            <div className="space-y-2">
              <Label>Dirección</Label>
              <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Dirección (opcional)" />
            </div>
            <div className="flex gap-2">
              <Button onClick={guardar}>{editando ? "Actualizar" : "Guardar"}</Button>
              <Button variant="outline" onClick={() => setMostrarForm(false)}>Cancelar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lista de clientes */}
        <Card>
          <CardHeader>
            <CardTitle>
              {clientesFiltrados.length} cliente{clientesFiltrados.length !== 1 && "s"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p>Cargando...</p> : clientesFiltrados.length === 0 ? (
              <p className="text-muted-foreground">{busqueda ? "No se encontraron clientes" : "Sin clientes"}</p>
            ) : (
              <div className="space-y-2">
                {clientesFiltrados.map((cliente) => (
                  <div
                    key={cliente.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-slate-50 ${clienteSeleccionado?.id === cliente.id ? "bg-blue-50 border-blue-300" : ""}`}
                    onClick={() => verHistorial(cliente)}
                  >
                    <div>
                      <div className="font-medium">{cliente.name}</div>
                      <div className="text-sm text-muted-foreground">{cliente.phone || "Sin teléfono"}</div>
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => iniciarEdicion(cliente)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => eliminar(cliente.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Historial del cliente */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {clienteSeleccionado ? clienteSeleccionado.name : "Selecciona un cliente"}
            </CardTitle>
            {clienteSeleccionado && (
              <Button size="icon" variant="ghost" onClick={() => setClienteSeleccionado(null)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!clienteSeleccionado ? (
              <p className="text-muted-foreground">Haz clic en un cliente para ver su historial</p>
            ) : ventasCliente.length === 0 ? (
              <p className="text-muted-foreground">Sin compras registradas</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">Total compras</div>
                    <div className="text-xl font-bold">${totalVentasCliente.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">Cartones</div>
                    <div className="text-xl font-bold">{totalCartonesCliente.toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {ventasCliente.map((venta) => {
                    const productosVenta = itemsCliente.filter((i) => i.sale_id === venta.id);
                    return (
                      <div key={venta.id} className="border rounded-lg p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{venta.sale_date.split("T")[0]}</span>
                          <span className="font-bold">${Number(venta.total_amount).toLocaleString()}</span>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {productosVenta.map((item, i) => (
                            <div key={i} className="flex justify-between">
                              <span>{item.products?.name || "Producto"}</span>
                              <span>{item.quantity} cartones</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}