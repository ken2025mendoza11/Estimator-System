import { useEffect } from "react";
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
const SIZES = ["12", "14", "16", "18", "24", "32"];
const SYMBOLS = ["₱", "°", "±", "×", "÷", "μ", "Ω", "≤", "≥", "—"];

/**
 * Word-like methodology editor. One ribbon, then a typing page.
 * @param {{ html?: string, page?: { margin?: string, pageNumbers?: boolean, showMarks?: boolean }, onChange?: (html: string) => void, onPage?: (page: any) => void }} props
 */
export function MethodologyEditor({ html, page, onChange, onPage }) {
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
		content: bodyToHtml(html || "<p></p>"),
		onUpdate: ({ editor: current }) => onChange?.(current.getHTML()),
	});
	useEffect(() => {
		if (!editor) return;
		const next = bodyToHtml(html || "<p></p>");
		if (!editor.isFocused && next !== editor.getHTML()) editor.commands.setContent(next, false);
	}, [editor, html]);
	if (!editor) return <div aria-label="Methodology editor">Loading editor...</div>;
	const ed = editor;

	function chain() {
		return ed.chain().focus();
	}
	/**
	 * @param {string} textAlign
	 */
	function setAlign(textAlign) {
		chain().updateAttributes("paragraph", { textAlign }).run();
	}
	/**
	 * @param {number} dir
	 */
	function bumpSize(dir) {
		const current = String(ed.getAttributes("textStyle").fontSize || "16px");
		const n = Number.parseInt(current, 10) || 16;
		const next = Math.min(32, Math.max(10, n + dir));
		chain().setMark("textStyle", { fontSize: `${next}px` }).run();
	}

	/**
	 * @param {string} label
	 * @param {import("react").ReactNode} child
	 * @param {() => void} onClick
	 * @param {boolean} [pressed]
	 */
	const btn = (label, child, onClick, pressed) => (
		<button type="button" className="method-rb" aria-label={label} title={label} aria-pressed={pressed ? "true" : "false"} onClick={onClick}>{child}</button>
	);

	return (
		<div className="method-rich" aria-label="Methodology editor">
			<div className="method-ribbon" role="toolbar" aria-label="Formatting">
				<div className="method-group" aria-label="Font">
					<div className="method-group-row">
						<select aria-label="Font family" className="ce-input method-rb-select" defaultValue="Calibri" onChange={(event) => chain().setMark("textStyle", { fontFamily: event.target.value }).run()}>
							{FONTS.map((font) => <option key={font} value={font}>{font}</option>)}
						</select>
						<select aria-label="Font size" className="ce-input method-rb-size" defaultValue="16" onChange={(event) => chain().setMark("textStyle", { fontSize: `${event.target.value}px` }).run()}>
							{SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
						</select>
						{btn("Grow font", "A+", () => bumpSize(2))}
						{btn("Shrink font", "A-", () => bumpSize(-2))}
						{btn("Bold", <b>B</b>, () => chain().toggleBold().run(), editor.isActive("bold"))}
						{btn("Italic", <i>I</i>, () => chain().toggleItalic().run(), editor.isActive("italic"))}
						{btn("Underline", <u>U</u>, () => chain().toggleUnderline().run(), editor.isActive("underline"))}
						{btn("Strikethrough", <s>ab</s>, () => chain().toggleStrike().run(), editor.isActive("strike"))}
						{btn("Subscript", <span>x<sub>2</sub></span>, () => chain().toggleMark("subscript").run(), editor.isActive("subscript"))}
						{btn("Superscript", <span>x<sup>2</sup></span>, () => chain().toggleMark("superscript").run(), editor.isActive("superscript"))}
						<label className="method-rb method-rb-color" title="Text color">A
							<input aria-label="Text color" type="color" defaultValue="#1c1915" onChange={(event) => chain().setColor(event.target.value).run()} />
						</label>
						<label className="method-rb method-rb-color" title="Highlight">
							<span className="method-hl">▬</span>
							<input aria-label="Highlight" type="color" defaultValue="#ffe08a" onChange={(event) => chain().toggleHighlight({ color: event.target.value }).run()} />
						</label>
					</div>
					<span className="method-group-label">Font</span>
				</div>
				<div className="method-group" aria-label="Paragraph">
					<div className="method-group-row">
						{btn("Bullets", "•", () => chain().toggleBulletList().run(), editor.isActive("bulletList"))}
						{btn("Numbering", "1.", () => chain().toggleOrderedList().run(), editor.isActive("orderedList"))}
						{btn("Outdent", "⇤", () => chain().liftListItem("listItem").run())}
						{btn("Indent", "⇥", () => chain().sinkListItem("listItem").run())}
						{btn("Align left", "⟸", () => setAlign("left"))}
						{btn("Align center", "↔", () => setAlign("center"))}
						{btn("Align right", "⟹", () => setAlign("right"))}
						{btn("Justify", "☰", () => setAlign("justify"))}
						<select aria-label="Line spacing" className="ce-input method-rb-size" defaultValue="1.15" onChange={(event) => chain().updateAttributes("paragraph", { lineHeight: event.target.value }).run()}>
							{["1", "1.15", "1.5", "2"].map((space) => <option key={space} value={space}>{space}</option>)}
						</select>
						{btn("Shading", "▤", () => chain().toggleHighlight({ color: "#fff2cc" }).run())}
						{btn("Borders", "▢", () => {
							const align = editor.getAttributes("paragraph").textAlign || "left";
							chain().updateAttributes("paragraph", { textAlign: align }).run();
							onPage?.({ margin: "2.54cm", pageNumbers: false, ...page });
						})}
					</div>
					<span className="method-group-label">Paragraph</span>
				</div>
				<div className="method-group" aria-label="Symbol">
					<div className="method-group-row">
						<select aria-label="Symbol" className="ce-input method-rb-size" defaultValue="" onChange={(event) => { if (event.target.value) chain().insertContent(event.target.value).run(); event.target.value = ""; }}>
							<option value="">Ω</option>
							{SYMBOLS.map((symbol) => <option key={symbol} value={symbol}>{symbol}</option>)}
						</select>
					</div>
					<span className="method-group-label">Symbol</span>
				</div>
			</div>
			<div className="method-sheet" onMouseDown={(event) => {
				if (event.target === event.currentTarget) ed.commands.focus("end");
			}}>
				<EditorContent editor={editor} />
			</div>
		</div>
	);
}
