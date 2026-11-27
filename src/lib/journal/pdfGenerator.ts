import { jsPDF } from 'jspdf';
import {
  GeneratedJournalDoc,
  PaperSizeConfig,
  UniversalSettings,
} from '../../types/journal';
import { resolvePaperDimensionsIn } from './journal909Template';

function hexToRgb(hex: string): [number, number, number] {
  const clean = String(hex || '#290076').replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [41, 0, 118];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

async function prepareArtworkForPdf(
  dataUrl: string,
  colorMode: string,
  themePrimary: string
): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!dataUrl) return null;
  try {
    const img = await loadImageElement(dataUrl);
    const w = Math.max(1, img.naturalWidth || img.width || 400);
    const h = Math.max(1, img.naturalHeight || img.height || 300);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl, width: w, height: h };

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (colorMode === 'grayscale') {
      ctx.filter = 'grayscale(100%) contrast(112%)';
    }
    ctx.drawImage(img, 0, 0, w, h);

    if (colorMode === 'theme') {
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'color';
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = themePrimary;
      ctx.fillRect(0, 0, w, h);
    }

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: w,
      height: h,
    };
  } catch {
    return null;
  }
}

/**
 * Generates a crisp single-page vector PDF calibrated cleanly to any paper preset
 * (Legal 8.5x14, Indian Legal 215x345mm, A4 210x297mm, Letter, or Custom) with auto-fit scaling.
 */
