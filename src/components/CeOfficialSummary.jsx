import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ListTree, Plus, X } from 'lucide-react';

export const DEFAULT_SUMMARY_NOTES = [
  {
    id: 'note-shop',
    text: 'The Cost Estimate above for the Shopwork of the stated scope.',
    templates: ['shop'],
  },
  {
    id: 'note-scope',
    text: 'Any Additional Scope not stated based on Original SOW, is not included in this CE.',
    templates: ['onsite', 'shop', 'trading'],
  },
  {
    id: 'note-hold',
    text: 'This lead time is based on the assumption that our workforce will not encounter any interruption or hold points.',
    templates: ['onsite', 'shop', 'trading'],
  },
];

export function stripHonorific(name) {
  return String(name || "").replace(/^(mr|mrs|ms|miss)\.?\s+/i, "").trim();
}

export function honorificName(name, users) {
  const raw = stripHonorific(name);
  if (!raw) return "";
  const user = (users || []).find(
    (u) => String(u?.name || "").trim().toLowerCase() === raw.toLowerCase(),
  );
  const g = String(user?.gender || "").toLowerCase();
  if (g === "female" || g === "f" || g === "mrs") return `Mrs. ${raw}`;
  if (g === "male" || g === "m" || g === "mr") return `Mr. ${raw}`;
  return raw;
}

