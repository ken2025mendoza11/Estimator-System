import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAuthMode } from "./auth-mode";

const deployedBase = {
  VERCEL: "1",
  BETTER_AUTH_URL: "https://estimator-system.vercel.app",
  BETTER_AUTH_SECRET: "s",
  DATABASE_URL: "postgres://x",
};

describe("resolveAuthMode", () => {
  it("uses Grok when its per-app vars are present (even if Google is set)", () => {
    const r = resolveAuthMode({ ...deployedBase, GROK_AUTH_CLIENT_ID: "a", GROK_AUTH_CLIENT_SECRET: "b", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "h" });
    assert.equal(r.mode, "grok");
    assert.equal(r.setupError, null);
  });
  it("uses Google when Grok vars are absent", () => {
    const r = resolveAuthMode({ ...deployedBase, GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "h" });
    assert.equal(r.mode, "google");
    assert.equal(r.setupError, null);
  });
  it("keeps the sandbox/local preview fallback when nothing is set and not deployed", () => {
    const r = resolveAuthMode({});
    assert.equal(r.mode, "grok");
    assert.equal(r.deployed, false);
    assert.equal(r.setupError, null);
  });
  it("reports missing secret, database and provider when deployed bare", () => {
    const r = resolveAuthMode({ VERCEL: "1" });
    assert.equal(r.mode, "none");
    assert.match(r.setupError ?? "", /BETTER_AUTH_SECRET/);
    assert.match(r.setupError ?? "", /DATABASE_URL/);
    assert.match(r.setupError ?? "", /GOOGLE_CLIENT_ID/);
  });
  it("reports only the missing secret", () => {
    const r = resolveAuthMode({ ...deployedBase, BETTER_AUTH_SECRET: " ", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "h" });
    assert.equal(r.mode, "google");
    assert.match(r.setupError ?? "", /BETTER_AUTH_SECRET/);
    assert.doesNotMatch(r.setupError ?? "", /DATABASE_URL/);
  });
  it("honours VITE_AUTH_ENABLED=false", () => {
    assert.equal(resolveAuthMode({ ...deployedBase, VITE_AUTH_ENABLED: "false", GOOGLE_CLIENT_ID: "g", GOOGLE_CLIENT_SECRET: "h" }).mode, "none");
  });
  it("offers Microsoft beside Google without changing the mode", () => {
    const r = resolveAuthMode({
      ...deployedBase,
      GOOGLE_CLIENT_ID: "g",
      GOOGLE_CLIENT_SECRET: "h",
      MICROSOFT_CLIENT_ID: "m",
      MICROSOFT_CLIENT_SECRET: "s",
    });
    assert.equal(r.mode, "google");
    assert.equal(r.microsoft, true);
    assert.equal(r.setupError, null);
  });
  it("does not offer Microsoft on the Grok path", () => {
    const r = resolveAuthMode({
      ...deployedBase,
      GROK_AUTH_CLIENT_ID: "a",
      GROK_AUTH_CLIENT_SECRET: "b",
      MICROSOFT_CLIENT_ID: "m",
      MICROSOFT_CLIENT_SECRET: "s",
    });
    assert.equal(r.mode, "grok");
    assert.equal(r.microsoft, false);
  });
  it("lets Microsoft stand in when Google is not configured", () => {
    const r = resolveAuthMode({
      ...deployedBase,
      MICROSOFT_CLIENT_ID: "m",
      MICROSOFT_CLIENT_SECRET: "s",
    });
    assert.equal(r.mode, "none");
    assert.equal(r.microsoft, true);
    assert.equal(r.setupError, null);
  });
});
