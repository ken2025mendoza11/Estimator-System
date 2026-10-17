import assert from "node:assert/strict";
import { test } from "node:test";
import { emailAllowed, parseAllowlist } from "./email-allowlist.ts";

test("parseAllowlist trims, lower-cases, and drops blanks", () => {
  assert.deepEqual(parseAllowlist(" Ken@Example.com , ,@Firm.COM "), ["ken@example.com", "@firm.com"]);
  assert.deepEqual(parseAllowlist(""), []);
  assert.deepEqual(parseAllowlist(undefined), []);
});

test("full email entries match case-insensitively", () => {
  const list = parseAllowlist("ken@example.com");
  assert.equal(emailAllowed("KEN@example.com", list), true);
  assert.equal(emailAllowed(" ken@example.com ", list), true);
  assert.equal(emailAllowed("other@example.com", list), false);
});

test("@domain entries match the whole domain only", () => {
  const list = parseAllowlist("@firm.com");
  assert.equal(emailAllowed("anyone@FIRM.com", list), true);
  assert.equal(emailAllowed("x@sub.firm.com", list), false);
  assert.equal(emailAllowed("x@notfirm.com", list), false);
  assert.equal(emailAllowed("firm.com@evil.com", list), false);
});

test("missing or malformed email never matches", () => {
  const list = parseAllowlist("@firm.com, ken@example.com");
  assert.equal(emailAllowed(null, list), false);
  assert.equal(emailAllowed("", list), false);
  assert.equal(emailAllowed("no-at-sign", list), false);
});
