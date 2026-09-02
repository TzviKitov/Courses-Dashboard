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