export async function generateJournalDocPdf(
  docData: GeneratedJournalDoc,
  paperSize?: PaperSizeConfig,
  universalSettings?: UniversalSettings
): Promise<string> {
  const dims = resolvePaperDimensionsIn(paperSize);
  const autoAdjust = paperSize?.autoAdjustPrint !== false;

  const orientation = dims.widthIn > dims.heightIn ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'in',
    format: [dims.widthIn, dims.heightIn],
    compress: true,
  });

  // Design master canvas is calibrated at 8.5 x 14 in. Scale uniformly to fit target paper cleanly.
  const baseW = 8.5;
  const baseH = 14.0;
  const marginSafety = autoAdjust ? 0.96 : 1.0;
  const scale = Math.min(dims.widthIn / baseW, dims.heightIn / baseH) * marginSafety;
  const offsetX = (dims.widthIn - baseW * scale) / 2;
  const offsetY = (dims.heightIn - baseH * scale) / 2;

  const px = (xIn: number) => offsetX + xIn * scale;
  const py = (yIn: number) => offsetY + yIn * scale;
  const s = (vIn: number) => vIn * scale;

  const primaryHex = universalSettings?.docPrimaryColor || '#290076';
  const secondaryHex = universalSettings?.docSecondaryColor || '#4e1cb8';
  const accentHex = universalSettings?.docAccentColor || '#f4580b';

  const [pr, pg, pb] = hexToRgb(primaryHex);
  const [sr, sg, sb] = hexToRgb(secondaryHex);
  const [ar, ag, ab] = hexToRgb(accentHex);

  // Page white background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, dims.widthIn, dims.heightIn, 'F');

  // --- Outer Geometric Corner Frame (calibrated to 850x1400 master grid) ---
  const gx = (v: number) => px((v / 850) * baseW);
  const gy = (v: number) => py((v / 1400) * baseH);

  // Top-left triangles
  pdf.setFillColor(sr, sg, sb);
  pdf.triangle(gx(18), gy(18), gx(98), gy(18), gx(18), gy(98), 'F');
  pdf.setFillColor(pr, pg, pb);
  pdf.triangle(gx(18), gy(108), gx(108), gy(18), gx(134), gy(18), 'F');
  pdf.triangle(gx(18), gy(108), gx(134), gy(18), gx(18), gy(134), 'F');

  // Top-right triangles
  pdf.setFillColor(pr, pg, pb);
  pdf.triangle(gx(776), gy(18), gx(832), gy(18), gx(832), gy(74), 'F');

  // Bottom-left triangle
  pdf.triangle(gx(18), gy(1326), gx(18), gy(1382), gx(74), gy(1382), 'F');

  // Bottom-right triangles
  pdf.setFillColor(sr, sg, sb);
  pdf.triangle(gx(752), gy(1382), gx(832), gy(1382), gx(832), gy(1302), 'F');

  // Silver and Primary perimeter lines
  pdf.setDrawColor(184, 184, 184);
  pdf.setLineWidth(s(0.02));
  pdf.line(gx(138), gy(22), gx(742), gy(22));
  pdf.line(gx(108), gy(1378), gx(712), gy(1378));
  pdf.line(gx(20), gy(735), gx(20), gy(1285));
  pdf.line(gx(830), gy(115), gx(830), gy(500));

  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.04));
  pdf.line(gx(120), gy(32), gx(764), gy(32));
  pdf.line(gx(86), gy(1368), gx(730), gy(1368));
  pdf.line(gx(20), gy(145), gx(20), gy(495));
  pdf.line(gx(830), gy(735), gx(830), gy(1265));

  pdf.setLineWidth(s(0.02));
  pdf.line(gx(28), gy(125), gx(28), gy(1305));
  pdf.line(gx(822), gy(95), gx(822), gy(1285));

  // --- Top Header: Journal Ribbon Tag ---
  const tagX = px(0.62);
  const tagY = py(0.62);
  const tagW = s(1.18);
  const tagH = s(1.62);
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(tagX, tagY, tagW, tagH * 0.82, 'F');
  pdf.triangle(tagX, tagY + tagH * 0.82, tagX + tagW / 2, tagY + tagH * 0.82, tagX, tagY + tagH, 'F');
  pdf.triangle(tagX + tagW / 2, tagY + tagH * 0.82, tagX + tagW, tagY + tagH * 0.82, tagX + tagW, tagY + tagH, 'F');

  pdf.setFillColor(255, 255, 255);
  pdf.circle(tagX + tagW / 2, tagY + s(0.14), s(0.05), 'F');

  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22 * scale);
  pdf.text(String(docData.journalNo || '909'), tagX + tagW / 2, tagY + s(0.75), {
    align: 'center',
  });

  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(s(0.015));
  pdf.line(tagX + s(0.24), tagY + s(0.84), tagX + tagW - s(0.24), tagY + s(0.84));
  pdf.setFontSize(10.5 * scale);
  pdf.text('Publication', tagX + tagW / 2, tagY + s(1.04), { align: 'center' });

  // Journal Title & Date
  const infoX = px(2.0);
  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.025));
  pdf.line(infoX, py(0.65), infoX, py(1.75));

  pdf.setTextColor(ar, ag, ab);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20 * scale);
  pdf.text(`JOURNAL ${docData.journalNo || '909'}`, infoX + s(0.18), py(0.95));

  pdf.setTextColor(pr, pg, pb);
  pdf.setFontSize(13 * scale);
  pdf.text(String(docData.journalDate || '26-Nov-2026'), infoX + s(0.18), py(1.26));

  pdf.setFillColor(sr, sg, sb);
  pdf.rect(infoX + s(0.18), py(1.45), s(0.75), s(0.065), 'F');
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(infoX + s(0.93), py(1.45), s(1.45), s(0.065), 'F');

  // --- Right Header: Publishing Details Box ---
  const pubX = px(5.26);
  const pubW = s(2.68);
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(pubX, py(0.68), pubW, s(0.29), 'F');
  pdf.setTextColor(ar, ag, ab);
  pdf.setFontSize(10.5 * scale);
  pdf.text('PUBLISHING DETAILS', pubX + pubW / 2, py(0.87), { align: 'center' });

  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.022));
  pdf.rect(pubX, py(1.06), pubW, s(0.86));
  pdf.setTextColor(17, 17, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5 * scale);
  const pubLines = pdf.splitTextToSize(docData.publishingDetails || '', pubW - s(0.16));
  pdf.text(pubLines.slice(0, 5), pubX + s(0.08), py(1.26));

  // --- Application Details Section Banner ---
  const secY = py(2.55);
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(px(0.58), secY, s(2.45), s(0.32), 'F');
  pdf.setTextColor(ar, ag, ab);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11.5 * scale);
  pdf.text('APPLICATION DETAILS', px(0.76), secY + s(0.22));
  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.022));
  pdf.line(px(3.12), secY + s(0.16), px(7.92), secY + s(0.16));

  // --- Details Table ---
  const tblX = px(0.58);
  let curY = py(3.04);
  const colW = [s(0.95), s(2.94), s(1.32), s(2.13)];
  const totalTblW = colW.reduce((a, b) => a + b, 0);
  const rowH = s(0.44);

  const drawRow = (c0: string, c1: string, c2?: string, c3?: string) => {
    const isFourCol = c2 !== undefined && c3 !== undefined;
    // Label 1
    pdf.setFillColor(225, 226, 230);
    pdf.rect(tblX, curY, colW[0], rowH, 'FD');
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10 * scale);
    pdf.text(String(c0 || ''), tblX + colW[0] / 2, curY + rowH * 0.62, { align: 'center' });

    if (isFourCol) {
      pdf.setFillColor(255, 255, 255);
      pdf.rect(tblX + colW[0], curY, colW[1], rowH, 'FD');
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10 * scale);
      const val1Lines = pdf.splitTextToSize(String(c1 || ''), colW[1] - s(0.14));
      pdf.text(val1Lines[0] || '', tblX + colW[0] + s(0.08), curY + rowH * 0.62);

      pdf.setFillColor(225, 226, 230);
      pdf.rect(tblX + colW[0] + colW[1], curY, colW[2], rowH, 'FD');
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(c2 || ''), tblX + colW[0] + colW[1] + colW[2] / 2, curY + rowH * 0.62, {
        align: 'center',
      });

      pdf.setFillColor(255, 255, 255);
      pdf.rect(tblX + colW[0] + colW[1] + colW[2], curY, colW[3], rowH, 'FD');
      pdf.setFont('helvetica', 'normal');
      const val3Lines = pdf.splitTextToSize(String(c3 || ''), colW[3] - s(0.14));
      pdf.text(
        val3Lines[0] || '',
        tblX + colW[0] + colW[1] + colW[2] + s(0.08),
        curY + rowH * 0.62
      );
    } else {
      const spanW = colW[1] + colW[2] + colW[3];
      pdf.setFillColor(255, 255, 255);
      pdf.rect(tblX + colW[0], curY, spanW, rowH, 'FD');
      pdf.setFont('helvetica', 'normal');
      const spanLines = pdf.splitTextToSize(String(c1 || ''), spanW - s(0.14));
      pdf.text(spanLines[0] || '', tblX + colW[0] + s(0.08), curY + rowH * 0.62);
    }
    curY += rowH;
  };

  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.018));
  drawRow('TITLE', docData.title || '', 'TRADEMARK', docData.trademarkField || docData.applicationNo || '');
  drawRow('CLASS', docData.classNo || '', docData.extraLabel || 'PAGE NO', docData.extraValue || '');
  for (const extra of docData.extraRows || []) {
    drawRow(extra.label || 'DETAILS', extra.value || '');
  }
  // Outer thick border around table
  pdf.setLineWidth(s(0.025));
  pdf.rect(tblX, py(3.04), totalTblW, curY - py(3.04));

  // --- IMAGE Heading ---
  const imgHeadY = curY + s(0.42);
  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.02));
  pdf.line(px(1.1), imgHeadY, px(3.2), imgHeadY);
  pdf.line(px(5.3), imgHeadY, px(7.4), imgHeadY);
  pdf.setTextColor(ar, ag, ab);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16 * scale);
  pdf.text('IMAGE', px(4.25), imgHeadY + s(0.06), { align: 'center' });

  // --- Footer Block Positions ---
  const footerNoteY = py(11.95);
  const imgTopY = imgHeadY + s(0.28);
  const imgMaxH = Math.max(s(1.4), footerNoteY - imgTopY - s(0.24));
  const imgMaxW = s(6.9);

  // Embedded Artwork Image (if uploaded)
  const colorMode =
    docData.imageColorMode || universalSettings?.imageColorMode || 'theme';
  if (docData.imageDataUrl) {
    const processed = await prepareArtworkForPdf(
      docData.imageDataUrl,
      colorMode,
      primaryHex
    );
    if (processed) {
      const ratio = Math.min(imgMaxW / processed.width, imgMaxH / processed.height);
      const drawW = processed.width * ratio;
      const drawH = processed.height * ratio;
      const drawX = px(4.25) - drawW / 2;
      const drawY = imgTopY + (imgMaxH - drawH) / 2;
      pdf.addImage(processed.dataUrl, 'PNG', drawX, drawY, drawW, drawH);
    }
  }

  // --- Note Bar ---
  pdf.setFillColor(pr, pg, pb);
  pdf.rect(px(0.58), footerNoteY, totalTblW, s(0.32), 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.8 * scale);
  pdf.text(
    (
      docData.noteText ||
      'NOTE: DEMAND NOTE WILL BE ISSUED AFTER 2 MONTHS FROM THE DATE OF PUBLICATION'
    ).toUpperCase(),
    px(4.25),
    footerNoteY + s(0.21),
    { align: 'center' }
  );

  // --- Brandex Footer Wordmark Row ---
  const logoY = footerNoteY + s(0.68);
  pdf.setDrawColor(pr, pg, pb);
  pdf.setLineWidth(s(0.018));
  pdf.line(px(2.4), logoY, px(3.35), logoY);
  pdf.line(px(5.15), logoY, px(6.1), logoY);

  pdf.setTextColor(pr, pg, pb);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(7.5 * scale);
  pdf.text('G E T   L E G A L', px(4.25), logoY - s(0.18), { align: 'center' });

  pdf.setFontSize(22 * scale);
  pdf.text('b  andex', px(4.28), logoY + s(0.08), { align: 'center' });
  pdf.setFillColor(ar, ag, ab);
  pdf.circle(px(3.96), logoY - s(0.01), s(0.14), 'F');
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(12 * scale);
  pdf.text('R', px(3.96), logoY + s(0.045), { align: 'center' });

  // --- Contact Row (4 columns inside safe corner margins) ---
  const contactY = logoY + s(0.32);
  const contacts = [
    {
      label: 'Address:',
      text: 'DROP AT ABDULLAH CENTRE, JINNAH COLONY BEHIND PTCL EXCHANGE, TARLAI, ISLAMABAD',
      w: s(2.35),
    },
    { label: 'Whatsapp:', text: '+92 336 0015004', w: s(1.38) },
    { label: 'Email:', text: 'info@brandex.pk', w: s(1.32) },
    { label: 'Facebook:', text: 'https://www.facebook.com/Brandex.pk/', w: s(1.76) },
  ];

  let cx = px(0.66);
  contacts.forEach((item, idx) => {
    pdf.setTextColor(pr, pg, pb);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.8 * scale);
    pdf.text(item.label, cx, contactY);

    pdf.setTextColor(17, 17, 17);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7 * scale);
    const wrapped = pdf.splitTextToSize(item.text, item.w - s(0.15));
    pdf.text(wrapped.slice(0, 3), cx, contactY + s(0.13));

    if (idx < contacts.length - 1) {
      pdf.setDrawColor(pr, pg, pb);
      pdf.setLineWidth(s(0.015));
      pdf.line(cx + item.w - s(0.06), contactY - s(0.08), cx + item.w - s(0.06), contactY + s(0.42));
    }
    cx += item.w;
  });

  const safeName = `${docData.serialNo || 'DOC'}_Journal_${docData.journalNo || '909'}_${
    docData.applicationNo || 'Case'
  }`.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const filename = `${safeName}.pdf`;
  pdf.save(filename);
  return filename;
}
