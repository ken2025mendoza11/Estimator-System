import { createFileRoute, Navigate } from "@tanstack/react-router";
import { GROK_PROVIDERS, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
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
        {authEnabled ? (
          <div className="ce-login-actions">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                className="ce-login-btn"
                onClick={() => signIn(p.providerId, { callbackURL: "/" })}
              >
                Continue with {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="ce-login-copy">Sign-in is disabled.</p>
        )}
      </div>
    </main>
  );
}
