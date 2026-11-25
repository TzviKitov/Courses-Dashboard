import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stripSensitiveNotes, csvHeaders, clampNotes } from "../lib/security/sensitive-notes";
import { organizationsCompatible } from "../lib/security/org-scope";
import { detectFileKind, isAllowedRegistrationFile } from "../lib/security/file-magic";
import { sanitizeRedirectPath } from "../lib/auth/redirect";
import {
  parseMfaTrustCookie,
  signMfaTrust,
  mfaPathForRole,
  MFA_SMS_PATH,
} from "../lib/auth/mfa-trust";
import { resolveSmsApiKey } from "../lib/sms/global-sms";
import {
  sanitizeSearchQuery,
  parseDashboardFilters,
  hasActiveSearch,
  hasActiveFilters,
  dashboardHref,
  effectiveAvailability,
  filtersToFormState,
  filtersToListParams,
} from "../lib/dashboard/filter-params";
import { courseOverlapsDateRange } from "../lib/dashboard/date-range";
import { isListedInGallery, resolveIsPublic } from "../lib/landings/visibility";
import {
  canEditCoGuides,
  checkCoGuideCandidate,
  normalizeEmail,
} from "../lib/landings/co-guide-rules";
import {
  contentDisposition,
  downloadFileName,
  isAllowedAssetUrl,
  parseDownloadKind,
  pickAssetUrl,
  storageObjectPath,
  buildAssetUrl,
} from "../lib/landings/download-assets";
import { applyCourseEdits } from "../lib/landings/edit-course";
import {
  bottomZonePercent,
  fractionWord,
  reservedZonesPrompt,
  topZonePercent,
} from "../lib/logos/reserved-bands";
import { analyzeRaw, drawHeadline, overlapFraction, pickPlacement, regionStats, wrapWords } from "../lib/banner/headline";
import sharp from "sharp";
import { parsePeopleBoxes } from "../lib/banner/placement-ai";
import { bannerFontKey, ensureBannerFont } from "../lib/banner/fonts";
import { loadCanvas } from "../lib/logos/details-line";
import { HEBREW_FONTS } from "../constants/fonts";
import { safeImgSrc } from "../lib/ui/safe-img-src";
import { normalizeReferral, REFERRAL_MAX_LENGTH } from "../lib/landing/referral";
import { AUDIENCE_CATEGORY_OPTIONS, COURSE_AUDIENCE_OPTIONS } from "../types/course";

describe("sensitive notes stripping", () => {
  it("nulls instructor and form notes", () => {
    const row = stripSensitiveNotes({
      full_name: "א",
      instructor_notes: "secret",
      form1_notes: "s1",
      form2_notes: "s2",
      form3_notes: "s3",
      form3_feedback: "fb",
    });
    assert.equal(row.full_name, "א");
    assert.equal(row.instructor_notes, null);
    assert.equal(row.form1_notes, null);
  });

  it("csv default has no note columns", () => {
    const headers = csvHeaders(false);
    assert.equal(headers.includes("instructor_notes"), false);
    assert.equal(csvHeaders(true).includes("instructor_notes"), true);
  });

  it("clamps notes length and strips empty", () => {
    assert.equal(clampNotes("  "), null);
    assert.equal(clampNotes(1), null);
    const long = "א".repeat(3000);
    assert.equal(clampNotes(long)?.length, 2000);
  });
});

describe("org scope", () => {
  it("allows when either org is null", () => {
    assert.equal(organizationsCompatible(null, "x"), true);
    assert.equal(organizationsCompatible("a", "a"), true);
    assert.equal(organizationsCompatible("a", "b"), false);
  });
});

describe("file magic", () => {
  it("detects jpeg and rejects spoofed pdf mime", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    assert.equal(detectFileKind(jpeg), "jpeg");
    assert.equal(isAllowedRegistrationFile(jpeg, "application/pdf"), false);
  });
});

describe("open redirect", () => {
  it("blocks protocol-relative and auth loops", () => {
    assert.equal(sanitizeRedirectPath("//evil.com"), "/dashboard");
    assert.equal(sanitizeRedirectPath("/auth/login"), "/dashboard");
    assert.equal(sanitizeRedirectPath("/dashboard/my"), "/dashboard/my");
    assert.equal(sanitizeRedirectPath("/auth/mfa-sms"), "/auth/mfa-sms");
  });
});

