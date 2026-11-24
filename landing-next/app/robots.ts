import type { MetadataRoute } from "next";

/** Public pages are crawlable; private areas are not. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /dashboard itself is the public gallery, so only its private parts are blocked.
        disallow: ["/api/", "/dashboard/my", "/dashboard/admin", "/auth/", "/create"],
      },
    ],
    ...(base ? { host: base } : {}),
  };
}
