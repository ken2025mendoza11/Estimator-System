import { createFileRoute } from "@tanstack/react-router";
import { sendRelease1Mail } from "@/lib/estimator/release1Mail.server";
import { expiringProposals, runEscalation } from "@/lib/estimator/release1Monitor";

/**
 * Ken, or a scheduler, POSTs waiting documents here. This does not read the database.
 * It moves a step that has waited 12 hours, then emails when the address contains "@".
 * An empty RELEASE1_MAIL_KEY skips the email and logs that, without the key.
 */
export const Route = createFileRoute("/api/release1-escalate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          items?: unknown;
          proposals?: unknown;
          now?: unknown;
        };
        const now = typeof body?.now === "string" && body.now ? body.now : new Date().toISOString();
        const escalated = runEscalation(Array.isArray(body?.items) ? body.items : [], now);
        const expiring = expiringProposals(Array.isArray(body?.proposals) ? body.proposals : [], now);
        const notices = [
          ...escalated.map((row) => ({
            toUserId: row.toUserId,
            notice: row.notice,
            id: String(row.doc?.controlNo || row.doc?.joNo || row.doc?.ceId || row.doc?.id || ""),
          })),
          ...expiring,
        ];
        const mail = [];
        for (const notice of notices) {
          if (!notice.toUserId || !String(notice.toUserId).includes("@")) continue;
          mail.push(await sendRelease1Mail({
            to: notice.toUserId,
            subject: notice.notice,
            text: `${notice.notice} ${notice.id || ""}`.trim(),
          }));
        }
        return Response.json({ ok: true, escalated, expiring, mail });
      },
    },
  },
});
