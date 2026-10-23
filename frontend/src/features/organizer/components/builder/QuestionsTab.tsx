import { useState } from 'react';
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCenter, pointerWithin, useDroppable, useSensor, useSensors,
  type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, BookOpen, FolderPlus, GripVertical, Plus, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog, EmptyState, Input } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useBuilder } from './BuilderProvider';
import { moveQuestion, moveSection, type Layout } from './layout';
import { NewQuestionCard, QuestionCard } from './QuestionCard';
import { BankImportDialog } from './BankImportDialog';

const qid = (id: string) => `q:${id}`;
const sid = (id: string) => `s:${id}`;
const cid = (id: string | null) => `c:${id ?? 'none'}`;
const strip = (s: string) => s.slice(2);

const collision: CollisionDetection = (args) => {
  const type = args.active.data.current?.type;
  const droppableContainers = args.droppableContainers.filter((c) => (type === 'section' ? c.data.current?.type === 'section' : c.data.current?.type !== 'section'));
  const hits = pointerWithin({ ...args, droppableContainers });
  const items = hits.filter((h) => !String(h.id).startsWith('c:'));
  if (items.length) return items;
  return hits.length ? hits : closestCenter({ ...args, droppableContainers });
};

function Handle({ label, attributes, listeners }: { label: string; attributes: object; listeners?: object }) {
  return (
    <button
      type="button" aria-label={label}
      className="grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text active:cursor-grabbing"
      {...attributes} {...listeners}
    ><GripVertical className="size-4" aria-hidden="true" /></button>
  );
}

function SortableQuestion({ id, ...props }: Omit<React.ComponentProps<typeof QuestionCard>, 'handle'> & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: qid(id), data: { type: 'question' } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'opacity-40')}>
      <QuestionCard {...props} handle={<Handle label={`Drag question ${props.number}. Press space, then arrow keys to move.`} attributes={attributes} listeners={listeners} />} />
    </div>
  );
}

function Container({ id, children, empty, hint }: { id: string | null; children: React.ReactNode; empty: boolean; hint: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: cid(id), data: { type: 'container' } });
  return (
    <div ref={setNodeRef} className={cn('grid gap-2 rounded-lg', empty && 'min-h-14 border border-dashed border-border-strong', isOver && 'bg-accent-soft')}>
      {empty && <p className="grid place-items-center py-4 text-sm text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function SectionBlock({ id, title, index, count, canUp, canDown, onMove, onRename, onDelete, children }: {
  id: string; title: string; index: number; count: number; canUp: boolean; canDown: boolean;
  onMove: (d: -1 | 1) => void; onRename: (t: string) => void; onDelete: () => void; children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sid(id), data: { type: 'section' } });
  const [name, setName] = useState(title);
  return (
    <section ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} aria-label={`Section ${index}: ${title}`} className={cn('grid gap-3 rounded-lg border border-border bg-surface-2 p-3', isDragging && 'opacity-40')}>
      <div className="flex items-center gap-1 sm:gap-2">
        <Handle label={`Drag section ${title}`} attributes={attributes} listeners={listeners} />
        <Input
          aria-label={`Section ${index} title`} value={name} maxLength={120} className="h-9 flex-1 border-transparent bg-transparent font-display text-base font-semibold hover:border-border"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { const t = name.trim(); if (!t) setName(title); else if (t !== title) onRename(t); }}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        />
        <span className="num hidden text-xs text-muted sm:inline">{count} question{count === 1 ? '' : 's'}</span>
        <Button variant="ghost" size="icon-sm" aria-label={`Move section ${title} up`} disabled={!canUp} onClick={() => onMove(-1)}><ArrowUp /></Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Move section ${title} down`} disabled={!canDown} onClick={() => onMove(1)}><ArrowDown /></Button>
        <ConfirmDialog
          destructive confirmLabel="Delete section" title={`Delete "${title}"?`} description="Its questions are kept and move to the top, outside any section. You can undo this."
          trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete section ${title}`}><Trash2 /></Button>} onConfirm={onDelete}
        />
      </div>
      {children}
    </section>
  );
}

