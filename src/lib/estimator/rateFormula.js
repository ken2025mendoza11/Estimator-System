// @ts-nocheck
/**
 * Equipment rate formulas. Numbers, the seven named inputs, and + - * / ( ).
 * No eval, no Function, no other names.
 */

const INPUTS = ["cost", "life", "salvage", "hours", "days", "maintenance", "rental"];

function tokenize(source) {
	const text = String(source || "").trim();
	const tokens = [];
	let i = 0;
	while (i < text.length) {
		const ch = text[i];
		if (ch === " " || ch === "\t" || ch === "\n") {
			i += 1;
			continue;
		}
		if ("+-*/()".includes(ch)) {
			tokens.push({ kind: "op", value: ch });
			i += 1;
			continue;
		}
		if (/[0-9.]/.test(ch)) {
			let j = i + 1;
			while (j < text.length && /[0-9.]/.test(text[j])) j += 1;
			const raw = text.slice(i, j);
			if (!/^\d+(\.\d+)?$/.test(raw)) return { error: "That number is not valid." };
			tokens.push({ kind: "num", value: Number(raw) });
			i = j;
			continue;
		}
		if (/[A-Za-z_]/.test(ch)) {
			let j = i + 1;
			while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j += 1;
			tokens.push({ kind: "name", value: text.slice(i, j) });
			i = j;
			continue;
		}
		return { error: "That formula has a character the rate parser does not allow." };
	}
	return { tokens };
}

function parseExpression(tokens) {
	let pos = 0;
	function peek() {
		return tokens[pos];
	}
	function eat(op) {
		const token = tokens[pos];
		if (!token || token.kind !== "op" || token.value !== op) return false;
		pos += 1;
		return true;
	}
	function parseAdd() {
		let node = parseMul();
		if (node.error) return node;
		while (peek() && peek().kind === "op" && (peek().value === "+" || peek().value === "-")) {
			const op = peek().value;
			pos += 1;
			const right = parseMul();
			if (right.error) return right;
			node = { kind: "bin", op, left: node, right };
		}
		return node;
	}
	function parseMul() {
		let node = parseUnary();
		if (node.error) return node;
		while (peek() && peek().kind === "op" && (peek().value === "*" || peek().value === "/")) {
			const op = peek().value;
			pos += 1;
			const right = parseUnary();
			if (right.error) return right;
			node = { kind: "bin", op, left: node, right };
		}
		return node;
	}
	function parseUnary() {
		if (eat("+")) return parseUnary();
		if (eat("-")) {
			const node = parseUnary();
			if (node.error) return node;
			return { kind: "neg", node };
		}
		return parsePrimary();
	}
	function parsePrimary() {
		const token = peek();
		if (!token) return { error: "The formula ended early." };
		if (token.kind === "num") {
			pos += 1;
			return { kind: "num", value: token.value };
		}
		if (token.kind === "name") {
			pos += 1;
			if (peek() && peek().kind === "op" && peek().value === "(") {
				return { error: "Formulas cannot call a function." };
			}
			if (!INPUTS.includes(token.value)) return { error: `Unknown name ${token.value}.` };
			return { kind: "name", value: token.value };
		}
		if (eat("(")) {
			const node = parseAdd();
			if (node.error) return node;
			if (!eat(")")) return { error: "A bracket was not closed." };
			return node;
		}
		return { error: "The formula could not be read." };
	}
	const node = parseAdd();
	if (node.error) return node;
	if (pos !== tokens.length) return { error: "The formula has extra text." };
	return node;
}

function evalNode(node, vars) {
	if (!node || node.error) return node;
	if (node.kind === "num") return { ok: true, value: node.value };
	if (node.kind === "name") {
		const value = Number(vars[node.value]);
		if (!Number.isFinite(value)) return { ok: false, error: `Missing ${node.value}.` };
		return { ok: true, value };
	}
	if (node.kind === "neg") {
		const inner = evalNode(node.node, vars);
		if (!inner.ok) return inner;
		return { ok: true, value: -inner.value };
	}
	const left = evalNode(node.left, vars);
	if (!left.ok) return left;
	const right = evalNode(node.right, vars);
	if (!right.ok) return right;
	if (node.op === "+") return { ok: true, value: left.value + right.value };
	if (node.op === "-") return { ok: true, value: left.value - right.value };
	if (node.op === "*") return { ok: true, value: left.value * right.value };
	if (right.value === 0) return { ok: false, error: "Division by zero." };
	return { ok: true, value: left.value / right.value };
}

/**
 * @param {string} expression
 * @param {Record<string, number>} vars
 */
export function evaluateFormula(expression, vars) {
	const text = String(expression || "").trim();
	if (!text) return { ok: false, error: "The formula is empty." };
	const lexed = tokenize(text);
	if (lexed.error) return { ok: false, error: lexed.error };
	const tree = parseExpression(lexed.tokens);
	if (tree.error) return { ok: false, error: tree.error };
	const result = evalNode(tree, vars || {});
	if (!result.ok) return result;
	if (!Number.isFinite(result.value)) return { ok: false, error: "The formula did not return a number." };
	return { ok: true, value: result.value };
}

export function roundRate(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	return Math.round(n * 100) / 100;
}

export const RATE_INPUTS = INPUTS.slice();
