import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { listCompanyIdsWithCourse, removeCourseFromCompany } from '@/lib/firestore/admin';
import type {
  ContentAudience,
  CourseIntroVideo,
  ModuleContent,
  ModuleMaterialLink,
  ModuleStep,
  ModuleStepKind,
  QuestionDef,
} from '@/types';
import { getCourse, listModules } from '@/lib/firestore/courses';

export type DraftQuestion = QuestionDef & { correctOptionIndex?: number };

export type DraftStep = {
  localKey: string;
  id: string;
  title: string;
  order: number;
  kind: ModuleStepKind;
  body: string;
  vimeoUrl: string;
  /** Quem vê o passo inteiro (além do módulo). */
  audience: ContentAudience;
  /** Vazio → mesmas regras de nível/área do módulo. */
  visibleToRoles: string[];
  visibleToDepartments: string[];
  materials: ModuleMaterialLink[];
  questions: DraftQuestion[];
};

export type DraftModule = {
  localKey: string;
  firestoreId?: string;
  title: string;
  order: number;
  content: string;
  vimeoUrl: string;
  pdfUrl: string;
  audience: ContentAudience;
  visibleToRoles: string[];
  visibleToDepartments: string[];
  questions: DraftQuestion[];
  steps: DraftStep[];
};

/** Linha no editor: URL obrigatória para salvar; título opcional na home. */
export type DraftIntroVideo = { url: string; title: string };

export type CourseDraft = {
  title: string;
  description: string;
  /** Texto longo na home pública (“Sobre o curso”). */
  about: string;
  /** Vídeos Vimeo na home (1º = card da lista; todos na vista expandida). */
  introVimeoUrls: DraftIntroVideo[];
  /** Capa estática do card “Programas” (URL absoluta; upload opcional no admin). */
  catalogCardImageUrl: string;
  /** Listar na home sem login (requer regra `catalogPublished` no Firestore). */
  catalogPublished: boolean;
  /** Canal público (`/canal/:id`); vazio = só em Programas. */
  channelId: string;
  modules: DraftModule[];
};

function newLocalKey(): string {
  return crypto.randomUUID();
}

function stepToDraft(s: ModuleStep): DraftStep {
  return {
    localKey: newLocalKey(),
    id: s.id,
    title: s.title,
    order: s.order,
    kind: s.kind,
    body: s.body ?? '',
    vimeoUrl: s.vimeoUrl ?? '',
    audience: s.audience ?? 'all',
    visibleToRoles: s.visibleToRoles ?? [],
    visibleToDepartments: s.visibleToDepartments ?? [],
    materials: s.materials?.length
      ? s.materials.map((m) => ({
          title: m.title,
          description: m.description ?? '',
          pdfUrl: m.pdfUrl,
          audience: m.audience ?? 'all',
        }))
      : [],
    questions: (s.questions ?? []).map((q) => ({
      ...q,
      audience: q.audience ?? 'all',
      correctOptionIndex: undefined,
    })),
  };
}

function moduleToDraft(m: ModuleContent, correctByQuestionId: Record<string, number>): DraftModule {
  const applyCorrect = (q: QuestionDef): DraftQuestion => ({
    ...q,
    correctOptionIndex: correctByQuestionId[q.id],
  });
  return {
    localKey: newLocalKey(),
    firestoreId: m.id,
    title: m.title,
    order: m.order,
    content: m.content ?? '',
    vimeoUrl: m.vimeoUrl ?? '',
    pdfUrl: m.pdfUrl ?? '',
    audience: m.audience ?? 'all',
    visibleToRoles: m.visibleToRoles ?? [],
    visibleToDepartments: m.visibleToDepartments ?? [],
    questions: [],
    steps: (m.steps ?? []).map((s) => {
      const d = stepToDraft(s);
      return {
        ...d,
        questions: (s.questions ?? []).map((q) => applyCorrect({ ...q, audience: q.audience ?? 'all' })),
      };
    }),
  };
}

