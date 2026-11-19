import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./app.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "La Bodeguita Tuxtepec",
  description: "Sistema de gestión de cerveza de mayoreo",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Sidebar />
        <main id="main-content" className="app-main">
          {children}
        </main>
      </body>
    </html>
  );
}