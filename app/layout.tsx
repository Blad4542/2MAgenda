import { GeistSans } from "geist/font/sans";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Autodecoración 2M",
  description: "Sistema de gestión interna para Autodecoración 2M",
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Autodecoración 2M",
    description: "Sistema de gestión interna para Autodecoración 2M",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={GeistSans.className}>
      <head>
        <link rel="preconnect" href="https://igzxgawkalsqyydqxbqf.supabase.co" crossOrigin="anonymous" />
      </head>
      <body className="bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 z-50 bg-white px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-900 shadow-sm"
        >
          Ir al contenido principal
        </a>
        <main id="main-content" className="min-h-screen w-full h-full">
          {children}
        </main>
      </body>
    </html>
  );
}
