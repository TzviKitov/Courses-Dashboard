import { NextResponse } from "next/server";
import { HEBREW_FONTS } from "@/constants/fonts";

// Google Fonts CSS served from this site's address. The font files it points to
// are rewritten to /gstatic/ (proxied in next.config.ts), so a visitor's browser
// never calls fonts.googleapis.com or fonts.gstatic.com directly.
const UPSTREAM = "https://fonts.googleapis.com/css2";
// A modern browser UA makes Google return woff2.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

/**
 * Only fonts from our own catalog are fetched, and the upstream URL is rebuilt
 * from catalog values, never from the visitor's query string.
 */
function upstreamUrlFor(familyParam: string | null): string | null {
  if (!familyParam) return null;
  const [rawName, rawAxes = ""] = familyParam.split(":");
  const name = rawName.replace(/\+/g, " ").trim();
  const font = HEBREW_FONTS.find(
    (f) => f.source === "google" && f.name.toLowerCase() === name.toLowerCase()
  );
  if (!font) return null;
  const asked = new Set(
    rawAxes.replace(/^wght@/, "").split(";").map((w) => Number(w))
  );
  const weights = font.weights.filter((w) => asked.has(w));
  const list = (weights.length ? weights : font.weights).join(";");
  return `${UPSTREAM}?family=${font.name.replace(/ /g, "+")}:wght@${list}&display=swap`;
}

export async function GET(req: Request) {
  const upstream = upstreamUrlFor(new URL(req.url).searchParams.get("family"));
  if (!upstream) {
    return new NextResponse("Bad request", { status: 400 });
  }
  const res = await fetch(upstream, {
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