export function QuestionsTab() {
  const { quiz, layout, actions, revision } = useBuilder();
  const [dragLayout, setDragLayout] = useState<Layout | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<{ key: number; sectionId: string | null }[]>([]);
  const [bankFor, setBankFor] = useState<{ sectionId: string | null } | null>(null);
  const [adding, setAdding] = useState(false);
  const shown = dragLayout ?? layout;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const questions = new Map(quiz.questions.map((q) => [q.id, q]));
  const sections = new Map(quiz.sections.map((s) => [s.id, s]));
  const numbering = new Map<string, number>();
  shown.forEach((c) => c.questionIds.forEach((id) => numbering.set(id, numbering.size + 1)));
  const total = quiz.questions.length;
  const points = quiz.questions.reduce((s, q) => s + q.points, 0);

  const containerOf = (l: Layout, token: string) => {
    const raw = strip(token);
    if (token.startsWith('c:')) return l.findIndex((c) => (c.id ?? 'none') === raw);
    return l.findIndex((c) => c.questionIds.includes(raw));
  };

  const onDragStart = (e: DragStartEvent) => { setActiveId(String(e.active.id)); setDragLayout(layout); };
  const onDragOver = (e: DragOverEvent) => {
    const { active, over } = e;
    if (!over || !String(active.id).startsWith('q:') || String(over.id).startsWith('s:')) return;
    setDragLayout((l) => {
      if (!l) return l;
      const from = containerOf(l, String(active.id));
      const to = containerOf(l, String(over.id));
      if (from < 0 || to < 0 || from === to) return l;
      const next = l.map((c) => ({ ...c, questionIds: [...c.questionIds] }));
      const item = strip(String(active.id));
      next[from]!.questionIds = next[from]!.questionIds.filter((x) => x !== item);
      const overIdx = String(over.id).startsWith('q:') ? next[to]!.questionIds.indexOf(strip(String(over.id))) : -1;
      next[to]!.questionIds.splice(overIdx < 0 ? next[to]!.questionIds.length : overIdx, 0, item);
      return next;
    });
  };
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    let final = dragLayout ?? layout;
    if (over && String(active.id).startsWith('s:') && String(over.id).startsWith('s:')) {
      const secs = final.slice(1);
      const a = secs.findIndex((c) => c.id === strip(String(active.id)));
      const b = secs.findIndex((c) => c.id === strip(String(over.id)));
      if (a >= 0 && b >= 0 && a !== b) final = [final[0]!, ...arrayMove(secs, a, b)];
    } else if (over && String(active.id).startsWith('q:') && String(over.id).startsWith('q:')) {
      const ci = containerOf(final, String(active.id));
      if (ci >= 0 && ci === containerOf(final, String(over.id))) {
        const ids = final[ci]!.questionIds;
        const a = ids.indexOf(strip(String(active.id)));
        const b = ids.indexOf(strip(String(over.id)));
        if (a !== b) final = final.map((c, i) => (i === ci ? { ...c, questionIds: arrayMove(ids, a, b) } : c));
      }
    }
    setActiveId(null); setDragLayout(null);
    void actions.commitLayout(final, String(active.id).startsWith('s:') ? 'move section' : 'move question').catch(() => undefined);
  };
  const onDragCancel = () => { setActiveId(null); setDragLayout(null); };

  const move = (id: string, dir: -1 | 1) => { const n = moveQuestion(layout, id, dir); if (n) void actions.commitLayout(n, 'move question').catch(() => undefined); };
  const moveSec = (id: string, dir: -1 | 1) => { const n = moveSection(layout, id, dir); if (n) void actions.commitLayout(n, 'move section').catch(() => undefined); };

  const addDraft = (sectionId: string | null) => setDrafts((d) => [...d, { key: Date.now() + d.length, sectionId }]);
  const flatIds = shown.flatMap((c) => c.questionIds);
  const hasSections = quiz.sections.length > 0;
  const activeQ = activeId?.startsWith('q:') ? questions.get(strip(activeId)) : null;

  const renderContainer = (c: Layout[number]) => {
    const dr = drafts.filter((d) => d.sectionId === c.id);
    return (
      <div key={cid(c.id)} className="grid gap-2">
      <Container id={c.id} empty={c.questionIds.length === 0 && dr.length === 0 && (hasSections || !!activeId)} hint={c.id ? 'No questions in this section yet.' : 'Drop here to take a question out of its section.'}>
        <SortableContext items={c.questionIds.map(qid)} strategy={verticalListSortingStrategy}>
          {c.questionIds.map((id) => {
            const q = questions.get(id);
            if (!q) return null;
            const flat = flatIds.indexOf(id);
            return (
              <SortableQuestion
                key={`${id}:${revision}`} id={id} q={q} number={numbering.get(id) ?? 0} open={openId === id} onToggle={() => setOpenId(openId === id ? null : id)}
                onMove={(d) => move(id, d)} canMove={{ up: flat > 0, down: flat < flatIds.length - 1 }}
              />
            );
          })}
        </SortableContext>
        {dr.map((d) => (
          <NewQuestionCard
            key={d.key} sectionId={c.id} number={total + 1}
            onCreated={(q) => { setDrafts((x) => x.filter((y) => y.key !== d.key)); setOpenId(q.id); }}
            onDiscard={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}
          />
        ))}
      </Container>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => addDraft(c.id)}><Plus aria-hidden="true" /> Add question</Button>
        <Button variant="ghost" size="sm" onClick={() => setBankFor({ sectionId: c.id })}><BookOpen aria-hidden="true" /> From bank</Button>
      </div>
      </div>
    );
  };

  const sectionContainers = shown.slice(1);
  const unsectioned = shown[0]!;
  const showUnsectioned = !hasSections || unsectioned.questionIds.length > 0 || drafts.some((d) => d.sectionId === null) || !!activeId;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite"><span className="num font-medium text-text">{total}</span> question{total === 1 ? '' : 's'} · <span className="num font-medium text-text">{points}</span> point{points === 1 ? '' : 's'} total</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setBankFor({ sectionId: null })}><BookOpen aria-hidden="true" /> Import from bank</Button>
          <Button
            variant="outline" size="sm" loading={adding}
            onClick={async () => { setAdding(true); try { await actions.addSection(`Section ${quiz.sections.length + 1}`); } finally { setAdding(false); } }}
          ><FolderPlus aria-hidden="true" /> Add section</Button>
        </div>
      </div>

      {total === 0 && drafts.length === 0 && !hasSections && (
        <EmptyState
          title="No questions yet" description="Start with a first question, import from your bank, or group questions into sections."
          action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={() => addDraft(null)}><Plus aria-hidden="true" /> Add first question</Button><Button variant="outline" onClick={() => setBankFor({ sectionId: null })}>Import from bank</Button></div>}
        />
      )}

      {(total > 0 || drafts.length > 0 || hasSections) && (
        <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={onDragCancel}
          accessibility={{ screenReaderInstructions: { draggable: 'To pick up, press space or enter. Use the arrow keys to move, space to drop, escape to cancel. Buttons beside each item also move it up or down.' } }}>
          <div className="grid gap-4">
            {showUnsectioned && (hasSections ? (
              <div className="grid gap-2"><h3 className="text-xs font-medium uppercase tracking-wide text-muted">Not in a section</h3>{renderContainer(unsectioned)}</div>
            ) : renderContainer(unsectioned))}
            <SortableContext items={sectionContainers.map((c) => sid(c.id!))} strategy={verticalListSortingStrategy}>
              {sectionContainers.map((c, i) => {
                const s = sections.get(c.id!);
                if (!s) return null;
                return (
                  <SectionBlock
                    key={s.id} id={s.id} title={s.title} index={i + 1} count={c.questionIds.length} canUp={i > 0} canDown={i < sectionContainers.length - 1}
                    onMove={(d) => moveSec(s.id, d)} onRename={(t) => void actions.renameSection(s.id, t).catch(() => undefined)} onDelete={() => actions.deleteSection(s.id)}
                  >
                    {renderContainer(c)}
                  </SectionBlock>
                );
              })}
            </SortableContext>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeQ && <div className="rounded-lg border border-accent bg-surface p-3 text-sm font-medium shadow-[var(--shadow-2)]"><span className="line-clamp-1">{activeQ.text}</span></div>}
          </DragOverlay>
        </DndContext>
      )}

      <BankImportDialog open={!!bankFor} onOpenChange={(o) => !o && setBankFor(null)} sectionId={bankFor?.sectionId ?? null} />
    </div>
  );
}