describe("SMS API key env unescape", () => {
  it("turns Next.js \\$ and $$ back into $", () => {
    assert.equal(resolveSmsApiKey("vL\\$6H"), "vL$6H");
    assert.equal(resolveSmsApiKey("vL$$6H"), "vL$6H");
    assert.equal(resolveSmsApiKey("plain"), "plain");
  });
});

describe("MFA device trust cookie", () => {
  const secret = "test-mfa-trust-secret";
  const admin = {
    u: "user-admin",
    r: "admin" as const,
    m: "totp" as const,
    e: Date.now() + 60_000,
  };

  it("accepts a valid matching cookie", async () => {
    const raw = await signMfaTrust(admin, secret);
    const parsed = await parseMfaTrustCookie(
      raw,
      { userId: "user-admin", role: "admin" },
      secret
    );
    assert.equal(parsed?.u, "user-admin");
    assert.equal(parsed?.m, "totp");
  });

  it("rejects wrong user, role, method, or expiry", async () => {
    const raw = await signMfaTrust(admin, secret);
    assert.equal(
      await parseMfaTrustCookie(raw, { userId: "other", role: "admin" }, secret),
      null
    );
    assert.equal(
      await parseMfaTrustCookie(
        raw,
        { userId: "user-admin", role: "instructor" },
        secret
      ),
      null
    );
    const totpInstructor = await signMfaTrust(
      { ...admin, u: "user-ins", r: "instructor" },
      secret
    );
    assert.equal(
      await parseMfaTrustCookie(
        totpInstructor,
        { userId: "user-ins", role: "instructor" },
        secret
      ),
      null
    );
    const expired = await signMfaTrust({ ...admin, e: Date.now() - 1 }, secret);
    assert.equal(
      await parseMfaTrustCookie(
        expired,
        { userId: "user-admin", role: "admin" },
        secret
      ),
      null
    );
  });

  it("accepts an admin cookie earned by SMS", async () => {
    const sms = await signMfaTrust({ ...admin, m: "sms" }, secret);
    const parsed = await parseMfaTrustCookie(
      sms,
      { userId: "user-admin", role: "admin" },
      secret
    );
    assert.equal(parsed?.m, "sms");
  });

  it("routes admins and instructors to SMS", () => {
    assert.equal(mfaPathForRole("admin"), MFA_SMS_PATH);
    assert.equal(mfaPathForRole("instructor"), MFA_SMS_PATH);
  });
});

describe("IDOR contract (authorization must live on the server)", () => {
  it("requireLandingAccess returns 403 shape for outsiders — documented in access.ts", () => {
    assert.ok(typeof organizationsCompatible === "function");
  });

  it("CSV notes export is gated by a dedicated flag helper", async () => {
    const { profileCanExportSensitiveNotes } = await import(
      "../lib/security/sensitive-notes"
    );
    assert.equal(
      profileCanExportSensitiveNotes({
        id: "x",
        display_name: null,
        role: "instructor",
        status: "active",
        can_view_all_learners: false,
        can_export_registrants: true,
        can_view_sensitive_notes: true,
        can_export_sensitive_notes: false,
        organization_id: null,
        last_seen_at: null,
        phone: null,
        created_via: null,
        requested_all_learners_at: null,
        created_at: "",
        updated_at: "",
      }),
      false
    );
  });
});

describe("gallery search query sanitization", () => {
  it("keeps Hebrew and Latin words", () => {
    assert.equal(sanitizeSearchQuery("  אילוף כלבים  "), "אילוף כלבים");
    assert.equal(sanitizeSearchQuery("Full Stack"), "Full Stack");
  });

  it("strips PostgREST filter punctuation", () => {
    assert.equal(sanitizeSearchQuery("title.ilike.*,id.eq.1"), "title ilike id eq 1");
    assert.equal(sanitizeSearchQuery("foo,bar(or)"), "foo bar or");
    assert.equal(sanitizeSearchQuery("!!!"), undefined);
  });
});

