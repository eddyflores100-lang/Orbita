import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ÓRBITA — Property Content Engine",
    template: "%s",
  },
  description:
    "Sube las fotos de una propiedad. ÓRBITA la entiende con IA, crea la historia, produce video, micrositio, QR y analytics. AliceLabs.",
  keywords: ["inmobiliario", "AI video", "tour virtual", "micrositio", "QR", "analytics", "ÓRBITA", "AliceLabs"],
  authors: [{ name: "AliceLabs" }],
  openGraph: {
    title: "ÓRBITA — Property Content Engine",
    description: "Una propiedad entra una sola vez. Salen video, tour, micrositio, QR y analytics.",
    siteName: "ÓRBITA",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#07080d",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
