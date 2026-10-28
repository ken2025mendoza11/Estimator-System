import { createFileRoute } from "@tanstack/react-router";
import { sendRelease1Mail } from "@/lib/estimator/release1Mail.server";

export const Route = createFileRoute("/api/release1-mail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const result = await sendRelease1Mail({
          to: body?.to,
          subject: body?.subject,
          text: body?.text,
        });
        return Response.json(result);
      },
    },
  },
});
