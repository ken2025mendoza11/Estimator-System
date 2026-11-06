import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { getSignInOptions, type TestLoginUser } from "@/lib/auth/sign-in-options";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { normalizeBranding, phGreeting } from "@/lib/estimator/loginUi";
import { phStamp } from "@/lib/estimator/phTime";
import { loadPublicBranding } from "@/lib/supabase/account-role";

export const Route = createFileRoute("/login")({
  loader: () => getSignInOptions(),
  component: Login,
});

type EmailSignInError = { message?: string | null; status?: number } | null | undefined;

function signInFailure(error: EmailSignInError): string {
  const message = error?.message?.trim();
  if (message) return message;
  if (error?.status === 429) return "Too many sign-in attempts. Wait and try again.";
  return "Sign-in failed";
}

/** The two Sales rows share a label. The picker shows Sales 1 and Sales 2. */
function roleOptionLabel(users: readonly TestLoginUser[], account: TestLoginUser): string {
  if (account.label !== "Sales") return account.label;
  const nth = users.filter((user) => user.label === "Sales").findIndex((user) => user.email === account.email);
  return nth >= 0 ? `Sales ${nth + 1}` : account.label;
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const { providers, setupError, testLogin } = Route.useLoaderData();
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roleEmail, setRoleEmail] = useState("");
  const [brand, setBrand] = useState(() => normalizeBranding(null));
  useEffect(() => {
    let cancelled = false;
    loadPublicBranding().then((row) => {
      if (!cancelled) setBrand(normalizeBranding(row));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function signInEmail(accountEmail: string, accountPassword: string) {
    setSignInError(null);
    if (!accountPassword) {
      setSignInError("ESTIMATOR_TEST_PASSWORD is not set on this server.");
      return;
    }
    setSigningIn(true);
    try {
      const result = await authClient.signIn.email({
        email: accountEmail,
        password: accountPassword,
        callbackURL: "/",
      });
      if (result.error) {
        setSignInError(signInFailure(result.error));
        setSigningIn(false);
        return;
      }
      window.location.href = "/";
    } catch (err: unknown) {
      setSignInError(err instanceof Error ? err.message : "Sign-in failed");
      setSigningIn(false);
    }
  }

  if (isPending) {
    return (
      <main className="ce-app ce-login ce-login-split">
        <section className="ce-login-brand">
          <p className="ce-login-kicker">{brand.name}</p>
        </section>
        <div className="ce-login-card">
          <h1 className="ce-serif ce-login-title">Opening session…</h1>
        </div>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  return (
    <main className="ce-app ce-login ce-login-split">
      <section className="ce-login-brand">
        {testLogin ? (
          <p className="ce-login-banner" role="status">
            TEST
          </p>
        ) : null}
        {brand.logo ? <img className="ce-login-logo" alt="" src={brand.logo} /> : null}
        <p className="ce-login-kicker">{brand.name}</p>
        <h1 className="ce-serif ce-login-title">Sign in to continue</h1>
        <p className="ce-login-copy">
          Your cost estimates, masterlist, and RCE requests save to your account automatically.
        </p>
        {brand.contact ? <p className="ce-login-copy">{brand.contact}</p> : null}
      </section>
      <div className="ce-login-card">
        <p className="ce-serif ce-login-greet">{phGreeting()}</p>
        <p className="ce-login-ph">{phStamp(new Date(), "Philippines")}</p>
        {testLogin ? (
          <form
            className="ce-login-form"
            onSubmit={(event) => {
              event.preventDefault();
              const typed = password.trim();
              void signInEmail(email.trim(), typed || testLogin.password);
            }}
          >
            <label className="ce-login-field">
              <span className="ce-login-label">Email</span>
              <input
                className="ce-input"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                required
                disabled={signingIn}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="ce-login-field">
              <span className="ce-login-label">Password</span>
              <input
                className="ce-input"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                disabled={signingIn}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button className="ce-login-btn" type="submit" disabled={signingIn}>
              Sign in
            </button>
          </form>
        ) : null}
        {setupError ? (
          <p className="ce-login-copy" role="alert">
            {setupError}
          </p>
        ) : authEnabled && providers.length > 0 ? (
          <div className="ce-login-actions">
            {providers.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className="ce-login-btn ce-login-btn-social"
                disabled={signingIn}
                onClick={() => {
                  setSignInError(null);
                  setSigningIn(true);
                  signIn(p.providerId, { callbackURL: "/", errorCallbackURL: "/login" }).catch(
                    (err: unknown) => {
                      setSignInError(err instanceof Error ? err.message : "Sign-in failed");
                      setSigningIn(false);
                    },
                  );
                }}
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="ce-login-copy">Sign-in is disabled.</p>
        )}
        {testLogin ? (
          <form
            className="ce-login-form"
            onSubmit={(event) => {
              event.preventDefault();
              const account = testLogin.users.find((user) => user.email === roleEmail);
              if (!account) return;
              void signInEmail(account.email, testLogin.password);
            }}
          >
            <p className="ce-login-divider">Test sign-in (TEST only)</p>
            <label className="ce-login-field">
              <span className="ce-login-label">Role</span>
              <select
                className="ce-input"
                name="role"
                value={roleEmail}
                required
                disabled={signingIn}
                onChange={(event) => setRoleEmail(event.target.value)}
              >
                <option value="">Choose a role</option>
                {testLogin.users.map((account) => (
                  <option key={account.email} value={account.email}>
                    {roleOptionLabel(testLogin.users, account)}
                  </option>
                ))}
              </select>
            </label>
            <button className="ce-login-btn" type="submit" disabled={signingIn || !roleEmail}>
              Sign in
            </button>
          </form>
        ) : null}
        {signInError ? (
          <p className="ce-login-copy" role="alert">
            {signInError}
          </p>
        ) : null}
      </div>
    </main>
  );
}
