/* eslint-disable react-refresh/only-export-components -- exports a hook/helper next to its component on purpose */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CreateQuizInput, QuestionAuthorDto, QuestionInput, QuizDetailDto } from '@quiz/shared';
import { quizzesApi, structureApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { applyLayout, buildLayout, layoutToReorder, sameLayout, type Layout } from './layout';
import { useHistory } from './history';
import { useSaveTracker } from './save-state';

type Patch = Partial<CreateQuizInput>;

export interface BuilderActions {
  addQuestion(input: QuestionInput): Promise<QuestionAuthorDto>;
  updateQuestion(qid: string, input: QuestionInput, before: QuestionInput): Promise<void>;
  deleteQuestion(qid: string): Promise<void>;
  commitLayout(next: Layout, label?: string): Promise<void>;
  addSection(title: string): Promise<void>;
  renameSection(id: string, title: string): Promise<void>;
  deleteSection(id: string): Promise<void>;
  patchQuiz(patch: Patch, before: Patch, label?: string): Promise<void>;
  importBank(bankIds: string[], sectionId: string | null): Promise<void>;
  undo(): Promise<void>;
  redo(): Promise<void>;
  /** cards register a function that persists any pending (debounced) edit; publish awaits all of them */
  registerFlusher(fn: () => Promise<void> | void): () => void;
  flushAll(): Promise<void>;
}

interface Ctx {
  id: string;
  quiz: QuizDetailDto;
  layout: Layout;
  /** bumps after undo/redo so cards re-seed their local drafts from the cache */
  revision: number;
  save: ReturnType<typeof useSaveTracker>;
  history: ReturnType<typeof useHistory>;
  actions: BuilderActions;
}

const BuilderContext = createContext<Ctx | null>(null);
export const useBuilder = () => {
  const c = useContext(BuilderContext);
  if (!c) throw new Error('useBuilder must be used inside <BuilderProvider>');
  return c;
};

/** Loads the quiz and owns every write: optimistic cache updates, serialised requests, autosave tracking and undo/redo. */
export function BuilderProvider({ id, children, fallback }: { id: string; children: (quiz: QuizDetailDto) => ReactNode; fallback: (s: { loading: boolean; error?: Error }) => ReactNode }) {
  const qc = useQueryClient();
  const detailKey = keys.quizzes.detail(id);
  const q = useQuery({ queryKey: detailKey, queryFn: () => quizzesApi.get(id), refetchOnWindowFocus: false, staleTime: Infinity });
  const save = useSaveTracker();
  const history = useHistory();
  const [revision, setRevision] = useState(0);

  // ids can change when undo re-creates a deleted entity; history entries hold a stable "canonical" id
  const alias = useRef(new Map<string, string>());
  const canonOf = useRef(new Map<string, string>());
  const canon = (cur: string) => canonOf.current.get(cur) ?? cur;
  const cur = (c: string) => alias.current.get(c) ?? c;
  const bind = (c: string, now: string) => { alias.current.set(c, now); canonOf.current.set(now, c); };
  const canonLayout = (l: Layout): Layout => l.map((c) => ({ id: c.id && canon(c.id), questionIds: c.questionIds.map(canon) }));
  const curLayout = (l: Layout): Layout => l.map((c) => ({ id: c.id && cur(c.id), questionIds: c.questionIds.map(cur) }));

  // per-key promise chain: saves for one entity never overtake each other
  const chains = useRef(new Map<string, Promise<unknown>>());
  const serial = useCallback(<T,>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = chains.current.get(key) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(fn);
    chains.current.set(key, next);
    return next;
  }, []);

  const flushers = useRef(new Set<() => Promise<void> | void>());
  const getDetail = () => qc.getQueryData<QuizDetailDto>(detailKey)!;
  const setDetail = (fn: (d: QuizDetailDto) => QuizDetailDto) => qc.setQueryData<QuizDetailDto>(detailKey, (d) => (d ? fn(d) : d));
  const markUnpublished = (d: QuizDetailDto): QuizDetailDto => (d.currentVersion != null ? { ...d, dirty: true } : d);
  const refreshLists = () => { void qc.invalidateQueries({ queryKey: ['quizzes', 'list'] }); void qc.invalidateQueries({ queryKey: keys.organizer.dashboard }); };
  const fail = (e: unknown) => { toast.error((e as Error).message || 'Something went wrong'); };

  const putQuestion = (d: QuizDetailDto, dto: QuestionAuthorDto): QuizDetailDto => ({
    ...d, questions: d.questions.map((x) => (x.id === dto.id ? dto : x)),
  });

  /* ───────────── raw operations (no history) ───────────── */
  const rawAdd = (input: QuestionInput) => save.track(serial('struct', async () => {
    const dto = await structureApi.addQuestion(id, input);
    setDetail((d) => markUnpublished({ ...d, questions: [...d.questions, dto] }));
    return dto;
  }));
  const rawDelete = (qid: string) => save.track(serial('struct', async () => {
    setDetail((d) => markUnpublished({ ...d, questions: d.questions.filter((x) => x.id !== qid) }));
    await structureApi.removeQuestion(qid);
  }));
  const rawUpdate = (qid: string, input: QuestionInput) => save.track(serial(`q:${qid}`, async () => {
    const dto = await structureApi.updateQuestion(qid, input);
    setDetail((d) => markUnpublished(putQuestion(d, dto)));
  }));
  const rawReorder = (layout: Layout) => save.track(serial('struct', async () => {
    setDetail((d) => markUnpublished(applyLayout(d, layout)));
    const dto = await structureApi.reorder(id, layoutToReorder(layout));
    setDetail((d) => ({ ...d, dirty: dto.dirty }));
  }));
  const rawPatch = (patch: Patch) => save.track(serial('quiz', async () => {
    setDetail((d) => ({ ...d, ...(patch.title !== undefined && { title: patch.title }), ...(patch.settings && { settings: { ...d.settings, ...patch.settings } }) }));
    const dto = await quizzesApi.update(id, patch);
    setDetail((d) => ({ ...dto, questions: d.questions, sections: d.sections }));
    refreshLists();
  }));

  const withErr = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { fail(e); throw e; } };

  /* ───────────── actions (record history) ───────────── */
  const actions: BuilderActions = useMemo(() => {
    const bump = () => setRevision((n) => n + 1);

    const addQuestion: BuilderActions['addQuestion'] = async (input) => {
      const dto = await rawAdd(input).catch((e) => { fail(e); throw e; });
      const c = canon(dto.id);
      let latest = input;
      history.push({
        label: 'add question',
        undo: async () => { latest = dtoLike(getDetail(), cur(c)) ?? input; await rawDelete(cur(c)); bump(); },
        redo: async () => { const re = await rawAdd(latest); bind(c, re.id); bump(); },
      });
      return dto;
    };

    const updateQuestion: BuilderActions['updateQuestion'] = async (qid, input, before) => {
      const c = canon(qid);
      await withErr(() => rawUpdate(cur(c), input));
      history.push({
        label: 'edit question', coalesceKey: `q:${c}`,
        undo: async () => { await rawUpdate(cur(c), before); bump(); },
        redo: async () => { await rawUpdate(cur(c), input); bump(); },
      });
    };

    const deleteQuestion: BuilderActions['deleteQuestion'] = async (qid) => {
      const d = getDetail();
      const snapshot = d.questions.find((x) => x.id === qid);
      if (!snapshot) return;
      const input = toQuestionInput(snapshot);
      const c = canon(qid);
      const layoutBefore = canonLayout(buildLayout(d));
      await withErr(() => rawDelete(qid));
      history.push({
        label: 'delete question',
        undo: async () => {
          const re = await rawAdd(input);
          bind(c, re.id);
          // put it back where it was: earlier layout, now including the new id
          await rawReorder(curLayout(layoutBefore));
          bump();
        },
        redo: async () => { await rawDelete(cur(c)); bump(); },
      });
    };

    const commitLayout: BuilderActions['commitLayout'] = async (next, label = 'reorder') => {
      const prev = buildLayout(getDetail());
      if (sameLayout(prev, next)) return;
      const before = canonLayout(prev);
      const after = canonLayout(next);
      await withErr(() => rawReorder(next));
      history.push({
        label,
        undo: async () => { await rawReorder(curLayout(before)); bump(); },
        redo: async () => { await rawReorder(curLayout(after)); bump(); },
      });
    };

    const addSection: BuilderActions['addSection'] = async (title) => {
      const mk = () => save.track(serial('struct', async () => {
        const s = await structureApi.addSection(id, { title });
        setDetail((d) => markUnpublished({ ...d, sections: [...d.sections, s] }));
        return s;
      }));
      const s = await mk().catch((e) => { fail(e); throw e; });
      const c = canon(s.id);
      history.push({
        label: 'add section',
        undo: async () => { await rawDeleteSection(cur(c)); bump(); },
        redo: async () => { const re = await mk(); bind(c, re.id); bump(); },
      });
    };

    const rawDeleteSection = (sid: string) => save.track(serial('struct', async () => {
      await structureApi.removeSection(sid);
      const dto = await quizzesApi.get(id); // questions of the section fall back to "unsectioned"
      qc.setQueryData(detailKey, dto);
    }));
    const rawRename = (sid: string, title: string) => save.track(serial(`s:${sid}`, async () => {
      setDetail((d) => markUnpublished({ ...d, sections: d.sections.map((s) => (s.id === sid ? { ...s, title } : s)) }));
      await structureApi.updateSection(sid, { title });
    }));

    const renameSection: BuilderActions['renameSection'] = async (sid, title) => {
      const old = getDetail().sections.find((s) => s.id === sid)?.title ?? '';
      if (old === title) return;
      const c = canon(sid);
      await withErr(() => rawRename(sid, title));
      history.push({
        label: 'rename section', coalesceKey: `s:${c}`,
        undo: async () => { await rawRename(cur(c), old); bump(); },
        redo: async () => { await rawRename(cur(c), title); bump(); },
      });
    };

    const deleteSection: BuilderActions['deleteSection'] = async (sid) => {
      const d = getDetail();
      const sec = d.sections.find((s) => s.id === sid);
      if (!sec) return;
      const layoutBefore = canonLayout(buildLayout(d));
      const c = canon(sid);
      await withErr(() => rawDeleteSection(sid));
      history.push({
        label: 'delete section',
        undo: async () => {
          const re = await save.track(serial('struct', () => structureApi.addSection(id, { title: sec.title, description: sec.description })));
          bind(c, re.id);
          await rawReorder(curLayout(layoutBefore));
          const dto = await quizzesApi.get(id);
          qc.setQueryData(detailKey, dto);
          bump();
        },
        redo: async () => { await rawDeleteSection(cur(c)); bump(); },
      });
    };

    const patchQuiz: BuilderActions['patchQuiz'] = async (patch, before, label = 'change settings') => {
      await withErr(() => rawPatch(patch));
      history.push({
        label, coalesceKey: `meta:${Object.keys(patch).sort().join(',')}`,
        undo: async () => { await rawPatch(before); bump(); },
        redo: async () => { await rawPatch(patch); bump(); },
      });
    };

    const importBank: BuilderActions['importBank'] = async (bankIds, sectionId) => {
      const beforeIds = new Set(getDetail().questions.map((x) => x.id));
      await withErr(() => save.track(serial('struct', async () => {
        const dto = await structureApi.importBank(id, { bankIds, sectionId });
        qc.setQueryData(detailKey, dto);
      })));
      const added = getDetail().questions.filter((x) => !beforeIds.has(x.id));
      const cs = added.map((x) => canon(x.id));
      const inputs = added.map(toQuestionInput);
      history.push({
        label: 'import from bank',
        undo: async () => { for (const c of cs) await rawDelete(cur(c)); bump(); },
        redo: async () => { for (let i = 0; i < inputs.length; i++) { const re = await rawAdd(inputs[i]!); bind(cs[i]!, re.id); } bump(); },
      });
    };

    const runHistory = (fn: () => Promise<void>) => fn().catch(fail);
    return {
      addQuestion, updateQuestion, deleteQuestion, commitLayout, addSection, renameSection, deleteSection, patchQuiz, importBank,
      undo: () => runHistory(history.undo), redo: () => runHistory(history.redo),
      registerFlusher: (fn) => { flushers.current.add(fn); return () => { flushers.current.delete(fn); }; },
      flushAll: async () => { await Promise.all([...flushers.current].map((f) => f())); await Promise.all([...chains.current.values()].map((p) => p.catch(() => undefined))); },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, history.push, history.undo, history.redo]);

  const quiz = q.data;
  const layout = useMemo(() => (quiz ? buildLayout(quiz) : []), [quiz]);
  const ctx = useMemo<Ctx | null>(() => (quiz ? { id, quiz, layout, revision, save, history, actions } : null), [id, quiz, layout, revision, save, history, actions]);

  /* eslint-disable react-hooks/refs -- refs (id aliases, flushers) are only touched inside action callbacks, never while rendering */
  if (!ctx) return <>{fallback({ loading: q.isPending, error: q.error ?? undefined })}</>;
  return <BuilderContext.Provider value={ctx}>{children(ctx.quiz)}</BuilderContext.Provider>;
  /* eslint-enable react-hooks/refs */
}

/* helpers */
function toQuestionInput(q: QuestionAuthorDto): QuestionInput {
  return {
    type: q.type, text: q.text, explanation: q.explanation, points: q.points, sectionId: q.sectionId,
    options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })), config: q.config,
  };
}
function dtoLike(d: QuizDetailDto, qid: string): QuestionInput | null {
  const q = d.questions.find((x) => x.id === qid);
  return q ? toQuestionInput(q) : null;
}
