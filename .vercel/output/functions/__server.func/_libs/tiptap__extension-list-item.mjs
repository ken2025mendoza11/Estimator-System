import { d as mergeAttributes, i as Node } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-list-item/dist/index.js
/**
* This extension allows you to create list items.
* @see https://www.tiptap.dev/api/nodes/list-item
*/
var ListItem = Node.create({
	name: "listItem",
	addOptions() {
		return {
			HTMLAttributes: {},
			bulletListTypeName: "bulletList",
			orderedListTypeName: "orderedList"
		};
	},
	content: "paragraph block*",
	defining: true,
	parseHTML() {
		return [{ tag: "li" }];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"li",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addKeyboardShortcuts() {
		return {
			Enter: () => this.editor.commands.splitListItem(this.name),
			Tab: () => this.editor.commands.sinkListItem(this.name),
			"Shift-Tab": () => this.editor.commands.liftListItem(this.name)
		};
	}
});
//#endregion
export { ListItem as t };
