import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

if (!globalThis.document) {
	const el = () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {}, click() {}, classList: { add() {}, remove() {} } });
	globalThis.document = { createElement: el, body: el(), querySelector() { return null; }, documentElement: el() };
}
if (!globalThis.localStorage) {
	const box = new Map();
	globalThis.localStorage = { getItem: (k) => box.get(k) || null, setItem: (k, v) => box.set(k, String(v)), removeItem: (k) => box.delete(k) };
}
if (!globalThis.window) globalThis.window = globalThis;

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
	configFile: false,
	root,
	server: { middlewareMode: true, hmr: false },
	appType: "custom",
	logLevel: "error",
	plugins: [react()],
	resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
});
try {
	await vite.ssrLoadModule("/scripts/render-entry.js");
} finally {
	await vite.close();
}
