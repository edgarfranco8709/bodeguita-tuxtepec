"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        const isAuth = !!session?.user;
        setAuthenticated(isAuth);
        setLoading(false);

        if (!isAuth && !window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      } catch (err) {
        console.error("Error checking session:", err);
        if (mounted) {
          setLoading(false);
          setAuthenticated(false);
          if (!window.location.pathname.startsWith("/login")) {
            window.location.href = "/login";
          }
        }
      }
    };

    // Timeout de 5 segundos por si getSession se cuelga
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn("Session check timeout");
        setLoading(false);
        setAuthenticated(false);
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login";
        }
      }
    }, 5000);

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const isAuth = !!session?.user;
      setAuthenticated(isAuth);
      setLoading(false);
      if (!isAuth && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  if (!authenticated && !window.location.pathname.startsWith("/login")) {
    return null;
  }

  return <>{children}</>;
}