export function splitStamp(stamp) {
  const s = String(stamp || "").trim();
  const m = s.match(/^(.*?)(?:\s+)(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?\s*$/);
  if (!m) return { who: "", date: "", time: "" };
  return { who: stripHonorific(m[1]), date: m[2], time: m[3] };
}

export function notesForTemplates(allNotes, workTypes) {
  const notes = Array.isArray(allNotes) && allNotes.length ? allNotes : DEFAULT_SUMMARY_NOTES;
  const types = (workTypes || []).filter(Boolean);
  return notes.filter((n) => {
    const t = n.templates || [];
    if (!t.length || t.includes('all')) return true;
    if (!types.length) return true;
    return t.some((x) => types.includes(x));
  });
}

function FitNote({ value, onChange }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className="ce-input ce-sheet-note-text"
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SheetNotesEditor({ title = 'Notes', notes, onChange, bare = false, compact = false, numbered = false, icons = false }) {
  const list = Array.isArray(notes) ? notes : [];
  const [draft, setDraft] = useState('');

  function commit(next) {
    onChange?.(next);
  }

  return (
    <div className={'ce-sheet-notes' + (bare ? ' ce-sheet-notes-bare' : '') + (compact ? ' ce-sheet-notes-compact' : '') + (icons ? ' ce-sheet-notes-icons' : '')}>
      <div className="ce-sheet-notes-head">
        <h4 className="ce-serif ce-summary-subheading">{title}</h4>
        {icons ? null : <span className="wiz-hint">Add, edit, or remove. Printed under this sheet.</span>}
      </div>
      <ol className="ce-sheet-notes-list">
        {list.map((n, i) => (
          <li key={n.id || i}>
            {numbered ? <span className="ce-note-num">{i + 1}.</span> : null}
            {bare ? (
              <FitNote
                value={n.text}
                onChange={(text) => commit(list.map((row, idx) => (idx === i ? { ...row, text } : row)))}
              />
            ) : (
              <textarea
                className="ce-input"
                rows={icons || compact ? 1 : 2}
                value={n.text}
                onChange={(e) =>
                  commit(list.map((row, idx) => (idx === i ? { ...row, text: e.target.value } : row)))
                }
              />
            )}
            <button
              type="button"
              className={icons || bare ? 'ce-note-x' : 'ce-btn-ghost ce-btn-sm'}
              aria-label="Remove note"
              onClick={() => commit(list.filter((_, idx) => idx !== i))}
            >
              {icons || bare ? '×' : 'Remove'}
            </button>
          </li>
        ))}
      </ol>
      <div className="ce-sheet-notes-add">
        <input
          className="ce-input"
          placeholder="Add a note"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="button"
          className={icons ? 'ce-note-add' : 'ce-btn-ghost ce-btn-sm'}
          aria-label="Add note"
          title="Add note"
          disabled={!draft.trim()}
          onClick={() => {
            commit([...list, { id: `note-${Date.now()}`, text: draft.trim() }]);
            setDraft('');
          }}
        >
          {icons ? <Plus size={14} /> : compact ? 'Add' : 'Add note'}
        </button>
      </div>
    </div>
  );
}

function SignSlot({ label, name, title, stamp, nameKey, titleKey, onProject, users }) {
  if (!label) return <div className="ce-sign-slot" />;
  const shown = honorificName(name, users);
  const parts = splitStamp(stamp);
  const scriptName = parts.who || (stamp ? stripHonorific(name) : "");
  return (
    <div className="ce-sign-slot">
      <div className="ce-sign-role">{label}</div>
      <div className="ce-sign-signoff">
        <span className="ce-sign-script">{scriptName}</span>
        {parts.date ? (
          <span className="ce-sign-when">
            {parts.date}
            <br />
            {parts.time}
          </span>
        ) : null}
      </div>
      <input
        className="ce-sign-name"
        value={shown}
        onChange={(e) => onProject?.({ [nameKey]: stripHonorific(e.target.value) })}
      />
      <div className="ce-sign-line" />
      <input
        className="ce-sign-title"
        placeholder="Position / title"
        value={title || ''}
        onChange={(e) => onProject?.({ [titleKey]: e.target.value })}
      />
    </div>
  );
}

function MoneyCell({ value, onCommit }) {
  const [text, setText] = useState(String(value ?? ''));
  useEffect(() => {
    setText(String(value ?? ''));
  }, [value]);
  return (
    <input
      className="ce-input ce-official-money"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit?.(text)}
    />
  );
}

export default function CeOfficialSummary({
  rows,
  includes,
  qty,
  unitPrice,
  totalAmount,
  project,
  onProject,
  onAmount,
  onHighlight,
  includeCatalog,
  onAddInclude,
  onRemoveInclude,
  onMoveInclude,
  thirdLines = [],
  thirdShow = null,
  onThirdShow,
  notes,
  onNotes,
  users = [],
}) {
  const [pick, setPick] = useState('');
  const [thirdOpen, setThirdOpen] = useState(false);
  const [picked, setPicked] = useState(thirdShow?.keys || []);
  const keySig = (thirdShow?.keys || []).join('|');
  useEffect(() => {
    setPicked(thirdShow?.keys || []);
  }, [keySig]);
  const set = (key) => (value) => onProject?.({ [key]: value });
  const lines = thirdLines || [];

  return (
    <div className="ce-official">
      <table className="ce-official-grid ce-info-sheet">
        <colgroup>
          <col className="ce-info-lab" />
          <col />
          <col className="ce-info-lab-r" />
          <col className="ce-info-side-col" />
        </colgroup>
        <tbody>
          <tr>
            <th>PROJECT TYPE:</th>
            <td>
              <label className="ce-official-check">
                <input
                  type="checkbox"
                  checked={project.electrical === true || project.electrical === 'true'}
                  onChange={(e) => onProject?.({
                    electrical: e.target.checked,
                    mechanical: e.target.checked ? false : project.mechanical,
                  })}
                />
                Electrical
              </label>
              <label className="ce-official-check">
                <input
                  type="checkbox"
                  checked={project.mechanical === true || project.mechanical === 'true'}
                  onChange={(e) => onProject?.({
                    mechanical: e.target.checked,
                    electrical: e.target.checked ? false : project.electrical,
                  })}
                />
                Mechanical
              </label>
            </td>
            <th>DATE:</th>
            <td>
              <input className="ce-official-input" type="date" value={project.date || ''} onChange={(e) => set('date')(e.target.value)} />
            </td>
          </tr>
          <tr>
            <th>PROJECT DESCRIPTION:</th>
            <td>
              <textarea className="ce-official-input" rows={2} value={project.description || ''} onChange={(e) => set('description')(e.target.value)} />
            </td>
            <td colSpan={2} className="ce-info-side">
              <div className="ce-info-ceno-label">COST ESTIMATE (CE) NUMBER</div>
              <input className="ce-official-input" value={project.docNo || ''} onChange={(e) => set('docNo')(e.target.value)} />
            </td>
          </tr>
          <tr>
            <th>CLIENT NAME:</th>
            <td>
              <textarea className="ce-official-input" rows={2} value={project.client || ''} onChange={(e) => set('client')(e.target.value)} />
            </td>
            <td colSpan={2} className="ce-info-side">
              <label className="ce-info-rev">
                <span>REVISION NO.</span>
                <input className="ce-official-input" value={project.revNo || ''} onChange={(e) => set('revNo')(e.target.value)} />
              </label>
              <label className="ce-info-rev">
                <span>REVISION DATE</span>
                <input className="ce-official-input" type="date" value={project.revDate || ''} onChange={(e) => set('revDate')(e.target.value)} />
              </label>
            </td>
          </tr>
          <tr>
            <th>CLIENT LOCATION:</th>
            <td>
              <textarea className="ce-official-input" rows={2} value={project.location || ''} onChange={(e) => set('location')(e.target.value)} />
            </td>
            <th>MATERIAL:</th>
            <td>
              <textarea className="ce-official-input" rows={2} value={project.material || ''} onChange={(e) => set('material')(e.target.value)} />
            </td>
          </tr>
          <tr>
            <th>ATTENTION:</th>
            <td>
              <textarea className="ce-official-input" rows={2} value={project.attention || ''} onChange={(e) => set('attention')(e.target.value)} />
            </td>
            <th>QUANTITY:</th>
            <td>
              <input className="ce-official-input" value={project.quantity || ''} onChange={(e) => set('quantity')(e.target.value)} />
            </td>
          </tr>
          <tr>
            <th>END USER:</th>
            <td>
              <textarea className="ce-official-input" rows={2} value={project.endUser || ''} onChange={(e) => set('endUser')(e.target.value)} />
            </td>
            <th>NO. OF DAYS:</th>
            <td>
              <input className="ce-official-input" value={project.days || ''} onChange={(e) => set('days')(e.target.value)} />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ce-official-scroll">
      <table className="ce-official-grid ce-official-body">
        <colgroup>
          <col className="ce-official-col-item" />
          <col />
          <col className="ce-official-col-cost" />
          <col className="ce-official-col-act" />
        </colgroup>
        <thead>
          <tr>
            <th>ITEM</th>
            <th>DESCRIPTION</th>
            <th>TOTAL COST</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.key}
              className={
                (row.main ? 'ce-official-main ' : '') +
                (row.sub ? 'ce-official-sub' : '') +
                (row.breakdown ? ' ce-official-break' : '') +
                (row.highlight ? ' ce-official-hot' : '')
              }
            >
              <td>{row.item}</td>
              <td>{row.label}</td>
              <td className="ce-official-amt">
                {row.group || row.breakdown
                  ? row.display
                  : <MoneyCell value={row.display} onCommit={(raw) => onAmount?.(row, raw)} />}
              </td>
              <td className="ce-official-actions">
                {row.third ? (
                  <button
                    type="button"
                    className={'ce-btn-ghost ce-official-include-btn' + (thirdOpen ? ' is-on' : '')}
                    title="Third party breakdown"
                    aria-label="Third party breakdown"
                    onClick={() => setThirdOpen((open) => !open)}
                  >
                    <ListTree size={15} />
                  </button>
                ) : null}
                {!row.group && !row.breakdown && (
                  <button
                    type="button"
                    className={'ce-btn-ghost ce-official-include-btn' + (row.highlight ? ' is-on' : '')}
                    title={row.highlight ? 'Included' : 'Include'}
                    aria-label={row.highlight ? 'Included' : 'Include'}
                    onClick={() => onHighlight?.(row.key, !row.highlight)}
                  >
                    <Check size={15} />
                  </button>
                )}
              </td>
            </tr>
          ))}
          {includes.length ? (
            <tr className="ce-official-foot">
              <td>F.</td>
              <td>Custom Breakdown</td>
              <td></td>
              <td></td>
            </tr>
          ) : null}
          {includes.map((row, index) => (
            <tr key={row.id} className="ce-official-custom">
              <td></td>
              <td>{`${row.num || `F.${index + 1}`} ${row.label}`}</td>
              <td className="ce-official-amt">{row.display}</td>
              <td className="ce-official-actions">
                <button
                  type="button"
                  className="ce-btn-ghost ce-official-include-btn"
                  title="Move up"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => onMoveInclude?.(row.id, 'up')}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  className="ce-btn-ghost ce-official-include-btn"
                  title="Move down"
                  aria-label="Move down"
                  disabled={index === includes.length - 1}
                  onClick={() => onMoveInclude?.(row.id, 'down')}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  className="ce-btn-ghost ce-official-include-btn"
                  title="Remove"
                  aria-label="Remove"
                  onClick={() => onRemoveInclude?.(row.id)}
                >
                  <X size={14} />
                </button>
              </td>
            </tr>
          ))}
          <tr className="ce-official-foot">
            <td></td>
            <td>UNIT PRICE:</td>
            <td className="ce-official-amt">{unitPrice}</td>
            <td></td>
          </tr>
          <tr className="ce-official-foot">
            <td></td>
            <td>TOTAL AMOUNT:</td>
            <td className="ce-official-amt">{totalAmount}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      </div>
      {thirdOpen ? (
        <div className="ce-tp-panel">
          <div className="ce-tp-actions">
            <button
              type="button"
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => onThirdShow?.({ mode: 'all', keys: lines.map((l) => l.key) })}
            >
              Show all
            </button>
            <button
              type="button"
              className="ce-btn-ghost ce-btn-sm"
              disabled={!picked.length}
              onClick={() => onThirdShow?.({ mode: 'selected', keys: picked })}
            >
              Show selected
            </button>
            <button
              type="button"
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => onThirdShow?.({ mode: 'off', keys: [] })}
            >
              Hide
            </button>
          </div>
          {lines.length ? (
            <div className="ce-tp-list">
              {lines.map((line) => (
                <label key={line.key}>
                  <input
                    type="checkbox"
                    checked={picked.includes(line.key)}
                    onChange={(e) => setPicked((cur) => (
                      e.target.checked ? [...cur, line.key] : cur.filter((key) => key !== line.key)
                    ))}
                  />
                  {line.description}
                </label>
              ))}
            </div>
          ) : (
            <p className="wiz-hint">No third party lines in this breakdown.</p>
          )}
        </div>
      ) : null}
      <p className="wiz-hint">
        Unit price is the total divided by the quantity. Editing a computed amount is confirmed and written into the notes.
      </p>
      <div className="ce-official-include">
        <select className="ce-input" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">Include another cost…</option>
          {includeCatalog.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ce-btn-ghost ce-btn-sm"
          disabled={!pick}
          onClick={() => {
            onAddInclude?.(pick);
            setPick('');
          }}
        >
          Add to summary
        </button>
      </div>
      <SheetNotesEditor title="Notes" notes={notes} onChange={onNotes} bare numbered />
      <div className="ce-sign-grid">
        <SignSlot label="Prepared By:" name={project.preparedBy} title={project.preparedTitle} stamp={project.preparedStamp} nameKey="preparedBy" titleKey="preparedTitle" onProject={onProject} users={users} />
        <SignSlot label="Checked By:" name={project.checkedBy} title={project.checkedTitle} stamp={project.checkedStamp} nameKey="checkedBy" titleKey="checkedTitle" onProject={onProject} users={users} />
        <SignSlot label="Noted By:" name={project.notedBy} title={project.notedTitle} stamp={project.notedStamp} nameKey="notedBy" titleKey="notedTitle" onProject={onProject} users={users} />
        <SignSlot label="Approved By:" name={project.approvedBy} title={project.approvedTitle} stamp={project.approvedStamp} nameKey="approvedBy" titleKey="approvedTitle" onProject={onProject} users={users} />
        <SignSlot label="Reviewed By:" name={project.reviewedBy} title={project.reviewedTitle} stamp={project.reviewedStamp} nameKey="reviewedBy" titleKey="reviewedTitle" onProject={onProject} users={users} />
        <SignSlot label="Checked By:" name={project.checkedBy2} title={project.checkedTitle2} stamp={project.checkedStamp2} nameKey="checkedBy2" titleKey="checkedTitle2" onProject={onProject} users={users} />
        <SignSlot label="Concurred by:" name={project.concurredBy} title={project.concurredTitle} stamp={project.concurredStamp} nameKey="concurredBy" titleKey="concurredTitle" onProject={onProject} users={users} />
        <SignSlot />
      </div>
    </div>
  );
}