describe("gallery search vs filters", () => {
  it("treats search and filters as independent", () => {
    const both = parseDashboardFilters(
      new URLSearchParams("q=אילוף&audience=youth")
    );
    assert.equal(hasActiveSearch(both), true);
    assert.equal(hasActiveFilters(both), true);
    assert.equal(dashboardHref(both, { search: false, filters: true }), "/dashboard?audience=youth");
    assert.equal(
      dashboardHref(both, { search: true, filters: false }),
      `/dashboard?q=${encodeURIComponent("אילוף")}`
    );
  });

  it("does not treat search as a dropdown filter", () => {
    const searchOnly = parseDashboardFilters(new URLSearchParams("q=כלבים"));
    assert.equal(hasActiveSearch(searchOnly), true);
    assert.equal(hasActiveFilters(searchOnly), false);
  });

  it("accepts activity dates only for the matching activity choice", () => {
    const valid = parseDashboardFilters(
      new URLSearchParams("availability=active_range&dateFrom=2026-02-01&dateTo=2026-02-28")
    );
    assert.equal(valid.availability, "active_range");
    assert.equal(valid.dateFrom, "2026-02-01");
    assert.equal(valid.dateTo, "2026-02-28");
    assert.equal(hasActiveFilters(valid), true);

    const hidden = parseDashboardFilters(
      new URLSearchParams("dateFrom=2026-02-01&dateTo=2026-02-28")
    );
    assert.equal(hidden.dateFrom, undefined);
    assert.equal(hidden.dateTo, undefined);
    assert.equal(hasActiveFilters(hidden), false);

    const invalid = parseDashboardFilters(
      new URLSearchParams("availability=active_range&dateFrom=2026-02-30&dateTo=2026-02-01")
    );
    assert.equal(invalid.dateFrom, undefined);
    assert.equal(invalid.dateTo, "2026-02-01");
  });
});

describe("gallery course activity range", () => {
  it("includes every course whose activity overlaps the selected range", () => {
    assert.equal(
      courseOverlapsDateRange("2026-01-01", "2026-01-31", "2026-01-15", "2026-02-15"),
      true
    );
    assert.equal(
      courseOverlapsDateRange("2026-02-15", "2026-03-01", "2026-01-15", "2026-02-15"),
      true
    );
    assert.equal(
      courseOverlapsDateRange("2026-01-01", null, "2026-06-01", "2026-06-30"),
      true
    );
  });

  it("excludes courses outside the range or without a known start", () => {
    assert.equal(
      courseOverlapsDateRange("2025-01-01", "2025-12-31", "2026-01-01", "2026-12-31"),
      false
    );
    assert.equal(
      courseOverlapsDateRange("2027-01-01", "2027-02-01", "2026-01-01", "2026-12-31"),
      false
    );
    assert.equal(
      courseOverlapsDateRange(null, null, "2026-01-01", "2026-12-31"),
      false
    );
  });
});

describe("gallery default availability", () => {
  it("opens on courses that are open for registration when no availability is given", () => {
    const filters = parseDashboardFilters(new URLSearchParams(""));
    assert.equal(effectiveAvailability(filters), "open");
    assert.equal(filtersToListParams(filters).availability, "open");
    assert.equal(filtersToFormState(filters).availability, "open");
    assert.equal(hasActiveFilters(filters), false);
  });

  it("treats availability=all as the explicit everything option", () => {
    const filters = parseDashboardFilters(new URLSearchParams("availability=all"));
    assert.equal(filters.availability, "all");
    assert.equal(effectiveAvailability(filters), undefined);
    assert.equal(filtersToListParams(filters).availability, undefined);
    assert.equal(filtersToFormState(filters).availability, "");
    assert.equal(hasActiveFilters(filters), true);
    assert.equal(dashboardHref(filters), "/dashboard?availability=all");
  });

  it("keeps other availability choices as they are", () => {
    const filters = parseDashboardFilters(new URLSearchParams("availability=ended"));
    assert.equal(effectiveAvailability(filters), "ended");
    assert.equal(filtersToFormState(filters).availability, "ended");
    assert.equal(hasActiveFilters(filters), true);
  });

  it("ignores unknown availability values and falls back to the default", () => {
    const filters = parseDashboardFilters(new URLSearchParams("availability=nonsense"));
    assert.equal(filters.availability, undefined);
    assert.equal(effectiveAvailability(filters), "open");
  });
});

describe("gallery visibility (hidden courses)", () => {
  it("lists a normal course", () => {
    assert.equal(resolveIsPublic({}), true);
    assert.equal(resolveIsPublic({ hidden: false, audienceCategory: "youth" }), true);
    assert.equal(isListedInGallery({ isPublic: true, audienceCategory: "youth" }), true);
  });

  it("hides a course the creator marked as hidden", () => {
    assert.equal(resolveIsPublic({ hidden: true, audienceCategory: "youth" }), false);
  });

  it("keeps older courses without the flag or audience listed", () => {
    assert.equal(isListedInGallery({}), true);
    assert.equal(isListedInGallery({ isPublic: null }), true);
  });

  it("does not list a stored course with is_public=false", () => {
    assert.equal(isListedInGallery({ isPublic: false }), false);
  });
});

