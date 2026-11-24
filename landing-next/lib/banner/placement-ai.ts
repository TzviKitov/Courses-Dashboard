import type { GoogleGenAI } from "@google/genai";

/** A rectangle as fractions of the image width and height. */
export interface FractionRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";

/**
 * Turn a model answer into people boxes. Accepts a JSON array of
 * {"box_2d":[ymin,xmin,ymax,xmax]} (0-1000, Gemini's detection format).
 * Invalid or tiny boxes are dropped.
 */
export function parsePeopleBoxes(raw: unknown): FractionRect[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      value = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const boxes: FractionRect[] = [];
  for (const item of value) {
    const box = (item as { box_2d?: unknown })?.box_2d;
    if (!Array.isArray(box) || box.length !== 4 || !box.every((n) => typeof n === "number" && Number.isFinite(n))) continue;
    const [ymin, xmin, ymax, xmax] = (box as number[]).map((n) => Math.min(1000, Math.max(0, n)) / 1000);
    const w = xmax - xmin;
    const h = ymax - ymin;
    if (w < 0.02 || h < 0.03) continue;
    boxes.push({ x: xmin, y: ymin, w, h });
  }
  return boxes;
}

/**
 * Ask a vision model for the bounding box of every person. The headline code keeps
 * the text off these boxes. Empty when nobody is found or the call fails.
 */
export async function detectPeople(
  client: GoogleGenAI,
  imageBytes: Uint8Array,
  mimeType = "image/png"
): Promise<FractionRect[]> {
  try {
    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: 'Detect every person in this image, including small and partly visible ones. For each person return the bounding box of the whole visible person, from the top of the head to the lowest visible part. Reply with JSON only: [{"box_2d":[ymin,xmin,ymax,xmax]}] with values from 0 to 1000.',
            },
            { inlineData: { mimeType, data: Buffer.from(imageBytes).toString("base64") } },
          ],
        },
      ],
      config: { responseMimeType: "application/json", temperature: 0 },
    });
    const text = (response as { text?: string }).text;
    return parsePeopleBoxes(text ?? null);
  } catch (error) {
    console.warn("People detection failed:", error instanceof Error ? error.message : error);
    return [];
  }
}
