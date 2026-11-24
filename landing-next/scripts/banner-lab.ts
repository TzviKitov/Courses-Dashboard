/**
 * Banner prompt lab (dev tool). Runs the real banner prompts against Gemini and
 * applies the same post-processing as /api/banner (details line, logo strip), then
 * writes the images and a contact sheet so the results can be reviewed by eye.
 *
 * Needs GEMINI_API_KEY in .env.local. Costs real Gemini calls: one image per scenario.
 *
 *   npx tsx scripts/banner-lab.ts <label> <outDir> [scenarioIds...]
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { GoogleGenAI } from "@google/genai";
import { buildArtDirection, buildBannerPrompt } from "../lib/banner/prompts";
import { compositeLogosOntoBanner, MAX_LOGOS } from "../lib/logos/composite-banner";
import { buildDetailsText, detailsLineAvailable, drawDetailsLine } from "../lib/logos/details-line";
import type { DesignPreferences } from "../types/course";

try {
  process.loadEnvFile(".env.local");
} catch {
  // key may come from the real environment
}

const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  dates: string;
  days?: string;
  time?: string;
  location?: string;
  duration?: string;
  logos: number;
  composition: "pyramid" | "hero_center" | "modular_grid";
  style?: string;
  scene?: string;
}

const SCENARIOS: Scenario[] = [
  { id: "s01-circle7", title: "הכשרת מדריכים חדשים", subtitle: "כלים מעשיים לעבודה עם בני נוער", dates: "2027-01-05 - 2027-03-30", days: "שלישי", time: "17:00-20:00", location: "ירושלים", duration: "12 מפגשים", logos: 7, composition: "pyramid", scene: "קבוצת מדריכים צעירים יושבת במעגל בחדר פעילות חם" },
  { id: "s02-evening7", title: "ערב גיבוש לנוער ירושלים", subtitle: "מפגש חברתי עם פעילויות, אוכל ומוזיקה", dates: "2026-12-20", days: "שישי", time: "18:00-21:00", location: "מרכז נוער, ירושלים", logos: 7, composition: "pyramid" },
  { id: "s03-photo3", title: "סדנת צילום לצעירים", subtitle: "לומדים לצלם עם הטלפון", dates: "2027-02-01", days: "ראשון", time: "19:00-21:00", location: "ירושלים", logos: 3, composition: "pyramid" },
  { id: "s04-books3-hero", title: "מועדון קריאה לנוער", subtitle: "ספרים, שיחות וקפה", dates: "2027-02-10", days: "רביעי", time: "18:00-20:00", location: "ספרייה, ירושלים", logos: 3, composition: "hero_center" },
  { id: "s05-tech5", title: "קורס גולש מעטפת - מחזור חדש", subtitle: "הזדמנות לשדרג קריירה", dates: "2027-03-01", days: "ראשון-חמישי", time: "08:00-16:00", location: "ירושלים", logos: 5, composition: "pyramid" },
  { id: "s06-sport0", title: "יום ספורט קהילתי", subtitle: "כדורגל, כדורסל ואווירה טובה", dates: "2027-03-15", days: "שני", time: "16:00-19:00", location: "מגרש שכונתי, ירושלים", logos: 0, composition: "pyramid" },
  { id: "s07-cooking1", title: "סדנת בישול לצעירים", subtitle: "מבשלים, אוכלים ונהנים ביחד", dates: "2027-04-04", days: "שלישי", time: "17:30-20:00", location: "מטבח קהילתי, ירושלים", logos: 1, composition: "pyramid" },
  { id: "s08-hack9", title: "האקתון צעירים", subtitle: "יום של רעיונות, קוד ויצירה", dates: "2027-05-12 - 2027-05-13", days: "רביעי-חמישי", time: "09:00-18:00", location: "מרכז חדשנות, ירושלים", logos: 9, composition: "pyramid" },
  { id: "s09-grid5", title: "בית ספר לחיים", subtitle: "מיומנויות לחיים לבני נוער", dates: "2027-01-20 - 2027-06-20", days: "רביעי", time: "16:00-18:00", location: "ירושלים", duration: "20 מפגשים", logos: 5, composition: "modular_grid" },
  { id: "s10-anim7", title: "קבוצת מנהיגות צעירה", subtitle: "מובילים שינוי בשכונה", dates: "2027-02-14 - 2027-05-30", days: "ראשון", time: "18:00-20:00", location: "ירושלים", duration: "15 מפגשים", logos: 7, composition: "pyramid", style: "animation" },
  { id: "s11-nature3", title: "טיול לימודי בנחל", subtitle: "מסלול קל, נוף ושיחות על הדרך", dates: "2027-04-22", days: "חמישי", time: "08:00-14:00", location: "נחל פרת", logos: 3, composition: "pyramid" },
  { id: "s12-music7", title: "להקת נוער", subtitle: "נפגשים, מנגנים ומופיעים", dates: "2027-03-02 - 2027-06-29", days: "שלישי", time: "19:00-21:00", location: "ירושלים", duration: "16 מפגשים", logos: 7, composition: "hero_center" },
];

function logoFiles(n: number): Uint8Array[] {
  const dir = join("public", "brand", "logos");
  const order = ["irya", "kidom", "revaha", "hila", "leomit", "moza", "hinoch"];
  const names = readdirSync(dir).filter((f) => f.endsWith(".png"));
  const sorted = [
    ...order.map((o) => names.find((f) => f.startsWith(o))).filter((x): x is string => Boolean(x)),
    ...names.filter((f) => !order.some((o) => f.startsWith(o))),
  ];
  return sorted.slice(0, Math.min(n, MAX_LOGOS)).map((f) => new Uint8Array(readFileSync(join(dir, f))));
}

function imageFrom(response: unknown): Uint8Array | null {
  const parts = (response as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] })
    .candidates?.[0]?.content?.parts;
  for (const p of parts ?? []) {
    if (p.inlineData?.data) return new Uint8Array(Buffer.from(p.inlineData.data, "base64"));
  }
  return null;
}

async function runScenario(client: GoogleGenAI, sc: Scenario, outDir: string) {
  const design = {
    source: "generate",
    background_mode: "generate",
    background_prompt: sc.scene ? { mode: "free_text", text: sc.scene } : { mode: "surprise" },
    visual_styles: [sc.style ?? "realistic"],
    fonts: { banner_font_id: "heebo", landing_font_mode: "same" },
    compositions: [sc.composition],
    color_mode: "surprise",
  } as unknown as DesignPreferences;
  const course = {
    title_he: sc.title,
    subtitle_he: sc.subtitle,
    schedule: { dates: sc.dates, days: sc.days ?? "", time: sc.time ?? "" },
    location: sc.location,
    duration: sc.duration,
  };

  const art = buildArtDirection(design);
  const detailsByCode = await detailsLineAvailable();
  const detailsText = buildDetailsText(course);
  const prompt = buildBannerPrompt({ course, art, brandColorDesc: "", logoCount: sc.logos, detailsByCode, detailsText });

  let raw: Uint8Array | null = null;
  for (let attempt = 1; attempt <= 3 && !raw; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseModalities: ["TEXT", "IMAGE"] },
      });
      raw = imageFrom(response);
    } catch (e) {
      console.error(sc.id, "attempt", attempt, String(e).slice(0, 160));
      await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  if (!raw) return { id: sc.id, error: "no image" };

  const rawMeta = await sharp(Buffer.from(raw)).metadata();
  let bytes: Uint8Array = raw;
  if (detailsByCode) bytes = await drawDetailsLine(bytes, detailsText);
  if (sc.logos > 0) bytes = await compositeLogosOntoBanner(bytes, logoFiles(sc.logos));
  const finalMeta = await sharp(Buffer.from(bytes)).metadata();

  writeFileSync(join(outDir, `${sc.id}.png`), Buffer.from(bytes));
  return {
    id: sc.id,
    logos: sc.logos,
    rawH: rawMeta.height,
    finalH: finalMeta.height,
    extended: (finalMeta.height ?? 0) > (rawMeta.height ?? 0),
  };
}

async function contactSheet(outDir: string, ids: string[], name: string) {
  const cols = 3;
  const w = 640;
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  let maxRowH = 0;
  let rowTop = 0;
  const rowHeights: number[] = [];
  const resized: { id: string; buf: Buffer; h: number }[] = [];
  for (const id of ids) {
    try {
      const buf = await sharp(join(outDir, `${id}.png`)).resize({ width: w }).png().toBuffer();
      const h = (await sharp(buf).metadata()).height ?? 360;
      resized.push({ id, buf, h });
    } catch {
      // missing scenario output
    }
  }
  resized.forEach((r, i) => {
    const col = i % cols;
    if (col === 0 && i > 0) {
      rowHeights.push(maxRowH);
      rowTop += maxRowH + 8;
      maxRowH = 0;
    }
    tiles.push({ input: r.buf, left: col * (w + 8), top: rowTop });
    maxRowH = Math.max(maxRowH, r.h);
  });
  rowHeights.push(maxRowH);
  const totalH = rowTop + maxRowH;
  const sheet = await sharp({
    create: { width: cols * w + (cols - 1) * 8, height: Math.max(totalH, 10), channels: 3, background: "#ffffff" },
  })
    .composite(tiles)
    .png()
    .toBuffer();
  writeFileSync(join(outDir, name), sheet);
}

async function main() {
  const [label, outDir, ...ids] = process.argv.slice(2);
  if (!label || !outDir) throw new Error("usage: banner-lab.ts <label> <outDir> [scenarioIds...]");
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is missing in .env.local");
  const dir = join(outDir, label);
  mkdirSync(dir, { recursive: true });
  const client = new GoogleGenAI({ apiKey: key });
  const chosen = ids.length ? SCENARIOS.filter((s) => ids.some((i) => s.id.startsWith(i))) : SCENARIOS;

  const results: unknown[] = [];
  const queue = [...chosen];
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const sc = queue.shift()!;
      results.push(await runScenario(client, sc, dir));
    }
  });
  await Promise.all(workers);

  const okIds = chosen.map((s) => s.id);
  await contactSheet(dir, okIds.slice(0, 6), "sheet-1.png");
  if (okIds.length > 6) await contactSheet(dir, okIds.slice(6), "sheet-2.png");
  writeFileSync(join(dir, "results.json"), JSON.stringify(results, null, 2));
  const extended = (results as { extended?: boolean }[]).filter((r) => r.extended).length;
  console.log(JSON.stringify({ label, count: results.length, extended, results }, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