async function fetchAnswerKeyMap(
  courseId: string,
  moduleId: string
): Promise<Record<string, number>> {
  const snap = await getDoc(doc(db, 'answerKeys', `${courseId}__${moduleId}`));
  if (!snap.exists()) return {};
  const raw = snap.data().correctByQuestionId;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}

export async function loadCourseDraft(courseId: string): Promise<CourseDraft> {
  const course = await getCourse(courseId);
  if (!course) throw new Error('Curso não encontrado.');
  const modules = await listModules(courseId);
  const withKeys = await Promise.all(
    modules.map(async (m) => moduleToDraft(m, await fetchAnswerKeyMap(courseId, m.id)))
  );
  return {
    title: course.title,
    description: course.description ?? '',
    about: course.about ?? '',
    introVimeoUrls: course.introVimeoUrls?.length
      ? course.introVimeoUrls.map((v) => ({
          url: v.url,
          title: v.title?.trim() ?? '',
        }))
      : [],
    catalogCardImageUrl: course.catalogCardImageUrl?.trim() ?? '',
    catalogPublished: course.catalogPublished === true,
    channelId: course.channelId?.trim() ?? '',
    modules: withKeys.sort((a, b) => a.order - b.order),
  };
}

/** Remove opções em branco e realinha o índice da resposta correta ao salvar. */
function normalizedQuestionForSave(q: DraftQuestion): {
  def: QuestionDef;
  correctOptionIndex?: number;
} {
  const trimmed = q.options.map((o) => o.trim());
  const options: string[] = [];
  const oldToNew = new Map<number, number>();
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i]) {
      oldToNew.set(i, options.length);
      options.push(trimmed[i]);
    }
  }
  let correctOptionIndex: number | undefined;
  if (typeof q.correctOptionIndex === 'number') {
    const mapped = oldToNew.get(q.correctOptionIndex);
    if (typeof mapped === 'number') correctOptionIndex = mapped;
  }
  const def: QuestionDef = { id: q.id, prompt: q.prompt.trim(), options };
  if (q.audience && q.audience !== 'all') def.audience = q.audience;
  return {
    def,
    correctOptionIndex,
  };
}

function stripQuestion(q: DraftQuestion): QuestionDef {
  return normalizedQuestionForSave(q).def;
}

function serializeStep(s: DraftStep): ModuleStep {
  const base: ModuleStep = {
    id: s.id.trim() || newLocalKey(),
    title: s.title.trim(),
    order: s.order,
    kind: s.kind,
  };
  if (s.audience && s.audience !== 'all') base.audience = s.audience;
  if (s.visibleToRoles.length) base.visibleToRoles = [...s.visibleToRoles];
  if (s.visibleToDepartments.length) base.visibleToDepartments = [...s.visibleToDepartments];
  const body = s.body.trim();
  if (body) base.body = body;
  if (s.kind === 'video') {
    const u = s.vimeoUrl.trim();
    if (u) base.vimeoUrl = u;
  }
  if (s.kind === 'materials' && s.materials.length) {
    base.materials = s.materials
      .filter((m) => m.title.trim() && m.pdfUrl.trim())
      .map((m) => {
        const link: ModuleMaterialLink = {
          title: m.title.trim(),
          description: m.description.trim(),
          pdfUrl: m.pdfUrl.trim(),
        };
        if (m.audience && m.audience !== 'all') link.audience = m.audience;
        return link;
      });
  }
  if (s.kind === 'quiz' && s.questions.length) {
    base.questions = s.questions.map(stripQuestion);
  }
  return base;
}

function collectCorrectByQuestionId(mod: DraftModule): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of mod.steps) {
    if (s.kind !== 'quiz') continue;
    for (const q of s.questions) {
      const { correctOptionIndex, def } = normalizedQuestionForSave(q);
      if (
        typeof correctOptionIndex === 'number' &&
        correctOptionIndex >= 0 &&
        correctOptionIndex < def.options.length
      ) {
        out[q.id] = correctOptionIndex;
      }
    }
  }
  return out;
}

