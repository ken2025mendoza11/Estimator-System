import assert from "node:assert/strict";
import test from "node:test";
import {
  DOC_NUMBER_RETRY,
  blockedNumberReason,
  formatDocNo,
  issueDocNo,
  missingDocNumberRpc,
  numberIdentityClash,
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

test("a missing allocator does not invent a local number", async () => {
  let fallback = 0;
  await assert.rejects(
    () => issueDocNo(async () => {
      fallback += 1;
      return null;
    }),
    new RegExp(DOC_NUMBER_RETRY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  assert.equal(fallback, 1);
  await assert.rejects(() => issueDocNo(async () => {
    throw new Error("schema cache");
  }), /Couldn't get a number, try again/);
});

test("the same number on a different document is refused", () => {
  const rows = [{ kind: "rce", id: "RCE-2026-001", rceNo: "RCE-2026-001" }];
  const clash = numberIdentityClash(rows, { kind: "rce", id: "RCE-2026-009", payload: { rceNo: "RCE-2026-001" } });
  assert.equal(clash?.ok, false);
  assert.equal(clash?.message, "That number is already used.");
  assert.equal(numberIdentityClash(rows, { kind: "rce", id: "RCE-2026-001", payload: { rceNo: "RCE-2026-001" } }), null);
  assert.equal(rows[0].rceNo, "RCE-2026-001");
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
