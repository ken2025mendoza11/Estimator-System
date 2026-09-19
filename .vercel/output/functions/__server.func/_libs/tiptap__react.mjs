import { o as __toESM } from "../_runtime.mjs";
import { B as require_react, l as require_react_dom } from "./@tanstack/react-router+[...].mjs";
import { t as Editor } from "./@tiptap/core+[...].mjs";
//#region node_modules/@tiptap/react/dist/index.js
var import_react = /* @__PURE__ */ __toESM(require_react(), 1);
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom(), 1);
function getDefaultExportFromCjs(x) {
	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var shim = { exports: {} };
var useSyncExternalStoreShim_production_min = {};
/**
* @license React
* use-sync-external-store-shim.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var hasRequiredUseSyncExternalStoreShim_production_min;
function requireUseSyncExternalStoreShim_production_min() {
	if (hasRequiredUseSyncExternalStoreShim_production_min) return useSyncExternalStoreShim_production_min;
	hasRequiredUseSyncExternalStoreShim_production_min = 1;
	var e = import_react.default;
	function h(a, b) {
		return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
	}
	var k = "function" === typeof Object.is ? Object.is : h, l = e.useState, m = e.useEffect, n = e.useLayoutEffect, p = e.useDebugValue;
	function q(a, b) {
		var d = b(), f = l({ inst: {
			value: d,
			getSnapshot: b
		} }), c = f[0].inst, g = f[1];
		n(function() {
			c.value = d;
			c.getSnapshot = b;
			r(c) && g({ inst: c });
		}, [
			a,
			d,
			b
		]);
		m(function() {
			r(c) && g({ inst: c });
			return a(function() {
				r(c) && g({ inst: c });
			});
		}, [a]);
		p(d);
		return d;
	}
	function r(a) {
		var b = a.getSnapshot;
		a = a.value;
		try {
			var d = b();
			return !k(a, d);
		} catch (f) {
			return !0;
		}
	}
	function t(a, b) {
		return b();
	}
	var u = "undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement ? t : q;
	useSyncExternalStoreShim_production_min.useSyncExternalStore = void 0 !== e.useSyncExternalStore ? e.useSyncExternalStore : u;
	return useSyncExternalStoreShim_production_min;
}
/**
* @license React
* use-sync-external-store-shim.development.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
shim.exports = requireUseSyncExternalStoreShim_production_min();
var shimExports = shim.exports;
var mergeRefs = (...refs) => {
	return (node) => {
		refs.forEach((ref) => {
			if (typeof ref === "function") ref(node);
			else if (ref) ref.current = node;
		});
	};
};
/**
* This component renders all of the editor's node views.
*/
var Portals = ({ contentComponent }) => {
	const renderers = shimExports.useSyncExternalStore(contentComponent.subscribe, contentComponent.getSnapshot, contentComponent.getServerSnapshot);
	return import_react.createElement(import_react.Fragment, null, Object.values(renderers));
};
function getInstance() {
	const subscribers = /* @__PURE__ */ new Set();
	let renderers = {};
	return {
		/**
		* Subscribe to the editor instance's changes.
		*/
		subscribe(callback) {
			subscribers.add(callback);
			return () => {
				subscribers.delete(callback);
			};
		},
		getSnapshot() {
			return renderers;
		},
		getServerSnapshot() {
			return renderers;
		},
		/**
		* Adds a new NodeView Renderer to the editor.
		*/
		setRenderer(id, renderer) {
			renderers = {
				...renderers,
				[id]: import_react_dom.createPortal(renderer.reactElement, renderer.element, id)
			};
			subscribers.forEach((subscriber) => subscriber());
		},
		/**
		* Removes a NodeView Renderer from the editor.
		*/
		removeRenderer(id) {
			const nextRenderers = { ...renderers };
			delete nextRenderers[id];
			renderers = nextRenderers;
			subscribers.forEach((subscriber) => subscriber());
		}
	};
}
var PureEditorContent = class extends import_react.Component {
	constructor(props) {
		var _a;
		super(props);
		this.editorContentRef = import_react.createRef();
		this.initialized = false;
		this.state = { hasContentComponentInitialized: Boolean((_a = props.editor) === null || _a === void 0 ? void 0 : _a.contentComponent) };
	}
	componentDidMount() {
		this.init();
	}
	componentDidUpdate() {
		this.init();
	}
	init() {
		const editor = this.props.editor;
		if (editor && !editor.isDestroyed && editor.options.element) {
			if (editor.contentComponent) return;
			const element = this.editorContentRef.current;
			element.append(...editor.options.element.childNodes);
			editor.setOptions({ element });
			editor.contentComponent = getInstance();
			if (!this.state.hasContentComponentInitialized) this.unsubscribeToContentComponent = editor.contentComponent.subscribe(() => {
				this.setState((prevState) => {
					if (!prevState.hasContentComponentInitialized) return { hasContentComponentInitialized: true };
					return prevState;
				});
				if (this.unsubscribeToContentComponent) this.unsubscribeToContentComponent();
			});
			editor.createNodeViews();
			this.initialized = true;
		}
	}
	componentWillUnmount() {
		const editor = this.props.editor;
		if (!editor) return;
		this.initialized = false;
		if (!editor.isDestroyed) editor.view.setProps({ nodeViews: {} });
		if (this.unsubscribeToContentComponent) this.unsubscribeToContentComponent();
		editor.contentComponent = null;
		if (!editor.options.element.firstChild) return;
		const newElement = document.createElement("div");
		newElement.append(...editor.options.element.childNodes);
		editor.setOptions({ element: newElement });
	}
	render() {
		const { editor, innerRef, ...rest } = this.props;
		return import_react.createElement(import_react.Fragment, null, import_react.createElement("div", {
			ref: mergeRefs(innerRef, this.editorContentRef),
			...rest
		}), (editor === null || editor === void 0 ? void 0 : editor.contentComponent) && import_react.createElement(Portals, { contentComponent: editor.contentComponent }));
	}
};
var EditorContentWithKey = (0, import_react.forwardRef)((props, ref) => {
	const key = import_react.useMemo(() => {
		return Math.floor(Math.random() * 4294967295).toString();
	}, [props.editor]);
	return import_react.createElement(PureEditorContent, {
		key,
		innerRef: ref,
		...props
	});
});
var EditorContent = import_react.memo(EditorContentWithKey);
var deepEqual = /*@__PURE__*/ getDefaultExportFromCjs(function equal(a, b) {
	if (a === b) return true;
	if (a && b && typeof a == "object" && typeof b == "object") {
		if (a.constructor !== b.constructor) return false;
		var length, i, keys;
		if (Array.isArray(a)) {
			length = a.length;
			if (length != b.length) return false;
			for (i = length; i-- !== 0;) if (!equal(a[i], b[i])) return false;
			return true;
		}
		if (a instanceof Map && b instanceof Map) {
			if (a.size !== b.size) return false;
			for (i of a.entries()) if (!b.has(i[0])) return false;
			for (i of a.entries()) if (!equal(i[1], b.get(i[0]))) return false;
			return true;
		}
		if (a instanceof Set && b instanceof Set) {
			if (a.size !== b.size) return false;
			for (i of a.entries()) if (!b.has(i[0])) return false;
			return true;
		}
		if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
			length = a.length;
			if (length != b.length) return false;
			for (i = length; i-- !== 0;) if (a[i] !== b[i]) return false;
			return true;
		}
		if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
		if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
		if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
		keys = Object.keys(a);
		length = keys.length;
		if (length !== Object.keys(b).length) return false;
		for (i = length; i-- !== 0;) if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
		for (i = length; i-- !== 0;) {
			var key = keys[i];
			if (key === "_owner" && a.$$typeof) continue;
			if (!equal(a[key], b[key])) return false;
		}
		return true;
	}
	return a !== a && b !== b;
});
var withSelector = { exports: {} };
var withSelector_production_min = {};
/**
* @license React
* use-sync-external-store-shim/with-selector.production.min.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var hasRequiredWithSelector_production_min;
function requireWithSelector_production_min() {
	if (hasRequiredWithSelector_production_min) return withSelector_production_min;
	hasRequiredWithSelector_production_min = 1;
	var h = import_react.default, n = shimExports;
	function p(a, b) {
		return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
	}
	var q = "function" === typeof Object.is ? Object.is : p, r = n.useSyncExternalStore, t = h.useRef, u = h.useEffect, v = h.useMemo, w = h.useDebugValue;
	withSelector_production_min.useSyncExternalStoreWithSelector = function(a, b, e, l, g) {
		var c = t(null);
		if (null === c.current) {
			var f = {
				hasValue: !1,
				value: null
			};
			c.current = f;
		} else f = c.current;
		c = v(function() {
			function a(a) {
				if (!c) {
					c = !0;
					d = a;
					a = l(a);
					if (void 0 !== g && f.hasValue) {
						var b = f.value;
						if (g(b, a)) return k = b;
					}
					return k = a;
				}
				b = k;
				if (q(d, a)) return b;
				var e = l(a);
				if (void 0 !== g && g(b, e)) return b;
				d = a;
				return k = e;
			}
			var c = !1, d, k, m = void 0 === e ? null : e;
			return [function() {
				return a(b());
			}, null === m ? void 0 : function() {
				return a(m());
			}];
		}, [
			b,
			e,
			l,
			g
		]);
		var d = r(a, c[0], c[1]);
		u(function() {
			f.hasValue = !0;
			f.value = d;
		}, [d]);
		w(d);
		return d;
	};
	return withSelector_production_min;
}
/**
* @license React
* use-sync-external-store-shim/with-selector.development.js
*
* Copyright (c) Facebook, Inc. and its affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
withSelector.exports = requireWithSelector_production_min();
var withSelectorExports = withSelector.exports;
var useIsomorphicLayoutEffect = typeof window !== "undefined" ? import_react.useLayoutEffect : import_react.useEffect;
/**
* To synchronize the editor instance with the component state,
* we need to create a separate instance that is not affected by the component re-renders.
*/
var EditorStateManager = class {
	constructor(initialEditor) {
		this.transactionNumber = 0;
		this.lastTransactionNumber = 0;
		this.subscribers = /* @__PURE__ */ new Set();
		this.editor = initialEditor;
		this.lastSnapshot = {
			editor: initialEditor,
			transactionNumber: 0
		};
		this.getSnapshot = this.getSnapshot.bind(this);
		this.getServerSnapshot = this.getServerSnapshot.bind(this);
		this.watch = this.watch.bind(this);
		this.subscribe = this.subscribe.bind(this);
	}
	/**
	* Get the current editor instance.
	*/
	getSnapshot() {
		if (this.transactionNumber === this.lastTransactionNumber) return this.lastSnapshot;
		this.lastTransactionNumber = this.transactionNumber;
		this.lastSnapshot = {
			editor: this.editor,
			transactionNumber: this.transactionNumber
		};
		return this.lastSnapshot;
	}
	/**
	* Always disable the editor on the server-side.
	*/
	getServerSnapshot() {
		return {
			editor: null,
			transactionNumber: 0
		};
	}
	/**
	* Subscribe to the editor instance's changes.
	*/
	subscribe(callback) {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}
	/**
	* Watch the editor instance for changes.
	*/
	watch(nextEditor) {
		this.editor = nextEditor;
		if (this.editor) {
			/**
			* This will force a re-render when the editor state changes.
			* This is to support things like `editor.can().toggleBold()` in components that `useEditor`.
			* This could be more efficient, but it's a good trade-off for now.
			*/
			const fn = () => {
				this.transactionNumber += 1;
				this.subscribers.forEach((callback) => callback());
			};
			const currentEditor = this.editor;
			currentEditor.on("transaction", fn);
			return () => {
				currentEditor.off("transaction", fn);
			};
		}
	}
};
/**
* This hook allows you to watch for changes on the editor instance.
* It will allow you to select a part of the editor state and re-render the component when it changes.
* @example
* ```tsx
* const editor = useEditor({...options})
* const { currentSelection } = useEditorState({
*  editor,
*  selector: snapshot => ({ currentSelection: snapshot.editor.state.selection }),
* })
*/
function useEditorState(options) {
	var _a;
	const [editorStateManager] = (0, import_react.useState)(() => new EditorStateManager(options.editor));
	const selectedState = withSelectorExports.useSyncExternalStoreWithSelector(editorStateManager.subscribe, editorStateManager.getSnapshot, editorStateManager.getServerSnapshot, options.selector, (_a = options.equalityFn) !== null && _a !== void 0 ? _a : deepEqual);
	useIsomorphicLayoutEffect(() => {
		return editorStateManager.watch(options.editor);
	}, [options.editor, editorStateManager]);
	(0, import_react.useDebugValue)(selectedState);
	return selectedState;
}
var isDev = false;
var isSSR = typeof window === "undefined";
var isNext = isSSR || Boolean(typeof window !== "undefined" && window.next);
/**
* This class handles the creation, destruction, and re-creation of the editor instance.
*/
var EditorInstanceManager = class EditorInstanceManager {
	constructor(options) {
		/**
		* The current editor instance.
		*/
		this.editor = null;
		/**
		* The subscriptions to notify when the editor instance
		* has been created or destroyed.
		*/
		this.subscriptions = /* @__PURE__ */ new Set();
		/**
		* Whether the editor has been mounted.
		*/
		this.isComponentMounted = false;
		/**
		* The most recent dependencies array.
		*/
		this.previousDeps = null;
		/**
		* The unique instance ID. This is used to identify the editor instance. And will be re-generated for each new instance.
		*/
		this.instanceId = "";
		this.options = options;
		this.subscriptions = /* @__PURE__ */ new Set();
		this.setEditor(this.getInitialEditor());
		this.scheduleDestroy();
		this.getEditor = this.getEditor.bind(this);
		this.getServerSnapshot = this.getServerSnapshot.bind(this);
		this.subscribe = this.subscribe.bind(this);
		this.refreshEditorInstance = this.refreshEditorInstance.bind(this);
		this.scheduleDestroy = this.scheduleDestroy.bind(this);
		this.onRender = this.onRender.bind(this);
		this.createEditor = this.createEditor.bind(this);
	}
	setEditor(editor) {
		this.editor = editor;
		this.instanceId = Math.random().toString(36).slice(2, 9);
		this.subscriptions.forEach((cb) => cb());
	}
	getInitialEditor() {
		if (this.options.current.immediatelyRender === void 0) {
			if (isSSR || isNext) return null;
			return this.createEditor();
		}
		if (this.options.current.immediatelyRender && isSSR && isDev);
		if (this.options.current.immediatelyRender) return this.createEditor();
		return null;
	}
	/**
	* Create a new editor instance. And attach event listeners.
	*/
	createEditor() {
		const optionsToApply = {
			...this.options.current,
			onBeforeCreate: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onBeforeCreate) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onBlur: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onBlur) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onCreate: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onCreate) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onDestroy: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onDestroy) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onFocus: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onFocus) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onSelectionUpdate: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onSelectionUpdate) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onTransaction: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onTransaction) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onUpdate: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onUpdate) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onContentError: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onContentError) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onDrop: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onDrop) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			},
			onPaste: (...args) => {
				var _a, _b;
				return (_b = (_a = this.options.current).onPaste) === null || _b === void 0 ? void 0 : _b.call(_a, ...args);
			}
		};
		return new Editor(optionsToApply);
	}
	/**
	* Get the current editor instance.
	*/
	getEditor() {
		return this.editor;
	}
	/**
	* Always disable the editor on the server-side.
	*/
	getServerSnapshot() {
		return null;
	}
	/**
	* Subscribe to the editor instance's changes.
	*/
	subscribe(onStoreChange) {
		this.subscriptions.add(onStoreChange);
		return () => {
			this.subscriptions.delete(onStoreChange);
		};
	}
	static compareOptions(a, b) {
		return Object.keys(a).every((key) => {
			if ([
				"onCreate",
				"onBeforeCreate",
				"onDestroy",
				"onUpdate",
				"onTransaction",
				"onFocus",
				"onBlur",
				"onSelectionUpdate",
				"onContentError",
				"onDrop",
				"onPaste"
			].includes(key)) return true;
			if (key === "extensions" && a.extensions && b.extensions) {
				if (a.extensions.length !== b.extensions.length) return false;
				return a.extensions.every((extension, index) => {
					var _a;
					if (extension !== ((_a = b.extensions) === null || _a === void 0 ? void 0 : _a[index])) return false;
					return true;
				});
			}
			if (a[key] !== b[key]) return false;
			return true;
		});
	}
	/**
	* On each render, we will create, update, or destroy the editor instance.
	* @param deps The dependencies to watch for changes
	* @returns A cleanup function
	*/
	onRender(deps) {
		return () => {
			this.isComponentMounted = true;
			clearTimeout(this.scheduledDestructionTimeout);
			if (this.editor && !this.editor.isDestroyed && deps.length === 0) {
				if (!EditorInstanceManager.compareOptions(this.options.current, this.editor.options)) this.editor.setOptions({
					...this.options.current,
					editable: this.editor.isEditable
				});
			} else this.refreshEditorInstance(deps);
			return () => {
				this.isComponentMounted = false;
				this.scheduleDestroy();
			};
		};
	}
	/**
	* Recreate the editor instance if the dependencies have changed.
	*/
	refreshEditorInstance(deps) {
		if (this.editor && !this.editor.isDestroyed) {
			if (this.previousDeps === null) {
				this.previousDeps = deps;
				return;
			}
			if (this.previousDeps.length === deps.length && this.previousDeps.every((dep, index) => dep === deps[index])) return;
		}
		if (this.editor && !this.editor.isDestroyed) this.editor.destroy();
		this.setEditor(this.createEditor());
		this.previousDeps = deps;
	}
	/**
	* Schedule the destruction of the editor instance.
	* This will only destroy the editor if it was not mounted on the next tick.
	* This is to avoid destroying the editor instance when it's actually still mounted.
	*/
	scheduleDestroy() {
		const currentInstanceId = this.instanceId;
		const currentEditor = this.editor;
		this.scheduledDestructionTimeout = setTimeout(() => {
			if (this.isComponentMounted && this.instanceId === currentInstanceId) {
				if (currentEditor) currentEditor.setOptions(this.options.current);
				return;
			}
			if (currentEditor && !currentEditor.isDestroyed) {
				currentEditor.destroy();
				if (this.instanceId === currentInstanceId) this.setEditor(null);
			}
		}, 1);
	}
};
function useEditor(options = {}, deps = []) {
	const mostRecentOptions = (0, import_react.useRef)(options);
	mostRecentOptions.current = options;
	const [instanceManager] = (0, import_react.useState)(() => new EditorInstanceManager(mostRecentOptions));
	const editor = shimExports.useSyncExternalStore(instanceManager.subscribe, instanceManager.getEditor, instanceManager.getServerSnapshot);
	(0, import_react.useDebugValue)(editor);
	(0, import_react.useEffect)(instanceManager.onRender(deps));
	useEditorState({
		editor,
		selector: ({ transactionNumber }) => {
			if (options.shouldRerenderOnTransaction === false) return null;
			if (options.immediatelyRender && transactionNumber === 0) return 0;
			return transactionNumber + 1;
		}
	});
	return editor;
}
(0, import_react.createContext)({ editor: null }).Consumer;
var ReactNodeViewContext = (0, import_react.createContext)({ onDragStart: void 0 });
var useReactNodeView = () => (0, import_react.useContext)(ReactNodeViewContext);
import_react.forwardRef((props, ref) => {
	const { onDragStart } = useReactNodeView();
	const Tag = props.as || "div";
	return import_react.createElement(Tag, {
		...props,
		ref,
		"data-node-view-wrapper": "",
		onDragStart,
		style: {
			whiteSpace: "normal",
			...props.style
		}
	});
});
//#endregion
export { useEditor as n, EditorContent as t };
