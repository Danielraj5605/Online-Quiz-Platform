import { Router } from 'express';
import { pageQuery } from '@quiz/shared';
import { me, organizerOrAdmin } from '../../core/auth';
import { etagJson } from '../../core/etag';
import { idParam, pageMeta, query, wrap } from '../../core/http';
import { requireQuizOwner } from '../../core/policy';
import { audit } from '../../core/audit';
import { csvRow } from './csv';
import { streamPdf } from './pdf';
import * as svc from './service';

export const reportsRouter = Router();
reportsRouter.use('/quizzes/:id/reports', organizerOrAdmin);

const owned = async (req: Parameters<typeof idParam>[0]) => {
  const id = idParam(req);
  await requireQuizOwner(me(req), id);
  return id;
};

reportsRouter.get('/quizzes/:id/reports/summary', wrap(async (req, res) => {
  etagJson(req, res, await svc.summary(await owned(req)));
}));

reportsRouter.get('/quizzes/:id/reports/items', wrap(async (req, res) => {
  etagJson(req, res, await svc.items(await owned(req)));
}));

reportsRouter.get('/quizzes/:id/reports/participants', wrap(async (req, res) => {
  const id = await owned(req);
  const q = query(pageQuery, req);
  const { rows, total } = await svc.participants(id, q);
  etagJson(req, res, rows, pageMeta(q.page, q.pageSize, total));
}));

reportsRouter.get('/quizzes/:id/reports/cohorts', wrap(async (req, res) => {
  etagJson(req, res, await svc.cohorts(await owned(req)));
}));

const safeName = (t: string) => t.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'quiz';

reportsRouter.get('/quizzes/:id/reports/export.csv', wrap(async (req, res) => {
  const id = await owned(req);
  const title = await svc.quizTitle(id);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName(title)}-results.csv"`);
  res.write('﻿' + csvRow(['Username', 'Name', 'Email', 'Attempt', 'Score', 'Max score', 'Percentage', 'Band', 'Passed', 'Final', 'Duration (s)', 'Tab switches', 'Submitted at']));
  for await (const r of svc.exportRows(id)) {
    res.write(csvRow([
      r.user.username, r.user.name, r.user.email, r.attempt.number, r.score, r.maxScore, Math.round(r.percentage * 10) / 10,
      r.band, r.passed ? 'yes' : 'no', r.isFinal ? 'yes' : 'pending', r.attempt.durationSec, r.attempt.tabSwitches, r.attempt.submittedAt,
    ]));
  }
  await audit(req, me(req).id, 'report.export_csv', 'Quiz', id);
  res.end();
}));

reportsRouter.get('/quizzes/:id/reports/export.pdf', wrap(async (req, res) => {
  const id = await owned(req);
  const [title, summary, items] = await Promise.all([svc.quizTitle(id), svc.summary(id), svc.items(id)]);
  await audit(req, me(req).id, 'report.export_pdf', 'Quiz', id);
  streamPdf(res, `${safeName(title)}-report.pdf`, { title, summary, items });
}));
