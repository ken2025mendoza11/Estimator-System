/**
 * Local email/password sign-in (this app's Better Auth DB — not the broker).
 *
 * On only when `isTestDeployment` is true. Production, and any host that is
 * missing the test env vars, leaves this false. `/api/auth/sign-in/email`
 * then returns 404 (see `emailSignInGate`).
 *
 * Do NOT edit `server.ts` for this — that file reads this flag.
 */
import { isTestDeployment } from "./test-login";

export const emailAndPasswordEnabled = isTestDeployment(process.env);
