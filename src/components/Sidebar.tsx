"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Users,
  DollarSign,
  FileText,
  Wallet,
  ClipboardCheck,
  Box,
  TrendingUp,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/compras", label: "Compras", icon: Package },
  { href: "/inventario", label: "Inventario", icon: Box },
  { href: "/productos", label: "Productos", icon: Package },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/gastos", label: "Gastos", icon: DollarSign },
  { href: "/reportes", label: "Reportes", icon: FileText },
  { href: "/resultados", label: "Resultados", icon: TrendingUp },
  { href: "/caja", label: "Caja", icon: Wallet },
  { href: "/cierre", label: "Cierre", icon: ClipboardCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
      } else {
        setUser(user);
      }
      setChecking(false);
    }
    checkAuth();
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checking) return <div className="p-4 text-slate-400">Cargando...</div>;
  if (!user) return null;

  return (
    <>
      {/* Botón menú móvil */}
      <button
        onClick={() => setAbierto(true)}
        className="md:hidden fixed top-16 left-4 z-50 bg-slate-900 text-white p-2 rounded-lg shadow-lg"
      >
        <Menu className="h-6 w-6" />
      </button>

      {/* Overlay para cerrar al tocar fuera */}
      {abierto && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setAbierto(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-200 ease-in-out md:translate-x-0 flex flex-col h-full ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b border-slate-700 flex items-start justify-between">
          <div className="flex-1">
            <img src="/logo.png" alt="Logo" className="h-16 mx-auto mb-2" />
            <h1 className="text-xl font-bold text-center">La Bodeguita</h1>
            <p className="text-xs text-slate-400 text-center">Tuxtepec</p>
          </div>
          <button onClick={() => setAbierto(false)} className="md:hidden ml-2 mt-1">
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={cerrarSesion}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </>
  );
}