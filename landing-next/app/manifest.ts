import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/constants/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/dashboard",
    display: "standalone",
    lang: "he",
    dir: "rtl",
    background_color: "#FBF3DA",
    theme_color: "#FBF3DA",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
