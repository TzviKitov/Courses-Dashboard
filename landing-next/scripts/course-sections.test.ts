import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseAbout,
  parseFaq,
  parseSyllabus,
} from "../lib/landing/parse-course-sections";

describe("parseFaq", () => {
  it("reads שאלה and תשובה pairs", () => {
    const result = parseFaq(`שאלה: האם צריך ניסיון קודם?
תשובה: לא, הקורס מתאים למתחילים.

שאלה: מתי מתחילים?
תשובה: במחזור הקרוב.`);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].question, "האם צריך ניסיון קודם?");
    assert.equal(result.items[0].answer, "לא, הקורס מתאים למתחילים.");
    assert.equal(result.items[1].question, "מתי מתחילים?");
    assert.equal(result.items[1].answer, "במחזור הקרוב.");
  });

  it("splits an answer written on the question line", () => {
    const result = parseFaq("שאלה: האם צריך ניסיון? תשובה: לא.");
    assert.deepEqual(result.items, [
      { question: "האם צריך ניסיון?", answer: "לא." },
    ]);
  });

  it("keeps text before the first question", () => {
    const result = parseFaq(`כדאי לדעת מראש

האם צריך ניסיון?
לא, מתאים למתחילים.`);

    assert.equal(result.preamble, "כדאי לדעת מראש");
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].question, "האם צריך ניסיון?");
    assert.equal(result.items[0].answer, "לא, מתאים למתחילים.");
  });

  it("pairs blank-line blocks when each block has a question and an answer", () => {
    const result = parseFaq(`האם צריך ניסיון קודם
לא, מתאים למתחילים

מה מביאים לשיעור
מחברת ועט`);

    assert.equal(result.items.length, 2);
    assert.equal(result.items[1].question, "מה מביאים לשיעור");
    assert.equal(result.items[1].answer, "מחברת ועט");
  });

  it("leaves unstructured prose unparsed", () => {
    const result = parseFaq("הקורס מתאים למתחילים ואין צורך בניסיון קודם.");
    assert.deepEqual(result, { preamble: "", items: [] });
  });
});

describe("parseSyllabus", () => {
  it("reads שלב titles and the lines under them", () => {
    const result = parseSyllabus(`שלב 1: היכרות וכיוון
מפגש פתיחה

שלב 2: תרגול מעשי
שלב 3: פרויקט סיום`);

    assert.equal(result.steps.length, 3);
    assert.equal(result.steps[0].title, "היכרות וכיוון");
    assert.equal(result.steps[0].body, "מפגש פתיחה");
    assert.equal(result.steps[1].title, "תרגול מעשי");
    assert.equal(result.steps[2].body, "");
  });

  it("reads numbered lines and bullets", () => {
    const numbered = parseSyllabus("1. היכרות\n2) תרגול");
    assert.deepEqual(
      numbered.steps.map((step) => step.title),
      ["היכרות", "תרגול"]
    );

    const bullets = parseSyllabus("• יסודות\n- תרגול");
    assert.deepEqual(
      bullets.steps.map((step) => step.title),
      ["יסודות", "תרגול"]
    );
  });

  it("does not treat a time as a step", () => {
    const result = parseSyllabus(`שלב 1: מפגש בוקר
10:00 - 12:00`);
    assert.equal(result.steps.length, 1);
    assert.equal(result.steps[0].body, "10:00 - 12:00");
  });

  it("keeps an introduction before the first step", () => {
    const result = parseSyllabus(`ארבעה מפגשים

שלב 1: פתיחה`);
    assert.equal(result.intro, "ארבעה מפגשים");
    assert.equal(result.steps[0].title, "פתיחה");
  });

  it("leaves a plain paragraph unparsed", () => {
    const result = parseSyllabus("נלמד יסודות ואז נתרגל על פרויקט אמיתי.");
    assert.deepEqual(result, { intro: "", steps: [] });
  });
});

describe("parseAbout", () => {
  it("turns a heading and bullets into tiles and keeps prose", () => {
    const blocks = parseAbout(`מה נלמד בקורס:
• יסודות HTML ו-CSS
• JavaScript מתחילים

דרישות קדם: אין! מתאים למתחילים מוחלטים`);

    assert.deepEqual(blocks, [
      { kind: "heading", text: "מה נלמד בקורס" },
      {
        kind: "bullets",
        items: ["יסודות HTML ו-CSS", "JavaScript מתחילים"],
      },
      {
        kind: "paragraph",
        text: "דרישות קדם: אין! מתאים למתחילים מוחלטים",
      },
    ]);
  });

  it("splits blank-line paragraphs without dropping text", () => {
    const blocks = parseAbout("פסקה ראשונה\nעוד שורה\n\nפסקה שנייה");
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].kind, "paragraph");
    if (blocks[0].kind === "paragraph") {
      assert.match(blocks[0].text, /פסקה ראשונה/);
      assert.match(blocks[0].text, /עוד שורה/);
    }
    if (blocks[1].kind === "paragraph") {
      assert.equal(blocks[1].text, "פסקה שנייה");
    }
  });
});
