'use client';
import Papa from 'papaparse';
import React, {
  useState,
  useReducer,
  useMemo,
  useRef,
  useEffect,
  useContext,
  createContext,
} from 'react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  Download,
  Upload,
  Users,
  Wrench,
  HardHat,
  Package,
  FileText,
  Pencil,
  Check,
  Copy,
  ClipboardList,
  Database,
  Library,
  Activity,
  LayoutDashboard,
  AlertCircle,
  CheckCircle2,
  FolderPlus,
  UploadCloud,
  TrendingUp,
  Clock,
  Award,
  Bell,
  Filter,
  Settings,
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { exportToPDF, exportToExcel } from '../utils/exportDocuments';
/* ============================= CONSTANTS ============================= */
const PHP = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});
const fmt = (n) => PHP.format(Number.isFinite(n) ? n : 0);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const DAY_TYPES = ['Regular', 'Sun/Special', 'Holiday'];
const DAY_TYPE_MULT = { Regular: 1, 'Sun/Special': 1.3, Holiday: 2.0 };
const SHIFTS = ['Day', 'Night'];
const NIGHT_DIFF = 0.1;
const OT_MULT = 1.25;

const CATS = ['BOL', 'BOTE', 'PPE', 'BOCM', 'MISC'];
const CATEGORY_META = {
  BOL: { label: 'Bill of Labor', short: 'BOL', icon: Users },
  BOTE: { label: 'Bill of Tools & Equipment', short: 'BOTE', icon: Wrench },
  PPE: { label: 'Personal Protective Equipment', short: 'PPE', icon: HardHat },
  BOCM: {
    label: 'Bill of Consumables & Materials',
    short: 'BOCM',
    icon: Package,
  },
  MISC: { label: 'Miscellaneous', short: 'MISC', icon: FileText },
};

