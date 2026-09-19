// @ts-nocheck
import React, { useMemo, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  FileText,
  ClipboardList,
  Activity,
  Filter,
  Calculator,
  Wrench,
  Package,
  Search,
} from 'lucide-react';

export const STANDARD_TEMPLATES = [
  {
    id: 'onsite',
    title: 'Onsite',
    description: 'Site-based cost estimate structure (current working template).',
    enabled: true,
  },
  {
    id: 'shopwork',
    title: 'Shopwork',
    description: 'Workshop / fabrication oriented breakdown.',
    enabled: true,
  },
  {
    id: 'trading',
    title: 'Trading',
    description: 'Trading / supply-only cost model.',
    enabled: true,
  },
  {
    id: 'hybrid',
    title: 'Hybrid',
    description: 'Combination of onsite, shopwork, and trading — coming later.',
    enabled: false,
  },
];

export const PREBUILT_TEMPLATES = [
  {
    id: 'pre-onsite',
    title: 'Standard Onsite (with resources)',
    description: 'Onsite structure preloaded with typical labor, tools, and PPE.',
    standardId: 'onsite',
  },
  {
    id: 'pre-shop',
    title: 'Shop (with resources)',
    description: 'Shopwork structure with common fabrication resources.',
    standardId: 'shopwork',
  },
  {
    id: 'pre-trading',
    title: 'Trading (with resources)',
    description: 'Trading structure with typical supply items.',
    standardId: 'trading',
  },
];

function rceLabel(rce) {
  return rce?.id || rce?.rceNo || '';
}

function rceProject(rce) {
  return rce?.projectTitle || rce?.project || rce?.description || '';
}

function rceClient(rce) {
  return rce?.client || rce?.customer || '';
}

