import { d as mergeAttributes, n as Extension, r as Mark } from "./core+[...].mjs";
//#region node_modules/@tiptap/extension-text-style/dist/index.js
var mergeNestedSpanStyles = (element) => {
	if (!element.children.length) return;
	const childSpans = element.querySelectorAll("span");
	if (!childSpans) return;
	childSpans.forEach((childSpan) => {
		var _a, _b;
		const childStyle = childSpan.getAttribute("style");
		const closestParentSpanStyleOfChild = (_b = (_a = childSpan.parentElement) === null || _a === void 0 ? void 0 : _a.closest("span")) === null || _b === void 0 ? void 0 : _b.getAttribute("style");
		childSpan.setAttribute("style", `${closestParentSpanStyleOfChild};${childStyle}`);
	});
};
/**
* This extension allows you to create text styles. It is required by default
* for the `textColor` and `backgroundColor` extensions.
* @see https://www.tiptap.dev/api/marks/text-style
*/
var TextStyle = Mark.create({
	name: "textStyle",
	priority: 101,
	addOptions() {
		return {
			HTMLAttributes: {},
			mergeNestedSpanStyles: false
		};
	},
	parseHTML() {
		return [{
			tag: "span",
			getAttrs: (element) => {
				if (!element.hasAttribute("style")) return false;
				if (this.options.mergeNestedSpanStyles) mergeNestedSpanStyles(element);
				return {};
			}
		}];
	},
	renderHTML({ HTMLAttributes }) {
		return [
			"span",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			0
		];
	},
	addCommands() {
		return { removeEmptyTextStyle: () => ({ tr }) => {
			const { selection } = tr;
			tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
				if (node.isTextblock) return true;
				if (!node.marks.filter((mark) => mark.type === this.type).some((mark) => Object.values(mark.attrs).some((value) => !!value))) tr.removeMark(pos, pos + node.nodeSize, this.type);
			});
			return true;
		} };
	}
});
//#endregion
//#region node_modules/@tiptap/extension-color/dist/index.js
/**
* This extension allows you to color your text.
* @see https://tiptap.dev/api/extensions/color
*/
var Color = Extension.create({
	name: "color",
	addOptions() {
		return { types: ["textStyle"] };
	},
	addGlobalAttributes() {
		return [{
			types: this.options.types,
			attributes: { color: {
				default: null,
				parseHTML: (element) => {
					var _a;
					return (_a = element.style.color) === null || _a === void 0 ? void 0 : _a.replace(/['"]+/g, "");
				},
				renderHTML: (attributes) => {
					if (!attributes.color) return {};
					return { style: `color: ${attributes.color}` };
				}
			} }
		}];
	},
	addCommands() {
		return {
			setColor: (color) => ({ chain }) => {
				return chain().setMark("textStyle", { color }).run();
			},
			unsetColor: () => ({ chain }) => {
				return chain().setMark("textStyle", { color: null }).removeEmptyTextStyle().run();
			}
		};
	}
});
//#endregion
export { TextStyle as n, Color as t };
