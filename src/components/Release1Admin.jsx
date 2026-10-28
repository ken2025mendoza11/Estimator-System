// @ts-nocheck
import { APPROVER_KINDS, DEPARTMENTS, accountId, normalizeApproverLists } from "../lib/estimator/departments";
import { saveApproverLists, setAccountDepartment } from "../lib/supabase/account-role";

const KIND_LABEL = {
	markup: "Markup",
	proposal: "Proposal",
	jobOrder: "Job order",
};

function personLabel(user) {
	const name = String(user?.name || "").trim() || "Unnamed";
	return `${name} · ${accountId(user)}`;
}

export function Release1Admin({ cfg, patch }) {
	const features = cfg.features || {};
	const on = features.release1Departments === true;
	const users = (Array.isArray(cfg.users) ? cfg.users : []).filter((user) => accountId(user));
	const lists = normalizeApproverLists(cfg.approverLists);

	function setFlag(checked) {
		patch({ features: { ...features, release1Departments: checked === true } });
	}

	function setDept(user, value) {
		const id = accountId(user);
		patch({
			users: (cfg.users || []).map((row) => (accountId(row) === id ? { ...row, accountDepartment: value } : row)),
		});
		if (id) void setAccountDepartment(id, value);
	}

	function setLists(next) {
		const clean = normalizeApproverLists(next);
		patch({ approverLists: clean });
		void saveApproverLists(clean);
	}

	function setPair(kind, index, partial) {
		const rows = lists[kind].map((row, i) => (i === index ? { ...row, ...partial } : row));
		setLists({ ...lists, [kind]: rows });
	}

	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Release 1 departments</h3>
			<p className="wiz-hint">
				Off keeps the old department and job-title text. On uses the fixed department set here. An account with no department still uses that old text.
			</p>
			<label className="ce-picker-row">
				<input type="checkbox" checked={on} onChange={(event) => setFlag(event.target.checked)} />
				<span>Fixed departments and approver backups</span>
			</label>
			<label className="ce-picker-row">
				<input
					type="checkbox"
					checked={features.release1SalesView === true}
					onChange={(event) => patch({ features: { ...features, release1SalesView: event.target.checked === true } })}
				/>
				<span>Sales view of an approved estimate</span>
			</label>
			<p className="wiz-hint">Hides contingency, discount, Awarded, Lost, and the JO number. Sales can open an approved estimate, download PDF or Excel, and cannot revise it. The stored percents still apply to the net.</p>
			<label className="ce-picker-row">
				<input
					type="checkbox"
					checked={features.release1WithdrawRequest === true}
					onChange={(event) => patch({ features: { ...features, release1WithdrawRequest: event.target.checked === true } })}
				/>
				<span>Withdraw until final approval, and Sales CE requests</span>
			</label>
			<p className="wiz-hint">Withdraw stays available after submit until the final approver approves. Sales can request a revision or a new estimate. They still cannot edit it.</p>
			{on ? (
				<div>
					<h4 className="ce-serif admin-subhead">Department</h4>
					<p className="wiz-hint">Sales, Cost Estimating, Management, or Admin. Stored by account id. The free-text profile department is left as it is.</p>
					{users.length === 0 ? <p className="wiz-hint">No accounts with an id yet.</p> : null}
					<div className="ce-gridwrap">
						<table className="ce-table">
							<thead>
								<tr>
									<th>Account</th>
									<th>Department</th>
								</tr>
							</thead>
							<tbody>
								{users.map((user) => (
									<tr key={accountId(user)}>
										<td>{personLabel(user)}</td>
										<td>
											<select
												className="ce-input"
												aria-label={`Department for ${user.name || accountId(user)}`}
												value={DEPARTMENTS.includes(user.accountDepartment) ? user.accountDepartment : ""}
												onChange={(event) => setDept(user, event.target.value)}
											>
												<option value="">Not set</option>
												{DEPARTMENTS.map((department) => (
													<option key={department} value={department}>{department}</option>
												))}
											</select>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{APPROVER_KINDS.map((kind) => (
						<section key={kind}>
							<h4 className="ce-serif admin-subhead">{KIND_LABEL[kind]} approvers</h4>
							<p className="wiz-hint">Each approver has a backup. A backup signs as “for” that person. Names are not saved.</p>
							{lists[kind].map((row, index) => (
								<div key={`${kind}-${row.userId}`} className="wiz-grid">
									<label className="wiz-field">
										<span className="ce-field-label">Approver</span>
										<select className="ce-input" value={row.userId} onChange={(event) => setPair(kind, index, { userId: event.target.value })}>
											{users.map((user) => (
												<option key={accountId(user)} value={accountId(user)}>{personLabel(user)}</option>
											))}
										</select>
									</label>
									<label className="wiz-field">
										<span className="ce-field-label">Backup</span>
										<select className="ce-input" value={row.backupUserId} onChange={(event) => setPair(kind, index, { backupUserId: event.target.value })}>
											<option value="">None</option>
											{users.filter((user) => accountId(user) !== row.userId).map((user) => (
												<option key={accountId(user)} value={accountId(user)}>{personLabel(user)}</option>
											))}
										</select>
									</label>
									<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => setLists({ ...lists, [kind]: lists[kind].filter((_, i) => i !== index) })}>
										Remove
									</button>
								</div>
							))}
							<button
								type="button"
								className="ce-btn-ghost ce-btn-sm"
								onClick={() => {
									const first = users.find((user) => !lists[kind].some((row) => row.userId === accountId(user)));
									if (!first) return;
									const backup = users.find((user) => accountId(user) !== accountId(first));
									setLists({
										...lists,
										[kind]: [...lists[kind], { userId: accountId(first), backupUserId: backup ? accountId(backup) : "" }],
									});
								}}
							>
								Add approver
							</button>
						</section>
					))}
				</div>
			) : null}
		</div>
	);
}