function serializeModule(mod: DraftModule): Record<string, unknown> {
  const steps = mod.steps
    .filter((s) => s.title.trim())
    .map((s, i) => serializeStep({ ...s, order: i }))
    .sort((a, b) => a.order - b.order);

  const payload: Record<string, unknown> = {
    title: mod.title.trim(),
    order: mod.order,
    content: mod.content.trim(),
    vimeoUrl: mod.vimeoUrl.trim(),
    pdfUrl: mod.pdfUrl.trim(),
    questions: [],
    updatedAt: serverTimestamp(),
  };

  if (mod.audience && mod.audience !== 'all') payload.audience = mod.audience;
  if (mod.visibleToRoles.length) payload.visibleToRoles = mod.visibleToRoles;
  if (mod.visibleToDepartments.length) payload.visibleToDepartments = mod.visibleToDepartments;

  if (steps.length) payload.steps = steps;
  else payload.steps = [];

  return payload;
}

export type SaveCourseResult = { courseId: string };

const BATCH_LIMIT = 450;

async function runCourseSaveMutators(
  mutators: Array<(b: ReturnType<typeof writeBatch>) => void>
): Promise<void> {
  for (let i = 0; i < mutators.length; i += BATCH_LIMIT) {
    const slice = mutators.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const fn of slice) fn(batch);
    await batch.commit();
  }
}

export async function saveCourseDraft(
  courseId: string | null,
  draft: CourseDraft
): Promise<SaveCourseResult> {
  const title = draft.title.trim();
  if (!title) throw new Error('Informe o título do curso.');

  const courseRef = courseId ? doc(db, 'courses', courseId) : doc(collection(db, 'courses'));
  const finalId = courseRef.id;

  const modulesCol = collection(db, 'courses', finalId, 'modules');
  const existingSnap = await getDocs(modulesCol);
  const existingIds = new Set(existingSnap.docs.map((d) => d.id));

  const draftIds = new Set(
    draft.modules.map((m) => m.firestoreId).filter((id): id is string => Boolean(id))
  );

  const mutators: Array<(b: ReturnType<typeof writeBatch>) => void> = [];

  const introForSave: CourseIntroVideo[] = draft.introVimeoUrls
    .map((row) => ({
      url: row.url.trim(),
      title: row.title.trim() || undefined,
    }))
    .filter((row) => row.url);
  const cardImg = draft.catalogCardImageUrl.trim();
  const channelId = draft.channelId.trim();

  mutators.push((b) => {
    b.set(
      courseRef,
      {
        title,
        description: draft.description.trim() || null,
        about: draft.about.trim() || null,
        introVimeoUrls: introForSave.length
          ? introForSave.map(({ url, title }) => (title ? { url, title } : { url }))
          : null,
        introVimeoUrl: deleteField(),
        catalogCardImageUrl: cardImg || null,
        catalogPublished: draft.catalogPublished === true,
        channelId: channelId || null,
        updatedAt: serverTimestamp(),
        ...(courseId ? {} : { createdAt: serverTimestamp() }),
      },
      { merge: true }
    );
  });

  for (const mid of existingIds) {
    if (!draftIds.has(mid)) {
      mutators.push((b) => b.delete(doc(db, 'courses', finalId, 'modules', mid)));
      mutators.push((b) => b.delete(doc(db, 'answerKeys', `${finalId}__${mid}`)));
    }
  }

  for (let i = 0; i < draft.modules.length; i++) {
    const mod = draft.modules[i];
    if (!mod.title.trim()) continue;

    const modOrder = typeof mod.order === 'number' ? mod.order : i;
    const moduleRefId =
      mod.firestoreId && existingIds.has(mod.firestoreId)
        ? mod.firestoreId
        : doc(modulesCol).id;

    const payload = serializeModule({ ...mod, order: modOrder });
    mutators.push((b) =>
      b.set(doc(db, 'courses', finalId, 'modules', moduleRefId), payload, { merge: false })
    );

    const correct = collectCorrectByQuestionId(mod);
    const keyRef = doc(db, 'answerKeys', `${finalId}__${moduleRefId}`);
    if (Object.keys(correct).length) {
      mutators.push((b) =>
        b.set(keyRef, {
          courseId: finalId,
          moduleId: moduleRefId,
          correctByQuestionId: correct,
          updatedAt: serverTimestamp(),
        })
      );
    } else {
      mutators.push((b) => b.delete(keyRef));
    }
  }

  await runCourseSaveMutators(mutators);
  return { courseId: finalId };
}

