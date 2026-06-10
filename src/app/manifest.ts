import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pentix — golovi se plaćaju sklekovima",
    short_name: "Pentix",
    description:
      "Pentix pretvara golove Svjetskog prvenstva 2026. u sklek-dug vaše ekipe. Kamera broji ponavljanja, ljestvica prati dug, kamata raste dok se ne odradi.",
    id: "/",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7f9",
    theme_color: "#ffffff",
    lang: "hr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
