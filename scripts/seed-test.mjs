/**
 * Seed the TEST project only. Refuses unless the test URL matches
 * (see seedRefusal). Upserts by id. Does not delete rows.
 *
 *   npm run seed:test
 *   npx tsx scripts/seed-test.mjs --fixture-only
 *
 * --fixture-only writes src/lib/estimator/__fixtures__/legacy-ce.json
 * and does not connect to a database.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";
import { TEST_USERS, seedRefusal } from "../src/lib/auth/test-login.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(root, "src/lib/estimator/__fixtures__/legacy-ce.json");

/** Same namespace as issue-access.server.ts. Do not change it. */
const USER_NAMESPACE = "c1e0a7e0-7b1a-4e3a-9c2d-5f6a7b8c9d0e";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stableUserUuid(userId) {
  const trimmed = String(userId || "").trim();
  if (UUID_RE.test(trimmed)) return trimmed.toLowerCase();
  const namespace = Buffer.from(USER_NAMESPACE.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespace).update(trimmed, "utf8").digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const emptyItems = () => ({ BOL: [], BOTE: [], BOCM: [], PPE: [], MISC: [] });

/** Today's maths: no pricing.model. Step 2 locks this file. */
export function buildLegacyCe() {
  return {
    id: "CE-TEST-LEGACY",
    client: "Test Client",
    status: "Draft",
    project: "Legacy seed project",
    lastEdited: "2026-10-01",
    lastEditedBy: "Test Staff",
    location: "Manila",
    rceId: "RCE-TEST-001",
    meta: {
      client: "Test Client",
      location: "Manila",
      date: "2026-10-01",
      title: "Legacy seed cost estimate",
      subtitle: "",
    },
    tasks: [
      {
        id: "task-legacy-1",
        title: "Site work",
        expanded: true,
        notes: "",
        files: [],
        duration: 1,
        predecessor: null,
        workType: "onsite",
        subtasks: [
          {
            id: "sub-legacy-1",
            title: "Rigging",
            expanded: true,
            type: "Sequential",
            predecessor: null,
            notes: "",
            files: [],
            items: {
              ...emptyItems(),
              BOL: [
                {
                  id: "bol-legacy-holiday",
                  role: "Rigger",
                  qty: 2,
                  days: 1,
                  rate: 700,
                  otHrs: 2,
                  dayType: "Holiday",
                  shift: "Day",
                  perDiem: 350,
                  allowance: 0,
                },
              ],
              MISC: [
                {
                  id: "misc-legacy-unsectioned",
                  description: "Permit",
                  qty: 1,
                  days: 1,
                  unit: "lot",
                  unitCost: 1200,
                  section: "",
                },
              ],
            },
            children: [
              {
                id: "sub-legacy-nested",
                title: "Nested consumable",
                expanded: true,
                type: "Sequential",
                predecessor: null,
                notes: "",
                files: [],
                items: {
                  ...emptyItems(),
                  BOCM: [
                    {
                      id: "bocm-legacy-gasket",
                      description: "Gasket",
                      qty: 3,
                      unitCost: 0.335,
                    },
                  ],
                },
                children: [],
              },
            ],
          },
        ],
      },
    ],
    commercial: { contingencyPct: 5, discountPct: 2, validityDays: 30 },
    summaryOverrides: { C: 20000 },
    projectInfo: { revNo: "0", docNo: "CE-TEST-LEGACY", quantity: 1 },
    ceStatus: "Draft",
    assumptions: "",
    awardStatus: "",
    fileAttachments: {},
    summaryTaskFilters: { showBreakdown: false, selectedTaskIds: [] },
    summaryHighlights: {},
    summaryIncludes: [],
    thirdPartyShow: { mode: "off", keys: [] },
    sheetNotes: {},
    rateExceptions: [],
  };
}

function loadDotEnv() {
  const path = resolve(root, ".env");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function writeFixture(ce) {
  mkdirSync(dirname(fixturePath), { recursive: true });
  writeFileSync(fixturePath, `${JSON.stringify(ce, null, 2)}\n`);
}

async function seedUsers(password) {
  const hash = await hashPassword(password);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const keys = [];
  try {
    for (const user of TEST_USERS) {
      const inserted = await pool.query(
        `insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
         values ($1, $2, $3, true, now(), now())
         on conflict (email) do update set name = excluded.name, "updatedAt" = now()
         returning id`,
        [user.userId, user.name, user.email],
      );
      const userId = inserted.rows[0].id;
      const account = await pool.query(
        `select id from "account" where "userId" = $1 and "providerId" = 'credential'`,
        [userId],
      );
      if (account.rows[0]) {
        await pool.query(`update "account" set password = $1, "updatedAt" = now() where id = $2`, [
          hash,
          account.rows[0].id,
        ]);
      } else {
        await pool.query(
          `insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           values ($1, $2, 'credential', $2, $3, now(), now())`,
          [`credential-${userId}`, userId, hash],
        );
      }
      keys.push({ ...user, userKey: stableUserUuid(userId) });
    }
  } finally {
    await pool.end();
  }
  return keys;
}

async function sb(path, { method = "GET", body, prefer } = {}, retry = true) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();
  const base = process.env.VITE_SUPABASE_URL.trim().replace(/\/+$/, "");
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: prefer || (method === "GET" ? "return=representation" : "return=minimal"),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const row = body && !Array.isArray(body) ? body : null;
    if (retry && row && Object.prototype.hasOwnProperty.call(row, "deleted_at") && text.includes("deleted_at")) {
      const next = { ...row };
      delete next.deleted_at;
      return sb(path, { method, body: next, prefer }, false);
    }
    throw new Error(`Supabase ${method} ${path.split("?")[0]} failed (${res.status}). ${text.slice(0, 240)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function upsertDoc(kind, id, payload, ord) {
  const existing = await sb(
    `workspace_docs?kind=eq.${encodeURIComponent(kind)}&doc_id=eq.${encodeURIComponent(id)}&select=version`,
  );
  const row = { kind, doc_id: id, payload, ord, deleted_at: null };
  if (Array.isArray(existing) && existing.length) {
    await sb(`workspace_docs?kind=eq.${encodeURIComponent(kind)}&doc_id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: { payload, ord, deleted_at: null },
    });
    return;
  }
  await sb("workspace_docs", { method: "POST", body: { ...row, version: 1 } });
}

