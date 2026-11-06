import { useEffect, useState } from "react";
import { Extension, Mark } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { bodyToHtml } from "../lib/estimator/libraryTemplates";

const FontMarks = Extension.create({
	name: "fontMarks",
	addGlobalAttributes() {
		return [{
			types: ["textStyle"],
			attributes: {
				fontSize: {
					default: null,
					parseHTML: (element) => element.style.fontSize || null,
					renderHTML: (attributes) => attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {},
				},
				fontFamily: {
					default: null,
					parseHTML: (element) => element.style.fontFamily || null,
					renderHTML: (attributes) => attributes.fontFamily ? { style: `font-family: ${attributes.fontFamily}` } : {},
				},
			},
		}];
	},
});

const AlignBlock = Extension.create({
	name: "alignBlock",
	addGlobalAttributes() {
		return [{
			types: ["paragraph", "heading"],
			attributes: {
				textAlign: {
					default: null,
					parseHTML: (element) => element.style.textAlign || null,
					renderHTML: (attributes) => attributes.textAlign ? { style: `text-align: ${attributes.textAlign}` } : {},
				},
				lineHeight: {
					default: null,
					parseHTML: (element) => element.style.lineHeight || null,
					renderHTML: (attributes) => attributes.lineHeight ? { style: `line-height: ${attributes.lineHeight}` } : {},
				},
			},
		}];
	},
});

/**
 * @param {string} name
 * @param {string} tag
 */
function scriptMark(name, tag) {
	return Mark.create({
		name,
		parseHTML() {
			return [{ tag }];
		},
		renderHTML({ HTMLAttributes }) {
			return [tag, HTMLAttributes, 0];
		},
	});
}

const Subscript = scriptMark("subscript", "sub");
const Superscript = scriptMark("superscript", "sup");

const FONTS = ["Calibri", "Arial", "Georgia", "Times New Roman", "Courier New"];
const SIZES = ["12px", "14px", "16px", "18px", "24px", "32px"];
const SYMBOLS = ["₱", "°", "±", "×", "÷", "μ", "Ω", "≤", "≥", "—"];
const CASES = ["upper", "lower", "title"];

/**
 * @param {unknown} value
 */
function escapeHtml(value) {
	const amp = "&" + "amp;";
	const lt = "&" + "lt;";
	const gt = "&" + "gt;";
	return String(value || "").replace(/&/g, amp).replace(/</g, lt).replace(/>/g, gt);
}

/**
 * @param {unknown} value
 * @param {string} mode
 */
