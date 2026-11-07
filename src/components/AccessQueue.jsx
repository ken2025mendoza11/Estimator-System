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
const ROLE_LABELS = { staff: "Staff", lead: "Lead", head: "Head", admin: "Admin" };

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
	const [pickedKey, setPickedKey] = useState("");
	const [pickRole, setPickRole] = useState("staff");
	const [declining, setDeclining] = useState(false);
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
	const picked = visible.find((row) => (row.userKey || row.email) === pickedKey) || null;
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
		<section className="ce-card ce-login-queue adm6-queue" aria-label="Account access queue">
			<h2 className="ce-serif">Account access</h2>
			<p className="ce-login-copy">Pending, duplicates, active, declined, disabled, and the allowlist. A second active account with the same email is refused.</p>
			<div className="adm6-queue-bar">
				<div className="ce-login-tabs adm6-filter" role="tablist" aria-label="Access queue">
					{QUEUE_TABS.map(([id, label]) => (
						<button key={id} type="button" role="tab" aria-selected={tab === id} className={`adm6-filter-btn ${tab === id ? "is-on" : ""}`} onClick={() => { setTab(id); setPickedKey(""); setDeclining(false); }}>
							{label}
						</button>
					))}
				</div>
				<label className="ce-login-check adm6-quiet-check">
					<input
						type="checkbox"
						checked={linking}
						onChange={(event) => onMicrosoftLinkFlow?.(event.target.checked)}
					/>
					<span>Microsoft link requests (off by default). A request is stored and the accounts are not linked.</span>
				</label>
			</div>
			{due.length ? (
				<p className="ce-login-banner" role="status">
					{due.length} pending account{due.length === 1 ? "" : "s"} waiting more than 3 hours.
				</p>
			) : null}
			{note ? <p className="wiz-hint" role="status">{note}</p> : null}
			{tab !== "duplicates" && tab !== "allowlist" ? (
				<div className={`adm6-people ${picked ? "has-panel" : ""}`}>
					<table className="ce-table adm6-people-table">
						<thead>
							<tr>
								<th>Name</th>
								<th>Email</th>
								<th>Role</th>
								<th>Status</th>
								<th aria-label="Review" />
							</tr>
						</thead>
						<tbody>
							{visible.map((row) => {
								const key = row.userKey || row.email;
								return (
									<tr key={key} className={pickedKey === key ? "is-picked" : ""} onClick={() => { setPickedKey(key); setPickRole(ROLES.includes(row.role) ? row.role : "staff"); setDeclining(false); }} style={{ cursor: "pointer" }}>
										<td>{row.name || "—"}</td>
										<td>{row.email || row.userKey}</td>
										<td>{row.role || "staff"}</td>
										<td>{row.status || "pending"}{row.reason ? <span className="adm6-reason"> · {row.reason}</span> : null}</td>
										<td><button type="button" className="ce-btn-ghost ce-btn-sm">Review</button></td>
									</tr>
								);
							})}
							{visible.length === 0 ? <tr><td colSpan={5} className="ce-empty">Nobody here.</td></tr> : null}
						</tbody>
					</table>
					{picked ? (
						<aside className="adm6-side" aria-label="Selected person">
							<div className="adm6-side-head">
								<div>
									<strong>{picked.name || picked.email || picked.userKey}</strong>
									<div className="wiz-hint" style={{ margin: 0 }}>{picked.email || picked.userKey} · {picked.status || "pending"}</div>
								</div>
								<button type="button" className="ce-btn-ghost ce-btn-sm" aria-label="Close" onClick={() => setPickedKey("")}>×</button>
							</div>
							{departmentsOn ? (
								<label className="ce-login-field">
									<span className="ce-field-label">Department</span>
									<select
										className="ce-input"
										aria-label={`Department for ${picked.email || picked.userKey}`}
										value={DEPARTMENTS.includes(picked.accountDepartment) ? picked.accountDepartment : ""}
										disabled={busy === picked.userKey}
										onChange={(event) => {
											const value = event.target.value;
											run(picked.userKey, () => setAccountDepartment(picked.userKey, value).then((result) => {
												onAccountDepartment?.(picked.userKey, value);
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
							<span className="ce-field-label">Role</span>
							<div className="adm6-seg" role="radiogroup" aria-label="Role">
								{ROLES.map((role) => (
									<button key={role} type="button" role="radio" aria-checked={pickRole === role} className={pickRole === role ? "is-on" : ""} onClick={() => setPickRole(role)}>
										{ROLE_LABELS[role]}
									</button>
								))}
							</div>
							<button type="button" className="ce-btn-primary adm6-grant" disabled={busy === picked.userKey} onClick={() => run(picked.userKey, () => grantUserRole(picked.userKey, pickRole))}>
								Grant {ROLE_LABELS[pickRole]}
							</button>
							<div className="adm6-side-quiet">
								<button type="button" className="ce-btn-ghost ce-btn-sm" disabled={busy === picked.userKey} onClick={() => setDeclining((v) => !v)}>
									Decline
								</button>
								<button type="button" className="ce-btn-ghost ce-btn-sm" disabled={busy === picked.userKey} onClick={() => run(picked.userKey, () => disableUser(picked.userKey))}>
									Disable
								</button>
							</div>
							{declining ? (
								<div className="adm6-decline">
									<label className="ce-login-field">
										<span className="ce-field-label">Decline reason</span>
										<input className="ce-input" value={reason} onChange={(event) => setReason(event.target.value)} />
									</label>
									<button type="button" className="ce-btn-ghost ce-btn-sm" disabled={busy === picked.userKey} onClick={() => run(picked.userKey, () => declineUserWithReason(picked.userKey, reason || "Declined"))}>
										Confirm decline
									</button>
								</div>
							) : null}
						</aside>
					) : null}
				</div>
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