function adminConfig(users) {
  return {
    users: users.map((user) => ({
      id: user.userKey || user.userId,
      name: user.name,
      email: user.email,
      designation: user.label,
      department: "Costing",
      level: user.role,
      status: "active",
    })),
    pending: [],
    designations: ["Cost Estimator", "Department Head"],
    approvalFlows: {
      ce: [
        { id: "ce-1", title: "Prepared by Estimator", role: "staff" },
        { id: "ce-2", title: "Reviewed by Lead", role: "lead" },
        { id: "ce-3", title: "Approved by Head", role: "head", isFinal: true },
      ],
      rce: [
        { id: "rce-1", title: "Prepared by Sales", role: "staff" },
        { id: "rce-2", title: "Reviewed by Sales Manager", role: "lead" },
        { id: "rce-3", title: "Accepted by Final approver", role: "head", isFinal: true },
      ],
      oif: [
        { id: "oif-1", title: "Prepared by Inspector", role: "staff" },
        { id: "oif-2", title: "Noted by Lead", role: "lead", isFinal: true },
      ],
    },
  };
}

async function seedSupabase(ce, users) {
  await sb("app_user_roles?on_conflict=user_key", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=minimal",
    body: users.map((user) => ({ user_key: user.userKey, email: user.email, role: user.role })),
  });
  const { id, client, status, project, lastEdited, lastEditedBy, location, rceId, ...document } = ce;
  await upsertDoc("masterlist", "company", {
    manpower: [{ id: "ml-rigger", role: "Rigger", dailyRate: 700, perDiem: 350, allowance: 0 }],
    equipment: [{ id: "ml-gen", description: "Generator", dailyRate: 1500 }],
    consumables: [{ id: "ml-gasket", description: "Gasket", unitCost: 0.335 }],
    ppe: [{ id: "ml-gloves", item: "Gloves", unitCost: 85.5 }],
    misc: [{ id: "ml-permit", description: "Permit", unitCost: 1200 }],
    clients: [{ id: "ml-client", fullName: "Test Client" }],
    customCategories: [],
  }, 0);
  await upsertDoc("admin", "company", adminConfig(users), 0);
  await upsertDoc("rce", "RCE-TEST-001", {
    id: "RCE-TEST-001",
    client,
    customer: client,
    projectTitle: project,
    location,
    description: "Seeded request for the legacy cost estimate",
    category: "Onsite",
    status: "Accepted",
    onsite: true,
    shopwork: false,
    trading: false,
    dateReceived: "2026-10-01",
    attachments: [],
  }, 0);
  await upsertDoc("ce", id, {
    summary: { id, client, status, project, lastEdited, lastEditedBy, location, rceId },
    document: { ...document, ceStatus: status },
  }, 0);
  await upsertDoc("inspection", "OIF-TEST-001", {
    id: "OIF-TEST-001",
    oifNo: "OIF-TEST-001",
    rceNo: "RCE-TEST-001",
    date: "2026-10-01",
    customerName: client,
    projectDescription: project,
    activity: { onsite: true, shopwork: false, supplyOnly: false },
    photos: [],
  }, 0);
}

export async function main() {
  const fixtureOnly = process.argv.includes("--fixture-only");
  if (!fixtureOnly) loadDotEnv();
  const ce = buildLegacyCe();
  if (fixtureOnly) {
    writeFixture(ce);
    console.log("Wrote the legacy CE fixture. No database was contacted.");
    return;
  }
  const reason = seedRefusal(process.env);
  if (reason) {
    console.error(reason);
    process.exitCode = 1;
    return;
  }
  writeFixture(ce);
  const users = await seedUsers(process.env.ESTIMATOR_TEST_PASSWORD);
  await seedSupabase(ce, users);
  console.log("Seed finished. Rows were upserted. Nothing was deleted.");
}

const invoked = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (invoked === import.meta.url) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : "Seed failed");
    process.exitCode = 1;
  });
}
