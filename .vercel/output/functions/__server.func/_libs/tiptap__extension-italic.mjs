import { d as mergeAttributes, l as markInputRule, r as Mark, u as markPasteRule } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-italic/dist/index.js
/**
* Matches an italic to a *italic* on input.
*/
var starInputRegex = /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))$/;
/**
* Matches an italic to a *italic* on paste.
*/
var starPasteRegex = /(?:^|\s)(\*(?!\s+\*)((?:[^*]+))\*(?!\s+\*))/g;
/**
* Matches an italic to a _italic_ on input.
*/
var underscoreInputRegex = /(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))$/;
/**
* Matches an italic to a _italic_ on paste.
*/
var underscorePasteRegex = /(?:^|\s)(_(?!\s+_)((?:[^_]+))_(?!\s+_))/g;
/**
* This extension allows you to create italic text.
* @see https://www.tiptap.dev/api/marks/italic
*/
var Italic = Mark.create({
	name: "italic",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [
			{ tag: "em" },
			{
				tag: "i",
				getAttrs: (node) => node.style.fontStyle !== "normal" && null
			},
			{
				style: "font-style=normal",
				clearMark: (mark) => mark.type.name === this.name
			},
			{ style: "font-style=italic" }
		];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"em",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addCommands() {
		return {
			setItalic: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleItalic: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetItalic: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-i": () => this.editor.commands.toggleItalic(),
			"Mod-I": () => this.editor.commands.toggleItalic()
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
export { Italic as t };
