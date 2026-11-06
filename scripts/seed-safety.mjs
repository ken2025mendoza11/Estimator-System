/** The estimator-test Supabase project ref. The seed writes only when the URL host is exactly this ref. */
export const ESTIMATOR_TEST_PROJECT_REF = "nqxijgsbpffewizzefwi";

/**
 * Neon endpoint IDs the seed may write. For now this is only the main endpoint
 * of the test sign-in project. The live endpoint is not on this list.
 */
export const TEST_SIGN_IN_ENDPOINTS = ["ep-jolly-sound-azpo5a4b"];

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
 * Neon endpoint id: the first host label, with one "-pooler" ending removed.
 * The database name is not used. Both projects name that database neondb.
 * @param {unknown} databaseUrl
 * @returns {string}
 */
export function signInEndpointId(databaseUrl) {
	const raw = String(databaseUrl || "").trim();
	if (!raw) return "";
	try {
		const first = new URL(raw).hostname.toLowerCase().split(".")[0] || "";
		if (!first) return "";
		return first.endsWith("-pooler") ? first.slice(0, -"-pooler".length) : first;
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
	const signInEndpoint = signInEndpointId(env?.DATABASE_URL);
	const projectOk = supabaseProject === ESTIMATOR_TEST_PROJECT_REF;
	const endpointOk = TEST_SIGN_IN_ENDPOINTS.includes(signInEndpoint);
	const lines = [
		`Supabase project: ${supabaseProject || "(none)"}`,
		`Sign-in endpoint: ${signInEndpoint || "(none)"}`,
	];
	let message = "";
	if (!projectOk) message = "Refusing to seed. The Supabase URL is not the estimator-test project.";
	else if (!endpointOk) message = "Refusing to seed. DATABASE_URL is not an allowed estimator-test sign-in endpoint.";
	return { ok: projectOk && endpointOk, supabaseProject, signInEndpoint, lines, message };
}
