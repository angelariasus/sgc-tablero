import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IconSprite } from "@/components/Icon";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGC · Tablero de decisiones de las escuelas",
  description: "Tablero de decisiones del Sistema de Gestión de la Calidad de las escuelas de Tecnología Médica, Enfermería y Obstetricia (Facultad de Medicina San Fernando).",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <IconSprite />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
