// @ts-nocheck
import { useCallback, useEffect, useRef, useState } from "react";
import {
	addAllowlistEntry,
	approveInstead,
	declineAsDuplicate,
	declineUserWithReason,
	disableUser,
	grantUserRole,
	listAllowlist,
	listPossibleDuplicates,
	listUserAccess,
	markAccessReminded,
	removeAllowlistEntry,
	requestAccountLink,
	setAccountDepartment,
	setPublicBranding
} from "../lib/supabase/account-role";
import { DEPARTMENTS } from "../lib/estimator/departments";
import { QUEUE_TABS, compareAccounts, linkAllowed, queueRows, reminderDue } from "../lib/estimator/loginUi";

const ROLES = ["staff", "lead", "head", "admin"];

export function AccessQueue({ microsoftLinkFlow = false, onMicrosoftLinkFlow, departmentsOn = false, onAccountDepartment }) {
	const [tab, setTab] = useState("pending");
	const [rows, setRows] = useState([]);
	const [pairs, setPairs] = useState([]);
	const [allow, setAllow] = useState([]);
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState("");
	const [reason, setReason] = useState("");
	const [entry, setEntry] = useState("");
	const [brand, setBrand] = useState({ name: "", logo: "", contact: "" });
	const reminded = useRef(new Set());
	const linking = linkAllowed({ microsoftLinkFlow });

	const reload = useCallback(() => {
		listUserAccess().then((next) => {
			const list = Array.isArray(next) ? next : [];
			setRows(list);
			setNote(list.length ? "" : "No accounts yet. If the access SQL is not applied, this list stays empty and everyone already signed in stays active.");
		}).catch((err) => setNote(err instanceof Error ? err.message : "The account list could not be loaded."));
		listPossibleDuplicates().then((next) => setPairs(Array.isArray(next) ? next : [])).catch(() => setPairs([]));
		listAllowlist().then((next) => setAllow(Array.isArray(next) ? next : [])).catch(() => setAllow([]));
	}, []);

	useEffect(() => {
		reload();
	}, [reload]);

	useEffect(() => {
		const now = new Date();
		rows.filter((row) => row.status === "pending" && reminderDue(row.requestedAt, row.remindedAt, now)).forEach((row) => {
			if (!row.userKey || reminded.current.has(row.userKey)) return;
			reminded.current.add(row.userKey);
			markAccessReminded(row.userKey).catch(() => undefined);
		});
	}, [rows]);

	function run(key, action) {
		setBusy(key);
		setNote("");
		action().then((result) => {
			if (result && result.ok === false) setNote(result.reason || "That change was not saved.");
			reload();
		}).catch((err) => setNote(err instanceof Error ? err.message : "That change was not saved.")).finally(() => setBusy(""));
	}

	const visible = tab === "duplicates" ? [] : queueRows(rows, tab);
	const due = rows.filter((row) => row.status === "pending" && reminderDue(row.requestedAt, row.remindedAt, new Date()));
	const clientPairs = [];
	for (let i = 0; i < rows.length; i += 1) {
		for (let j = i + 1; j < rows.length; j += 1) {
			const kind = compareAccounts(rows[i], rows[j]);
			if (kind === "none") continue;
			clientPairs.push({ left: rows[i], right: rows[j], kind });
		}
	}

	return (
		<section className="ce-card ce-login-queue" aria-label="Account access queue">
			<h2 className="ce-serif">Account access</h2>
			<p className="ce-login-copy">Pending, duplicates, active, declined, disabled, and the allowlist. A second active account with the same email is refused.</p>
			<label className="ce-login-check">
				<input
					type="checkbox"
					checked={linking}
					onChange={(event) => onMicrosoftLinkFlow?.(event.target.checked)}
				/>
				<span>Microsoft link requests (off by default). A request is stored and the accounts are not linked.</span>
			</label>
			{due.length ? (
				<p className="ce-login-banner" role="status">
					{due.length} pending account{due.length === 1 ? "" : "s"} waiting more than 3 hours.
				</p>
			) : null}
			<div className="ce-login-tabs" role="tablist" aria-label="Access queue">
				{QUEUE_TABS.map(([id, label]) => (
					<button key={id} type="button" role="tab" aria-selected={tab === id} className="ce-login-btn ce-login-btn-quiet" onClick={() => setTab(id)}>
						{label}
					</button>
				))}
			</div>
			{note ? <p className="wiz-hint" role="status">{note}</p> : null}
			{tab !== "duplicates" && tab !== "allowlist" ? (
				<ul className="ce-login-people">
					{visible.map((row) => (
						<li key={row.userKey || row.email}>
							<span>{row.name ? `${row.name} · ` : ""}{row.email || row.userKey} · {row.role || "staff"} · {row.status || "pending"}</span>
							{departmentsOn ? (
								<label className="ce-login-field">
									<span className="ce-field-label">Department</span>
									<select
										className="ce-input"
										aria-label={`Department for ${row.email || row.userKey}`}
										value={DEPARTMENTS.includes(row.accountDepartment) ? row.accountDepartment : ""}
										disabled={busy === row.userKey}
										onChange={(event) => {
											const value = event.target.value;
											run(row.userKey, () => setAccountDepartment(row.userKey, value).then((result) => {
												onAccountDepartment?.(row.userKey, value);
												return result;
											}));
										}}
									>
										<option value="">Not set</option>
										{DEPARTMENTS.map((department) => (
											<option key={department} value={department}>{department}</option>
										))}
									</select>
								</label>
							) : null}
							{row.reason ? <span>{row.reason}</span> : null}
							<span className="ce-login-actions">
								{ROLES.map((role) => (
									<button key={role} type="button" className="ce-login-btn ce-login-btn-quiet" disabled={busy === row.userKey} onClick={() => run(row.userKey, () => grantUserRole(row.userKey, role))}>
										Grant {role}
									</button>
								))}
								<button type="button" className="ce-login-btn ce-login-btn-quiet" disabled={busy === row.userKey} onClick={() => run(row.userKey, () => declineUserWithReason(row.userKey, reason || "Declined"))}>
									Decline
								</button>
								<button type="button" className="ce-login-btn ce-login-btn-quiet" disabled={busy === row.userKey} onClick={() => run(row.userKey, () => disableUser(row.userKey))}>
									Disable
								</button>
							</span>
						</li>
					))}
				</ul>
			) : null}
			{tab === "pending" ? (
				<label className="ce-login-field">
					<span className="ce-field-label">Decline reason</span>
					<input className="ce-input" value={reason} onChange={(event) => setReason(event.target.value)} />
				</label>
			) : null}
			{tab === "duplicates" ? (
				<div>
					{clientPairs.length === 0 && pairs.length === 0 ? <p className="ce-login-copy">No possible duplicates.</p> : null}
					{pairs.filter((pair) => !clientPairs.some((item) => item.left.userKey === pair.userKey && item.right.userKey === pair.otherKey)).map((pair) => (
						<article key={`${pair.userKey}-${pair.otherKey}`} className="ce-login-compare">
							<h3 className="ce-serif">{pair.kind === "email" ? "Strong match" : "Similar name"}</h3>
							<p className="ce-login-copy">{pair.kind === "email" ? "Same email." : "Similar name. This is only a warning."}</p>
							<p>{pair.email || pair.userKey} and {pair.otherEmail || pair.otherKey}</p>
							<div className="ce-login-actions">
								<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(pair.userKey, () => declineAsDuplicate(pair.userKey, pair.otherKey))}>
									Decline as duplicate
								</button>
								<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(pair.userKey, () => approveInstead(pair.userKey, "staff"))}>
									Approve this one instead
								</button>
								{linking ? (
									<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(pair.userKey, () => requestAccountLink(pair.userKey))}>
										Save a link request
									</button>
								) : null}
							</div>
						</article>
					))}
					{clientPairs.map((pair) => (
						<article key={`${pair.left.userKey}-${pair.right.userKey}`} className="ce-login-compare">
							<h3 className="ce-serif">{pair.kind === "strong" ? "Strong match" : "Similar name"}</h3>
							<p className="ce-login-copy">{pair.kind === "strong" ? "Same email." : "Similar name. This is only a warning."}</p>
							<p>{pair.left.email || pair.left.userKey} and {pair.right.email || pair.right.userKey}</p>
							<div className="ce-login-actions">
								<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(pair.left.userKey, () => declineAsDuplicate(pair.left.userKey, pair.right.userKey))}>
									Decline as duplicate
								</button>
								<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(pair.left.userKey, () => approveInstead(pair.left.userKey, "staff"))}>
									Approve this one instead
								</button>
								{linking ? (
									<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(pair.left.userKey, () => requestAccountLink(pair.left.userKey))}>
										Save a link request
									</button>
								) : null}
							</div>
						</article>
					))}
					{linking ? <p className="ce-login-copy">A saved link request does not sign that person in and does not change either user id.</p> : null}
				</div>
			) : null}
			{tab === "allowlist" ? (
				<form
					onSubmit={(event) => {
						event.preventDefault();
						run("allow", () => addAllowlistEntry(entry));
						setEntry("");
					}}
				>
					<label className="ce-login-field">
						<span className="ce-field-label">Email or @domain</span>
						<input className="ce-input" value={entry} onChange={(event) => setEntry(event.target.value)} />
					</label>
					<button type="submit" className="ce-login-btn">Add to allowlist</button>
					<ul className="ce-login-people">
						{allow.map((item) => (
							<li key={item}>
								<span>{item}</span>
								<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run(item, () => removeAllowlistEntry(item))}>Remove</button>
							</li>
						))}
					</ul>
					<h3 className="ce-serif">Public sign-in name</h3>
					<label className="ce-login-field">
						<span className="ce-field-label">Name</span>
						<input className="ce-input" value={brand.name} onChange={(event) => setBrand({ ...brand, name: event.target.value })} />
					</label>
					<label className="ce-login-field">
						<span className="ce-field-label">Logo https link</span>
						<input className="ce-input" value={brand.logo} onChange={(event) => setBrand({ ...brand, logo: event.target.value })} />
					</label>
					<label className="ce-login-field">
						<span className="ce-field-label">Contact</span>
						<input className="ce-input" value={brand.contact} onChange={(event) => setBrand({ ...brand, contact: event.target.value })} />
					</label>
					<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => run("brand", () => setPublicBranding(brand))}>
						Save public name
					</button>
				</form>
			) : null}
		</section>
	);
}
