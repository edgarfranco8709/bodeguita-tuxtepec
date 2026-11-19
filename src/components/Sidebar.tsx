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
  if (pathname === "/login") return null;

  const [user, setUser] = useState<any>(null);
  const [checking, setChecking] = useState(true);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) window.location.href = "/login";
      else setUser(user);
      setChecking(false);
    }
    checkAuth();
  }, []);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (checking || !user) return null;

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="menu-btn"
        style={{
          position: "fixed", top: 16, left: 16, zIndex: 9999,
          backgroundColor: "#0f172a", color: "white", padding: 8,
          borderRadius: 8, border: "none", cursor: "pointer",
        }}
      >
        <Menu className="h-6 w-6" />
      </button>

      {abierto && (
        <div
          onClick={() => setAbierto(false)}
          className="overlay"
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)", zIndex: 9998,
          }}
        />
      )}

      <div
        className="sidebar"
        style={{
          position: "fixed", top: 0, left: 0, width: 256, height: "100vh",
          backgroundColor: "#0f172a", color: "white", zIndex: 9999,
          display: "flex", flexDirection: "column",
          transform: abierto ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s",
        }}
      >
        <div style={{ padding: 24, borderBottom: "1px solid #334155", display: "flex", justifyContent: "space-between" }}>
          <div style={{ flex: 1, textAlign: "center" }}>
            <img src="/logo.png" alt="Logo" style={{ height: 64, margin: "0 auto 8px" }} />
            <h1 style={{ fontSize: 20, fontWeight: "bold" }}>La Bodeguita</h1>
            <p style={{ fontSize: 12, color: "#94a3b8" }}>Tuxtepec</p>
          </div>
          <button onClick={() => setAbierto(false)} className="close-btn" style={{ background: "none", border: "none", color: "white", cursor: "pointer" }}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav style={{ flex: 1, padding: 16, overflowY: "auto" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAbierto(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", borderRadius: 8, marginBottom: 4,
                  textDecoration: "none", color: isActive ? "white" : "#cbd5e1",
                  backgroundColor: isActive ? "#334155" : "transparent",
                }}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: 16, borderTop: "1px solid #334155" }}>
          <button
            onClick={cerrarSesion}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 8, background: "none",
              border: "none", color: "#cbd5e1", cursor: "pointer",
            }}
          >
            <LogOut className="h-5 w-5" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .menu-btn { display: none !important; }
          .overlay { display: none !important; }
          .close-btn { display: none !important; }
          .sidebar { transform: translateX(0) !important; }
        }
      `}</style>
    </>
  );
}