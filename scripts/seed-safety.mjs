/** The estimator-test Supabase project ref. The seed writes only when the URL host is exactly this ref. */
export const ESTIMATOR_TEST_PROJECT_REF = "nqxijgsbpffewizzefwi";

/** The TEST sign-in database. The live database name is estimator-auth and is refused. */
export const TEST_SIGN_IN_DATABASE = "estimator-test-auth";

/**
 * Project ref from a Supabase URL. A longer or shorter host does not match.
 * @param {unknown} supabaseUrl
 * @returns {string}
 */
export function supabaseProjectRef(supabaseUrl) {
	const raw = String(supabaseUrl || "").trim();
	if (!raw) return "";
	try {
		const host = new URL(raw).hostname.toLowerCase();
		const suffix = ".supabase.co";
		if (!host.endsWith(suffix)) return "";
		const ref = host.slice(0, -suffix.length);
		if (!/^[a-z0-9]+$/.test(ref)) return "";
		return ref;
	} catch {
		return "";
	}
}

/**
 * Database name from a Postgres URL. The user, host, and query are ignored.
 * @param {unknown} databaseUrl
 * @returns {string}
 */
export function signInDatabaseName(databaseUrl) {
	const raw = String(databaseUrl || "").trim();
	if (!raw) return "";
	try {
		const name = decodeURIComponent(new URL(raw).pathname.replace(/^\/+|\/+$/g, ""));
		if (!name || name.includes("/")) return "";
		return name;
	} catch {
		return "";
	}
}

/**
 * What the seed would write, and whether that pair is the test project.
 * @param {{ VITE_SUPABASE_URL?: string, DATABASE_URL?: string }} env
 */
export function seedWriteTarget(env) {
	const supabaseProject = supabaseProjectRef(env?.VITE_SUPABASE_URL);
	const signInDatabase = signInDatabaseName(env?.DATABASE_URL);
	const projectOk = supabaseProject === ESTIMATOR_TEST_PROJECT_REF;
	const databaseOk = signInDatabase === TEST_SIGN_IN_DATABASE;
	const lines = [
		`Supabase project: ${supabaseProject || "(none)"}`,
		`Sign-in database: ${signInDatabase || "(none)"}`,
	];
	let message = "";
	if (!projectOk) message = "Refusing to seed. The Supabase URL is not the estimator-test project.";
	else if (!databaseOk) message = "Refusing to seed. DATABASE_URL is not the estimator-test-auth sign-in database.";
	return { ok: projectOk && databaseOk, supabaseProject, signInDatabase, lines, message };
}