export function emptyCourseDraft(): CourseDraft {
  return {
    title: '',
    description: '',
    about: '',
    introVimeoUrls: [],
    catalogCardImageUrl: '',
    catalogPublished: true,
    channelId: '',
    modules: [],
  };
}

export function newEmptyModule(order: number): DraftModule {
  return {
    localKey: newLocalKey(),
    title: '',
    order,
    content: '',
    vimeoUrl: '',
    pdfUrl: '',
    audience: 'all',
    visibleToRoles: [],
    visibleToDepartments: [],
    questions: [],
    steps: [],
  };
}

/** Cópia profunda para novo módulo (sem `firestoreId`, IDs novos em passos/questões). */
export function duplicateDraftModule(source: DraftModule): DraftModule {
  const cloneQuestion = (q: DraftQuestion): DraftQuestion => ({
    ...q,
    id: newLocalKey(),
  });

  const cloneStep = (s: DraftStep): DraftStep => ({
    ...s,
    localKey: newLocalKey(),
    id: newLocalKey(),
    materials: s.materials.map((m) => ({ ...m })),
    questions: s.questions.map(cloneQuestion),
  });

  const t = source.title.trim();
  return {
    ...source,
    localKey: newLocalKey(),
    firestoreId: undefined,
    title: t ? `${t} (cópia)` : 'Módulo (cópia)',
    questions: [],
    steps: source.steps.map(cloneStep),
  };
}

export function newEmptyStep(order: number, kind: ModuleStepKind = 'materials'): DraftStep {
  return {
    localKey: newLocalKey(),
    id: newLocalKey(),
    title: '',
    order,
    kind,
    body: '',
    vimeoUrl: '',
    audience: 'all',
    visibleToRoles: [],
    visibleToDepartments: [],
    materials: [],
    questions: [],
  };
}

export function newEmptyQuestion(): DraftQuestion {
  return {
    id: newLocalKey(),
    prompt: '',
    options: ['', '', '', ''],
    audience: 'all',
    correctOptionIndex: undefined,
  };
}

export function newEmptyMaterial(): ModuleMaterialLink {
  return { title: '', description: '', pdfUrl: '', audience: 'all' };
}

/**
 * Remove o curso, módulos, gabaritos, vínculos em empresas e matrículas/respostas dos alunos.
 */
export async function deleteCourseCompletely(courseId: string): Promise<void> {
  const companyIds = await listCompanyIdsWithCourse(courseId);
  await Promise.all(companyIds.map((cid) => removeCourseFromCompany(cid, courseId)));

  /** Sem collection group em `documentId` (índice `__name__` não pode ir no JSON de deploy). */
  const usersSnap = await getDocs(collection(db, 'users'));
  for (const u of usersSnap.docs) {
    const uid = u.id;
    const enrollRef = doc(db, 'users', uid, 'courses', courseId);
    const enrollSnap = await getDoc(enrollRef);
    if (!enrollSnap.exists()) continue;
    const uMods = await getDocs(collection(db, 'users', uid, 'courses', courseId, 'modules'));
    for (const um of uMods.docs) {
      await deleteDoc(um.ref);
    }
    await deleteDoc(enrollRef);
  }

  const modsSnap = await getDocs(collection(db, 'courses', courseId, 'modules'));
  for (const m of modsSnap.docs) {
    await deleteDoc(doc(db, 'answerKeys', `${courseId}__${m.id}`));
    await deleteDoc(m.ref);
  }

  await deleteDoc(doc(db, 'courses', courseId));
}
