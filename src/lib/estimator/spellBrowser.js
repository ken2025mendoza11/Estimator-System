// @ts-nocheck
import nspell from "nspell";
import aff from "../../../node_modules/dictionary-en/index.aff?raw";
import dic from "../../../node_modules/dictionary-en/index.dic?raw";

let cached = null;

export function browserSpell() {
	if (!cached) cached = nspell({ aff, dic });
	return cached;
}
