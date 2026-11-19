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
        <Sidebar />
        <main style={{ marginLeft: 0, padding: 16, paddingTop: 60, backgroundColor: "#f8fafc", minHeight: "100vh" }} className="main-content">
          {children}
        </main>
        <style>{`
          @media (min-width: 768px) {
            .main-content {
              margin-left: 256px !important;
              padding-top: 24px !important;
            }
          }
        `}</style>
      </body>
    </html>
  );
}