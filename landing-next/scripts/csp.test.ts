import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCsp, newNonce } from "../lib/security/csp";

describe("content security policy", () => {
  it("production script-src has the nonce and no unsafe-inline or unsafe-eval", () => {
    const csp = buildCsp("abc123", { dev: false });
    const script = csp.split("; ").find((d) => d.startsWith("script-src"))!;
    assert.match(script, /'nonce-abc123'/);
    assert.doesNotMatch(script, /unsafe-inline/);
    assert.doesNotMatch(script, /unsafe-eval/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'self'/);
    assert.match(csp, /upgrade-insecure-requests/);
  });

  it("dev allows eval for Next tooling only", () => {
    const csp = buildCsp("abc123", { dev: true });
    assert.match(csp, /'unsafe-eval'/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);
  });

  it("nonces are random base64", () => {
    const a = newNonce();
    const b = newNonce();
    assert.notEqual(a, b);
    assert.match(a, /^[A-Za-z0-9+/]+=*$/);
  });

  it("allows only the hosts the app really uses", () => {
    const csp = buildCsp("n");
    assert.match(csp, /supabase\.co/);
    assert.doesNotMatch(csp, /generativelanguage/);
  });
});
