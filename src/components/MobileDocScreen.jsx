// @ts-nocheck
import { mobileApprove, mobileCanApprove, mobileSummary } from "../lib/estimator/mobileView";

export function MobileDocScreen({ kind, id, ceList, rceList, documents, inspections, actor, level, onApprove }) {
	const summary = mobileSummary({ kind, id, ceList, rceList, documents, inspections });
	const can = mobileCanApprove(summary, actor, level);
	return (
		<main className="ce-app" style={{ padding: "1rem", maxWidth: "40rem" }}>
			<p className="wiz-hint">Read only</p>
			<h1 className="ce-serif">{summary.title}</h1>
			{summary.found ? summary.lines.map(([label, value]) => (
				<p key={label}><b>{label}.</b> {value}</p>
			)) : <p>That record is not on this account.</p>}
			{can ? (
				<button
					type="button"
					className="ce-btn-primary"
					onClick={() => {
						const result = mobileApprove(summary, actor, level, new Date().toISOString());
						if (!result?.ok) {
							window.alert(result?.reason || "Approve is not available.");
							return;
						}
						onApprove?.(summary, result);
					}}
				>
					Approve
				</button>
			) : null}
		</main>
	);
}
