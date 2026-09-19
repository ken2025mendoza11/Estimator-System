import { d as mergeAttributes, i as Node } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-paragraph/dist/index.js
/**
* This extension allows you to create paragraphs.
* @see https://www.tiptap.dev/api/nodes/paragraph
*/
var Paragraph = Node.create({
	name: "paragraph",
	priority: 1e3,
	addOptions() {
		return { HTMLAttributes: {} };
	},
	group: "block",
	content: "inline*",
	parseHTML() {
		return [{ tag: "p" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"p",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addCommands() {
		return { setParagraph: () => ({ commands }) => {
			return commands.setNode(this.name);
		} };
	},
	addKeyboardShortcuts() {
		return { "Mod-Alt-0": () => this.editor.commands.setParagraph() };
	}
});
//#endregion
export { Paragraph as t };
