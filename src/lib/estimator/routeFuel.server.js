// @ts-nocheck
import { routeFuelResponse } from "./routeFuel.js";

const routes = new Map();
const tiles = new Map();

export function routeFuelHttp(request) {
	return routeFuelResponse(request, globalThis.fetch, { routes, tiles });
}
