import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { parseContentAudience } from '@/lib/contentAudience';
import type {
  CourseIntroVideo,
  CourseSummary,
  ModuleContent,
  ModuleMaterialLink,
  ModuleStep,
  ModuleStepProgress,
  QuestionDef,
  UserModuleSubmission,
} from '@/types';

function parseIntroVimeoItem(raw: unknown): CourseIntroVideo | null {
  if (typeof raw === 'string') {
    const url = raw.trim();
    return url ? { url } : null;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    if (!url) return null;
    const titleRaw = typeof o.title === 'string' ? o.title.trim() : '';
    const title = titleRaw || undefined;
    return title ? { url, title } : { url };
  }
  return null;
}

function parseIntroVimeoUrls(d: Record<string, unknown>): CourseIntroVideo[] {
  if (Array.isArray(d.introVimeoUrls)) {
    return (d.introVimeoUrls as unknown[]).map(parseIntroVimeoItem).filter((x): x is CourseIntroVideo => x !== null);
  }
  const legacy = d.introVimeoUrl;
  if (typeof legacy === 'string' && legacy.trim()) {
    return [{ url: legacy.trim() }];
  }
  return [];
}

function parseCourseSummary(id: string, d: Record<string, unknown>): CourseSummary {
  const introVimeoUrls = parseIntroVimeoUrls(d);
  const catalogCardImageUrl =
    typeof d.catalogCardImageUrl === 'string' && d.catalogCardImageUrl.trim()
      ? d.catalogCardImageUrl.trim()
      : undefined;
  const channelId =
    typeof d.channelId === 'string' && d.channelId.trim() ? d.channelId.trim() : undefined;
  return {
    id,
    title: (d.title as string) ?? 'Sem título',
    description: typeof d.description === 'string' ? d.description : undefined,
    about: typeof d.about === 'string' ? d.about : undefined,
    ...(introVimeoUrls.length ? { introVimeoUrls } : {}),
    ...(catalogCardImageUrl ? { catalogCardImageUrl } : {}),
    catalogPublished: d.catalogPublished === true,
    ...(channelId ? { channelId } : {}),
  };
}

function parseQuestion(raw: unknown): QuestionDef | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const prompt = typeof o.prompt === 'string' ? o.prompt : '';
  const options = Array.isArray(o.options)
    ? (o.options as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  if (!id || !prompt) return null;
  const audience = parseContentAudience(o.audience);
  const q: QuestionDef = { id, prompt, options };
  if (audience !== 'all') q.audience = audience;
  return q;
}

function parseModuleStep(raw: Record<string, unknown>): ModuleStep | null {
  const id = typeof raw.id === 'string' ? raw.id : '';
  if (!id) return null;
  const kind = raw.kind === 'video' || raw.kind === 'quiz' || raw.kind === 'materials' ? raw.kind : 'materials';
  const materials = Array.isArray(raw.materials)
    ? raw.materials
        .map((m) => {
          const x = m as Record<string, unknown>;
          const title = typeof x.title === 'string' ? x.title : '';
          const description = typeof x.description === 'string' ? x.description : '';
          const pdfUrl = typeof x.pdfUrl === 'string' ? x.pdfUrl : '';
          if (!title || !pdfUrl) return null;
          const audience = parseContentAudience(x.audience);
          const link: ModuleMaterialLink = { title, description, pdfUrl };
          if (audience !== 'all') link.audience = audience;
          return link;
        })
        .filter(Boolean)
    : undefined;
  const questions = Array.isArray(raw.questions)
    ? raw.questions.map(parseQuestion).filter((q): q is QuestionDef => q !== null)
    : undefined;
  const stepAudience = parseContentAudience(raw.audience);
  const step: ModuleStep = {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    order: typeof raw.order === 'number' ? raw.order : 0,
    kind,
    body: typeof raw.body === 'string' ? raw.body : undefined,
    materials: materials?.length ? (materials as ModuleStep['materials']) : undefined,
    vimeoUrl: typeof raw.vimeoUrl === 'string' ? raw.vimeoUrl : undefined,
    questions,
  };
  if (stepAudience !== 'all') step.audience = stepAudience;
  if (Array.isArray(raw.visibleToRoles) && raw.visibleToRoles.length > 0) {
    step.visibleToRoles = raw.visibleToRoles.filter((r: unknown) => typeof r === 'string');
  }
  if (Array.isArray(raw.visibleToDepartments) && raw.visibleToDepartments.length > 0) {
    step.visibleToDepartments = raw.visibleToDepartments.filter((d: unknown) => typeof d === 'string');
  }
  return step;
}

export async function listEnrolledCourseIds(uid: string): Promise<string[]> {
  const snap = await getDocs(collection(db, 'users', uid, 'courses'));
  return snap.docs.map((d) => d.id);
}