function applyCase(value, mode) {
	const text = String(value || "");
	if (mode === "upper") return text.toUpperCase();
	if (mode === "lower") return text.toLowerCase();
	return text.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

/**
 * Word-like methodology editor. Extends the SOW TipTap stack.
 * @param {{ html?: string, page?: { margin?: string, pageNumbers?: boolean, showMarks?: boolean }, onChange?: (html: string) => void, onPage?: (page: any) => void }} props
 */
export function MethodologyEditor({ html, page, onChange, onPage }) {
	const [caseMode, setCaseMode] = useState(0);
	const [showMarks, setShowMarks] = useState(page?.showMarks === true);
	const editor = useEditor({
		extensions: [
			StarterKit,
			Underline,
			TextStyle,
			FontMarks,
			AlignBlock,
			Subscript,
			Superscript,
			Color,
			Highlight.configure({ multicolor: true }),
		],
		content: bodyToHtml(html),
		onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
	});
	useEffect(() => {
		if (!editor) return;
		const next = bodyToHtml(html);
		if (!editor.isFocused && next !== editor.getHTML()) editor.commands.setContent(next, false);
	}, [editor, html]);
	if (!editor) return <div aria-label="Methodology editor">Loading editor...</div>;
	const ed = editor;

	/**
	 * @param {{ margin?: string, pageNumbers?: boolean, showMarks?: boolean }} partial
	 */
	function patchPage(partial) {
		onPage?.({ margin: "2.54cm", pageNumbers: false, showMarks, ...page, ...partial });
	}
	function chain() {
		return ed.chain().focus();
	}
	/**
	 * @param {string} textAlign
	 */
	function setAlign(textAlign) {
		chain().updateAttributes("paragraph", { textAlign }).run();
	}
	function changeCase() {
		const mode = CASES[caseMode % CASES.length] || "title";
		setCaseMode((value) => value + 1);
		const { from, to } = ed.state.selection;
		const selected = ed.state.doc.textBetween(from, to, "\n");
		if (!selected) return;
		ed.chain().focus().insertContent(applyCase(selected, mode)).run();
	}
	function sortSelection() {
		const { from, to } = ed.state.selection;
		const selected = ed.state.doc.textBetween(from, to, "\n");
		if (!selected.trim()) return;
		const sorted = selected.split("\n").map((line) => line.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b)).join("\n");
		ed.chain().focus().insertContent(sorted.split("\n").map((line) => `<p>${escapeHtml(line)}</p>`).join("")).run();
	}
	function insertTable() {
		chain().insertContent("<p><strong>Table</strong></p><ul><li>A</li><li>B</li></ul><p>1 | 2</p><p>3 | 4</p>").run();
	}

	/**
	 * @param {string} label
	 * @param {() => void} onClick
	 * @param {boolean} [pressed]
	 */
	const btn = (label, onClick, pressed) => (
		<button type="button" className="ce-btn-ghost ce-btn-sm" aria-label={label} aria-pressed={pressed ? "true" : "false"} onClick={onClick}>{label}</button>
	);

	return (
		<div className={"method-rich" + (showMarks ? " method-show-marks" : "")} aria-label="Methodology editor" style={showMarks ? { outline: "1px dashed #8a8175" } : undefined}>
			<div className="method-tools" aria-label="Font">
				<select aria-label="Font family" className="ce-input" defaultValue="Calibri" onChange={(event) => chain().setMark("textStyle", { fontFamily: event.target.value }).run()}>
					{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
				</select>
				<select aria-label="Font size" className="ce-input" defaultValue="16px" onChange={(event) => chain().setMark("textStyle", { fontSize: event.target.value }).run()}>
					{SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
				</select>
				{btn("A+", () => chain().setMark("textStyle", { fontSize: "20px" }).run())}
				{btn("A-", () => chain().setMark("textStyle", { fontSize: "12px" }).run())}
				{btn("Aa", changeCase)}
				{btn("Clear", () => chain().unsetAllMarks().clearNodes().run())}
				{btn("Bold", () => chain().toggleBold().run(), editor.isActive("bold"))}
				{btn("Italic", () => chain().toggleItalic().run(), editor.isActive("italic"))}
				{btn("Underline", () => chain().toggleUnderline().run(), editor.isActive("underline"))}
				{btn("Strike", () => chain().toggleStrike().run(), editor.isActive("strike"))}
				{btn("Sub", () => chain().toggleMark("subscript").run(), editor.isActive("subscript"))}
				{btn("Sup", () => chain().toggleMark("superscript").run(), editor.isActive("superscript"))}
				<label className="ce-btn-ghost ce-btn-sm">Color
					<input aria-label="Text color" type="color" defaultValue="#1c1915" onChange={(event) => chain().setColor(event.target.value).run()} />
				</label>
				<label className="ce-btn-ghost ce-btn-sm">Highlight
					<input aria-label="Highlight" type="color" defaultValue="#ffe08a" onChange={(event) => chain().toggleHighlight({ color: event.target.value }).run()} />
				</label>
			</div>
			<div className="method-tools" aria-label="Paragraph">
				{btn("Bullets", () => chain().toggleBulletList().run(), editor.isActive("bulletList"))}
				{btn("Numbering", () => chain().toggleOrderedList().run(), editor.isActive("orderedList"))}
				{btn("Multilevel", () => chain().toggleBulletList().sinkListItem("listItem").run())}
				{btn("Indent", () => chain().sinkListItem("listItem").run())}
				{btn("Outdent", () => chain().liftListItem("listItem").run())}
				{btn("Sort", sortSelection)}
				{btn("Marks", () => { const next = !showMarks; setShowMarks(next); patchPage({ showMarks: next }); }, showMarks)}
				{btn("Left", () => setAlign("left"))}
				{btn("Center", () => setAlign("center"))}
				{btn("Right", () => setAlign("right"))}
				{btn("Justify", () => setAlign("justify"))}
				<select aria-label="Line spacing" className="ce-input" defaultValue="1.15" onChange={(event) => chain().updateAttributes("paragraph", { lineHeight: event.target.value }).run()}>
					{["1", "1.15", "1.5", "2"].map((space) => <option key={space} value={space}>{space}</option>)}
				</select>
				{btn("Shading", () => chain().toggleHighlight({ color: "#fff2cc" }).run())}
				{btn("Borders", () => chain().updateAttributes("paragraph", { textAlign: editor.getAttributes("paragraph").textAlign || "left" }).run())}
				{btn("Table", insertTable)}
			</div>
			<div className="method-tools" aria-label="Page">
				<label className="ce-btn-ghost ce-btn-sm">Margins
					<select aria-label="Margins" className="ce-input" value={page?.margin || "2.54cm"} onChange={(event) => patchPage({ margin: event.target.value })}>
						<option value="1.27cm">Narrow</option>
						<option value="2.54cm">Normal</option>
						<option value="3.81cm">Wide</option>
					</select>
				</label>
				{btn("Page numbers", () => patchPage({ pageNumbers: page?.pageNumbers !== true }), page?.pageNumbers === true)}
				<select aria-label="Symbol" className="ce-input" defaultValue="" onChange={(event) => { if (event.target.value) chain().insertContent(event.target.value).run(); event.target.value = ""; }}>
					<option value="">Symbol</option>
					{SYMBOLS.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
				</select>
				{btn("Equation", () => {
					const formula = window.prompt("Equation", "E = mc^2");
					if (!formula) return;
					chain().insertContent(`<span data-equation="1">${escapeHtml(formula)}</span>`).run();
				})}
			</div>
			<EditorContent editor={editor} />
		</div>
	);
}
