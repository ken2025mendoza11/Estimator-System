import { d as mergeAttributes, l as markInputRule, r as Mark, u as markPasteRule } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-strike/dist/index.js
/**
* Matches a strike to a ~~strike~~ on input.
*/
var inputRegex = /(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))$/;
/**
* Matches a strike to a ~~strike~~ on paste.
*/
var pasteRegex = /(?:^|\s)(~~(?!\s+~~)((?:[^~]+))~~(?!\s+~~))/g;
/**
* This extension allows you to create strike text.
* @see https://www.tiptap.dev/api/marks/strike
*/
var Strike = Mark.create({
	name: "strike",
	addOptions() {
		return { HTMLAttributes: {} };
	},
	parseHTML() {
		return [
			{ tag: "s" },
			{ tag: "del" },
			{ tag: "strike" },
			{
				style: "text-decoration",
				consuming: false,
				getAttrs: (style) => style.includes("line-through") ? {} : false
			}
		];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"s",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addCommands() {
		return {
			setStrike: () => ({ commands }) => {
				return commands.setMark(this.name);
			},
			toggleStrike: () => ({ commands }) => {
				return commands.toggleMark(this.name);
			},
			unsetStrike: () => ({ commands }) => {
				return commands.unsetMark(this.name);
			}
		};
	},
	addKeyboardShortcuts() {
		return { "Mod-Shift-s": () => this.editor.commands.toggleStrike() };
	},
	addInputRules() {
		return [markInputRule({
			find: inputRegex,
			type: this.type
		})];
	},
	addPasteRules() {
		return [markPasteRule({
			find: pasteRegex,
			type: this.type
		})];
	}
});
//#endregion
export { Strike as t };
