// @ts-nocheck
import React, { useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Check,
  X,
} from 'lucide-react';

export const USER_LEVELS = [
  {
    id: 'staff',
    label: 'Staff',
    blurb: 'Own dashboard, CE editor, inspection filing, EL calculator.',
  },
  {
    id: 'lead',
    label: 'Lead',
    blurb: 'Staff plus monitoring (active / RCE) and scope library.',
  },
  {
    id: 'head',
    label: 'Head',
    blurb: 'Department view including executive monitoring.',
  },
  {
    id: 'admin',
    label: 'Administrator',
    blurb: 'Full access including this Admin console.',
  },
];

export const DOC_TYPES = [
  { id: 'ce', label: 'Cost Estimate' },
  { id: 'rce', label: 'RCE Request' },
  { id: 'oif', label: 'Onsite Inspection Form' },
];

export const ACCESS_MATRIX = [
  { area: 'Dashboard / User Monitoring', staff: true, lead: true, head: true, admin: true },
  { area: 'Create CE & Inspection', staff: true, lead: true, head: true, admin: true },
  { area: 'CE / RCE editor', staff: true, lead: true, head: true, admin: true },
  { area: 'Monitoring — Active & RCE', staff: false, lead: true, head: true, admin: true },
  { area: 'Monitoring — Archive', staff: false, lead: true, head: true, admin: true },
  { area: 'Monitoring — Executive', staff: false, lead: false, head: true, admin: true },
  { area: 'Scope Library', staff: false, lead: true, head: true, admin: true },
  { area: 'Database / masterlist', staff: false, lead: true, head: true, admin: true },
  { area: 'EL Calculator', staff: true, lead: true, head: true, admin: true },
  { area: 'Approve documents', staff: false, lead: true, head: true, admin: true },
  { area: 'Admin console', staff: false, lead: false, head: false, admin: true },
];

export function defaultAdminConfig() {
  return {
    users: [
      {
        id: 'u-admin',
        name: 'Administrator',
        email: 'admin@costing.local',
        designation: 'Department Head',
        department: 'Costing',
        level: 'admin',
        status: 'active',
      },
      {
        id: 'u-est-a',
        name: 'Estimator A',
        email: 'estimator.a@costing.local',
        designation: 'Cost Estimator',
        department: 'Costing',
        level: 'lead',
        status: 'active',
      },
      {
        id: 'u-est-b',
        name: 'Estimator B',
        email: 'estimator.b@costing.local',
        designation: 'Cost Estimator',
        department: 'Costing',
        level: 'staff',
        status: 'active',
      },
    ],
    pending: [
      {
        id: 'pend-1',
        name: 'Maria Santos',
        email: 'm.santos@sales.local',
        requestedAt: '2026-09-14',
        designation: 'Sales Representative',
        level: 'staff',
        department: 'Sales',
      },
      {
        id: 'pend-2',
        name: 'Jon Reyes',
        email: 'j.reyes@costing.local',
        requestedAt: '2026-09-15',
        designation: 'Cost Estimator',
        level: 'staff',
        department: 'Costing',
      },
    ],
    designations: [
      'Cost Estimator',
      'Sales Representative',
      'Sales Manager',
      'Document Controller',
      'Department Head',
    ],
    approvalFlows: {
      ce: [
        { id: 'ce-1', title: 'Prepared by Estimator', role: 'staff' },
        { id: 'ce-2', title: 'Reviewed by Lead', role: 'lead' },
        { id: 'ce-3', title: 'Approved by Head', role: 'head' },
      ],
      rce: [
        { id: 'rce-1', title: 'Prepared by Sales', role: 'staff' },
        { id: 'rce-2', title: 'Reviewed by Sales Manager', role: 'lead' },
        { id: 'rce-3', title: 'Accepted by Costing', role: 'head' },
      ],
      oif: [
        { id: 'oif-1', title: 'Prepared by Inspector', role: 'staff' },
        { id: 'oif-2', title: 'Noted by Lead', role: 'lead' },
      ],
    },
    documentControl: {
      companyName: 'Costing Department',
      logoDataUrl: '',
      company1Name: 'Company 1',
      company1Logo: '',
      company2Name: 'Company 2',
      company2Logo: '',
      headerLeft: '{company}',
      headerRight: 'Rev {rev}  |  {date}  |  {docNo}',
      footerLeft: 'Controlled document',
      footerCenter: 'Page {page}',
      footerRight: '{company}',
      revision: '1.0',
      showLogo: true,
    },
  };
}

