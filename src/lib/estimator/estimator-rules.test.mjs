import assert from "node:assert/strict";
import test from "node:test";
import {
  checksumTotal,
  commercialNet,
  miscAmount,
  qtyUnitAmount,
  roundMoney,
  sumRounded,
} from "./money.js";
import { applyApprovalDecision, nextCeRevision, nextRevLabel, nextRevisionNo, startApproval } from "./workflow.js";

test("roundMoney rounds half-up to cents and rejects non-finite values", () => {
  assert.equal(roundMoney(1.005), 1.01);
  assert.equal(roundMoney(1.004), 1);
  assert.equal(roundMoney(-1.005), -1.01);
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney("nope"), 0);
  assert.equal(roundMoney(Number.NaN), 0);
  assert.equal(roundMoney(Number.POSITIVE_INFINITY), 0);
  assert.equal(checksumTotal(10.005), roundMoney(10.005));
});

test("line amounts round before they are added", () => {
  assert.equal(qtyUnitAmount(2, 10), 20);
  assert.equal(qtyUnitAmount(1.5, 10.333), 15.5);
  assert.equal(qtyUnitAmount("x", 5), 0);
  assert.equal(miscAmount(2, 3, 10), 60);
  assert.equal(miscAmount(2, 0, 10), 20);
  assert.equal(miscAmount(2, "", 10), 20);
  assert.equal(miscAmount(1, 2, 0.335), 0.67);

  const lines = [qtyUnitAmount(1, 10.004), qtyUnitAmount(1, 10.004), miscAmount(1, 2, 0.335)];
  assert.deepEqual(lines, [10, 10, 0.67]);
  assert.equal(sumRounded(lines), 20.67);
  assert.equal(sumRounded([0.014, 0.014]), 0.02);
  assert.notEqual(roundMoney(0.014 + 0.014), sumRounded([0.014, 0.014]));
});

test("contingency then discount, rounded once to cents", () => {
  assert.equal(commercialNet(1000, 10, 5), 1045);
  assert.equal(commercialNet(200, 0, 10), 180);
  assert.equal(commercialNet(100.1, 10, 0), 110.11);
  assert.equal(commercialNet(33.33, 10, 5), 34.83);
  assert.equal(commercialNet("nope", 10, 5), 0);
  assert.equal(checksumTotal(commercialNet(33.33, 10, 5)), 34.83);
});

test("CE revision numbers pad to two digits and skip blank or rate-like values", () => {
  assert.equal(nextCeRevision(""), "01");
  assert.equal(nextCeRevision(null), "01");
  assert.equal(nextCeRevision("0"), "01");
  assert.equal(nextCeRevision("00"), "01");
  assert.equal(nextCeRevision("1.25"), "01");
  assert.equal(nextCeRevision("01"), "02");
  assert.equal(nextCeRevision("9"), "10");
  assert.equal(nextCeRevision("CE rev 07"), "08");
  assert.equal(nextRevLabel("0"), "1");
  assert.equal(nextRevLabel(""), "1");
  assert.equal(nextRevLabel("Rev 3"), "4");
  assert.equal(nextRevLabel("rev 09"), "10");
  assert.equal(nextRevLabel("pack 12"), "13");
  assert.equal(nextRevLabel("no digits"), "1");
});

test("the next family revision is one past the highest stored number", () => {
  const ceList = [{ id: "CE-100" }, { id: "CE-100-R02" }, { id: "CE-200" }];
  const documents = {
    "CE-100": { projectInfo: { docNo: "CE-100", revNo: "01" } },
    "CE-100-R02": { projectInfo: { docNo: "CE-100", revNo: "02" } },
    "CE-200": { projectInfo: { docNo: "CE-200", revNo: "09" } },
  };
  assert.equal(nextRevisionNo("CE-100", ceList, documents), "03");
  assert.equal(nextRevisionNo("CE-200", ceList, documents), "10");
  assert.equal(
    nextRevisionNo("CE-9", [{ id: "CE-9" }], { "CE-9": { projectInfo: { revNo: "12.50" } } }),
    "01",
  );
  assert.equal(
    nextRevisionNo("CE-9", [{ id: "CE-9-R10" }], { "CE-9-R10": { projectInfo: { revNo: "00" } } }),
    "11",
  );
});

function approvalFlow() {
  return [
    { role: "staff", title: "Prepared by Sales" },
    { role: "lead", title: "Reviewed by Sales Manager" },
    { role: "head", title: "Accepted by Final approver", isFinal: true },
  ];
}

test("the person who created or started a document cannot sign it off", () => {
  const approval = startApproval(approvalFlow(), "Alex Prep", "user-alex");
  const asCreator = applyApprovalDecision(approval, {
    actor: "Casey Creator",
    level: "admin",
    decision: "accept",
    createdBy: "Casey Creator",
    submittedBy: "Alex Prep",
  });
  assert.equal(asCreator.ok, false);
  assert.match(asCreator.reason ?? "", /cannot approve, sign, or return/);

  const asStarter = applyApprovalDecision(approval, {
    actor: "alex prep",
    level: "admin",
    decision: "reject",
    createdBy: "Casey Creator",
    submittedBy: "Someone Else",
  });
  assert.equal(asStarter.ok, false);
  assert.match(asStarter.reason ?? "", /cannot approve, sign, or return/);
});

test("one person signs only one step, then a different signer can finish", () => {
  const started = startApproval(approvalFlow(), "Alex Prep", "user-alex");
  const lead = applyApprovalDecision(started, {
    actor: "Blair Lead",
    level: "lead",
    decision: "accept",
    createdBy: "Casey Creator",
    submittedBy: "Alex Prep",
  });
  assert.equal(lead.ok, true);
  assert.equal(lead.final, false);
  assert.equal(lead.approval.currentIndex, 2);
  assert.equal(lead.approval.steps[1].by, "Blair Lead");

  const samePerson = applyApprovalDecision(lead.approval, {
    actor: "Blair Lead",
    level: "admin",
    decision: "accept",
    createdBy: "Casey Creator",
    submittedBy: "Alex Prep",
  });
  assert.equal(samePerson.ok, false);
  assert.match(samePerson.reason ?? "", /already signed a step/);

  const head = applyApprovalDecision(lead.approval, {
    actor: "Harper Head",
    level: "head",
    decision: "accept",
    createdBy: "Casey Creator",
    submittedBy: "Alex Prep",
  });
  assert.equal(head.ok, true);
  assert.equal(head.final, true);
  assert.equal(head.approval.status, "accepted");
  assert.equal(head.approval.steps[2].by, "Harper Head");
  assert.equal(head.approval.steps[1].by, "Blair Lead");
});
