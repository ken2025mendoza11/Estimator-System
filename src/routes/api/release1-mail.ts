import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { mailForRoster, release1RequestAllowed, sendRelease1Mail } from "@/lib/estimator/release1Mail.server";
import { loadRelease1Store, loadStoredCe, markupEstimateId, storedDocumentLabel } from "@/lib/estimator/release1Store.server";

/** Sign-in or the scheduler secret. The address must be on the stored roster. The wording is a fixed template. The label is read from the stored document. */
export const Route = createFileRoute("/api/release1-mail")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				let userId = "";
				try {
					userId = await requireUserId();
				} catch {
					userId = "";
				}
				const allowed = release1RequestAllowed({
					schedulerHeader: request.headers.get("x-release1-scheduler"),
					secret: process.env.RELEASE1_SCHEDULER_SECRET,
					userId,
				});
				if (!allowed.ok) return Response.json(allowed, { status: 401 });
				const body = (await request.json().catch(() => ({}))) as { toUserId?: unknown, template?: unknown, docId?: unknown, kind?: unknown };
				const loaded = await loadRelease1Store();
				if (!loaded.ok || !loaded.documents) return Response.json({ ok: false, message: loaded.message || "The document store is not configured." }, { status: 503 });
				const template = String(body?.template || "");
				const kind = template === "ce-approved" ? "ce" : String(body?.kind || "");
				let documents = loaded.documents;
				if (kind === "ce" || kind === "markup") {
					const ceId = kind === "ce" ? body?.docId : markupEstimateId(documents, body?.docId);
					documents = { ...documents, ces: await loadStoredCe(process.env, fetch, ceId) };
				}
				const label = storedDocumentLabel(documents, body?.docId, kind);
				if (!label) return Response.json({ ok: false, message: "That document was not found." }, { status: 400 });
				const letter = mailForRoster({
					toUserId: body?.toUserId,
					template: body?.template,
					label,
					roster: loaded.documents.roster,
				});
				if (!letter.ok) return Response.json(letter, { status: 400 });
				const result = await sendRelease1Mail({ to: letter.to, subject: letter.subject, text: letter.text });
				return Response.json(result);
			},
		},
	},
});
