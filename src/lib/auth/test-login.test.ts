import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailAndPasswordEnabled } from "./email-password";
import {
  TEST_USERS,
  emailSignInGate,
  isTestDeployment,
  seedRefusal,
} from "./test-login";

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
  it("is staff, lead, head, and admin", () => {
    assert.deepEqual(
      TEST_USERS.map((user) => user.role),
      ["staff", "lead", "head", "admin"],
    );
  });
});
