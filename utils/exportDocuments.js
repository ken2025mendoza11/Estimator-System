import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Helper: draw header/footer on each PDF page
const drawHeaderFooter = (doc, { companyLogo, docRevision, docDate, ceNumber }) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Top left: Logo (or placeholder)
  if (companyLogo) {
    doc.addImage(companyLogo, 'PNG', 12, 8, 20, 20);
  } else {
    doc.setFontSize(10);
    doc.text('LOGO', 12, 18);
  }

  // Top right: Revision, Date, CE Number
  doc.setFontSize(9);
  doc.text(`Rev: ${docRevision || '—'}`, pageWidth - 60, 12);
  doc.text(`Date: ${docDate || '—'}`, pageWidth - 60, 17);
  doc.text(`CE No: ${ceNumber || '—'}`, pageWidth - 60, 22);

  // Bottom center: Page Number
  const pageNumber = doc.internal.getNumberOfPages();
  doc.setFontSize(9);
  doc.text(`Page ${pageNumber}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
};

// PDF Export
export function exportToPDF(data) {
  const {
    companyLogo,
    docRevision,
    docDate,
    ceNumber,
    sections,
  } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 12; // 12mm all sides

  let currentOrientation = 'portrait';

  sections.forEach((section, index) => {
    // If this is Task Breakdown and we haven't switched to landscape, add a landscape page
    if (section.isTaskBreakdown && currentOrientation === 'portrait') {
      doc.addPage('a4', 'landscape');
      currentOrientation = 'landscape';
    } else if (index > 0) {
      // Add a new page in the same orientation for subsequent sections
      doc.addPage(currentOrientation === 'landscape' ? 'a4' : 'a4', currentOrientation);
    }

    autoTable(doc, {
      head: [section.columns],
      body: section.rows,
      startY: margin + 10, // leave space for header
      margin: { top: margin + 10, bottom: margin, left: margin, right: margin },
      styles: {
        lineColor: [0, 0, 0],
        lineWidth: 0.1,
        cellPadding: 1.5,
        fontSize: 9,
        valign: 'middle',
        halign: 'center',
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold',
        lineWidth: 0.1,
      },
      bodyStyles: {
        lineWidth: 0.1,
      },
      didDrawPage: (data) => {
        drawHeaderFooter(doc, {
          companyLogo,
          docRevision,
          docDate,
          ceNumber,
        });
      },
    });
  });

  doc.save(`Cost_Estimate_${ceNumber || 'export'}.pdf`);
}

// Excel Export
export function exportToExcel(data) {
  const { sections, docRevision, docDate, ceNumber } = data;

  const wb = XLSX.utils.book_new();

  sections.forEach((section) => {
    const wsData = [section.columns, ...section.rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto column widths
    const colWidths = section.columns.map((col, i) => ({
      wch: Math.max(
        col.length,
        ...section.rows.map(row => (row[i] ? String(row[i]).length : 0))
      ) + 2,
    }));
    ws['!cols'] = colWidths;

    // Print header/footer (not visible in raw grid)
    if (!ws['!print']) ws['!print'] = {};
    ws['!print'].header = `&LRevision: ${docRevision || '—'}&C&RDate: ${docDate || '—'}`;
    ws['!print'].footer = `&CPage &P of &N`;
    ws['!print'].margins = {
      left: 0.5,
      right: 0.5,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    };

    XLSX.utils.book_append_sheet(wb, ws, section.title.slice(0, 31));
  });

  XLSX.writeFile(wb, `Cost_Estimate_${ceNumber || 'export'}.xlsx`);
}