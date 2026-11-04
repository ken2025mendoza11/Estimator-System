import { useEffect, useState } from "react";
import { markThreadRead, postMessage } from "../lib/estimator/ceThread";

/**
 * @param {{
 *   ceId: string,
 *   thread: any,
 *   actorId: string,
 *   label?: string,
 *   onSave: (ceId: string, thread: any) => void,
 *   onClose: () => void,
 * }} props
 */
export function CeThreadPanel({ ceId, thread, actorId, label = "Follow up", onSave, onClose }) {
	const [text, setText] = useState("");
	const [error, setError] = useState("");
	useEffect(() => {
		const base = thread && typeof thread === "object" ? thread : { participants: [actorId], messages: [], seen: {} };
		const seen = String(base.seen?.[actorId] || "");
		const latest = [...(base.messages || [])].reverse().find((row) => row && row.from !== actorId);
		if (latest && String(latest.at || "") > seen) onSave(ceId, markThreadRead(base, actorId, new Date().toISOString()));
	}, [ceId, actorId, thread, onSave]);
	function send(/** @type {any} */ nextText) {
		const base = thread && typeof thread === "object" ? thread : { participants: [actorId], messages: [], seen: {} };
		const posted = postMessage(base, { from: actorId, text: nextText, now: new Date().toISOString() });
		if (!posted.ok) {
			setError(posted.message || "Could not post.");
			return;
		}
		setText("");
		setError("");
		onSave(ceId, posted.thread);
	}
	return (
		<div className="ce-drawer-overlay" onClick={onClose}>
			<aside className="ce-drawer" onClick={(event) => event.stopPropagation()} aria-label="Follow up">
				<div className="ce-drawer-header">
					<b>{label}</b>
					<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={onClose}>Close</button>
				</div>
				<div className="ce-drawer-body">
					{(thread?.messages || []).map((/** @type {any} */ row) => (
						<p key={row.id} className={row.from === actorId ? "ce-thread-mine" : "ce-thread-theirs"}>{row.text}</p>
					))}
					{error ? <p className="ce-import-error">{error}</p> : null}
					<textarea className="ce-input" aria-label="Reply" value={text} onChange={(event) => setText(event.target.value)} />
					<div className="ce-header-actions">
						<button type="button" className="ce-btn-primary ce-btn-sm" onClick={() => send(text)}>Send</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => send("Info received. Resume the cost estimate.")}>Mark info received</button>
						<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => send("Follow up again.")}>Follow up again</button>
					</div>
				</div>
			</aside>
		</div>
	);
}
