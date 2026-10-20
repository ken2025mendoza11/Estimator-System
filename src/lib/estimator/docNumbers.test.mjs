import assert from "node:assert/strict";
import test from "node:test";
import {
  blockedNumberReason,
  formatDocNo,
  missingDocNumberRpc,
} from "./docNumbers.js";

test("document numbers keep today's format", () => {
  assert.equal(formatDocNo("ce", "C1", 2026, 1), "CE-C1-2026-001");
  assert.equal(formatDocNo("ce", "", 2026, 12), "CE-2026-012");
  assert.equal(formatDocNo("rce", "", 2026, 3), "RCE-2026-003");
  assert.equal(formatDocNo("oif", "", 2026, 40), "OIF-2026-040");
  assert.equal(formatDocNo("ce", "AB", 2026, 1000), "CE-AB-2026-1000");
});

test("a missing number RPC is detected and other errors are not", () => {
  assert.equal(missingDocNumberRpc({ code: "PGRST202", message: "Could not find the function public.next_doc_no" }), true);
  assert.equal(missingDocNumberRpc({ message: "next_doc_no does not exist" }), true);
  assert.equal(missingDocNumberRpc({ message: "permission denied" }), false);
  assert.equal(missingDocNumberRpc(null), false);
});

test("new qty, days, and money inputs stop at the cap", () => {
  assert.equal(blockedNumberReason("qty", "-1"), "Cannot be negative.");
  assert.equal(blockedNumberReason("days", "1000001"), "Cannot be more than 1,000,000.");
  assert.equal(blockedNumberReason("days", "1000000"), "");
  assert.equal(blockedNumberReason("rate", "1000000001"), "Cannot be more than 1,000,000,000.");
  assert.equal(blockedNumberReason("unitCost", "10"), "");
  assert.equal(blockedNumberReason("contingencyPct", "101"), "Must be between 0 and 100%.");
  assert.equal(blockedNumberReason("discountPct", ""), "");
  assert.equal(blockedNumberReason("description", "-5"), "");
});
