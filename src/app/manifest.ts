import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RAWASY United International",
    short_name: "RAWASY",
    description: "Laser cutting, CNC bending, steel structures, fabrication, laser engraving and scaffolding in Saudi Arabia.",
    start_url: "/",
    display: "browser",
    background_color: "#17191a",
    theme_color: "#17191a",
    icons: [
      { src: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { src: "/apple-icon.png", type: "image/png", sizes: "180x180" },
    ],
  };
}