let _seq = 0;
const uid = (p) =>
  `${p}-${(_seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/* ============================= MASTERLIST STORE ============================= */
const FIXED_CATEGORY_KEYS = [
  'manpower',
  'equipment',
  'consumables',
  'ppe',
  'misc',
];
const LEGACY_KEY_MAP = {
  BOL: 'manpower',
  BOTE: 'equipment',
  BOCM: 'consumables',
  PPE: 'ppe',
  MISC: 'misc',
};
const normalizeCategoryKey = (key) => LEGACY_KEY_MAP[key] || key;

function emptyMasterlistState() {
  return {
    manpower: [],
    equipment: [],
    consumables: [],
    ppe: [],
    misc: [],
    clients: [],
    customCategories: [],
  };
}
function isFixedCategory(categoryKey) {
  return FIXED_CATEGORY_KEYS.includes(categoryKey);
}
function labelKeyForCategory(categoryKey) {
  if (categoryKey === 'manpower') return 'role';
  if (categoryKey === 'ppe') return 'item';
  if (isFixedCategory(categoryKey)) return 'description';
  return 'name';
}
function getCategoryItems(state, categoryKey) {
  if (isFixedCategory(categoryKey)) return state[categoryKey] || [];
  const custom = state.customCategories.find(
    (c) => c.categoryKey === categoryKey
  );
  return custom ? custom.items : [];
}
function withCategoryItems(state, categoryKey, updater) {
  if (isFixedCategory(categoryKey))
    return { ...state, [categoryKey]: updater(state[categoryKey] || []) };
  return {
    ...state,
    customCategories: state.customCategories.map((c) =>
      c.categoryKey === categoryKey ? { ...c, items: updater(c.items) } : c
    ),
  };
}
function slugifyCategoryKey(name, state) {
  const base =
    String(name || 'category')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'category';
  const taken = new Set([
    ...FIXED_CATEGORY_KEYS,
    ...state.customCategories.map((c) => c.categoryKey),
  ]);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
function emptyClient() {
  return { id: uid('cli'), clientCode: '', fullName: '', address: '' };
}

function masterlistReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      return withCategoryItems(state, action.categoryKey, (items) => [
        ...items,
        action.item,
      ]);
    case 'UPDATE_ITEM':
      return withCategoryItems(state, action.categoryKey, (items) =>
        items.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i))
      );
    case 'DELETE_ITEM':
      return withCategoryItems(state, action.categoryKey, (items) =>
        items.filter((i) => i.id !== action.id)
      );
    case 'DUPLICATE_ITEM':
      return withCategoryItems(state, action.categoryKey, (items) => {
        const idx = items.findIndex((i) => i.id === action.id);
        if (idx === -1) return items;
        const labelKey = labelKeyForCategory(action.categoryKey);
        const clone = { ...items[idx], id: uid('ml') };
        if (clone[labelKey]) clone[labelKey] = `${clone[labelKey]} (Copy)`;
        const next = [...items];
        next.splice(idx + 1, 0, clone);
        return next;
      });
    case 'BULK_IMPORT_CATEGORY_ITEMS': {
      const safeItems = (action.itemsArray || [])
        .filter((row) => row && typeof row === 'object')
        .map((row) => ({ id: row.id || uid('ml'), ...row }));
      if (!safeItems.length) return state;
      return withCategoryItems(state, action.categoryKey, (items) => [
        ...items,
        ...safeItems,
      ]);
    }
    case 'ADD_CATEGORY': {
      const categoryKey = slugifyCategoryKey(action.categoryName, state);
      return {
        ...state,
        customCategories: [
          ...state.customCategories,
          {
            id: uid('cat'),
            categoryKey,
            categoryName: action.categoryName || 'Untitled Category',
            items: [],
          },
        ],
      };
    }
    case 'UPDATE_CATEGORY': {
      return {
        ...state,
        customCategories: state.customCategories.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
      };
    }
    case 'DELETE_CATEGORY':
      return {
        ...state,
        customCategories: state.customCategories.filter(
          (c) => c.id !== action.id
        ),
      };
    case 'ADD_CLIENT':
      return { ...state, clients: [...state.clients, action.client] };
    case 'UPDATE_CLIENT':
      return {
        ...state,
        clients: state.clients.map((c) =>
          c.id === action.id ? { ...c, ...action.patch } : c
        ),
      };
    case 'DELETE_CLIENT':
      return {
        ...state,
        clients: state.clients.filter((c) => c.id !== action.id),
      };
    default:
      return state;
  }
}

const MasterlistContext = createContext(null);
function MasterlistProvider({ children }) {
  const [state, dispatch] = useReducer(
    masterlistReducer,
    undefined,
    emptyMasterlistState
  );
  const api = useMemo(
    () => ({
      ...state,
      BOL: state.manpower,
      BOTE: state.equipment,
      BOCM: state.consumables,
      PPE: state.ppe,
      MISC: state.misc,
      addItem: (categoryKey, item) =>
        dispatch({
          type: 'ADD_ITEM',
          categoryKey: normalizeCategoryKey(categoryKey),
          item,
        }),
      updateItem: (categoryKey, id, patch) =>
        dispatch({
          type: 'UPDATE_ITEM',
          categoryKey: normalizeCategoryKey(categoryKey),
          id,
          patch,
        }),
      deleteItem: (categoryKey, id) =>
        dispatch({
          type: 'DELETE_ITEM',
          categoryKey: normalizeCategoryKey(categoryKey),
          id,
        }),
      duplicateItem: (categoryKey, id) =>
        dispatch({
          type: 'DUPLICATE_ITEM',
          categoryKey: normalizeCategoryKey(categoryKey),
          id,
        }),
      bulkImportCategoryItems: (categoryKey, itemsArray) =>
        dispatch({
          type: 'BULK_IMPORT_CATEGORY_ITEMS',
          categoryKey: normalizeCategoryKey(categoryKey),
          itemsArray,
        }),
      addCategory: (categoryName) =>
        dispatch({ type: 'ADD_CATEGORY', categoryName }),
      deleteCategory: (id) => dispatch({ type: 'DELETE_CATEGORY', id }),
      addClient: (client) =>
        dispatch({
          type: 'ADD_CLIENT',
          client: { ...emptyClient(), ...client },
        }),
      updateCategory: (id, patch) =>
        dispatch({ type: 'UPDATE_CATEGORY', id, patch }),
      updateClient: (id, patch) =>
        dispatch({ type: 'UPDATE_CLIENT', id, patch }),
      deleteClient: (id) => dispatch({ type: 'DELETE_CLIENT', id }),
    }),
    [state]
  );
  return (
    <MasterlistContext.Provider value={api}>
      {children}
    </MasterlistContext.Provider>
  );
}
function useMasterlist() {
  const ctx = useContext(MasterlistContext);
  if (!ctx)
    throw new Error('useMasterlist must be used within a MasterlistProvider');
  return ctx;
}

/* ============================= CALCULATION ENGINE ============================= */
function calcBOL(item) {
  const dt = DAY_TYPE_MULT[item.dayType] ?? 1;
  const shiftAdd = item.shift === 'Night' ? NIGHT_DIFF : 0;
  const effRate = num(item.rate) * dt * (1 + shiftAdd);
  const hourly = num(item.rate) / 8;
  const otRate = hourly * OT_MULT * dt * (1 + shiftAdd);
  const base = num(item.qty) * num(item.days) * effRate;
  const ot = num(item.qty) * num(item.days) * num(item.otHrs) * otRate;
  const perDiemAllow =
    num(item.qty) * num(item.days) * (num(item.perDiem) + num(item.allowance));
  return {
    base,
    ot,
    otRate,
    perDiemAllow,
    labor: base + ot,
    benefits: perDiemAllow,
    subtotal: base + ot + perDiemAllow,
  };
}
const calcBOTE = (i) => num(i.qty) * num(i.days) * num(i.rate);
const calcBOCM = (i) => num(i.qty) * num(i.unitCost);
const calcPPE = (i) => num(i.qty) * num(i.unitCost);
const calcMISC = (i) => num(i.qty) * (num(i.days) || 1) * num(i.unitCost);

function itemSubtotal(cat, item) {
  if (cat === 'BOL') return calcBOL(item).subtotal;
  if (cat === 'BOTE') return calcBOTE(item);
  if (cat === 'BOCM') return calcBOCM(item);
  if (cat === 'PPE') return calcPPE(item);
  return calcMISC(item);
}
function categoryTotal(items, cat) {
  return (items || []).reduce((s, it) => s + itemSubtotal(cat, it), 0);
}
function subtaskTotal(subtask) {
  return CATS.reduce((s, c) => s + categoryTotal(subtask.items[c], c), 0);
}
function taskTotal(task) {
  return task.subtasks.reduce((s, st) => s + subtaskTotal(st), 0);
}
function projectTotal(tasks) {
  return tasks.reduce((s, t) => s + taskTotal(t), 0);
}

/* ============================= FACTORIES ============================= */
function bolItem(o) {
  return { id: uid('bol'), otHrs: 0, dayType: 'Regular', shift: 'Day', ...o };
}
function boteItem(o) {
  return { id: uid('bote'), ...o };
}
function bocmItem(o) {
  return { id: uid('bocm'), ...o };
}
function ppeItem(o) {
  return { id: uid('ppe'), ...o };
}
function miscItem(o) {
  return { id: uid('misc'), ...o };
}
function emptyItems() {
  return { BOL: [], BOTE: [], PPE: [], BOCM: [], MISC: [] };
}
function subtask(title, items) {
  return {
    id: uid('sub'),
    title,
    expanded: true,
    items,
    type: 'Sequential',
    predecessor: null,
  };
}
function task(title, subtasks) {
  return {
    id: uid('task'),
    title,
    expanded: true,
    notes: '',
    subtasks,
    duration: 0,
    predecessor: null,
  };
}

const ATTACHMENT_SHEETS = [
  'BOL',
  'BOTE',
  'BOCM',
  'PPE',
  'MISC_A',
  'MISC_B',
  'MISC_C',
  'MISC_D',
  'MISC_E',
];
function emptyFileAttachments() {
  return ATTACHMENT_SHEETS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});
}
function emptySummaryTaskFilters() {
  return { showBreakdown: false, selectedTaskIds: [] };
}
function buildEmptyProject() {
  return {
    meta: {
      client: '',
      location: '',
      date: new Date().toISOString().slice(0, 10),
      title: 'New Cost Estimate',
      subtitle: '',
    },
    tasks: [],
    fileAttachments: emptyFileAttachments(),
    summaryTaskFilters: emptySummaryTaskFilters(),
  };
}
function getDerivedMiscItems(tasks) {
  const rows = [];
  tasks.forEach((t) =>
    t.subtasks.forEach((s) =>
      (s.items.MISC || []).forEach((it) =>
        rows.push({
          taskId: t.id,
          taskTitle: t.title,
          subtaskId: s.id,
          subtaskTitle: s.title,
          item: it,
          subtotal: calcMISC(it),
        })
      )
    )
  );
  return rows;
}

/* ============================= REDUCER ============================= */
function mapTask(state, taskId, fn) {
  return {
    ...state,
    tasks: state.tasks.map((t) => (t.id === taskId ? fn(t) : t)),
  };
}
function mapSubtask(t, subtaskId, fn) {
  return {
    ...t,
    subtasks: t.subtasks.map((s) => (s.id === subtaskId ? fn(s) : s)),
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_META':
      return {
        ...state,
        meta: { ...state.meta, [action.field]: action.value },
      };
    case 'ADD_TASK':
      return {
        ...state,
        tasks: [...state.tasks, task(action.title || 'Untitled Task', [])],
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== action.taskId),
      };
    case 'RENAME_TASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        title: action.title,
      }));
    case 'TOGGLE_TASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        expanded: !t.expanded,
      }));
    case 'SET_TASK_NOTES':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        notes: action.notes,
      }));
    case 'SET_TASK_DURATION':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        duration: Number(action.duration) || 0,
      }));
    case 'SET_TASK_PREDECESSOR':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        predecessor: action.predecessorId || null,
      }));
    case 'ADD_SUBTASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        subtasks: [
          ...t.subtasks,
          subtask(action.title || 'Untitled Subtask', emptyItems()),
        ],
      }));
    case 'DELETE_SUBTASK':
      return mapTask(state, action.taskId, (t) => ({
        ...t,
        subtasks: t.subtasks.filter((s) => s.id !== action.subtaskId),
      }));
    case 'RENAME_SUBTASK':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({ ...s, title: action.title }))
      );
    case 'TOGGLE_SUBTASK':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          expanded: !s.expanded,
        }))
      );
    case 'SET_SUBTASK_TYPE':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          type: action.subtaskType,
        }))
      );
    case 'SET_SUBTASK_PREDECESSOR':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          predecessor: action.predecessorId || null,
        }))
      );
    case 'ADD_ITEMS':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          items: {
            ...s.items,
            [action.category]: [...s.items[action.category], ...action.items],
          },
        }))
      );
    case 'DELETE_ITEM':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          items: {
            ...s.items,
            [action.category]: s.items[action.category].filter(
              (i) => i.id !== action.itemId
            ),
          },
        }))
      );
    case 'UPDATE_ITEM':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          items: {
            ...s.items,
            [action.category]: s.items[action.category].map((i) =>
              i.id === action.itemId ? { ...i, ...action.patch } : i
            ),
          },
        }))
      );
    case 'REPLACE_CATEGORY_ITEMS':
      return mapTask(state, action.taskId, (t) =>
        mapSubtask(t, action.subtaskId, (s) => ({
          ...s,
          items: {
            ...s.items,
            [action.category]: action.items,
          },
        }))
      );
    case 'IMPORT_PROJECT': {
      const base = buildEmptyProject();
      const incoming = action.project || {};
      return {
        ...base,
        ...incoming,
        meta: { ...base.meta, ...(incoming.meta || {}) },
        fileAttachments: {
          ...base.fileAttachments,
          ...(incoming.fileAttachments || {}),
        },
        summaryTaskFilters: {
          ...base.summaryTaskFilters,
          ...(incoming.summaryTaskFilters || {}),
        },
        tasks: Array.isArray(incoming.tasks)
          ? incoming.tasks.map((t) => ({
              ...task(t.title || 'Untitled Task', t.subtasks || []),
              ...t,
              subtasks: (t.subtasks || []).map((s) => ({
                ...subtask(s.title || 'Untitled Subtask', emptyItems()),
                ...s,
              })),
            }))
          : [],
      };
    }
    case 'ADD_ATTACHMENTS':
      return {
        ...state,
        fileAttachments: {
          ...state.fileAttachments,
          [action.sheetKey]: [
            ...(state.fileAttachments[action.sheetKey] || []),
            ...action.files,
          ],
        },
      };
    case 'DELETE_ATTACHMENT':
      return {
        ...state,
        fileAttachments: {
          ...state.fileAttachments,
          [action.sheetKey]: (
            state.fileAttachments[action.sheetKey] || []
          ).filter((f) => f.id !== action.fileId),
        },
      };
    case 'SET_SUMMARY_SHOW_BREAKDOWN': {
      const turningOn = action.value && !state.summaryTaskFilters.showBreakdown;
      const needsSeed =
        turningOn && state.summaryTaskFilters.selectedTaskIds.length === 0;
      return {
        ...state,
        summaryTaskFilters: {
          showBreakdown: action.value,
          selectedTaskIds: needsSeed
            ? state.tasks.map((t) => t.id)
            : state.summaryTaskFilters.selectedTaskIds,
        },
      };
    }
    case 'TOGGLE_SUMMARY_TASK': {
      const cur = state.summaryTaskFilters.selectedTaskIds;
      const next = cur.includes(action.taskId)
        ? cur.filter((id) => id !== action.taskId)
        : [...cur, action.taskId];
      return {
        ...state,
        summaryTaskFilters: {
          ...state.summaryTaskFilters,
          selectedTaskIds: next,
        },
      };
    }
    case 'RESTORE_TASKS':
      return {
        ...state,
        tasks: action.tasks,
      };
    case 'SET_SUMMARY_TASK_IDS':
      return {
        ...state,
        summaryTaskFilters: {
          ...state.summaryTaskFilters,
          selectedTaskIds: action.ids,
        },
      };
    default:
      return state;
  }
}

/* ============================= UI ATOMS ============================= */
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={'ce-pill' + (active ? ' ce-pill-active' : '')}
    >
      {children}
    </button>
  );
}
function IconBtn({ onClick, title, danger, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={'ce-iconbtn' + (danger ? ' ce-iconbtn-danger' : '')}
      type="button"
    >
      {children}
    </button>
  );
}
function EditableTitle({ value, onSave, className, serif }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft.trim()) onSave(draft.trim());
          else setDraft(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(value);
            setEditing(false);
          }
        }}
        className={'ce-input ' + (className || '')}
        style={serif ? { fontFamily: 'var(--font-serif)' } : undefined}
      />
    );
  }
  return (
    <span
      className={'ce-editable-title ' + (className || '')}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      style={serif ? { fontFamily: 'var(--font-serif)' } : undefined}
    >
      {value}
    </span>
  );
}

function MasterlistSearch({ list, getLabel, getSub, onSelect, placeholder }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const filtered = useMemo(() => {
    if (!q.trim()) return list.slice(0, 6);
    const needle = q.toLowerCase();
    return list
      .filter((it) => getLabel(it).toLowerCase().includes(needle))
      .slice(0, 8);
  }, [q, list]);
  return (
    <div className="ce-combobox">
      <div className="ce-input-icon">
        <Search size={14} className="ce-input-icon-svg" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder || 'Search masterlist...'}
          className="ce-input ce-input-pad"
        />
      </div>
      {open && filtered.length > 0 && (
        <div className="ce-combobox-panel">
          {filtered.map((it) => (
            <button
              key={it.id}
              type="button"
              className="ce-combobox-item"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(it);
                setQ(getLabel(it));
                setOpen(false);
              }}
            >
              <span>{getLabel(it)}</span>
              <span className="ce-combobox-sub">{getSub(it)}</span>
            </button>
          ))}
        </div>
      )}
      {open && list.length === 0 && (
        <div className="ce-combobox-panel ce-combobox-empty">
          Masterlist is empty — add items on the Database page to enable
          autocomplete here.
        </div>
      )}
    </div>
  );
}

/* ============================= BOL GRID (with Save button) ============================= */
function emptyBOLDraft(id) {
  return {
    id,
    masterlistId: null,
    role: '',
    dayType: 'Regular',
    shift: 'Day',
    qty: '',
    days: '',
    rate: '',
    otHrs: '',
    perDiem: '',
    allowance: '',
  };
}
function useResizableColumns(storageKey, defaults) {
  const [widths, setWidths] = useState(() => {
    if (typeof window === 'undefined') return defaults;
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
    } catch {
      return defaults;
    }
  });

  const updateWidth = (key, value) => {
    setWidths((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  return { widths, updateWidth };
}

function ResizableTh({ colKey, width, onResize, children, style }) {
  const handleMouseDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const onMouseMove = (moveEvent) => {
      const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
      onResize(colKey, newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <th style={{ position: 'relative', width: `${width}px`, ...style }}>
      {children}
      <div className="ce-col-resize-handle" onMouseDown={handleMouseDown} />
    </th>
  );
}

function BOLGrid({ task, subtask, dispatch }) {
  const { BOL: masterlistBOL } = useMasterlist();
  const datalistId = useState(() => uid('dl'))[0];
  const [draftRows, setDraftRows] = useState([emptyBOLDraft(uid('bol-draft'))]);

  const allRows = useMemo(() => {
    const existing = subtask.items.BOL.map((it) => ({ ...it, isDraft: false }));
    const drafts = draftRows.map((r) => ({ ...r, isDraft: true }));
    return [...existing, ...drafts];
  }, [subtask.items.BOL, draftRows]);

  const updateRow = (row, field, value) => {
    if (!row.isDraft) {
      dispatch({
        type: 'UPDATE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOL',
        itemId: row.id,
        patch: { [field]: value },
      });
    } else {
      setDraftRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r))
      );
    }
  };

  const appendRowIfLast = (row) => {
    if (!row.isDraft) return;
    const lastDraft = draftRows[draftRows.length - 1];
    if (row.id === lastDraft.id) {
      setDraftRows((prev) => [...prev, emptyBOLDraft(uid('bol-draft'))]);
    }
  };

  const removeRow = (row) => {
    if (row.isDraft) {
      setDraftRows((prev) => {
        if (prev.length === 1) return prev;
        return prev.filter((r) => r.id !== row.id);
      });
    } else {
      dispatch({
        type: 'DELETE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOL',
        itemId: row.id,
      });
    }
  };

  const handleSave = () => {
    const newItems = draftRows
      .filter(
        (r) =>
          r.role.trim() &&
          Number(r.qty) > 0 &&
          Number(r.days) > 0 &&
          Number(r.rate) > 0
      )
      .map((r) => ({
        id: uid('bol-item'),
        masterlistId: r.masterlistId,
        role: r.role.trim(),
        dayType: r.dayType,
        shift: r.shift,
        qty: Number(r.qty),
        days: Number(r.days),
        rate: Number(r.rate),
        otHrs: Number(r.otHrs) || 0,
        perDiem: Number(r.perDiem) || 0,
        allowance: Number(r.allowance) || 0,
      }));

    if (newItems.length > 0) {
      dispatch({
        type: 'ADD_ITEMS',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOL',
        items: newItems,
      });
    }
    setDraftRows([emptyBOLDraft(uid('bol-draft'))]);
  };

  const totals = subtask.items.BOL.reduce(
    (acc, it) => {
      const c = calcBOL(it);
      acc.labor += c.labor;
      acc.benefits += c.benefits;
      acc.total += c.subtotal;
      return acc;
    },
    { labor: 0, benefits: 0, total: 0 }
  );

  return (
    <div className="ce-card ce-bol-card">
      <div className="ce-card-header">
        <span className="ce-chip">BOL — BILL OF LABOR</span>
        <div className="ce-card-header-stats">
          <span>
            Labor: <b className="ce-mono">{fmt(totals.labor)}</b>
          </span>
          <span>
            Benefits: <b className="ce-mono">{fmt(totals.benefits)}</b>
          </span>
          <b className="ce-mono ce-total">{fmt(totals.total)}</b>
        </div>
      </div>
      <datalist id={datalistId}>
        {masterlistBOL.map((l) => (
          <option key={l.id} value={l.role} />
        ))}
      </datalist>
      <div
        className="ce-gridwrap"
        style={{ maxHeight: '300px', overflowY: 'auto', overflowX: 'auto' }}
      >
        <table className="ce-grid">
          <thead>
            <tr>
              <th>Role / Position</th>
              <th>Day Type</th>
              <th>Shift</th>
              <th>Qty</th>
              <th>Days</th>
              <th>Rate/Day</th>
              <th>OT Hrs</th>
              <th>Per Diem</th>
              <th>Allowance</th>
              <th>Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row, index) => {
              const isLast = index === allRows.length - 1;
              const c = row.isDraft ? null : calcBOL(row);
              return (
                <tr
                  key={row.id}
                  className={
                    isLast && row.isDraft ? 'ce-grid-row-ghost' : undefined
                  }
                >
                  <td>
                    <input
                      className="ce-grid-input"
                      list={datalistId}
                      value={row.role}
                      placeholder={row.isDraft ? 'Type role…' : ''}
                      onChange={(e) => {
                        updateRow(row, 'role', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <select
                      className="ce-grid-select"
                      value={row.dayType}
                      onChange={(e) => {
                        updateRow(row, 'dayType', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    >
                      {DAY_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="ce-grid-select"
                      value={row.shift}
                      onChange={(e) => {
                        updateRow(row, 'shift', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    >
                      <option value="Day">Day</option>
                      <option value="Night">Night</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.qty}
                      onChange={(e) => {
                        updateRow(row, 'qty', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.days}
                      onChange={(e) => {
                        updateRow(row, 'days', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.rate}
                      onChange={(e) => {
                        updateRow(row, 'rate', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.otHrs}
                      onChange={(e) => {
                        updateRow(row, 'otHrs', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.perDiem}
                      onChange={(e) => {
                        updateRow(row, 'perDiem', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.allowance}
                      onChange={(e) => {
                        updateRow(row, 'allowance', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td className="ce-grid-subtotal">
                    {row.isDraft ? '—' : fmt(calcBOL(row).subtotal)}
                  </td>
                  <td className="ce-grid-del">
                    <IconBtn
                      danger
                      title="Remove row"
                      onClick={() => removeRow(row)}
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="ce-grid-foot">
              <td colSpan={9}>Labor Total</td>
              <td className="ce-grid-subtotal">{fmt(totals.total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="ce-form-footer">
        <div className="ce-form-footer-actions">
          <button
            className="ce-btn-ghost ce-btn-sm"
            onClick={handleSave}
            type="button"
          >
            Save BOL
          </button>
        </div>
      </div>
      <p className="ce-assumption" style={{ padding: '0 0.9rem 0.7rem' }}>
        Sun/Special ×1.30 · Holiday ×2.00 · Night differential +10% · OT premium
        ×1.25
      </p>
    </div>
  );
}

/* ============================= BOTE Form ============================= */
function BOTEForm({ task, subtask, dispatch, items }) {
  const { BOTE: masterlistBOTE } = useMasterlist();
  const datalistId = useState(() => uid('dl'))[0];
  const [draftRows, setDraftRows] = useState([
    { id: uid('bote-draft'), description: '', qty: '', days: '', rate: '' },
  ]);
  const { widths, updateWidth } = useResizableColumns('bote-col-widths', {
    itemNo: 55,
    description: 250,
    qty: 80,
    days: 80,
    rate: 110,
    subtotal: 120,
    action: 50,
  });
  const allRows = useMemo(() => {
    const existing = items.map((it) => ({ ...it, isDraft: false }));
    const drafts = draftRows.map((r) => ({ ...r, isDraft: true }));
    return [...existing, ...drafts];
  }, [items, draftRows]);

  const updateRow = (row, field, value) => {
    if (!row.isDraft) {
      dispatch({
        type: 'UPDATE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOTE',
        itemId: row.id,
        patch: { [field]: value },
      });
    } else {
      setDraftRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r))
      );
    }
  };

  const appendRowIfLast = (row) => {
    if (!row.isDraft) return;
    const lastDraft = draftRows[draftRows.length - 1];
    if (row.id === lastDraft.id) {
      setDraftRows((prev) => [
        ...prev,
        { id: uid('bote-draft'), description: '', qty: '', days: '', rate: '' },
      ]);
    }
  };

  const removeRow = (row) => {
    if (row.isDraft) {
      setDraftRows((prev) => {
        if (prev.length === 1) return prev;
        return prev.filter((r) => r.id !== row.id);
      });
    } else {
      dispatch({
        type: 'DELETE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOTE',
        itemId: row.id,
      });
    }
  };

  const handleSave = () => {
    const newItems = draftRows
      .filter(
        (r) =>
          r.description.trim() &&
          Number(r.qty) > 0 &&
          Number(r.days) > 0 &&
          Number(r.rate) > 0
      )
      .map((r) => ({
        id: uid('bote-item'),
        description: r.description.trim(),
        qty: Number(r.qty),
        days: Number(r.days),
        rate: Number(r.rate),
      }));

    if (newItems.length > 0) {
      dispatch({
        type: 'ADD_ITEMS',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOTE',
        items: newItems,
      });
    }
    setDraftRows([
      { id: uid('bote-draft'), description: '', qty: '', days: '', rate: '' },
    ]);
  };

  return (
    <div className="ce-form">
      <datalist id={datalistId}>
        {masterlistBOTE.map((l) => (
          <option key={l.id} value={l.description} />
        ))}
      </datalist>

      <div className="ce-gridwrap">
        <table className="ce-grid">
        <thead>
  <tr>
    <ResizableTh colKey="itemNo" width={widths.itemNo} onResize={updateWidth} style={{ textAlign: 'center' }}>
      Item<br />No.
    </ResizableTh>
    <ResizableTh colKey="description" width={widths.description} onResize={updateWidth}>
      Item Description
    </ResizableTh>
    <ResizableTh colKey="qty" width={widths.qty} onResize={updateWidth}>
      Qty
    </ResizableTh>
    <ResizableTh colKey="days" width={widths.days} onResize={updateWidth}>
      No. of Days
    </ResizableTh>
    <ResizableTh colKey="rate" width={widths.rate} onResize={updateWidth}>
      Daily Rate
    </ResizableTh>
    <ResizableTh colKey="subtotal" width={widths.subtotal} onResize={updateWidth}>
      Subtotal
    </ResizableTh>
    <ResizableTh colKey="action" width={widths.action} onResize={updateWidth}>
    </ResizableTh>
  </tr>
</thead>
          <tbody>
            {allRows.map((row, index) => {
              const lineTotal =
                Number(row.qty) * Number(row.days) * Number(row.rate);
              const isLast = index === allRows.length - 1;
              return (
                <tr
                  key={row.id}
                  className={
                    isLast && row.isDraft ? 'ce-grid-row-ghost' : undefined
                  }
                >
                  <td className="ce-center" style={{ fontWeight: 'bold' }}>
  {index + 1}
</td>
                  <td>
                    <input
                      className="ce-grid-input"
                      list={datalistId}
                      value={row.description}
                      placeholder={row.isDraft ? 'Type item…' : ''}
                      onChange={(e) => {
                        updateRow(row, 'description', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.qty}
                      onChange={(e) => {
                        updateRow(row, 'qty', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.days}
                      onChange={(e) => {
                        updateRow(row, 'days', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.rate}
                      onChange={(e) => {
                        updateRow(row, 'rate', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td className="ce-grid-subtotal">{fmt(lineTotal)}</td>
                  <td className="ce-grid-del">
                    <IconBtn
                      danger
                      title="Remove row"
                      onClick={() => removeRow(row)}
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ce-form-footer">
        <div className="ce-form-footer-actions">
          <button className="ce-btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================= BOCM Form ============================= */
function BOCMForm({ task, subtask, dispatch, items }) {
  const { BOCM: masterlistBOCM } = useMasterlist();
  const datalistId = useState(() => uid('dl'))[0];
  const [draftRows, setDraftRows] = useState([
    { id: uid('bocm-draft'), description: '', qty: '', unit: '', unitCost: '' },
  ]);
  const { widths, updateWidth } = useResizableColumns('bocm-col-widths', {
    itemNo: 55,
    description: 250,
    qty: 80,
    unit: 90,
    unitCost: 110,
    subtotal: 120,
    action: 50,
  });
  const allRows = useMemo(() => {
    const existing = items.map((it) => ({ ...it, isDraft: false }));
    const drafts = draftRows.map((r) => ({ ...r, isDraft: true }));
    return [...existing, ...drafts];
  }, [items, draftRows]);

  const updateRow = (row, field, value) => {
    if (!row.isDraft) {
      dispatch({
        type: 'UPDATE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOCM',
        itemId: row.id,
        patch: { [field]: value },
      });
    } else {
      setDraftRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r))
      );
    }
  };

  const appendRowIfLast = (row) => {
    if (!row.isDraft) return;
    const lastDraft = draftRows[draftRows.length - 1];
    if (row.id === lastDraft.id) {
      setDraftRows((prev) => [
        ...prev,
        {
          id: uid('bocm-draft'),
          description: '',
          qty: '',
          unit: '',
          unitCost: '',
        },
      ]);
    }
  };

  const removeRow = (row) => {
    if (row.isDraft) {
      setDraftRows((prev) => {
        if (prev.length === 1) return prev;
        return prev.filter((r) => r.id !== row.id);
      });
    } else {
      dispatch({
        type: 'DELETE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOCM',
        itemId: row.id,
      });
    }
  };

  const handleSave = () => {
    const newItems = draftRows
      .filter(
        (r) =>
          r.description.trim() && Number(r.qty) > 0 && Number(r.unitCost) > 0
      )
      .map((r) => ({
        id: uid('bocm-item'),
        description: r.description.trim(),
        qty: Number(r.qty),
        unit: r.unit.trim() || 'unit',
        unitCost: Number(r.unitCost),
      }));

    if (newItems.length > 0) {
      dispatch({
        type: 'ADD_ITEMS',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'BOCM',
        items: newItems,
      });
    }
    setDraftRows([
      {
        id: uid('bocm-draft'),
        description: '',
        qty: '',
        unit: '',
        unitCost: '',
      },
    ]);
  };

  return (
    <div className="ce-form">
      <datalist id={datalistId}>
        {masterlistBOCM.map((l) => (
          <option key={l.id} value={l.description} />
        ))}
      </datalist>

      <div className="ce-gridwrap">
        <table className="ce-grid">
        <thead>
  <tr>
    <ResizableTh colKey="itemNo" width={widths.itemNo} onResize={updateWidth} style={{ textAlign: 'center' }}>
      Item<br />No.
    </ResizableTh>
    <ResizableTh colKey="description" width={widths.description} onResize={updateWidth}>
      Item Description
    </ResizableTh>
    <ResizableTh colKey="qty" width={widths.qty} onResize={updateWidth}>
      Qty
    </ResizableTh>
    <ResizableTh colKey="unit" width={widths.unit} onResize={updateWidth}>
      Unit
    </ResizableTh>
    <ResizableTh colKey="unitCost" width={widths.unitCost} onResize={updateWidth}>
      Unit Cost
    </ResizableTh>
    <ResizableTh colKey="subtotal" width={widths.subtotal} onResize={updateWidth}>
      Subtotal
    </ResizableTh>
    <ResizableTh colKey="action" width={widths.action} onResize={updateWidth}>
    </ResizableTh>
  </tr>
</thead>
          <tbody>
            {allRows.map((row, index) => {
              const lineTotal = Number(row.qty) * Number(row.unitCost);
              const isLast = index === allRows.length - 1;
              return (
                <tr
                  key={row.id}
                  className={
                    isLast && row.isDraft ? 'ce-grid-row-ghost' : undefined
                  }
                >
                  <td className="ce-center" style={{ fontWeight: 'bold' }}>
  {index + 1}
</td>
                  <td>
                    <input
                      className="ce-grid-input"
                      list={datalistId}
                      value={row.description}
                      placeholder={row.isDraft ? 'Type item…' : ''}
                      onChange={(e) => {
                        updateRow(row, 'description', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.qty}
                      onChange={(e) => {
                        updateRow(row, 'qty', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      className="ce-grid-input"
                      value={row.unit}
                      placeholder={row.isDraft ? 'kg / gal / pc' : ''}
                      onChange={(e) => {
                        updateRow(row, 'unit', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.unitCost}
                      onChange={(e) => {
                        updateRow(row, 'unitCost', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td className="ce-grid-subtotal">{fmt(lineTotal)}</td>
                  <td className="ce-grid-del">
                    <IconBtn
                      danger
                      title="Remove row"
                      onClick={() => removeRow(row)}
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ce-form-footer">
        <div className="ce-form-footer-actions">
          <button className="ce-btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================= PPE Form ============================= */
function PPEForm({ task, subtask, dispatch, items }) {
  const { PPE: masterlistPPE } = useMasterlist();
  const datalistId = useState(() => uid('dl'))[0];
  const [draftRows, setDraftRows] = useState([
    { id: uid('ppe-draft'), item: '', qty: '', unitCost: '' },
  ]);
  const { widths, updateWidth } = useResizableColumns('ppe-col-widths', {
    itemNo: 55,
    item: 250,
    qty: 80,
    unitCost: 110,
    subtotal: 120,
    action: 50,
  });
  const allRows = useMemo(() => {
    const existing = items.map((it) => ({ ...it, isDraft: false }));
    const drafts = draftRows.map((r) => ({ ...r, isDraft: true }));
    return [...existing, ...drafts];
  }, [items, draftRows]);

  const updateRow = (row, field, value) => {
    if (!row.isDraft) {
      dispatch({
        type: 'UPDATE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'PPE',
        itemId: row.id,
        patch: { [field]: value },
      });
    } else {
      setDraftRows((prev) =>
        prev.map((r) => (r.id === row.id ? { ...r, [field]: value } : r))
      );
    }
  };

  const appendRowIfLast = (row) => {
    if (!row.isDraft) return;
    const lastDraft = draftRows[draftRows.length - 1];
    if (row.id === lastDraft.id) {
      setDraftRows((prev) => [
        ...prev,
        { id: uid('ppe-draft'), item: '', qty: '', unitCost: '' },
      ]);
    }
  };

  const removeRow = (row) => {
    if (row.isDraft) {
      setDraftRows((prev) => {
        if (prev.length === 1) return prev;
        return prev.filter((r) => r.id !== row.id);
      });
    } else {
      dispatch({
        type: 'DELETE_ITEM',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'PPE',
        itemId: row.id,
      });
    }
  };

  const handleSave = () => {
    const newItems = draftRows
      .filter(
        (r) => r.item.trim() && Number(r.qty) > 0 && Number(r.unitCost) > 0
      )
      .map((r) => ({
        id: uid('ppe-item'),
        item: r.item.trim(),
        qty: Number(r.qty),
        unitCost: Number(r.unitCost),
      }));

    if (newItems.length > 0) {
      dispatch({
        type: 'ADD_ITEMS',
        taskId: task.id,
        subtaskId: subtask.id,
        category: 'PPE',
        items: newItems,
      });
    }
    setDraftRows([{ id: uid('ppe-draft'), item: '', qty: '', unitCost: '' }]);
  };

  return (
    <div className="ce-form">
      <datalist id={datalistId}>
        {masterlistPPE.map((l) => (
          <option key={l.id} value={l.item} />
        ))}
      </datalist>

      <div className="ce-gridwrap">
        <table className="ce-grid">
        <thead>
  <tr>
    <ResizableTh colKey="itemNo" width={widths.itemNo} onResize={updateWidth} style={{ textAlign: 'center' }}>
      Item<br />No.
    </ResizableTh>
    <ResizableTh colKey="item" width={widths.item} onResize={updateWidth}>
      Item Description
    </ResizableTh>
    <ResizableTh colKey="qty" width={widths.qty} onResize={updateWidth}>
      Qty (pax)
    </ResizableTh>
    <ResizableTh colKey="unitCost" width={widths.unitCost} onResize={updateWidth}>
      Unit Cost
    </ResizableTh>
    <ResizableTh colKey="subtotal" width={widths.subtotal} onResize={updateWidth}>
      Subtotal
    </ResizableTh>
    <ResizableTh colKey="action" width={widths.action} onResize={updateWidth}>
    </ResizableTh>
  </tr>
</thead>
          <tbody>
            {allRows.map((row, index) => {
              const lineTotal = Number(row.qty) * Number(row.unitCost);
              const isLast = index === allRows.length - 1;
              return (
                <tr
                  key={row.id}
                  className={
                    isLast && row.isDraft ? 'ce-grid-row-ghost' : undefined
                  }
                >
                  <td className="ce-center" style={{ fontWeight: 'bold' }}>
  {index + 1}
</td>
                  <td>
                    <input
                      className="ce-grid-input"
                      list={datalistId}
                      value={row.item}
                      placeholder={row.isDraft ? 'Type PPE item…' : ''}
                      onChange={(e) => {
                        updateRow(row, 'item', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.qty}
                      onChange={(e) => {
                        updateRow(row, 'qty', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-grid-input"
                      value={row.unitCost}
                      onChange={(e) => {
                        updateRow(row, 'unitCost', e.target.value);
                        appendRowIfLast(row);
                      }}
                      onFocus={() => appendRowIfLast(row)}
                    />
                  </td>
                  <td className="ce-grid-subtotal">{fmt(lineTotal)}</td>
                  <td className="ce-grid-del">
                    <IconBtn
                      danger
                      title="Remove row"
                      onClick={() => removeRow(row)}
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ce-form-footer">
        <div className="ce-form-footer-actions">
          <button className="ce-btn-primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================= BREAKDOWN MISC PANEL (FIXED) ============================= */
const MISC_PRELOAD = [
  {
    section: 'A',
    title: 'ACCOMMODATION',
    items: [
      'House Rental (Admin)',
      'House Rental (Manpower)',
      'Electric Fan',
      'Dispenser',
      'Refill',
      'Dues',
      'Hotel',
      'Foam',
      'Water',
      'Meal Allowance',
    ],
  },
  {
    section: 'B',
    title: 'TRANSPORTATION (DAILY)',
    items: [
      'Diesel',
      'Vehicle Hilux/Pickup (PM)',
      'Vehicle Hilux/Pickup (Admin)',
      'Vehicle Van (Admin)',
      'Vehicle Traviz/L300 (Admin) — Isuzu Traviz',
      'Vehicle Traviz/L300 (Manpower) — Isuzu Traviz',
    ],
  },
  {
    section: 'C',
    title: 'REQUIREMENTS',
    items: ['Medical', 'Brgy. Clearance', 'Police Clearance', 'NBI Clearance'],
  },
  {
    section: 'D',
    title: 'ADMIN COST',
    items: [
      'Office Supplies',
      'Janitorial Supplies',
      'Site Inspection (Pre-Bid)',
      'Vehicle Traviz (Site Inspection) — Isuzu Traviz',
      'Diesel (Site Inspection)',
      'Toll Fee (Site Inspection)',
      'Meal Allowance',
      'Representation',
      'Bank Charges',
    ],
  },
  {
    section: 'E',
    title: 'THIRD PARTY SERVICES',
    items: ['Third Party Services (as required)'],
  },
];

function BreakdownMiscPanel({ task, subtask, dispatch, open, onToggle }) {
  const { widths, updateWidth } = useResizableColumns(
    'misc-breakdown-col-widths',
    {
      itemNo: 55,
      description: 250,
      qty: 80,
      unit: 90,
      unitPrice: 110,
      total: 120,
      action: 50,
    }
  );
  const [draftRows, setDraftRows] = useState(() => {
    const existing = subtask.items.MISC || [];
    if (existing.length > 0 && existing[0].section) {
      return existing;
    }
    const flat = [];
    MISC_PRELOAD.forEach((sec) =>
      sec.items.forEach((desc, idx) =>
        flat.push({
          id: uid(`misc-${sec.section}-${idx}`),
          section: sec.section,
          sectionTitle: sec.title,
          description: desc,
          qty: 0,
          unitCost: 0,
          days: 1,
        })
      )
    );
    return flat;
  });

  const [hideSections, setHideSections] = useState({});
  const [expandedSections, setExpandedSections] = useState({});

  const updateRow = (id, patch) => {
    setDraftRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };
  function removeRow(id) {
    setDraftRows((rows) => rows.filter((r) => r.id !== id));
  }
  const insertRowBelow = (afterId) => {
    setDraftRows((rows) => {
      const idx = rows.findIndex((r) => r.id === afterId);
      if (idx === -1) return rows;
      const afterRow = rows[idx];
      const newRow = {
        id: uid(`misc-insert-${afterRow.section}`),
        section: afterRow.section,
        sectionTitle: afterRow.sectionTitle,
        description: '',
        qty: 0,
        unitCost: 0,
        days: 1,
      };
      const next = [...rows];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  const saveGroup = (section) => {
    const groupRows = draftRows.filter((r) => r.section === section);
    dispatch({
      type: 'REPLACE_CATEGORY_ITEMS',
      taskId: task.id,
      subtaskId: subtask.id,
      category: 'MISC',
      items: groupRows,
    });
  };

  const grouped = MISC_PRELOAD.map((sec) => {
    const allRows = draftRows.filter((r) => r.section === sec.section);
    const visibleRows = hideSections[sec.section]
      ? allRows.filter(
          (r) => num(r.qty) !== 0 || num(r.unitCost) !== 0 || num(r.days) !== 1
        )
      : allRows;
    const isExpanded = expandedSections[sec.section] || false;
    const displayRows = isExpanded ? visibleRows : [];
    return {
      ...sec,
      rows: displayRows,
      totalRows: visibleRows.length,
      isExpanded,
    };
  });

  return (
    <div className="ce-card">
      <div
        className="ce-card-header ce-card-header-compact ce-accordion-header"
        onClick={onToggle}
        style={{ cursor: 'pointer' }}
      >
        <span className="ce-chip">MISC — BREAKDOWN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <b className="ce-mono">{fmt(categoryTotal(draftRows, 'MISC'))}</b>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
      </div>
      {open && (
        <div className="ce-subtask-body" style={{ padding: '0.85rem' }}>
          {grouped.map((sec) => {
            const showDays =
              sec.section === 'B' || sec.section === 'D' || sec.section === 'E';
            return (
              <div key={sec.section} className="misc-group">
                <div className="misc-group-header">
                  <button
                    className="misc-expand-btn"
                    onClick={() =>
                      setExpandedSections((prev) => ({
                        ...prev,
                        [sec.section]: !prev[sec.section],
                      }))
                    }
                    type="button"
                  >
                    {sec.isExpanded ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    <span className="ce-serif misc-group-title">
                      {sec.section}. {sec.title}
                    </span>
                    {!sec.isExpanded && sec.totalRows > 0 && (
                      <span className="misc-collapsed-hint">
                        +{sec.totalRows} more
                      </span>
                    )}
                  </button>
                  <div className="misc-group-actions">
                    <button
                      className="ce-btn-ghost ce-btn-sm"
                      onClick={() => saveGroup(sec.section)}
                      type="button"
                    >
                      Save Group
                    </button>
                    <button
                      className="ce-btn-ghost ce-btn-sm misc-hide-btn"
                      onClick={() =>
                        setHideSections((prev) => ({
                          ...prev,
                          [sec.section]: !prev[sec.section],
                        }))
                      }
                      type="button"
                    >
                      {hideSections[sec.section] ? 'Show All' : 'Hide Unused'}
                    </button>
                  </div>
                </div>

                <div className="ce-table-scroll">
                  <table className="ce-table misc-table">
                  <thead>
  <tr>
    <ResizableTh colKey="itemNo" width={widths.itemNo} onResize={updateWidth} style={{ textAlign: 'center' }}>
      Item<br />No.
    </ResizableTh>
    <ResizableTh colKey="description" width={widths.description} onResize={updateWidth}>
      Description
    </ResizableTh>
    <ResizableTh colKey="qty" width={widths.qty} onResize={updateWidth}>
      QTY
    </ResizableTh>
    {sec.section === 'A' && (
      <ResizableTh colKey="unit" width={widths.unit} onResize={updateWidth}>
        UNIT
      </ResizableTh>
    )}
    <ResizableTh colKey="unitPrice" width={widths.unitPrice} onResize={updateWidth}>
      Unit Price
    </ResizableTh>
    {showDays && (
      <th className="ce-right" style={{ width: '100px' }}>No. of Days</th>
    )}
    <ResizableTh colKey="total" width={widths.total} onResize={updateWidth}>
      Total
    </ResizableTh>
    <ResizableTh colKey="action" width={widths.action} onResize={updateWidth}>
    </ResizableTh>
  </tr>
</thead>
                    <tbody>
                      {sec.rows.map((r, idx) => {
                        const lineTotal = showDays
                          ? num(r.qty) * num(r.days) * num(r.unitCost)
                          : num(r.qty) * num(r.unitCost);
                        return (
                          <tr key={r.id}>
                            <td className="ce-center">{idx + 1}</td>
                            <td>
                              <input
                                className="ce-input misc-desc-input"
                                value={r.description}
                                onChange={(e) =>
                                  updateRow(r.id, {
                                    description: e.target.value,
                                  })
                                }
                                placeholder="Description"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="ce-input ce-right misc-qty-input"
                                value={r.qty}
                                onChange={(e) =>
                                  updateRow(r.id, { qty: e.target.value })
                                }
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                className="ce-input ce-right misc-unit-input"
                                value={r.unitCost}
                                onChange={(e) =>
                                  updateRow(r.id, { unitCost: e.target.value })
                                }
                              />
                            </td>
                            {showDays && (
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  className="ce-input ce-right misc-days-input"
                                  value={r.days}
                                  onChange={(e) =>
                                    updateRow(r.id, { days: e.target.value })
                                  }
                                />
                              </td>
                            )}
                            <td className="ce-right ce-mono misc-total-cell">
                              {fmt(lineTotal)}
                            </td>
                            <td>
                              <button
                                className="ce-btn-ghost ce-btn-sm misc-insert-btn"
                                onClick={() => insertRowBelow(r.id)}
                                type="button"
                                title="Insert row below"
                              >
                                <Plus size={13} /> Insert
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================= CATEGORY CARDS ============================= */
function CategoryCard({ category, task, subtask, dispatch }) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const items = subtask.items[category];
  const total = categoryTotal(items, category);
  const [open, setOpen] = useState(false); // local state for collapse

  const toggleOpen = () => setOpen(!open);

  // For BOL, BOTE, BOCM, PPE
  if (['BOL', 'BOTE', 'BOCM', 'PPE'].includes(category)) {
    return (
      <div className="ce-card">
        <div
          className="ce-card-header ce-card-header-compact ce-accordion-header"
          onClick={toggleOpen}
          style={{ cursor: 'pointer' }}
        >
          <span className="ce-chip">
            <Icon size={11} style={{ marginRight: 4, verticalAlign: -2 }} />
            {meta.short}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <b className="ce-mono">{fmt(total)}</b>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
        </div>
        {open && (
          <>
            {category === 'BOL' && (
              <BOLGrid task={task} subtask={subtask} dispatch={dispatch} />
            )}
            {category === 'BOTE' && (
              <BOTEForm
                task={task}
                subtask={subtask}
                dispatch={dispatch}
                items={items}
              />
            )}
            {category === 'BOCM' && (
              <BOCMForm
                task={task}
                subtask={subtask}
                dispatch={dispatch}
                items={items}
              />
            )}
            {category === 'PPE' && (
              <PPEForm
                task={task}
                subtask={subtask}
                dispatch={dispatch}
                items={items}
              />
            )}
          </>
        )}
      </div>
    );
  }

  // For MISC, pass open and onToggle to BreakdownMiscPanel
  if (category === 'MISC') {
    return (
      <BreakdownMiscPanel
        task={task}
        subtask={subtask}
        dispatch={dispatch}
        open={open}
        onToggle={toggleOpen}
      />
    );
  }

  return null;
}

/* ============================= SUBTASK / TASK / BREAKDOWN ============================= */
function SubtaskCard({ task, subtask, dispatch }) {
  const total = subtaskTotal(subtask);
  const duration = useMemo(() => {
    let maxDays = 0;
    CATS.forEach((c) => {
      (subtask.items[c] || []).forEach((it) => {
        if (num(it.days) > maxDays) maxDays = num(it.days);
      });
    });
    return maxDays || 1;
  }, [subtask.items]);

  const parentSubtasks = task.subtasks.filter((s) => s.id !== subtask.id);

  return (
    <div className="ce-subtask">
      <div
        className="ce-subtask-header"
        onClick={() =>
          dispatch({
            type: 'TOGGLE_SUBTASK',
            taskId: task.id,
            subtaskId: subtask.id,
          })
        }
      >
        <div className="ce-subtask-header-left">
          {subtask.expanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
          <span onClick={(e) => e.stopPropagation()}>
            <EditableTitle
              value={subtask.title}
              onSave={(v) =>
                dispatch({
                  type: 'RENAME_SUBTASK',
                  taskId: task.id,
                  subtaskId: subtask.id,
                  title: v,
                })
              }
              className="ce-subtask-title"
            />
          </span>
          <span className="ce-task-count">
            ({duration} day{duration !== 1 ? 's' : ''})
          </span>
        </div>
        <div
          className="ce-subtask-header-right"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            value={subtask.type}
            onChange={(e) =>
              dispatch({
                type: 'SET_SUBTASK_TYPE',
                taskId: task.id,
                subtaskId: subtask.id,
                subtaskType: e.target.value,
              })
            }
            className="ce-task-type-select"
          >
            <option value="Sequential">Sequential</option>
            <option value="Parallel">Parallel</option>
          </select>
          <select
            value={subtask.predecessor || ''}
            onChange={(e) =>
              dispatch({
                type: 'SET_SUBTASK_PREDECESSOR',
                taskId: task.id,
                subtaskId: subtask.id,
                predecessorId: e.target.value || null,
              })
            }
            className="ce-task-type-select"
          >
            <option value="">None</option>
            {parentSubtasks.map((ps) => (
              <option key={ps.id} value={ps.id}>
                {ps.title}
              </option>
            ))}
          </select>
          <b className="ce-mono ce-total">{fmt(total)}</b>
          <IconBtn
            danger
            title="Delete subtask"
            onClick={() =>
              dispatch({
                type: 'DELETE_SUBTASK',
                taskId: task.id,
                subtaskId: subtask.id,
              })
            }
          >
            <Trash2 size={15} />
          </IconBtn>
        </div>
      </div>
      {subtask.expanded && (
        <div className="ce-subtask-body">
          <div className="ce-cat-stack">
            {['BOL', 'BOTE', 'BOCM', 'PPE', 'MISC'].map((c) => (
              <div className="ce-cat-item" key={c}>
                <CategoryCard
                  category={c}
                  task={task}
                  subtask={subtask}
                  dispatch={dispatch}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskAccordion({ t, dispatch, allTasks }) {
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const total = taskTotal(t);
  function submitSubtask() {
    const title = subtaskTitle.trim();
    if (!title) {
      setAddingSubtask(false);
      return;
    }
    dispatch({ type: 'ADD_SUBTASK', taskId: t.id, title });
    setSubtaskTitle('');
    setAddingSubtask(false);
  }
  return (
    <div className="ce-card ce-task">
      <div
        className="ce-task-header"
        onClick={() => dispatch({ type: 'TOGGLE_TASK', taskId: t.id })}
      >
        <div className="ce-task-header-left">
          {t.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <span onClick={(e) => e.stopPropagation()}>
            <EditableTitle
              value={t.title}
              onSave={(v) =>
                dispatch({ type: 'RENAME_TASK', taskId: t.id, title: v })
              }
              className="ce-task-title"
              serif
            />
          </span>
          <span className="ce-task-count">
            {t.subtasks.length} item{t.subtasks.length === 1 ? '' : 's'}
          </span>
        </div>
        <div
          className="ce-task-header-right"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="number"
            min="0"
            value={t.duration}
            onChange={(e) =>
              dispatch({
                type: 'SET_TASK_DURATION',
                taskId: t.id,
                duration: e.target.value,
              })
            }
            placeholder="Days"
            className="ce-task-duration-input"
          />
          <select
            value={t.predecessor || ''}
            onChange={(e) =>
              dispatch({
                type: 'SET_TASK_PREDECESSOR',
                taskId: t.id,
                predecessorId: e.target.value || null,
              })
            }
            className="ce-task-type-select"
          >
            <option value="">None</option>
            {allTasks
              .filter((other) => other.id !== t.id)
              .map((other) => (
                <option key={other.id} value={other.id}>
                  {other.title}
                </option>
              ))}
          </select>
          <b className="ce-mono ce-total ce-total-lg">{fmt(total)}</b>
          <button
            className="ce-btn-ghost ce-btn-sm"
            onClick={() => setAddingSubtask(true)}
            type="button"
          >
            <Plus size={13} /> Subtask
          </button>
          <IconBtn
            danger
            title="Delete task"
            onClick={() => dispatch({ type: 'DELETE_TASK', taskId: t.id })}
          >
            <Trash2 size={16} />
          </IconBtn>
        </div>
      </div>
      {t.expanded && (
        <div className="ce-task-body">
          {t.subtasks.map((s) => (
            <SubtaskCard key={s.id} task={t} subtask={s} dispatch={dispatch} />
          ))}
          {addingSubtask && (
            <div className="ce-inline-add">
              <input
                autoFocus
                className="ce-input"
                placeholder="Subtask title"
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitSubtask();
                  if (e.key === 'Escape') setAddingSubtask(false);
                }}
              />
              <button
                className="ce-btn-primary ce-btn-sm"
                onClick={submitSubtask}
                type="button"
              >
                Add
              </button>
              <button
                className="ce-btn-ghost ce-btn-sm"
                onClick={() => setAddingSubtask(false)}
                type="button"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownView({ tasks, dispatch, goToLibrary, goToSearch }) {
  const [addingTask, setAddingTask] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  function submitTask() {
    const title = titleDraft.trim();
    if (!title) {
      setAddingTask(false);
      return;
    }
    dispatch({ type: 'ADD_TASK', title });
    setTitleDraft('');
    setAddingTask(false);
  }
  return (
    <div>
      <div className="ce-section-header">
        <h2 className="ce-serif ce-section-title">Task breakdown</h2>
        <button
          className="ce-btn-ghost"
          onClick={() => setAddingTask(true)}
          type="button"
        >
          <Plus size={15} /> Add task
        </button>
      </div>
      <div className="ce-tasks">
        {tasks.map((t) => (
          <TaskAccordion
            key={t.id}
            t={t}
            dispatch={dispatch}
            allTasks={tasks}
          />
        ))}
        {tasks.length === 0 && !addingTask && (
          <div className="ce-empty ce-empty-lg">
            <p>No tasks yet — add your first task to begin the breakdown.</p>
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                justifyContent: 'center',
                marginTop: '0.75rem',
              }}
            >
              <button
                className="ce-btn-ghost ce-btn-sm"
                onClick={goToLibrary}
                type="button"
              >
                Load from Scope Library
              </button>
              <button
                className="ce-btn-ghost ce-btn-sm"
                onClick={goToSearch}
                type="button"
              >
                Import from Previous CE
              </button>
            </div>
          </div>
        )}
        {addingTask && (
          <div className="ce-card ce-inline-add ce-inline-add-lg">
            <input
              autoFocus
              className="ce-input"
              placeholder="Task title (e.g. Turbine Overhaul)"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitTask();
                if (e.key === 'Escape') setAddingTask(false);
              }}
            />
            <button
              className="ce-btn-primary ce-btn-sm"
              onClick={submitTask}
              type="button"
            >
              Add
            </button>
            <button
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => setAddingTask(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================= SCHEDULING ENGINE ============================= */
function computeSchedule(tasks) {
  const visitedTasks = new Set();
  const visitingTasks = new Set();
  const taskSchedule = {};

  function visitTask(taskId) {
    if (visitedTasks.has(taskId)) return;
    if (visitingTasks.has(taskId)) return;
    visitingTasks.add(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      visitingTasks.delete(taskId);
      return;
    }
    if (task.predecessor) {
      visitTask(task.predecessor);
    }
    visitingTasks.delete(taskId);
    visitedTasks.add(taskId);
    const predEnd = task.predecessor
      ? taskSchedule[task.predecessor]?.end ?? 0
      : 0;
    const start = predEnd + 1;
    const duration = Math.max(1, Number(task.duration) || 1);
    taskSchedule[task.id] = {
      start,
      end: start + duration - 1,
      duration,
    };
  }

  tasks.forEach((t) => visitTask(t.id));

  const subtaskSchedule = {};

  tasks.forEach((task) => {
    const tStart = taskSchedule[task.id]?.start || 0;
    const visitedSub = new Set();
    const visitingSub = new Set();

    function visitSubtask(subtaskId) {
      if (visitedSub.has(subtaskId)) return;
      if (visitingSub.has(subtaskId)) return;
      visitingSub.add(subtaskId);
      const subtask = task.subtasks.find((s) => s.id === subtaskId);
      if (!subtask) {
        visitingSub.delete(subtaskId);
        return;
      }
      if (subtask.predecessor) {
        visitSubtask(subtask.predecessor);
      }
      visitingSub.delete(subtaskId);
      visitedSub.add(subtaskId);
      const predEnd = subtask.predecessor
        ? subtaskSchedule[`${task.id}:${subtask.predecessor}`]?.end ??
          tStart - 1
        : tStart - 1;
      let start;
      if (subtask.type === 'Parallel') {
        start = predEnd + 1; // same as predecessor end +1 = start at same day? Actually should start at predecessor's start if parallel? We'll assume parallel starts at predecessor start.
        const predStart = subtask.predecessor
          ? subtaskSchedule[`${task.id}:${subtask.predecessor}`]?.start ??
            tStart
          : tStart;
        start = predStart;
      } else {
        start = predEnd + 1;
      }
      let duration = 0;
      CATS.forEach((c) => {
        (subtask.items[c] || []).forEach((it) => {
          if (num(it.days) > duration) duration = num(it.days);
        });
      });
      if (duration < 1) duration = 1;
      subtaskSchedule[`${task.id}:${subtask.id}`] = {
        start,
        end: start + duration - 1,
        duration,
        taskId: task.id,
      };
    }

    task.subtasks.forEach((s) => visitSubtask(s.id));
  });

  return { taskSchedule, subtaskSchedule };
}

function computePeakByCategory(tasks, category) {
  const { subtaskSchedule } = computeSchedule(tasks);
  let maxCost = 0;
  const days = {};
  tasks.forEach((t) => {
    t.subtasks.forEach((s) => {
      const sched = subtaskSchedule[`${t.id}:${s.id}`];
      if (!sched) return;
      const cost = categoryTotal(s.items[category] || [], category);
      for (let d = sched.start; d <= sched.end; d++) {
        days[d] = (days[d] || 0) + cost;
        if (days[d] > maxCost) maxCost = days[d];
      }
    });
  });
  return maxCost;
}
// Returns { maxDailyQty, activeDays, totalQuantity } for a whole category.
function getResourceSummary(tasks, category) {
  const { subtaskSchedule } = computeSchedule(tasks);
  const maxDay = Object.values(subtaskSchedule).reduce(
    (max, s) => Math.max(max, s.end),
    0
  );
  const dailyQty = Array(maxDay).fill(0);
  const dailyActive = Array(maxDay).fill(false);

  tasks.forEach((t) => {
    t.subtasks.forEach((st) => {
      const sched = subtaskSchedule[`${t.id}:${st.id}`];
      if (!sched) return;
      const items = st.items[category] || [];
      if (items.length === 0) return;
      const qtySum = items.reduce((sum, it) => sum + num(it.qty), 0);
      for (let d = sched.start; d <= sched.end; d++) {
        dailyQty[d - 1] += qtySum;
        dailyActive[d - 1] = true;
      }
    });
  });

  return {
    maxDailyQty: Math.max(0, ...dailyQty),
    activeDays: dailyActive.filter(Boolean).length,
    totalQuantity: dailyQty.reduce((s, q) => s + q, 0),
  };
}
// Returns array of { description, maxDailyQty, days, totalQty } for each unique item.
function getItemizedResourceSummary(tasks, category) {
  const { subtaskSchedule } = computeSchedule(tasks);
  const maxDay = Object.values(subtaskSchedule).reduce(
    (max, s) => Math.max(max, s.end),
    0
  );
  const itemInfo = {}; // key -> { dailyQty: number[], days: Set }

  tasks.forEach((t) => {
    t.subtasks.forEach((st) => {
      const sched = subtaskSchedule[`${t.id}:${st.id}`];
      if (!sched) return;
      (st.items[category] || []).forEach((it) => {
        const desc = category === 'PPE' ? it.item : it.description;
        if (!desc) return;
        if (!itemInfo[desc]) {
          itemInfo[desc] = {
            dailyQty: Array(maxDay).fill(0),
            days: new Set(),
          };
        }
        const qty = num(it.qty);
        for (let d = sched.start; d <= sched.end; d++) {
          itemInfo[desc].dailyQty[d - 1] += qty;
          itemInfo[desc].days.add(d);
        }
      });
    });
  });

  return Object.entries(itemInfo).map(([desc, info]) => ({
    description: desc,
    maxDailyQty: Math.max(0, ...info.dailyQty),
    days: info.days.size,
    totalQty: info.dailyQty.reduce((s, q) => s + q, 0),
  }));
}
// Returns a map keyed by item description (or role for BOL) to:
// { maxDailyQty, activeDays, totalQty }
function getScheduledItemMap(tasks, category) {
  const { subtaskSchedule } = computeSchedule(tasks);
  const maxDay = Object.values(subtaskSchedule).reduce(
    (max, s) => Math.max(max, s.end),
    0
  );
  const itemMap = {};

  tasks.forEach((t) => {
    t.subtasks.forEach((st) => {
      const sched = subtaskSchedule[`${t.id}:${st.id}`];
      if (!sched) return;

      (st.items[category] || []).forEach((it) => {
        const key =
          category === 'BOL'
            ? `${it.role}~${it.dayType || 'Regular'}~${it.shift || 'Day'}`
            : category === 'PPE'
            ? it.item
            : it.description;

        if (!key) return;
        if (!itemMap[key]) {
          itemMap[key] = {
            dailyQty: Array(maxDay).fill(0),
            days: new Set(),
          };
        }
        const qty = num(it.qty);
        for (let d = sched.start; d <= sched.end; d++) {
          itemMap[key].dailyQty[d - 1] += qty;
          itemMap[key].days.add(d);
        }
      });
    });
  });

  const result = {};
  Object.entries(itemMap).forEach(([key, data]) => {
    result[key] = {
      maxDailyQty: Math.max(0, ...data.dailyQty),
      activeDays: data.days.size,
      totalQty: data.dailyQty.reduce((s, q) => s + q, 0),
    };
  });
  return result;
}
/* ============================= SUMMARY VIEW ============================= */
function SummaryView({ tasks, viewType }) {
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  // Standard labels for the category bars (adjust to match your actual categories)
  const standardCategories = [
    'A. Mobilization',
    'B. Regular',
    'C. Overtime',
    'D. Tools & Equipment',
    'E. Consumables',
    'F. PPE',
    'G. Misc',
  ];

  const displayCategories =
    viewType === 'Breakdown'
      ? standardCategories.map((stdLabel, index) => {
          // Only replace indices 2–5 with task titles if tasks exist
          if (index >= 2 && index <= 5 && tasks[index - 2]) {
            return tasks[index - 2].title; // string
          }
          return stdLabel; // always a string
        })
      : standardCategories;

  const grandTotal = tasks.reduce((s, t) => s + taskTotal(t), 0);

  const catTotals = CATS.map((c) => ({
    cat: c,
    total: tasks.reduce(
      (s, t) =>
        s +
        t.subtasks.reduce((s2, st) => s2 + categoryTotal(st.items[c], c), 0),
      0
    ),
    peak: computePeakByCategory(tasks, c),
  }));

  const maxCat = Math.max(1);
  const isBreakdownTaskIndex = (index) =>
    viewType === 'Breakdown' && index >= 2 && index <= 5 && tasks[index - 2];
  return (
    <div>
      <div className="ce-card ce-summary-hero">
        <span className="ce-field-label">Project Total Cost</span>
        <div className="ce-mono ce-summary-grand"></div>
      </div>

      <div className="ce-card ce-summary-block">
        <h3 className="ce-serif ce-summary-heading">Cost by category</h3>
        {viewType === 'Breakdown' ? (
          tasks.length === 0 ? (
            <div className="ce-empty ce-empty-lg">
              No tasks available. Please add tasks in the Breakdown tab.
            </div>
          ) : (
            <div className="ce-accordion">
              {tasks.map((task) => {
                const isExpanded = expandedTaskId === task.id;
                return (
                  <div key={task.id} className="ce-accordion-item">
                    <button
                      type="button"
                      className="ce-accordion-header"
                      onClick={() =>
                        setExpandedTaskId(isExpanded ? null : task.id)
                      }
                    >
                      <span className="ce-accordion-title">{task.title}</span>
                      <span className="ce-accordion-icon">
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {isExpanded && task.subtasks.length > 0 && (
                      <ul className="ce-accordion-subtasks">
                        {task.subtasks.map((sub) => (
                          <li key={sub.id}>{sub.title}</li>
                        ))}
                      </ul>
                    )}
                    {isExpanded && task.subtasks.length === 0 && (
                      <div className="ce-accordion-empty">No subtasks yet.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <table className="ce-table ce-summary-category-table">
            <thead>
              <tr>
                <th>CATEGORY</th>
                <th>DESCRIPTION</th>
                <th>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {catTotals.map(({ cat, total }, index) => {
                const label = String(
                  displayCategories[index] || CATEGORY_META[cat].short || ''
                );
                const letter = label.match(/^[A-Z]\./)
                  ? label[0]
                  : String.fromCharCode(65 + index);
                const description = label.replace(/^[A-Z]\.\s*/, '');
                return (
                  <tr key={cat}>
                    <td>{letter}</td>
                    <td>{description}</td>
                    <td className="ce-right ce-mono">{fmt(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="ce-card ce-summary-block">
        <h3 className="ce-serif ce-summary-heading">Cost by task</h3>
        <table className="ce-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Subtasks</th>
              <th className="ce-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id}>
                <td>{t.title}</td>
                <td>{t.subtasks.length}</td>
                <td className="ce-right ce-mono">{fmt(taskTotal(t))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}></td>
              <td className="ce-right ce-mono ce-total">{fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
/* ============================= BOL MASTER SUMMARY ============================= */
function BOLMasterSummary({ tasks }) {
  const allBOL = [];
  tasks.forEach((t) =>
    t.subtasks.forEach((s) =>
      (s.items.BOL || []).forEach((it) => allBOL.push(it))
    )
  );

  const scheduleMap = getScheduledItemMap(tasks, 'BOL');

  const groups = {};
  DAY_TYPES.forEach((dt) => {
    groups[dt] = { Day: {}, Night: {} };
  });

  // Build groups using schedule-aware quantities
  allBOL.forEach((it) => {
    const dt = it.dayType || 'Regular';
    const shift = it.shift || 'Day';
    const role = it.role || 'Unnamed';
    const key = `${role}~${dt}~${shift}`;
    const sched = scheduleMap[key] || { maxDailyQty: 0, activeDays: 0 };

    if (!groups[dt]) groups[dt] = { Day: {}, Night: {} };
    if (!groups[dt][shift]) groups[dt][shift] = {};
    if (!groups[dt][shift][role])
      groups[dt][shift][role] = {
        role,
        qty: 0,
        days: 0,
        rate: num(it.rate),
        otHrs: num(it.otHrs),
        subtotal: 0,
        count: 0,
      };
    const entry = groups[dt][shift][role];
    entry.qty = Math.max(entry.qty, sched.maxDailyQty);
    entry.days = Math.max(entry.days, sched.activeDays);
    entry.rate = entry.count === 0 ? num(it.rate) : entry.rate;
    entry.otHrs = entry.count === 0 ? num(it.otHrs) : entry.otHrs;
    entry.subtotal += calcBOL(it).subtotal;
    entry.count += 1;
  });

  // Recalculate subtotals properly
  DAY_TYPES.forEach((dt) => {
    ['Day', 'Night'].forEach((shift) => {
      Object.values(groups[dt][shift] || {}).forEach((r) => {
        const dtMult = DAY_TYPE_MULT[dt] || 1;
        const shiftAdd = shift === 'Night' ? NIGHT_DIFF : 0;
        const effRate = r.rate * dtMult * (1 + shiftAdd);
        const hourly = r.rate / 8;
        const otRate = hourly * OT_MULT * dtMult * (1 + shiftAdd);
        const base = r.qty * r.days * effRate;
        const ot = r.qty * r.days * r.otHrs * otRate;
        r.subtotal = base + ot;
      });
    });
  });

  const dayTypeTotals = {};
  DAY_TYPES.forEach((dt) => {
    let total = 0;
    Object.values(groups[dt] || {}).forEach((shiftGroup) =>
      Object.values(shiftGroup).forEach((r) => {
        total += r.subtotal;
      })
    );
    dayTypeTotals[dt] = total;
  });
  const grandTotal = DAY_TYPES.reduce((s, dt) => s + dayTypeTotals[dt], 0);

  const dayTypeLabels = {
    Regular: 'A. Regular',
    'Sun/Special': 'B. Sun/Special',
    Holiday: 'C. Holiday',
  };

  // ---- Build Benefits Data automatically from allBOL ----
  const benefitsMap = {};
  allBOL.forEach((it) => {
    const role = it.role || 'Unnamed';
    if (!benefitsMap[role]) {
      benefitsMap[role] = {
        role,
        maxDailyQty: 0,
        activeDays: 0,
        rate: num(it.rate),
      };
    }
    // Update rate from first occurrence (or keep first)
    if (benefitsMap[role].rate === 0) benefitsMap[role].rate = num(it.rate);
    // Find schedule info for this role across all day types/shifts
    Object.keys(scheduleMap).forEach((key) => {
      if (key.startsWith(`${role}~`)) {
        const sched = scheduleMap[key];
        benefitsMap[role].maxDailyQty = Math.max(
          benefitsMap[role].maxDailyQty,
          sched.maxDailyQty
        );
        benefitsMap[role].activeDays = Math.max(
          benefitsMap[role].activeDays,
          sched.activeDays
        );
      }
    });
  });

  const benefitsData = Object.values(benefitsMap).map((b) => {
    const monthlyRate = b.rate * 26; // standard 26 working days per month
    const thirteenth = monthlyRate / 12;
    const sss = monthlyRate * 0.045;
    const hdmf = monthlyRate * 0.02;
    const phic = monthlyRate * 0.03;
    const perDiem = 500 * b.activeDays;
    const totalBenefits = thirteenth + sss + hdmf + phic + perDiem;
    return {
      ...b,
      monthlyRate,
      thirteenth,
      sss,
      hdmf,
      phic,
      perDiem,
      totalBenefits,
    };
  });

  // If no benefitsData, create a zero row
  const displayBenefitsData =
    benefitsData.length > 0
      ? benefitsData
      : [
          {
            role: 'No manpower data',
            maxDailyQty: 0,
            activeDays: 0,
            monthlyRate: 0,
            thirteenth: 0,
            sss: 0,
            hdmf: 0,
            phic: 0,
            perDiem: 0,
            totalBenefits: 0,
          },
        ];

  const benefitHeaders = [
    'ITEM',
    'MANPOWER LOADING',
    'QTY',
    'UOM',
    'TOTAL DAYS',
    'MONTHLY RATE',
    '13TH PAY',
    'SSS',
    'HDMF',
    'PHIC',
    'PER DIEM',
    'TOTAL',
  ];

  return (
    <div className="ce-card ce-summary-block">
      <div className="ce-card-header ce-card-header-compact">
        <h3
          className="ce-serif ce-summary-heading"
          style={{
            margin: 0,
            fontWeight: 'bold',
            textAlign: 'center',
            flex: 1,
          }}
        >
          BILL OF LABOR
        </h3>
        <b className="ce-mono ce-total">{fmt(grandTotal)}</b>
      </div>

      {/* Main BOL table (A, B, C) */}
      <div className="ce-table-scroll">
        <table className="ce-table">
          <thead>
            <tr>
              <th>Role / Position</th>
              <th className="ce-right">QTY</th>
              <th className="ce-right">Days</th>
              <th className="ce-right">Rate/Day</th>
              <th className="ce-right">OT Hrs</th>
              <th className="ce-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {DAY_TYPES.map((dt) => (
              <React.Fragment key={dt}>
                <tr className="ce-daytype-header">
                  <td colSpan={6}>{dayTypeLabels[dt] || dt}</td>
                </tr>
                <tr className="ce-shift-header">
                  <td colSpan={6}>Dayshift</td>
                </tr>
                {Object.values(groups[dt]?.Day || {}).map((r, idx) => (
                  <tr key={`${dt}-day-${idx}`}>
                    <td className="ce-table-cell">{r.role}</td>
                    <td className="ce-right">{r.qty}</td>
                    <td className="ce-right">{r.days}</td>
                    <td className="ce-right ce-mono">{fmt(r.rate)}</td>
                    <td className="ce-right">{r.otHrs}</td>
                    <td className="ce-right ce-mono">{fmt(r.subtotal)}</td>
                  </tr>
                ))}
                <tr className="ce-shift-header">
                  <td colSpan={6}>Nightshift</td>
                </tr>
                {Object.values(groups[dt]?.Night || {}).map((r, idx) => (
                  <tr key={`${dt}-night-${idx}`}>
                    <td className="ce-table-cell">{r.role}</td>
                    <td className="ce-right">{r.qty}</td>
                    <td className="ce-right">{r.days}</td>
                    <td className="ce-right ce-mono">{fmt(r.rate)}</td>
                    <td className="ce-right">{r.otHrs}</td>
                    <td className="ce-right ce-mono">{fmt(r.subtotal)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Benefits section (D. Benefits) */}
      <div style={{ marginTop: '1.5rem' }}>
        <h4 className="ce-serif ce-summary-subheading">D. Benefits</h4>
        <div className="ce-table-scroll">
          <table className="ce-table">
            <thead>
              <tr>
                {benefitHeaders.map((header) => (
                  <th key={header} className="ce-right">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayBenefitsData.map((row, idx) => (
                <tr key={idx}>
                  <td>—</td> {/* ITEM placeholder */}
                  <td>{row.role || '—'}</td>{' '}
                  {/* MANPOWER LOADING = role name */}
                  <td className="ce-right">{row.maxDailyQty}</td> {/* QTY */}
                  <td>pax</td> {/* UOM */}
                  <td className="ce-right">{row.activeDays}</td>{' '}
                  {/* TOTAL DAYS */}
                  <td className="ce-right ce-mono">{fmt(row.monthlyRate)}</td>
                  <td className="ce-right ce-mono">{fmt(row.thirteenth)}</td>
                  <td className="ce-right ce-mono">{fmt(row.sss)}</td>
                  <td className="ce-right ce-mono">{fmt(row.hdmf)}</td>
                  <td className="ce-right ce-mono">{fmt(row.phic)}</td>
                  <td className="ce-right ce-mono">{fmt(row.perDiem)}</td>
                  <td className="ce-right ce-mono">{fmt(row.totalBenefits)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grand Total at the very bottom */}
      <table className="ce-table" style={{ marginTop: '1rem' }}>
        <tbody>
          <tr className="ce-grand-total">
            <td colSpan={5} style={{ textAlign: 'left' }}>
              GRAND TOTAL
            </td>
            <td className="ce-right ce-mono">{fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
/* ============================= AGGREGATED TABS ============================= */
function buildRows(tasks, category) {
  const rows = [];
  tasks.forEach((t) =>
    t.subtasks.forEach((s) =>
      (s.items[category] || []).forEach((it) =>
        rows.push({
          task: t.title,
          subtask: s.title,
          item: it,
          subtotal: itemSubtotal(category, it),
        })
      )
    )
  );
  return rows;
}
function AggregatedCategoryTab({ tasks, category }) {
  const [manualRows, setManualRows] = useState([]);
  const meta = CATEGORY_META[category];

  // Schedule-aware breakdown items
  const scheduleMap = getScheduledItemMap(tasks, category);
  const summaryHeaders = {
    BOCM: 'BILL OF CONSUMABLES & MATERIALS',
    BOTE: 'BILL OF TOOLS & EQUIPMENT',
    PPE: 'SAFETY & PERSONAL PROTECTIVE EQUIPMENT',
  };
  const autoRows = Object.entries(scheduleMap).map(([desc, data]) => {
    let rate = 0;
    tasks.forEach((t) =>
      t.subtasks.forEach((s) =>
        (s.items[category] || []).forEach((it) => {
          const key = category === 'PPE' ? it.item : it.description;
          if (key === desc) {
            rate = category === 'BOTE' ? num(it.rate) : num(it.unitCost);
          }
        })
      )
    );
    return {
      id: desc,
      description: desc,
      maxDailyQty: data.maxDailyQty,
      activeDays: data.activeDays,
      totalQty: data.totalQty,
      rate,
      subtotal:
        category === 'BOTE'
          ? data.maxDailyQty * data.activeDays * rate
          : data.totalQty * rate,
    };
  });

  const autoTotal = autoRows.reduce((s, r) => s + r.subtotal, 0);
  const manualTotal = manualRows.reduce((s, r) => s + manualSubtotal(r), 0);
  const grandTotal = autoTotal + manualTotal;

  function addManualRow() {
    if (category === 'BOTE')
      setManualRows([
        ...manualRows,
        { id: uid('manual-bote'), description: '', qty: 0, days: 0, rate: 0 },
      ]);
    else if (category === 'BOCM')
      setManualRows([
        ...manualRows,
        { id: uid('manual-bocm'), description: '', qty: 0, unitCost: 0 },
      ]);
    else if (category === 'PPE')
      setManualRows([
        ...manualRows,
        { id: uid('manual-ppe'), item: '', qty: 0, unitCost: 0 },
      ]);
  }

  function updateManualRow(id, patch) {
    setManualRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function deleteManualRow(id) {
    setManualRows((rows) => rows.filter((r) => r.id !== id));
  }

  function manualSubtotal(r) {
    if (category === 'BOTE') return num(r.qty) * num(r.days) * num(r.rate);
    return (
      num(r.qty) *
      (category === 'BOCM' || category === 'PPE' ? num(r.unitCost) : 1)
    );
  }

  return (
    <div className="ce-card ce-summary-block">
      <div className="ce-card-header ce-card-header-compact">
        <h3
          className="ce-serif ce-summary-heading"
          style={{
            margin: 0,
            fontWeight: 'bold',
            textAlign: 'center',
            flex: 1,
          }}
        >
          {summaryHeaders[category] || meta.label}
        </h3>
        <b className="ce-mono ce-total">{fmt(grandTotal)}</b>
      </div>

      <div className="ce-table-scroll">
        <table className="ce-table">
          <thead>
            <tr>
              <th>Item Description</th>
              {category === 'BOTE' && <th className="ce-right">Qty</th>}
              {category === 'BOTE' && <th className="ce-right">Days</th>}
              {category === 'BOCM' && <th className="ce-right">Qty</th>}
              {category === 'PPE' && <th className="ce-right">Qty</th>}
              <th className="ce-right">Rate / Unit Cost</th>
              <th className="ce-right">Subtotal</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {autoRows.length > 0 && (
              <>
                <tr className="ce-subtotal-row">
                  <td colSpan={category === 'BOTE' ? 5 : 4}>Breakdown Items</td>
                </tr>
                {autoRows.map((r, idx) => (
                  <tr key={`auto-${idx}`}>
                    <td>{r.description}</td>
                    {category === 'BOTE' ? (
                      <>
                        <td className="ce-right">{r.maxDailyQty}</td>
                        <td className="ce-right">{r.activeDays}</td>
                      </>
                    ) : (
                      <td className="ce-right">{r.totalQty}</td>
                    )}
                    <td className="ce-right ce-mono">{fmt(r.rate)}</td>
                    <td className="ce-right ce-mono">{fmt(r.subtotal)}</td>
                    <td></td>
                  </tr>
                ))}
                <tr className="ce-subtotal-row">
                  <td colSpan={category === 'BOTE' ? 4 : 3}>
                    Subtotal — Breakdown
                  </td>
                  <td className="ce-right ce-mono">{fmt(autoTotal)}</td>
                  <td></td>
                </tr>
              </>
            )}

            {manualRows.length > 0 && (
              <>
                <tr className="ce-subtotal-row">
                  <td colSpan={category === 'BOTE' ? 5 : 4}>Manual Entries</td>
                </tr>
                {manualRows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <input
                        className="ce-input"
                        value={category === 'PPE' ? r.item : r.description}
                        onChange={(e) =>
                          updateManualRow(
                            r.id,
                            category === 'PPE'
                              ? { item: e.target.value }
                              : { description: e.target.value }
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="ce-input ce-right"
                        value={r.qty}
                        onChange={(e) =>
                          updateManualRow(r.id, { qty: e.target.value })
                        }
                      />
                    </td>
                    {category === 'BOTE' && (
                      <td>
                        <input
                          type="number"
                          min="0"
                          className="ce-input ce-right"
                          value={r.days}
                          onChange={(e) =>
                            updateManualRow(r.id, { days: e.target.value })
                          }
                        />
                      </td>
                    )}
                    <td>
                      <input
                        type="number"
                        min="0"
                        className="ce-input ce-right"
                        value={category === 'BOTE' ? r.rate : r.unitCost}
                        onChange={(e) =>
                          updateManualRow(
                            r.id,
                            category === 'BOTE'
                              ? { rate: e.target.value }
                              : { unitCost: e.target.value }
                          )
                        }
                      />
                    </td>
                    <td className="ce-right ce-mono">
                      {fmt(manualSubtotal(r))}
                    </td>
                    <td>
                      <IconBtn
                        danger
                        title="Remove"
                        onClick={() => deleteManualRow(r.id)}
                      >
                        <Trash2 size={14} />
                      </IconBtn>
                    </td>
                  </tr>
                ))}
                <tr className="ce-subtotal-row">
                  <td colSpan={category === 'BOTE' ? 4 : 3}>
                    Subtotal — Manual
                  </td>
                  <td className="ce-right ce-mono">{fmt(manualTotal)}</td>
                  <td></td>
                </tr>
              </>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={category === 'BOTE' ? 4 : 3}>Grand Total</td>
              <td className="ce-right ce-mono ce-total">{fmt(grandTotal)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
      <button className="ce-add-row" onClick={addManualRow} type="button">
        <Plus size={13} /> Add Row
      </button>
    </div>
  );
}
/* ============================= MISC TAB (STANDALONE SHEET) ============================= */
function MISCSheet() {
  const { widths, updateWidth } = useResizableColumns('misc-accom-col-widths', {
    itemNo: 55,
    description: 250,
    qty: 80,
    unit: 90,
    unitPrice: 110,
    total: 120,
    action: 50,
  });
  const [entries, setEntries] = useState(() => {
    const flat = [];
    MISC_PRELOAD.forEach((sec) =>
      sec.items.forEach((desc, idx) =>
        flat.push({
          id: uid(`misc-${sec.section}-${idx}`),
          section: sec.section,
          sectionTitle: sec.title,
          description: desc,
          qty: 0,
          unitCost: 0,
          days: 1,
        })
      )
    );
    return flat;
  });

  const [hideSections, setHideSections] = useState({});

  const updateEntry = (id, patch) => {
    setEntries((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };
  function removeEntry(id) {
    setEntries((rows) => rows.filter((r) => r.id !== id));
  }
  const insertRowBelow = (afterId) => {
    setEntries((rows) => {
      const idx = rows.findIndex((r) => r.id === afterId);
      if (idx === -1) return rows;
      const afterRow = rows[idx];
      const newRow = {
        id: uid(`misc-insert-${afterRow.section}`),
        section: afterRow.section,
        sectionTitle: afterRow.sectionTitle,
        description: '',
        qty: 0,
        unitCost: 0,
        days: 1,
      };
      const next = [...rows];
      next.splice(idx + 1, 0, newRow);
      return next;
    });
  };

  const grouped = MISC_PRELOAD.map((sec) => {
    const allRows = entries.filter((e) => e.section === sec.section);
    const visibleRows = hideSections[sec.section]
      ? allRows.filter((r) => num(r.qty) !== 0 || num(r.unitCost) !== 0)
      : allRows;
    return {
      ...sec,
      rows: visibleRows,
      allRowsCount: allRows.length,
    };
  });

  const grandTotal = entries.reduce((s, e) => {
    const showDays =
      e.section === 'B' || e.section === 'D' || e.section === 'E';
    return (
      s +
      (showDays
        ? num(e.qty) * num(e.days) * num(e.unitCost)
        : num(e.qty) * num(e.unitCost))
    );
  }, 0);

  return (
    <div className="ce-card ce-summary-block">
      <div className="ce-card-header ce-card-header-compact">
        <h3
          className="ce-serif ce-summary-heading"
          style={{
            margin: 0,
            fontWeight: 'bold',
            textAlign: 'center',
            flex: 1,
          }}
        >
          MISCELLANEOUS
        </h3>
        <b className="ce-mono ce-total">{fmt(grandTotal)}</b>
      </div>

      {grouped.map((sec) => {
        const showDays =
          sec.section === 'B' || sec.section === 'D' || sec.section === 'E';
        return (
          <div key={sec.section} className="misc-group">
            <div className="misc-group-header">
              <span className="ce-serif misc-group-title">
                {sec.section}. {sec.title}
              </span>
              <button
                className="ce-btn-ghost ce-btn-sm misc-hide-btn"
                onClick={() =>
                  setHideSections((prev) => ({
                    ...prev,
                    [sec.section]: !prev[sec.section],
                  }))
                }
                type="button"
              >
                {hideSections[sec.section]
                  ? 'Show All Items'
                  : 'Hide Unused Items'}
              </button>
            </div>

            <div className="ce-gridwrap">
              <table className="ce-table misc-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Item No.</th>
                    <th>Description</th>
                    <th className="ce-right" style={{ width: '30px' }}>
                      QTY
                    </th>
                    <th className="ce-right" style={{ width: '120px' }}>
                      Unit Price
                    </th>
                    {showDays && (
                      <th className="ce-right" style={{ width: '30px' }}>
                        No. of Days
                      </th>
                    )}
                    <th className="ce-right" style={{ width: '120px' }}>
                      Total
                    </th>
                    <th style={{ width: '80px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.map((r, idx) => {
                    const lineTotal = showDays
                      ? num(r.qty) * num(r.days) * num(r.unitCost)
                      : num(r.qty) * num(r.unitCost);
                    return (
                      <tr key={r.id}>
                        <td className="ce-center">{idx + 1}</td>
                        <td>
                          <input
                            className="ce-input misc-desc-input"
                            value={r.description}
                            onChange={(e) =>
                              updateEntry(r.id, { description: e.target.value })
                            }
                            placeholder="Description"
                          />
                        </td>
                        <td style={{ width: '30px' }}>
                          <input
                            type="number"
                            min="0"
                            className="ce-input ce-right misc-qty-input"
                            style={{ width: '100%' }}
                            value={r.qty}
                            onChange={(e) =>
                              updateEntry(r.id, { qty: e.target.value })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            className="ce-input ce-right misc-unit-input"
                            value={r.unitCost}
                            onChange={(e) =>
                              updateEntry(r.id, { unitCost: e.target.value })
                            }
                          />
                        </td>
                        {showDays && (
                          <td style={{ width: '30px' }}>
                            <input
                              type="number"
                              min="0"
                              className="ce-input ce-right misc-days-input"
                              style={{ width: '100%' }}
                              value={r.days}
                              onChange={(e) =>
                                updateEntry(r.id, { days: e.target.value })
                              }
                            />
                          </td>
                        )}
                        <td
                          className="ce-right ce-mono misc-total-cell"
                          style={{ width: '120px' }}
                        >
                          {fmt(lineTotal)}
                        </td>
                        <td>
                          <button
                            className="ce-btn-ghost ce-btn-sm misc-insert-btn"
                            onClick={() => insertRowBelow(r.id)}
                            type="button"
                            title="Insert row below"
                          >
                            <Plus size={10} />
                          </button>
                          <IconBtn
                            danger
                            title="Delete row"
                            onClick={() => removeEntry(r.id)}
                          >
                            <Trash2 size={14} />
                          </IconBtn>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="ce-subtotal-row">
                    <td colSpan={showDays ? 5 : 4}>
                      Subtotal — Section {sec.section}
                    </td>
                    <td
                      className="ce-right ce-mono"
                      style={{ textAlign: 'right' }}
                    >
                      {fmt(
                        sec.rows.reduce(
                          (s, r) =>
                            s +
                            (showDays
                              ? num(r.qty) * num(r.days) * num(r.unitCost)
                              : num(r.qty) * num(r.unitCost)),
                          0
                        )
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================= MOB/DEMOB SHEET ============================= */
function MobDemobSection({ title, bolItems }) {
  const allowanceRates = {
    'Project Manager': 500,
    Admin: 300,
    Manpower: 200,
    'Driver / Porter': 150,
  };

  const roleMap = {};
  bolItems.forEach((it) => {
    const key = it.role || 'Unnamed';
    if (!roleMap[key])
      roleMap[key] = {
        id: uid('mob-a'),
        role: key,
        qty: 0,
        uom: 'pax',
        days: 0,
        rate: 0,
        otHrs: 0,
      };
    roleMap[key].qty += num(it.qty);
  });
  const [partA, setPartA] = useState(Object.values(roleMap));
  const [partB, setPartB] = useState(
    [
      {
        description: 'Airfare-International',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Airfare-Domestic',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Vehicle Traviz (Cavite to Airport)',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Vehicle Traviz (Cavite to Site)',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Vehicle Traviz (Airport to Site)',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Vehicle Hilux (Cavite to Airport)',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Vehicle Hilux (Cavite to Site)',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Vehicle Hilux (Airport to Site)',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Truck Delivery 6-Wheeler',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Truck Delivery 10-Wheeler',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Truck Delivery Flat Bed 40FT',
        qty: 0,
        uom: 'trip',
        days: 0,
        unitCost: 0,
      },
      {
        description: 'Diesel (Ltrs)',
        qty: 0,
        uom: 'ltr',
        days: 0,
        unitCost: 0,
      },
      { description: 'Toll Fee', qty: 0, uom: 'trip', days: 0, unitCost: 0 },
      { description: 'Procurement', qty: 0, uom: 'lot', days: 0, unitCost: 0 },
      {
        description: 'Contingencies',
        qty: 0,
        uom: 'lot',
        days: 0,
        unitCost: 0,
      },
    ].map((r, i) => ({ ...r, id: uid('mob-b'), lineItem: i + 1 }))
  );
  const [hideUnused, setHideUnused] = useState(false);

  function updatePartA(id, patch) {
    setPartA((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function updatePartB(id, patch) {
    setPartB((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function insertCustomRow(afterId) {
    const idx = partB.findIndex((r) => r.id === afterId);
    if (idx === -1) return;
    const newRow = {
      id: uid('mob-custom'),
      description: '',
      qty: 0,
      uom: '',
      days: 0,
      unitCost: 0,
      lineItem: idx + 1,
    };
    const next = [...partB];
    next.splice(idx + 1, 0, newRow);
    setPartB(next);
  }
  function deleteCustomRow(id) {
    setPartB((rows) => rows.filter((r) => r.id !== id));
  }

  const partATotal = partA.reduce((s, r) => {
    const allowanceAmount = allowanceRates[r.role] || 0;
    const subtotalA = num(r.qty) * num(r.days) * num(r.rate);
    const subtotalB = num(r.qty) * num(r.days) * allowanceAmount;
    return s + subtotalA + subtotalB;
  }, 0);
  const visiblePartB = hideUnused
    ? partB.filter((r) => num(r.qty) > 0 || r.id.startsWith('mob-custom'))
    : partB;
  const partBTotal = visiblePartB.reduce(
    (s, r) => s + num(r.qty) * num(r.days) * num(r.unitCost),
    0
  );

  return (
    <div className="ce-card ce-summary-block">
      <div className="ce-card-header ce-card-header-compact">
        <h3 className="ce-serif ce-summary-heading" style={{ margin: 0 }}>
          {title}
        </h3>
        <b className="ce-mono ce-total">{fmt(partATotal + partBTotal)}</b>
      </div>
      <div className="ce-table-scroll">
        <h4 className="ce-serif ce-summary-subheading">
          Part A: Manpower Loading
        </h4>
        <table className="ce-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Manpower Loading (Role)</th>
              <th className="ce-right" style={{ width: '30px' }}>
                Qty
              </th>
              <th>UOM</th>
              <th style={{ width: '30px' }}>No. of Days</th>
              <th className="ce-right">Rate Per Day</th>
              <th className="ce-right">Sub-Total A</th>
              <th className="ce-right">OT Hrs Per Day</th>
              <th className="ce-right">ALLOWANCE</th>
              <th className="ce-right">Sub-Total B</th>
              <th className="ce-right" style={{ width: '120px' }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {partA.map((r, idx) => {
              const allowanceAmount = allowanceRates[r.role] || 0;
              const subtotalA = num(r.qty) * num(r.days) * num(r.rate);
              const subtotalB = num(r.qty) * num(r.days) * allowanceAmount;
              return (
                <tr key={r.id}>
                  <td>{idx + 1}</td>
                  <td>{r.role}</td>
                  <td className="ce-right" style={{ width: '30px' }}>
                    {r.qty}
                  </td>
                  <td>
                    <input
                      className="ce-input"
                      value={r.uom}
                      onChange={(e) =>
                        updatePartA(r.id, { uom: e.target.value })
                      }
                    />
                  </td>
                  <td style={{ width: '30px' }}>
                    <input
                      type="number"
                      min="0"
                      className="ce-input ce-right"
                      style={{ width: '100%' }}
                      value={r.days}
                      onChange={(e) =>
                        updatePartA(r.id, { days: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-input ce-right"
                      value={r.rate}
                      onChange={(e) =>
                        updatePartA(r.id, { rate: e.target.value })
                      }
                    />
                  </td>
                  <td className="ce-right ce-mono">{fmt(subtotalA)}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-input ce-right"
                      value={r.otHrs}
                      onChange={(e) =>
                        updatePartA(r.id, { otHrs: e.target.value })
                      }
                    />
                  </td>
                  <td className="ce-right ce-mono">{fmt(allowanceAmount)}</td>
                  <td className="ce-right ce-mono">{fmt(subtotalB)}</td>
                  <td className="ce-right ce-mono" style={{ width: '120px' }}>
                    {fmt(subtotalA + subtotalB)}
                  </td>
                </tr>
              );
            })}
            <tr className="ce-subtotal-row">
              <td colSpan={10}>Subtotal — Part A</td>
              <td className="ce-right ce-mono">{fmt(partATotal)}</td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            margin: '1rem 0',
          }}
        >
          <h4 className="ce-serif ce-summary-subheading" style={{ margin: 0 }}>
            Part B: Line Items
          </h4>
          <button
            className="ce-btn-ghost ce-btn-sm"
            onClick={() => setHideUnused(!hideUnused)}
            type="button"
          >
            {hideUnused ? 'Show All Items' : 'Hide Unused Items'}
          </button>
        </div>
        <table className="ce-table">
          <thead>
            <tr>
              <th>Line Item</th>
              <th>Description/Manpower</th>
              <th className="ce-right" style={{ width: '30px' }}>
                Qty
              </th>
              <th>UOM</th>
              <th style={{ width: '30px' }}>No. of Days / Trips</th>
              <th className="ce-right">Unit Cost</th>
              <th className="ce-right" style={{ width: '120px' }}>
                Total
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visiblePartB.map((r, idx) => {
              const lineTotal = num(r.qty) * num(r.days) * num(r.unitCost);
              return (
                <tr key={r.id}>
                  <td className="ce-center">{idx + 1}</td>
                  <td>
                    <input
                      className="ce-input"
                      value={r.description}
                      onChange={(e) =>
                        updatePartB(r.id, { description: e.target.value })
                      }
                    />
                  </td>
                  <td style={{ width: '30px' }}>
                    <input
                      type="number"
                      min="0"
                      className="ce-input ce-right"
                      style={{ width: '100%' }}
                      value={r.qty}
                      onChange={(e) =>
                        updatePartB(r.id, { qty: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="ce-input"
                      value={r.uom}
                      onChange={(e) =>
                        updatePartB(r.id, { uom: e.target.value })
                      }
                    />
                  </td>
                  <td style={{ width: '30px' }}>
                    <input
                      type="number"
                      min="0"
                      className="ce-input ce-right"
                      style={{ width: '100%' }}
                      value={r.days}
                      onChange={(e) =>
                        updatePartB(r.id, { days: e.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="ce-input ce-right"
                      value={r.unitCost}
                      onChange={(e) =>
                        updatePartB(r.id, { unitCost: e.target.value })
                      }
                    />
                  </td>
                  <td className="ce-right ce-mono" style={{ width: '120px' }}>
                    {fmt(lineTotal)}
                  </td>
                  <td>
                    <button
                      className="ce-btn-ghost ce-btn-sm"
                      onClick={() => insertCustomRow(r.id)}
                      type="button"
                      title="Insert custom row below"
                    >
                      <Plus size={10} />
                    </button>
                    <IconBtn
                      danger
                      title="Delete row"
                      onClick={() => removeRow(r.id)}
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                    {r.id.startsWith('mob-custom') && (
                      <IconBtn
                        danger
                        title="Remove"
                        onClick={() => deleteCustomRow(r.id)}
                      >
                        <Trash2 size={14} />
                      </IconBtn>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="ce-subtotal-row">
              <td colSpan={5}>Subtotal — Part B</td>
              <td className="ce-right ce-mono">{fmt(partBTotal)}</td>
              <td></td>
            </tr>
            <tr className="ce-grand-total">
              <td colSpan={6}>Section Total</td>
              <td className="ce-right ce-mono">
                {fmt(partATotal + partBTotal)}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============================= HEADER ============================= */
function Header({
  meta,
  grand,
  dispatch,
  onExport,
  onExportExcel,
  onImportClick,
  ceStatus,
  setCeStatus,
  versionHistory,
  onSaveVersion,
  onRestoreVersion,
}) {
  const [editing, setEditing] = useState(false);
  const [isParked, setIsParked] = useState(false);
  const [draft, setDraft] = useState(meta);
  const idleTimerRef = useRef(null);
  function save() {
    Object.keys(draft).forEach((k) => {
      if (draft[k] !== meta[k])
        dispatch({ type: 'SET_META', field: k, value: draft[k] });
    });
    setEditing(false);
  }
  function autoSave() {
    const now = new Date().toLocaleTimeString();
    console.log(`Auto-saved at ${now}`);
    // Later, you can call an API or database save here
  }
  useEffect(() => {
    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        autoSave();
        setIsParked(true);
        alert('Editor parked due to inactivity. All changes auto-saved.');
      }, 15 * 60 * 1000); // 15 minutes
    };

    // Initialize timer
    resetTimer();

    // Add event listeners
    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);

    // Cleanup on unmount
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
    };
  }, [autoSave, setIsParked]);
  return (
    <div className="ce-header">
      <div className="ce-header-top">
        {!editing ? (
          <div className="ce-breadcrumb">
            {[meta.client, meta.location, meta.date].filter(Boolean).length > 0
              ? [meta.client, meta.location, meta.date]
                  .filter(Boolean)
                  .join(' · ')
              : 'Click Edit to add client, location, and date'}
          </div>
        ) : (
          <div className="ce-meta-edit">
            <input
              className="ce-input"
              value={draft.client}
              onChange={(e) => setDraft({ ...draft, client: e.target.value })}
              placeholder="Client"
            />
            <input
              className="ce-input"
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="Location"
            />
            <input
              type="date"
              className="ce-input"
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            />
          </div>
        )}
        <div className="ce-header-actions">
          <select
            value={ceStatus}
            onChange={(e) => setCeStatus(e.target.value)}
            className="ce-status-select"
            title="Change status"
          >
            <option value="Draft">Draft</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Sent to Client">Sent to Client</option>
            <option value="Awarded">Awarded</option>
          </select>
          <button
            className={`ce-btn-ghost ce-btn-sm ${
              isParked ? 'ce-btn-active' : ''
            }`}
            onClick={() => {
              if (!isParked) {
                setIsParked(true);
                alert('Editor parked. All changes auto-saved.');
              } else {
                setIsParked(false);
                alert('Editor resumed');
              }
            }}
            type="button"
          >
            {isParked ? 'Resume' : 'Park Editor'}
          </button>
          {
            <button
              className="ce-btn-ghost ce-btn-sm"
              onClick={onExport}
              type="button"
            >
              <Download size={14} /> PDF
            </button>
          }
          <button
            className="ce-btn-ghost ce-btn-sm"
            onClick={onImportClick}
            type="button"
          >
            <Upload size={14} /> Import
          </button>
          <button
            className="ce-btn-ghost ce-btn-sm"
            onClick={onExportExcel}
            type="button"
          >
            <Download size={14} /> Excel
          </button>
          {!editing ? (
            <button
              className="ce-btn-ghost ce-btn-sm"
              onClick={() => {
                setDraft(meta);
                setEditing(true);
              }}
              type="button"
            >
              <Pencil size={14} /> Edit
            </button>
          ) : (
            <button
              className="ce-btn-primary ce-btn-sm"
              onClick={save}
              type="button"
            >
              <Check size={14} /> Save
            </button>
          )}
        </div>
      </div>
      {!editing ? (
        <h1 className="ce-serif ce-header-title">{meta.title}</h1>
      ) : (
        <input
          className="ce-input ce-header-title-input"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Project title"
        />
      )}
      {!editing ? (
        meta.subtitle && <p className="ce-header-subtitle">{meta.subtitle}</p>
      ) : (
        <input
          className="ce-input"
          value={draft.subtitle}
          onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })}
          placeholder="Subtitle / scope note"
        />
      )}
      <div className="ce-header-total">
        <span className="ce-field-label">Grand Total</span>
        <span className="ce-mono ce-header-total-val">{fmt(grand)}</span>
      </div>
    </div>
  );
}

/* ============================= COST ESTIMATE TOOL ============================= */
const TABS = [
  'SUMMARY',
  'BREAKDOWN',
  'SOW',
  'MOB/DEMOB',
  'BOL',
  'BOCM',
  'BOTE',
  'PPE',
  'MISC',
  'ATTCH',
];
function CostEstimateTool({
  ceData,
  status,
  onStatusChange,
  isParked,
  onParkToggle,
  goToLibrary,
  goToSearch,
  editingUser,
  isEditorLocked,
  onUserActivity,
  onLock,
  onTakeOver,
}) {
  const [lastActivity, setLastActivity] = useState(Date.now());

  useEffect(() => {
    if (isEditorLocked) return;
    const handleActivity = () => {
      setLastActivity(Date.now());
      if (onUserActivity) onUserActivity();
    };
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [isEditorLocked, onUserActivity]);

  useEffect(() => {
    if (isEditorLocked) return;
    const interval = setInterval(() => {
      if (Date.now() - lastActivity > 15 * 60 * 1000) {
        if (onLock) onLock();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lastActivity, isEditorLocked, onLock]);

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    const base = buildEmptyProject();
    if (!ceData) return base;

    if (Array.isArray(ceData.tasks)) {
      return {
        ...base,
        ...ceData,
        meta: { ...base.meta, ...(ceData.meta || {}) },
        fileAttachments: {
          ...base.fileAttachments,
          ...(ceData.fileAttachments || {}),
        },
        summaryTaskFilters: {
          ...base.summaryTaskFilters,
          ...(ceData.summaryTaskFilters || {}),
        },
      };
    }

    return {
      ...base,
      meta: {
        ...base.meta,
        client: ceData.client || '',
        title: ceData.project || 'New Cost Estimate',
        subtitle: ceData.id ? `CE #${ceData.id}` : '',
      },
    };
  });

  const [tab, setTab] = useState('BREAKDOWN');
  const [sowText, setSowText] = useState('');
  const [ceStatus, setCeStatus] = useState('Draft');
  const [versionHistory, setVersionHistory] = useState([]);
  const [viewType, setViewType] = useState('Summary');
  const [docNo, setDocNo] = useState('');
  const [revNo, setRevNo] = useState('');
  const [revDate, setRevDate] = useState(new Date().toISOString().slice(0, 10));
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);
  const grand = projectTotal(state.tasks);
  const saveVersion = () => {
    const snapshot = {
      timestamp: new Date().toISOString(),
      ceStatus,
      tasks: JSON.parse(JSON.stringify(state.tasks)), // deep copy
    };
    setVersionHistory((prev) => [...prev, snapshot]);
  };

  const restoreVersion = (version) => {
    dispatch({
      type: 'RESTORE_TASKS',
      tasks: JSON.parse(JSON.stringify(version.tasks)),
    });
    setCeStatus(version.ceStatus);
  };
  const prepareExportData = () => {
    const sections = [];

    // 1. Summary section
    const catTotals = CATS.map((cat) => {
      const total = state.tasks.reduce(
        (sum, t) =>
          sum +
          t.subtasks.reduce(
            (subSum, st) => subSum + categoryTotal(st.items[cat], cat),
            0
          ),
        0
      );
      return { cat, total };
    });
    const summaryRows = catTotals.map(({ cat, total }) => {
      const meta = CATEGORY_META[cat] || { short: cat, label: cat };
      return [meta.short, meta.label, fmt(total)];
    });
    sections.push({
      title: 'Summary',
      columns: ['Category', 'Description', 'Total'],
      rows: summaryRows,
    });

    // 2. SOW section (if sowText exists)
    if (sowText && sowText.trim() !== '') {
      sections.push({
        title: 'Scope of Work',
        columns: ['Content'],
        rows: [[sowText]],
      });
    }

    // 3. Task Breakdown (landscape)
    const breakdownRows = [];
    state.tasks.forEach((task) => {
      breakdownRows.push([
        task.title,
        '',
        '',
        task.duration || 0,
        task.predecessor || '',
      ]);
      task.subtasks.forEach((sub) => {
        breakdownRows.push([
          '',
          sub.title,
          sub.type,
          sub.duration || 0,
          sub.predecessor || '',
        ]);
      });
    });
    sections.push({
      title: 'Task Breakdown',
      columns: ['Task', 'Subtask', 'Type', 'Duration', 'Predecessor'],
      rows: breakdownRows,
      isTaskBreakdown: true,
    });

    // 4. BOL section
    const bolItems = [];
    state.tasks.forEach((t) =>
      t.subtasks.forEach((st) =>
        (st.items.BOL || []).forEach((it) => bolItems.push(it))
      )
    );
    if (bolItems.length > 0) {
      const bolRows = bolItems.map((it) => [
        it.role || '—',
        it.dayType || 'Regular',
        it.shift || 'Day',
        it.qty,
        it.days,
        fmt(it.rate),
        it.otHrs,
        fmt(calcBOL(it).subtotal),
      ]);
      sections.push({
        title: 'Bill of Labor',
        columns: [
          'Role',
          'Day Type',
          'Shift',
          'QTY',
          'Days',
          'Rate/Day',
          'OT Hrs',
          'Subtotal',
        ],
        rows: bolRows,
      });
    }

    // 5. BOTE / BOCM / PPE / MISC sections
    const categorySections = [
      {
        key: 'BOTE',
        title: 'Tools & Equipment',
        columns: ['Description', 'Qty', 'Days', 'Rate/Day', 'Subtotal'],
      },
      {
        key: 'BOCM',
        title: 'Consumables',
        columns: ['Description', 'Qty', 'Unit', 'Unit Cost', 'Subtotal'],
      },
      {
        key: 'PPE',
        title: 'Safety & PPE',
        columns: ['Item', 'Qty', 'Unit Cost', 'Subtotal'],
      },
      {
        key: 'MISC',
        title: 'Miscellaneous',
        columns: ['Description', 'Qty', 'Unit Cost', 'Days', 'Subtotal'],
      },
    ];
    categorySections.forEach((sec) => {
      const items = [];
      state.tasks.forEach((t) =>
        t.subtasks.forEach((st) =>
          (st.items[sec.key] || []).forEach((it) => items.push(it))
        )
      );
      if (items.length > 0) {
        const rows = items.map((it) => {
          if (sec.key === 'BOTE')
            return [
              it.description,
              it.qty,
              it.days,
              fmt(it.rate),
              fmt(itemSubtotal('BOTE', it)),
            ];
          if (sec.key === 'BOCM')
            return [
              it.description,
              it.qty,
              it.unit,
              fmt(it.unitCost),
              fmt(itemSubtotal('BOCM', it)),
            ];
          if (sec.key === 'PPE')
            return [
              it.item,
              it.qty,
              fmt(it.unitCost),
              fmt(itemSubtotal('PPE', it)),
            ];
          if (sec.key === 'MISC')
            return [
              it.description,
              it.qty,
              fmt(it.unitCost),
              it.days || 1,
              fmt(itemSubtotal('MISC', it)),
            ];
          return [];
        });
        sections.push({
          title: sec.title,
          columns: sec.columns,
          rows,
        });
      }
    });

    // 6. Attachments
    const attachments = [];
    Object.entries(state.fileAttachments || {}).forEach(([sheet, files]) => {
      files.forEach((file) => attachments.push([sheet, file.name]));
    });
    if (attachments.length > 0) {
      sections.push({
        title: 'Attachments',
        columns: ['Sheet', 'File Name'],
        rows: attachments,
      });
    }

    // Build export data object
    return {
      companyLogo: '', // Replace with actual base64 if available
      docRevision: '1.0', // Replace with actual revision from config
      docDate: state.meta.date || new Date().toISOString().slice(0, 10),
      ceNumber: ceData?.id || state.meta.title || '—',
      sections,
    };
  };
  const handleExportPDF = () => {
    const data = prepareExportData();
    exportToPDF(data);
  };

  const handleExportExcel = () => {
    const data = prepareExportData();
    exportToExcel(data);
  };
  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = (state.meta.title || 'cost-estimate')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    a.href = url;
    a.download = `${slug || 'cost-estimate'}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || !parsed.meta || !Array.isArray(parsed.tasks))
          throw new Error('Invalid project file');
        dispatch({ type: 'IMPORT_PROJECT', project: parsed });
        setImportError('');
      } catch (err) {
        setImportError(
          "Couldn't read that file — it doesn't look like a valid project export."
        );
        setTimeout(() => setImportError(''), 4000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }
  const allAttachments = useMemo(() => {
    const files = [];
    Object.entries(state.fileAttachments || {}).forEach(
      ([sheet, fileArray]) => {
        (fileArray || []).forEach((file) => {
          files.push({ ...file, sheet });
        });
      }
    );
    return files;
  }, [state.fileAttachments]);
  const bolItems = useMemo(() => {
    const items = [];
    state.tasks.forEach((t) =>
      t.subtasks.forEach((s) =>
        (s.items.BOL || []).forEach((it) => items.push(it))
      )
    );
    return items;
  }, [state.tasks]);

  return (
    <div style={{ position: 'relative' }}>
      {isEditorLocked && (
        <div className="editor-lock-overlay">
          <div className="editor-lock-banner">
            <p>
              This CE is currently being edited by{' '}
              {editingUser || 'another user'}. Click &lsquo;Take Over&rsquo; to
              unlock.
            </p>
            <button className="ce-btn-primary" onClick={onTakeOver}>
              Take Over
            </button>
          </div>
        </div>
      )}
      <div
        className="ce-shell"
        style={
          isEditorLocked
            ? { pointerEvents: 'none', opacity: 0.6, userSelect: 'none' }
            : {}
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          style={{ display: 'none' }}
          onChange={handleImportFile}
        />
        <Header
          ceStatus={ceStatus}
          setCeStatus={setCeStatus}
          versionHistory={versionHistory}
          onSaveVersion={saveVersion}
          onRestoreVersion={restoreVersion}
          meta={state.meta}
          grand={grand}
          dispatch={dispatch}
          onExport={handleExportPDF}
          onExportExcel={handleExportExcel}
          onImportClick={() =>
            fileInputRef.current && fileInputRef.current.click()
          }
        />
        {importError && <div className="ce-import-error">{importError}</div>}
        <div className="ce-status-bar">
          <button
            className={`ce-btn-ghost ce-btn-sm ${
              isParked ? 'ce-btn-active' : ''
            }`}
            onClick={() => onParkToggle && onParkToggle(!isParked)}
            type="button"
          >
            {isParked ? 'Resume' : 'Park Editor'}
          </button>
          {isParked && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.75rem',
                color: 'var(--ink-soft)',
              }}
            >
              <Check size={12} /> Auto-saved
            </span>
          )}
        </div>
        <div className="ce-tabnav">
          {TABS.map((t) => (
            <Pill key={t} active={tab === t} onClick={() => setTab(t)}>
              {t}
            </Pill>
          ))}
        </div>
        <div className="ce-main">
          {tab === 'SUMMARY' && (
            <>
              <SummaryHeader
                docNo={docNo}
                setDocNo={setDocNo}
                revNo={revNo}
                setRevNo={setRevNo}
                revDate={revDate}
                setRevDate={setRevDate}
                viewType={viewType}
                setViewType={setViewType}
              />
              <SummaryView tasks={state.tasks} viewType={viewType} />
            </>
          )}
          {tab === 'BREAKDOWN' && (
            <BreakdownView
              tasks={state.tasks}
              dispatch={dispatch}
              goToLibrary={goToLibrary}
              goToSearch={goToSearch}
            />
          )}
          {tab === 'SOW' && (
            <SOWTab sowText={sowText} setSowText={setSowText} />
          )}
          {tab === 'BOL' && <BOLMasterSummary tasks={state.tasks} />}
          {tab === 'BOTE' && (
            <AggregatedCategoryTab tasks={state.tasks} category="BOTE" />
          )}
          {tab === 'PPE' && (
            <AggregatedCategoryTab tasks={state.tasks} category="PPE" />
          )}
          {tab === 'BOCM' && (
            <AggregatedCategoryTab tasks={state.tasks} category="BOCM" />
          )}
          {tab === 'MISC' && <MISCSheet />}
          {tab === 'MOB/DEMOB' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
              }}
            >
              <MobDemobSection title="Mobilization" bolItems={bolItems} />
              <MobDemobSection title="Demobilization" bolItems={bolItems} />
            </div>
          )}
          {tab === 'ATTCH' && <AttachmentsTab attachments={allAttachments} />}
        </div>
      </div>
    </div>
  );
}
/* ============================= MONITORING DASHBOARD ============================= */
const monitoringMockData = [
  {
    id: 1,
    companyDesignation: 'Client 1',
    department: 'Dept 1',
    rceNo: 'RCE-2025-001',
    client: 'ABC Corp',
    projectDesc: 'Turbine Overhaul',
    rceReceived: '2025-01-15',
    deadline: '2025-02-01',
    aging: 12,
    ceNo: 'CE-2025-001',
    status: 'Ongoing',
    remarks: 'Cost estimate in progress.',
    ceSubmitted: '2025-01-25',
    receivedBy: 'John Doe',
    awardStatus: 'Pending',
    awardRemarks: '',
    recommendedAction: 'Escalate to PM',
  },
  {
    id: 2,
    companyDesignation: 'Client 1',
    department: 'Dept 2',
    rceNo: 'RCE-2025-002',
    client: 'XYZ Ltd',
    projectDesc: 'Piping Fabrication',
    rceReceived: '2025-01-10',
    deadline: '2025-01-20',
    aging: 8,
    ceNo: 'CE-2025-002',
    status: 'Waiting for Information',
    remarks: 'Need clarification on specs.',
    ceSubmitted: '',
    receivedBy: 'Jane Smith',
    awardStatus: '',
    awardRemarks: '',
    recommendedAction: 'Automated Reminder sent to Sales',
  },
  {
    id: 3,
    companyDesignation: 'Client 2',
    department: 'Dept 1',
    rceNo: 'RCE-2025-003',
    client: 'DEF Inc',
    projectDesc: 'Electrical Upgrade',
    rceReceived: '2025-01-18',
    deadline: '2025-01-28',
    aging: 4,
    ceNo: 'CE-2025-003',
    status: 'Pending',
    remarks: 'Awaiting internal review.',
    ceSubmitted: '',
    receivedBy: 'Mike Johnson',
    awardStatus: '',
    awardRemarks: '',
    recommendedAction: '',
  },
  {
    id: 4,
    companyDesignation: 'Client 2',
    department: 'Dept 2',
    rceNo: 'RCE-2025-004',
    client: 'GHI Corp',
    projectDesc: 'Structural Repair',
    rceReceived: '2025-01-05',
    deadline: '2025-01-15',
    aging: 15,
    ceNo: 'CE-2025-004',
    status: 'Done',
    remarks: 'Submitted and awarded.',
    ceSubmitted: '2025-01-12',
    receivedBy: 'Sarah Lee',
    awardStatus: 'Awarded',
    awardRemarks: 'JO-12345, file attached.',
    recommendedAction: 'Move to Project Handover',
  },
  {
    id: 5,
    companyDesignation: 'Client 1',
    department: 'Dept 3',
    rceNo: 'RCE-2025-005',
    client: 'JKL Ltd',
    projectDesc: 'Mechanical Seal Replacement',
    rceReceived: '2025-01-20',
    deadline: '2025-02-10',
    aging: 2,
    ceNo: '',
    status: 'No Quote',
    remarks: 'Scope too vague.',
    ceSubmitted: '',
    receivedBy: 'Emily Brown',
    awardStatus: '',
    awardRemarks: '',
    recommendedAction: '',
  },
  {
    id: 6,
    companyDesignation: 'Client 2',
    department: 'Dept 1',
    rceNo: 'RCE-2025-006',
    client: 'MNO Corp',
    projectDesc: 'Boiler Retubing',
    rceReceived: '2025-01-22',
    deadline: '2025-02-05',
    aging: 1,
    ceNo: '',
    status: 'Cancelled',
    remarks: 'Client cancelled request.',
    ceSubmitted: '',
    receivedBy: 'David Wilson',
    awardStatus: '',
    awardRemarks: '',
    recommendedAction: '',
  },
];

function MonitoringDashboard() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [data] = useState(monitoringMockData);

  const filtered =
    statusFilter === 'All'
      ? data
      : data.filter((d) => d.status === statusFilter);

  const totalPending = data.filter(
    (d) =>
      d.status === 'Pending' ||
      d.status === 'Ongoing' ||
      d.status === 'Waiting for Information'
  ).length;
  const overdue = data.filter(
    (d) => d.aging > 5 && d.status !== 'Done' && d.status !== 'Cancelled'
  ).length;
  const awardedCount = data.filter((d) => d.awardStatus === 'Awarded').length;
  const totalQuotes = data.length;
  const winRate =
    totalQuotes > 0 ? Math.round((awardedCount / totalQuotes) * 100) : 0;

  const statusColors = {
    Done: '#10B981',
    Ongoing: '#3B82F6',
    Pending: '#F59E0B',
    'Waiting for Information': '#FBBF24',
    Cancelled: '#6B7280',
    'No Quote': '#EF4444',
  };

  return (
    <div className="mon-dashboard">
      <h2 className="mon-title">Monitoring Dashboard</h2>
      <div className="mon-summary-cards">
        <div className="mon-card">
          <div className="mon-card-icon" style={{ backgroundColor: '#3B82F6' }}>
            <Clock size={24} />
          </div>
          <div>
            <span className="mon-card-label">Total Pending</span>
            <span className="mon-card-value">{totalPending}</span>
          </div>
        </div>
        <div className="mon-card">
          <div className="mon-card-icon" style={{ backgroundColor: '#EF4444' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <span className="mon-card-label">Overdue</span>
            <span className="mon-card-value">{overdue}</span>
          </div>
        </div>
        <div className="mon-card">
          <div className="mon-card-icon" style={{ backgroundColor: '#10B981' }}>
            <Award size={24} />
          </div>
          <div>
            <span className="mon-card-label">Win Rate</span>
            <span className="mon-card-value">{winRate}%</span>
          </div>
        </div>
      </div>

      <div className="mon-filter-row">
        <div className="mon-filter">
          <Filter size={16} />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mon-filter-select"
          >
            <option value="All">All Statuses</option>
            <option value="Done">Done</option>
            <option value="Ongoing">Ongoing</option>
            <option value="Pending">Pending</option>
            <option value="Waiting for Information">
              Waiting for Information
            </option>
            <option value="Cancelled">Cancelled</option>
            <option value="No Quote">No Quote</option>
          </select>
        </div>
      </div>

      <div className="mon-table-container">
        <table className="mon-table">
          <thead>
            <tr>
              <th>Company Designation</th>
              <th>Department</th>
              <th>RCE No.</th>
              <th>Client</th>
              <th>Project Description</th>
              <th>RCE Received</th>
              <th>Deadline</th>
              <th>Aging (days)</th>
              <th>CE No.</th>
              <th>Status</th>
              <th>Remarks</th>
              <th>CE Submitted</th>
              <th>Received by</th>
              <th>Award Status</th>
              <th>Award Remarks</th>
              <th>Recommended Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id}>
                <td>{row.companyDesignation}</td>
                <td>{row.department}</td>
                <td>{row.rceNo}</td>
                <td>{row.client}</td>
                <td>{row.projectDesc}</td>
                <td>{row.rceReceived}</td>
                <td>{row.deadline}</td>
                <td className={row.aging > 5 ? 'mon-overdue' : ''}>
                  {row.aging}
                </td>
                <td>{row.ceNo || '—'}</td>
                <td>
                  <span
                    className="mon-status-badge"
                    style={{
                      backgroundColor: statusColors[row.status] + '20',
                      color: statusColors[row.status],
                    }}
                  >
                    {row.status}
                  </span>
                </td>
                <td>{row.remarks}</td>
                <td>{row.ceSubmitted || '—'}</td>
                <td>{row.receivedBy}</td>
                <td>
                  <span
                    className="mon-award-badge"
                    style={{
                      backgroundColor:
                        row.awardStatus === 'Awarded'
                          ? '#10B98120'
                          : row.awardStatus === 'Lost Bid'
                          ? '#EF444420'
                          : 'transparent',
                      color:
                        row.awardStatus === 'Awarded'
                          ? '#10B981'
                          : row.awardStatus === 'Lost Bid'
                          ? '#EF4444'
                          : 'inherit',
                    }}
                  >
                    {row.awardStatus || '—'}
                  </span>
                </td>
                <td>{row.awardRemarks || '—'}</td>
                <td>
                  <span className="mon-recommended">
                    {row.recommendedAction}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={16} className="mon-empty">
                  No records match the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function buildDefaultSchemaConfig() {
  return {
    manpower: {
      columns: [
        { key: 'role', label: 'Role / Position', type: 'text', visible: true, isCustom: false },
        { key: 'dailyRate', label: 'Daily Rate', type: 'number', visible: true, isCustom: false },
        { key: 'monthlyRate', label: 'Monthly Rate', type: 'number', visible: true, isCustom: false },
        { key: 'perDiem', label: 'Per Diem', type: 'number', visible: true, isCustom: false },
        { key: 'allowance', label: 'Allowance', type: 'number', visible: true, isCustom: false },
      ],
    },
    equipment: {
      columns: [
        { key: 'description', label: 'Description', type: 'text', visible: true, isCustom: false },
        { key: 'unit', label: 'Unit', type: 'text', visible: true, isCustom: false },
        { key: 'ratePerDay', label: 'Daily Rate', type: 'number', visible: true, isCustom: false },
      ],
    },
    consumables: {
      columns: [
        { key: 'description', label: 'Description', type: 'text', visible: true, isCustom: false },
        { key: 'unit', label: 'Unit', type: 'text', visible: true, isCustom: false },
        { key: 'unitCost', label: 'Unit Cost', type: 'number', visible: true, isCustom: false },
      ],
    },
    ppe: {
      columns: [
        { key: 'item', label: 'Description', type: 'text', visible: true, isCustom: false },
        { key: 'unit', label: 'Unit', type: 'text', visible: true, isCustom: false },
        { key: 'unitCost', label: 'Unit Cost', type: 'number', visible: true, isCustom: false },
      ],
    },
    misc: {
      columns: [
        { key: 'description', label: 'Description', type: 'text', visible: true, isCustom: false },
        { key: 'estimatedCost', label: 'Estimated Cost', type: 'number', visible: true, isCustom: false },
      ],
    },
    clients: {
      columns: [
        { key: 'clientCode', label: 'Client Code', type: 'text', visible: true, isCustom: false },
        { key: 'fullName', label: 'Full Name', type: 'text', visible: true, isCustom: false },
        { key: 'address', label: 'Address', type: 'text', visible: true, isCustom: false },
      ],
    },
  };
}
function SchemaManagerModal({ sheetKey, sheetLabel, config, onClose, onSave }) {
  const [draftColumns, setDraftColumns] = useState(() =>
    JSON.parse(JSON.stringify(config.columns || []))
  );
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState('text');

  const moveUp = (idx) => {
    if (idx === 0) return;
    const next = [...draftColumns];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setDraftColumns(next);
  };

  const moveDown = (idx) => {
    if (idx === draftColumns.length - 1) return;
    const next = [...draftColumns];
    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setDraftColumns(next);
  };

  const updateLabel = (idx, label) => {
    setDraftColumns((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, label } : c))
    );
  };

  const toggleVisible = (idx) => {
    setDraftColumns((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, visible: !c.visible } : c))
    );
  };

  const removeColumn = (idx) => {
    const col = draftColumns[idx];
    if (!col.isCustom) return; // only custom columns can be removed
    setDraftColumns((prev) => prev.filter((_, i) => i !== idx));
  };

  const addColumn = () => {
    const label = newColLabel.trim();
    if (!label) return;
    const key = `custom_${uid('col')}`;
    setDraftColumns((prev) => [
      ...prev,
      {
        key,
        label,
        type: newColType === 'number' ? 'number' : 'text',
        visible: true,
        isCustom: true,
      },
    ]);
    setNewColLabel('');
    setNewColType('text');
  };

  const handleSave = () => {
    onSave({ columns: draftColumns });
    onClose();
  };

  return (
    <div className="ce-modal-overlay" onClick={onClose}>
      <div
        className="ce-modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px' }}
      >
        <h3 className="ce-serif" style={{ marginTop: 0 }}>
  Manage Columns — {sheetLabel}
  {(() => {
    const hiddenCount = draftColumns.filter((c) => !c.visible).length;
    return hiddenCount > 0 ? (
      <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', marginLeft: '0.5rem' }}>
        ({hiddenCount} hidden)
      </span>
    ) : null;
  })()}
</h3>

        <p style={{ color: 'var(--ink-soft)', fontSize: '0.85rem', marginBottom: '1rem' }}>
          Rename, hide, reorder, or add columns. Custom columns can be removed.
        </p>

        <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
          <table className="ce-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Label</th>
                <th style={{ width: '15%' }}>Type</th>
                <th style={{ width: '15%' }}>Visible</th>
                <th style={{ width: '20%' }}>Reorder</th>
                <th style={{ width: '10%' }}></th>
              </tr>
            </thead>
            <tbody>
              {draftColumns.map((col, idx) => (
                <tr key={col.key}>
                  <td>
                    <input
                      className="ce-input"
                      value={col.label}
                      onChange={(e) => updateLabel(idx, e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {col.isCustom ? col.type : col.type}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={col.visible}
                      onChange={() => toggleVisible(idx)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="ce-btn-ghost ce-btn-sm"
                      onClick={() => moveUp(idx)}
                      disabled={idx === 0}
                      type="button"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      className="ce-btn-ghost ce-btn-sm"
                      onClick={() => moveDown(idx)}
                      disabled={idx === draftColumns.length - 1}
                      type="button"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {col.isCustom && (
                      <button
                        className="ce-btn-ghost ce-btn-sm"
                        onClick={() => removeColumn(idx)}
                        type="button"
                        title="Remove custom column"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          style={{
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--border)',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>
            Add Custom Column
          </h4>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              className="ce-input"
              placeholder="Column name (e.g., Supplier)"
              value={newColLabel}
              onChange={(e) => setNewColLabel(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="ce-input"
              value={newColType}
              onChange={(e) => setNewColType(e.target.value)}
              style={{ width: '120px' }}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
            <button
              className="ce-btn-primary ce-btn-sm"
              onClick={addColumn}
              type="button"
              disabled={!newColLabel.trim()}
            >
              + Add
            </button>
          </div>
        </div>

        <div
  className="modal-form-actions"
  style={{ marginTop: '1rem', justifyContent: 'space-between' }}
>
  <button
    className="ce-btn-ghost"
    onClick={() => {
      if (
        window.confirm(
          'Reset this sheet\'s columns to the default layout? Custom columns will be lost.'
        )
      ) {
        onReset();
      }
    }}
    type="button"
    style={{ color: 'var(--danger)' }}
  >
    Reset to Default
  </button>
  <div style={{ display: 'flex', gap: '0.5rem' }}>
    <button className="ce-btn-ghost" onClick={onClose} type="button">
      Cancel
    </button>
    <button className="ce-btn-primary" onClick={handleSave} type="button">
      Save Changes
    </button>
  </div>
</div>
      </div>
    </div>
  );
}
/* ============================= DATABASE MANAGER ============================= */
function DatabaseManager() {
  const store = useMasterlist();
  const [activeTab, setActiveTab] = useState('consumables');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState(null); // which column to sort by
  const [sortDir, setSortDir] = useState('asc'); // 'asc' or 'desc'
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [customFields, setCustomFields] = useState([]); // { id, label, type: 'text'|'number' }
  const [showManageFields, setShowManageFields] = useState(false);
  const [dbSchemaConfig, setDbSchemaConfig] = useState(null);
  const [showSchemaModal, setShowSchemaModal] = useState(false);
  useEffect(() => {
    const loadConfig = () => {
      try {
        const stored = localStorage.getItem('db_schema_config');
        if (stored) {
          setDbSchemaConfig(JSON.parse(stored));
        } else {
          const defaults = buildDefaultSchemaConfig();
          setDbSchemaConfig(defaults);
          localStorage.setItem('db_schema_config', JSON.stringify(defaults));
        }
      } catch (err) {
        console.warn('Could not read schema from localStorage:', err);
        setDbSchemaConfig(buildDefaultSchemaConfig());
      }
      setConfigLoading(false);
    };
  
    loadConfig();
  }, []);
  const saveSchemaConfig = (newConfig) => {
    setDbSchemaConfig(newConfig);
    try {
      localStorage.setItem('db_schema_config', JSON.stringify(newConfig));
    } catch (err) {
      console.warn('Could not save schema to localStorage:', err);
    }
  };
const [configLoading, setConfigLoading] = useState(true);
  const fileInputRef = useRef(null);

  const customTabs = store.customCategories.map((c) => ({
    key: c.categoryKey,
    label: c.categoryName,
  }));
  const allTabs = [
    { key: 'manpower', label: 'Manpower' },
    { key: 'equipment', label: 'Tools & Equipment' },
    { key: 'consumables', label: 'Consumables' },
    { key: 'ppe', label: 'Safety & PPE' },
    { key: 'misc', label: 'Miscellaneous' },
    { key: 'clients', label: 'Clients' },
    ...customTabs,
  ];
  const customCategoryMap = new Map(
    store.customCategories.map((c) => [c.categoryKey, c])
  );
  const isClients = activeTab === 'clients';
  const customCategory = store.customCategories.find(
    (c) => c.categoryKey === activeTab
  );
  const isCustom = !!customCategory;
  const fixedSchema = {
    manpower: {
      label: 'Manpower',
      labelKey: 'role',
      fields: [
        { key: 'role', label: 'Role / Position', type: 'text' },
        { key: 'dailyRate', label: 'Daily Rate', type: 'number' },
        { key: 'monthlyRate', label: 'Monthly Rate', type: 'number' },
        { key: 'perDiem', label: 'Per Diem', type: 'number' },
        { key: 'allowance', label: 'Allowance', type: 'number' },
      ],
    },
    equipment: {
      label: 'Tools & Equipment',
      labelKey: 'description',
      fields: [
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'ratePerDay', label: 'Daily Rate', type: 'number' },
      ],
    },
    consumables: {
      label: 'Consumables',
      labelKey: 'description',
      fields: [
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'unitCost', label: 'Unit Cost', type: 'number' },
      ],
    },
    ppe: {
      label: 'Safety & PPE',
      labelKey: 'item',
      fields: [
        { key: 'item', label: 'Description', type: 'text' },
        { key: 'unit', label: 'Unit', type: 'text' },
        { key: 'unitCost', label: 'Unit Cost', type: 'number' },
      ],
    },
    misc: {
      label: 'Miscellaneous',
      labelKey: 'description',
      fields: [
        { key: 'description', label: 'Description', type: 'text' },
        { key: 'estimatedCost', label: 'Estimated Cost', type: 'number' },
      ],
    },
    clients: {
      label: 'Clients',
      labelKey: 'fullName',
      fields: [
        { key: 'clientCode', label: 'Client Code', type: 'text' },
        { key: 'fullName', label: 'Full Name', type: 'text' },
        { key: 'address', label: 'Address', type: 'text' },
      ],
    },
  }[activeTab];
  const items = isClients
    ? store.clients
    : isCustom
    ? customCategory.items
    : store[activeTab] || [];
    const currentSheetConfig = dbSchemaConfig
    ? dbSchemaConfig[activeTab] || { columns: [] }
    : { columns: [] };
  
  const visibleColumns = currentSheetConfig.columns.filter((c) => c.visible);
  
  // Alias for backward compatibility
  const fields = visibleColumns;
  
  const labelKey = isClients ? 'fullName' : isCustom ? 'name' : 'role';
  const activeLabel =
    (allTabs.find((t) => t.key === activeTab) || {}).label || activeTab;

  function handleSort(key) {
    if (sortKey === key) {
      // Toggle direction if clicking same column
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }
  function handleRenameCategory(category) {
    const newName = window.prompt(
      'Enter new category name:',
      category.categoryName
    );
    if (newName && newName.trim()) {
      store.updateCategory(category.id, { categoryName: newName.trim() });
    }
  }

  function handleDeleteCategory(category) {
    if (
      window.confirm(
        `Delete category "${category.categoryName}"? This cannot be undone.`
      )
    ) {
      store.deleteCategory(category.id);
      if (activeTab === category.categoryKey) {
        setActiveTab('manpower'); // fall back to a fixed tab
      }
    }
  }
  function openAddModal() {
    setModal({ mode: 'add' });
  }
  function handleAddCustomField() {
    const label = window.prompt('Enter field name:');
    if (!label || !label.trim()) return;
    const type = window.prompt('Enter field type: text or number', 'text');
    const normalizedType = type === 'number' ? 'number' : 'text';
    setCustomFields((prev) => [
      ...prev,
      { id: uid('cf'), label: label.trim(), type: normalizedType },
    ]);
  }

  function handleRemoveCustomField(id) {
    if (!window.confirm('Remove this custom field from all items?')) return;
    // Remove field definition
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    // Remove the key from all items in the current category
    const updatedItems = items.map((it) => {
      if (it.customFields && it.customFields[id]) {
        const { [id]: _, ...rest } = it.customFields;
        if (configLoading) {
          return (
            <div className="db-container">
              <div className="db-header">
                <h2>Database</h2>
                <p>Loading database configuration…</p>
              </div>
            </div>
          );
        }
        return { ...it, customFields: rest };
      }
      return it;
    });
    // Update each item via store (we can use bulkUpdateItems if available, but here we update one by one)
    updatedItems.forEach((it) => {
      store.updateItem(activeTab, it.id, { customFields: it.customFields });
    });
  }

  function handleRenameCustomField(id) {
    const field = customFields.find((f) => f.id === id);
    if (!field) return;
    const newLabel = window.prompt('Enter new field name:', field.label);
    if (newLabel && newLabel.trim()) {
      setCustomFields((prev) =>
        prev.map((f) => (f.id === id ? { ...f, label: newLabel.trim() } : f))
      );
    }
  }
  function openEditModal(item) {
    setModal({ mode: 'edit', item });
  }
  function handleModalSave(values) {
    if (isClients) {
      if (modal.mode === 'add') store.addClient(values);
      else store.updateClient(modal.item.id, values);
    } else {
      if (modal.mode === 'add')
        store.addItem(activeTab, { id: uid('ml'), ...values });
      else store.updateItem(activeTab, modal.item.id, values);
    }
    setModal(null);
  }
  function handleDuplicate(id) {
    if (isClients) {
      const src = store.clients.find((c) => c.id === id);
      if (src)
        store.addClient({
          clientCode: src.clientCode,
          fullName: src.fullName ? `${src.fullName} (Copy)` : src.fullName,
          address: src.address,
        });
    } else store.duplicateItem(activeTab, id);
  }
  function handleDelete(id) {
    if (isClients) store.deleteClient(id);
    else store.deleteItem(activeTab, id);
  }

  const filtered = search
    ? items.filter((it) =>
        String(it[labelKey] || '')
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : items;
  const filteredAndSorted = [...filtered].sort((a, b) => {
    if (!sortKey) return 0; // no sorting
    let valA, valB;
    if (sortKey === 'No.') {
      // For the index column, use the original array index
      valA = items.indexOf(a);
      valB = items.indexOf(b);
    } else {
      valA = a[sortKey];
      valB = b[sortKey];
    }
    // Convert to numbers if possible, otherwise strings
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDir === 'asc' ? valA - valB : valB - valA;
    }
    const strA = String(valA ?? '').toLowerCase();
    const strB = String(valB ?? '').toLowerCase();
    if (strA < strB) return sortDir === 'asc' ? -1 : 1;
    if (strA > strB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  const numberFields = fields
    .filter((f) => f.type === 'number')
    .map((f) => f.key);
  const formatNumber = (v) =>
    num(v).toLocaleString('en-PH', { maximumFractionDigits: 2 });

  const handleCSV = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || isClients) return;
    try {
      const rows = await parseDatabaseCSV(file, activeTab);
      if (!rows.length) {
        setToast({
          type: 'error',
          title: 'No valid rows found',
          message: 'Check CSV headers.',
        });
        return;
      }
      store.bulkImportCategoryItems(activeTab, rows);
      setToast({
        type: 'success',
        title: `Imported ${rows.length} item${rows.length > 1 ? 's' : ''}`,
        message: `Added to ${activeLabel}.`,
      });
    } catch (err) {
      setToast({
        type: 'error',
        title: 'Import failed',
        message: err.message || "Couldn't read file.",
      });
    }
  };
  function handleCustomFieldChange(itemId, fieldId, value) {
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    const updatedCustomFields = {
      ...(item.customFields || {}),
      [fieldId]: value,
    };
    store.updateItem(activeTab, itemId, { customFields: updatedCustomFields });
  }
  return (
    <div className="db-container">
      <div className="db-header">
        <h2>Database</h2>
        <p>
          Manage the reference rates, clients, and categories your team pulls
          from when building cost estimates.
        </p>
      </div>
      <div className="db-tabs">
        {allTabs.map((tab) => {
          const customCat = customCategoryMap.get(tab.key);
          return (
            <div key={tab.key} className="db-tab-wrapper">
              <button
                onClick={() => {
                  setActiveTab(tab.key);
                  setSearch('');
                }}
                className={`db-tab ${
                  activeTab === tab.key ? 'db-tab-active' : ''
                }`}
              >
                {tab.label}
              </button>
              {customCat && (
                <span className="db-tab-icons">
                  <button
                    className="db-tab-icon"
                    title="Rename category"
                    onClick={() => handleRenameCategory(customCat)}
                  >
                    ✏️
                  </button>
                  <button
                    className="db-tab-icon"
                    title="Delete category"
                    onClick={() => handleDeleteCategory(customCat)}
                  >
                    🗑️
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="db-actions">
        <div className="db-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${activeLabel.toLowerCase()}…`}
          />
        </div>
        <button
  className="ce-btn-ghost"
  onClick={() => setShowSchemaModal(true)}
  type="button"
  title="Manage columns for this sheet"
