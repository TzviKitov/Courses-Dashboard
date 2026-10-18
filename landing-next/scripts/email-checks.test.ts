import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, computeFollowupDueDates, toIsoDate } from "../lib/followups/dates";
import {
  buildCourseOpenEmail,
  buildFormEmail,
  extractEmailAddress,
  normalizeEmailFrom,
} from "../lib/email/provider";

describe("email from sanitization", () => {
  it("strips wrapping quotes that break Resend", () => {
    const raw = '"מערכת קורסים <noreply@example.com>"';
    const out = normalizeEmailFrom(raw);
    assert.match(out, /<noreply@example.com>$/);
    assert.doesNotMatch(out, /^"/);
    assert.match(out, /^=\?UTF-8\?B\?/);
  });

  it("keeps ascii display names", () => {
    assert.equal(
      normalizeEmailFrom("CourseFlow <noreply@example.com>"),
      "CourseFlow <noreply@example.com>"
    );
  });

  it("accepts bare email", () => {
    assert.equal(normalizeEmailFrom("noreply@example.com"), "noreply@example.com");
  });

  it("falls back on garbage", () => {
    assert.equal(normalizeEmailFrom("not-an-email"), "CourseFlow <onboarding@resend.dev>");
  });

  it("extracts address from display name", () => {
    assert.equal(
      extractEmailAddress("מערכת קורסים <noreply@example.com>"),
      "noreply@example.com"
    );
  });
});

describe("follow-up due dates", () => {
  it("schedules course_open on start and forms after start/end", () => {
    const dues = computeFollowupDueDates("2026-01-01", "2026-03-01");
    assert.equal(toIsoDate(dues.courseOpen!), "2026-01-01");
    assert.equal(toIsoDate(dues.form1!), "2026-01-15");
    assert.equal(toIsoDate(dues.form2!), "2026-04-01");
    assert.equal(toIsoDate(dues.form3!), "2026-06-01");
  });

  it("falls back to start + 3 months when end is missing", () => {
    const dues = computeFollowupDueDates("2026-01-01", null);
    assert.equal(toIsoDate(dues.form2!), "2026-05-01");
    assert.equal(toIsoDate(dues.form3!), "2026-07-01");
  });

  it("adds reminder window of 7 days", () => {
    assert.equal(toIsoDate(addDays(new Date("2026-01-01T12:00:00.000Z"), 7)), "2026-01-08");
  });
});

describe("email templates", () => {
  it("includes landing and registrants links in course_open", () => {
    const mail = buildCourseOpenEmail({
      courseTitle: "קורס בדיקה",
      landingUrl: "https://example.com/l/1",
      registrantsUrl: "https://example.com/dashboard/my/1/registrants",
    });
    assert.match(mail.subject, /קורס בדיקה/);
    assert.match(mail.html, /\/l\/1/);
    assert.match(mail.html, /registrants/);
  });

  it("puts recipient on the unsubscribe URL", () => {
    const mail = buildFormEmail({
      formLabel: "טופס 1",
      courseTitle: "קורס",
      formUrl: "https://example.com/f/token/1",
      recipientEmail: "instructor@example.com",
    });
    assert.match(mail.html, /unsubscribe\?email=instructor%40example.com/);
  });
});
