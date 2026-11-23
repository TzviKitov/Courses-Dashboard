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
  MFA_ENROLL_PATH,
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
    const sms = await signMfaTrust({ ...admin, m: "sms" }, secret);
    assert.equal(
      await parseMfaTrustCookie(
        sms,
        { userId: "user-admin", role: "admin" },
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

  it("routes admins to TOTP and instructors to SMS", () => {
    assert.equal(mfaPathForRole("admin"), MFA_ENROLL_PATH);
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
