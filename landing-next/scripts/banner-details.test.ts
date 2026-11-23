import assert from "node:assert/strict";
import test from "node:test";
import { buildDetailsText, formatDateHe, formatDateRangeHe } from "../lib/logos/details-line";

test("dates are shown day first", () => {
  assert.equal(formatDateHe("2026-11-26"), "26.11.2026");
});

test("a range keeps start first and collapses equal dates", () => {
  assert.equal(formatDateRangeHe("2026-11-26 - 2026-12-14"), "26.11.2026 - 14.12.2026");
  assert.equal(formatDateRangeHe("2026-12-01 - 2026-12-01"), "26.11.2026".replace("26.11", "01.12"));
});

test("details line joins the parts that exist", () => {
  assert.equal(
    buildDetailsText({
      duration: "6 מפגשים",
      location: "יבנה",
      schedule: { dates: "2026-12-01 - 2026-12-14", days: "שני", time: "08:00-16:00" },
    }),
    "01.12.2026 - 14.12.2026 • שני | 08:00-16:00 • יבנה • 6 מפגשים"
  );
  assert.equal(buildDetailsText({}), "");
});
