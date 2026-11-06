// @ts-nocheck
import { normalizeFuelPrices, normalizeTolls, normalizeVehicles } from "../lib/estimator/routeFuel";

export function Phase9Admin({ cfg, patch }) {
	const features = cfg.features || {};
	const vehicles = cfg.vehicles || [];
	const fuelPrices = cfg.fuelPrices || [];
	const tolls = cfg.tolls || [];
	function setFlag(checked) {
		patch({ features: { ...features, routeFuel: checked === true } });
	}
	function addVehicle(event) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const next = normalizeVehicles([...vehicles, {
			name: data.get("name"),
			kmPerL: data.get("kmPerL"),
			truck: data.get("truck") === "on"
		}]);
		if (next.length === vehicles.length) return;
		patch({ vehicles: next });
		event.currentTarget.reset();
	}
	function addPrice(event) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const next = normalizeFuelPrices([...fuelPrices, {
			region: data.get("region"),
			pricePerL: data.get("pricePerL")
		}]);
		if (next.length === fuelPrices.length) return;
		patch({ fuelPrices: next });
		event.currentTarget.reset();
	}
	function addToll(event) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const next = normalizeTolls([...tolls, {
			name: data.get("name"),
			amount: data.get("amount")
		}]);
		if (next.length === tolls.length) return;
		patch({ tolls: next });
		event.currentTarget.reset();
	}
	return (
		<div className="ce-card wiz-card">
			<h3 className="ce-serif">Phase 9</h3>
			<p className="wiz-hint">Off leaves the calculators as they are. No vehicles, prices, or tolls are seeded.</p>
			<label className="ce-picker-row">
				<input type="checkbox" checked={features.routeFuel === true} onChange={(e) => setFlag(e.target.checked)} />
				<span>Route and fuel</span>
			</label>
			{features.routeFuel === true ? (
				<div>
					<p className="wiz-hint">Vehicles</p>
					{vehicles.length ? vehicles.map((row) => (
						<p key={row.id} className="wiz-hint">{row.name} · {row.kmPerL} km/L{row.truck ? " · truck" : ""}</p>
					)) : <p className="wiz-hint">None yet.</p>}
					<form onSubmit={addVehicle}>
						<label className="wiz-field">
							<span className="ce-field-label">Vehicle name</span>
							<input className="ce-input" name="name" />
						</label>
						<label className="wiz-field">
							<span className="ce-field-label">km per litre</span>
							<input className="ce-input" name="kmPerL" type="number" min="0" step="0.01" />
						</label>
						<label className="ce-picker-row">
							<input type="checkbox" name="truck" />
							<span>Truck</span>
						</label>
						<button type="submit" className="ce-btn-ghost ce-btn-sm">Add vehicle</button>
					</form>
					<p className="wiz-hint">Fuel prices</p>
					{fuelPrices.length ? fuelPrices.map((row) => (
						<p key={row.id} className="wiz-hint">{row.region} · {row.pricePerL}</p>
					)) : <p className="wiz-hint">None yet.</p>}
					<form onSubmit={addPrice}>
						<label className="wiz-field">
							<span className="ce-field-label">Region</span>
							<input className="ce-input" name="region" />
						</label>
						<label className="wiz-field">
							<span className="ce-field-label">Price per litre</span>
							<input className="ce-input" name="pricePerL" type="number" min="0" step="0.01" />
						</label>
						<button type="submit" className="ce-btn-ghost ce-btn-sm">Add fuel price</button>
					</form>
					<p className="wiz-hint">Tolls</p>
					{tolls.length ? tolls.map((row) => (
						<p key={row.id} className="wiz-hint">{row.name} · {row.amount}</p>
					)) : <p className="wiz-hint">None yet.</p>}
					<form onSubmit={addToll}>
						<label className="wiz-field">
							<span className="ce-field-label">Toll name</span>
							<input className="ce-input" name="name" />
						</label>
						<label className="wiz-field">
							<span className="ce-field-label">Amount</span>
							<input className="ce-input" name="amount" type="number" min="0" step="0.01" />
						</label>
						<button type="submit" className="ce-btn-ghost ce-btn-sm">Add toll</button>
					</form>
				</div>
			) : null}
		</div>
	);
}
