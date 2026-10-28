import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailAndPasswordEnabled } from "./email-password";
import {
  TEST_USERS,
  emailSignInGate,
  isTestDeployment,
  seedRefusal,
} from "./test-login";
import { release1SalesApprovers } from "../estimator/departments.js";

const url = "https://test-project.supabase.co";

const ready = {
  ESTIMATOR_TEST_LOGIN: "1",
  VERCEL_ENV: "preview",
  ESTIMATOR_TEST_SUPABASE_URL: url,
  VITE_SUPABASE_URL: url,
};

describe("isTestDeployment", () => {
  it("is true only when the flag, a non-production env, and both URLs match", () => {
    assert.equal(isTestDeployment(ready), true);
    assert.equal(isTestDeployment({ ...ready, VERCEL_ENV: undefined }), true);
    assert.equal(isTestDeployment({ ...ready, VERCEL_ENV: "development" }), true);
  });

  it("is false on production", () => {
    assert.equal(isTestDeployment({ ...ready, VERCEL_ENV: "production" }), false);
  });

  it("is false when the Supabase URLs differ", () => {
    assert.equal(
      isTestDeployment({ ...ready, VITE_SUPABASE_URL: "https://other.supabase.co" }),
      false,
    );
  });

  it("is false when the flag is missing or not exactly 1", () => {
    const { ESTIMATOR_TEST_LOGIN: _flag, ...rest } = ready;
    assert.equal(isTestDeployment(rest), false);
    assert.equal(isTestDeployment({ ...ready, ESTIMATOR_TEST_LOGIN: "true" }), false);
    assert.equal(isTestDeployment({ ...ready, ESTIMATOR_TEST_LOGIN: " 1" }), false);
  });

  it("is false when the URLs are empty or blank", () => {
    assert.equal(isTestDeployment({}), false);
    assert.equal(isTestDeployment({ ...ready, ESTIMATOR_TEST_SUPABASE_URL: "" }), false);
    assert.equal(isTestDeployment({ ...ready, VITE_SUPABASE_URL: "   " }), false);
    assert.equal(
      isTestDeployment({
        ...ready,
        ESTIMATOR_TEST_SUPABASE_URL: `  ${url}  `,
        VITE_SUPABASE_URL: url,
      }),
      true,
    );
  });
});

describe("seedRefusal", () => {
  it("stops when the deployment is not the test project", () => {
    assert.match(seedRefusal({}) ?? "", /Refusing to seed/);
    assert.match(seedRefusal({ ...ready, VERCEL_ENV: "production" }) ?? "", /Refusing to seed/);
  });

  it("names missing seed settings and stays quiet when they are present", () => {
    assert.match(seedRefusal(ready) ?? "", /ESTIMATOR_TEST_PASSWORD/);
    assert.equal(
      seedRefusal({
        ...ready,
        ESTIMATOR_TEST_PASSWORD: "pw",
        SUPABASE_SERVICE_ROLE_KEY: "k",
        DATABASE_URL: "postgres://test",
      }),
      null,
    );
  });
});

describe("emailSignInGate", () => {
  it("returns 404 for the email sign-in path when the guard is off", () => {
    const res = emailSignInGate(new Request("http://localhost/api/auth/sign-in/email"), false);
    assert.equal(res?.status, 404);
  });

  it("leaves every other request alone", () => {
    assert.equal(emailSignInGate(new Request("http://localhost/api/auth/sign-in/email"), true), null);
    assert.equal(
      emailSignInGate(new Request("http://localhost/api/auth/sign-in/social"), false),
      null,
    );
  });
});

describe("emailAndPasswordEnabled", () => {
  it("follows the guard for this process", () => {
    assert.equal(emailAndPasswordEnabled, isTestDeployment(process.env));
  });
});

describe("TEST_USERS", () => {
  it("is staff, lead, head, and admin, plus pending and declined sign-ins", () => {
    assert.deepEqual(
      TEST_USERS.filter((user) => !user.accountStatus || user.accountStatus === "active").map((user) => user.role),
      ["staff", "lead", "head", "admin", "staff", "staff", "lead"],
    );
    const pending = TEST_USERS.find((user) => user.email === "sample-pending@estimator-test.invalid");
    const declined = TEST_USERS.find((user) => user.email === "sample-declined@estimator-test.invalid");
    assert.equal(pending?.accountStatus, "pending");
    assert.equal(pending?.role, "staff");
    assert.equal(declined?.accountStatus, "declined");
    assert.equal(declined?.label, "Declined");
    for (const email of ["sales@estimator-test.invalid", "sales2@estimator-test.invalid", "sales-manager@estimator-test.invalid"]) {
      assert.equal(TEST_USERS.some((user) => user.email === email), true, email);
    }
    const wired = release1SalesApprovers(TEST_USERS.filter((user) => !user.accountStatus || user.accountStatus === "active"));
    assert.ok(wired);
    assert.equal(wired.markup[0].userId, "99999999-9999-4999-8999-999999999999");
    assert.equal(wired.markup[0].backupUserId, "88888888-8888-4888-8888-888888888888");
    assert.equal(wired.proposal[0].userId, wired.markup[0].userId);
    assert.equal(wired.jobOrder[0].backupUserId, wired.markup[0].backupUserId);
  });
});
