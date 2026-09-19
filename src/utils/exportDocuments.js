// @ts-nocheck
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function interpolateDocTokens(template, vars) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, key) => {
    const value = vars[key];
    return value == null ? '' : String(value);
  });
}

function docVars(data, page) {
  const dc = data.documentControl || {};
  return {
    company: dc.companyName || '',
    rev: data.docRevision || dc.revision || '',
    date: data.docDate || '',
    docNo: data.ceNumber || '',
    page: page == null ? '' : String(page),
  };
}

function resolvedLetterhead(data, page) {
  const dc = data.documentControl || {};
  const vars = docVars(data, page);
  return {
    dc,
    vars,
    headerLeft: interpolateDocTokens(dc.headerLeft || '{company}', vars),
    headerRight: interpolateDocTokens(
      dc.headerRight || 'Rev {rev}  |  {date}  |  {docNo}',
      vars
    ),
    footerLeft: interpolateDocTokens(dc.footerLeft || 'Controlled document', vars),
    footerCenter: interpolateDocTokens(dc.footerCenter || 'Page {page}', vars),
    footerRight: interpolateDocTokens(dc.footerRight || '{company}', vars),
  };
}

function logoFormat(dataUrl) {
  if (!dataUrl) return 'PNG';
  if (dataUrl.includes('image/jpeg') || dataUrl.includes('image/jpg')) return 'JPEG';
  if (dataUrl.includes('image/webp')) return 'WEBP';
  return 'PNG';
}

const drawHeaderFooter = (doc, data) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageNumber =
    doc.internal.getCurrentPageInfo?.().pageNumber ||
    doc.internal.getNumberOfPages();
  const { dc, headerLeft, headerRight, footerLeft, footerCenter, footerRight } =
    resolvedLetterhead(data, pageNumber);

  const logo = dc.showLogo !== false ? data.companyLogo || dc.logoDataUrl : '';
  if (logo) {
    try {
      doc.addImage(logo, logoFormat(logo), 12, 8, 18, 18);
    } catch {
      doc.setFontSize(10);
      doc.text(headerLeft || 'LOGO', 12, 18);
    }
  } else {
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(headerLeft || 'LOGO', 12, 18);
    doc.setFont(undefined, 'normal');
  }

  doc.setFontSize(9);
  const rightLines = String(headerRight || '').split('|').map((s) => s.trim());
  rightLines.forEach((line, i) => {
    doc.text(line, pageWidth - 12, 12 + i * 5, { align: 'right' });
  });

  doc.setFontSize(8);
  doc.text(footerLeft || '', 12, pageHeight - 8);
  doc.text(footerCenter || `Page ${pageNumber}`, pageWidth / 2, pageHeight - 8, {
    align: 'center',
  });
  doc.text(footerRight || '', pageWidth - 12, pageHeight - 8, { align: 'right' });
};

export function exportToPDF(data) {
  const { ceNumber, sections } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const margin = 12;

  let currentOrientation = 'portrait';

  sections.forEach((section, index) => {
    if (section.isTaskBreakdown && currentOrientation === 'portrait') {
      doc.addPage('a4', 'landscape');
      currentOrientation = 'landscape';
    } else if (index > 0) {
      doc.addPage(currentOrientation === 'landscape' ? 'a4' : 'a4', currentOrientation);
    }

    autoTable(doc, {
      head: [section.columns],
      body: section.rows,
      startY: margin + 14,
      margin: { top: margin + 14, bottom: margin + 6, left: margin, right: margin },
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
      didDrawPage: () => {
        drawHeaderFooter(doc, data);
      },
    });
  });

  doc.save(`Cost_Estimate_${ceNumber || 'export'}.pdf`);
}

