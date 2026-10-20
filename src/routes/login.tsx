import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { authClient, authEnabled, signIn } from "@/lib/auth/client";
import { getSignInOptions } from "@/lib/auth/sign-in-options";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({
  loader: () => getSignInOptions(),
  component: Login,
});

function Login() {
  const { user, isPending } = useCurrentUserState();
  const { providers, setupError, testLogin } = Route.useLoaderData();
  const [signInError, setSignInError] = useState<string | null>(null);
  if (isPending) {
    return (
      <main className="ce-app ce-login">
        <div className="ce-login-card">
          <p className="ce-login-kicker">Estimator System</p>
          <h1 className="ce-serif ce-login-title">Opening session…</h1>
        </div>
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  return (
    <main className="ce-app ce-login">
      <div className="ce-login-card">
        <p className="ce-login-kicker">Estimator System</p>
        <h1 className="ce-serif ce-login-title">Sign in to continue</h1>
        <p className="ce-login-copy">
          Your cost estimates, masterlist, and RCE requests save to your account
          automatically.
        </p>
        {setupError ? (
          <p className="ce-login-copy" role="alert">{setupError}</p>
        ) : authEnabled && providers.length > 0 ? (
          <div className="ce-login-actions">
            {providers.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className="ce-login-btn"
                onClick={() => {
                  setSignInError(null);
                  signIn(p.providerId, { callbackURL: "/", errorCallbackURL: "/login" }).catch(
                    (err: unknown) =>
                      setSignInError(err instanceof Error ? err.message : "Sign-in failed"),
                  );
                }}
              >
                Continue with {p.label}
              </button>
            ))}
            {signInError ? (
              <p className="ce-login-copy" role="alert">{signInError}</p>
            ) : null}
          </div>
        ) : (
          <p className="ce-login-copy">Sign-in is disabled.</p>
        )}
        {testLogin ? (
          <div className="ce-login-actions">
            <p className="ce-login-copy">Test sign-in</p>
            {testLogin.users.map((account) => (
              <button
                key={account.role}
                type="button"
                className="ce-login-btn"
                onClick={() => {
                  setSignInError(null);
                  if (!testLogin.password) {
                    setSignInError("ESTIMATOR_TEST_PASSWORD is not set on this server.");
                    return;
                  }
                  authClient.signIn
                    .email({
                      email: account.email,
                      password: testLogin.password,
                      callbackURL: "/",
                    })
                    .then((result) => {
                      if (result.error) {
                        setSignInError(result.error.message ?? "Sign-in failed");
                        return;
                      }
                      window.location.href = "/";
                    })
                    .catch((err: unknown) =>
                      setSignInError(err instanceof Error ? err.message : "Sign-in failed"),
                    );
                }}
              >
                Sign in as {account.label}
              </button>
            ))}
            {signInError ? (
              <p className="ce-login-copy" role="alert">{signInError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </main>
  );
}
