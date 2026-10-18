export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqParseResult {
  preamble: string;
  items: FaqItem[];
}

export interface SyllabusStep {
  title: string;
  body: string;
}

export interface SyllabusParseResult {
  intro: string;
  steps: SyllabusStep[];
}

export type AboutBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullets"; items: string[] };

const QUESTION_LABEL = /^שאלה\s*[:：.\-–]\s*(.*)$/;
const ANSWER_LABEL = /^תשובה\s*[:：.\-–]\s*(.*)$/;
const INLINE_ANSWER = /\sתשובה\s*[:：.\-–]\s*/;

const STAGE_LINE = /^שלב\s+(\d+)\s*[:.)\-–]?\s*(.*)$/;
const NUMBERED_LINE = /^(\d{1,2})[.)]\s+(\S.*)$/;
const NUMBERED_COLON_LINE = /^(\d{1,2}):\s+(?!\d)(\S.*)$/;
const NUMBERED_DASH_LINE = /^(\d{1,2})\s+[-–]\s+(\S.*)$/;
const BULLET_LINE = /^[•●▪◦]\s*(.+)$|^(?:[-*–])\s+(.+)$/;
const HEADING_LINE = /^(.{2,60}):\s*$/;

function toLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").split("\n");
}

function cleanup(text: string): string {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function appendLine(base: string, extra: string): string {
  if (!base) return extra;
  if (base.endsWith("\n")) return `${base}${extra}`;
  return `${base}\n${extra}`;
}

function splitInlineAnswer(rest: string): { question: string; answer: string } {
  const match = INLINE_ANSWER.exec(rest);
  if (!match || match.index === undefined) {
    return { question: rest.trim(), answer: "" };
  }
  return {
    question: rest.slice(0, match.index).trim(),
    answer: rest.slice(match.index + match[0].length).trim(),
  };
}

function parseLabeledFaq(text: string): FaqParseResult | null {
  const lines = toLines(text);
  const hasLabel = lines.some((line) => {
    const trimmed = line.trim();
    return QUESTION_LABEL.test(trimmed) || ANSWER_LABEL.test(trimmed);
  });
  if (!hasLabel) return null;

  const preamble: string[] = [];
  const items: FaqItem[] = [];
  let current: FaqItem | null = null;
  let mode: "preamble" | "question" | "answer" = "preamble";

  const pushCurrent = () => {
    if (!current) return;
    const question = cleanup(current.question);
    const answer = cleanup(current.answer);
    if (question) items.push({ question, answer });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const questionMatch = line.match(QUESTION_LABEL);
    const answerMatch = line.match(ANSWER_LABEL);

    if (questionMatch) {
      pushCurrent();
      const split = splitInlineAnswer(questionMatch[1] ?? "");
      current = { question: split.question, answer: split.answer };
      mode = split.answer ? "answer" : "question";
      continue;
    }

    if (answerMatch) {
      const answerText = (answerMatch[1] ?? "").trim();
      if (!current) {
        if (answerText) preamble.push(answerText);
        continue;
      }
      if (answerText) current.answer = appendLine(current.answer, answerText);
      mode = "answer";
      continue;
    }

    if (!line) {
      if (mode === "question" && current?.question) current.question += "\n";
      if (mode === "answer" && current?.answer) current.answer += "\n";
      if (mode === "preamble" && preamble.length > 0) preamble.push("");
      continue;
    }

    if (mode === "question" && current) {
      current.question = appendLine(current.question, line);
    } else if (mode === "answer" && current) {
      current.answer = appendLine(current.answer, line);
    } else {
      preamble.push(line);
    }
  }

  pushCurrent();
  return { preamble: cleanup(preamble.join("\n")), items };
}

function parseQuestionMarkFaq(text: string): FaqParseResult | null {
  const lines = toLines(text);
  if (!lines.some((line) => /[?؟？]\s*$/.test(line.trim()))) return null;

  const preamble: string[] = [];
  const items: FaqItem[] = [];
  let current: FaqItem | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (!current && preamble.length > 0) preamble.push("");
      if (current?.answer) current.answer += "\n";
      continue;
    }

    if (/[?؟？]\s*$/.test(line)) {
      if (current?.question) {
        items.push({
          question: cleanup(current.question),
          answer: cleanup(current.answer),
        });
      }
      current = { question: line, answer: "" };
      continue;
    }

    if (current) current.answer = appendLine(current.answer, line);
    else preamble.push(line);
  }

  if (current?.question) {
    items.push({
      question: cleanup(current.question),
      answer: cleanup(current.answer),
    });
  }

  if (items.length === 0) return null;
  return { preamble: cleanup(preamble.join("\n")), items };
}

