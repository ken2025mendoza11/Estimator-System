// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { routeSnapshot } from "../lib/estimator/routeFuel";

export function CalcPrintBar({ title, rows }) {
	return (
		<div className="ce-print-sheet">
			<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={() => window.print()}>Print</button>
			<div className="ce-print-only" style={{ display: "none" }}>
				<h1>{title}</h1>
				{(rows || []).map((row) => <p key={row.label}>{row.label}: {row.value}</p>)}
			</div>
			<style>{"@media print { .ce-print-only { display: block !important; } }"}</style>
		</div>
	);
}

export function RouteFuelPanel({ vehicles = [], fuelPrices = [], tolls = [], onInsert }) {
	const host = useRef(null);
	const mapRef = useRef(null);
	const libRef = useRef(null);
	const lineRef = useRef(null);
	const marksRef = useRef([]);
	const endsRef = useRef({ from: null, to: null });
	const [from, setFrom] = useState(null);
	const [to, setTo] = useState(null);
	const [km, setKm] = useState("");
	const [manual, setManual] = useState(false);
	const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || "");
	const [kmPerL, setKmPerL] = useState(vehicles[0] ? String(vehicles[0].kmPerL) : "");
	const [priceId, setPriceId] = useState(fuelPrices[0]?.id || "");
	const [pricePerL, setPricePerL] = useState(fuelPrices[0] ? String(fuelPrices[0].pricePerL) : "");
	const [when, setWhen] = useState("");
	const [tollIds, setTollIds] = useState([]);
	const [ferry, setFerry] = useState(false);
	const [ferryCost, setFerryCost] = useState("");
	const [geometry, setGeometry] = useState(null);
	const [message, setMessage] = useState("");
	const vehicle = vehicles.find((row) => row.id === vehicleId) || null;
	const snap = routeSnapshot({
		km,
		kmPerL,
		pricePerL,
		tolls,
		tollIds,
		ferry,
		ferryCost,
		truck: vehicle?.truck === true,
		when,
		manual
	});

	useEffect(() => {
		let map;
		let cancelled = false;
		(async () => {
			const leaflet = await import("leaflet");
			await import("leaflet/dist/leaflet.css");
			const L = leaflet.default || leaflet;
			if (cancelled || !host.current) return;
			libRef.current = L;
			map = L.map(host.current).setView([12.8797, 121.774], 5);
			L.tileLayer("/api/route-fuel?kind=tile&z={z}&x={x}&y={y}", {
				attribution: "&copy; OpenStreetMap",
				maxZoom: 19
			}).addTo(map);
			map.on("click", (event) => {
				const lat = Number(event.latlng.lat.toFixed(5));
				const lng = Number(event.latlng.lng.toFixed(5));
				const ends = endsRef.current;
				if (!ends.from || ends.to) {
					ends.from = { lat, lng };
					ends.to = null;
				} else {
					ends.to = { lat, lng };
				}
				setFrom(ends.from);
				setTo(ends.to);
			});
			mapRef.current = map;
		})();
		return () => {
			cancelled = true;
			if (map) map.remove();
			mapRef.current = null;
		};
	}, []);

	useEffect(() => {
		const L = libRef.current;
		const map = mapRef.current;
		if (!L || !map) return undefined;
		marksRef.current.forEach((mark) => mark.remove());
		marksRef.current = [from, to].filter(Boolean).map((point) => L.circleMarker([point.lat, point.lng], {
			radius: 7,
			color: "#8a5a2b"
		}).addTo(map));
		return undefined;
	}, [from, to]);

	useEffect(() => {
		const L = libRef.current;
		const map = mapRef.current;
		if (!L || !map || !geometry?.coordinates) return undefined;
		if (lineRef.current) lineRef.current.remove();
		const latlngs = geometry.coordinates.map(([lng, lat]) => [lat, lng]);
		lineRef.current = L.polyline(latlngs, { color: "#8a5a2b" }).addTo(map);
		if (latlngs.length) map.fitBounds(lineRef.current.getBounds(), { padding: [20, 20] });
		return undefined;
	}, [geometry]);

	function pickVehicle(id) {
		setVehicleId(id);
		const row = vehicles.find((item) => item.id === id);
		if (row) setKmPerL(String(row.kmPerL));
	}

	function pickPrice(id) {
		setPriceId(id);
		const row = fuelPrices.find((item) => item.id === id);
		if (row) setPricePerL(String(row.pricePerL));
	}

	function toggleToll(id) {
		setTollIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
	}

	async function loadRoad() {
		setMessage("");
		if (!from || !to) {
			setManual(true);
			setMessage("Click the map for a start and an end, or type the kilometres.");
			return;
		}
		try {
			const res = await fetch(`/api/route-fuel?kind=route&from=${from.lat},${from.lng}&to=${to.lat},${to.lng}`);
			const body = await res.json();
			if (!body.ok) {
				setManual(true);
				setGeometry(null);
				setMessage(body.message || "The road service did not answer. Type the kilometres.");
				return;
			}
			setKm(String(body.km));
			setManual(false);
			setGeometry(body.geometry || null);
			if (body.ferry) setFerry(true);
			setMessage(body.cached ? "Road kilometres from the saved route." : "Road kilometres from the road service.");
		} catch {
			setManual(true);
			setMessage("The road service did not answer. Type the kilometres.");
		}
	}

	function add() {
		if (!snap.ok || !onInsert) return;
		onInsert({
			category: "MISC",
			section: "B",
			description: "Route fuel",
			qty: 1,
			days: 1,
			unit: "lot",
			unitCost: snap.total,
			notes: snap.warning || "from the route and fuel calculator",
			calc: { tool: "route", snapshot: snap }
		});
	}

	const rows = snap.ok ? [
		{ label: "Kilometres", value: String(snap.km) },
		{ label: "Fuel", value: String(snap.fuel) },
		{ label: "Tolls", value: String(snap.tolls) },
		{ label: "Ferry", value: String(snap.ferry) },
		{ label: "Total", value: String(snap.total) }
	] : [];

	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Route and fuel</h3>
			<p className="wiz-hint">The map uses OpenStreetMap. The first click is the start and the next is the end. Fuel is the road kilometres divided by km per litre, times the regional price, plus 10%. A ferry is its own amount.</p>
			<div ref={host} style={{ height: 280, marginBottom: "0.8rem" }} />
			<p className="wiz-hint">{from ? `Start ${from.lat}, ${from.lng}` : "Start not set"} · {to ? `End ${to.lat}, ${to.lng}` : "End not set"}</p>
			<button type="button" className="ce-btn-ghost ce-btn-sm" onClick={loadRoad}>Get road kilometres</button>
			<div className="wiz-grid">
				<label className="wiz-field"><span className="ce-field-label">Kilometres</span>
					<input className="ce-input" value={km} onChange={(e) => { setKm(e.target.value); setManual(true); }} />
				</label>
				<label className="wiz-field"><span className="ce-field-label">Vehicle</span>
					<select className="ce-input" value={vehicleId} onChange={(e) => pickVehicle(e.target.value)}>
						<option value="">Type km per litre</option>
						{vehicles.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
					</select>
				</label>
				<label className="wiz-field"><span className="ce-field-label">km per litre</span>
					<input className="ce-input" value={kmPerL} onChange={(e) => setKmPerL(e.target.value)} />
				</label>
				<label className="wiz-field"><span className="ce-field-label">Region</span>
					<select className="ce-input" value={priceId} onChange={(e) => pickPrice(e.target.value)}>
						<option value="">Type a price</option>
						{fuelPrices.map((row) => <option key={row.id} value={row.id}>{row.region}</option>)}
					</select>
				</label>
				<label className="wiz-field"><span className="ce-field-label">Price per litre</span>
					<input className="ce-input" value={pricePerL} onChange={(e) => setPricePerL(e.target.value)} />
				</label>
				<label className="wiz-field"><span className="ce-field-label">Departure</span>
					<input className="ce-input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
				</label>
				<label className="wiz-field"><span className="ce-field-label">Ferry amount</span>
					<input className="ce-input" value={ferryCost} onChange={(e) => setFerryCost(e.target.value)} disabled={!ferry} />
				</label>
			</div>
			<label className="ce-picker-row">
				<input type="checkbox" checked={ferry} onChange={(e) => setFerry(e.target.checked)} />
				<span>Ferry line</span>
			</label>
			{tolls.map((toll) => (
				<label key={toll.id} className="ce-picker-row">
					<input type="checkbox" checked={tollIds.includes(toll.id)} onChange={() => toggleToll(toll.id)} />
					<span>{toll.name} · {toll.amount}</span>
				</label>
			))}
			{snap.ok ? <p className="wiz-hint">Fuel {snap.fuel} · tolls {snap.tolls} · ferry {snap.ferry} · total {snap.total}{manual ? " · typed distance" : ""}</p> : <p className="wiz-hint">{snap.message}</p>}
			{snap.warning ? <p className="wiz-hint">{snap.warning}</p> : null}
			{message ? <p className="wiz-hint">{message}</p> : null}
			<CalcPrintBar title="Route and fuel" rows={rows} />
			{onInsert && snap.ok ? <button type="button" className="ce-btn-primary ce-btn-sm" onClick={add}>Add to cost estimate</button> : null}
		</div>
	);
}
