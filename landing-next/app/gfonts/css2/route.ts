import { NextResponse } from "next/server";

// Google Fonts CSS served from this site's address. The font files it points to
// are rewritten to /gstatic/ (proxied in next.config.ts), so a visitor's browser
// never calls fonts.googleapis.com or fonts.gstatic.com directly.
const UPSTREAM = "https://fonts.googleapis.com/css2";
// A modern browser UA makes Google return woff2.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export async function GET(req: Request) {
  const query = new URL(req.url).search;
  if (!query.includes("family=") || query.length > 600) {
    return new NextResponse("Bad request", { status: 400 });
  }
  const res = await fetch(`${UPSTREAM}${query}`, {
    headers: { "User-Agent": UA },
    next: { revalidate: 60 * 60 * 24 },
  });
  if (!res.ok) {
    return new NextResponse("", { status: res.status === 400 ? 400 : 502 });
  }
  const css = (await res.text()).replaceAll("https://fonts.gstatic.com/", "/gstatic/");
  return new NextResponse(css, {
    headers: {
      "Content-Type": "text/css; charset=utf-8",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
