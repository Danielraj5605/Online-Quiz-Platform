import PDFDocument from 'pdfkit';
import type { Response } from 'express';

interface PdfInput {
  title: string;
  summary: { attempts: number; participants: number; avgPct: number; medianPct: number; passRate: number; avgDurationSec: number; gradedPending: number; distribution: { bucket: string; count: number }[] };
  items: { text: string; difficulty: number | null; discrimination: number | null; omitRate: number }[];
}

export function streamPdf(res: Response, filename: string, d: PdfInput) {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.font('Helvetica-Bold').fontSize(20).text(d.title);
  doc.font('Helvetica').fontSize(10).fillColor('#666').text(`Quiz report · generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`).fillColor('#000');
  doc.moveDown();

  const s = d.summary;
  const stats: [string, string][] = [
    ['Attempts', String(s.attempts)], ['Participants', String(s.participants)], ['Average', `${s.avgPct}%`], ['Median', `${s.medianPct}%`],
    ['Pass rate', `${s.passRate}%`], ['Avg time', `${Math.floor(s.avgDurationSec / 60)}m ${s.avgDurationSec % 60}s`], ['Pending grading', String(s.gradedPending)],
  ];
  doc.font('Helvetica-Bold').fontSize(13).text('Summary');
  doc.font('Helvetica').fontSize(11);
  for (const [k, v] of stats) doc.text(`${k}: ${v}`);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text('Score distribution');
  const max = Math.max(1, ...s.distribution.map((b) => b.count));
  doc.font('Helvetica').fontSize(9);
  for (const b of s.distribution) {
    const y = doc.y;
    doc.text(b.bucket, 48, y, { width: 50 });
    doc.rect(100, y + 1, Math.max(1, (b.count / max) * 300), 8).fill('#C8401F');
    doc.fillColor('#000').text(String(b.count), 410, y);
    doc.y = y + 14;
  }
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(13).text('Item analysis');
  doc.font('Helvetica').fontSize(9);
  d.items.slice(0, 40).forEach((it, i) => {
    if (doc.y > 760) doc.addPage();
    const txt = it.text.length > 90 ? `${it.text.slice(0, 87)}...` : it.text;
    doc.text(`${i + 1}. ${txt}`, { continued: false });
    doc.fillColor('#666').text(`   difficulty ${it.difficulty ?? '—'} · discrimination ${it.discrimination ?? '—'} · omitted ${Math.round(it.omitRate * 100)}%`).fillColor('#000');
  });
  doc.end();
}