export async function isUserEnrolledInCourse(uid: string, courseId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid, 'courses', courseId));
  return snap.exists();
}

export async function getCourse(courseId: string): Promise<CourseSummary | null> {
  const snap = await getDoc(doc(db, 'courses', courseId));
  if (!snap.exists()) return null;
  return parseCourseSummary(snap.id, snap.data() as Record<string, unknown>);
}

/** Cursos com `catalogPublished: true` (leitura anônima permitida pelas regras). */
export async function listPublishedCatalogCourses(): Promise<CourseSummary[]> {
  const q = query(collection(db, 'courses'), where('catalogPublished', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map((d) => parseCourseSummary(d.id, d.data() as Record<string, unknown>));
}

/** Cursos do catálogo público associados a um canal (`channelId` no documento do curso). */
export async function listPublishedCoursesForChannel(channelId: string): Promise<CourseSummary[]> {
  const cid = channelId.trim();
  if (!cid) return [];
  const q = query(
    collection(db, 'courses'),
    where('catalogPublished', '==', true),
    where('channelId', '==', cid),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => parseCourseSummary(d.id, d.data() as Record<string, unknown>))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function listModules(courseId: string): Promise<ModuleContent[]> {
  const q = query(
    collection(db, 'courses', courseId, 'modules'),
    orderBy('order', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const rawSteps = Array.isArray(data.steps) ? data.steps : [];
    const steps = rawSteps
      .map((s) => parseModuleStep(s as Record<string, unknown>))
      .filter((s): s is ModuleStep => s !== null)
      .sort((a, b) => a.order - b.order);
    const modAudience = parseContentAudience(data.audience);
    const legacyQs = Array.isArray(data.questions)
      ? data.questions.map(parseQuestion).filter((q): q is QuestionDef => q !== null)
      : [];
    const mod: ModuleContent = {
      id: d.id,
      title: (data.title as string) ?? '',
      content: (data.content as string) ?? '',
      vimeoUrl: (data.vimeoUrl as string) ?? '',
      pdfUrl: (data.pdfUrl as string) ?? '',
      questions: legacyQs,
      order: typeof data.order === 'number' ? data.order : 0,
      steps: steps.length > 0 ? steps : undefined,
    };
    if (modAudience !== 'all') mod.audience = modAudience;
    if (Array.isArray(data.visibleToRoles) && data.visibleToRoles.length > 0) {
      mod.visibleToRoles = data.visibleToRoles.filter((r: unknown) => typeof r === 'string');
    }
    if (Array.isArray(data.visibleToDepartments) && data.visibleToDepartments.length > 0) {
      mod.visibleToDepartments = data.visibleToDepartments.filter((d: unknown) => typeof d === 'string');
    }
    return mod;
  });
}

export async function getUserModuleSubmission(
  uid: string,
  courseId: string,
  moduleId: string
): Promise<UserModuleSubmission | null> {
  const snap = await getDoc(
    doc(db, 'users', uid, 'courses', courseId, 'modules', moduleId)
  );
  if (!snap.exists()) return null;
  const d = snap.data();
  const rawSp = d.stepProgress as Record<string, unknown> | undefined;
  let stepProgress: UserModuleSubmission['stepProgress'];
  if (rawSp && typeof rawSp === 'object') {
    const out: NonNullable<UserModuleSubmission['stepProgress']> = {};
    for (const [k, v] of Object.entries(rawSp)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const materialsDone = o.materialsDone === true ? true : undefined;
      const videoWatchedToEnd =
        o.videoWatchedToEnd === true
          ? true
          : typeof o.videoMaxPercent === 'number' && o.videoMaxPercent >= 100
            ? true
            : undefined;
      if (videoWatchedToEnd !== undefined || materialsDone) {
        out[k] = {
          ...(videoWatchedToEnd !== undefined ? { videoWatchedToEnd } : {}),
          ...(materialsDone ? { materialsDone } : {}),
        };
      }
    }
    stepProgress = Object.keys(out).length ? out : undefined;
  }
  return {
    answers: (d.answers as Record<string, number>) ?? {},
    submittedAt: d.submittedAt ?? null,
    status: (d.status as UserModuleSubmission['status']) ?? 'draft',
    stepProgress,
  };
}

export async function saveUserModuleSubmission(
  uid: string,
  courseId: string,
  moduleId: string,
  payload: {
    answers: Record<string, number>;
    stepProgress?: Record<string, ModuleStepProgress>;
  }
): Promise<void> {
  const data: Record<string, unknown> = {
    answers: payload.answers,
    submittedAt: serverTimestamp(),
    status: 'completed',
    updatedAt: serverTimestamp(),
  };
  if (payload.stepProgress !== undefined) {
    data.stepProgress = payload.stepProgress;
  }
  await setDoc(doc(db, 'users', uid, 'courses', courseId, 'modules', moduleId), data, { merge: true });
}