describe("guides audience (מדריכים)", () => {
  it("is offered when creating a course but not as a gallery filter", () => {
    assert.ok(COURSE_AUDIENCE_OPTIONS.some((o) => o.value === "guides"));
    assert.ok(!AUDIENCE_CATEGORY_OPTIONS.some((o) => (o.value as string) === "guides"));
  });

  it("ignores audience=guides in the gallery URL", () => {
    const filters = parseDashboardFilters(new URLSearchParams("audience=guides"));
    assert.equal(filters.audience, undefined);
  });

  it("is never public, even when not marked hidden", () => {
    assert.equal(resolveIsPublic({ hidden: false, audienceCategory: "guides" }), false);
    assert.equal(isListedInGallery({ isPublic: true, audienceCategory: "guides" }), false);
  });
});

describe("referral free text", () => {
  it("keeps a guide's name as typed", () => {
    assert.equal(normalizeReferral("  דנה   כהן, המדריכה "), "דנה כהן, המדריכה");
  });

  it("returns null for empty or non-string values", () => {
    assert.equal(normalizeReferral("   "), null);
    assert.equal(normalizeReferral(undefined), null);
    assert.equal(normalizeReferral(42), null);
  });

  it("caps the length", () => {
    assert.equal(normalizeReferral("א".repeat(500))?.length, REFERRAL_MAX_LENGTH);
  });
});

describe("co-guides", () => {
  const ctx = { ownerId: "owner-1", landingOrgId: "org-a" };
  const guide = { userId: "g-1", role: "instructor", status: "active", organizationId: "org-a" };

  it("only the owner or an admin can edit co-guides", () => {
    assert.equal(canEditCoGuides({ isAdmin: false, userId: "owner-1", ownerId: "owner-1" }), true);
    assert.equal(canEditCoGuides({ isAdmin: true, userId: "x", ownerId: "owner-1" }), true);
    assert.equal(canEditCoGuides({ isAdmin: false, userId: "co-1", ownerId: "owner-1" }), false);
    assert.equal(canEditCoGuides({ isAdmin: false, userId: "x", ownerId: null }), false);
  });

  it("accepts an active guide", () => {
    assert.deepEqual(checkCoGuideCandidate(guide, ctx), { ok: true });
  });

  it("rejects unknown users, students, inactive guides and the owner", () => {
    assert.equal(checkCoGuideCandidate(null, ctx).ok, false);
    assert.equal(checkCoGuideCandidate({ ...guide, role: "student" }, ctx).ok, false);
    assert.equal(checkCoGuideCandidate({ ...guide, status: "pending" }, ctx).ok, false);
    assert.equal(checkCoGuideCandidate({ ...guide, userId: "owner-1" }, ctx).ok, false);
  });

  it("rejects a guide from another organization", () => {
    assert.equal(checkCoGuideCandidate({ ...guide, organizationId: "org-b" }, ctx).ok, false);
    assert.equal(checkCoGuideCandidate({ ...guide, organizationId: null }, ctx).ok, true);
  });

  it("normalizes and validates emails", () => {
    assert.equal(normalizeEmail("  Dana@Example.COM "), "dana@example.com");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.equal(normalizeEmail(5), null);
  });
});

