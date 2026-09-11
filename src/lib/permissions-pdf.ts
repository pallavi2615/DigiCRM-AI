import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MODULES, PANELS, ROLES, type Action } from "@/lib/permissions";
import type { AppRole } from "@/hooks/use-auth";

const ACTIONS: Action[] = ["view", "create", "edit", "delete"];
const PRIMARY: [number, number, number] = [75, 51, 200];
const MUTED: [number, number, number] = [110, 115, 130];

/** Builds a permissions & features PDF document for a single role. */
export function buildRolePdf(role: AppRole): jsPDF | null {
  const meta = ROLES.find((r) => r.key === role);
  if (!meta) return null;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageWidth, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text("DigiCRM AI — Permissions & Features", 14, 12);
  doc.setFontSize(11);
  doc.text(meta.label, 14, 20);

  doc.setTextColor(...MUTED);
  doc.setFontSize(9);
  doc.text(doc.splitTextToSize(meta.blurb, pageWidth - 28), 14, 34);

  const accessible = MODULES.filter((m) => m.perms[role].length > 0).length;
  doc.text(
    `${accessible} of ${MODULES.length} modules accessible · generated ${new Date().toLocaleDateString()}`,
    14,
    44,
  );

  let startY = 50;
  for (const panel of PANELS) {
    const rows = MODULES.filter((m) => m.panel === panel).map((m) => [
      m.label,
      m.description,
      ...ACTIONS.map((a) => (m.perms[role].includes(a) ? "Yes" : "—")),
    ]);
    if (!rows.length) continue;

    autoTable(doc, {
      startY,
      head: [[panel, "Description", "View", "Create", "Edit", "Delete"]],
      body: rows,
      theme: "grid",
      styles: { fontSize: 7.5, cellPadding: 1.6, overflow: "linebreak" },
      headStyles: { fillColor: PRIMARY, textColor: 255, fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 64 },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 17, halign: "center" },
        4: { cellWidth: 14, halign: "center" },
        5: { cellWidth: 17, halign: "center" },
      },
      margin: { left: 14, right: 14 },
    });
    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(
      "Interface controls follow this matrix; database row-level security enforces the same rules server-side.",
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(`${i} / ${pages}`, pageWidth - 20, doc.internal.pageSize.getHeight() - 8);
  }

  return doc;
}

/** Builds and downloads the PDF in the browser (offline fallback). */
export function downloadRolePdf(role: AppRole) {
  const doc = buildRolePdf(role);
  if (!doc) return;
  doc.save(`digicrm-permissions-${role.replace(/_/g, "-")}.pdf`);
}