function parseBlankBlockFaq(text: string): FaqParseResult | null {
  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length < 2) return null;

  const parsed = blocks.map((block) => {
    const lines = block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    return lines;
  });

  if (parsed.some((lines) => lines.length < 2)) return null;

  return {
    preamble: "",
    items: parsed.map((lines) => ({
      question: lines[0],
      answer: cleanup(lines.slice(1).join("\n")),
    })),
  };
}

export function parseFaq(text: string): FaqParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { preamble: "", items: [] };

  const labeled = parseLabeledFaq(trimmed);
  if (labeled && labeled.items.length > 0) return labeled;

  const questioned = parseQuestionMarkFaq(trimmed);
  if (questioned && questioned.items.length > 0) return questioned;

  const blocked = parseBlankBlockFaq(trimmed);
  if (blocked && blocked.items.length > 0) return blocked;

  return { preamble: "", items: [] };
}

function matchStep(line: string): { title: string } | null {
  const stage = line.match(STAGE_LINE);
  if (stage) return { title: (stage[2] ?? "").trim() };

  const numbered = line.match(NUMBERED_LINE);
  if (numbered) return { title: numbered[2].trim() };

  const colon = line.match(NUMBERED_COLON_LINE);
  if (colon) return { title: colon[2].trim() };

  const dashed = line.match(NUMBERED_DASH_LINE);
  if (dashed) return { title: dashed[2].trim() };

  const bullet = line.match(BULLET_LINE);
  if (bullet) return { title: (bullet[1] || bullet[2] || "").trim() };

  return null;
}

export function parseSyllabus(text: string): SyllabusParseResult {
  const trimmed = text.trim();
  if (!trimmed) return { intro: "", steps: [] };

  const lines = toLines(trimmed);
  if (!lines.some((line) => matchStep(line.trim()))) {
    return { intro: "", steps: [] };
  }

  const intro: string[] = [];
  const steps: SyllabusStep[] = [];
  let current: SyllabusStep | null = null;

  const pushCurrent = () => {
    if (!current) return;
    const title = cleanup(current.title) || `שלב ${steps.length + 1}`;
    steps.push({ title, body: cleanup(current.body) });
    current = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const step = line ? matchStep(line) : null;
    if (step) {
      pushCurrent();
      current = { title: step.title, body: "" };
      continue;
    }
    if (!line) {
      if (!current && intro.length > 0) intro.push("");
      if (current?.body) current.body += "\n";
      continue;
    }
    if (!current) intro.push(line);
    else current.body = appendLine(current.body, line);
  }

  pushCurrent();
  return { intro: cleanup(intro.join("\n")), steps };
}

function matchBullet(line: string): string | null {
  const match = line.match(BULLET_LINE);
  if (!match) return null;
  return (match[1] || match[2] || "").trim() || null;
}

export function parseAbout(text: string): AboutBlock[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const blocks: AboutBlock[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    const value = cleanup(paragraph.join("\n"));
    paragraph = [];
    if (value) blocks.push({ kind: "paragraph", text: value });
  };

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push({ kind: "bullets", items: bullets });
    bullets = [];
  };

  for (const raw of toLines(trimmed)) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
      continue;
    }

    const bullet = matchBullet(line);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet);
      continue;
    }

    const heading = line.match(HEADING_LINE);
    if (heading) {
      flushParagraph();
      flushBullets();
      blocks.push({ kind: "heading", text: heading[1].trim() });
      continue;
    }

    flushBullets();
    paragraph.push(line);
  }

  flushParagraph();
  flushBullets();
  return blocks;
}
