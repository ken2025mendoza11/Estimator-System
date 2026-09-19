import { d as mergeAttributes, l as markInputRule, r as Mark, u as markPasteRule } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-bold/dist/index.js
/**
* Matches bold text via `**` as input.
*/
var starInputRegex = /(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))$/;
/**
* Matches bold text via `**` while pasting.
*/
var starPasteRegex = /(?:^|\s)(\*\*(?!\s+\*\*)((?:[^*]+))\*\*(?!\s+\*\*))/g;
/**
* Matches bold text via `__` as input.
*/
var underscoreInputRegex = /(?:^|\s)(__(?!\s+__)((?:[^_]+))__(?!\s+__))$/;
/**
* Matches bold text via `__` while pasting.
*/
var underscorePasteRegex = /(?:^|\s)(__(?!\s+__)((?:[^_]+))__(?!\s+__))/g;
/**
* This extension allows you to mark text as bold.
* @see https://tiptap.dev/api/marks/bold
*/
var Bold = Mark.create({
	name: "bold",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [
			{ tag: "strong" },
			{
				tag: "b",
				getAttrs: (node) => node.style.fontWeight !== "normal" && null
			},
			{
				style: "font-weight=400",
				clearMark: (mark) => mark.type.name === this.name
			},
			{
				style: "font-weight",
				getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"strong",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addCommands() {
		return {
			setBold: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleBold: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetBold: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-b": () => this.editor.commands.toggleBold(),
			"Mod-B": () => this.editor.commands.toggleBold()
		};
	},
	addInputRules() {
		return [markInputRule({
			find: starInputRegex,
			type: this.type
		}), markInputRule({
			find: underscoreInputRegex,
			type: this.type
		})];
	},
	addPasteRules() {
		return [markPasteRule({
			find: starPasteRegex,
			type: this.type
		}), markPasteRule({
			find: underscorePasteRegex,
			type: this.type
		})];
	}
});
//#endregion
export { Bold as t };
