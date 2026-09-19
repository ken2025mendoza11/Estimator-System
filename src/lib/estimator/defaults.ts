export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type CeSummary = {
  id: string;
  client: string;
  status: string;
  project: string;
  lastEdited: string;
  lastEditedBy?: string;
  location?: string;
  rceId?: string;
};

export type RceSummary = {
  id: string;
  client: string;
  location?: string;
  description?: string;
  category?: string;
  status?: string;
  attachments?: string[];
  dateReceived?: string;
};

export type MasterlistState = {
  manpower: Json[];
  equipment: Json[];
  consumables: Json[];
  ppe: Json[];
  misc: Json[];
  clients: Json[];
  customCategories: Json[];
};

export type SaveState = "idle" | "saving" | "saved" | "error";

export type WorkspacePayload = {
  ceList: CeSummary[];
  rceList: RceSummary[];
  masterlist: MasterlistState;
  documents: { [key: string]: Json };
  schemaConfig: { [key: string]: Json };
  inspectionReports?: Json[];
  adminConfig?: Json;
};

export function emptyMasterlist(): MasterlistState {
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

export function defaultWorkspace(): WorkspacePayload {
  return {
    ceList: [
      {
        id: "CE-2025-001",
        client: "ABC Corp",
        status: "Ongoing",
        project: "Turbine Overhaul",
        lastEdited: "2025-01-25",
        lastEditedBy: "Estimator A",
      },
      {
        id: "CE-2025-002",
        client: "XYZ Ltd",
        status: "Pending",
        project: "Piping Fabrication",
        lastEdited: "2025-01-20",
        lastEditedBy: "Estimator B",
      },
      {
        id: "CE-2025-003",
        client: "DEF Inc",
        status: "Done",
        project: "Electrical Upgrade",
        lastEdited: "2025-01-18",
        lastEditedBy: "Estimator A",
      },
    ],
    rceList: [
      {
        id: "RCE-2025-001",
        client: "ABC Corp",
        location: "Bataan",
        description: "Turbine overhaul",
        category: "Onsite",
        status: "Pending",
        attachments: ["Site_Photos.zip", "Scope.pdf"],
        dateReceived: "2025-02-01",
      },
      {
        id: "RCE-2025-002",
        client: "XYZ Ltd",
        location: "Laguna",
        description: "Piping fabrication",
        category: "Shop",
        status: "In Review",
        attachments: ["Drawings.pdf"],
        dateReceived: "2025-02-05",
      },
    ],
    masterlist: emptyMasterlist(),
    documents: {},
    schemaConfig: {},
  };
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  if (typeof value === "object") return value as T;
  return fallback;
}

export function jsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, inner: unknown) => {
      if (typeof inner === "bigint") return Number(inner);
      if (typeof File !== "undefined" && inner instanceof File) {
        return { name: inner.name, size: inner.size, type: inner.type };
      }
      return inner;
    }),
  ) as T;
}
