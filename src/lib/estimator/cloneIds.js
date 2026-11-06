/** Fresh ids for a cloned cost estimate. Load and save never call this. */

/** @typedef {Record<string, string>} IdMap */

const LINE_KEYS = ["BOL", "BOTE", "BOCM", "PPE", "MISC"];
const SCHEDULE_FIELDS = ["taskId", "task_id", "subtaskId", "subtask_id", "activity_id", "lineId", "line_id", "predecessor"];

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** @param {unknown} value */
function asList(value) {
  return Array.isArray(value) ? value : [];
}

/** @returns {string} */
function defaultUuid() {
  return crypto.randomUUID();
}

/**
 * @param {() => string} uuid
 */
function freshId(uuid) {
  const id = String(uuid() || "");
  return id || crypto.randomUUID();
}

/**
 * @param {Record<string, unknown>} node
 * @param {IdMap} idMap
 * @param {() => string} uuid
 */
function stampId(node, idMap, uuid) {
  const oldId = node.id == null ? "" : String(node.id);
  const next = freshId(uuid);
  if (oldId) idMap[oldId] = next;
  node.id = next;
}

/**
 * @param {Record<string, unknown>} sub
 * @param {IdMap} idMap
 * @param {() => string} uuid
 */
function stampSub(sub, idMap, uuid) {
  stampId(sub, idMap, uuid);
  const items = isRecord(sub.items) ? sub.items : {};
  for (const key of LINE_KEYS) {
    for (const line of asList(items[key])) {
      if (isRecord(line)) stampId(line, idMap, uuid);
    }
  }
  for (const child of asList(sub.children)) {
    if (isRecord(child)) stampSub(child, idMap, uuid);
  }
}

/**
 * @param {Record<string, unknown>} task
 * @param {IdMap} idMap
 * @param {() => string} uuid
 */
function stampTask(task, idMap, uuid) {
  stampId(task, idMap, uuid);
  for (const sub of asList(task.subtasks)) {
    if (isRecord(sub)) stampSub(sub, idMap, uuid);
  }
}

/**
 * @param {unknown} value
 * @param {IdMap} idMap
 */
function mapRef(value, idMap) {
  if (value == null || value === "") return value;
  const key = String(value);
  return Object.prototype.hasOwnProperty.call(idMap, key) ? idMap[key] : value;
}

/**
 * @param {Record<string, unknown>} sub
 * @param {IdMap} idMap
 */
function relinkSub(sub, idMap) {
  if ("predecessor" in sub) sub.predecessor = mapRef(sub.predecessor, idMap);
  for (const child of asList(sub.children)) {
    if (isRecord(child)) relinkSub(child, idMap);
  }
}

/**
 * @param {Record<string, unknown>} task
 * @param {IdMap} idMap
 */
function relinkTask(task, idMap) {
  if ("predecessor" in task) task.predecessor = mapRef(task.predecessor, idMap);
  for (const sub of asList(task.subtasks)) {
    if (isRecord(sub)) relinkSub(sub, idMap);
  }
}

/**
 * @param {unknown} row
 * @param {IdMap} idMap
 */
function relinkSow(row, idMap) {
  if (!isRecord(row) || !("activity_id" in row)) return row;
  return { ...row, activity_id: mapRef(row.activity_id, idMap) };
}

/**
 * @param {unknown} row
 * @param {IdMap} idMap
 * @returns {unknown}
 */
function relinkScheduleRow(row, idMap) {
  if (Array.isArray(row)) return row.map((item) => relinkScheduleRow(item, idMap));
  if (!isRecord(row)) return row;
  const next = { ...row };
  for (const field of SCHEDULE_FIELDS) {
    if (field in next) next[field] = mapRef(next[field], idMap);
  }
  if (Array.isArray(next.rows)) next.rows = next.rows.map((item) => relinkScheduleRow(item, idMap));
  return next;
}

/**
 * @param {unknown} schedule
 * @param {IdMap} idMap
 */
function relinkSchedule(schedule, idMap) {
  if (Array.isArray(schedule)) return schedule.map((row) => relinkScheduleRow(row, idMap));
  if (!isRecord(schedule)) return schedule;
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(schedule)) {
    const nextKey = Object.prototype.hasOwnProperty.call(idMap, key) ? idMap[key] : key;
    if (Array.isArray(value)) out[nextKey] = value.map((row) => relinkScheduleRow(row, idMap));
    else if (isRecord(value)) out[nextKey] = relinkScheduleRow(value, idMap);
    else out[nextKey] = value;
  }
  return out;
}

/**
 * Copy a cost estimate and give every task, nested subtask, and line a new id.
 * Predecessors, sow activity ids, and schedule rows follow the new ids.
 * The input document is not changed.
 * @param {unknown} doc
 * @param {() => string} [uuid]
 * @returns {{ doc: Record<string, unknown>, idMap: IdMap }}
 */
export function remapCloneIds(doc, uuid = defaultUuid) {
  const source = isRecord(doc) ? doc : {};
  const copy = /** @type {Record<string, unknown>} */ (JSON.parse(JSON.stringify(source)));
  /** @type {IdMap} */
  const idMap = {};
  for (const task of asList(copy.tasks)) {
    if (isRecord(task)) stampTask(task, idMap, uuid);
  }
  for (const task of asList(copy.tasks)) {
    if (isRecord(task)) relinkTask(task, idMap);
  }
  if (Array.isArray(copy.sow)) copy.sow = copy.sow.map((row) => relinkSow(row, idMap));
  if ("schedule" in copy) copy.schedule = relinkSchedule(copy.schedule, idMap);
  if (isRecord(copy.summaryTaskFilters) && Array.isArray(copy.summaryTaskFilters.selectedTaskIds)) {
    copy.summaryTaskFilters = {
      ...copy.summaryTaskFilters,
      selectedTaskIds: copy.summaryTaskFilters.selectedTaskIds.map((id) => mapRef(id, idMap)),
    };
  }
  const previous = isRecord(copy.clonedFrom) ? copy.clonedFrom : {};
  const projectInfo = isRecord(copy.projectInfo) ? copy.projectInfo : {};
  const docNo = projectInfo.docNo == null ? "" : String(projectInfo.docNo);
  const ownId = copy.id == null ? "" : String(copy.id);
  copy.clonedFrom = {
    ...previous,
    sourceId: docNo || ownId || null,
    idMap: { ...idMap },
  };
  return { doc: copy, idMap: { ...idMap } };
}
