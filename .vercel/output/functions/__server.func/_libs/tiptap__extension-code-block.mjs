import { S as TextSelection, b as PluginKey, d as mergeAttributes, i as Node, p as textblockTypeInputRule, x as Selection, y as Plugin } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/extension-code-block/dist/index.js
/**
* Matches a code block with backticks.
*/
var backtickInputRegex = /^```([a-z]+)?[\s\n]$/;
/**
* Matches a code block with tildes.
*/
var tildeInputRegex = /^~~~([a-z]+)?[\s\n]$/;
/**
* This extension allows you to create code blocks.
* @see https://tiptap.dev/api/nodes/code-block
*/
var CodeBlock = Node.create({
	name: "codeBlock",
	addOptions() {
		return {
			languageClassPrefix: "language-",
			exitOnTripleEnter: true,
			exitOnArrowDown: true,
			defaultLanguage: null,
			HTMLAttributes: {}
		};
	},
	content: "text*",
	marks: "",
	group: "block",
	code: true,
	defining: true,
	addAttributes() {
		return { language: {
			default: this.options.defaultLanguage,
			parseHTML: (element) => {
				var _a;
				const { languageClassPrefix } = this.options;
				const language = [...((_a = element.firstElementChild) === null || _a === void 0 ? void 0 : _a.classList) || []].filter((className) => className.startsWith(languageClassPrefix)).map((className) => className.replace(languageClassPrefix, ""))[0];
				if (!language) return null;
				return language;
			},
			rendered: false
		} };
	},
	parseHTML() {
		return [{
			tag: "pre",
			preserveWhitespace: "full"
		}];
	},
	renderHTML({ node, HTMLAttributes }) {
		return [
			"pre",
			mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
			[
				"code",
				{ class: node.attrs.language ? this.options.languageClassPrefix + node.attrs.language : null },
				0
			]
		];
	},
	addCommands() {
		return {
			setCodeBlock: (attributes) => ({ commands }) => {
				return commands.setNode(this.name, attributes);
			},
			toggleCodeBlock: (attributes) => ({ commands }) => {
				return commands.toggleNode(this.name, "paragraph", attributes);
			}
		};
	},
	addKeyboardShortcuts() {
		return {
			"Mod-Alt-c": () => this.editor.commands.toggleCodeBlock(),
			Backspace: () => {
				const { empty, $anchor } = this.editor.state.selection;
				const isAtStart = $anchor.pos === 1;
				if (!empty || $anchor.parent.type.name !== this.name) return false;
				if (isAtStart || !$anchor.parent.textContent.length) return this.editor.commands.clearNodes();
				return false;
			},
			Enter: ({ editor }) => {
				if (!this.options.exitOnTripleEnter) return false;
				const { state } = editor;
				const { selection } = state;
				const { $from, empty } = selection;
				if (!empty || $from.parent.type !== this.type) return false;
				const isAtEnd = $from.parentOffset === $from.parent.nodeSize - 2;
				const endsWithDoubleNewline = $from.parent.textContent.endsWith("\n\n");
				if (!isAtEnd || !endsWithDoubleNewline) return false;
				return editor.chain().command(({ tr }) => {
					tr.delete($from.pos - 2, $from.pos);
					return true;
				}).exitCode().run();
			},
			ArrowDown: ({ editor }) => {
				if (!this.options.exitOnArrowDown) return false;
				const { state } = editor;
				const { selection, doc } = state;
				const { $from, empty } = selection;
				if (!empty || $from.parent.type !== this.type) return false;
				if (!($from.parentOffset === $from.parent.nodeSize - 2)) return false;
				const after = $from.after();
				if (after === void 0) return false;
				if (doc.nodeAt(after)) return editor.commands.command(({ tr }) => {
					tr.setSelection(Selection.near(doc.resolve(after)));
					return true;
				});
				return editor.commands.exitCode();
			}
		};
	},
	addInputRules() {
		return [textblockTypeInputRule({
			find: backtickInputRegex,
			type: this.type,
			getAttributes: (match) => ({ language: match[1] })
		}), textblockTypeInputRule({
			find: tildeInputRegex,
			type: this.type,
			getAttributes: (match) => ({ language: match[1] })
		})];
	},
	addProseMirrorPlugins() {
		return [new Plugin({
			key: new PluginKey("codeBlockVSCodeHandler"),
			props: { handlePaste: (view, event) => {
				if (!event.clipboardData) return false;
				if (this.editor.isActive(this.type.name)) return false;
				const text = event.clipboardData.getData("text/plain");
				const vscode = event.clipboardData.getData("vscode-editor-data");
				const vscodeData = vscode ? JSON.parse(vscode) : void 0;
				const language = vscodeData === null || vscodeData === void 0 ? void 0 : vscodeData.mode;
				if (!text || !language) return false;
				const { tr, schema } = view.state;
				const textNode = schema.text(text.replace(/\r\n?/g, "\n"));
				tr.replaceSelectionWith(this.type.create({ language }, textNode));
				if (tr.selection.$from.parent.type !== this.type) tr.setSelection(TextSelection.near(tr.doc.resolve(Math.max(0, tr.selection.from - 2))));
				tr.setMeta("paste", true);
				view.dispatch(tr);
				return true;
			} }
		})];
	}
});
//#endregion
export { CodeBlock as t };