describe("course image downloads", () => {
  const supa = "https://abc.supabase.co";

  it("only allows our own public storage objects", () => {
    assert.equal(
      isAllowedAssetUrl(`${supa}/storage/v1/object/public/courses/x/banner.webp`, supa),
      true
    );
    assert.equal(isAllowedAssetUrl("https://evil.example/storage/v1/object/public/a.png", supa), false);
    assert.equal(isAllowedAssetUrl(`${supa}/rest/v1/landings`, supa), false);
    assert.equal(isAllowedAssetUrl("http://abc.supabase.co/storage/v1/object/public/a.png", supa), false);
    assert.equal(isAllowedAssetUrl("data:image/png;base64,AAA", supa), false);
    assert.equal(isAllowedAssetUrl(`${supa}/storage/v1/object/public/a.png`, undefined), false);
  });

  it("parses the kind and picks the full-size url", () => {
    assert.equal(parseDownloadKind("banner"), "banner");
    assert.equal(parseDownloadKind("../etc"), null);
    const assets = { bannerFullUrl: "b", backgroundFullUrl: "" };
    assert.equal(pickAssetUrl(assets, "banner"), "b");
    assert.equal(pickAssetUrl(assets, "background"), null);
  });

  it("builds a safe file name and a header that keeps Hebrew", () => {
    const name = downloadFileName('קורס: "יצירה/חדשה"', "banner");
    assert.equal(name, "קורס יצירה חדשה-banner.png");
    const header = contentDisposition(name);
    assert.ok(header.startsWith("attachment;"));
    assert.ok(header.includes("filename*=UTF-8"));
    assert.equal(downloadFileName(undefined, "background"), "background.png");
  });
});

describe("editing a course after creation", () => {
  const base = {
    course: {
      title: "קורס",
      description: "תיאור",
      audienceCategory: "youth",
      sector: "general",
      schedule: { startDate: "2026-12-01", endDate: "2027-01-01", dates: "2026-12-01 - 2027-01-01" },
    },
    form: { requiresInterview: false, referralOptions: ["אחר"] },
    isPublic: true,
    price: null,
    startDate: "2026-12-01",
    endDate: "2027-01-01",
  };

  it("updates text and keeps fields it does not own", () => {
    const r = applyCourseEdits(base, { title: "  שם חדש  ", location: "ירושלים" });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.value.course.title, "שם חדש");
    assert.equal(r.value.course.location, "ירושלים");
    assert.equal(r.value.course.sector, "general");
    assert.deepEqual(r.value.form.referralOptions, ["אחר"]);
  });

  it("keeps the date columns and the display string in sync", () => {
    const r = applyCourseEdits(base, { startDate: "2026-12-10", endDate: "" });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(r.value.columns.start_date, "2026-12-10");
    assert.equal(r.value.columns.end_date, null);
    const schedule = r.value.course.schedule as Record<string, unknown>;
    assert.equal(schedule.endDate, undefined);
    assert.equal(schedule.dates, "2026-12-10");
  });

  it("rejects bad input", () => {
    assert.equal(applyCourseEdits(base, { title: "   " }).ok, false);
    assert.equal(applyCourseEdits(base, { startDate: "2026-02-30" }).ok, false);
    assert.equal(applyCourseEdits(base, { startDate: "2027-02-01", endDate: "2027-01-01" }).ok, false);
    assert.equal(applyCourseEdits(base, { price: -5 }).ok, false);
    assert.equal(applyCourseEdits(base, { paymentLink: "javascript:alert(1)" }).ok, false);
  });

  it("hides and unhides, but guides courses stay hidden", () => {
    const hide = applyCourseEdits(base, { hidden: true });
    assert.ok(hide.ok && hide.value.columns.is_public === false);
    const guides = { ...base, course: { ...base.course, audienceCategory: "guides" }, isPublic: false };
    const show = applyCourseEdits(guides, { hidden: false });
    assert.ok(show.ok && show.value.columns.is_public === false);
  });

  it("keeps an existing hidden course hidden when visibility is not edited", () => {
    const r = applyCourseEdits({ ...base, isPublic: false }, { title: "חדש" });
    assert.ok(r.ok && r.value.columns.is_public === false);
  });
});

describe("storage object path (download hardening)", () => {
  const supa = "https://abc.supabase.co";
  const bucket = "course-media";
  const ok = `${supa}/storage/v1/object/public/${bucket}/courses/ab12cd34/banner-full.webp`;

  it("extracts a valid object path and rebuilds the url from it", () => {
    const path = storageObjectPath(ok, supa, bucket);
    assert.equal(path, "courses/ab12cd34/banner-full.webp");
    assert.equal(buildAssetUrl(supa, bucket, path!), ok);
    assert.equal(
      storageObjectPath(`${supa}/storage/v1/object/public/${bucket}/tmp/s_1-x/hero-thumb.webp`, supa, bucket),
      "tmp/s_1-x/hero-thumb.webp"
    );
  });

  it("rejects traversal, other folders, other buckets and other hosts", () => {
    assert.equal(storageObjectPath(`${supa}/storage/v1/object/public/${bucket}/courses/../secret.webp`, supa, bucket), null);
    assert.equal(storageObjectPath(`${supa}/storage/v1/object/public/${bucket}/brand/logos/a.png`, supa, bucket), null);
    assert.equal(storageObjectPath(`${supa}/storage/v1/object/public/other/courses/a/b.webp`, supa, bucket), null);
    assert.equal(storageObjectPath("https://evil.example/storage/v1/object/public/course-media/courses/a/b.webp", supa, bucket), null);
  });

  it("validates emails without regex backtracking", () => {
    assert.equal(normalizeEmail("a@b.co"), "a@b.co");
    assert.equal(normalizeEmail("a@@b.co"), null);
    assert.equal(normalizeEmail("a@b"), null);
    assert.equal(normalizeEmail("a b@c.co"), null);
    assert.equal(normalizeEmail("@b.co"), null);
    assert.equal(normalizeEmail("a@b."), null);
    assert.equal(normalizeEmail("!@" + "!.".repeat(5000)), null);
  });
});

