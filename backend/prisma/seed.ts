/**
 * Demo data for all three roles. DESTRUCTIVE: wipes every app table (not _prisma_migrations) first.
 * Run: npm run db:seed -w backend
 */
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import {
  quizSettingsSchema, questionConfigSchema, tierFor,
  type AnswerValue, type PublishedQuestion, type PublishedQuiz, type QuestionType, type QuizSettings,
} from '@quiz/shared';
import { prisma } from '../src/core/db';
import { calcXp, ensureBadges } from '../src/core/gamification';
import { gradeAnswer, effectiveScore, scoreAttempt, round2 } from '../src/modules/grading/engine';

/* ───────────── helpers ───────────── */
function mulberry32(a: number) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rnd = mulberry32(20261023);
const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const between = (a: number, b: number) => a + rnd() * (b - a);
const normal = (mu: number, sd: number) => mu + sd * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const id = () => randomUUID();
const NOW = Date.now();
const ago = (days: number, hours = 0) => new Date(NOW - days * 86400000 - hours * 3600000);
const chunk = <T,>(xs: T[], n = 800) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function insertMany<T>(rows: T[], fn: (batch: T[]) => Promise<unknown>) {
  for (const b of chunk(rows)) await fn(b);
}

/* ───────────── reset ───────────── */
async function reset() {
  await prisma.auditLog.deleteMany();
  await prisma.flaggedContent.deleteMany();
  await prisma.dailyChallenge.deleteMany();
  await prisma.review.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.follow.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.result.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.quizVersion.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.quizAssignment.deleteMany();
  await prisma.cohortMember.deleteMany();
  await prisma.cohort.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.section.deleteMany();
  await prisma.quizTag.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.bankQuestion.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

/* ───────────── question DSL ───────────── */
interface QSpec {
  t: QuestionType; text: string; pts?: number; section?: number; expl?: string;
  opts?: string[]; correct?: number[]; partial?: boolean;
  accepted?: string[]; num?: number; tol?: number; rubric?: [string, number][];
}
const mcq = (text: string, opts: string[], correct: number, expl = '', extra: Partial<QSpec> = {}): QSpec => ({ t: 'MCQ_SINGLE', text, opts, correct: [correct], expl, ...extra });
const multi = (text: string, opts: string[], correct: number[], expl = '', partial = true, extra: Partial<QSpec> = {}): QSpec => ({ t: 'MCQ_MULTI', text, opts, correct, expl, partial, pts: 2, ...extra });
const tf = (text: string, answer: boolean, expl = '', extra: Partial<QSpec> = {}): QSpec => ({ t: 'TRUE_FALSE', text, opts: ['True', 'False'], correct: [answer ? 0 : 1], expl, ...extra });
const short = (text: string, accepted: string[], expl = '', extra: Partial<QSpec> = {}): QSpec => ({ t: 'SHORT_ANSWER', text, accepted, expl, ...extra });
const numeric = (text: string, num: number, tol = 0, expl = '', extra: Partial<QSpec> = {}): QSpec => ({ t: 'NUMERIC', text, num, tol, expl, ...extra });
const long = (text: string, rubric: [string, number][], pts = 5, extra: Partial<QSpec> = {}): QSpec => ({ t: 'LONG_ANSWER', text, rubric, pts, ...extra });

interface QuizSpec {
  key: string; title: string; description: string; owner: 'org' | 'ola'; category: string; tags: string[];
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'; status: 'DRAFT' | 'SCHEDULED' | 'LIVE' | 'CLOSED' | 'ARCHIVED';
  visibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE'; settings: Partial<QuizSettings>; sections?: string[]; qs: QSpec[];
  opensAt?: Date | null; closesAt?: Date | null; accessCode?: string;
  /** attempt generation: share of eligible learners who attempted, day window */
  attempts?: { rate: number; from: number; to: number; skill?: number; pop?: 'all' | 'A' | 'B'; pendingRecent?: boolean };
}

const QUIZZES: QuizSpec[] = [
  {
    key: 'js', title: 'JavaScript Fundamentals', description: 'Variables, types, closures and promises — the core of modern JavaScript.',
    owner: 'org', category: 'Programming', tags: ['javascript', 'web'], difficulty: 'MEDIUM', status: 'LIVE', visibility: 'PUBLIC',
    settings: { timeLimitSec: 900, maxAttempts: 2, shuffleQuestions: true, shuffleOptions: true, passMarkPct: 60, showAnswers: 'AFTER_SUBMIT' },
    sections: ['Language basics', 'Functions & async'], opensAt: ago(20),
    attempts: { rate: 0.8, from: 0.2, to: 18, pendingRecent: true },
    qs: [
      mcq('Which keyword declares a block-scoped variable that can be reassigned?', ['let', 'var', 'const', 'function'], 0, '`let` is block scoped and reassignable; `const` cannot be reassigned.'),
      tf('`typeof null` evaluates to "object".', true, 'A long-standing quirk of the language.'),
      multi('Which of these values are falsy?', ['0', '""', '"false"', '[]', 'NaN'], [0, 1, 4], 'Non-empty strings and arrays are truthy.'),
      short('Which built-in method turns a JSON string into an object? (e.g. Object.method)', ['JSON.parse', 'JSON.parse()'], '', { section: 1 }),
      numeric('What does `[1, 2, 3].reduce((a, b) => a + b, 10)` evaluate to?', 16, 0, '10 + 1 + 2 + 3 = 16', { section: 1 }),
      mcq('What happens to `Promise.all` if one of the promises rejects?', ['It waits for the rest and resolves', 'It rejects immediately with that reason', 'It ignores the rejection', 'It retries the promise'], 1, '', { section: 1 }),
      mcq('What is a closure?', ['A function bundled with references to its surrounding scope', 'A way to close a browser tab', 'A private class field', 'A kind of loop'], 0, '', { section: 1 }),
      long('Explain the difference between `==` and `===`, with an example.', [['Describes type coercion', 2], ['Gives a correct example', 2], ['Recommends strict equality', 1]], 5, { section: 0 }),
    ],
  },
  {
    key: 'py', title: 'Python Basics', description: 'A quick check of core Python syntax and built-ins. This round has closed.',
    owner: 'org', category: 'Programming', tags: ['python'], difficulty: 'EASY', status: 'CLOSED', visibility: 'PUBLIC',
    settings: { timeLimitSec: 600, maxAttempts: 1, passMarkPct: 50, showAnswers: 'AFTER_CLOSE' }, opensAt: ago(35), closesAt: ago(4),
    attempts: { rate: 0.92, from: 6, to: 33, skill: 0.04 },
    qs: [
      mcq('Which of these data types is mutable?', ['tuple', 'list', 'str', 'frozenset'], 1),
      tf('Python uses curly braces to delimit blocks of code.', false, 'Indentation defines blocks.'),
      multi('Which can be used as dictionary keys?', ['int', 'str', 'list', 'tuple'], [0, 1, 3], 'Keys must be hashable; lists are not.'),
      short('Which keyword defines a function?', ['def']),
      numeric('What is `len(range(2, 20, 3))`?', 6, 0, '2, 5, 8, 11, 14, 17'),
      mcq("What does `'ab' * 3` evaluate to?", ["'ababab'", "'ab3'", 'Error', "'aaabbb'"], 0),
      mcq('What is the result of `7 // 2`?', ['3.5', '3', '4', '2'], 1, 'Floor division.'),
      tf('`None` is the same as the integer 0.', false),
    ],
  },
  {
    key: 'geo', title: 'World Geography Challenge', description: 'Capitals, oceans and rivers. Take your time — no timer, three attempts.',
    owner: 'org', category: 'General Knowledge', tags: ['geography'], difficulty: 'EASY', status: 'LIVE', visibility: 'PUBLIC',
    settings: { timeLimitSec: null, maxAttempts: 3, shuffleQuestions: true, shuffleOptions: true, passMarkPct: 55, showAnswers: 'AFTER_SUBMIT' }, opensAt: ago(14),
    attempts: { rate: 0.7, from: 0.1, to: 13 },
    qs: [
      mcq('What is the capital of Australia?', ['Sydney', 'Canberra', 'Melbourne', 'Perth'], 1),
      tf('The Sahara is the largest hot desert in the world.', true),
      multi('Which of these countries are in South America?', ['Peru', 'Chile', 'Spain', 'Bolivia', 'Mexico'], [0, 1, 3]),
      numeric('How many continents are there (by the common seven-continent model)?', 7),
      short('Which is the longest river in Africa?', ['Nile', 'The Nile', 'River Nile']),
      mcq('Which is the largest ocean?', ['Atlantic', 'Indian', 'Pacific', 'Arctic'], 2),
      numeric('Roughly what percentage of Earth\'s surface is covered by water? (±3)', 71, 3),
      mcq('Mount Everest lies on the border of Nepal and which country?', ['India', 'China', 'Bhutan', 'Pakistan'], 1),
    ],
  },
  {
    key: 'phys', title: 'Intro to Physics — Mechanics', description: 'Forces, motion and energy. Assigned to Class A. Negative marking applies.',
    owner: 'org', category: 'Science', tags: ['physics', 'mechanics'], difficulty: 'HARD', status: 'LIVE', visibility: 'PRIVATE',
    settings: { timeLimitSec: 1200, maxAttempts: 1, negativeMarking: 0.25, passMarkPct: 55, showAnswers: 'AFTER_CLOSE', showExplanations: true }, opensAt: ago(10),
    attempts: { rate: 0.85, from: 0.2, to: 8, skill: -0.05, pop: 'A', pendingRecent: true },
    qs: [
      mcq('What is the SI unit of force?', ['Joule', 'Newton', 'Watt', 'Pascal'], 1),
      numeric('A 2 kg mass accelerates at 3 m/s². What is the net force in newtons?', 6, 0, 'F = ma'),
      numeric('An object is dropped from rest and falls 19.6 m (g = 9.8 m/s²). How many seconds does it take?', 2, 0.05),
      multi('Which of these are vector quantities?', ['Velocity', 'Force', 'Mass', 'Speed', 'Displacement'], [0, 1, 4], '', true),
      tf('Light travels faster in water than in a vacuum.', false),
      short('Which law is summarised by F = ma?', ["Newton's second law", 'Newtons second law', 'second law', "Newton's 2nd law"]),
      long('Explain why astronauts in orbit feel weightless.', [['Identifies free fall', 3], ['Mentions gravity still acts', 2], ['Clear explanation', 1]], 6),
      long('Describe the energy transformations of a swinging pendulum.', [['Kinetic ↔ potential', 3], ['Mentions energy conservation', 2], ['Notes losses (friction)', 1]], 6),
    ],
  },
  {
    key: 'alg', title: 'Algebra Essentials', description: 'Equations, factoring and quadratics. Join with access code ALGEBRA24.',
    owner: 'ola', category: 'Mathematics', tags: ['algebra', 'maths'], difficulty: 'MEDIUM', status: 'LIVE', visibility: 'UNLISTED', accessCode: 'ALGEBRA24',
    settings: { timeLimitSec: 1500, maxAttempts: 2, passMarkPct: 60, showAnswers: 'AFTER_SUBMIT', gradeBands: [{ label: 'Distinction', minPct: 85 }, { label: 'Merit', minPct: 70 }, { label: 'Pass', minPct: 60 }, { label: 'Fail', minPct: 0 }] },
    opensAt: ago(12), attempts: { rate: 0.55, from: 0.3, to: 11, pop: 'B' },
    qs: [
      numeric('Solve for x: 2x + 6 = 14', 4),
      numeric('What is the larger root of x² − 5x + 6 = 0?', 3),
      mcq('Factor x² − 9.', ['(x − 3)(x − 3)', '(x + 3)(x − 3)', '(x + 9)(x − 1)', 'It cannot be factored'], 1),
      multi('Which values satisfy x² = 9?', ['3', '−3', '9', '0'], [0, 1]),
      short('What is the slope of the line y = 3x + 2? (number only)', ['3']),
      tf('(a + b)² = a² + b²', false, 'It equals a² + 2ab + b².'),
      numeric('Evaluate 3(4 + 2) − 5.', 13),
    ],
  },
  {
    key: 'hist', title: 'Modern History Midterm', description: 'Opens in three days for Class A and Class B.',
    owner: 'ola', category: 'History', tags: ['history'], difficulty: 'MEDIUM', status: 'SCHEDULED', visibility: 'PRIVATE',
    settings: { timeLimitSec: 2400, maxAttempts: 1, passMarkPct: 50, showAnswers: 'AFTER_CLOSE' }, opensAt: ago(-3), closesAt: ago(-3, -48),
    qs: [
      mcq('In which year did the Second World War end?', ['1943', '1945', '1947', '1950'], 1),
      tf('The Berlin Wall fell in 1989.', true),
      multi('Which of these were founding members of the United Nations (1945)?', ['France', 'Germany', 'United States', 'China'], [0, 2, 3]),
      short('Which treaty ended the First World War with Germany (1919)?', ['Treaty of Versailles', 'Versailles']),
      long('Discuss two causes of the Cold War.', [['Identifies two causes', 4], ['Supports with evidence', 4], ['Structure and clarity', 2]], 10),
    ],
  },
  {
    key: 'ds', title: 'Data Structures (draft)', description: 'Work in progress — arrays, stacks and queues.',
    owner: 'ola', category: 'Programming', tags: ['algorithms'], difficulty: 'MEDIUM', status: 'DRAFT', visibility: 'PRIVATE',
    settings: { timeLimitSec: 1200, maxAttempts: 1 },
    qs: [
      mcq('Which structure is LIFO?', ['Queue', 'Stack', 'Heap', 'Graph'], 1),
      numeric('What is the worst-case number of comparisons to binary search 16 sorted items (rounded up)?', 5, 0, 'ceil(log2(17)) = 5'),
      long('Compare arrays and linked lists.', [['Access time', 2], ['Insert/delete cost', 2]], 4),
    ],
  },
  {
    key: 'net', title: 'Intro to Networking', description: 'Archived — last semester\'s quiz on the OSI model and TCP/IP.',
    owner: 'ola', category: 'Programming', tags: ['networking'], difficulty: 'MEDIUM', status: 'ARCHIVED', visibility: 'PUBLIC',
    settings: { timeLimitSec: 900, maxAttempts: 1, passMarkPct: 55, showAnswers: 'AFTER_SUBMIT' }, opensAt: ago(120), closesAt: ago(100),
    attempts: { rate: 0.5, from: 100, to: 118 },
    qs: [
      mcq('Which OSI layer does IP operate at?', ['Data link', 'Network', 'Transport', 'Session'], 1),
      mcq('Which protocol resolves domain names to IP addresses?', ['DHCP', 'DNS', 'ARP', 'FTP'], 1),
      tf('TCP is a connectionless protocol.', false),
      numeric('How many bits are in an IPv4 address?', 32),
      short('What does HTTP stand for? (first word only)', ['Hypertext', 'HyperText']),
      multi('Which are transport-layer protocols?', ['TCP', 'UDP', 'IP', 'HTTP'], [0, 1]),
    ],
  },
  {
    key: 'brain', title: 'Daily Brain Teasers', description: 'Five quick puzzles. Today\'s daily challenge.',
    owner: 'org', category: 'General Knowledge', tags: ['puzzle', 'logic'], difficulty: 'EASY', status: 'LIVE', visibility: 'PUBLIC',
    settings: { timeLimitSec: 300, maxAttempts: 5, shuffleOptions: true, passMarkPct: 60, showAnswers: 'AFTER_SUBMIT' }, opensAt: ago(30),
    attempts: { rate: 0.6, from: 0.1, to: 25, skill: 0.03 },
    qs: [
      mcq('What comes next: 2, 4, 8, 16, …?', ['24', '32', '30', '64'], 1),
      numeric('If a bat and ball cost $1.10 together and the bat costs $1.00 more than the ball, how many cents is the ball?', 5),
      tf('A kilogram of feathers weighs the same as a kilogram of steel.', true),
      mcq('How many months have 28 days?', ['1', '2', '6', '12'], 3, 'All of them have at least 28.'),
      short('What has keys but can\'t open locks?', ['piano', 'a piano', 'keyboard', 'a keyboard']),
    ],
  },
];

/* ───────────── answer generation ───────────── */
const LONG_TEXTS = [
  'It is about how the values are compared. The loose form converts types first, so 0 == "0" is true, while the strict form also checks the type, so 0 === "0" is false. I always prefer strict equality.',
  'Both compare values, but one of them coerces. For example 1 == "1" is true but 1 === "1" is false.',
  'Weightlessness happens because they are in free fall around the Earth. Gravity is still acting on them, they just fall together with the spacecraft.',
  'There is no gravity in space so nothing pulls them down.',
  'At the top of the swing the bob has maximum potential energy; at the bottom it is mostly kinetic. Total energy is conserved apart from small losses to friction and air resistance.',
  'The pendulum goes back and forth and the energy changes from one kind to another.',
  'The Cold War started because of the rivalry between two superpowers and mistrust after the war, for instance the arms race and disagreements over Eastern Europe.',
];
const WRONG_TEXTS = ['not sure', 'pandas', 'json', 'jsonparse', 'foo', 'bar'];

function genAnswer(q: PublishedQuestion, pCorrect: number): AnswerValue | null {
  if (rnd() < 0.04 && q.type !== 'LONG_ANSWER') return null; // skipped
  const right = rnd() < pCorrect;
  const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
  const wrongIds = q.options.filter((o) => !o.isCorrect).map((o) => o.id);
  switch (q.type) {
    case 'MCQ_SINGLE': case 'TRUE_FALSE':
      // first distractor is the popular wrong answer
      return { optionIds: [right ? correctIds[0] : rnd() < 0.55 ? wrongIds[0] : pick(wrongIds)] };
    case 'MCQ_MULTI': {
      if (right) return { optionIds: correctIds };
      const set = new Set(correctIds);
      if (rnd() < 0.5 && set.size > 1) set.delete(pick([...set]));
      if (rnd() < 0.6) set.add(pick(wrongIds));
      return { optionIds: [...set] };
    }
    case 'SHORT_ANSWER': return { text: right ? pick(q.config.acceptedAnswers) : pick(WRONG_TEXTS) };
    case 'NUMERIC': return { number: right ? q.config.numericAnswer! : q.config.numericAnswer! + pick([-2, -1, 1, 2, 10]) };
    case 'LONG_ANSWER': return { text: right ? pick(LONG_TEXTS.filter((_, i) => i % 2 === 0)) : pick(LONG_TEXTS.filter((_, i) => i % 2 === 1)) };
  }
}

/* ───────────── main ───────────── */
async function main() {
  console.log('Resetting tables…');
  await reset();
  await ensureBadges();

  /* users */
  const hash = { admin: bcrypt.hashSync('Admin#12345', 10), org: bcrypt.hashSync('Organizer#12345', 10), part: bcrypt.hashSync('Participant#12345', 10) };
  const names = ['Avery Brooks', 'Blake Nguyen', 'Casey Patel', 'Drew Okafor', 'Emery Silva', 'Finley Kim', 'Gray Romero', 'Harper Lee', 'Indigo Fox', 'Jules Moreau', 'Kai Tanaka', 'Logan Reyes',
    'Morgan Diaz', 'Noel Haddad', 'Oakley Chen', 'Parker Singh', 'Quinn Alvarez', 'Reese Walker', 'Sage Dubois', 'Tatum Berg', 'Uma Joshi', 'Vale Costa', 'Wren Ito', 'Xan Petrov'];
  type U = { id: string; username: string };
  const mk = (username: string, email: string, name: string, role: 'ADMIN' | 'ORGANIZER' | 'PARTICIPANT', ph: string, createdDaysAgo: number) =>
    ({ id: id(), username, email, name, role, passwordHash: ph, createdAt: ago(createdDaysAgo) });
  const adminU = mk('admin', 'admin@quizzo.dev', 'Alex Admin', 'ADMIN', hash.admin, 90);
  const orgU = mk('organizer', 'organizer@quizzo.dev', 'Olivia Organizer', 'ORGANIZER', hash.org, 80);
  const olaU = mk('ola', 'ola@quizzo.dev', 'Ola Adeyemi', 'ORGANIZER', hash.org, 70);
  const demoU = mk('participant', 'participant@quizzo.dev', 'Parker Participant', 'PARTICIPANT', hash.part, 60);
  const learners = names.map((n, i) => mk(`learner${String(i + 1).padStart(2, '0')}`, `learner${String(i + 1).padStart(2, '0')}@quizzo.dev`, n, 'PARTICIPANT', hash.part, Math.floor(between(2, 55))));
  const allUsers = [adminU, orgU, olaU, demoU, ...learners];
  await prisma.user.createMany({ data: allUsers });
  const P: U[] = [demoU, ...learners]; // 25 participants
  const skill = new Map(P.map((u, i) => [u.id, i === 0 ? 0.78 : clamp(normal(0.66, 0.17), 0.25, 0.97)]));
  const owner = { org: orgU, ola: olaU };

  /* taxonomy */
  const catNames = ['Programming', 'Science', 'Mathematics', 'History', 'General Knowledge'];
  const cats = await Promise.all(catNames.map((name) => prisma.category.create({ data: { name, slug: name.toLowerCase().replace(/\s+/g, '-') } })));
  const catId = new Map(cats.map((c) => [c.name, c.id]));
  const tagNames = [...new Set(QUIZZES.flatMap((q) => q.tags))];
  const tags = await Promise.all(tagNames.map((name) => prisma.tag.create({ data: { name } })));
  const tagId = new Map(tags.map((t) => [t.name, t.id]));

  /* cohorts */
  const classA = await prisma.cohort.create({ data: { ownerId: orgU.id, name: 'Class A — Spring', description: 'Morning group' } });
  const classB = await prisma.cohort.create({ data: { ownerId: orgU.id, name: 'Class B — Spring', description: 'Afternoon group' } });
  const evening = await prisma.cohort.create({ data: { ownerId: olaU.id, name: 'Evening Cohort', description: 'Part-time learners' } });
  const popA = P.slice(0, 13);
  const popB = P.slice(13);
  await prisma.cohortMember.createMany({
    data: [...popA.map((u) => ({ cohortId: classA.id, userId: u.id })), ...popB.map((u) => ({ cohortId: classB.id, userId: u.id })),
      ...P.filter((_, i) => i % 3 === 0).map((u) => ({ cohortId: evening.id, userId: u.id }))],
  });

  /* quizzes, structure, versions */
  const built = new Map<string, { spec: QuizSpec; quizId: string; snap: PublishedQuiz | null; ownerId: string; settings: QuizSettings }>();
  for (const spec of QUIZZES) {
    const quizId = id();
    const ownerId = owner[spec.owner].id;
    const settings = quizSettingsSchema.parse(spec.settings);
    const sectionRows = (spec.sections ?? []).map((title, position) => ({ id: id(), quizId, title, description: '', position }));
    const qRows = spec.qs.map((q, position) => ({
      id: id(), quizId, sectionId: q.section !== undefined ? sectionRows[q.section]?.id ?? null : null, type: q.t, text: q.text,
      explanation: q.expl ?? '', points: q.pts ?? (q.t === 'LONG_ANSWER' ? 5 : 1), position,
      config: questionConfigSchema.parse({
        partialCredit: q.partial ? 'proportional' : 'none', acceptedAnswers: q.accepted ?? [], numericAnswer: q.num ?? null, tolerance: q.tol ?? 0,
        rubric: (q.rubric ?? []).map(([criterion, maxPoints]) => ({ criterion, maxPoints })),
      }),
    }));
    const oRows = qRows.flatMap((qr, qi) => (spec.qs[qi].opts ?? []).map((text, position) => ({
      id: id(), questionId: qr.id, text, isCorrect: (spec.qs[qi].correct ?? []).includes(position), position,
    })));
    const published = spec.status !== 'DRAFT';
    const snap: PublishedQuiz | null = published ? {
      quizId, number: 1, title: spec.title, settings,
      sections: sectionRows.map((s) => ({ id: s.id, title: s.title, position: s.position })),
      questions: qRows.map((qr): PublishedQuestion => ({
        id: qr.id, type: qr.type, text: qr.text, explanation: qr.explanation, points: qr.points, sectionId: qr.sectionId, position: qr.position, config: qr.config,
        options: oRows.filter((o) => o.questionId === qr.id).map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
      })).sort((a, b) => {
        const sa = sectionRows.findIndex((s) => s.id === a.sectionId); const sb = sectionRows.findIndex((s) => s.id === b.sectionId);
        return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb) || a.position - b.position;
      }),
      totalPoints: qRows.reduce((s, q) => s + q.points, 0),
    } : null;
    const versionId = snap ? id() : null;
    await prisma.quiz.create({
      data: {
        id: quizId, ownerId, title: spec.title, description: spec.description, categoryId: catId.get(spec.category)!, difficulty: spec.difficulty,
        status: spec.status, visibility: spec.visibility, accessCode: spec.accessCode ?? null, settings: settings as unknown as Prisma.InputJsonValue,
        opensAt: spec.opensAt ?? null, closesAt: spec.closesAt ?? null, currentVersionId: versionId, createdAt: ago(spec.status === 'DRAFT' ? 3 : 40),
        tags: { create: spec.tags.map((t) => ({ tagId: tagId.get(t)! })) },
      },
    });
    await prisma.section.createMany({ data: sectionRows });
    await prisma.question.createMany({ data: qRows.map((q) => ({ ...q, config: q.config as unknown as Prisma.InputJsonValue })) });
    await prisma.option.createMany({ data: oRows });
    if (snap && versionId) {
      await prisma.quizVersion.create({ data: { id: versionId, quizId, number: 1, snapshot: snap as unknown as Prisma.InputJsonValue, publishedById: ownerId, createdAt: ago(spec.opensAt ? Math.max(0, (NOW - spec.opensAt.getTime()) / 86400000) : 5) } });
    }
    built.set(spec.key, { spec, quizId, snap, ownerId, settings });
  }

  /* assignments & invitations */
  await prisma.quizAssignment.createMany({
    data: [
      { quizId: built.get('phys')!.quizId, cohortId: classA.id },
      { quizId: built.get('hist')!.quizId, cohortId: classA.id },
      { quizId: built.get('hist')!.quizId, cohortId: classB.id },
      { quizId: built.get('alg')!.quizId, cohortId: evening.id },
    ],
  });
  await prisma.invitation.createMany({
    data: [{ quizId: built.get('alg')!.quizId, userId: demoU.id }, ...P.slice(13, 20).map((u) => ({ quizId: built.get('alg')!.quizId, userId: u.id }))],
    skipDuplicates: true,
  });

  /* attempts */
  const A: Prisma.AttemptCreateManyInput[] = [];
  const ANS: Prisma.AnswerCreateManyInput[] = [];
  const GR: Prisma.GradeCreateManyInput[] = [];
  const RES: Prisma.ResultCreateManyInput[] = [];
  const attemptCount = new Map<string, number>(); // `${quiz}:${user}` → used numbers
  interface FinalRec { userId: string; quizId: string; pct: number; passed: boolean; durationSec: number | null; timeLimitSec: number | null; at: number }
  const finals: FinalRec[] = [];

  function addAttempt(b: { quizId: string; snap: PublishedQuiz; settings: QuizSettings; ownerId: string }, user: U, o: {
    startedAt: Date; inProgress?: boolean; skill: number; pendingLong?: boolean; versionId: string;
  }) {
    const key = `${b.quizId}:${user.id}`;
    const number = (attemptCount.get(key) ?? 0) + 1;
    attemptCount.set(key, number);
    const attemptId = id();
    const limit = b.settings.timeLimitSec;
    const nQ = b.snap.questions.length;
    const order = (b.settings.shuffleQuestions ? [...b.snap.questions].sort(() => rnd() - 0.5) : b.snap.questions).map((q) => q.id);
    const duration = limit ? Math.round(limit * between(0.35, 0.95)) : Math.round(between(240, 1100));
    const submittedAt = new Date(o.startedAt.getTime() + duration * 1000);
    const expiresAt = limit ? new Date(o.startedAt.getTime() + limit * 1000) : null;

    if (o.inProgress) {
      const answered = Math.max(1, Math.floor(nQ * between(0.2, 0.7)));
      A.push({ id: attemptId, quizId: b.quizId, versionId: o.versionId, userId: user.id, number, status: 'IN_PROGRESS', startedAt: o.startedAt, expiresAt, questionOrder: order, optionOrder: {}, tabSwitches: Math.floor(rnd() * 3), lastSeenAt: new Date(NOW - between(5, 90) * 1000) });
      for (const q of b.snap.questions.filter((q) => order.indexOf(q.id) < answered && q.type !== 'LONG_ANSWER')) {
        const v = genAnswer(q, o.skill);
        if (v) ANS.push({ id: id(), attemptId, questionId: q.id, value: v as Prisma.InputJsonValue, flagged: rnd() < 0.1, timeSpentMs: Math.round(between(8, 70) * 1000) });
      }
      return;
    }

    const eff: Record<string, { score: number; pending: boolean }> = {};
    let hasManual = false;
    const perQ = (duration * 1000) / nQ;
    const gradedAt = new Date(submittedAt.getTime() + between(2, 30) * 3600000);
    for (const q of b.snap.questions) {
      const diff = ((q.position * 37) % 7 - 3) / 20; // −0.15..+0.15 inherent difficulty
      const val = genAnswer(q, clamp(o.skill + diff, 0.05, 0.98));
      const answerId = id();
      ANS.push({ id: answerId, attemptId, questionId: q.id, value: (val ?? {}) as Prisma.InputJsonValue, flagged: rnd() < 0.06, timeSpentMs: Math.round(perQ * between(0.4, 1.6)) });
      const out = gradeAnswer(q, val, b.settings);
      if (out.needsManual) {
        hasManual = true;
        const manualDone = !o.pendingLong;
        const manual = manualDone ? round2(q.points * clamp(normal(0.7, 0.2), 0.1, 1)) : null;
        GR.push({
          id: id(), answerId, maxScore: out.maxScore, autoScore: 0, manualScore: manual, needsManual: true, isCorrect: null,
          feedback: manualDone ? pick(['Good reasoning, a little more detail would help.', 'Clear and correct.', 'Partly right — revisit the key idea.', 'Nice example.']) : '',
          graderId: manualDone ? b.ownerId : null, gradedAt: manualDone ? gradedAt : null,
          rubricScores: manualDone && q.config.rubric.length ? (q.config.rubric.map((r) => round2(r.maxPoints * (manual! / q.points))) as Prisma.InputJsonValue) : undefined,
        });
      } else {
        GR.push({ id: id(), answerId, maxScore: out.maxScore, autoScore: out.score, needsManual: false, isCorrect: out.isCorrect, feedback: '' });
      }
      const g = GR[GR.length - 1];
      eff[q.id] = effectiveScore({ autoScore: g.autoScore ?? null, manualScore: g.manualScore ?? null, needsManual: !!g.needsManual });
    }
    const totals = scoreAttempt(b.snap.questions, eff, b.settings);
    const pending = hasManual && totals.pending;
    A.push({
      id: attemptId, quizId: b.quizId, versionId: o.versionId, userId: user.id, number, status: pending ? 'SUBMITTED' : 'GRADED', startedAt: o.startedAt, expiresAt,
      submittedAt, durationSec: duration, questionOrder: order, optionOrder: {}, tabSwitches: rnd() < 0.7 ? Math.floor(rnd() * 3) : Math.floor(rnd() * 9), blurSeconds: Math.floor(rnd() * 40), lastSeenAt: submittedAt,
    });
    RES.push({
      id: id(), attemptId, quizId: b.quizId, userId: user.id, score: totals.score, maxScore: totals.maxScore, percentage: totals.percentage,
      band: totals.band, passed: totals.passed, isFinal: !pending, createdAt: submittedAt,
    });
    if (!pending) finals.push({ userId: user.id, quizId: b.quizId, pct: totals.percentage, passed: totals.passed, durationSec: duration, timeLimitSec: limit, at: submittedAt.getTime() });
  }

  const versionIds = new Map<string, string>();
  for (const [k, b] of built) if (b.snap) versionIds.set(k, (await prisma.quizVersion.findFirstOrThrow({ where: { quizId: b.quizId } })).id);

  for (const [key, b] of built) {
    const cfg = b.spec.attempts;
    if (!cfg || !b.snap) continue;
    const pop = cfg.pop === 'A' ? popA.slice(1) : cfg.pop === 'B' ? popB : P;
    let forcedRecent = 0;
    for (const u of pop) {
      const demoForced = u.id === demoU.id && (key === 'js' || key === 'py' || key === 'brain');
      if (!demoForced && rnd() > cfg.rate) continue;
      if (u.id === demoU.id && key === 'geo') continue; // demo user has an in-progress attempt there (below)
      const n = rnd() < 0.25 && b.settings.maxAttempts > 1 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const forceRecent = !!cfg.pendingRecent && i === 0 && !demoForced && forcedRecent < 3 && ++forcedRecent > 0;
        const days = forceRecent ? between(0.15, 1.2) : i === 0 ? between(cfg.from, cfg.to) : between(cfg.from, Math.max(cfg.from + 0.01, cfg.from + (cfg.to - cfg.from) / 2));
        const startedAt = ago(demoForced && i === 0 && key !== 'brain' ? Math.max(days, 2.2) : days);
        const recent = NOW - startedAt.getTime() < 36 * 3600000;
        const s = clamp((skill.get(u.id) ?? 0.65) + (cfg.skill ?? 0) + (i ? 0.06 : 0), 0.2, 0.97);
        addAttempt({ quizId: b.quizId, snap: b.snap, settings: b.settings, ownerId: b.ownerId }, u, {
          startedAt, skill: s, versionId: versionIds.get(key)!, pendingLong: !!cfg.pendingRecent && recent && !(demoForced),
        });
      }
    }
  }
  // a few in-progress attempts on live quizzes (demo participant on geography)
  const inprog: [string, U][] = [['geo', demoU], ['js', learners[4]], ['js', learners[9]], ['phys', learners[2]], ['brain', learners[14]], ['geo', learners[17]]];
  for (const [key, u] of inprog) {
    const b = built.get(key)!;
    if ((attemptCount.get(`${b.quizId}:${u.id}`) ?? 0) >= b.settings.maxAttempts) continue;
    const limit = b.settings.timeLimitSec;
    const startedAt = new Date(NOW - (limit ? Math.min(limit * 0.4, 600) : 420) * 1000);
    addAttempt({ quizId: b.quizId, snap: b.snap!, settings: b.settings, ownerId: b.ownerId }, u, { startedAt, inProgress: true, skill: skill.get(u.id) ?? 0.6, versionId: versionIds.get(key)! });
  }
  console.log(`Inserting ${A.length} attempts, ${ANS.length} answers…`);
  await insertMany(A, (d) => prisma.attempt.createMany({ data: d }));
  await insertMany(ANS, (d) => prisma.answer.createMany({ data: d }));
  await insertMany(GR, (d) => prisma.grade.createMany({ data: d }));
  await insertMany(RES, (d) => prisma.result.createMany({ data: d }));

  /* gamification (computed in memory: first final result per user+quiz earns XP) */
  const firstFinal = new Map<string, FinalRec>();
  for (const f of finals.sort((a, b) => a.at - b.at)) if (!firstFinal.has(`${f.userId}:${f.quizId}`)) firstFinal.set(`${f.userId}:${f.quizId}`, f);
  const badgeRows = await prisma.badge.findMany();
  const badgeId = new Map(badgeRows.map((x) => [x.key, x.id]));
  const userBadges: Prisma.UserBadgeCreateManyInput[] = [];
  for (const u of P) {
    const mine = [...firstFinal.values()].filter((f) => f.userId === u.id);
    const xp = mine.reduce((s, f) => s + calcXp(f.pct, f.passed, f.durationSec, f.timeLimitSec), 0);
    const streak = mine.length >= 5 ? Math.floor(between(1, 8)) : mine.length ? Math.floor(between(0, 3)) : 0;
    const keys = new Set<string>();
    if (mine.length >= 1) keys.add('first_quiz');
    if (mine.length >= 5) keys.add('five_quizzes');
    if (mine.length >= 10) keys.add('ten_quizzes');
    if (mine.some((f) => f.pct >= 100)) keys.add('perfect');
    if (mine.filter((f) => f.passed && f.pct >= 90).length >= 3) keys.add('high_achiever');
    if (mine.some((f) => f.passed && f.timeLimitSec && f.durationSec != null && f.durationSec < f.timeLimitSec / 2)) keys.add('speedster');
    if (streak >= 3) keys.add('streak_3');
    if (streak >= 7) keys.add('streak_7');
    await prisma.user.update({ where: { id: u.id }, data: { xp, tier: tierFor(xp), streakDays: streak, lastActiveOn: streak ? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())) : null } });
    for (const k of keys) if (badgeId.has(k)) userBadges.push({ userId: u.id, badgeId: badgeId.get(k)!, awardedAt: ago(between(0.5, 20)) });
  }
  await prisma.userBadge.createMany({ data: userBadges, skipDuplicates: true });

  /* reviews, follows, bank, daily challenge, flags, audit */
  const reviewRows: Prisma.ReviewCreateManyInput[] = [];
  const seen = new Set<string>();
  const comments = ['Well put together and fair.', 'Good difficulty curve.', 'A couple of questions were tricky but fair.', 'Loved the explanations.', 'Great quick practice.', 'Would like more questions.', 'Clear wording, thanks!', ''];
  for (const r of RES.filter((x) => x.isFinal)) {
    const k = `${r.quizId}:${r.userId}`;
    if (seen.has(k) || rnd() > 0.35) continue;
    seen.add(k);
    reviewRows.push({ id: id(), quizId: r.quizId, userId: r.userId, rating: clamp(Math.round(normal(4.1, 0.8)), 1, 5), comment: pick(comments), createdAt: ago(between(0.2, 15)) });
  }
  await prisma.review.createMany({ data: reviewRows });

  const follows = new Set<string>();
  while (follows.size < 45) { const a = pick(allUsers), b = pick(allUsers); if (a.id !== b.id) follows.add(`${a.id}|${b.id}`); }
  await prisma.follow.createMany({ data: [...follows].map((s) => { const [followerId, followingId] = s.split('|'); return { followerId, followingId }; }) });

  const bank: Prisma.BankQuestionCreateManyInput[] = [];
  const addBank = (ownerId: string, category: string, tagsList: string[], q: QSpec) => bank.push({
    id: id(), ownerId, categoryId: catId.get(category)!, type: q.t, text: q.text, explanation: q.expl ?? '', points: q.pts ?? (q.t === 'LONG_ANSWER' ? 5 : 1), tags: tagsList,
    options: (q.opts ?? []).map((text, i) => ({ text, isCorrect: (q.correct ?? []).includes(i) })) as Prisma.InputJsonValue,
    config: questionConfigSchema.parse({
      partialCredit: q.partial ? 'proportional' : 'none', acceptedAnswers: q.accepted ?? [], numericAnswer: q.num ?? null, tolerance: q.tol ?? 0,
      rubric: (q.rubric ?? []).map(([criterion, maxPoints]) => ({ criterion, maxPoints })),
    }) as unknown as Prisma.InputJsonValue,
  });
  const org = (k: string) => QUIZZES.find((q) => q.key === k)!;
  for (const q of org('js').qs.slice(0, 6)) addBank(orgU.id, 'Programming', ['javascript'], q);
  for (const q of org('geo').qs.slice(0, 4)) addBank(orgU.id, 'General Knowledge', ['geography'], q);
  for (const q of org('phys').qs.slice(0, 3)) addBank(orgU.id, 'Science', ['physics'], q);
  for (const q of org('alg').qs.slice(0, 4)) addBank(olaU.id, 'Mathematics', ['algebra'], q);
  await prisma.bankQuestion.createMany({ data: bank });

  const brain = built.get('brain')!.quizId;
  await prisma.dailyChallenge.createMany({
    data: [0, 1, 2].map((d, i) => ({ date: new Date(Date.UTC(new Date(ago(d)).getUTCFullYear(), new Date(ago(d)).getUTCMonth(), new Date(ago(d)).getUTCDate())), quizId: [brain, built.get('geo')!.quizId, brain][i], xpBonus: 50 })),
  });

  const aReview = reviewRows.find((r) => r.comment === 'Would like more questions.') ?? reviewRows[0];
  await prisma.flaggedContent.createMany({
    data: [
      { reporterId: P[3].id, entityType: 'QUIZ', entityId: built.get('brain')!.quizId, reason: 'Question 2 looks like a duplicate of a well-known puzzle.' },
      ...(aReview ? [{ reporterId: P[7].id, entityType: 'REVIEW', entityId: aReview.id as string, reason: 'Review reads like spam.' }] : []),
    ],
  });

  const audits: Prisma.AuditLogCreateManyInput[] = [];
  for (const u of allUsers) audits.push({ actorId: u.id, action: 'auth.register', entityType: 'User', entityId: u.id, createdAt: u.createdAt, ip: '127.0.0.1' });
  for (const [, b] of built) {
    if (b.snap) audits.push({ actorId: b.ownerId, action: 'quiz.publish', entityType: 'Quiz', entityId: b.quizId, meta: { version: 1 }, createdAt: ago(between(1, 30)), ip: '127.0.0.1' });
    else audits.push({ actorId: b.ownerId, action: 'quiz.create', entityType: 'Quiz', entityId: b.quizId, createdAt: ago(3), ip: '127.0.0.1' });
  }
  audits.push(
    { actorId: adminU.id, action: 'admin.user_update', entityType: 'User', entityId: olaU.id, meta: { to: { role: 'ORGANIZER' } }, createdAt: ago(70), ip: '127.0.0.1' },
    { actorId: adminU.id, action: 'admin.quiz_update', entityType: 'Quiz', entityId: built.get('net')!.quizId, meta: { to: { status: 'ARCHIVED' } }, createdAt: ago(60), ip: '127.0.0.1' },
    { actorId: orgU.id, action: 'quiz.close', entityType: 'Quiz', entityId: built.get('py')!.quizId, createdAt: ago(4), ip: '127.0.0.1' },
    { actorId: orgU.id, action: 'report.export_csv', entityType: 'Quiz', entityId: built.get('py')!.quizId, createdAt: ago(3), ip: '127.0.0.1' },
  );
  await prisma.auditLog.createMany({ data: audits });

  const pendingCount = RES.filter((r) => !r.isFinal).length;
  console.log(`Seeded: ${allUsers.length} users, ${built.size} quizzes, ${A.length} attempts (${A.filter((a) => a.status === 'IN_PROGRESS').length} in progress, ${pendingCount} awaiting grading), ${reviewRows.length} reviews.`);
  console.log('\nDemo accounts:\n  admin@quizzo.dev / Admin#12345\n  organizer@quizzo.dev, ola@quizzo.dev / Organizer#12345\n  participant@quizzo.dev, learner01..24@quizzo.dev / Participant#12345');
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
