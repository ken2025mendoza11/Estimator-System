// @ts-nocheck
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function dataUrlToBytes(dataUrl) {
  const parts = String(dataUrl || "").split(",");
  const base64 = parts.length > 1 ? parts[1] : parts[0];
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function isPdf(file) {
  return (
    String(file.type || "").includes("pdf") ||
    /\.pdf$/i.test(file.name || "")
  );
}

function isImage(file) {
  return (
    String(file.type || "").startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name || "")
  );
}

async function imageToPngBytes(file) {
  const bytes = dataUrlToBytes(file.dataUrl);
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  if (type.includes("png") || name.endsWith(".png")) {
    return { kind: "png", bytes };
  }
  if (type.includes("jpeg") || type.includes("jpg") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return { kind: "jpg", bytes };
  }
  const blob = await fetch(file.dataUrl).then((r) => r.blob());
  const bmp = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const pngUrl = canvas.toDataURL("image/png");
  return { kind: "png", bytes: dataUrlToBytes(pngUrl) };
}

async function addCoverPage(pdf, font, files, title) {
  const page = pdf.addPage([595, 842]);
  const { height } = page.getSize();
  page.drawText(title || "Compiled Attachments", {
    x: 48,
    y: height - 64,
    size: 18,
    font,
    color: rgb(0.1, 0.1, 0.08),
  });
  page.drawText(`${files.length} file${files.length === 1 ? "" : "s"} combined`, {
    x: 48,
    y: height - 86,
    size: 10,
    font,
    color: rgb(0.35, 0.34, 0.3),
  });
  let y = height - 120;
  files.forEach((file, i) => {
    if (y < 48) return;
    page.drawText(
      `${i + 1}. ${file.name}  —  ${file.sourceLabel || "Attachment"}`,
      {
        x: 48,
        y,
        size: 9,
        font,
        color: rgb(0.15, 0.14, 0.1),
      },
    );
    y -= 16;
  });
}

async function addNotePage(pdf, font, file) {
  const page = pdf.addPage([595, 842]);
  const { height } = page.getSize();
  page.drawText("File included by reference", {
    x: 48,
    y: height - 64,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.08),
  });
  page.drawText(file.name || "Untitled", {
    x: 48,
    y: height - 90,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.16),
  });
  page.drawText(file.sourceLabel || "", {
    x: 48,
    y: height - 110,
    size: 10,
    font,
    color: rgb(0.4, 0.38, 0.32),
  });
  page.drawText(
    "This file type cannot be drawn into the compiled PDF. Keep the original on the ATTCH sheet.",
    {
      x: 48,
      y: height - 140,
      size: 9,
      font,
      color: rgb(0.4, 0.38, 0.32),
    },
  );
}

export async function compileAttachmentsToPdf(files, title = "Compiled Attachments") {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  await addCoverPage(pdf, font, files, title);

  for (const file of files) {
    if (!file?.dataUrl) {
      await addNotePage(pdf, font, file);
      continue;
    }
    try {
      if (isPdf(file)) {
        const src = await PDFDocument.load(dataUrlToBytes(file.dataUrl), {
          ignoreEncryption: true,
        });
        const copied = await pdf.copyPages(src, src.getPageIndices());
        copied.forEach((p) => pdf.addPage(p));
        continue;
      }
      if (isImage(file)) {
        const img = await imageToPngBytes(file);
        const embedded =
          img.kind === "jpg" ? await pdf.embedJpg(img.bytes) : await pdf.embedPng(img.bytes);
        const page = pdf.addPage([595, 842]);
        const { width, height } = page.getSize();
        const maxW = width - 72;
        const maxH = height - 96;
        const scale = Math.min(maxW / embedded.width, maxH / embedded.height, 1);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        page.drawText(file.name || "Image", {
          x: 36,
          y: height - 36,
          size: 9,
          font,
          color: rgb(0.35, 0.34, 0.3),
        });
        page.drawImage(embedded, {
          x: (width - w) / 2,
          y: (height - h) / 2 - 8,
          width: w,
          height: h,
        });
        continue;
      }
      await addNotePage(pdf, font, file);
    } catch {
      await addNotePage(pdf, font, file);
    }
  }

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = String(title || "attachments")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  a.href = url;
  a.download = `${slug || "compiled-attachments"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
