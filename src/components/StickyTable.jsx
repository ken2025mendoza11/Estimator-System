import { useEffect, useRef } from "react";
import { pinFrozenColumns, syncStickyScroll } from "../lib/estimator/stickyTable.js";

/**
 * Shared monitoring table: sticky header, frozen No. + Project, and a
 * horizontal scrollbar pinned to the bottom of the viewport.
 * @param {{ className?: string, enabled?: boolean, children?: import("react").ReactNode }} props
 */
export function StickyTable({ className = "", enabled = false, children }) {
	const scroller = useRef(/** @type {HTMLDivElement | null} */ (null));
	const proxy = useRef(/** @type {HTMLDivElement | null} */ (null));
	useEffect(() => {
		if (!enabled) return undefined;
		const root = scroller.current;
		const bar = proxy.current;
		if (!root || !bar) return undefined;
		const stop = syncStickyScroll(root, bar);
		const pin = () => {
			const table = root.querySelector("table");
			if (table) pinFrozenColumns(table);
		};
		pin();
		const obs = typeof ResizeObserver === "function" ? new ResizeObserver(pin) : null;
		obs?.observe(root);
		return () => {
			stop();
			obs?.disconnect();
		};
	}, [enabled]);
	if (!enabled) return <div className={className}>{children}</div>;
	return (
		<div className={`${className} ce-sticky-wrap`.trim()}>
			<div className="ce-sticky-scroller" ref={scroller}>{children}</div>
			<div className="ce-sticky-proxy" ref={proxy} aria-hidden="true">
				<div className="ce-sticky-proxy-inner" />
			</div>
		</div>
	);
}
