import { useState } from "react";
import { applyProfileEdits, profileInitials, readDisplayPrefs } from "../lib/estimator/salesProfile";

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
	const name = String(user?.name || "User");
	const prefs = readDisplayPrefs(user);
	const initials = profileInitials(name);

	/** @param {"profile" | "settings" | "backup"} which */
	function start(which) {
		setDraft({
			name,
			position: user?.position || user?.designation || "",
			mobile: user?.mobile || "",
			location: user?.location || "",
			displayPrefs: prefs,
		});
		setModal(which);
		setOpen(false);
	}

	return (
		<div className={"ce-user-card" + (collapsed ? " is-collapsed" : "")}>
			<button type="button" className="ce-user-card-btn" aria-label="Account menu" onClick={() => setOpen((value) => !value)}>
				<span className="ce-user-avatar" aria-hidden="true">{initials}</span>
				{collapsed ? null : (
					<span className="ce-user-card-copy">
						<b>{name}</b>
						<small>{user?.department || "Department"} · {user?.position || user?.designation || "Position"}</small>
						<small>Role · {user?.level || user?.role || "staff"}</small>
					</span>
				)}
			</button>
			{open && !collapsed ? (
				<div className="ce-user-menu" role="menu">
					<p>{name}</p>
					<p>{user?.email || ""}</p>
					<button type="button" onClick={() => start("profile")}>My Profile</button>
					<button type="button" onClick={() => start("settings")}>Settings</button>
					<button type="button" onClick={() => onSave?.(applyProfileEdits(user, { displayPrefs: { ...prefs, notifications: prefs.notifications === "mute" ? "allow" : "mute" } }))}>
						Notifications ({prefs.notifications === "mute" ? "Mute" : "Allow"})
					</button>
					<button type="button" onClick={() => start("backup")}>My approvals & backup</button>
					<button type="button" onClick={() => { setOpen(false); onHelp?.(); }}>Help / Manual</button>
					{testMode ? (
						<label className="ce-user-test">
							TEST BUILD ONLY · Acting as
							<select aria-label="Acting as" value={actingUser} onChange={(event) => onActingUser?.(event.target.value)}>
								{users.map((row) => <option key={row.id || row.name} value={row.name}>{row.name}</option>)}
							</select>
						</label>
					) : null}
					<button type="button" className="ce-user-out" onClick={() => onSignOut?.()}>Log out</button>
				</div>
			) : null}
			{modal ? (
				<div className="ce-user-modal" role="dialog" aria-label={modal === "settings" ? "Settings" : modal === "backup" ? "Backup approver" : "My Profile"}>
					{modal === "profile" ? (
						<>
							<label>Full name<input className="ce-input" value={draft?.name || ""} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
							<label>Email<input className="ce-input" value={user?.email || ""} readOnly /></label>
							<label>Department<input className="ce-input" value={user?.department || ""} readOnly /> <small>set by Admin</small></label>
							<label>Position / title<input className="ce-input" value={draft?.position || ""} onChange={(event) => setDraft({ ...draft, position: event.target.value })} /></label>
							<label>Role<input className="ce-input" value={user?.level || user?.role || ""} readOnly /></label>
							<label>Mobile number<input className="ce-input" value={draft?.mobile || ""} onChange={(event) => setDraft({ ...draft, mobile: event.target.value })} /></label>
							<label>Location / site<input className="ce-input" value={draft?.location || ""} onChange={(event) => setDraft({ ...draft, location: event.target.value })} /></label>
						</>
					) : null}
					{modal === "settings" ? (
						<>
							<label>Theme<select className="ce-input" value={draft?.displayPrefs?.theme || "light"} onChange={(event) => setDraft({ ...draft, displayPrefs: { ...draft.displayPrefs, theme: event.target.value } })}><option value="light">Light</option><option value="dark">Dark</option></select></label>
							<label>Font size<select className="ce-input" value={draft?.displayPrefs?.fontSize || "normal"} onChange={(event) => setDraft({ ...draft, displayPrefs: { ...draft.displayPrefs, fontSize: event.target.value } })}><option value="normal">Normal</option><option value="large">Large</option></select></label>
							<label>Language<input className="ce-input" value="English" readOnly /></label>
						</>
					) : null}
					{modal === "backup" ? <p>Backup approver: {user?.backupApprover || user?.backupUserId || "Set by Admin"}</p> : null}
					<div className="ce-user-modal-actions">
						<button type="button" onClick={() => setModal("")}>Cancel</button>
						{modal === "backup" ? null : <button type="button" className="ce-btn-primary" onClick={() => { onSave?.(applyProfileEdits(user, draft || {})); setModal(""); }}>Save changes</button>}
					</div>
				</div>
			) : null}
		</div>
	);
}
