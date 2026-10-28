import { createFileRoute } from "@tanstack/react-router";
import { requireUserId } from "@/lib/auth/verify.server";
import { mailForRoster, release1RequestAllowed, sendRelease1Mail } from "@/lib/estimator/release1Mail.server";
import { executeServerEscalation } from "@/lib/estimator/release1Monitor";
import { loadRelease1Store, saveRelease1Store } from "@/lib/estimator/release1Store.server";

/**
 * A signed-in user or the scheduler secret. The route reads and saves stored documents.
 * It does not trust a document list posted by the browser.
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
				const body = (await request.json().catch(() => ({}))) as { now?: unknown };
				const now = typeof body?.now === "string" && body.now ? body.now : undefined;
				const result = await executeServerEscalation({
					read: async () => loaded.documents,
					save: async (documents) => {
						await saveRelease1Store(loaded, documents);
					},
					now,
				});
				const mail = [];
				for (const notice of result.notices) {
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
					mail,
				});
			},
		},
	},
});
