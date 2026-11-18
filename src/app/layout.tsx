import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "La Bodeguita Tuxtepec",
  description: "Sistema de gestión de cerveza de mayoreo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className} style={{ margin: 0, padding: 0 }}>
        <div style={{ display: "flex", minHeight: "100vh" }}>
          <aside style={{ width: "250px", backgroundColor: "#0f172a", color: "white", flexShrink: 0 }}>
            <Sidebar />
          </aside>
          <main style={{ flex: 1, padding: "24px", backgroundColor: "#f8fafc", overflow: "auto" }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}