export function exportToExcel(data) {
  const { sections, ceNumber } = data;
  const letter = resolvedLetterhead(data, '&P');

  const wb = XLSX.utils.book_new();

  sections.forEach((section) => {
    const pad = Math.max(0, section.columns.length - 3);
    const headerRow = [
      letter.headerLeft,
      ...Array(pad).fill(''),
      letter.headerRight,
    ];
    const footerRow = [
      letter.footerLeft,
      letter.footerCenter,
      ...Array(Math.max(0, section.columns.length - 3)).fill(''),
      letter.footerRight,
    ];
    const wsData = [
      headerRow,
      [],
      section.columns,
      ...section.rows,
      [],
      footerRow,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = section.columns.map((col, i) => ({
      wch: Math.max(
        col.length,
        ...section.rows.map((row) => (row[i] ? String(row[i]).length : 0))
      ) + 2,
    }));
    ws['!cols'] = colWidths;

    if (!ws['!print']) ws['!print'] = {};
    ws['!print'].header = `&L${letter.headerLeft}&R${letter.headerRight}`;
    ws['!print'].footer = `&L${letter.footerLeft}&C${letter.footerCenter}&R${letter.footerRight}`;
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

function rceMark(doc, x, y, on) {
  doc.setLineWidth(0.3);
  doc.rect(x, y - 2.6, 3.2, 3.2);
  if (on) {
    doc.setLineWidth(0.45);
    doc.line(x + 0.5, y - 1.1, x + 1.3, y + 0.2);
    doc.line(x + 1.3, y + 0.2, x + 2.7, y - 2.3);
  }
}

export function exportRceToPDF(rce = {}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 10;
  const innerW = pageW - 2 * m;
  doc.setLineWidth(0.5);
  doc.rect(m, m, innerW, pageH - 2 * m);

  let y = m + 4;
  const logo = rce.companyLogo;
  if (logo) {
    try {
      doc.addImage(logo, logoFormat(logo), m + 4, y, 42, 14);
    } catch {
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('LOGO', m + 6, y + 9);
    }
  } else {
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text('LOGO', m + 6, y + 9);
  }
  y += 18;
  doc.setLineWidth(0.3);
  doc.line(m, y, pageW - m, y);

  y += 8;
  doc.setFontSize(13);
  doc.setFont(undefined, 'bold');
  doc.text('REQUEST FOR COSTING (RCE) CHECKLIST FORM', pageW / 2, y, {
    align: 'center',
  });
  y += 5;
  doc.line(m, y, pageW - m, y);

  const leftW = innerW * 0.58;
  const rightX = m + leftW;
  const rowH = 8;
  const box = (x, yy, w, h) => {
    doc.setLineWidth(0.25);
    doc.rect(x, yy, w, h);
  };

  const drawCheck = (x, yy, label, on) => {
    rceMark(doc, x, yy, on);
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text(label, x + 4.5, yy);
  };

  let rowY = y;
  box(m, rowY, leftW, rowH);
  box(rightX, rowY, innerW - leftW, rowH);
  drawCheck(m + 3, rowY + 5.2, 'NEW PROJECT', rce.projectType === 'New Project');
  drawCheck(m + 42, rowY + 5.2, 'EXISTING PROJECT', rce.projectType === 'Existing Project');
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text('INQUIRY NUMBER & DATE:', rightX + 2, rowY + 3.2);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text(
    `${rce.inquiryNumber || ''}   ${rce.inquiryDate || ''}`,
    rightX + 2,
    rowY + 6.6
  );

  const meta = [
    ['CUSTOMER:', rce.customer || rce.client || '', 'RCE NO.:', rce.rceNo || rce.id || ''],
    ['ADDRESS:', rce.address || '', 'RCE DATE:', rce.rceDate || ''],
    ['PROJECT TITLE:', rce.projectTitle || '', 'PRIORITY LEVEL:', rce.priorityLevel || ''],
  ];
  meta.forEach((row) => {
    rowY += rowH;
    box(m, rowY, leftW, rowH);
    box(rightX, rowY, innerW - leftW, rowH);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    if (row[0]) doc.text(row[0], m + 2, rowY + 3);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    if (row[0]) doc.text(String(row[1] || ''), m + 32, rowY + 5.5, { maxWidth: leftW - 34 });
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text(row[2], rightX + 2, rowY + 3);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    doc.text(String(row[3] || ''), rightX + 2, rowY + 6.4);
  });

  rowY += rowH;
  box(m, rowY, leftW, rowH + 2);
  box(rightX, rowY, innerW - leftW, rowH + 2);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text('PROJECT TYPE:', m + 2, rowY + 3.4);
  drawCheck(m + 28, rowY + 6.4, 'SHOPWORK', !!rce.shopwork);
  drawCheck(m + 58, rowY + 6.4, 'ON-SITE', !!rce.onsite);
  drawCheck(m + 86, rowY + 6.4, 'TRADING', !!rce.trading);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text('CE DEADLINE:', rightX + 2, rowY + 3.2);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text(String(rce.ceDeadline || ''), rightX + 2, rowY + 6.8);

  rowY += rowH + 2;
  box(m, rowY, leftW, rowH);
  box(rightX, rowY, innerW - leftW, rowH);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text('DEPARTMENT:', m + 2, rowY + 3.2);
  drawCheck(m + 28, rowY + 5.6, 'MECHANICAL', !!rce.mechanical);
  drawCheck(m + 62, rowY + 5.6, 'ELECTRICAL', !!rce.electrical);
  doc.setFontSize(7);
  doc.setFont(undefined, 'bold');
  doc.text('SUBMISSION DEADLINE:', rightX + 2, rowY + 3.2);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  doc.text(String(rce.submissionDeadline || ''), rightX + 2, rowY + 6.8);

  rowY += rowH + 3;
  doc.setFontSize(7.5);
  doc.setFont(undefined, 'italic');
  doc.text('Note: Please kindly attach files Needed.', m + 2, rowY);
  rowY += 2;

  const items = rce.checklistItems || [];
  const body = items.map((it) => [
    it.num,
    it.desc,
    it.complete === 'YES' ? 'X' : '',
    it.complete === 'NO' ? 'X' : '',
    it.complete === 'N/A' ? 'X' : '',
    it.remarks || '',
  ]);

  autoTable(doc, {
    startY: rowY,
    margin: { left: m, right: m },
    theme: 'grid',
    head: [['ITEM NO.', 'DESCRIPTION', 'YES', 'NO', 'N/A', 'REMARKS']],
    body,
    styles: {
      fontSize: 7.5,
      cellPadding: 1.2,
      lineWidth: 0.25,
      lineColor: [0, 0, 0],
      textColor: [0, 0, 0],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 16, halign: 'center' },
      1: { cellWidth: 88 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 12, halign: 'center' },
      5: { cellWidth: 'auto' },
    },
  });

  let y2 = (doc.lastAutoTable?.finalY || rowY) + 4;
  const remarksH = 18;
  box(m, y2, innerW, remarksH);
  doc.setFontSize(8);
  doc.setFont(undefined, 'bold');
  doc.text('OTHER REMARKS:', m + 2, y2 + 4);
  doc.setFont(undefined, 'normal');
  doc.setFontSize(8);
  const remarks = doc.splitTextToSize(String(rce.otherRemarks || ''), innerW - 6);
  doc.text(remarks, m + 2, y2 + 8);

  y2 += remarksH;
  box(m, y2, innerW, remarksH);
  doc.setFont(undefined, 'bold');
  doc.text('REASON TO DECLINE / NO QUOTE:', m + 2, y2 + 4);
  doc.setFont(undefined, 'normal');
  const decline = doc.splitTextToSize(String(rce.declineReason || ''), innerW - 6);
  doc.text(decline, m + 2, y2 + 8);

  y2 += remarksH;
  const sigW = innerW / 3;
  ['Prepared by:', 'Reviewed by:', 'Approved by:'].forEach((label, i) => {
    box(m + i * sigW, y2, sigW, 16);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text(label, m + i * sigW + 2, y2 + 4);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8);
    const names = [rce.preparedBy, rce.reviewedBy, rce.approvedBy];
    doc.text(String(names[i] || ''), m + i * sigW + 2, y2 + 10);
  });

  doc.save(`${rce.rceNo || rce.id || 'RCE'}_Checklist.pdf`);
}
