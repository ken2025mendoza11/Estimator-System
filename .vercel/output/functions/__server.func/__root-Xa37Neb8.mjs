import { n as createServerFn, r as TSS_SERVER_FUNCTION } from "./_ssr/ssr.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/__root-Xa37Neb8.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var fetchSessionUser_createServerFn_handler = createServerRpc({
	id: "2c4985e96c199268f7f639534cb5e8e31d6b19d43286bf77416413db60ffde26",
	name: "fetchSessionUser",
	filename: "src/routes/__root.tsx"
}, (opts) => fetchSessionUser.__executeServer(opts));
var fetchSessionUser = createServerFn({ method: "GET" }).handler(fetchSessionUser_createServerFn_handler, async () => {
	const { getSessionUser } = await import("./_ssr/verify.server-C6BKZ4Ay.mjs");
	const u = await getSessionUser();
	return u ? {
		id: u.id,
		email: u.email
	} : null;
});
//#endregion
export { fetchSessionUser_createServerFn_handler };
