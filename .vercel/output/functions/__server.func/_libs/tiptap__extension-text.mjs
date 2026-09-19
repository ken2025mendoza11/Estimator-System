import { i as Node } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-text/dist/index.js
/**
* This extension allows you to create text nodes.
* @see https://www.tiptap.dev/api/nodes/text
*/
var Text = Node.create({
	name: "text",
	group: "inline"
});
//#endregion
export { Text as t };
