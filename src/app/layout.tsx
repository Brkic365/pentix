import type { Metadata, Viewport } from "next";
import { Anton, Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { hrHR } from "@clerk/localizations";
import "./globals.css";

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin", "latin-ext"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "Pentix — gol pada, ti padaš na sklekove",
    template: "%s · Pentix",
  },
  description:
    "Svaki gol na SP-u 2026 = sklek dug za ekipu. Penta = 5: pet sklekova po golu, kamata raste dok ne platiš. Snimi, izbroji, vrati dug.",
  applicationName: "Pentix",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pentix",
  },
};

export const viewport: Viewport = {
  themeColor: "#07090d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      localization={hrHR}
      appearance={{
        variables: {
          colorPrimary: "#c8f31d",
          colorBackground: "#11151d",
          colorText: "#f2f5f9",
          colorTextSecondary: "#8b95a5",
          colorInputBackground: "#1a2029",
          colorInputText: "#f2f5f9",
          borderRadius: "0.75rem",
        },
      }}
    >
      <html lang="hr">
        <body className={`${anton.variable} ${inter.variable} antialiased`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
