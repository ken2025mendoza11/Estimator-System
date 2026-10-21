// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { markWelcomeSeen, updatePendingProfile } from "../lib/supabase/account-role";
import { WELCOME_STOPS, accessCopy, accessState, needsProfileForm, profileErrors, signatureReady } from "../lib/estimator/loginUi";
import { signOut } from "../lib/auth/client";
import { phStamp } from "../lib/estimator/phTime";

function Stamp({ tone, title, caption }) {
	return (
		<svg className={`ce-login-stamp ce-login-stamp-${tone}`} viewBox="0 0 120 150" role="img" aria-label={`${title}. ${caption}`}>
			<rect x="4" y="4" width="112" height="142" rx="6" />
			<rect x="10" y="10" width="100" height="130" fill="none" />
			<text x="60" y="42" textAnchor="middle">PHILIPPINES</text>
			<text x="60" y="78" textAnchor="middle">{title}</text>
			<text x="60" y="112" textAnchor="middle">{caption}</text>
		</svg>
	);
}

function SignaturePad({ value, onChange }) {
	const canvasRef = useRef(null);
	const drawing = useRef(false);
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		const scale = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = 560 * scale;
		canvas.height = 160 * scale;
		ctx.scale(scale, scale);
		ctx.lineWidth = 2;
		ctx.lineCap = "round";
		ctx.strokeStyle = "#1c1917";
	}, []);
	function point(event) {
		const canvas = canvasRef.current;
		const rect = canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * 560,
			y: ((event.clientY - rect.top) / rect.height) * 160
		};
	}
	function start(event) {
		const canvas = canvasRef.current;
		canvas.setPointerCapture(event.pointerId);
		drawing.current = true;
		const ctx = canvas.getContext("2d");
		const next = point(event);
		ctx.beginPath();
		ctx.moveTo(next.x, next.y);
	}
	function move(event) {
		if (!drawing.current) return;
		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		const next = point(event);
		ctx.lineTo(next.x, next.y);
		ctx.stroke();
		onChange(canvas.toDataURL("image/png"));
	}
	function stop() {
		drawing.current = false;
	}
	return (
		<div className="ce-login-sign">
			<canvas
				ref={canvasRef}
				className="ce-login-pad"
				aria-label="Draw your e-signature"
				onPointerDown={start}
				onPointerMove={move}
				onPointerUp={stop}
				onPointerCancel={stop}
			/>
			<button
				type="button"
				className="ce-login-btn ce-login-btn-quiet"
				onClick={() => {
					const canvas = canvasRef.current;
					canvas.getContext("2d").clearRect(0, 0, 560, 160);
					onChange("");
				}}
			>
				{signatureReady(value) ? "Clear signature" : "Clear"}
			</button>
		</div>
	);
}

