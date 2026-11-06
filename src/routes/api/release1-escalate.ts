import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { mailForRoster, release1RequestAllowed, sendRelease1Mail } from "@/lib/estimator/release1Mail.server";
import { appendInAppNotices, executeServerEscalation, noticesToMail, saveInAppNotices } from "@/lib/estimator/release1Monitor";
import { loadRelease1Store, saveRelease1Store } from "@/lib/estimator/release1Store.server";

/**
 * A signed-in user or the scheduler secret. The route reads and saves stored documents.
 * It does not trust a document list or a clock posted by the browser.
 */
async function allow(request: Request) {
	let userId = "";
	try {
		userId = await requireUserId();
	} catch {
		userId = "";
	}
	return release1RequestAllowed({
		schedulerHeader: request.headers.get("x-release1-scheduler"),
		secret: process.env.RELEASE1_SCHEDULER_SECRET,
		userId,
	});
}

export const Route = createFileRoute("/api/release1-escalate")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const allowed = await allow(request);
				if (!allowed.ok) return Response.json(allowed, { status: 401 });
				const loaded = await loadRelease1Store();
				if (!loaded.ok || !loaded.documents) return Response.json({ ok: false, message: loaded.message || "The document store is not configured." }, { status: 503 });
				await request.json().catch(() => ({}));
				const result = await executeServerEscalation({
					read: async () => loaded.documents,
					save: async (documents, alerts, at) => {
						const docs = await saveRelease1Store(loaded, documents);
						const notes = await saveInAppNotices({
							loaded,
							alerts,
							now: at,
							build: appendInAppNotices,
							save: (current, notifications) => saveRelease1Store(current, { notifications }),
							reload: async () => {
								const again = await loadRelease1Store();
								return again.ok ? again : loaded;
							},
						});
						const docFailed = (docs.failed || []).filter((row) => row.kind !== "notifications");
						const noteFailed = (notes.failed || []).filter((row) => row.kind === "notifications");
						return {
							ok: docFailed.length === 0 && notes.ok === true,
							saved: [...(docs.saved || []), ...(notes.saved || [])],
							failed: [...docFailed, ...noteFailed],
							attempts: notes.attempts,
							conflict: notes.conflict === true,
						};
					},
				});
				const saved: { failed?: { id?: string }[], attempts?: number, ok?: boolean, conflict?: boolean } = result.saved && typeof result.saved === "object"
					? result.saved as { failed?: { id?: string }[], attempts?: number, ok?: boolean, conflict?: boolean }
					: { failed: result.notices.map((notice) => ({ id: String(notice.doc?.id || notice.doc?.controlNo || notice.doc?.joNo || "") })) };
				const pending = noticesToMail(result.notices, saved);
				const mail = [];
				for (const notice of pending) {
					const label = String(notice.doc?.controlNo || notice.doc?.joNo || notice.doc?.ceId || notice.doc?.id || "");
					const letter = mailForRoster({
						toUserId: notice.toUserId,
						template: notice.template,
						label,
						roster: loaded.documents.roster,
					});
					if (!letter.ok) continue;
					mail.push(await sendRelease1Mail({ to: letter.to, subject: letter.subject, text: letter.text }));
				}
				return Response.json({
					ok: true,
					escalated: result.notices.filter((notice) => notice.template === "escalated"),
					expiring: result.notices.filter((notice) => notice.template === "expiring"),
					notices: pending.length,
					noticeSave: { ok: saved.ok === true, attempts: saved.attempts || 0, conflict: saved.conflict === true },
					mail,
				});
			},
		},
	},
});