export function NewCostEstimateWizard({
  rceList = [],
  ceList = [],
  initialRce = null,
  currentUserName,
  onCancel,
  onCreate,
}) {
  const [step, setStep] = useState(initialRce ? 2 : 1);
  const [rceMode, setRceMode] = useState(initialRce ? 'existing' : 'existing');
  const [form, setForm] = useState(() => {
    const rce = initialRce;
    return {
      rceId: rceLabel(rce),
      client: rceClient(rce),
      project: rceProject(rce),
      location: rce?.location || rce?.address || '',
      description: rce?.otherRemarks || rce?.description || '',
    };
  });
  const [templateKind, setTemplateKind] = useState('standard');
  const [standardId, setStandardId] = useState('onsite');
  const [prebuiltId, setPrebuiltId] = useState('pre-onsite');
  const [previousCeId, setPreviousCeId] = useState('');

  const selectedRce = (rceList || []).find(
    (r) => rceLabel(r) === form.rceId
  );

  function applyRce(rce) {
    setForm((prev) => ({
      ...prev,
      rceId: rceLabel(rce),
      client: rceClient(rce),
      project: rceProject(rce),
      location: rce?.location || rce?.address || prev.location,
      description: rce?.otherRemarks || rce?.description || prev.description,
    }));
  }

  function handleCreate() {
    const tpl =
      templateKind === 'prebuilt'
        ? PREBUILT_TEMPLATES.find((t) => t.id === prebuiltId)
        : STANDARD_TEMPLATES.find((t) => t.id === standardId);
    const templateType =
      templateKind === 'previous'
        ? 'onsite'
        : tpl?.standardId || tpl?.id || 'onsite';
    if (templateType === 'hybrid') return;
    onCreate({
      rceId: form.rceId.trim(),
      client: form.client.trim(),
      project: form.project.trim() || 'New Cost Estimate',
      location: form.location.trim(),
      description: form.description.trim(),
      templateKind,
      templateType,
      templateId:
        templateKind === 'previous'
          ? previousCeId
          : templateKind === 'prebuilt'
          ? prebuiltId
          : standardId,
      sourceCeId: templateKind === 'previous' ? previousCeId : null,
      assignedTo: currentUserName || 'Estimator A',
    });
  }

  const previousCEs = (ceList || []).filter(
    (ce) =>
      ce.status === 'Done' ||
      ce.status === 'Awarded' ||
      ce.archived === true
  );

  return (
    <div className="wiz-wrap">
      <div className="wiz-header">
        <div>
          <h2 className="ce-serif">New Cost Estimate</h2>
          <p className="wiz-sub">
            {step === 1
              ? 'Link an RCE or enter project details, then choose a template.'
              : 'Choose the standard, pre-built, or previous CE template.'}
          </p>
        </div>
        <div className="wiz-steps">
          <span className={step === 1 ? 'wiz-step-on' : ''}>1. Details</span>
          <span className={step === 2 ? 'wiz-step-on' : ''}>2. Template</span>
          <span>3. Fill CE</span>
        </div>
      </div>

      {step === 1 && (
        <div className="ce-card wiz-card">
          <label className="ce-field-label">RCE source</label>
          <div className="wiz-rce-mode">
            <button
              type="button"
              className={`ce-pill ${rceMode === 'existing' ? 'ce-pill-active' : ''}`}
              onClick={() => setRceMode('existing')}
            >
              From RCE monitoring
            </button>
            <button
              type="button"
              className={`ce-pill ${rceMode === 'manual' ? 'ce-pill-active' : ''}`}
              onClick={() => setRceMode('manual')}
            >
              Manual RCE #
            </button>
          </div>

          {rceMode === 'existing' ? (
            <label className="wiz-field">
              <span className="ce-field-label">RCE #</span>
              <select
                className="ce-input"
                value={form.rceId}
                onChange={(e) => {
                  const next = (rceList || []).find(
                    (r) => rceLabel(r) === e.target.value
                  );
                  if (next) applyRce(next);
                  else setForm({ ...form, rceId: e.target.value });
                }}
              >
                <option value="">Select an RCE…</option>
                {(rceList || []).map((r) => (
                  <option key={rceLabel(r)} value={rceLabel(r)}>
                    {rceLabel(r)} — {rceClient(r) || 'No client'} /{' '}
                    {rceProject(r) || 'No project'}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="wiz-field">
              <span className="ce-field-label">RCE # (manual)</span>
              <input
                className="ce-input"
                value={form.rceId}
                onChange={(e) => setForm({ ...form, rceId: e.target.value })}
                placeholder="RCE-2026-001"
              />
            </label>
          )}

          {selectedRce && rceMode === 'existing' && (
            <p className="wiz-hint">
              Linked to {rceLabel(selectedRce)}. Client, project, and location
              were filled from the RCE — edit if needed.
            </p>
          )}

          <div className="wiz-grid">
            <label className="wiz-field">
              <span className="ce-field-label">Client</span>
              <input
                className="ce-input"
                value={form.client}
                onChange={(e) => setForm({ ...form, client: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Location</span>
              <input
                className="ce-input"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </label>
            <label className="wiz-field wiz-span">
              <span className="ce-field-label">Project description</span>
              <input
                className="ce-input"
                value={form.project}
                onChange={(e) => setForm({ ...form, project: e.target.value })}
              />
            </label>
            <label className="wiz-field wiz-span">
              <span className="ce-field-label">Notes / other remarks</span>
              <textarea
                className="ce-input ce-notes-box"
                rows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </label>
          </div>

          <div className="wiz-actions">
            <button type="button" className="ce-btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="ce-btn-primary"
              onClick={() => setStep(2)}
            >
              Next — choose template
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="ce-card wiz-card">
          <div className="wiz-rce-mode">
            <button
              type="button"
              className={`ce-pill ${templateKind === 'standard' ? 'ce-pill-active' : ''}`}
              onClick={() => setTemplateKind('standard')}
            >
              Standard
            </button>
            <button
              type="button"
              className={`ce-pill ${templateKind === 'prebuilt' ? 'ce-pill-active' : ''}`}
              onClick={() => setTemplateKind('prebuilt')}
            >
              Pre-built
            </button>
            <button
              type="button"
              className={`ce-pill ${templateKind === 'previous' ? 'ce-pill-active' : ''}`}
              onClick={() => setTemplateKind('previous')}
            >
              Previous CE
            </button>
          </div>

          {templateKind === 'standard' && (
            <div className="wiz-tpl-grid">
              {STANDARD_TEMPLATES.map((tpl) => (
                <button
                  type="button"
                  key={tpl.id}
                  className={
                    'wiz-tpl' +
                    (standardId === tpl.id ? ' wiz-tpl-on' : '') +
                    (!tpl.enabled ? ' wiz-tpl-off' : '')
                  }
                  disabled={!tpl.enabled}
                  onClick={() => tpl.enabled && setStandardId(tpl.id)}
                >
                  <strong>{tpl.title}</strong>
                  <span>{tpl.description}</span>
                  {!tpl.enabled && <em>Not functional yet</em>}
                </button>
              ))}
            </div>
          )}

          {templateKind === 'prebuilt' && (
            <div className="wiz-tpl-grid">
              {PREBUILT_TEMPLATES.map((tpl) => (
                <button
                  type="button"
                  key={tpl.id}
                  className={'wiz-tpl' + (prebuiltId === tpl.id ? ' wiz-tpl-on' : '')}
                  onClick={() => setPrebuiltId(tpl.id)}
                >
                  <strong>{tpl.title}</strong>
                  <span>{tpl.description}</span>
                </button>
              ))}
            </div>
          )}

          {templateKind === 'previous' && (
            <div>
              {previousCEs.length === 0 ? (
                <p className="wiz-hint">
                  No completed CEs yet. Finish a CE or pick a Standard template.
                </p>
              ) : (
                <div className="wiz-tpl-grid">
                  {previousCEs.map((ce) => (
                    <button
                      type="button"
                      key={ce.id}
                      className={
                        'wiz-tpl' + (previousCeId === ce.id ? ' wiz-tpl-on' : '')
                      }
                      onClick={() => setPreviousCeId(ce.id)}
                    >
                      <strong>{ce.id}</strong>
                      <span>
                        {ce.client || '—'} · {ce.project || '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="wiz-actions">
            <button
              type="button"
              className="ce-btn-ghost"
              onClick={() => (initialRce ? onCancel() : setStep(1))}
            >
              Back
            </button>
            <button
              type="button"
              className="ce-btn-primary"
              disabled={templateKind === 'previous' && !previousCeId}
              onClick={handleCreate}
            >
              Create and open editor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function UserMonitoringView({
  ceList = [],
  currentUserName,
  onOpenCE,
}) {
  const [status, setStatus] = useState('All');
  const [preview, setPreview] = useState({
    client: true,
    project: true,
    status: true,
    rce: true,
    lastEdited: true,
    assigned: true,
  });
  const me = currentUserName || 'Estimator A';
  const mine = (ceList || []).filter(
    (ce) => (ce.assignedTo || ce.lastEditedBy || '') === me
  );
  const filtered =
    status === 'All' ? mine : mine.filter((ce) => ce.status === status);

  return (
    <div className="dash-container">
      <div className="dash-header">
        <div>
          <h2 className="ce-serif">User Monitoring</h2>
          <p className="wiz-sub">Cost estimates assigned to {me}</p>
        </div>
      </div>
      <div className="mon-filter-row">
        <div className="mon-filter">
          <Filter size={16} />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mon-filter-select"
          >
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Done">Done</option>
            <option value="Parked">Parked</option>
          </select>
        </div>
      </div>
      <div className="ce-card" style={{ padding: '0.85rem 1rem', marginBottom: '0.8rem' }}>
        <span className="ce-field-label">Preview columns</span>
        <div className="wiz-rce-mode" style={{ marginTop: '0.4rem' }}>
          {Object.keys(preview).map((key) => (
            <label key={key} className="oif-check">
              <input
                type="checkbox"
                checked={preview[key]}
                onChange={() =>
                  setPreview((p) => ({ ...p, [key]: !p[key] }))
                }
              />
              {key}
            </label>
          ))}
        </div>
      </div>
      <div className="dash-table-card">
        <table className="dash-table">
          <thead>
            <tr>
              <th>CE #</th>
              {preview.rce && <th>RCE #</th>}
              {preview.client && <th>Client</th>}
              {preview.project && <th>Project</th>}
              {preview.status && <th>Status</th>}
              {preview.lastEdited && <th>Last Edited</th>}
              {preview.assigned && <th>Assigned</th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((ce) => (
              <tr
                key={ce.id}
                onClick={() => onOpenCE?.(ce)}
                style={{ cursor: 'pointer' }}
              >
                <td className="ce-mono">{ce.id}</td>
                {preview.rce && <td>{ce.rceId || ce.rceNo || '—'}</td>}
                {preview.client && <td>{ce.client || '—'}</td>}
                {preview.project && <td>{ce.project || '—'}</td>}
                {preview.status && <td>{ce.status}</td>}
                {preview.lastEdited && <td>{ce.lastEdited}</td>}
                {preview.assigned && (
                  <td>{ce.assignedTo || ce.lastEditedBy || '—'}</td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No estimates assigned to you yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function emptyOif() {
  return {
    id: '',
    oifNo: '',
    date: new Date().toISOString().slice(0, 10),
    projectDescription: '',
    rfqNo: '',
    customerName: '',
    customerRep: '',
    onsiteInspector: '',
    contactNo: '',
    photos: [],
    activity: { onsite: false, shopwork: false, supplyOnly: false },
    serviceType: {
      repair: false,
      electrical: false,
      thermalSpray: false,
      civilWorks: false,
      ndt: false,
      protectiveCoating: false,
      fabrication: false,
      balancing: false,
      others: false,
      mechanical: false,
      sandblasting: false,
      othersText: '',
    },
    quantity: '',
    length: '',
    width: '',
    thk: '',
    outsideDia: '',
    insideDia: '',
    dimLength: '',
    weightTons: false,
    weightKg: false,
    weightValue: '',
    drawingAvailable: '',
    duration: '',
    manpower: [
      { id: 'm1', designation: '', pax: '' },
      { id: 'm2', designation: '', pax: '' },
      { id: 'm3', designation: '', pax: '' },
      { id: 'm4', designation: '', pax: '' },
    ],
    scopeLeft: '',
    scopeRight: '',
    materialsLeft: '',
    materialsRight: '',
  };
}

export function InspectionReportsView({
  reports = [],
  onNew,
  onOpen,
}) {
  return (
    <div className="dash-container">
      <div className="dash-header">
        <h2 className="ce-serif">Inspection Reports</h2>
        <button className="ce-btn-primary" type="button" onClick={onNew}>
          <Plus size={15} /> New Onsite Inspection Form
        </button>
      </div>
      <div className="dash-table-card">
        <table className="dash-table">
          <thead>
            <tr>
              <th>OIF No.</th>
              <th>Date</th>
              <th>Customer</th>
              <th>Project</th>
              <th>Inspector</th>
              <th>RFQ No.</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr
                key={r.id}
                style={{ cursor: 'pointer' }}
                onClick={() => onOpen(r)}
              >
                <td className="ce-mono">{r.oifNo}</td>
                <td>{r.date}</td>
                <td>{r.customerName || '—'}</td>
                <td>{r.projectDescription || '—'}</td>
                <td>{r.onsiteInspector || '—'}</td>
                <td>{r.rfqNo || '—'}</td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem' }}>
                  No inspection reports yet — filing document only for now.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function InspectionFormView({ initial, onBack, onSave }) {
  const [form, setForm] = useState(() => ({ ...emptyOif(), ...(initial || {}) }));
  const photoRef = useRef(null);

  function patch(partial) {
    setForm((prev) => ({ ...prev, ...partial }));
  }

  async function addPhotos(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    const records = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                id: `ph-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                name: file.name,
                type: file.type,
                dataUrl: String(reader.result || ''),
              });
            reader.readAsDataURL(file);
          })
      )
    );
    patch({ photos: [...(form.photos || []), ...records] });
  }

  function updateManpower(id, field, value) {
    patch({
      manpower: form.manpower.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      ),
    });
  }

  function addManpower() {
    patch({
      manpower: [
        ...form.manpower,
        { id: `m-${Date.now()}`, designation: '', pax: '' },
      ],
    });
  }

  return (
    <div className="oif-wrap">
      <div className="dash-header">
        <h2 className="ce-serif">Onsite Inspection Form</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="ce-btn-ghost" onClick={onBack}>
            Back
          </button>
          <button
            type="button"
            className="ce-btn-primary"
            onClick={() => onSave(form)}
          >
            Save report
          </button>
        </div>
      </div>

      <div className="oif-sheet">
        <div className="oif-title">ONSITE INSPECTION FORM</div>
        <div className="oif-headgrid">
          <label>
            DATE
            <input
              className="ce-input"
              type="date"
              value={form.date}
              onChange={(e) => patch({ date: e.target.value })}
            />
          </label>
          <label>
            OIF NO.
            <input
              className="ce-input"
              value={form.oifNo}
              onChange={(e) => patch({ oifNo: e.target.value })}
            />
          </label>
          <label className="oif-span2">
            PROJECT DESCRIPTION
            <input
              className="ce-input"
              value={form.projectDescription}
              onChange={(e) => patch({ projectDescription: e.target.value })}
            />
          </label>
          <label>
            RFQ NO.
            <input
              className="ce-input"
              value={form.rfqNo}
              onChange={(e) => patch({ rfqNo: e.target.value })}
            />
          </label>
          <label>
            CUSTOMER NAME
            <input
              className="ce-input"
              value={form.customerName}
              onChange={(e) => patch({ customerName: e.target.value })}
            />
          </label>
          <label>
            CUSTOMER REPRESENTATIVE
            <input
              className="ce-input"
              value={form.customerRep}
              onChange={(e) => patch({ customerRep: e.target.value })}
            />
          </label>
          <label>
            ONSITE INSPECTOR
            <input
              className="ce-input"
              value={form.onsiteInspector}
              onChange={(e) => patch({ onsiteInspector: e.target.value })}
            />
          </label>
          <label>
            CONTACT NO.
            <input
              className="ce-input"
              value={form.contactNo}
              onChange={(e) => patch({ contactNo: e.target.value })}
            />
          </label>
        </div>

        <div className="oif-banner">A. PHOTOS</div>
        <div className="oif-photos">
          <button
            type="button"
            className="ce-btn-ghost ce-btn-sm"
            onClick={() => photoRef.current?.click()}
          >
            Upload photos
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={addPhotos}
          />
          <div className="oif-photo-grid">
            {(form.photos || []).map((p) => (
              <div key={p.id} className="oif-photo">
                {p.dataUrl ? (
                  <img src={p.dataUrl} alt={p.name} />
                ) : (
                  <span>{p.name}</span>
                )}
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      photos: form.photos.filter((x) => x.id !== p.id),
                    })
                  }
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="oif-split">
          <div>
            <div className="oif-banner">B. SCOPE OF WORK</div>
            <div className="oif-block">
              <span className="ce-field-label">Activity</span>
              <div className="oif-checks">
                {['onsite', 'shopwork', 'supplyOnly'].map((k) => (
                  <label key={k} className="oif-check">
                    <input
                      type="checkbox"
                      checked={!!form.activity[k]}
                      onChange={() =>
                        patch({
                          activity: {
                            ...form.activity,
                            [k]: !form.activity[k],
                          },
                        })
                      }
                    />
                    {k === 'supplyOnly' ? 'Supply only' : k[0].toUpperCase() + k.slice(1)}
                  </label>
                ))}
              </div>
              <span className="ce-field-label">Service type</span>
              <div className="oif-checks oif-checks-grid">
                {[
                  ['repair', 'Repair'],
                  ['electrical', 'Electrical'],
                  ['thermalSpray', 'Thermal spray'],
                  ['civilWorks', 'Civil works'],
                  ['ndt', 'NDT'],
                  ['protectiveCoating', 'Protective coating'],
                  ['fabrication', 'Fabrication'],
                  ['balancing', 'Balancing'],
                  ['mechanical', 'Mechanical'],
                  ['sandblasting', 'Sandblasting'],
                  ['others', 'Others'],
                ].map(([k, label]) => (
                  <label key={k} className="oif-check">
                    <input
                      type="checkbox"
                      checked={!!form.serviceType[k]}
                      onChange={() =>
                        patch({
                          serviceType: {
                            ...form.serviceType,
                            [k]: !form.serviceType[k],
                          },
                        })
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
              {form.serviceType.others && (
                <input
                  className="ce-input"
                  placeholder="Others…"
                  value={form.serviceType.othersText}
                  onChange={(e) =>
                    patch({
                      serviceType: {
                        ...form.serviceType,
                        othersText: e.target.value,
                      },
                    })
                  }
                />
              )}
            </div>
          </div>
          <div>
            <div className="oif-banner">C. WORKPIECE MEASUREMENTS</div>
            <div className="oif-block oif-meas">
              <label>
                A. Quantity
                <input
                  className="ce-input"
                  value={form.quantity}
                  onChange={(e) => patch({ quantity: e.target.value })}
                />
              </label>
              <div className="ce-field-label">B. General dimensions</div>
              <div className="oif-meas-row">
                <input
                  className="ce-input"
                  placeholder="Length"
                  value={form.length}
                  onChange={(e) => patch({ length: e.target.value })}
                />
                <input
                  className="ce-input"
                  placeholder="Width"
                  value={form.width}
                  onChange={(e) => patch({ width: e.target.value })}
                />
                <input
                  className="ce-input"
                  placeholder="Thk"
                  value={form.thk}
                  onChange={(e) => patch({ thk: e.target.value })}
                />
              </div>
              <div className="oif-meas-row">
                <input
                  className="ce-input"
                  placeholder="Outside Ø"
                  value={form.outsideDia}
                  onChange={(e) => patch({ outsideDia: e.target.value })}
                />
                <input
                  className="ce-input"
                  placeholder="Inside Ø"
                  value={form.insideDia}
                  onChange={(e) => patch({ insideDia: e.target.value })}
                />
                <input
                  className="ce-input"
                  placeholder="Length"
                  value={form.dimLength}
                  onChange={(e) => patch({ dimLength: e.target.value })}
                />
              </div>
              <div className="ce-field-label">C. Estimated weight</div>
              <div className="oif-checks">
                <label className="oif-check">
                  <input
                    type="checkbox"
                    checked={form.weightTons}
                    onChange={() => patch({ weightTons: !form.weightTons })}
                  />
                  Tons
                </label>
                <label className="oif-check">
                  <input
                    type="checkbox"
                    checked={form.weightKg}
                    onChange={() => patch({ weightKg: !form.weightKg })}
                  />
                  Kg
                </label>
                <input
                  className="ce-input"
                  placeholder="Value"
                  value={form.weightValue}
                  onChange={(e) => patch({ weightValue: e.target.value })}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="oif-block">
          <span className="ce-field-label">Customer working drawing available</span>
          <div className="oif-checks">
            {['YES', 'NO'].map((v) => (
              <label key={v} className="oif-check">
                <input
                  type="radio"
                  name="drawing"
                  checked={form.drawingAvailable === v}
                  onChange={() => patch({ drawingAvailable: v })}
                />
                {v}
              </label>
            ))}
          </div>
        </div>

        <div className="oif-banner">D. ONSITE ACTIVITY</div>
        <div className="oif-block">
          <label>
            A. Estimated project duration
            <input
              className="ce-input"
              value={form.duration}
              onChange={(e) => patch({ duration: e.target.value })}
              placeholder="e.g. 12 days"
            />
          </label>
          <table className="ce-table" style={{ marginTop: '0.6rem' }}>
            <thead>
              <tr>
                <th>Manpower designation</th>
                <th>No. of pax</th>
                <th>Manpower designation</th>
                <th>No. of pax</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(form.manpower.length / 2) }).map(
                (_, i) => {
                  const a = form.manpower[i * 2];
                  const b = form.manpower[i * 2 + 1];
                  return (
                    <tr key={a.id}>
                      <td>
                        <input
                          className="ce-input"
                          value={a.designation}
                          onChange={(e) =>
                            updateManpower(a.id, 'designation', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          className="ce-input"
                          value={a.pax}
                          onChange={(e) =>
                            updateManpower(a.id, 'pax', e.target.value)
                          }
                        />
                      </td>
                      <td>
                        {b ? (
                          <input
                            className="ce-input"
                            value={b.designation}
                            onChange={(e) =>
                              updateManpower(b.id, 'designation', e.target.value)
                            }
                          />
                        ) : null}
                      </td>
                      <td>
                        {b ? (
                          <input
                            className="ce-input"
                            value={b.pax}
                            onChange={(e) =>
                              updateManpower(b.id, 'pax', e.target.value)
                            }
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
          <button
            type="button"
            className="ce-btn-ghost ce-btn-sm"
            onClick={addManpower}
            style={{ marginTop: '0.5rem' }}
          >
            <Plus size={13} /> Add manpower row
          </button>
        </div>

        <div className="oif-banner">E. SCOPE OF WORK</div>
        <div className="oif-split">
          <textarea
            className="ce-input ce-notes-box"
            rows={10}
            value={form.scopeLeft}
            onChange={(e) => patch({ scopeLeft: e.target.value })}
          />
          <textarea
            className="ce-input ce-notes-box"
            rows={10}
            value={form.scopeRight}
            onChange={(e) => patch({ scopeRight: e.target.value })}
          />
        </div>

        <div className="oif-banner">
          F. ESTIMATED MATERIALS, CONSUMABLES, TOOLS AND EQUIPMENT
        </div>
        <div className="oif-split">
          <textarea
            className="ce-input ce-notes-box"
            rows={10}
            value={form.materialsLeft}
            onChange={(e) => patch({ materialsLeft: e.target.value })}
          />
          <textarea
            className="ce-input ce-notes-box"
            rows={10}
            value={form.materialsRight}
            onChange={(e) => patch({ materialsRight: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

const EL_STANDARDS = [
  { id: 's1', group: 'Material', name: 'Carbon steel density', value: '7.85 g/cm³', note: 'Plates, pipes, bars' },
  { id: 's2', group: 'Material', name: 'Stainless 304 density', value: '8.00 g/cm³', note: 'Austenitic plate' },
  { id: 's3', group: 'Welding', name: 'SMAW deposition efficiency', value: '65%', note: 'Stick electrode' },
  { id: 's4', group: 'Welding', name: 'GMAW deposition efficiency', value: '90%', note: 'Solid wire' },
  { id: 's5', group: 'Welding', name: 'FCAW deposition efficiency', value: '85%', note: 'Flux-cored' },
  { id: 's6', group: 'Welding', name: 'SAW deposition efficiency', value: '98%', note: 'Submerged arc' },
  { id: 's7', group: 'Coating', name: 'Typical epoxy DFT', value: '150–250 µm', note: 'Protective coating' },
  { id: 's8', group: 'Coating', name: 'Volume solids (epoxy)', value: '70–80%', note: 'High-build' },
  { id: 's9', group: 'Coating', name: 'Wastage allowance', value: '15–25%', note: 'Onsite spray' },
  { id: 's10', group: 'Pipe', name: 'Steel pipe weight factor', value: '0.02466', note: '(OD−WT)×WT×L' },
];

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function ElCalculatorView() {
  const [tool, setTool] = useState('weld');
  const [weld, setWeld] = useState({
    process: 'SMAW',
    jointType: 'fillet',
    lengthM: 10,
    sizeMm: 6,
    efficiency: 65,
    wastage: 10,
    density: 7.85,
  });
  const [paint, setPaint] = useState({
    area: 100,
    coats: 2,
    dft: 200,
    solids: 75,
    wastage: 20,
  });
  const [raw, setRaw] = useState({
    kind: 'plate',
    length: 1.2,
    width: 2.4,
    thick: 12,
    od: 168.3,
    wt: 7.11,
    density: 7.85,
  });
  const [stdQuery, setStdQuery] = useState('');

  const weldKg = useMemo(() => {
    const lengthMm = num(weld.lengthM) * 1000;
    const z = num(weld.sizeMm);
    const areaMm2 =
      weld.jointType === 'fillet' ? (z * z) / 2 : z * z * 0.7;
    const volumeCm3 = (areaMm2 * lengthMm) / 1000;
    const theoreticalKg = (volumeCm3 * num(weld.density)) / 1000;
    const deposited = theoreticalKg / Math.max(num(weld.efficiency) / 100, 0.01);
    return deposited * (1 + num(weld.wastage) / 100);
  }, [weld]);

  const paintL = useMemo(() => {
    const coverage = (num(paint.solids) / 100) * (10 / Math.max(num(paint.dft), 1));
    const liters = (num(paint.area) * num(paint.coats)) / Math.max(coverage, 0.0001);
    return liters * (1 + num(paint.wastage) / 100);
  }, [paint]);

  const rawKg = useMemo(() => {
    if (raw.kind === 'pipe') {
      return (
        (num(raw.od) - num(raw.wt)) *
        num(raw.wt) *
        0.02466 *
        num(raw.length)
      );
    }
    return num(raw.length) * num(raw.width) * num(raw.thick) * num(raw.density);
  }, [raw]);

  const standards = EL_STANDARDS.filter(
    (s) =>
      !stdQuery ||
      `${s.group} ${s.name} ${s.note}`.toLowerCase().includes(stdQuery.toLowerCase())
  );

  return (
    <div className="dash-container">
      <div className="dash-header">
        <h2 className="ce-serif">EL Calculator</h2>
      </div>
      <div className="wiz-rce-mode" style={{ marginBottom: '1rem' }}>
        {[
          ['weld', '6.1 Welding consumables'],
          ['paint', '6.2 Paints & coatings'],
          ['raw', '6.3 Raw materials'],
          ['std', '6.4 Standards database'],
        ].map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`ce-pill ${tool === k ? 'ce-pill-active' : ''}`}
            onClick={() => setTool(k)}
          >
            {label}
          </button>
        ))}
      </div>

      {tool === 'weld' && (
        <div className="ce-card wiz-card">
          <h3 className="ce-serif">Welding consumables</h3>
          <div className="wiz-grid">
            <label className="wiz-field">
              <span className="ce-field-label">Process</span>
              <select
                className="ce-input"
                value={weld.process}
                onChange={(e) => {
                  const process = e.target.value;
                  const eff = { SMAW: 65, GMAW: 90, FCAW: 85, SAW: 98, GTAW: 100 }[
                    process
                  ];
                  setWeld({ ...weld, process, efficiency: eff });
                }}
              >
                <option>SMAW</option>
                <option>GMAW</option>
                <option>FCAW</option>
                <option>SAW</option>
                <option>GTAW</option>
              </select>
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Joint</span>
              <select
                className="ce-input"
                value={weld.jointType}
                onChange={(e) => setWeld({ ...weld, jointType: e.target.value })}
              >
                <option value="fillet">Fillet</option>
                <option value="groove">Groove</option>
              </select>
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Weld length (m)</span>
              <input
                className="ce-input"
                type="number"
                value={weld.lengthM}
                onChange={(e) => setWeld({ ...weld, lengthM: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Size / leg (mm)</span>
              <input
                className="ce-input"
                type="number"
                value={weld.sizeMm}
                onChange={(e) => setWeld({ ...weld, sizeMm: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Deposition efficiency (%)</span>
              <input
                className="ce-input"
                type="number"
                value={weld.efficiency}
                onChange={(e) => setWeld({ ...weld, efficiency: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Wastage (%)</span>
              <input
                className="ce-input"
                type="number"
                value={weld.wastage}
                onChange={(e) => setWeld({ ...weld, wastage: e.target.value })}
              />
            </label>
          </div>
          <div className="el-result">
            Required consumable <b>{weldKg.toFixed(2)} kg</b>
          </div>
        </div>
      )}

      {tool === 'paint' && (
        <div className="ce-card wiz-card">
          <h3 className="ce-serif">Paints & coatings</h3>
          <div className="wiz-grid">
            <label className="wiz-field">
              <span className="ce-field-label">Area (m²)</span>
              <input
                className="ce-input"
                type="number"
                value={paint.area}
                onChange={(e) => setPaint({ ...paint, area: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Coats</span>
              <input
                className="ce-input"
                type="number"
                value={paint.coats}
                onChange={(e) => setPaint({ ...paint, coats: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">DFT (µm)</span>
              <input
                className="ce-input"
                type="number"
                value={paint.dft}
                onChange={(e) => setPaint({ ...paint, dft: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Volume solids (%)</span>
              <input
                className="ce-input"
                type="number"
                value={paint.solids}
                onChange={(e) => setPaint({ ...paint, solids: e.target.value })}
              />
            </label>
            <label className="wiz-field">
              <span className="ce-field-label">Wastage (%)</span>
              <input
                className="ce-input"
                type="number"
                value={paint.wastage}
                onChange={(e) => setPaint({ ...paint, wastage: e.target.value })}
              />
            </label>
          </div>
          <div className="el-result">
            Paint required <b>{paintL.toFixed(2)} L</b>
          </div>
        </div>
      )}

      {tool === 'raw' && (
        <div className="ce-card wiz-card">
          <h3 className="ce-serif">Raw materials</h3>
          <div className="wiz-rce-mode">
            <button
              type="button"
              className={`ce-pill ${raw.kind === 'plate' ? 'ce-pill-active' : ''}`}
              onClick={() => setRaw({ ...raw, kind: 'plate' })}
            >
              Plate
            </button>
            <button
              type="button"
              className={`ce-pill ${raw.kind === 'pipe' ? 'ce-pill-active' : ''}`}
              onClick={() => setRaw({ ...raw, kind: 'pipe' })}
            >
              Pipe
            </button>
          </div>
          {raw.kind === 'plate' ? (
            <div className="wiz-grid">
              <label className="wiz-field">
                <span className="ce-field-label">Length (m)</span>
                <input
                  className="ce-input"
                  type="number"
                  value={raw.length}
                  onChange={(e) => setRaw({ ...raw, length: e.target.value })}
                />
              </label>
              <label className="wiz-field">
                <span className="ce-field-label">Width (m)</span>
                <input
                  className="ce-input"
                  type="number"
                  value={raw.width}
                  onChange={(e) => setRaw({ ...raw, width: e.target.value })}
                />
              </label>
              <label className="wiz-field">
                <span className="ce-field-label">Thickness (mm)</span>
                <input
                  className="ce-input"
                  type="number"
                  value={raw.thick}
                  onChange={(e) => setRaw({ ...raw, thick: e.target.value })}
                />
              </label>
            </div>
          ) : (
            <div className="wiz-grid">
              <label className="wiz-field">
                <span className="ce-field-label">Outside Ø (mm)</span>
                <input
                  className="ce-input"
                  type="number"
                  value={raw.od}
                  onChange={(e) => setRaw({ ...raw, od: e.target.value })}
                />
              </label>
              <label className="wiz-field">
                <span className="ce-field-label">Wall thickness (mm)</span>
                <input
                  className="ce-input"
                  type="number"
                  value={raw.wt}
                  onChange={(e) => setRaw({ ...raw, wt: e.target.value })}
                />
              </label>
              <label className="wiz-field">
                <span className="ce-field-label">Length (m)</span>
                <input
                  className="ce-input"
                  type="number"
                  value={raw.length}
                  onChange={(e) => setRaw({ ...raw, length: e.target.value })}
                />
              </label>
            </div>
          )}
          <div className="el-result">
            Estimated weight <b>{rawKg.toFixed(2)} kg</b>
          </div>
        </div>
      )}

      {tool === 'std' && (
        <div className="ce-card wiz-card">
          <h3 className="ce-serif">Standards database</h3>
          <div className="mon-filter" style={{ marginBottom: '0.8rem' }}>
            <Search size={16} />
            <input
              className="ce-input"
              placeholder="Search standards…"
              value={stdQuery}
              onChange={(e) => setStdQuery(e.target.value)}
            />
          </div>
          <table className="ce-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Standard</th>
                <th>Value</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {standards.map((s) => (
                <tr key={s.id}>
                  <td>{s.group}</td>
                  <td>{s.name}</td>
                  <td className="ce-mono">{s.value}</td>
                  <td>{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function nextDocNo(prefix, list, field) {
  const year = new Date().getFullYear();
  const re = new RegExp(`^${prefix}-${year}-(\\d+)`, 'i');
  let max = 0;
  (list || []).forEach((item) => {
    const candidates = [
      typeof item === 'string' ? item : '',
      field ? item?.[field] : '',
      item?.id,
      item?.rceNo,
      item?.oifNo,
    ];
    candidates.forEach((raw) => {
      const m = String(raw || '')
        .trim()
        .match(re);
      if (m) max = Math.max(max, parseInt(m[1], 10) || 0);
    });
  });
  return `${prefix}-${year}-${String(max + 1).padStart(3, '0')}`;
}

export const NAV_GROUPS = [
  {
    id: 'my-dashboard',
    label: 'My Dashboard',
    children: [
      { key: 'dashboard', label: 'Cost Estimate', icon: ClipboardList },
      { key: 'inspection', label: 'Inspection Reports', icon: FileText },
      { key: 'user-monitoring', label: 'User Monitoring', icon: Activity },
    ],
  },
  {
    id: 'monitoring-group',
    label: 'Monitoring',
    redBorder: true,
    children: [
      { key: 'monitoring', label: 'Active', icon: Activity },
      { key: 'monitoring-archive', label: 'Archive', icon: FileText },
      { key: 'rce-inbox', label: 'RCE Requests', icon: FileText },
      { key: 'monitoring-exec', label: 'Executive Dashboard', icon: Activity },
    ],
  },
];

export const NAV_SINGLES = [
  { key: 'scope', label: 'Scope Library' },
  { key: 'database', label: 'Database' },
  { key: 'el-calculator', label: 'EL Calculator' },
];
