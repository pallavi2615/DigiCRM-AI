import { createFileRoute } from "@tanstack/react-router";
import { buildRolePdf } from "@/lib/permissions-pdf";
import type { AppRole } from "@/hooks/use-auth";

const VALID_ROLES = ["super_admin", "admin", "sales_manager", "sales_executive"];

/**
 * Serves a role permissions PDF only for links signed by `issueRolePdfLink`.
 * The signature covers the role, the requesting user and the expiry, so an
 * expired or tampered URL is rejected before any document is produced.
 */
export const Route = createFileRoute("/api/public/role-pdf")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const role = url.searchParams.get("role") ?? "";
        const uid = url.searchParams.get("uid") ?? "";
        const exp = Number(url.searchParams.get("exp") ?? 0);
        const sig = url.searchParams.get("sig") ?? "";

        if (!VALID_ROLES.includes(role)) return new Response("Invalid role", { status: 400 });

        const { verifyRolePdfClaims } = await import("@/lib/pdf-signing.server");
        if (!verifyRolePdfClaims({ role, uid, exp }, sig)) {
          return new Response("Link expired or invalid", { status: 401 });
        }

        const doc = buildRolePdf(role as AppRole);
        if (!doc) return new Response("Unknown role", { status: 404 });
        const bytes = doc.output("arraybuffer");

        return new Response(bytes, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="digicrm-permissions-${role.replace(/_/g, "-")}.pdf"`,
            "Cache-Control": "no-store, private",
          },
        });
      },
    },
  },
});