>
  ⚙️ Manage Schema
</button>
        <button
          className="ce-btn-ghost"
          onClick={() => setShowManageFields(!showManageFields)}
        >
          <Settings size={15} /> Manage Fields
        </button>
        {showManageFields && (
          <div className="db-manage-fields-panel">
            <h4>Custom Fields</h4>
            <button
              className="ce-btn-ghost ce-btn-sm"
              onClick={handleAddCustomField}
            >
              + Add Field
            </button>
            <ul className="db-custom-fields-list">
              {customFields.map((f) => (
                <li key={f.id} className="db-custom-field-item">
                  <span>
                    {f.label} ({f.type})
                  </span>
                  <button
                    className="ce-btn-ghost ce-btn-sm"
                    onClick={() => handleRenameCustomField(f.id)}
                  >
                    ✏️ Rename
                  </button>
                  <button
                    className="ce-btn-ghost ce-btn-sm"
                    onClick={() => handleRemoveCustomField(f.id)}
                  >
                    🗑️ Remove
                  </button>
                </li>
              ))}
              {customFields.length === 0 && <li>No custom fields yet.</li>}
            </ul>
          </div>
        )}
        <button
          className="ce-btn-ghost"
          onClick={() => setModal({ mode: 'addCategory' })}
        >
          <FolderPlus size={15} /> Add Category
        </button>
        <button
          className="ce-btn-ghost"
          disabled={isClients}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={15} /> Import CSV
        </button>
        <button className="ce-btn-primary" onClick={openAddModal}>
          <Plus size={15} /> Add New Item
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        hidden
        onChange={handleCSV}
      />
      <div className="db-table-card">
        <table className="db-table">
          <thead>
            <tr>
              <th
                style={{ width: 50, cursor: 'pointer' }}
                onClick={() => handleSort('No.')}
              >
                No. {sortKey === 'No.' && (sortDir === 'asc' ? '▲' : '▼')}
              </th>
              {fields.map((f) => (
                <th
                  key={f.key}
                  className={f.type === 'number' ? 'text-right' : ''}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSort(f.key)}
                >
                  {f.label}{' '}
                  {sortKey === f.key && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
              ))}
              {customFields.map((cf) => (
                <th key={cf.id}>{cf.label}</th>
              ))}
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody style={{ minHeight: '200px' }}>
            {filteredAndSorted.length === 0 ? (
              <tr className="db-empty-row">
                <td
                  colSpan={fields.length + customFields.length + 2}
                  className="db-no-match"
                >
                  <div className="db-empty-inline">
                    <UploadCloud size={28} />
                    <p className="db-empty-title">No items yet</p>
                    <div className="db-empty-actions">
                      {!isClients && (
                        <button
                          className="ce-btn-ghost"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload size={13} /> Import CSV
                        </button>
                      )}
                      <button className="ce-btn-primary" onClick={openAddModal}>
                        <Plus size={13} /> Add Item
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredAndSorted.map((it, idx) => (
                <tr key={it.id}>
                  <td className="db-row-num">{idx + 1}</td>
                  {fields.map((f) => {
  if (f.isCustom) {
    return (
      <td key={f.key}>
        <input
          type={f.type === 'number' ? 'number' : 'text'}
          value={it.customFields?.[f.key] || ''}
          onChange={(e) =>
            store.updateItem(activeTab, it.id, {
              customFields: {
                ...(it.customFields || {}),
                [f.key]: e.target.value,
              },
            })
          }
          style={{
            width: '100%',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px',
            fontSize: '0.85rem',
          }}
        />
      </td>
    );
  }
  return (
    <td
      key={f.key}
      className={f.type === 'number' ? 'text-right mono' : ''}
    >
      {f.type === 'number'
        ? formatNumber(Number(it[f.key]) || 0)
        : it[f.key] || '—'}
    </td>
  );
})}
                  <td className="db-actions-cell">
                    <IconBtn title="Edit" onClick={() => openEditModal(it)}>
                      <Pencil size={14} />
                    </IconBtn>
                    <IconBtn
                      title="Duplicate"
                      onClick={() => handleDuplicate(it.id)}
                    >
                      <Copy size={14} />
                    </IconBtn>
                    <IconBtn
                      danger
                      title="Delete"
                      onClick={() => handleDelete(it.id)}
                    >
                      <Trash2 size={14} />
                    </IconBtn>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {modal && modal.mode === 'addCategory' && (
        <Modal title="Add Category" onClose={() => setModal(null)}>
          <AddCategoryModal
            onCancel={() => setModal(null)}
            onSave={(name) => {
              store.addCategory(name);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal && (modal.mode === 'add' || modal.mode === 'edit') && (
        <Modal
          title={
            (modal.mode === 'add' ? 'Add ' : 'Edit ') +
            (isClients ? 'Client' : activeLabel.replace(/s$/, '') + ' Item')
          }
          onClose={() => setModal(null)}
        >
          <ItemFormModal
            fields={fields}
            initialValues={modal.item}
            onCancel={() => setModal(null)}
            onSave={handleModalSave}
          />
        </Modal>
      )}
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
      {showSchemaModal && dbSchemaConfig && (
  <SchemaManagerModal
    sheetKey={activeTab}
    sheetLabel={activeLabel}
    config={dbSchemaConfig[activeTab] || { columns: [] }}
    onClose={() => setShowSchemaModal(false)}
    onReset={() => {
      const defaults = buildDefaultSchemaConfig();
      const defaultSheet = defaults[activeTab] || { columns: [] };
      const newConfig = {
        ...dbSchemaConfig,
        [activeTab]: defaultSheet,
      };
      saveSchemaConfig(newConfig);
      setShowSchemaModal(false);
    }}
    onSave={(newSheetConfig) => {
      const newConfig = {
        ...dbSchemaConfig,
        [activeTab]: newSheetConfig,
      };
      saveSchemaConfig(newConfig);
    }}
  />
)}
    </div>
  );
}

/* ============================= MODAL COMPONENTS ============================= */
function Modal({ title, onClose, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
function ItemFormModal({ fields, initialValues, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => {
    const base = {};
    fields.forEach((f) => {
      if (f.isCustom) {
        base[f.key] = initialValues?.customFields?.[f.key] ?? '';
      } else {
        base[f.key] = initialValues?.[f.key] ?? (f.type === 'number' ? 0 : '');
      }
    });
    return base;
  });
  const labelKey = fields[0]?.key;
  const handleSave = () => {
    const standardData = {};
    const customFieldsObj = {};
    fields.forEach((f) => {
      if (f.isCustom) {
        customFieldsObj[f.key] = draft[f.key];
      } else {
        standardData[f.key] = draft[f.key];
      }
    });
    onSave({ ...standardData, customFields: customFieldsObj });
  };
  return (
    <div className="modal-form-grid">
      {fields.map((f) => (
        <label key={f.key}>
          <span>{f.label}</span>
          <input
            type={f.type === 'number' ? 'number' : 'text'}
            value={draft[f.key]}
            onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
          />
        </label>
      ))}
      <div className="modal-form-actions">
        <button className="ce-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className="ce-btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
function AddCategoryModal({ onCancel, onSave }) {
  const [name, setName] = useState('');
  return (
    <div>
      <label>
        <span>Category Name</span>
        <input
          autoFocus
          value={name}
          placeholder="e.g. Freight & Logistics"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim()) onSave(name.trim());
          }}
        />
      </label>
      <div className="modal-form-actions">
        <button className="ce-btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="ce-btn-primary"
          disabled={!name.trim()}
          onClick={() => onSave(name.trim())}
        >
          Create
        </button>
      </div>
    </div>
  );
}
function Toast({ toast, onDismiss }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [toast]);
  if (!toast) return null;
  const isError = toast.type === 'error';
  return (
    <div
      className={`ce-toast ${isError ? 'ce-toast-error' : 'ce-toast-success'}`}
    >
      {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
      <div>
        <b>{toast.title}</b>
        {toast.message && <p>{toast.message}</p>}
      </div>
      <button onClick={onDismiss}>
        <X size={14} />
      </button>
    </div>
  );
}

/* ============================= CSV PARSER (Papaparse) ============================= */
const CSV_FIELD_MAP = {
  manpower: {
    role: ['role', 'role / position', 'position'],
    dailyRate: ['dailyrate', 'daily rate', 'rate/day', 'rate per day'],
    monthlyRate: [
      'monthlyrate',
      'monthly rate',
      'rate/month',
      'rate per month',
    ],
    perDiem: ['perdiem', 'per diem'],
    allowance: ['allowance'],
  },
  equipment: {
    description: ['description', 'item', 'name'],
    unit: ['unit', 'uom', 'unit of measure'],
    ratePerDay: ['rateperday', 'rate per day', 'daily rate', 'rate/day'],
  },
  consumables: {
    description: ['description', 'item', 'name'],
    unit: ['unit', 'uom', 'unit of measure'],
    unitCost: ['unitcost', 'unit cost', 'cost', 'rate'],
  },
  ppe: {
    item: ['item', 'description', 'name'],
    unit: ['unit', 'uom', 'unit of measure'],
    unitCost: ['unitcost', 'unit cost', 'cost', 'rate'],
  },
  misc: {
    description: ['description', 'item', 'name'],
    estimatedCost: ['estimatedcost', 'estimated cost', 'cost'],
  },
  clients: {
    clientCode: ['clientcode', 'client code', 'code'],
    fullName: ['fullname', 'full name', 'name', 'client'],
    address: ['address', 'addr'],
  },
};

function resolveFieldMapping(headers, categoryKey) {
  const mapping = CSV_FIELD_MAP[categoryKey];
  if (!mapping) return null;
  const normalizedHeaders = headers.map((h) =>
    String(h || '')
      .trim()
      .toLowerCase()
  );
  const result = {};
  for (const [fieldKey, aliases] of Object.entries(mapping)) {
    const matchIdx = aliases.findIndex((alias) =>
      normalizedHeaders.includes(alias)
    );
    if (matchIdx !== -1) {
      result[fieldKey] = headers[normalizedHeaders.indexOf(aliases[matchIdx])];
    }
  }
  return result;
}

function parseDatabaseCSV(file, categoryKey) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => String(h || '').trim(),
      complete: (results) => {
        try {
          if (!results.data || !Array.isArray(results.data)) {
            return reject(new Error('No data found in CSV.'));
          }
          const headers = results.meta?.fields || [];
          if (!headers.length) {
            return reject(new Error('No column headers found in CSV.'));
          }
          const fieldMapping = resolveFieldMapping(headers, categoryKey);
          if (!fieldMapping) {
            return reject(
              new Error(`CSV import is not supported for "${categoryKey}".`)
            );
          }
          const mappedKeys = Object.keys(fieldMapping);
          if (mappedKeys.length === 0) {
            return reject(
              new Error(
                'No matching columns found. Check your CSV headers against the expected fields.'
              )
            );
          }
          const rows = results.data
            .map((rawRow) => {
              const row = {};
              for (const [fieldKey, csvHeader] of Object.entries(
                fieldMapping
              )) {
                const rawVal = rawRow[csvHeader];
                row[fieldKey] =
                  rawVal === undefined || rawVal === null
                    ? ''
                    : String(rawVal).trim();
              }
              return row;
            })
            .filter((row) =>
              Object.values(row).some(
                (v) => v !== '' && v !== null && v !== undefined
              )
            );
          resolve(rows);
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      },
      error: (err) =>
        reject(err instanceof Error ? err : new Error(String(err))),
    });
  });
}
/* ============================= ESTIMATOR DASHBOARD ============================= */
function Dashboard({ ceList, setCurrentView, setActiveCE, setIsParked }) {
  const handleNewCE = () => {
    const newCE = {
      id: `CE-${new Date().getFullYear()}-${String(ceList.length + 1).padStart(
        3,
        '0'
      )}`,
      client: '',
      status: 'Draft',
      project: 'New Cost Estimate',
      lastEdited: new Date().toISOString().slice(0, 10),
      lastEditedBy: 'Estimator A',
    };
    setActiveCE(newCE);
    setCurrentView('editor');
    setIsParked(false);
  };

  const handleOpenCE = (ce) => {
    setActiveCE(ce);
    setCurrentView('editor');
    setIsParked(false);
  };

  return (
    <div className="dash-container">
      <div className="dash-header">
        <h2 className="ce-serif">Cost Estimates</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="ce-btn-primary" onClick={handleNewCE}>
            <Plus size={15} /> New Cost Estimate
          </button>
          <button
            className="ce-btn-ghost"
            onClick={() => setCurrentView('rce-form')}
          >
            <Plus size={15} /> New RCE Request
          </button>
        </div>
      </div>
      <div className="dash-table-card">
        <table className="dash-table">
          <thead>
            <tr>
              <th>CE #</th>
              <th>Client</th>
              <th>Project</th>
              <th>Status</th>
              <th>Last Edited</th>
              <th>Last Edited By</th>
            </tr>
          </thead>
          <tbody>
            {ceList.map((ce) => (
              <tr
                key={ce.id}
                onClick={() => handleOpenCE(ce)}
                style={{ cursor: 'pointer' }}
              >
                <td className="ce-mono">{ce.id}</td>
                <td>{ce.client || '—'}</td>
                <td>{ce.project}</td>
                <td>
                  <span
                    className="dash-status-badge"
                    style={{
                      backgroundColor:
                        ce.status === 'Done'
                          ? '#10B98120'
                          : ce.status === 'Ongoing'
                          ? '#3B82F620'
                          : '#F59E0B20',
                      color:
                        ce.status === 'Done'
                          ? '#10B981'
                          : ce.status === 'Ongoing'
                          ? '#3B82F6'
                          : '#F59E0B',
                    }}
                  >
                    {ce.status}
                  </span>
                </td>
                <td>{ce.lastEdited}</td>
                <td>{ce.lastEditedBy || '—'}</td>
              </tr>
            ))}
            {ceList.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', padding: '2rem' }}
                >
                  No cost estimates yet — create your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
/* ============================= SCOPE LIBRARY PLACEHOLDER ============================= */
function ScopeLibraryPlaceholder() {
  return (
    <div className="placeholder-view">
      <h2 className="ce-serif">Scope Library</h2>
      <p>Coming soon — reusable scope templates will live here.</p>
    </div>
  );
}
/* ============================= LIBRARY VIEW ============================= */
function LibraryView({ onCloneTemplate, onOpenArchivedCE }) {
  const [activeTab, setActiveTab] = useState('templates');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCE, setSelectedCE] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState('Original');

  const templates = [
    {
      id: 'tpl-1',
      title: 'Standard Onsite',
      description: 'Typical site-based cost estimate structure.',
    },
    {
      id: 'tpl-2',
      title: 'Shop',
      description: 'Workshop / fabrication oriented breakdown.',
    },
    {
      id: 'tpl-3',
      title: 'Hybrid',
      description: 'Mix of onsite and shop tasks.',
    },
    {
      id: 'tpl-4',
      title: 'Trading',
      description: 'Trading / resale cost model.',
    },
  ];

  const archivedCEs = [
    {
      id: 'CE-2024-101',
      client: 'ABC Corp',
      project: 'Turbine Overhaul',
      date: '2024-11-12',
      rceNo: 'RCE-2024-088',
      status: 'Awarded',
      description:
        'Complete overhaul of steam turbine including rotor replacement and alignment.',
    },
    {
      id: 'CE-2024-102',
      client: 'XYZ Ltd',
      project: 'Piping Fabrication',
      date: '2024-10-03',
      rceNo: 'RCE-2024-079',
      status: 'Lost Bid',
      description:
        'Fabrication and installation of stainless steel piping for chemical plant.',
    },
    {
      id: 'CE-2024-103',
      client: 'DEF Inc',
      project: 'Electrical Upgrade',
      date: '2024-09-20',
      rceNo: 'RCE-2024-071',
      status: 'Pending',
      description: 'Upgrade of main switchgear and distribution panels.',
    },
    {
      id: 'CE-2024-104',
      client: 'GHI Corp',
      project: 'Boiler Retubing',
      date: '2024-08-15',
      rceNo: 'RCE-2024-065',
      status: 'Done',
      description: 'Replacement of boiler tubes and refractory lining.',
    },
  ];

  const versions = [
    { label: 'Original', key: 'Original' },
    { label: 'Revision 1', key: 'Revision 1' },
    { label: 'Update', key: 'Update' },
  ];

  const evidenceMap = {
    Original: [
      'Supplier Quote.pdf',
      'Scope of Work.docx',
      'Initial Pricing.xlsx',
    ],
    'Revision 1': [
      'Change Order.pdf',
      'Updated Drawings.pdf',
      'Revised Quote.xlsx',
    ],
    Update: [
      'Final Approval.pdf',
      'As-Built Drawings.pdf',
      'Warranty Certificate.pdf',
    ],
  };

  const filteredArchivedCEs = archivedCEs.filter(
    (ce) =>
      ce.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ce.project.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ce.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ce.rceNo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="lib-container">
      <div className="lib-tabs">
        <button
          className={`ce-pill ${
            activeTab === 'templates' ? 'ce-pill-active' : ''
          }`}
          onClick={() => setActiveTab('templates')}
        >
          Templates
        </button>
        <button
          className={`ce-pill ${
            activeTab === 'archive' ? 'ce-pill-active' : ''
          }`}
          onClick={() => setActiveTab('archive')}
        >
          Search Archive
        </button>
      </div>

      {activeTab === 'templates' && (
        <div className="lib-templates-grid">
          {templates.map((tpl) => (
            <div key={tpl.id} className="ce-card lib-template-card">
              <h3 className="ce-serif lib-template-title">{tpl.title}</h3>
              <p className="lib-template-desc">{tpl.description}</p>
              <button
                className="ce-btn-ghost ce-btn-sm"
                onClick={() => onCloneTemplate && onCloneTemplate(tpl.id)}
                type="button"
              >
                <Copy size={14} /> Clone
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'archive' && (
        <div className="lib-archive">
          {!selectedCE ? (
            <>
              <div className="lib-search-row">
                <div className="lib-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search by client, project, CE # or RCE #"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="lib-archive-table-wrap">
                <table className="ce-table lib-archive-table">
                  <thead>
                    <tr>
                      <th>CE #</th>
                      <th>RCE #</th>
                      <th>Client</th>
                      <th>Project</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredArchivedCEs.map((ce) => (
                      <tr
                        key={ce.id}
                        onClick={() => {
                          setSelectedCE(ce);
                          setSelectedVersion('Original');
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="ce-mono">{ce.id}</td>
                        <td className="ce-mono">{ce.rceNo}</td>
                        <td>{ce.client}</td>
                        <td>{ce.project}</td>
                        <td>
                          <span
                            className="dash-status-badge"
                            style={{
                              backgroundColor:
                                ce.status === 'Awarded' || ce.status === 'Done'
                                  ? '#10B98120'
                                  : ce.status === 'Pending'
                                  ? '#F59E0B20'
                                  : '#EF444420',
                              color:
                                ce.status === 'Awarded' || ce.status === 'Done'
                                  ? '#10B981'
                                  : ce.status === 'Pending'
                                  ? '#F59E0B'
                                  : '#EF4444',
                            }}
                          >
                            {ce.status}
                          </span>
                        </td>
                        <td>{ce.date}</td>
                      </tr>
                    ))}
                    {filteredArchivedCEs.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          style={{ textAlign: 'center', padding: '1rem' }}
                        >
                          No archived CE matches your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="lib-detail-view">
              <button
                className="ce-btn-ghost ce-btn-sm"
                onClick={() => setSelectedCE(null)}
                type="button"
                style={{ marginBottom: '1rem' }}
              >
                ← Back to Search
              </button>

              <div className="lib-detail-header">
                <h3 className="ce-serif lib-detail-title">
                  {selectedCE.id} — {selectedCE.project}
                </h3>
                <div className="lib-detail-meta">
                  <span>RCE #: {selectedCE.rceNo}</span>
                  <span>Status: {selectedCE.status}</span>
                </div>
                <p className="lib-detail-desc">{selectedCE.description}</p>
              </div>

              <div className="lib-detail-body">
                <div className="lib-versions-column">
                  <span className="ce-field-label">Versions Timeline</span>
                  <ul className="lib-versions-list">
                    {versions.map((v) => (
                      <li
                        key={v.key}
                        className={`lib-version-item ${
                          selectedVersion === v.key
                            ? 'lib-version-item-active'
                            : ''
                        }`}
                        onClick={() => setSelectedVersion(v.key)}
                        style={{ cursor: 'pointer' }}
                      >
                        <span
                          className={`lib-version-dot ${
                            v.key === 'Original'
                              ? 'lib-version-dot-original'
                              : ''
                          }`}
                        />
                        <span>{v.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="lib-evidence-column">
                  <span className="ce-field-label">Evidence Locker</span>
                  <ul className="lib-evidence-list">
                    {(evidenceMap[selectedVersion] || []).map((file, idx) => (
                      <li key={idx} className="lib-evidence-item">
                        <FileText size={14} />
                        <span>{file}</span>
                      </li>
                    ))}
                  </ul>
                  {onOpenArchivedCE && (
                    <button
                      className="ce-btn-primary ce-btn-sm"
                      onClick={() => onOpenArchivedCE(selectedCE.id)}
                      type="button"
                      style={{ marginTop: '1rem' }}
                    >
                      Open this CE
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
/* ============================= SALES RCE FORM ============================= */
function SalesRCEForm({
  onSubmitRCE,
  onBack,
  readOnly = false,
  initialData = null,
}) {
  const COMPANY_CONFIG = {
    'Company 1': {
      logo: '🏭',
      docControlNo: 'DC-001-2024',
      revisionDate: '2024-08-15',
      customer: 'ABBRE - FULL NAME (CL1 - CLIENT 1)',
      item2Text: 'IN-LINE WITH COMPANY 1 PRODUCTS AND SERVICES',
      salesManager: 'Juan Dela Cruz',
      address: '123 Main St, Makati City',
    },
    'Company 2': {
      logo: '🏢',
      docControlNo: 'DC-002-2024',
      revisionDate: '2024-09-01',
      customer: 'ABBRE2 - FULL NAME (CL2 - CLIENT 2)',
      item2Text: 'IN-LINE WITH COMPANY 2 PRODUCTS AND SERVICES',
      salesManager: 'Maria Santos',
      address: '456 Second Ave, Quezon City',
    },
  };

  // Set initial company based on initialData or default
  const initialCompany = initialData?.company || 'Company 1';
  const [company, setCompany] = useState(initialCompany);
  const config = COMPANY_CONFIG[company];

  // Pre-populate form state from initialData, falling back to defaults
  const [form, setForm] = useState(() => {
    const base = {
      projectType: 'New Project',
      inquiryNumber: '',
      inquiryDate: '',
      rceNo: generateRceNo(),
      rceDate: new Date().toISOString().slice(0, 10),
      projectTitle: '',
      priorityLevel: 'Medium',
      ceDeadline: '',
      submissionDeadline: '',
      shopwork: false,
      onsite: false,
      trading: false,
      mechanical: false,
      electrical: false,
      otherRemarks: '',
      declineReason: '',
      preparedBy: '',
      reviewedBy: config.salesManager,
      approvedBy: '',
    };
    if (initialData) {
      return { ...base, ...initialData };
    }
    return base;
  });

  const [checklist, setChecklist] = useState(() => {
    const emptyChecklist = {
      item1: { complete: '', remarks: '' },
      item2: { complete: '', remarks: '' },
      item3: { complete: '', remarks: '' },
      item4: { complete: '', remarks: '' },
      item5: { complete: '', remarks: '' },
      item6: { complete: '', remarks: '' },
      item7: { complete: '', remarks: '' },
      item8: { complete: '', remarks: '' },
      item9: { complete: '', remarks: '' },
      item10: { complete: '', remarks: '' },
      item11: { complete: '', remarks: '' },
      item12: { complete: '', remarks: '' },
      item13: { complete: '', remarks: '' },
      item14_1: { complete: '', remarks: '' },
      item14_2: { complete: '', remarks: '' },
      item14_3: { complete: '', remarks: '' },
    };
    if (initialData?.checklist) {
      return { ...emptyChecklist, ...initialData.checklist };
    }
    return emptyChecklist;
  });

  const [attachments, setAttachments] = useState(() =>
    (initialData?.attachments || []).map((name) => ({
      name,
      url: '', // no real URL in read-only; we only show names
      type: '',
    }))
  );
  const [showPage2, setShowPage2] = useState(false);

  function generateRceNo() {
    return `RCE-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 1000)
    ).padStart(3, '0')}`;
  }

  const handleChecklistChange = (key, field, value) => {
    if (readOnly) return;
    setChecklist((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleFileUpload = (e) => {
    if (readOnly) return;
    const files = Array.from(e.target.files);
    const fileObjects = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
    }));
    setAttachments((prev) => [...prev, ...fileObjects]);
  };

  const handleSubmit = () => {
    if (readOnly) return; // just in case
    const rceData = {
      ...form,
      company,
      customer: config.customer,
      address: config.address,
      checklist: checklist,
      attachments: attachments.map((a) => a.name),
    };
    if (onSubmitRCE) {
      onSubmitRCE(rceData);
    }
    setShowPage2(true);
  };

  const handleNew = () => {
    if (readOnly) return;
    setForm({
      projectType: 'New Project',
      inquiryNumber: '',
      inquiryDate: '',
      rceNo: generateRceNo(),
      rceDate: new Date().toISOString().slice(0, 10),
      projectTitle: '',
      priorityLevel: 'Medium',
      ceDeadline: '',
      submissionDeadline: '',
      shopwork: false,
      onsite: false,
      trading: false,
      mechanical: false,
      electrical: false,
      otherRemarks: '',
      declineReason: '',
      preparedBy: '',
      reviewedBy: config.salesManager,
      approvedBy: '',
    });
    setChecklist({
      item1: { complete: '', remarks: '' },
      item2: { complete: '', remarks: '' },
      item3: { complete: '', remarks: '' },
      item4: { complete: '', remarks: '' },
      item5: { complete: '', remarks: '' },
      item6: { complete: '', remarks: '' },
      item7: { complete: '', remarks: '' },
      item8: { complete: '', remarks: '' },
      item9: { complete: '', remarks: '' },
      item10: { complete: '', remarks: '' },
      item11: { complete: '', remarks: '' },
      item12: { complete: '', remarks: '' },
      item13: { complete: '', remarks: '' },
      item14_1: { complete: '', remarks: '' },
      item14_2: { complete: '', remarks: '' },
      item14_3: { complete: '', remarks: '' },
    });
    setAttachments([]);
    setShowPage2(false);
  };

  return (
    <div className="rce-checklist-container">
      {/* Hide internal back button when readOnly */}
      {!readOnly && (
        <button className="ce-btn-ghost ce-btn-sm" onClick={onBack}>
          ← Back to Dashboard
        </button>
      )}

      <div className="rce-company-toggle">
        <span>Select Company:</span>
        <button
          className={`ce-pill ${
            company === 'Company 1' ? 'ce-pill-active' : ''
          }`}
          onClick={() => !readOnly && setCompany('Company 1')}
          disabled={readOnly}
        >
          Company 1
        </button>
        <button
          className={`ce-pill ${
            company === 'Company 2' ? 'ce-pill-active' : ''
          }`}
          onClick={() => !readOnly && setCompany('Company 2')}
          disabled={readOnly}
        >
          Company 2
        </button>
      </div>

      <div className="rce-header">
        <div className="rce-logo-box">
          <span className="rce-logo-text">{config.logo}</span>
        </div>
        <div className="rce-doc-control">
          <p>Doc. Control No.: {config.docControlNo}</p>
          <p>Revision Date: {config.revisionDate}</p>
        </div>
      </div>

      <h2 className="rce-title">REQUEST FOR COSTING (RCE) CHECKLIST FORM</h2>

      <div className="rce-radio-row">
        <label>
          <input
            type="radio"
            name="projectType"
            value="New Project"
            checked={form.projectType === 'New Project'}
            onChange={(e) =>
              !readOnly && setForm({ ...form, projectType: e.target.value })
            }
            disabled={readOnly}
          />
          New Project
        </label>
        <label>
          <input
            type="radio"
            name="projectType"
            value="Existing Project"
            checked={form.projectType === 'Existing Project'}
            onChange={(e) =>
              !readOnly && setForm({ ...form, projectType: e.target.value })
            }
            disabled={readOnly}
          />
          Existing Project
        </label>
      </div>

      <div className="rce-input-grid">
        <div className="rce-field">
          <label>Customer</label>
          <input type="text" value={config.customer} readOnly />
        </div>
        <div className="rce-field">
          <label>Address</label>
          <input type="text" value={config.address} readOnly />
        </div>
        <div className="rce-field">
          <label>Inquiry Number</label>
          <input
            type="text"
            value={form.inquiryNumber}
            onChange={(e) =>
              !readOnly && setForm({ ...form, inquiryNumber: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
        <div className="rce-field">
          <label>Inquiry Date</label>
          <input
            type="date"
            value={form.inquiryDate}
            onChange={(e) =>
              !readOnly && setForm({ ...form, inquiryDate: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
        <div className="rce-field">
          <label>RCE No (Auto)</label>
          <input type="text" value={form.rceNo} readOnly />
        </div>
        <div className="rce-field">
          <label>RCE Date</label>
          <input
            type="date"
            value={form.rceDate}
            onChange={(e) =>
              !readOnly && setForm({ ...form, rceDate: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
        <div className="rce-field">
          <label>Project Title</label>
          <input
            type="text"
            value={form.projectTitle}
            onChange={(e) =>
              !readOnly && setForm({ ...form, projectTitle: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
        <div className="rce-field">
          <label>Priority Level</label>
          <select
            value={form.priorityLevel}
            onChange={(e) =>
              !readOnly && setForm({ ...form, priorityLevel: e.target.value })
            }
            disabled={readOnly}
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
        <div className="rce-field">
          <label>CE Deadline</label>
          <input
            type="date"
            value={form.ceDeadline}
            onChange={(e) =>
              !readOnly && setForm({ ...form, ceDeadline: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
        <div className="rce-field">
          <label>Submission Deadline</label>
          <input
            type="date"
            value={form.submissionDeadline}
            onChange={(e) =>
              !readOnly &&
              setForm({ ...form, submissionDeadline: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="rce-checkbox-group">
        <span>Project Type:</span>
        <label>
          <input
            type="checkbox"
            checked={form.shopwork}
            onChange={(e) =>
              !readOnly && setForm({ ...form, shopwork: e.target.checked })
            }
            disabled={readOnly}
          />
          Shopwork
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.onsite}
            onChange={(e) =>
              !readOnly && setForm({ ...form, onsite: e.target.checked })
            }
            disabled={readOnly}
          />
          On-site
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.trading}
            onChange={(e) =>
              !readOnly && setForm({ ...form, trading: e.target.checked })
            }
            disabled={readOnly}
          />
          Trading
        </label>
      </div>
      <div className="rce-checkbox-group">
        <span>Department:</span>
        <label>
          <input
            type="checkbox"
            checked={form.mechanical}
            onChange={(e) =>
              !readOnly && setForm({ ...form, mechanical: e.target.checked })
            }
            disabled={readOnly}
          />
          Mechanical
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.electrical}
            onChange={(e) =>
              !readOnly && setForm({ ...form, electrical: e.target.checked })
            }
            disabled={readOnly}
          />
          Electrical
        </label>
      </div>

      <table className="rce-checklist-table">
        <thead>
          <tr>
            <th>ITEM NO.</th>
            <th>DESCRIPTION</th>
            <th>COMPLETE? (YES/NO/N/A)</th>
            <th>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          <ChecklistRow
            num="1"
            desc="CUSTOMER PROVIDED COMPLETE SPECIFICATIONS"
            complete={checklist.item1.complete}
            remarks={checklist.item1.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item1', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item1', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="2"
            desc={config.item2Text}
            complete={checklist.item2.complete}
            remarks={checklist.item2.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item2', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item2', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="3"
            desc="PROJECT SCOPE CLEARLY DEFINED"
            complete={checklist.item3.complete}
            remarks={checklist.item3.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item3', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item3', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="4"
            desc="REQUIRED DELIVERY DATE PROVIDED"
            complete={checklist.item4.complete}
            remarks={checklist.item4.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item4', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item4', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="5"
            desc="BUDGETARY TARGET PROVIDED (IF ANY)"
            complete={checklist.item5.complete}
            remarks={checklist.item5.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item5', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item5', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="6"
            desc="COMMERCIAL TERMS AVAILABLE (PAYMENT, WARRANTY, ETC.)"
            complete={checklist.item6.complete}
            remarks={checklist.item6.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item6', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item6', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="7"
            desc="TECHNICAL DRAWINGS / SKETCHES ATTACHED"
            complete={checklist.item7.complete}
            remarks={checklist.item7.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item7', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item7', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="8"
            desc="BILL OF MATERIALS AVAILABLE"
            complete={checklist.item8.complete}
            remarks={checklist.item8.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item8', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item8', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="9"
            desc="SITE CONDITIONS / ACCESS DETAILS PROVIDED"
            complete={checklist.item9.complete}
            remarks={checklist.item9.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item9', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item9', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="10"
            desc="PERMITS / COMPLIANCE REQUIREMENTS KNOWN"
            complete={checklist.item10.complete}
            remarks={checklist.item10.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item10', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item10', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="11"
            desc="SAFETY REQUIREMENTS IDENTIFIED"
            complete={checklist.item11.complete}
            remarks={checklist.item11.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item11', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item11', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="12"
            desc="TESTING / INSPECTION CRITERIA DEFINED"
            complete={checklist.item12.complete}
            remarks={checklist.item12.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item12', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item12', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="13"
            desc="OTHER SPECIAL REQUIREMENTS"
            complete={checklist.item13.complete}
            remarks={checklist.item13.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item13', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item13', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <tr>
            <td>14</td>
            <td>ATTACHMENTS</td>
            <td></td>
            <td></td>
          </tr>
          <ChecklistRow
            num="14.1"
            desc="DRAWINGS"
            complete={checklist.item14_1.complete}
            remarks={checklist.item14_1.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item14_1', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item14_1', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="14.2"
            desc="SPECIFICATIONS"
            complete={checklist.item14_2.complete}
            remarks={checklist.item14_2.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item14_2', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item14_2', 'remarks', v)
            }
            readOnly={readOnly}
          />
          <ChecklistRow
            num="14.3"
            desc="OTHER DOCUMENTS"
            complete={checklist.item14_3.complete}
            remarks={checklist.item14_3.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item14_3', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item14_3', 'remarks', v)
            }
            readOnly={readOnly}
          />
        </tbody>
      </table>

      <div className="rce-textarea-group">
        <label>OTHER REMARKS:</label>
        <textarea
          rows="3"
          value={form.otherRemarks}
          onChange={(e) =>
            !readOnly && setForm({ ...form, otherRemarks: e.target.value })
          }
          disabled={readOnly}
        />
      </div>
      <div className="rce-textarea-group">
        <label>REASON TO DECLINE / NO QUOTE:</label>
        <textarea
          rows="3"
          value={form.declineReason}
          onChange={(e) =>
            !readOnly && setForm({ ...form, declineReason: e.target.value })
          }
          disabled={readOnly}
        />
      </div>

      <div className="rce-upload">
        <label>Upload Attachments (PDF, Images):</label>
        <input
          type="file"
          multiple
          onChange={handleFileUpload}
          accept=".pdf,image/*"
          disabled={readOnly}
        />
      </div>

      <div className="rce-signatures">
        <div>
          <label>Prepared by (Sales Rep)</label>
          <input
            type="text"
            value={form.preparedBy}
            onChange={(e) =>
              !readOnly && setForm({ ...form, preparedBy: e.target.value })
            }
            placeholder="Name"
            disabled={readOnly}
          />
        </div>
        <div>
          <label>Reviewed by (Sales Manager)</label>
          <input
            type="text"
            value={form.reviewedBy}
            onChange={(e) =>
              !readOnly && setForm({ ...form, reviewedBy: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
        <div>
          <label>Approved by (Technical Service Group)</label>
          <input
            type="text"
            value={form.approvedBy}
            onChange={(e) =>
              !readOnly && setForm({ ...form, approvedBy: e.target.value })
            }
            disabled={readOnly}
          />
        </div>
      </div>

      {!readOnly && (
        <div className="rce-actions">
          <button className="ce-btn-primary" onClick={handleSubmit}>
            Submit
          </button>
          <button className="ce-btn-ghost" onClick={handleNew}>
            New RCE
          </button>
          {showPage2 && (
            <button
              className="ce-btn-ghost"
              onClick={() => setShowPage2(!showPage2)}
            >
              {showPage2 ? 'Hide Page 2' : 'Show Page 2 (Attachments)'}
            </button>
          )}
        </div>
      )}

      {/* Page 2 simulation only in edit mode */}
      {!readOnly && showPage2 && (
        <div className="rce-page2">
          <hr />
          <h3>Page 2 — Attachments</h3>
          {attachments.length === 0 ? (
            <p>No attachments uploaded.</p>
          ) : (
            <div className="rce-attachment-grid">
              {attachments.map((att, idx) => (
                <div key={idx} className="rce-attachment-item">
                  <strong>{att.name}</strong>
                  {att.type.startsWith('image/') ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      style={{ maxWidth: '200px' }}
                    />
                  ) : (
                    <a href={att.url} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Updated ChecklistRow to respect readOnly
function ChecklistRow({
  num,
  desc,
  complete,
  remarks,
  onCompleteChange,
  onRemarksChange,
  readOnly = false,
}) {
  return (
    <tr>
      <td>{num}</td>
      <td>{desc}</td>
      <td>
        <select
          value={complete}
          onChange={(e) => onCompleteChange(e.target.value)}
          style={{ width: '100%' }}
          disabled={readOnly}
        >
          <option value="">Select</option>
          <option value="YES">YES</option>
          <option value="NO">NO</option>
          <option value="N/A">N/A</option>
        </select>
      </td>
      <td>
        <input
          type="text"
          value={remarks}
          onChange={(e) => onRemarksChange(e.target.value)}
          placeholder="Remarks"
          style={{ width: '100%' }}
          disabled={readOnly}
        />
      </td>
    </tr>
  );
}

// Updated ChecklistRow helper (must be placed before SalesRCEForm if you use it)
/* ============================= RCE INBOX ============================= */
function RCEInbox({ rceList, onViewRCE }) {
  // Helper to build a Project Type string from checkboxes
  const getProjectType = (rce) => {
    const types = [];
    if (rce.shopwork) types.push('Shopwork');
    if (rce.onsite) types.push('On-site');
    if (rce.trading) types.push('Trading');
    return types.length > 0 ? types.join(', ') : '—';
  };

  return (
    <div className="rce-inbox-container">
      <h2 className="ce-serif">RCE Requests</h2>
      <table className="ce-table rce-table">
        <thead>
          <tr>
            <th>RCE #</th>
            <th>Client</th>
            <th>Project Title</th>
            <th>Project Type</th>
            <th>Priority</th>
            <th>Date Received</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rceList.map((rce) => (
            <tr key={rce.id}>
              <td className="ce-mono">{rce.id}</td>
              <td>{rce.client}</td>
              <td>{rce.projectTitle || rce.description || '—'}</td>
              <td>{getProjectType(rce)}</td>
              <td>{rce.priorityLevel || '—'}</td>
              <td>{rce.dateReceived || '—'}</td>
              <td>{rce.status || '—'}</td>
              <td>
                <button
                  className="ce-btn-ghost ce-btn-sm"
                  onClick={() => onViewRCE(rce)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
          {rceList.length === 0 && (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '1rem' }}>
                No RCE requests yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
/* ============================= RCE DETAIL ============================= */
function RCEDetail({ rce, onBack, onGenerateCE }) {
  const [selectedAttachment, setSelectedAttachment] = useState(null); // for evidence locker

  if (!rce) {
    return (
      <div className="rce-detail-container">
        <button className="ce-btn-ghost ce-btn-sm" onClick={onBack}>
          ← Back to RCE Inbox
        </button>
        <p>No RCE selected.</p>
      </div>
    );
  }

  return (
    <div className="rce-detail-container">
      <button className="ce-btn-ghost ce-btn-sm" onClick={onBack}>
        ← Back to RCE Inbox
      </button>

      {/* Render the checklist form in read-only mode with data */}
      <SalesRCEForm
        readOnly={true}
        initialData={rce}
        onBack={onBack}
        onSubmitRCE={() => {}}
      />

      {/* Evidence Locker section */}
      <div className="evidence-locker-section">
        <h3 className="ce-serif">Evidence Locker</h3>
        <div className="evidence-locker-buttons">
          {rce.attachments && rce.attachments.length > 0 ? (
            rce.attachments.map((att, idx) => (
              <button
                key={idx}
                className="evidence-locker-button"
                onClick={() => setSelectedAttachment(att)}
              >
                <FileText size={16} />
                <span>{att}</span>
              </button>
            ))
          ) : (
            <p>No attachments uploaded.</p>
          )}
        </div>
      </div>

      {/* Generate Cost Estimate button */}
      <button className="ce-btn-primary" onClick={() => onGenerateCE(rce)}>
        Generate Cost Estimate
      </button>

      {/* Evidence Locker Modal / Side Panel */}
      {selectedAttachment && (
        <div
          className="evidence-modal-overlay"
          onClick={() => setSelectedAttachment(null)}
        >
          <div className="evidence-modal" onClick={(e) => e.stopPropagation()}>
            <div className="evidence-modal-header">
              <h4 className="ce-serif">Attachment Preview</h4>
              <button
                className="ce-btn-ghost ce-btn-sm"
                onClick={() => setSelectedAttachment(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="evidence-modal-body">
              <p>
                <strong>File:</strong> {selectedAttachment}
              </p>
              <p>Simulated preview — real file content would appear here.</p>
              {/* If we had actual URLs, we could show an iframe or image */}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
/* ============================= RCE CHECKLIST FORM ============================= */
function RCEChecklistForm({ onSubmitRCE, onBack }) {
  const COMPANY_CONFIG = {
    'Company 1': {
      logo: '🏭',
      docControlNo: 'DC-001-2024',
      revisionDate: '2024-08-15',
      customer: 'ABBRE - FULL NAME (CL1 - CLIENT 1)',
      item2Text: 'IN-LINE WITH COMPANY 1 PRODUCTS AND SERVICES',
      salesManager: 'Juan Dela Cruz',
      address: '123 Main St, Makati City',
    },
    'Company 2': {
      logo: '🏢',
      docControlNo: 'DC-002-2024',
      revisionDate: '2024-09-01',
      customer: 'ABBRE2 - FULL NAME (CL2 - CLIENT 2)',
      item2Text: 'IN-LINE WITH COMPANY 2 PRODUCTS AND SERVICES',
      salesManager: 'Maria Santos',
      address: '456 Second Ave, Quezon City',
    },
  };

  const [company, setCompany] = useState('Company 1');
  const config = COMPANY_CONFIG[company];

  const [form, setForm] = useState({
    projectType: 'New Project',
    inquiryNumber: '',
    inquiryDate: '',
    rceNo: generateRceNo(),
    rceDate: new Date().toISOString().slice(0, 10),
    projectTitle: '',
    priorityLevel: 'Medium',
    ceDeadline: '',
    submissionDeadline: '',
    shopwork: false,
    onsite: false,
    trading: false,
    mechanical: false,
    electrical: false,
    otherRemarks: '',
    declineReason: '',
    preparedBy: '',
    reviewedBy: config.salesManager,
    approvedBy: '',
  });

  // State for checklist rows (14.1, 14.2, 14.3)
  const [checklist, setChecklist] = useState({
    item1: { complete: '', remarks: '' },
    item2: { complete: '', remarks: '' },
    item3: { complete: '', remarks: '' },
    item4: { complete: '', remarks: '' },
    item5: { complete: '', remarks: '' },
    item6: { complete: '', remarks: '' },
    item7: { complete: '', remarks: '' },
    item8: { complete: '', remarks: '' },
    item9: { complete: '', remarks: '' },
    item10: { complete: '', remarks: '' },
    item11: { complete: '', remarks: '' },
    item12: { complete: '', remarks: '' },
    item13: { complete: '', remarks: '' },
    item14_1: { complete: '', remarks: '' },
    item14_2: { complete: '', remarks: '' },
    item14_3: { complete: '', remarks: '' },
  });

  const [attachments, setAttachments] = useState([]);
  const [showPage2, setShowPage2] = useState(false);

  function generateRceNo() {
    return `RCE-${new Date().getFullYear()}-${String(
      Math.floor(Math.random() * 1000)
    ).padStart(3, '0')}`;
  }

  const handleChecklistChange = (key, field, value) => {
    setChecklist((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    const fileObjects = files.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
    }));
    setAttachments((prev) => [...prev, ...fileObjects]);
  };

  const handleSubmit = () => {
    const rceData = {
      ...form,
      company,
      customer: config.customer,
      address: config.address,
      checklist: checklist,
      attachments: attachments.map((a) => a.name),
    };
    if (onSubmitRCE) {
      onSubmitRCE(rceData);
    }
    setShowPage2(true); // simulate merging after submit
  };

  const handleNew = () => {
    setForm({
      projectType: 'New Project',
      inquiryNumber: '',
      inquiryDate: '',
      rceNo: generateRceNo(),
      rceDate: new Date().toISOString().slice(0, 10),
      projectTitle: '',
      priorityLevel: 'Medium',
      ceDeadline: '',
      submissionDeadline: '',
      shopwork: false,
      onsite: false,
      trading: false,
      mechanical: false,
      electrical: false,
      otherRemarks: '',
      declineReason: '',
      preparedBy: '',
      reviewedBy: config.salesManager,
      approvedBy: '',
    });
    setChecklist({
      item1: { complete: '', remarks: '' },
      item2: { complete: '', remarks: '' },
      item3: { complete: '', remarks: '' },
      item4: { complete: '', remarks: '' },
      item5: { complete: '', remarks: '' },
      item6: { complete: '', remarks: '' },
      item7: { complete: '', remarks: '' },
      item8: { complete: '', remarks: '' },
      item9: { complete: '', remarks: '' },
      item10: { complete: '', remarks: '' },
      item11: { complete: '', remarks: '' },
      item12: { complete: '', remarks: '' },
      item13: { complete: '', remarks: '' },
      item14_1: { complete: '', remarks: '' },
      item14_2: { complete: '', remarks: '' },
      item14_3: { complete: '', remarks: '' },
    });
    setAttachments([]);
    setShowPage2(false);
  };

  return (
    <div className="rce-checklist-container">
      <button className="ce-btn-ghost ce-btn-sm" onClick={onBack}>
        ← Back to Dashboard
      </button>

      <div className="rce-company-toggle">
        <span>Select Company:</span>
        <button
          className={`ce-pill ${
            company === 'Company 1' ? 'ce-pill-active' : ''
          }`}
          onClick={() => setCompany('Company 1')}
        >
          Company 1
        </button>
        <button
          className={`ce-pill ${
            company === 'Company 2' ? 'ce-pill-active' : ''
          }`}
          onClick={() => setCompany('Company 2')}
        >
          Company 2
        </button>
      </div>

      {/* Header */}
      <div className="rce-header">
        <div className="rce-logo-box">
          <span className="rce-logo-text">{config.logo}</span>
        </div>
        <div className="rce-doc-control">
          <p>Doc. Control No.: {config.docControlNo}</p>
          <p>Revision Date: {config.revisionDate}</p>
        </div>
      </div>

      <h2 className="rce-title">REQUEST FOR COSTING (RCE) CHECKLIST FORM</h2>

      <div className="rce-radio-row">
        <label>
          <input
            type="radio"
            name="projectType"
            value="New Project"
            checked={form.projectType === 'New Project'}
            onChange={(e) => setForm({ ...form, projectType: e.target.value })}
          />
          New Project
        </label>
        <label>
          <input
            type="radio"
            name="projectType"
            value="Existing Project"
            checked={form.projectType === 'Existing Project'}
            onChange={(e) => setForm({ ...form, projectType: e.target.value })}
          />
          Existing Project
        </label>
      </div>

      <div className="rce-input-grid">
        <div className="rce-field">
          <label>Customer</label>
          <input type="text" value={config.customer} readOnly />
        </div>
        <div className="rce-field">
          <label>Address</label>
          <input type="text" value={config.address} readOnly />
        </div>
        <div className="rce-field">
          <label>Inquiry Number</label>
          <input
            type="text"
            value={form.inquiryNumber}
            onChange={(e) =>
              setForm({ ...form, inquiryNumber: e.target.value })
            }
          />
        </div>
        <div className="rce-field">
          <label>Inquiry Date</label>
          <input
            type="date"
            value={form.inquiryDate}
            onChange={(e) => setForm({ ...form, inquiryDate: e.target.value })}
          />
        </div>
        <div className="rce-field">
          <label>RCE No (Auto)</label>
          <input type="text" value={form.rceNo} readOnly />
        </div>
        <div className="rce-field">
          <label>RCE Date</label>
          <input
            type="date"
            value={form.rceDate}
            onChange={(e) => setForm({ ...form, rceDate: e.target.value })}
          />
        </div>
        <div className="rce-field">
          <label>Project Title</label>
          <input
            type="text"
            value={form.projectTitle}
            onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
          />
        </div>
        <div className="rce-field">
          <label>Priority Level</label>
          <select
            value={form.priorityLevel}
            onChange={(e) =>
              setForm({ ...form, priorityLevel: e.target.value })
            }
          >
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
        <div className="rce-field">
          <label>CE Deadline</label>
          <input
            type="date"
            value={form.ceDeadline}
            onChange={(e) => setForm({ ...form, ceDeadline: e.target.value })}
          />
        </div>
        <div className="rce-field">
          <label>Submission Deadline</label>
          <input
            type="date"
            value={form.submissionDeadline}
            onChange={(e) =>
              setForm({ ...form, submissionDeadline: e.target.value })
            }
          />
        </div>
      </div>

      <div className="rce-checkbox-group">
        <span>Project Type:</span>
        <label>
          <input
            type="checkbox"
            checked={form.shopwork}
            onChange={(e) => setForm({ ...form, shopwork: e.target.checked })}
          />
          Shopwork
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.onsite}
            onChange={(e) => setForm({ ...form, onsite: e.target.checked })}
          />
          On-site
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.trading}
            onChange={(e) => setForm({ ...form, trading: e.target.checked })}
          />
          Trading
        </label>
      </div>
      <div className="rce-checkbox-group">
        <span>Department:</span>
        <label>
          <input
            type="checkbox"
            checked={form.mechanical}
            onChange={(e) => setForm({ ...form, mechanical: e.target.checked })}
          />
          Mechanical
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.electrical}
            onChange={(e) => setForm({ ...form, electrical: e.target.checked })}
          />
          Electrical
        </label>
      </div>

      <table className="rce-checklist-table">
        <thead>
          <tr>
            <th>ITEM NO.</th>
            <th>DESCRIPTION</th>
            <th>COMPLETE? (YES/NO/N/A)</th>
            <th>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          <ChecklistRow
            num="1"
            desc="CUSTOMER PROVIDED COMPLETE SPECIFICATIONS"
            complete={checklist.item1.complete}
            remarks={checklist.item1.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item1', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item1', 'remarks', v)
            }
          />
          <ChecklistRow
            num="2"
            desc={config.item2Text}
            complete={checklist.item2.complete}
            remarks={checklist.item2.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item2', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item2', 'remarks', v)
            }
          />
          <ChecklistRow
            num="3"
            desc="PROJECT SCOPE CLEARLY DEFINED"
            complete={checklist.item3.complete}
            remarks={checklist.item3.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item3', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item3', 'remarks', v)
            }
          />
          <ChecklistRow
            num="4"
            desc="REQUIRED DELIVERY DATE PROVIDED"
            complete={checklist.item4.complete}
            remarks={checklist.item4.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item4', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item4', 'remarks', v)
            }
          />
          <ChecklistRow
            num="5"
            desc="BUDGETARY TARGET PROVIDED (IF ANY)"
            complete={checklist.item5.complete}
            remarks={checklist.item5.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item5', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item5', 'remarks', v)
            }
          />
          <ChecklistRow
            num="6"
            desc="COMMERCIAL TERMS AVAILABLE (PAYMENT, WARRANTY, ETC.)"
            complete={checklist.item6.complete}
            remarks={checklist.item6.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item6', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item6', 'remarks', v)
            }
          />
          <ChecklistRow
            num="7"
            desc="TECHNICAL DRAWINGS / SKETCHES ATTACHED"
            complete={checklist.item7.complete}
            remarks={checklist.item7.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item7', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item7', 'remarks', v)
            }
          />
          <ChecklistRow
            num="8"
            desc="BILL OF MATERIALS AVAILABLE"
            complete={checklist.item8.complete}
            remarks={checklist.item8.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item8', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item8', 'remarks', v)
            }
          />
          <ChecklistRow
            num="9"
            desc="SITE CONDITIONS / ACCESS DETAILS PROVIDED"
            complete={checklist.item9.complete}
            remarks={checklist.item9.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item9', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item9', 'remarks', v)
            }
          />
          <ChecklistRow
            num="10"
            desc="PERMITS / COMPLIANCE REQUIREMENTS KNOWN"
            complete={checklist.item10.complete}
            remarks={checklist.item10.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item10', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item10', 'remarks', v)
            }
          />
          <ChecklistRow
            num="11"
            desc="SAFETY REQUIREMENTS IDENTIFIED"
            complete={checklist.item11.complete}
            remarks={checklist.item11.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item11', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item11', 'remarks', v)
            }
          />
          <ChecklistRow
            num="12"
            desc="TESTING / INSPECTION CRITERIA DEFINED"
            complete={checklist.item12.complete}
            remarks={checklist.item12.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item12', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item12', 'remarks', v)
            }
          />
          <ChecklistRow
            num="13"
            desc="OTHER SPECIAL REQUIREMENTS"
            complete={checklist.item13.complete}
            remarks={checklist.item13.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item13', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item13', 'remarks', v)
            }
          />
          <tr>
            <td>14</td>
            <td>ATTACHMENTS</td>
            <td></td>
            <td></td>
          </tr>
          <ChecklistRow
            num="14.1"
            desc="DRAWINGS"
            complete={checklist.item14_1.complete}
            remarks={checklist.item14_1.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item14_1', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item14_1', 'remarks', v)
            }
          />
          <ChecklistRow
            num="14.2"
            desc="SPECIFICATIONS"
            complete={checklist.item14_2.complete}
            remarks={checklist.item14_2.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item14_2', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item14_2', 'remarks', v)
            }
          />
          <ChecklistRow
            num="14.3"
            desc="OTHER DOCUMENTS"
            complete={checklist.item14_3.complete}
            remarks={checklist.item14_3.remarks}
            onCompleteChange={(v) =>
              handleChecklistChange('item14_3', 'complete', v)
            }
            onRemarksChange={(v) =>
              handleChecklistChange('item14_3', 'remarks', v)
            }
          />
        </tbody>
      </table>

      <div className="rce-textarea-group">
        <label>OTHER REMARKS:</label>
        <textarea
          rows="3"
          value={form.otherRemarks}
          onChange={(e) => setForm({ ...form, otherRemarks: e.target.value })}
        />
      </div>
      <div className="rce-textarea-group">
        <label>REASON TO DECLINE / NO QUOTE:</label>
        <textarea
          rows="3"
          value={form.declineReason}
          onChange={(e) => setForm({ ...form, declineReason: e.target.value })}
        />
      </div>

      <div className="rce-upload">
        <label>Upload Attachments (PDF, Images):</label>
        <input
          type="file"
          multiple
          onChange={handleFileUpload}
          accept=".pdf,image/*"
        />
      </div>

      <div className="rce-signatures">
        <div>
          <label>Prepared by (Sales Rep)</label>
          <input
            type="text"
            value={form.preparedBy}
            onChange={(e) => setForm({ ...form, preparedBy: e.target.value })}
            placeholder="Name"
          />
        </div>
        <div>
          <label>Reviewed by (Sales Manager)</label>
          <input
            type="text"
            value={form.reviewedBy}
            onChange={(e) => setForm({ ...form, reviewedBy: e.target.value })}
          />
        </div>
        <div>
          <label>Approved by (Technical Service Group)</label>
          <input
            type="text"
            value={form.approvedBy}
            onChange={(e) => setForm({ ...form, approvedBy: e.target.value })}
          />
        </div>
      </div>

      <div className="rce-actions">
        <button className="ce-btn-primary" onClick={handleSubmit}>
          Submit
        </button>
        <button className="ce-btn-ghost" onClick={handleNew}>
          New RCE
        </button>
        {showPage2 && (
          <button
            className="ce-btn-ghost"
            onClick={() => setShowPage2(!showPage2)}
          >
            {showPage2 ? 'Hide Page 2' : 'Show Page 2 (Attachments)'}
          </button>
        )}
      </div>

      {showPage2 && (
        <div className="rce-page2">
          <hr />
          <h3>Page 2 — Attachments</h3>
          {attachments.length === 0 ? (
            <p>No attachments uploaded.</p>
          ) : (
            <div className="rce-attachment-grid">
              {attachments.map((att, idx) => (
                <div key={idx} className="rce-attachment-item">
                  <strong>{att.name}</strong>
                  {att.type.startsWith('image/') ? (
                    <img
                      src={att.url}
                      alt={att.name}
                      style={{ maxWidth: '200px' }}
                    />
                  ) : (
                    <a href={att.url} target="_blank" rel="noreferrer">
                      Open PDF
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Updated ChecklistRow to be fully controlled
/* ============================= ESTIMATE HOME (Wrapper) ============================= */
function EstimateHome({ ceList, setCurrentView, setActiveCE, setIsParked }) {
  const [view, setView] = useState('dashboard'); // "dashboard" or "rce-form"

  return (
    <div>
      <div className="estimate-toolbar">
        <button
          className={`ce-pill ${view === 'dashboard' ? 'ce-pill-active' : ''}`}
          onClick={() => setView('dashboard')}
        >
          CE Dashboard
        </button>
        <button
          className={`ce-pill ${view === 'rce-form' ? 'ce-pill-active' : ''}`}
          onClick={() => setView('rce-form')}
        >
          RCE Checklist Form
        </button>
      </div>
      {view === 'dashboard' ? (
        <Dashboard
          ceList={ceList}
          setCurrentView={setCurrentView}
          setActiveCE={setActiveCE}
          setIsParked={setIsParked}
        />
      ) : (
        <RCEChecklistForm
          onBack={() => setView('dashboard')}
          onSave={(data) => console.log('RCE Saved:', data)}
        />
      )}
    </div>
  );
}
function SOWTab({ sowText, setSowText }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: sowText,
    onUpdate: ({ editor }) => {
      setSowText(editor.getHTML());
    },
  });

  if (!editor) return <div>Loading editor...</div>;

  // Simple debug visible on screen – remove later
  const hasTextStyle = editor.extensionManager.extensions.some(
    (e) => e.name === 'textStyle'
  );

  const fontColors = [
    { label: 'Black', value: '#000000' },
    { label: 'Red', value: '#FF0000' },
    { label: 'Blue', value: '#0000FF' },
    { label: 'Green', value: '#008000' },
  ];

  const highlightColors = [
    { label: 'Yellow', value: '#FFEB3B' },
    { label: 'Cyan', value: '#00FFFF' },
    { label: 'Lime', value: '#00FF00' },
  ];

  const handleSetColor = (color) => {
    if (!hasTextStyle) return;
    editor.chain().focus().setColor(color).run();
  };

  const handleToggleHighlight = (color) => {
    editor.chain().focus().toggleHighlight({ color }).run();
  };

  return (
    <div className="sow-editor-container">
      {/* Debug text – remove when working */}
      {!hasTextStyle && (
        <p style={{ color: 'red' }}>TextStyle extension not loaded!</p>
      )}

      <div className="sow-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'is-active' : ''}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'is-active' : ''}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'is-active' : ''}
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'is-active' : ''}
        >
          • List
        </button>

        <span className="sow-toolbar-separator" />

        {fontColors.map((c) => (
          <button
            key={c.value}
            type="button"
            title={`Font ${c.label}`}
            onClick={() => handleSetColor(c.value)}
            style={{
              backgroundColor: c.value,
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          />
        ))}

        <span className="sow-toolbar-separator" />

        {highlightColors.map((c) => (
          <button
            key={c.value}
            type="button"
            title={`Highlight ${c.label}`}
            onClick={() => handleToggleHighlight(c.value)}
            style={{
              backgroundColor: c.value,
              width: '20px',
              height: '20px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              cursor: 'pointer',
            }}
          />
        ))}
      </div>

      <EditorContent editor={editor} className="sow-editor-content" />
    </div>
  );
}
function AttachmentsTab({ attachments }) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className="ce-empty ce-empty-lg">No attachments uploaded yet.</div>
    );
  }

  return (
    <div className="ce-card">
      <div className="ce-card-header ce-card-header-compact">
        <span className="ce-chip">ATTACHMENTS</span>
        <b className="ce-mono">
          {attachments.length} file{attachments.length !== 1 ? 's' : ''}
        </b>
      </div>
      <div className="ce-table-scroll">
        <table className="ce-table">
          <thead>
            <tr>
              <th>File Name</th>
              <th>Sheet / Category</th>
            </tr>
          </thead>
          <tbody>
            {attachments.map((file, idx) => (
              <tr key={file.id || idx}>
                <td>
                  <a
                    href={file.url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="ce-attachment-link"
                  >
                    <FileText size={14} style={{ marginRight: '0.5rem' }} />
                    {file.name}
                  </a>
                </td>
                <td>{file.sheet || 'General'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function SummaryHeader({
  docNo,
  setDocNo,
  revNo,
  setRevNo,
  revDate,
  setRevDate,
  viewType,
  setViewType,
}) {
  return (
    <div className="ce-summary-header">
      <div className="ce-summary-header-top">
        {/* Logo placeholder (left) */}
        <div className="ce-summary-logo">
          <span>LOGO</span>
        </div>

        {/* Centered title */}
        <div className="ce-summary-title">
          <h2 className="ce-serif">COST ESTIMATE SUMMARY</h2>
        </div>

        {/* Right-side document info table */}
        <div className="ce-summary-docinfo">
          <table className="ce-docinfo-table">
            <tbody>
              <tr>
                <td className="ce-docinfo-label">Document No:</td>
                <td>
                  <input
                    type="text"
                    value={docNo}
                    onChange={(e) => setDocNo(e.target.value)}
                    className="ce-docinfo-input"
                  />
                </td>
              </tr>
              <tr>
                <td className="ce-docinfo-label">Revision No:</td>
                <td>
                  <input
                    type="text"
                    value={revNo}
                    onChange={(e) => setRevNo(e.target.value)}
                    className="ce-docinfo-input"
                  />
                </td>
              </tr>
              <tr>
                <td className="ce-docinfo-label">Revision Date:</td>
                <td>
                  <input
                    type="date"
                    value={revDate}
                    onChange={(e) => setRevDate(e.target.value)}
                    className="ce-docinfo-input"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW TOGGLE ROW — inserted right here */}
      <div className="ce-summary-toggle-row">
        <button
          type="button"
          className={`ce-pill ${
            viewType === 'Summary' ? 'ce-pill-active' : ''
          }`}
          onClick={() => setViewType('Summary')}
        >
          Summary
        </button>
        <button
          type="button"
          className={`ce-pill ${
            viewType === 'Breakdown' ? 'ce-pill-active' : ''
          }`}
          onClick={() => setViewType('Breakdown')}
        >
          Breakdown
        </button>
      </div>
    </div>
  );
}
/* ============================= APP SHELL & NAVIGATION ============================= */
const NAV_ITEMS = [
  {
    key: 'estimate',
    label: 'Cost Estimate',
    icon: ClipboardList,
    enabled: true,
  },
  {
    key: 'rce-inbox',
    label: 'RCE Requests',
    icon: FileText,
    enabled: true,
  },
  { key: 'database', label: 'Database', icon: Database, enabled: true },
  {
    key: 'monitoring',
    label: 'Monitoring',
    icon: Activity,
    enabled: true,
    redBorder: true,
  },
  { key: 'scope', label: 'Scope Library', icon: Library, enabled: true },
];
function AppLayout({ currentView, setCurrentView, children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="ce-shell-outer">
      <aside
        className={`ce-sidebar ${collapsed ? 'ce-sidebar-collapsed' : ''}`}
      >
        <div className="ce-sidebar-brand">
          <button
            className="ce-hamburger"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            ☰
          </button>
          {!collapsed && <ClipboardList size={18} />}
          {!collapsed && (
            <span className="ce-serif ce-sidebar-brand-text">
              Cost Estimator
            </span>
          )}
        </div>
        <nav className="ce-sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <div
                  key={item.key}
                  className="ce-navitem ce-navitem-disabled"
                  title="Coming soon"
                >
                  <Icon size={16} />
                  {!collapsed && <span>{item.label}</span>}
                  {!collapsed && <span className="ce-navitem-soon">Soon</span>}
                </div>
              );
            }
            const isActive =
              item.key === 'estimate'
                ? currentView === 'dashboard' || currentView === 'editor'
                : currentView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={
                  'ce-navitem' +
                  (isActive ? ' ce-navitem-active' : '') +
                  (item.redBorder ? ' ce-navitem-monitoring' : '')
                }
                onClick={() =>
                  setCurrentView(
                    item.key === 'estimate' ? 'dashboard' : item.key
                  )
                }
              >
                <Icon size={16} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="ce-mainpane">{children}</main>
    </div>
  );
}
export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [activeCE, setActiveCE] = useState(null);
  const [isParked, setIsParked] = useState(false);
  const [ceList, setCeList] = useState([
    {
      id: 'CE-2025-001',
      client: 'ABC Corp',
      status: 'Ongoing',
      project: 'Turbine Overhaul',
      lastEdited: '2025-01-25',
      lastEditedBy: 'Estimator A',
    },
    {
      id: 'CE-2025-002',
      client: 'XYZ Ltd',
      status: 'Pending',
      project: 'Piping Fabrication',
      lastEdited: '2025-01-20',
      lastEditedBy: 'Estimator B',
    },
    {
      id: 'CE-2025-003',
      client: 'DEF Inc',
      status: 'Done',
      project: 'Electrical Upgrade',
      lastEdited: '2025-01-18',
      lastEditedBy: 'Estimator A',
    },
  ]);
  const [rceList, setRceList] = useState([
    {
      id: 'RCE-2025-001',
      client: 'ABC Corp',
      location: 'Bataan',
      description: 'Turbine overhaul',
      category: 'Onsite',
      status: 'Pending',
      attachments: ['Site_Photos.zip', 'Scope.pdf'],
      dateReceived: '2025-02-01',
    },
    {
      id: 'RCE-2025-002',
      client: 'XYZ Ltd',
      location: 'Laguna',
      description: 'Piping fabrication',
      category: 'Shop',
      status: 'In Review',
      attachments: ['Drawings.pdf'],
      dateReceived: '2025-02-05',
    },
  ]);
  const [selectedRCE, setSelectedRCE] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [isEditorLocked, setIsEditorLocked] = useState(false);
  const handleStatusChange = (newStatus) => {
    if (activeCE) {
      const updatedCE = { ...activeCE, status: newStatus };
      setActiveCE(updatedCE);
      setCeList((prev) =>
        prev.map((ce) => (ce.id === updatedCE.id ? updatedCE : ce))
      );
    }
  };
  const handleSubmitRCE = (newRCE) => {
    setRceList([...rceList, newRCE]);
    setCurrentView('rce-inbox');
  };

  const handleViewRCE = (rce) => {
    setSelectedRCE(rce);
    setCurrentView('rce-detail');
  };

  const handleGenerateCE = (rce) => {
    const newCE = {
      id: `CE-${new Date().getFullYear()}-${String(ceList.length + 1).padStart(
        3,
        '0'
      )}`,
      client: rce.client,
      location: rce.location,
      project: rce.description,
      status: 'Draft',
      lastEdited: new Date().toISOString().slice(0, 10),
      lastEditedBy: editingUser || 'Estimator A',
      rceId: rce.id,
    };
    setCeList([...ceList, newCE]);
    setActiveCE(newCE);
    setCurrentView('editor');
  };

  const handleTakeOver = () => {
    setEditingUser('Estimator A'); // or actual current user
    setIsEditorLocked(false);
  };
  return (
    <div className="ce-app">
      <MasterlistProvider>
        <AppLayout currentView={currentView} setCurrentView={setCurrentView}>
          {currentView === 'dashboard' && (
            <EstimateHome
              ceList={ceList}
              setCurrentView={setCurrentView}
              setActiveCE={setActiveCE}
              setIsParked={setIsParked}
            />
          )}

          {currentView === 'editor' && (
            <CostEstimateTool
              ceData={activeCE}
              status={activeCE?.status}
              onStatusChange={handleStatusChange}
              isParked={isParked}
              onParkToggle={setIsParked}
              goToLibrary={() => setCurrentView('scope')}
              goToSearch={() => setCurrentView('dashboard')}
              editingUser={editingUser || 'Estimator A'}
              isEditorLocked={isEditorLocked}
              onUserActivity={() =>
                setEditingUser(editingUser || 'Estimator A')
              }
              onLock={() => setIsEditorLocked(true)}
              onTakeOver={handleTakeOver}
            />
          )}

          {currentView === 'database' && <DatabaseManager />}
          {currentView === 'monitoring' && <MonitoringDashboard />}

          {currentView === 'scope' && (
            <LibraryView
              onCloneTemplate={(templateId) =>
                console.log('Cloning template:', templateId)
              }
              onOpenArchivedCE={(ceId) => {
                const archived = ceList.find((ce) => ce.id === ceId);
                if (archived) {
                  setActiveCE(archived);
                } else {
                  setActiveCE({
                    id: ceId,
                    client: 'Archived Client',
                    status: 'Draft',
                    project: 'Archived Project',
                    lastEdited: new Date().toISOString().slice(0, 10),
                  });
                }
                setCurrentView('editor');
                setIsParked(false);
              }}
            />
          )}

          {currentView === 'rce-form' && (
            <SalesRCEForm
              onSubmitRCE={handleSubmitRCE}
              onBack={() => setCurrentView('dashboard')}
            />
          )}

          {currentView === 'rce-inbox' && (
            <RCEInbox rceList={rceList} onViewRCE={handleViewRCE} />
          )}

          {currentView === 'rce-detail' && selectedRCE && (
            <RCEDetail
              rce={selectedRCE}
              onBack={() => setCurrentView('rce-inbox')}
              onGenerateCE={handleGenerateCE}
            />
          )}
        </AppLayout>
      </MasterlistProvider>
    </div>
  );
}
/* ============================= STYLES ============================= */
