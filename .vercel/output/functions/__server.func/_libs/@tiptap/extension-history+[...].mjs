import { C as Mapping, b as PluginKey, n as Extension, y as Plugin } from "./core+[...].mjs";
//#region node_modules/rope-sequence/dist/index.js
var GOOD_LEAF_SIZE = 200;
var RopeSequence = function RopeSequence() {};
RopeSequence.prototype.append = function append(other) {
	if (!other.length) return this;
	other = RopeSequence.from(other);
	return !this.length && other || other.length < GOOD_LEAF_SIZE && this.leafAppend(other) || this.length < GOOD_LEAF_SIZE && other.leafPrepend(this) || this.appendInner(other);
};
RopeSequence.prototype.prepend = function prepend(other) {
	if (!other.length) return this;
	return RopeSequence.from(other).append(this);
};
RopeSequence.prototype.appendInner = function appendInner(other) {
	return new Append(this, other);
};
RopeSequence.prototype.slice = function slice(from, to) {
	if (from === void 0) from = 0;
	if (to === void 0) to = this.length;
	if (from >= to) return RopeSequence.empty;
	return this.sliceInner(Math.max(0, from), Math.min(this.length, to));
};
RopeSequence.prototype.get = function get(i) {
	if (i < 0 || i >= this.length) return;
	return this.getInner(i);
};
RopeSequence.prototype.forEach = function forEach(f, from, to) {
	if (from === void 0) from = 0;
	if (to === void 0) to = this.length;
	if (from <= to) this.forEachInner(f, from, to, 0);
	else this.forEachInvertedInner(f, from, to, 0);
};
RopeSequence.prototype.map = function map(f, from, to) {
	if (from === void 0) from = 0;
	if (to === void 0) to = this.length;
	var result = [];
	this.forEach(function(elt, i) {
		return result.push(f(elt, i));
	}, from, to);
	return result;
};
RopeSequence.from = function from(values) {
	if (values instanceof RopeSequence) return values;
	return values && values.length ? new Leaf(values) : RopeSequence.empty;
};
var Leaf = /* @__PURE__ */ function(RopeSequence) {
	function Leaf(values) {
		RopeSequence.call(this);
		this.values = values;
	}
	if (RopeSequence) Leaf.__proto__ = RopeSequence;
	Leaf.prototype = Object.create(RopeSequence && RopeSequence.prototype);
	Leaf.prototype.constructor = Leaf;
	var prototypeAccessors = {
		length: { configurable: true },
		depth: { configurable: true }
	};
	Leaf.prototype.flatten = function flatten() {
		return this.values;
	};
	Leaf.prototype.sliceInner = function sliceInner(from, to) {
		if (from == 0 && to == this.length) return this;
		return new Leaf(this.values.slice(from, to));
	};
	Leaf.prototype.getInner = function getInner(i) {
		return this.values[i];
	};
	Leaf.prototype.forEachInner = function forEachInner(f, from, to, start) {
		for (var i = from; i < to; i++) if (f(this.values[i], start + i) === false) return false;
	};
	Leaf.prototype.forEachInvertedInner = function forEachInvertedInner(f, from, to, start) {
		for (var i = from - 1; i >= to; i--) if (f(this.values[i], start + i) === false) return false;
	};
	Leaf.prototype.leafAppend = function leafAppend(other) {
		if (this.length + other.length <= GOOD_LEAF_SIZE) return new Leaf(this.values.concat(other.flatten()));
	};
	Leaf.prototype.leafPrepend = function leafPrepend(other) {
		if (this.length + other.length <= GOOD_LEAF_SIZE) return new Leaf(other.flatten().concat(this.values));
	};
	prototypeAccessors.length.get = function() {
		return this.values.length;
	};
	prototypeAccessors.depth.get = function() {
		return 0;
	};
	Object.defineProperties(Leaf.prototype, prototypeAccessors);
	return Leaf;
}(RopeSequence);
RopeSequence.empty = new Leaf([]);
var Append = /* @__PURE__ */ function(RopeSequence) {
	function Append(left, right) {
		RopeSequence.call(this);
		this.left = left;
		this.right = right;
		this.length = left.length + right.length;
		this.depth = Math.max(left.depth, right.depth) + 1;
	}
	if (RopeSequence) Append.__proto__ = RopeSequence;
	Append.prototype = Object.create(RopeSequence && RopeSequence.prototype);
	Append.prototype.constructor = Append;
	Append.prototype.flatten = function flatten() {
		return this.left.flatten().concat(this.right.flatten());
	};
	Append.prototype.getInner = function getInner(i) {
		return i < this.left.length ? this.left.get(i) : this.right.get(i - this.left.length);
	};
	Append.prototype.forEachInner = function forEachInner(f, from, to, start) {
		var leftLen = this.left.length;
		if (from < leftLen && this.left.forEachInner(f, from, Math.min(to, leftLen), start) === false) return false;
		if (to > leftLen && this.right.forEachInner(f, Math.max(from - leftLen, 0), Math.min(this.length, to) - leftLen, start + leftLen) === false) return false;
	};
	Append.prototype.forEachInvertedInner = function forEachInvertedInner(f, from, to, start) {
		var leftLen = this.left.length;
		if (from > leftLen && this.right.forEachInvertedInner(f, from - leftLen, Math.max(to, leftLen) - leftLen, start + leftLen) === false) return false;
		if (to < leftLen && this.left.forEachInvertedInner(f, Math.min(from, leftLen), to, start) === false) return false;
	};
	Append.prototype.sliceInner = function sliceInner(from, to) {
		if (from == 0 && to == this.length) return this;
		var leftLen = this.left.length;
		if (to <= leftLen) return this.left.slice(from, to);
		if (from >= leftLen) return this.right.slice(from - leftLen, to - leftLen);
		return this.left.slice(from, leftLen).append(this.right.slice(0, to - leftLen));
	};
	Append.prototype.leafAppend = function leafAppend(other) {
		var inner = this.right.leafAppend(other);
		if (inner) return new Append(this.left, inner);
	};
	Append.prototype.leafPrepend = function leafPrepend(other) {
		var inner = this.left.leafPrepend(other);
		if (inner) return new Append(inner, this.right);
	};
	Append.prototype.appendInner = function appendInner(other) {
		if (this.left.depth >= Math.max(this.right.depth, other.depth) + 1) return new Append(this.left, new Append(this.right, other));
		return new Append(this, other);
	};
	return Append;
}(RopeSequence);
//#endregion
//#region node_modules/prosemirror-history/dist/index.js
var max_empty_items = 500;
var Branch = class Branch {
	constructor(items, eventCount) {
		this.items = items;
		this.eventCount = eventCount;
	}
	popEvent(state, preserveItems) {
		if (this.eventCount == 0) return null;
		let end = this.items.length;
		for (;; end--) if (this.items.get(end - 1).selection) {
			--end;
			break;
		}
		let remap, mapFrom;
		if (preserveItems) {
			remap = this.remapping(end, this.items.length);
			mapFrom = remap.maps.length;
		}
		let transform = state.tr;
		let selection, remaining;
		let addAfter = [], addBefore = [];
		this.items.forEach((item, i) => {
			if (!item.step) {
				if (!remap) {
					remap = this.remapping(end, i + 1);
					mapFrom = remap.maps.length;
				}
				mapFrom--;
				addBefore.push(item);
				return;
			}
			if (remap) {
				addBefore.push(new Item(item.map));
				let step = item.step.map(remap.slice(mapFrom)), map;
				if (step && transform.maybeStep(step).doc) {
					map = transform.mapping.maps[transform.mapping.maps.length - 1];
					addAfter.push(new Item(map, void 0, void 0, addAfter.length + addBefore.length));
				}
				mapFrom--;
				if (map) remap.appendMap(map, mapFrom);
			} else transform.maybeStep(item.step);
			if (item.selection) {
				selection = remap ? item.selection.map(remap.slice(mapFrom)) : item.selection;
				remaining = new Branch(this.items.slice(0, end).append(addBefore.reverse().concat(addAfter)), this.eventCount - 1);
				return false;
			}
		}, this.items.length, 0);
		return {
			remaining,
			transform,
			selection
		};
	}
	addTransform(transform, selection, histOptions, preserveItems) {
		let newItems = [], eventCount = this.eventCount;
		let oldItems = this.items, lastItem = !preserveItems && oldItems.length ? oldItems.get(oldItems.length - 1) : null;
		for (let i = 0; i < transform.steps.length; i++) {
			let step = transform.steps[i].invert(transform.docs[i]);
			let item = new Item(transform.mapping.maps[i], step, selection), merged;
			if (merged = lastItem && lastItem.merge(item)) {
				item = merged;
				if (i) newItems.pop();
				else oldItems = oldItems.slice(0, oldItems.length - 1);
			}
			newItems.push(item);
			if (selection) {
				eventCount++;
				selection = void 0;
			}
			if (!preserveItems) lastItem = item;
		}
		let overflow = eventCount - histOptions.depth;
		if (overflow > DEPTH_OVERFLOW) {
			oldItems = cutOffEvents(oldItems, overflow);
			eventCount -= overflow;
		}
		return new Branch(oldItems.append(newItems), eventCount);
	}
	remapping(from, to) {
		let maps = new Mapping();
		this.items.forEach((item, i) => {
			let mirrorPos = item.mirrorOffset != null && i - item.mirrorOffset >= from ? maps.maps.length - item.mirrorOffset : void 0;
			maps.appendMap(item.map, mirrorPos);
		}, from, to);
		return maps;
	}
	addMaps(array) {
		if (this.eventCount == 0) return this;
		return new Branch(this.items.append(array.map((map) => new Item(map))), this.eventCount);
	}
	rebased(rebasedTransform, rebasedCount) {
		if (!this.eventCount) return this;
		let rebasedItems = [], start = Math.max(0, this.items.length - rebasedCount);
		let mapping = rebasedTransform.mapping;
		let newUntil = rebasedTransform.steps.length;
		let eventCount = this.eventCount;
		this.items.forEach((item) => {
			if (item.selection) eventCount--;
		}, start);
		let iRebased = rebasedCount;
		this.items.forEach((item) => {
			let pos = mapping.getMirror(--iRebased);
			if (pos == null) return;
			newUntil = Math.min(newUntil, pos);
			let map = mapping.maps[pos];
			if (item.step) {
				let step = rebasedTransform.steps[pos].invert(rebasedTransform.docs[pos]);
				let selection = item.selection && item.selection.map(mapping.slice(iRebased + 1, pos));
				if (selection) eventCount++;
				rebasedItems.push(new Item(map, step, selection));
			} else rebasedItems.push(new Item(map));
		}, start);
		let newMaps = [];
		for (let i = rebasedCount; i < newUntil; i++) newMaps.push(new Item(mapping.maps[i]));
		let items = this.items.slice(0, start).append(newMaps).append(rebasedItems);
		let branch = new Branch(items, eventCount);
		if (branch.emptyItemCount() > max_empty_items) branch = branch.compress(this.items.length - rebasedItems.length);
		return branch;
	}
	emptyItemCount() {
		let count = 0;
		this.items.forEach((item) => {
			if (!item.step) count++;
		});
		return count;
	}
	compress(upto = this.items.length) {
		let remap = this.remapping(0, upto), mapFrom = remap.maps.length;
		let items = [], events = 0;
		this.items.forEach((item, i) => {
			if (i >= upto) {
				items.push(item);
				if (item.selection) events++;
			} else if (item.step) {
				let step = item.step.map(remap.slice(mapFrom)), map = step && step.getMap();
				mapFrom--;
				if (map) remap.appendMap(map, mapFrom);
				if (step) {
					let selection = item.selection && item.selection.map(remap.slice(mapFrom));
					if (selection) events++;
					let newItem = new Item(map.invert(), step, selection), merged, last = items.length - 1;
					if (merged = items.length && items[last].merge(newItem)) items[last] = merged;
					else items.push(newItem);
				}
			} else if (item.map) mapFrom--;
		}, this.items.length, 0);
		return new Branch(RopeSequence.from(items.reverse()), events);
	}
};
Branch.empty = new Branch(RopeSequence.empty, 0);
function cutOffEvents(items, n) {
	let cutPoint;
	items.forEach((item, i) => {
		if (item.selection && n-- == 0) {
			cutPoint = i;
			return false;
		}
	});
	return items.slice(cutPoint);
}
var Item = class Item {
	constructor(map, step, selection, mirrorOffset) {
		this.map = map;
		this.step = step;
		this.selection = selection;
		this.mirrorOffset = mirrorOffset;
	}
	merge(other) {
		if (this.step && other.step && !other.selection) {
			let step = other.step.merge(this.step);
			if (step) return new Item(step.getMap().invert(), step, this.selection);
		}
	}
};
var HistoryState = class {
	constructor(done, undone, prevRanges, prevTime, prevComposition) {
		this.done = done;
		this.undone = undone;
		this.prevRanges = prevRanges;
		this.prevTime = prevTime;
		this.prevComposition = prevComposition;
	}
};
var DEPTH_OVERFLOW = 20;
function applyTransaction(history, state, tr, options) {
	let historyTr = tr.getMeta(historyKey), rebased;
	if (historyTr) return historyTr.historyState;
	if (tr.getMeta(closeHistoryKey)) history = new HistoryState(history.done, history.undone, null, 0, -1);
	let appended = tr.getMeta("appendedTransaction");
	if (tr.steps.length == 0) return history;
	else if (appended && appended.getMeta(historyKey)) {
		if (appended.getMeta(historyKey).redo) return new HistoryState(history.done.addTransform(tr, void 0, options, mustPreserveItems(state)), history.undone, rangesFor(tr.mapping.maps), history.prevTime, history.prevComposition);
		else return new HistoryState(history.done, history.undone.addTransform(tr, void 0, options, mustPreserveItems(state)), null, history.prevTime, history.prevComposition);
	} else if (tr.getMeta("addToHistory") !== false && !(appended && appended.getMeta("addToHistory") === false)) {
		let composition = tr.getMeta("composition");
		let newGroup = history.prevTime == 0 || !appended && history.prevComposition != composition && (history.prevTime < (tr.time || 0) - options.newGroupDelay || !isAdjacentTo(tr, history.prevRanges));
		let prevRanges = appended ? mapRanges(history.prevRanges, tr.mapping) : rangesFor(tr.mapping.maps);
		return new HistoryState(history.done.addTransform(tr, newGroup ? state.selection.getBookmark() : void 0, options, mustPreserveItems(state)), Branch.empty, prevRanges, tr.time, composition == null ? history.prevComposition : composition);
	} else if (rebased = tr.getMeta("rebased")) return new HistoryState(history.done.rebased(tr, rebased), history.undone.rebased(tr, rebased), mapRanges(history.prevRanges, tr.mapping), history.prevTime, history.prevComposition);
	else return new HistoryState(history.done.addMaps(tr.mapping.maps), history.undone.addMaps(tr.mapping.maps), mapRanges(history.prevRanges, tr.mapping), history.prevTime, history.prevComposition);
}
function isAdjacentTo(transform, prevRanges) {
	if (!prevRanges) return false;
	if (!transform.docChanged) return true;
	let adjacent = false;
	transform.mapping.maps[0].forEach((start, end) => {
		for (let i = 0; i < prevRanges.length; i += 2) if (start <= prevRanges[i + 1] && end >= prevRanges[i]) adjacent = true;
	});
	return adjacent;
}
function rangesFor(maps) {
	let result = [];
	for (let i = maps.length - 1; i >= 0 && result.length == 0; i--) maps[i].forEach((_from, _to, from, to) => result.push(from, to));
	return result;
}
function mapRanges(ranges, mapping) {
	if (!ranges) return null;
	let result = [];
	for (let i = 0; i < ranges.length; i += 2) {
		let from = mapping.map(ranges[i], 1), to = mapping.map(ranges[i + 1], -1);
		if (from <= to) result.push(from, to);
	}
	return result;
}
function histTransaction(history, state, redo) {
	let preserveItems = mustPreserveItems(state);
	let histOptions = historyKey.get(state).spec.config;
	let pop = (redo ? history.undone : history.done).popEvent(state, preserveItems);
	if (!pop) return null;
	let selection = pop.selection.resolve(pop.transform.doc);
	let added = (redo ? history.done : history.undone).addTransform(pop.transform, state.selection.getBookmark(), histOptions, preserveItems);
	let newHist = new HistoryState(redo ? added : pop.remaining, redo ? pop.remaining : added, null, 0, -1);
	return pop.transform.setSelection(selection).setMeta(historyKey, {
		redo,
		historyState: newHist
	});
}
var cachedPreserveItems = false;
var cachedPreserveItemsPlugins = null;
function mustPreserveItems(state) {
	let plugins = state.plugins;
	if (cachedPreserveItemsPlugins != plugins) {
		cachedPreserveItems = false;
		cachedPreserveItemsPlugins = plugins;
		for (let i = 0; i < plugins.length; i++) if (plugins[i].spec.historyPreserveItems) {
			cachedPreserveItems = true;
			break;
		}
	}
	return cachedPreserveItems;
}
var historyKey = new PluginKey("history");
var closeHistoryKey = new PluginKey("closeHistory");
/**
Returns a plugin that enables the undo history for an editor. The
plugin will track undo and redo stacks, which can be used with the
[`undo`](https://prosemirror.net/docs/ref/#history.undo) and [`redo`](https://prosemirror.net/docs/ref/#history.redo) commands.

You can set an `"addToHistory"` [metadata
property](https://prosemirror.net/docs/ref/#state.Transaction.setMeta) of `false` on a transaction
to prevent it from being rolled back by undo.
*/
function history(config = {}) {
	config = {
		depth: config.depth || 100,
		newGroupDelay: config.newGroupDelay || 500
	};
	return new Plugin({
		key: historyKey,
		state: {
			init() {
				return new HistoryState(Branch.empty, Branch.empty, null, 0, -1);
			},
			apply(tr, hist, state) {
				return applyTransaction(hist, state, tr, config);
			}
		},
		config,
		props: { handleDOMEvents: { beforeinput(view, e) {
			let inputType = e.inputType;
			let command = inputType == "historyUndo" ? undo : inputType == "historyRedo" ? redo : null;
			if (!command || !view.editable) return false;
			e.preventDefault();
			return command(view.state, view.dispatch);
		} } }
	});
}
function buildCommand(redo, scroll) {
	return (state, dispatch) => {
		let hist = historyKey.getState(state);
		if (!hist || (redo ? hist.undone : hist.done).eventCount == 0) return false;
		if (dispatch) {
			let tr = histTransaction(hist, state, redo);
			if (tr) dispatch(scroll ? tr.scrollIntoView() : tr);
		}
		return true;
	};
}
/**
A command function that undoes the last change, if any.
*/
var undo = buildCommand(false, true);
/**
A command function that redoes the last undone change, if any.
*/
var redo = buildCommand(true, true);
//#endregion
//#region node_modules/@tiptap/extension-history/dist/index.js
/**
* This extension allows you to undo and redo recent changes.
* @see https://www.tiptap.dev/api/extensions/history
*
* **Important**: If the `@tiptap/extension-collaboration` package is used, make sure to remove
* the `history` extension, as it is not compatible with the `collaboration` extension.
*
* `@tiptap/extension-collaboration` uses its own history implementation.
*/
var History = Extension.create({
	name: "history",
	addOptions() {
		return {
			depth: 100,
			newGroupDelay: 500
		};
	},
	addCommands() {
		return {
			undo: () => ({ state, dispatch }) => {
				return undo(state, dispatch);
			},
			redo: () => ({ state, dispatch }) => {
				return redo(state, dispatch);
			}
		};
	},
	addProseMirrorPlugins() {
		return [history(this.options)];
	},
	addKeyboardShortcuts() {
		return {
			"Mod-z": () => this.editor.commands.undo(),
			"Shift-Mod-z": () => this.editor.commands.redo(),
			"Mod-y": () => this.editor.commands.redo(),
			"Mod-я": () => this.editor.commands.undo(),
			"Shift-Mod-я": () => this.editor.commands.redo()
		};
	}
});
//#endregion
export { History as t };