export function normalizeAdminConfig(raw) {
  const base = defaultAdminConfig();
  const src = raw && typeof raw === 'object' ? raw : {};
  const flows = src.approvalFlows && typeof src.approvalFlows === 'object'
    ? src.approvalFlows
    : {};
  return {
    users:
      Array.isArray(src.users) && src.users.length ? src.users : base.users,
    pending: Array.isArray(src.pending) ? src.pending : base.pending,
    designations:
      Array.isArray(src.designations) && src.designations.length
        ? src.designations
        : base.designations,
    approvalFlows: {
      ce: Array.isArray(flows.ce) ? flows.ce : base.approvalFlows.ce,
      rce: Array.isArray(flows.rce) ? flows.rce : base.approvalFlows.rce,
      oif: Array.isArray(flows.oif) ? flows.oif : base.approvalFlows.oif,
    },
    documentControl: {
      ...base.documentControl,
      ...(src.documentControl && typeof src.documentControl === 'object'
        ? src.documentControl
        : {}),
    },
  };
}

export function interpolateDocTokens(template, vars) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`;
}

export function AdminHub({ config, onChange }) {
  const [tab, setTab] = useState('users');
  const cfg = normalizeAdminConfig(config);

  function patch(partial) {
    onChange(normalizeAdminConfig({ ...cfg, ...partial }));
  }

  return (
    <div className="admin-wrap" data-admin-hub="true">
      <div className="dash-header">
        <div>
          <h2 className="ce-serif">Admin</h2>
          <p className="wiz-sub">
            Registration, roles, approval routes, and export letterhead.
            Login will lock this to Administrators — settings save now.
          </p>
        </div>
      </div>
      <div className="wiz-rce-mode" role="tablist" aria-label="Admin sections">
        {[
          ['users', 'User access'],
          ['flow', 'Approval flow'],
          ['docs', 'Document control'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`ce-pill ${tab === k ? 'ce-pill-active' : ''}`}
            onClick={() => setTab(k)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UserAccessPanel cfg={cfg} patch={patch} />}
      {tab === 'flow' && <ApprovalFlowPanel cfg={cfg} patch={patch} />}
      {tab === 'docs' && <DocumentControlPanel cfg={cfg} patch={patch} />}
    </div>
  );
}

function UserAccessPanel({ cfg, patch }) {
  const [draft, setDraft] = useState({
    name: '',
    email: '',
    designation: cfg.designations[0] || 'Cost Estimator',
    department: 'Costing',
    level: 'staff',
  });
  const [pendingDraft, setPendingDraft] = useState({
    name: '',
    email: '',
  });
  const [newTitle, setNewTitle] = useState('');

  function acceptPending(row) {
    const user = {
      id: uid('u'),
      name: row.name,
      email: row.email,
      designation: row.designation || cfg.designations[0] || 'Cost Estimator',
      department: row.department || 'Costing',
      level: row.level || 'staff',
      status: 'active',
    };
    patch({
      users: [...cfg.users, user],
      pending: cfg.pending.filter((p) => p.id !== row.id),
    });
  }

  function updatePending(id, partial) {
    patch({
      pending: cfg.pending.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    });
  }

  function updateUser(id, partial) {
    patch({
      users: cfg.users.map((x) => (x.id === id ? { ...x, ...partial } : x)),
    });
  }

  const adminCount = cfg.users.filter((u) => u.level === 'admin').length;

  return (
    <div>
      <div className="ce-card wiz-card">
        <h3 className="ce-serif">Pending registrations</h3>
        <p className="wiz-hint">
          Accept a request, then set designation (job title) and user level
          (what they can open). When login is live, sign-ups land here
          automatically.
        </p>
        <div className="wiz-grid">
          <label className="wiz-field">
            <span className="ce-field-label">Name</span>
            <input
              className="ce-input"
              value={pendingDraft.name}
              onChange={(e) =>
                setPendingDraft({ ...pendingDraft, name: e.target.value })
              }
            />
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">Email</span>
            <input
              className="ce-input"
              value={pendingDraft.email}
              onChange={(e) =>
                setPendingDraft({ ...pendingDraft, email: e.target.value })
              }
            />
          </label>
        </div>
        <button
          type="button"
          className="ce-btn-ghost ce-btn-sm"
          style={{ marginTop: '0.6rem' }}
          onClick={() => {
            if (!pendingDraft.name.trim()) return;
            patch({
              pending: [
                ...cfg.pending,
                {
                  id: uid('pend'),
                  name: pendingDraft.name.trim(),
                  email: pendingDraft.email.trim(),
                  requestedAt: new Date().toISOString().slice(0, 10),
                  designation: cfg.designations[0] || 'Cost Estimator',
                  level: 'staff',
                  department: 'Costing',
                },
              ],
            });
            setPendingDraft({ name: '', email: '' });
          }}
        >
          <Plus size={13} /> Queue registration
        </button>
        <div className="ce-gridwrap" style={{ marginTop: '0.8rem' }}>
          <table className="ce-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Level</th>
                <th>Requested</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cfg.pending.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>{row.name}</div>
                    <div className="wiz-hint" style={{ margin: 0 }}>
                      {row.email || '—'}
                    </div>
                  </td>
                  <td>
                    <select
                      className="ce-input"
                      value={row.designation || cfg.designations[0]}
                      onChange={(e) =>
                        updatePending(row.id, { designation: e.target.value })
                      }
                    >
                      {cfg.designations.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="ce-input"
                      value={row.level || 'staff'}
                      onChange={(e) =>
                        updatePending(row.id, { level: e.target.value })
                      }
                    >
                      {USER_LEVELS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{row.requestedAt || '—'}</td>
                  <td>
                    <button
                      type="button"
                      className="ce-btn-primary ce-btn-sm"
                      onClick={() => acceptPending(row)}
                    >
                      <Check size={13} /> Accept
                    </button>{' '}
                    <button
                      type="button"
                      className="ce-btn-ghost ce-btn-sm"
                      onClick={() =>
                        patch({
                          pending: cfg.pending.filter((p) => p.id !== row.id),
                        })
                      }
                    >
                      <X size={13} /> Reject
                    </button>
                  </td>
                </tr>
              ))}
              {cfg.pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="ce-empty">
                    No pending registrations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ce-card wiz-card" style={{ marginTop: '1rem' }}>
        <h3 className="ce-serif">User directory</h3>
        <p className="wiz-hint">
          Designation is their position on paper. User level is the permission
          set below. Keep at least one Administrator.
        </p>
        <div className="wiz-grid">
          <label className="wiz-field">
            <span className="ce-field-label">Name</span>
            <input
              className="ce-input"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">Email</span>
            <input
              className="ce-input"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">Designation</span>
            <select
              className="ce-input"
              value={draft.designation}
              onChange={(e) =>
                setDraft({ ...draft, designation: e.target.value })
              }
            >
              {cfg.designations.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">User level</span>
            <select
              className="ce-input"
              value={draft.level}
              onChange={(e) => setDraft({ ...draft, level: e.target.value })}
            >
              {USER_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          className="ce-btn-primary ce-btn-sm"
          style={{ marginTop: '0.6rem' }}
          onClick={() => {
            if (!draft.name.trim()) return;
            patch({
              users: [
                ...cfg.users,
                { id: uid('u'), status: 'active', ...draft },
              ],
            });
            setDraft({ ...draft, name: '', email: '' });
          }}
        >
          <Plus size={13} /> Add user
        </button>

        <div className="ce-gridwrap" style={{ marginTop: '0.8rem' }}>
          <table className="ce-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Designation</th>
                <th>Level</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cfg.users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div>{u.name}</div>
                    <div className="wiz-hint" style={{ margin: 0 }}>
                      {u.email}
                    </div>
                  </td>
                  <td>
                    <select
                      className="ce-input"
                      value={u.designation}
                      onChange={(e) =>
                        updateUser(u.id, { designation: e.target.value })
                      }
                    >
                      {cfg.designations.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="ce-input"
                      value={u.level}
                      onChange={(e) => {
                        if (
                          u.level === 'admin' &&
                          e.target.value !== 'admin' &&
                          adminCount <= 1
                        ) {
                          return;
                        }
                        updateUser(u.id, { level: e.target.value });
                      }}
                    >
                      {USER_LEVELS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ce-btn-ghost ce-btn-sm"
                      onClick={() =>
                        updateUser(u.id, {
                          status: u.status === 'active' ? 'suspended' : 'active',
                        })
                      }
                    >
                      {u.status === 'active' ? 'Active' : 'Suspended'}
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ce-btn-ghost ce-btn-sm"
                      title={
                        u.level === 'admin' && adminCount <= 1
                          ? 'Keep at least one administrator'
                          : 'Remove user'
                      }
                      disabled={u.level === 'admin' && adminCount <= 1}
                      onClick={() => {
                        if (u.level === 'admin' && adminCount <= 1) return;
                        patch({
                          users: cfg.users.filter((x) => x.id !== u.id),
                        });
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="ce-serif admin-subhead">Designations</h4>
        <p className="wiz-hint">
          Job titles only — they do not grant access. Add the positions your
          org uses.
        </p>
        <div className="admin-desig-row">
          <input
            className="ce-input"
            placeholder="New designation"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button
            type="button"
            className="ce-btn-ghost ce-btn-sm"
            onClick={() => {
              const title = newTitle.trim();
              if (!title || cfg.designations.includes(title)) return;
              patch({ designations: [...cfg.designations, title] });
              setNewTitle('');
            }}
          >
            <Plus size={13} /> Add
          </button>
        </div>
        <div className="admin-desig-list">
          {cfg.designations.map((d) => (
            <span key={d} className="admin-chip">
              {d}
              <button
                type="button"
                className="admin-chip-x"
                aria-label={`Remove ${d}`}
                onClick={() =>
                  patch({
                    designations: cfg.designations.filter((x) => x !== d),
                  })
                }
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="ce-card wiz-card" style={{ marginTop: '1rem' }}>
        <h3 className="ce-serif">User levels</h3>
        <p className="wiz-hint">
          Intended access after login. Admin stays open for setup until then.
        </p>
        <div className="admin-levels">
          {USER_LEVELS.map((l) => (
            <div key={l.id} className="admin-level-card">
              <strong>{l.label}</strong>
              <span>{l.blurb}</span>
            </div>
          ))}
        </div>
        <div className="ce-gridwrap" style={{ marginTop: '0.9rem' }}>
          <table className="ce-table admin-matrix">
            <thead>
              <tr>
                <th>Area</th>
                {USER_LEVELS.map((l) => (
                  <th key={l.id}>{l.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS_MATRIX.map((row) => (
                <tr key={row.area}>
                  <td>{row.area}</td>
                  {USER_LEVELS.map((l) => (
                    <td key={l.id}>
                      <span className={row[l.id] ? 'admin-yes' : 'admin-no'}>
                        {row[l.id] ? 'Yes' : '—'}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ApprovalFlowPanel({ cfg, patch }) {
  const [docType, setDocType] = useState('ce');
  const steps = cfg.approvalFlows?.[docType] || [];
  const current = DOC_TYPES.find((d) => d.id === docType);

  function setSteps(next) {
    patch({
      approvalFlows: { ...cfg.approvalFlows, [docType]: next },
    });
  }

  function move(index, dir) {
    const next = [...steps];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    const tmp = next[index];
    next[index] = next[j];
    next[j] = tmp;
    setSteps(next);
  }

  return (
    <div className="ce-card wiz-card">
      <h3 className="ce-serif">Approval flow</h3>
      <p className="wiz-hint">
        Ordered route for each document. Add, remove, or swap steps — the
        document follows this list, not hardcoded 1st / 2nd / 3rd titles.
        Login will walk this list on submit.
      </p>
      <div className="wiz-rce-mode">
        {DOC_TYPES.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`ce-pill ${docType === d.id ? 'ce-pill-active' : ''}`}
            onClick={() => setDocType(d.id)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <ol className="admin-flow-list">
        {steps.map((step, i) => (
          <li key={step.id}>
            <span className="admin-flow-num">{i + 1}</span>
            <input
              className="ce-input"
              value={step.title}
              onChange={(e) =>
                setSteps(
                  steps.map((s) =>
                    s.id === step.id ? { ...s, title: e.target.value } : s
                  )
                )
              }
            />
            <select
              className="ce-input"
              value={step.role}
              onChange={(e) =>
                setSteps(
                  steps.map((s) =>
                    s.id === step.id ? { ...s, role: e.target.value } : s
                  )
                )
              }
            >
              {USER_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => move(i, -1)}
              aria-label="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => move(i, 1)}
              aria-label="Move down"
            >
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => setSteps(steps.filter((s) => s.id !== step.id))}
              aria-label="Remove step"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ol>
      {steps.length === 0 && (
        <p className="ce-empty">No steps. Add at least one approver.</p>
      )}
      <button
        type="button"
        className="ce-btn-ghost ce-btn-sm"
        onClick={() =>
          setSteps([
            ...steps,
            {
              id: uid('step'),
              title: `Approver ${steps.length + 1}`,
              role: 'lead',
            },
          ])
        }
      >
        <Plus size={13} /> Add step
      </button>
      <p className="wiz-hint" style={{ marginTop: '0.9rem' }}>
        {current?.label} currently:{' '}
        {steps.map((s) => s.title).join(' → ') || 'no route'}
      </p>
    </div>
  );
}

function CompanyLogoSlot({ label, src, onFile, onClear }) {
  const ref = useRef(null);
  return (
    <div className="admin-logo-slot">
      <span className="ce-field-label">{label}</span>
      {src ? (
        <img src={src} alt={label} className="admin-logo-slot-img" />
      ) : (
        <span className="wiz-hint">No logo yet</span>
      )}
      <button
        type="button"
        className="ce-btn-ghost ce-btn-sm"
        onClick={() => ref.current?.click()}
      >
        Upload
      </button>
      {src && (
        <button type="button" className="ce-btn-ghost ce-btn-sm" onClick={onClear}>
          Remove
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => onFile(String(reader.result || ''));
          reader.readAsDataURL(file);
        }}
      />
    </div>
  );
}

function DocumentControlPanel({ cfg, patch }) {
  const dc = cfg.documentControl;
  const fileRef = useRef(null);
  const sample = {
    company: dc.companyName || '',
    rev: dc.revision || '1.0',
    date: new Date().toISOString().slice(0, 10),
    docNo: 'CE-2026-004',
    page: '1',
  };

  function setDc(partial) {
    patch({ documentControl: { ...dc, ...partial } });
  }

  function onLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDc({ logoDataUrl: String(reader.result || '') });
    reader.readAsDataURL(file);
  }

  return (
    <div className="ce-card wiz-card">
      <h3 className="ce-serif">Document control</h3>
      <p className="wiz-hint">
        Letterhead used on PDF and Excel export. Tokens: {'{company}'}, {'{rev}'},{' '}
        {'{date}'}, {'{docNo}'}, {'{page}'}.
      </p>
      <div className="wiz-grid">
        <label className="wiz-field">
          <span className="ce-field-label">Company name</span>
          <input
            className="ce-input"
            value={dc.companyName}
            onChange={(e) => setDc({ companyName: e.target.value })}
          />
        </label>
        <label className="wiz-field">
          <span className="ce-field-label">Default revision</span>
          <input
            className="ce-input"
            value={dc.revision}
            onChange={(e) => setDc({ revision: e.target.value })}
          />
        </label>
        <label className="wiz-field wiz-span">
          <span className="ce-field-label">Header left</span>
          <input
            className="ce-input"
            value={dc.headerLeft}
            onChange={(e) => setDc({ headerLeft: e.target.value })}
          />
        </label>
        <label className="wiz-field wiz-span">
          <span className="ce-field-label">Header right</span>
          <input
            className="ce-input"
            value={dc.headerRight}
            onChange={(e) => setDc({ headerRight: e.target.value })}
          />
        </label>
        <label className="wiz-field">
          <span className="ce-field-label">Footer left</span>
          <input
            className="ce-input"
            value={dc.footerLeft}
            onChange={(e) => setDc({ footerLeft: e.target.value })}
          />
        </label>
        <label className="wiz-field">
          <span className="ce-field-label">Footer center</span>
          <input
            className="ce-input"
            value={dc.footerCenter}
            onChange={(e) => setDc({ footerCenter: e.target.value })}
          />
        </label>
        <label className="wiz-field wiz-span">
          <span className="ce-field-label">Footer right</span>
          <input
            className="ce-input"
            value={dc.footerRight}
            onChange={(e) => setDc({ footerRight: e.target.value })}
          />
        </label>
      </div>
      <div className="wiz-rce-mode">
        <button
          type="button"
          className="ce-btn-ghost ce-btn-sm"
          onClick={() => fileRef.current?.click()}
        >
          Upload logo
        </button>
        {dc.logoDataUrl && (
          <button
            type="button"
            className="ce-btn-ghost ce-btn-sm"
            onClick={() => setDc({ logoDataUrl: '' })}
          >
            Remove logo
          </button>
        )}
        <label className="admin-check">
          <input
            type="checkbox"
            checked={!!dc.showLogo}
            onChange={(e) => setDc({ showLogo: e.target.checked })}
          />
          Show logo
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={onLogo}
        />
      </div>
      <div className="wiz-grid" style={{ marginTop: '0.85rem' }}>
        <label className="wiz-field">
          <span className="ce-field-label">Company 1 name (RCE)</span>
          <input
            className="ce-input"
            value={dc.company1Name || 'Company 1'}
            onChange={(e) => setDc({ company1Name: e.target.value })}
          />
        </label>
        <label className="wiz-field">
          <span className="ce-field-label">Company 2 name (RCE)</span>
          <input
            className="ce-input"
            value={dc.company2Name || 'Company 2'}
            onChange={(e) => setDc({ company2Name: e.target.value })}
          />
        </label>
      </div>
      <div className="wiz-rce-mode" style={{ marginTop: '0.5rem' }}>
        <CompanyLogoSlot
          label="Company 1 logo"
          src={dc.company1Logo}
          onFile={(dataUrl) => setDc({ company1Logo: dataUrl })}
          onClear={() => setDc({ company1Logo: '' })}
        />
        <CompanyLogoSlot
          label="Company 2 logo"
          src={dc.company2Logo}
          onFile={(dataUrl) => setDc({ company2Logo: dataUrl })}
          onClear={() => setDc({ company2Logo: '' })}
        />
      </div>
      <div className="admin-doc-preview">
        <div className="admin-doc-preview-head">
          <span>
            {dc.showLogo && dc.logoDataUrl ? (
              <img src={dc.logoDataUrl} alt="logo" />
            ) : (
              interpolateDocTokens(dc.headerLeft, sample)
            )}
          </span>
          <span>{interpolateDocTokens(dc.headerRight, sample)}</span>
        </div>
        <div className="admin-doc-preview-body">Export preview</div>
        <div className="admin-doc-preview-foot">
          <span>{interpolateDocTokens(dc.footerLeft, sample)}</span>
          <span>{interpolateDocTokens(dc.footerCenter, sample)}</span>
          <span>{interpolateDocTokens(dc.footerRight, sample)}</span>
        </div>
      </div>
    </div>
  );
}
