import { useEffect, useRef, useState } from "react";
import { Bell, Check, CircleHelp, LogOut, Settings, UserRound } from "lucide-react";
import { applyProfileEdits, profileInitials, readDisplayPrefs } from "../lib/estimator/salesProfile";

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanToken(value) {
	return String(value ?? "").replace(/role$/i, "").trim();
}

/**
 * @param {any} user
 * @returns {string}
 */
function roleLabel(user) {
	const raw = cleanToken(user?.role || user?.level || "staff") || "staff";
	return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/**
 * @param {any} user
 * @returns {string}
 */
function departmentLabel(user) {
	const source = String(user?.accountDepartment || user?.department || "").trim();
	if (!source || /role$/i.test(source)) return "";
	return source;
}

/**
 * @param {any} user
 * @returns {string}
 */
function positionLabel(user) {
	return cleanToken(user?.position || user?.designation || "");
}

/**
 * @param {any} user
 * @param {any[]} users
 * @returns {string}
 */
function backupName(user, users) {
	const raw = String(user?.backupApprover || user?.backupUserId || "").trim();
	if (!raw) return "Set by Admin";
	const hit = (users || []).find((row) => row && (row.id === raw || row.userId === raw || row.name === raw));
	return hit?.name || raw;
}

/**
 * @param {{
 *   user?: any,
 *   collapsed?: boolean,
 *   testMode?: boolean,
 *   users?: any[],
 *   actingUser?: string,
 *   onActingUser?: (name: string) => void,
 *   onSave?: (user: any) => void,
 *   onSignOut?: () => void,
 *   onHelp?: () => void,
 * }} props
 */
export function SalesUserCard({ user, collapsed = false, testMode = false, users = [], actingUser = "", onActingUser, onSave, onSignOut, onHelp }) {
	const [open, setOpen] = useState(false);
	const [modal, setModal] = useState(/** @type {"" | "profile" | "settings" | "backup"} */ (""));
	const [draft, setDraft] = useState(/** @type {any} */ (null));
	const rootRef = useRef(/** @type {HTMLDivElement | null} */ (null));
	const name = String(user?.name || "User");
	const prefs = readDisplayPrefs(user);
	const initials = profileInitials(name);
	const department = departmentLabel(user);
	const position = positionLabel(user);
	const role = roleLabel(user);
	const email = String(user?.email || "");

	useEffect(() => {
		if (!open) return undefined;
		/** @param {MouseEvent} event */
		const close = (event) => {
			if (!rootRef.current?.contains(/** @type {Node} */ (event.target))) setOpen(false);
		};
		document.addEventListener("mousedown", close);
		return () => document.removeEventListener("mousedown", close);
	}, [open]);

	/** @param {"profile" | "settings" | "backup"} which */
	function start(which) {
		setDraft({
			name,
			position: user?.position || user?.designation || "",
			mobile: user?.mobile || "",
			location: user?.location || "",
			signature: user?.signature || "",
			displayPrefs: prefs,
		});
		setModal(which);
		setOpen(false);
	}

	/**
	 * @param {string} notifications
	 */
	function setNotes(notifications) {
		onSave?.(applyProfileEdits(user, { displayPrefs: { ...prefs, notifications } }));
	}

	return (
		<div className={"ce-user-card" + (collapsed ? " is-collapsed" : "") + (open ? " is-open" : "")} ref={rootRef}>
			<button type="button" className="ce-user-card-btn" aria-label="Account menu" aria-expanded={open ? "true" : "false"} onClick={() => setOpen((value) => !value)}>
				<span className="ce-user-avatar" aria-hidden="true">{initials}</span>
				{collapsed ? null : (
					<span className="ce-user-card-copy">
						<b>{name}</b>
						<span className="ce-user-badges">
							{department ? <span className="ce-user-tag t-dep">{department}</span> : null}
							{position ? <span className="ce-user-tag t-pos">{position}</span> : null}
						</span>
						<small>Role · {role}</small>
					</span>
				)}
			</button>
			{open ? (
				<div className="ce-user-menu" role="menu">
					<div className="ce-user-menu-head">
						<span className="ce-user-avatar" aria-hidden="true">{initials}</span>
						<div>
							<b>{name}</b>
							<small>{email}</small>
							<span className="ce-user-badges">
								{department ? <span className="ce-user-tag t-dep">{department}</span> : null}
								{position ? <span className="ce-user-tag t-pos">{position}</span> : null}
								<span className="ce-user-tag t-role">{role}</span>
							</span>
						</div>
					</div>
					<button type="button" className="ce-user-mi" role="menuitem" onClick={() => start("profile")}>
						<span className="ce-user-ic" aria-hidden="true"><UserRound size={15} /></span>
						My Profile
						<span className="ce-user-ch">›</span>
					</button>
					<button type="button" className="ce-user-mi" role="menuitem" onClick={() => start("settings")}>
						<span className="ce-user-ic" aria-hidden="true"><Settings size={15} /></span>
						Settings
						<span className="ce-user-ch">›</span>
					</button>
					<div className="ce-user-mi">
						<span className="ce-user-ic" aria-hidden="true"><Bell size={15} /></span>
						Notifications
						<span className="ce-user-seg" role="group" aria-label="Notifications">
							<button type="button" className={prefs.notifications === "mute" ? "" : "on"} onClick={() => setNotes("allow")}>Allow</button>
							<button type="button" className={prefs.notifications === "mute" ? "on" : ""} onClick={() => setNotes("mute")}>Mute</button>
						</span>
					</div>
					<button type="button" className="ce-user-mi" role="menuitem" onClick={() => start("backup")}>
						<span className="ce-user-ic" aria-hidden="true"><Check size={15} /></span>
						<span>My approvals & backup<small>Backup: {backupName(user, users)}</small></span>
						<span className="ce-user-ch">›</span>
					</button>
					<button type="button" className="ce-user-mi" role="menuitem" onClick={() => { setOpen(false); onHelp?.(); }}>
						<span className="ce-user-ic" aria-hidden="true"><CircleHelp size={15} /></span>
						Help / Manual
						<span className="ce-user-ch">↗</span>
					</button>
					{testMode ? (
						<label className="ce-user-test">
							<b>TEST BUILD ONLY · ACTING AS</b>
							<select aria-label="Acting as" value={actingUser} onChange={(event) => onActingUser?.(event.target.value)}>
								{users.map((row) => <option key={row.id || row.name} value={row.name}>{row.name} · {roleLabel(row)}</option>)}
							</select>
						</label>
					) : null}
					<button type="button" className="ce-user-mi ce-user-out" role="menuitem" onClick={() => onSignOut?.()}>
						<span className="ce-user-ic" aria-hidden="true"><LogOut size={15} /></span>
						Log out
					</button>
				</div>
			) : null}
			{modal ? (
				<div className="ce-user-scrim" onClick={() => setModal("")}>
					<div className="ce-user-modal" role="dialog" aria-label={modal === "settings" ? "Settings" : modal === "backup" ? "Backup approver" : "My Profile"} onClick={(event) => event.stopPropagation()}>
						{modal === "profile" ? (
							<>
								<div className="ce-user-modal-head">
									<span className="ce-user-avatar lg" aria-hidden="true">{initials}</span>
									<div>
										<b>{draft?.name || name}</b>
										<small>{email}</small>
										<span className="ce-user-badges">
											{department ? <span className="ce-user-tag t-dep">{department}</span> : null}
											{position ? <span className="ce-user-tag t-pos">{position}</span> : null}
										</span>
									</div>
									<button type="button" className="ce-user-x" aria-label="Close" onClick={() => setModal("")}>×</button>
								</div>
								<label className="ce-user-row"><span className="l">Full name</span><span className="v"><input className="ce-input" value={draft?.name || ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></span></label>
								<div className="ce-user-row"><span className="l">Email account</span><span className="v ro">{email || "—"}<span className="ce-user-lock">set by Admin</span></span></div>
								<div className="ce-user-row"><span className="l">Department</span><span className="v ro">{department || "—"}<span className="ce-user-lock">set by Admin</span></span></div>
								<label className="ce-user-row"><span className="l">Position / title<small>Printed on signatories</small></span><span className="v"><input className="ce-input" value={draft?.position || ""} onChange={(event) => setDraft({ ...draft, position: event.target.value })} /></span></label>
								<div className="ce-user-row"><span className="l">Role</span><span className="v ro">{role}<span className="ce-user-lock">set by Admin</span></span></div>
								<label className="ce-user-row"><span className="l">Mobile number</span><span className="v"><input className="ce-input" value={draft?.mobile || ""} onChange={(event) => setDraft({ ...draft, mobile: event.target.value })} /></span></label>
								<label className="ce-user-row"><span className="l">Location / site</span><span className="v"><input className="ce-input" value={draft?.location || ""} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></span></label>
								<div className="ce-user-row"><span className="l">E-signature<small>PNG, transparent</small></span><span className="v ce-user-sig">{draft?.signature ? <img alt="E-signature" src={draft.signature} /> : <span className="ce-user-sigbox" />}<label className="ce-btn-ghost ce-btn-sm">Replace<input type="file" accept="image/png" hidden onChange={(event) => {
									const file = event.target.files?.[0];
									if (!file) return;
									const reader = new FileReader();
									reader.onload = () => setDraft({ ...draft, signature: String(reader.result || "") });
									reader.readAsDataURL(file);
								}} /></label></span></div>
								<div className="ce-user-row"><span className="l">Backup approver</span><span className="v ro">{backupName(user, users)}<span className="ce-user-lock">set by Admin</span></span></div>
							</>
						) : null}
						{modal === "settings" ? (
							<>
								<div className="ce-user-modal-head"><b>Settings</b><button type="button" className="ce-user-x" aria-label="Close" onClick={() => setModal("")}>×</button></div>
								<label className="ce-user-row"><span className="l">Theme</span><span className="v"><select className="ce-input" value={draft?.displayPrefs?.theme || "light"} onChange={(event) => setDraft({ ...draft, displayPrefs: { ...draft.displayPrefs, theme: event.target.value } })}><option value="light">Light</option><option value="dark">Dark</option></select></span></label>
								<label className="ce-user-row"><span className="l">Font size</span><span className="v"><select className="ce-input" value={draft?.displayPrefs?.fontSize || "normal"} onChange={(event) => setDraft({ ...draft, displayPrefs: { ...draft.displayPrefs, fontSize: event.target.value } })}><option value="normal">Normal</option><option value="large">Large</option></select></span></label>
								<div className="ce-user-row"><span className="l">Language</span><span className="v ro">English</span></div>
							</>
						) : null}
						{modal === "backup" ? (
							<>
								<div className="ce-user-modal-head"><b>My approvals & backup</b><button type="button" className="ce-user-x" aria-label="Close" onClick={() => setModal("")}>×</button></div>
								<div className="ce-user-row"><span className="l">Backup approver</span><span className="v ro">{backupName(user, users)}<span className="ce-user-lock">set by Admin</span></span></div>
							</>
						) : null}
						<div className="ce-user-modal-actions">
							<span>{modal === "profile" ? "Locked fields are managed by Admin." : ""}</span>
							<span>
								<button type="button" onClick={() => setModal("")}>Cancel</button>
								{modal === "backup" ? null : <button type="button" className="ce-btn-primary" onClick={() => { onSave?.(applyProfileEdits(user, draft || {})); setModal(""); }}>Save changes</button>}
							</span>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
}
