import type { NextConfig } from "next";
import path from "path";

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Native module (draws the banner details line); must not be bundled.
  serverExternalPackages: ["@napi-rs/canvas"],
  images: {
    // Local paths include /media/** (Supabase Storage served from our address).
    localPatterns: [{ pathname: "/**" }],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async rewrites() {
    // Serve Supabase from this site's own address, so visitors' browsers (and
    // URL filters in front of them) never talk to a third-party host:
    //   /media/...  public Storage files (course banners, photos)
    //   /sb/...     auth and data calls from the browser (lib/supabase/browser.ts)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
    const fonts = [
      { source: "/gstatic/:path*", destination: "https://fonts.gstatic.com/:path*" },
    ];
    if (!supabaseUrl) return fonts;
    return [
      ...fonts,
      {
        source: "/media/:path*",
        destination: `${supabaseUrl}/storage/v1/object/public/:path*`,
      },
      { source: "/sb/:path*", destination: `${supabaseUrl}/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy-Report-Only",
            value: csp,
          },
        ],
      },
      {
        // Private areas stay out of search engines. The public gallery lives at
        // /dashboard itself, and landings at /l/, so those stay indexable.
        source: "/:area(dashboard/my|dashboard/admin|auth|create|api)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