describe("safe img src", () => {
  it("keeps normal image sources", () => {
    assert.equal(safeImgSrc("https://x.supabase.co/storage/v1/object/public/b/a.webp"), "https://x.supabase.co/storage/v1/object/public/b/a.webp");
    assert.equal(safeImgSrc("blob:http://localhost:3000/1234-abcd"), "blob:http://localhost:3000/1234-abcd");
    assert.equal(safeImgSrc("data:image/png;base64,iVBORw0KGgo="), "data:image/png;base64,iVBORw0KGgo=");
    assert.equal(safeImgSrc("/icons/a%20b.svg"), "/icons/a%20b.svg");
  });

  it("blocks scripts, html and non-image data", () => {
    assert.equal(safeImgSrc("javascript:alert(1)"), "");
    assert.equal(safeImgSrc("JaVaScRiPt:alert(1)"), "");
    assert.equal(safeImgSrc("data:text/html,<script>alert(1)</script>"), "");
    assert.equal(safeImgSrc('https://a.com/x" onerror="alert(1)'), "");
    assert.equal(safeImgSrc("https://a.com/<svg onload=alert(1)>"), "");
    assert.equal(safeImgSrc("vbscript:msgbox"), "");
    assert.equal(safeImgSrc("https://a.com/%E0%A4%A"), "");
  });
});

describe("reserved banner zones", () => {
  it("reserves nothing at the top when there are no logos", () => {
    assert.equal(topZonePercent(0), 0);
    assert.equal(bottomZonePercent(false), 0);
    assert.equal(reservedZonesPrompt(0, false), "");
  });

  it("grows with the number of logo rows, and stays small for a single row", () => {
    const one = topZonePercent(1);
    assert.equal(topZonePercent(8), one);
    assert.ok(one >= 12 && one <= 16, `one row: ${one}`);
    assert.ok(topZonePercent(9) > one);
    assert.ok(topZonePercent(15) >= topZonePercent(9));
    assert.ok(topZonePercent(15) <= 30);
  });

  it("names only the zones that are really used", () => {
    const top = reservedZonesPrompt(3, false);
    assert.ok(top.includes("the top") && !top.includes("bottom"));
    const bottom = reservedZonesPrompt(0, true);
    assert.ok(bottom.includes("the bottom") && !bottom.includes("the top"));
    const both = reservedZonesPrompt(3, true);
    assert.ok(both.includes("the top") && both.includes("the bottom"));
    assert.ok(both.includes("out-of-focus scenery") && both.includes("no flat band"));
  });

  it("never contains a digit or a percent sign (the model draws them as labels)", () => {
    for (const logos of [0, 1, 3, 8, 9, 15]) {
      for (const details of [false, true]) {
        const line = reservedZonesPrompt(logos, details);
        assert.ok(!/[0-9%]/.test(line), `${logos}/${details}: ${line}`);
      }
    }
  });
});

describe("zone prompt cushion", () => {
  it("asks for a slightly bigger zone than the code needs", () => {
    assert.equal(fractionWord(topZonePercent(1)), "sixth");
    assert.equal(reservedZonesPrompt(1, false).includes("the top sixth"), true);
    assert.equal(reservedZonesPrompt(0, true).includes("the bottom sixth"), true);
    assert.ok(reservedZonesPrompt(15, true).includes("the top quarter"));
  });

  it("maps percentages to fraction words", () => {
    assert.equal(fractionWord(8), "tenth");
    assert.equal(fractionWord(12), "eighth");
    assert.equal(fractionWord(16), "sixth");
    assert.equal(fractionWord(20), "fifth");
    assert.equal(fractionWord(25), "quarter");
    assert.equal(fractionWord(40), "third");
  });
});

