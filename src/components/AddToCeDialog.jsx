// @ts-nocheck
import React, { useState } from "react";
import { lookupDbPrice, previewMerge } from "../lib/estimator/elCalcs";

const CATEGORIES = [
  ["BOCM", "BOCM"],
  ["MISC", "MISC"],
  ["BOL", "BOL"],
  ["BOTE", "BOTE"],
  ["PPE", "PPE"],
];

const SECTIONS = [
  ["B", "B · Transportation"],
  ["A", "A · Accommodation"],
  ["C", "C · Requirements"],
  ["D", "D · Admin"],
  ["I", "I · Insurances"],
  ["E", "E · Third party"],
];

const LIST_KEY = {
  BOL: "manpower",
  BOTE: "equipment",
  BOCM: "consumables",
  PPE: "ppe",
  MISC: "misc",
};

function money(n) {
  const value = Number(n);
  if (!Number.isFinite(value)) return "—";
  return `₱${value.toFixed(2)}`;
}

export function AddToCeDialog({ offer, masterlist, onCancel, onConfirm }) {
  const payload = offer?.payload || {};
  const targets = offer?.targets || [];
  const [ceId, setCeId] = useState(targets[0]?.id || "");
  const [taskId, setTaskId] = useState(targets[0]?.tasks?.[0]?.id || "");
  const [subtaskId, setSubtaskId] = useState(targets[0]?.tasks?.[0]?.subtasks?.[0]?.id || "");
  const [category, setCategory] = useState(payload.category || "BOCM");
  const [section, setSection] = useState(payload.section || "B");
  const [description, setDescription] = useState(payload.description || "");
  const [merge, setMerge] = useState(false);

  const ce = targets.find((row) => row.id === ceId) || null;
  const task = ce?.tasks?.find((row) => row.id === taskId) || null;
  const sub = task?.subtasks?.find((row) => row.id === subtaskId) || null;
  const lines = (sub?.items && sub.items[category]) || [];
  const db = lookupDbPrice(masterlist?.[LIST_KEY[category]] || [], description);
  const useDb = Boolean(db) && category !== "MISC";
  const unitCost = useDb ? db.unitCost : payload.unitCost || 0;
  const unit = (useDb && db.unit) || payload.unit || "";
  const preview = previewMerge(lines, { description, qty: payload.qty, category, section });

  function pickCe(nextId) {
    const next = targets.find((row) => row.id === nextId);
    setCeId(nextId);
    setTaskId(next?.tasks?.[0]?.id || "");
    setSubtaskId(next?.tasks?.[0]?.subtasks?.[0]?.id || "");
    setMerge(false);
  }

  function pickTask(nextId) {
    const next = ce?.tasks?.find((row) => row.id === nextId);
    setTaskId(nextId);
    setSubtaskId(next?.subtasks?.[0]?.id || "");
    setMerge(false);
  }

  function confirm() {
    if (!ce || !task || !sub) return;
    onConfirm({
      ceId: ce.id,
      status: ce.status,
      taskId: task.id,
      subtaskId: sub.id,
      category,
      section: category === "MISC" ? section : "",
      description,
      qty: payload.qty,
      days: payload.days,
      unit,
      unitCost,
      notes: payload.notes || "",
      calc: payload.calc || null,
      masterlistId: useDb ? db.id : "",
      merge: merge && preview.kind === "merge",
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(24,23,15,0.35)",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div className="ce-card" style={{ maxWidth: 560, width: "100%", maxHeight: "90vh", overflow: "auto", padding: "1rem" }}>
        <h3 className="ce-serif">Add to cost estimate</h3>
        <p className="wiz-hint">Draft and Ongoing estimates only. For approval and Done stay unchanged.</p>
        <div className="wiz-grid">
          <label className="wiz-field">
            <span className="ce-field-label">Cost estimate</span>
            <select className="ce-input" value={ceId} onChange={(e) => pickCe(e.target.value)}>
              {targets.map((row) => (
                <option key={row.id} value={row.id}>{row.label}</option>
              ))}
            </select>
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">Task</span>
            <select className="ce-input" value={task?.id || ""} onChange={(e) => pickTask(e.target.value)}>
              {(ce?.tasks || []).map((row) => (
                <option key={row.id} value={row.id}>{row.title}</option>
              ))}
            </select>
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">Subtask</span>
            <select className="ce-input" value={sub?.id || ""} onChange={(e) => { setSubtaskId(e.target.value); setMerge(false); }}>
              {(task?.subtasks || []).map((row) => (
                <option key={row.id} value={row.id}>{row.title}</option>
              ))}
            </select>
          </label>
          <label className="wiz-field">
            <span className="ce-field-label">Category</span>
            <select className="ce-input" value={category} onChange={(e) => { setCategory(e.target.value); setMerge(false); }}>
              {CATEGORIES.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          {category === "MISC" ? (
            <label className="wiz-field">
              <span className="ce-field-label">MISC section</span>
              <select className="ce-input" value={section} onChange={(e) => setSection(e.target.value)}>
                {SECTIONS.map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="wiz-field">
            <span className="ce-field-label">Description</span>
            <input className="ce-input" value={description} onChange={(e) => { setDescription(e.target.value); setMerge(false); }} />
          </label>
        </div>
        <p className="wiz-hint">
          {payload.qty} {unit} × {money(unitCost)}
          {useDb ? " · Database price" : " · No database price"}
        </p>
        <p className="wiz-hint">
          {preview.kind === "merge"
            ? `A line named “${preview.match.description}” is already here (qty ${preview.fromQty}). Merging makes qty ${preview.nextQty}.`
            : "No matching line. This adds a new line."}
        </p>
        {preview.kind === "merge" ? (
          <label className="wiz-field">
            <input type="checkbox" checked={merge} onChange={(e) => setMerge(e.target.checked)} /> Merge into that line
          </label>
        ) : null}
        {!task || !sub ? <div className="rce-field-error">This estimate needs a task and a subtask before a line can be added.</div> : null}
        <div className="ce-confirm-actions" style={{ marginTop: "0.8rem" }}>
          <button type="button" className="ce-btn-ghost" onClick={onCancel}>Cancel</button>
          <button type="button" className="ce-btn-primary" disabled={!ce || !task || !sub} onClick={confirm}>Add line</button>
        </div>
      </div>
    </div>
  );
}