function ProfileStep({ onChanged }) {
	const [form, setForm] = useState({ name: "", department: "", mobile: "", signature: "" });
	const [errors, setErrors] = useState({});
	const [note, setNote] = useState("");
	const [busy, setBusy] = useState(false);
	function setField(key, value) {
		setForm((prev) => ({ ...prev, [key]: value }));
	}
	async function submit(event) {
		event.preventDefault();
		const next = profileErrors(form);
		setErrors(next);
		if (Object.keys(next).length) return;
		setBusy(true);
		setNote("");
		try {
			const result = await updatePendingProfile(form);
			if (result && result.ok === false) {
				setNote(result.reason || "Your profile was not saved.");
				return;
			}
			onChanged();
		} catch (err) {
			setNote(err instanceof Error ? err.message : "Your profile was not saved.");
		} finally {
			setBusy(false);
		}
	}
	return (
		<form className="ce-login-card" onSubmit={submit}>
			<p className="ce-login-kicker">First time</p>
			<h1 className="ce-serif ce-login-title">Your profile</h1>
			<p className="ce-login-copy">Full name, department, mobile, and an e-signature are required for every user. This does not grant access.</p>
			<label className="ce-login-field">
				<span className="ce-field-label">Full name</span>
				<input className="ce-input" autoComplete="name" value={form.name} onChange={(event) => setField("name", event.target.value)} />
			</label>
			{errors.name ? <p className="ce-login-copy" role="alert">{errors.name}</p> : null}
			<label className="ce-login-field">
				<span className="ce-field-label">Department</span>
				<input className="ce-input" value={form.department} onChange={(event) => setField("department", event.target.value)} />
			</label>
			{errors.department ? <p className="ce-login-copy" role="alert">{errors.department}</p> : null}
			<label className="ce-login-field">
				<span className="ce-field-label">Mobile</span>
				<input className="ce-input" autoComplete="tel" inputMode="tel" value={form.mobile} onChange={(event) => setField("mobile", event.target.value)} />
			</label>
			{errors.mobile ? <p className="ce-login-copy" role="alert">{errors.mobile}</p> : null}
			<span className="ce-field-label">E-signature</span>
			<SignaturePad value={form.signature} onChange={(value) => setField("signature", value)} />
			{errors.signature ? <p className="ce-login-copy" role="alert">{errors.signature}</p> : null}
			{note ? <p className="ce-login-copy" role="alert">{note}</p> : null}
			<button type="submit" className="ce-login-btn" disabled={busy}>Save profile</button>
			<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => { void signOut(); }}>Sign out</button>
		</form>
	);
}

export function AccessGate({ account, onChanged }) {
	const state = accessState(account);
	const waiting = account?.status === "pending";
	const needsProfile = needsProfileForm(account);
	if (needsProfile) {
		return (
			<main className="ce-app ce-login">
				<ProfileStep onChanged={onChanged} />
			</main>
		);
	}
	const text = accessCopy(state, account?.note);
	return (
		<main className="ce-app ce-login">
			<div className="ce-login-card">
				<p className="ce-login-kicker">Estimator System</p>
				<h1 className="ce-serif ce-login-title">{text.heading}</h1>
				<p className="ce-login-copy">{text.copy}</p>
				{waiting ? (
					<>
						<p className="ce-login-copy">{phStamp(new Date(), "Pending")}</p>
						<div className="ce-login-stamps" aria-hidden="false">
							<Stamp tone="red" title="PENDING" caption="MANILA" />
							<Stamp tone="blue" title="ESTIMATOR" caption="QUEZON" />
							<Stamp tone="gold" title="PH" caption="CEBU" />
						</div>
					</>
				) : null}
				<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => { void signOut(); }}>Sign out</button>
			</div>
		</main>
	);
}

export function WelcomeTour({ onDone }) {
	const [step, setStep] = useState(0);
	const [note, setNote] = useState("");
	const current = WELCOME_STOPS[step];
	async function finish() {
		setNote("");
		try {
			await markWelcomeSeen();
		} catch (err) {
			setNote(err instanceof Error ? err.message : "The welcome could not be saved.");
		}
		onDone();
	}
	return (
		<div className="ce-login-tour" role="dialog" aria-modal="true" aria-labelledby="ce-welcome-title">
			<div className="ce-login-card">
				<p className="ce-login-kicker">Welcome {step + 1} of {WELCOME_STOPS.length}</p>
				<h2 id="ce-welcome-title" className="ce-serif ce-login-title">{current.title}</h2>
				<p className="ce-login-copy">{current.body}</p>
				{note ? <p className="ce-login-copy" role="alert">{note}</p> : null}
				<div className="ce-login-actions">
					{step > 0 ? (
						<button type="button" className="ce-login-btn ce-login-btn-quiet" onClick={() => setStep(step - 1)}>Back</button>
					) : null}
					{step < WELCOME_STOPS.length - 1 ? (
						<button type="button" className="ce-login-btn" onClick={() => setStep(step + 1)}>Next</button>
					) : (
						<button type="button" className="ce-login-btn" onClick={finish}>Enter</button>
					)}
				</div>
			</div>
		</div>
	);
}