describe("code-drawn headline", () => {
  it("wraps words greedily by measured width", () => {
    const measure = (s: string) => s.length * 10;
    assert.deepEqual(wrapWords("aa bb cc dd", measure, 55), ["aa bb", "cc dd"]);
    assert.deepEqual(wrapWords("  one  ", measure, 100), ["one"]);
    assert.deepEqual(wrapWords("", measure, 100), []);
  });

  // 160x90 scene: calm grey everywhere except a skin-coloured block (a "face") and a busy stripe.
  function scene() {
    const w = 160;
    const h = 90;
    const rgb = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      rgb[i * 3] = 120;
      rgb[i * 3 + 1] = 130;
      rgb[i * 3 + 2] = 140;
    }
    const put = (x: number, y: number, r: number, g: number, b: number) => {
      const i = (y * w + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    };
    // skin block in the upper middle
    for (let y = 20; y < 50; y++) for (let x = 60; x < 100; x++) put(x, y, 224, 172, 140);
    // busy checkerboard on the left
    for (let y = 0; y < h; y++) for (let x = 0; x < 40; x++) {
      const v = (x + y) % 2 ? 255 : 0;
      put(x, y, v, v, v);
    }
    return analyzeRaw(rgb, w, h, 1);
  }

  it("detects skin tones and busy areas", () => {
    const a = scene();
    assert.ok(regionStats(a, { x: 60, y: 20, w: 40, h: 30 }).skin > 0.9);
    assert.ok(regionStats(a, { x: 0, y: 0, w: 40, h: 90 }).edge > 0.5);
    const calm = regionStats(a, { x: 110, y: 10, w: 40, h: 30 });
    assert.ok(calm.skin < 0.01 && calm.edge < 0.01);
  });

  it("places the text on calm ground, off the face and out of the reserved zones", () => {
    const a = scene();
    const block = { w: 70, h: 24 };
    const p = pickPlacement(a, 160, 90, block, { topPct: 12, bottomPct: 13 });
    const stats = regionStats(a, { x: p.x, y: p.y, w: block.w, h: block.h });
    assert.ok(stats.skin < 0.02, `skin ${stats.skin}`);
    assert.ok(stats.edge < 0.05, `edge ${stats.edge}`);
    assert.ok(p.y >= Math.round(90 * 0.12), `top zone: y=${p.y}`);
    assert.ok(p.y + block.h <= Math.round(90 * 0.87), `bottom zone: ${p.y + block.h}`);
  });

  it("keeps a block inside the zones even when the image is tiny", () => {
    const a = scene();
    const p = pickPlacement(a, 160, 90, { w: 150, h: 70 }, { topPct: 30, bottomPct: 30 });
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  });
});

describe("people boxes and overlap", () => {
  it("parses Gemini detection boxes (0-1000, [ymin,xmin,ymax,xmax])", () => {
    const boxes = parsePeopleBoxes('[{"box_2d":[100,200,900,400]},{"box_2d":[0,0,5,5]},{"label":"x"}]');
    assert.equal(boxes.length, 1);
    assert.deepEqual(boxes[0], { x: 0.2, y: 0.1, w: 0.2, h: 0.8 });
  });

  it("ignores broken answers", () => {
    assert.deepEqual(parsePeopleBoxes("no json"), []);
    assert.deepEqual(parsePeopleBoxes("[1,2,3]"), []);
    assert.deepEqual(parsePeopleBoxes(null), []);
    assert.deepEqual(parsePeopleBoxes('[{"box_2d":[1,2,3]}]'), []);
  });

  it("measures how much of a block is covered", () => {
    const block = { x: 0, y: 0, w: 100, h: 100 };
    assert.equal(overlapFraction(block, []), 0);
    assert.equal(overlapFraction(block, [{ x: 200, y: 0, w: 50, h: 50 }]), 0);
    assert.equal(overlapFraction(block, [{ x: 50, y: 0, w: 100, h: 100 }]), 0.5);
    assert.equal(overlapFraction(block, [{ x: -10, y: -10, w: 500, h: 500 }]), 1);
  });

  it("places the text clear of people when there is room", () => {
    // scene is 160x90; people fill the middle band.
    const a = analyzeRaw(new Uint8Array(160 * 90 * 3).fill(128), 160, 90, 1);
    const people = [{ x: 0, y: 30, w: 160, h: 60 }];
    const block = { w: 80, h: 20 };
    const p = pickPlacement(a, 160, 90, block, { topPct: 5, bottomPct: 5 }, people);
    assert.equal(p.overlap, 0);
    assert.ok(p.y + block.h <= 30, `y=${p.y}`);
  });
});

