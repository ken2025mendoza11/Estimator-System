import { useEffect, useState } from "react";
import { requireReason, setReasonOpener } from "../lib/estimator/reasonBox";

/** One remark box for the app. Required text is checked before it closes. */
export function ReasonAskHost() {
	const [ask, setAsk] = useState(/** @type {{ title: string, required: boolean, label: string, resolve: (result: { ok: true, text: string } | { ok: false, message: string }) => void } | null} */ (null));
	const [text, setText] = useState("");
	const [error, setError] = useState("");

	useEffect(() => {
		setReasonOpener((/** @type {{ title: string, required: boolean, label: string }} */ input) => new Promise((resolve) => {
			setText("");
			setError("");
			setAsk({ ...input, resolve });
		}));
		return () => {
			setReasonOpener(null);
		};
	}, []);

	if (!ask) return null;
	const current = ask;

	/** @param {{ ok: true, text: string } | { ok: false, message: string }} result */
	function close(result) {
		current.resolve(result);
		setAsk(null);
	}

	return (
		<div role="presentation" style={{ position: "fixed", inset: 0, background: "rgba(20,24,20,0.45)", display: "grid", placeItems: "center", zIndex: 80 }}>
			<form
				role="dialog"
				aria-modal="true"
				aria-label={current.title}
				className="ce-card"
				style={{ background: "#fff", padding: "1rem", width: "min(28rem, 92vw)" }}
				onSubmit={(event) => {
					event.preventDefault();
					const result = requireReason(text, current.required);
					if (!result.ok) {
						setError(result.message);
						return;
					}
					close(result);
				}}
			>
				<h3 className="ce-serif">{current.title}</h3>
				<label className="wiz-field">
					<span className="ce-field-label">{current.label}</span>
					<textarea className="ce-input" rows={4} value={text} onChange={(event) => setText(event.target.value)} />
				</label>
				{error ? <p className="scope-edit-banner">{error}</p> : null}
				<div className="wiz-grid">
					<button type="submit" className="ce-btn-primary ce-btn-sm">Save</button>
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => close({ ok: false, message: "Cancelled." })}>Cancel</button>
				</div>
			</form>
		</div>
	);
}