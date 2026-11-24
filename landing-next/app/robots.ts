import type { MetadataRoute } from "next";

/** Public pages are crawlable; private areas are not. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard/", "/auth/", "/create/"],
      },
    ],
    ...(base ? { host: base } : {}),
  };
}