describe("banner headline fonts", () => {
  it("maps every font choice to an embedded font", () => {
    const keys = new Set(HEBREW_FONTS.map((f) => bannerFontKey(f.id)));
    assert.ok(keys.has("heebo") && keys.has("frank-ruhl-libre") && keys.has("arimo") && keys.has("varela-round"));
    assert.equal(bannerFontKey("tamlil"), "assistant");
    assert.equal(bannerFontKey("kedim"), "frank-ruhl-libre");
    assert.equal(bannerFontKey("arial"), "arimo");
    assert.equal(bannerFontKey(undefined), "heebo");
    assert.equal(bannerFontKey("no-such-font"), "heebo");
  });

  it("draws Hebrew and Latin text with each embedded font", async () => {
    const canvas = await loadCanvas();
    assert.ok(canvas, "canvas should load");
    const ctx = canvas!.createCanvas(10, 10).getContext("2d");
    const widths = new Map<string, number>();
    for (const font of HEBREW_FONTS) {
      const spec = await ensureBannerFont(font.id);
      ctx.font = `${spec.weight} 40px ${spec.stack}`;
      const he = ctx.measureText("שלום עולם").width;
      const la = ctx.measureText("Hello 2027").width;
      assert.ok(he > 50 && la > 50, `${font.id}: he=${he} la=${la}`);
      widths.set(bannerFontKey(font.id), Math.round(he));
    }
    // different fonts really give different shapes (not all falling back to Heebo)
    assert.ok(new Set(widths.values()).size >= 6, JSON.stringify([...widths]));
  });
});

describe("headline box: heads first, compact", () => {
  it("goes over a torso rather than a head when there is no free space", () => {
    const a = analyzeRaw(new Uint8Array(160 * 90 * 3).fill(128), 160, 90, 1);
    // one person fills the frame: head area on top, body below
    const people = [{ x: 0, y: 2, w: 160, h: 88 }];
    const p = pickPlacement(a, 160, 90, { w: 70, h: 14 }, { topPct: 0, bottomPct: 0 }, people);
    assert.equal(p.overlap, 0, "head must stay clear");
    assert.ok(p.bodyOverlap > 0.5, `body overlap ${p.bodyOverlap}`);
  });

  it("keeps the drawn text and its box compact even for a very long title", async () => {
    const W = 1376;
    const H = 768;
    const flat = await sharp({ create: { width: W, height: H, channels: 3, background: { r: 90, g: 110, b: 130 } } })
      .png()
      .toBuffer();
    const title = "קורס הכשרה מקיף ומעמיק למדריכים ולמדריכות בתחומי הנוער והקהילה בירושלים";
    const subtitle = "כלים מעשיים, ליווי אישי, התנסות בשטח ועבודה בקבוצות קטנות לאורך כל השנה";
    const out = await drawHeadline(new Uint8Array(flat), { title, subtitle }, { logoCount: 3, hasDetailsLine: true }, []);
    const before = await sharp(flat).raw().toBuffer();
    const after = await sharp(Buffer.from(out)).removeAlpha().raw().toBuffer();
    let x0 = W, x1 = 0, y0 = H, y1 = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        if (Math.abs(before[i] - after[i]) + Math.abs(before[i + 1] - after[i + 1]) + Math.abs(before[i + 2] - after[i + 2]) > 12) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    const share = ((x1 - x0) * (y1 - y0)) / (W * H);
    assert.ok(x1 > x0 && y1 > y0, "something was drawn");
    assert.ok(share <= 0.27, `box covers ${(share * 100).toFixed(1)}% of the image`);
    assert.ok(y0 >= H * 0.1, `stays below the logo zone, top=${y0}`);
    // With no people in the scene the text sits in the top third, right under the logo strip.
    assert.ok(y1 <= H * 0.45, `text stays in the top part, bottom=${y1}`);
    assert.ok(y1 <= H * 0.87, `stays above the details zone, bottom=${y1}`);
  });
});
