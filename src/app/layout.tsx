import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { hrHR } from "@clerk/localizations";
import { devAuthEnabled } from "@/lib/auth";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Pentix — golovi se plaćaju sklekovima",
    template: "%s · Pentix",
  },
  description:
    "Pentix pretvara golove Svjetskog prvenstva 2026. u sklek-dug vaše ekipe. Kamera broji ponavljanja, ljestvica prati dug, kamata raste dok se ne odradi.",
  applicationName: "Pentix",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pentix",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const page = (
    <html lang="hr">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );

  // DEV_AUTH_BYPASS: local demo without Clerk (see src/lib/auth.ts)
  if (devAuthEnabled()) return page;

  return (
    <ClerkProvider
      localization={hrHR}
      appearance={{
        variables: {
          colorPrimary: "#15803d",
          borderRadius: "0.5rem",
        },
      }}
    >
      {page}
    </ClerkProvider>
  );
}
