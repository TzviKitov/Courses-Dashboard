import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { getContrastRatio } from "../lib/colors";

const here = dirname(fileURLToPath(import.meta.url));
const appTokens = join(here, "../app/brand/tokens.css");
const sourceTokens = join(here, "../../docs/brand/tokens.css");

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

describe("brand tokens", () => {
  it("keeps app/brand/tokens.css identical to the brand book source", () => {
    assert.equal(normalize(readFileSync(appTokens, "utf8")), normalize(readFileSync(sourceTokens, "utf8")));
  });
});

const LIGHT = {
  bg: "#FBF3DA",
  surface: "#FFFDF5",
  surface2: "#F1E4C0",
  text: "#2B2618",
  muted: "#6B5F45",
  primary: "#00739A",
  onPrimary: "#FFFFFF",
  accent: "#DDBC69",
  onAccent: "#2B2618",
  support: "#2E6B3A",
  onSupport: "#FBF3DA",
  danger: "#B3362B",
};
const DARK = {
  bg: "#0E2230",
  surface: "#16303F",
  surface2: "#1F3E50",
  text: "#F6EBCB",
  muted: "#9AABB0",
  primary: "#4FB3D9",
  onPrimary: "#0E2230",
  accent: "#E2B84A",
  onAccent: "#0E2230",
  support: "#8FC06A",
  onSupport: "#0E2230",
  danger: "#FF8A7A",
};

function pairs(theme: typeof LIGHT) {
  return [
    ["text / bg", theme.text, theme.bg],
    ["text-muted / bg", theme.muted, theme.bg],
    ["text-muted / surface-2", theme.muted, theme.surface2],
    ["on-primary / primary", theme.onPrimary, theme.primary],
    ["primary / surface", theme.primary, theme.surface],
    ["on-support / support", theme.onSupport, theme.support],
    ["on-accent / accent", theme.onAccent, theme.accent],
    ["danger / surface", theme.danger, theme.surface],
  ] as const;
}

describe("brand contrast", () => {
  for (const [name, theme] of [["light", LIGHT], ["dark", DARK]] as const) {
    for (const [label, fg, bg] of pairs(theme)) {
      it(`${name} ${label} meets WCAG AA`, () => {
        assert.ok(getContrastRatio(fg, bg) >= 4.5, `${label} = ${getContrastRatio(fg, bg).toFixed(2)}`);
      });
    }
  }

  it("east jerusalem reuses the hill pair, which stays AA", () => {
    assert.ok(getContrastRatio("#2B2618", "#A7B971") >= 4.5);
  });
});
