"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  LayoutDashboard, ShoppingCart, Package, Users, DollarSign,
  FileText, Wallet, ClipboardCheck, Box, TrendingUp, LogOut, Menu, X,
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
  const esLogin = pathname === "/login";

  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [abierto, setAbierto] = useState(false);

  // Verificar sesión (no en /login)
  useEffect(() => {
    if (esLogin) {
      setChecking(false);
      return;
    }
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) window.location.href = "/login";
      else setUser(user);
      setChecking(false);
    }
    checkAuth();
  }, [esLogin]);

  const mostrar = !esLogin && !checking && !!user;

  // Le avisa al CSS si hay sidebar o no (login = pantalla completa)
  useEffect(() => {
    document.body.classList.toggle("sin-sidebar", !mostrar);
    return () => document.body.classList.remove("sin-sidebar");
  }, [mostrar]);

  // Cerrar el menú al cambiar de página
  useEffect(() => {
    setAbierto(false);
  }, [pathname]);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (!mostrar) return null;

  return (
    <>
      <button
        className="menu-btn"
        onClick={() => setAbierto(true)}
        aria-label="Abrir menú"
      >
        <Menu size={24} />
      </button>

      {abierto && (
        <div className="sidebar-overlay" onClick={() => setAbierto(false)} />
      )}

      <aside className={`sidebar ${abierto ? "open" : ""}`}>
        <div style={{ padding: 20, borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ textAlign: "center", flex: 1 }}>
            <img src="/logo.png" alt="Logo" style={{ height: 50, margin: "0 auto 6px" }} />
            <div style={{ fontWeight: "bold", fontSize: 18 }}>La Bodeguita</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>Tuxtepec</div>
          </div>
          <button
            className="sidebar-close"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar menú"
          >
            <X size={24} />
          </button>
        </div>

        <nav style={{ flex: 1, overflowY: "auto", padding: 12 }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const activo = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 8,
                  marginBottom: 4,
                  textDecoration: "none",
                  color: activo ? "#fff" : "#cbd5e1",
                  background: activo ? "#334155" : "transparent",
                }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: 12, borderTop: "1px solid #334155" }}>
          <button
            onClick={cerrarSesion}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 8,
              background: "none",
              border: "none",
              color: "#cbd5e1",
              cursor: "pointer",
            }}
          >
            <LogOut size={20} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}