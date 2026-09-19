import { b as require_jsx_runtime, v as Navigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as GROK_PROVIDERS } from "./server-BnOC-dQK.mjs";
import { r as useCurrentUserState, t as signIn } from "./use-current-user-Dv6i8RUO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/login-CcUf3qAZ.js
var import_jsx_runtime = require_jsx_runtime();
function Login() {
	const { user, isPending } = useCurrentUserState();
	if (isPending) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "ce-app ce-login",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-login-card",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "ce-login-kicker",
				children: "Estimator System"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "ce-serif ce-login-title",
				children: "Opening session…"
			})]
		})
	});
	if (user) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Navigate, { to: "/" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
		className: "ce-app ce-login",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "ce-login-card",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "ce-login-kicker",
					children: "Estimator System"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
					className: "ce-serif ce-login-title",
					children: "Sign in to continue"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "ce-login-copy",
					children: "Your cost estimates, masterlist, and RCE requests save to your account automatically."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ce-login-actions",
					children: GROK_PROVIDERS.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "ce-login-btn",
						onClick: () => signIn(p.providerId, { callbackURL: "/" }),
						children: ["Continue with ", p.label]
					}, p.providerId))
				})
			]
		})
	});
}
//#endregion
export { Login as component };
