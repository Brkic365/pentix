import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pentix — sklekovi se broje",
    short_name: "Pentix",
    description:
      "Svaki gol na SP-u 2026 = sklek dug. Penta = 5: pet sklekova po golu. Snimi, izbroji, vrati dug prije nego kamata pojede ekipu.",
    id: "/",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#07090d",
    theme_color: "#07090d",
    lang: "hr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
