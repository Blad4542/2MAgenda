import { GeistSans } from "geist/font/sans";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Autodecoración 2M",
  description: "Sistema para Autodecoracion 2M",
  icons: {
    icon: "https://igzxgawkalsqyydqxbqf.supabase.co/storage/v1/object/public/public-assets//3132f1d1-9cac-4b6b-993b-0bc6022d64bd.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.className}>
      <body className="bg-background text-foreground">
        <main className="min-h-screen flex flex-col items-center">
          {children}
        </main>
      </body>
    </html>
  );
}
