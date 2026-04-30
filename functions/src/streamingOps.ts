import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { HttpsError } from 'firebase-functions/v2/https';

const BR_TZ = 'America/Sao_Paulo';

function spCalendarDayKey(d: Date = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: BR_TZ });
}

/** Próximo instante em que o calendário (dia) muda em São Paulo — início do novo dia local. */
function nextMidnightSaoPaulo(from: Date = new Date()): Date {
  const startDay = from.toLocaleDateString('en-CA', { timeZone: BR_TZ });
  let t = from.getTime() + 2000;
  const limit = from.getTime() + 49 * 3600 * 1000;
  while (t < limit) {
    if (new Date(t).toLocaleDateString('en-CA', { timeZone: BR_TZ }) !== startDay) {
      let lo = t - 120_000;
      let hi = t;
      while (hi - lo > 2000) {
        const mid = Math.floor((lo + hi) / 2);
        if (new Date(mid).toLocaleDateString('en-CA', { timeZone: BR_TZ }) === startDay) lo = mid;
        else hi = mid;
      }
      return new Date(hi);
    }
    t += 30_000;
  }
  throw new Error('nextMidnightSaoPaulo: limite excedido');
}

function formatPtBrDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: BR_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationUntil(ms: number): string {
  if (ms <= 0) return 'menos de um minuto';
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (h >= 24) {
    const days = Math.floor(h / 24);
    return `${days} dia(s)`;
  }
  if (h > 0) return `${h} h ${min} min`;
  return `${Math.max(1, min)} min`;
}

/** Extrai ID numérico do Vimeo (espelha a lógica da app). */
export function parseVimeoVideoIdFromUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./i, '');
  if (!host.endsWith('vimeo.com')) return null;
  const path = url.pathname;
  const unlisted = path.match(/^\/(\d{6,})\/([a-f0-9]+)\/?$/i);
  if (unlisted) return unlisted[1] ?? null;
  const standard = path.match(/^\/(?:video\/)?(\d{6,})\/?$/i);
  if (standard) return standard[1] ?? null;
  return null;
}

function stripWebVtt(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t || t === 'WEBVTT' || /^NOTE\b/i.test(t)) continue;
    if (/^\d{2}:\d{2}:\d{2}/.test(t)) continue;
    if (/^\d+$/.test(t)) continue;
    if (t.includes('-->')) continue;
    out.push(t);
  }
  return out.join(' ').replace(/\s+/g, ' ').trim();
}

async function fetchVttText(link: string): Promise<string> {
  const res = await fetch(link, { headers: { Accept: 'text/vtt,*/*' } });
  if (!res.ok) return '';
  const body = await res.text();
  return stripWebVtt(body);
}

/** Lista faixas de texto do Vimeo e devolve o texto preferindo pt / pt-BR. */
export async function fetchVimeoTranscriptPlain(
  videoId: string,
  accessToken: string | undefined
): Promise<string> {
  if (!accessToken?.trim()) return '';
  try {
    const res = await fetch(`https://api.vimeo.com/videos/${videoId}/texttracks`, {
      headers: {
        Authorization: `bearer ${accessToken.trim()}`,
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });
    if (!res.ok) return '';
    const json = (await res.json()) as {
      data?: Array<{ link?: string; language?: string; type?: string; active?: boolean }>;
    };
    const tracks = json.data ?? [];
    if (!tracks.length) return '';
    const prefer = (lang: string) =>
      tracks.find((t) => (t.language ?? '').toLowerCase().startsWith(lang));
    const pick =
      prefer('pt') ||
      prefer('es') ||
      prefer('en') ||
      tracks.find((t) => t.active) ||
      tracks[0];
    const link = pick?.link;
    if (!link) return '';
    return await fetchVttText(link);
  } catch {
    return '';
  }
}

type CatalogEntry = {
  entryId: string;
  trackId: string;
  trackTitle: string;
  title: string;
  description: string;
  vimeoUrl: string;
  vimeoVideoId: string | null;
};

export async function loadStreamingCatalog(db: Firestore): Promise<CatalogEntry[]> {
  const tracksSnap = await db.collection('streamingTracks').orderBy('order', 'asc').get();
  const out: CatalogEntry[] = [];
  for (const t of tracksSnap.docs) {
    const trackTitle = typeof t.data().title === 'string' ? t.data().title : 'Sem título';
    const es = await t.ref.collection('entries').orderBy('order', 'asc').get();
    for (const e of es.docs) {
      const d = e.data();
      const vimeoUrl = typeof d.vimeoUrl === 'string' ? d.vimeoUrl : '';
      const title = typeof d.title === 'string' ? d.title : 'Sem título';
      const description = typeof d.description === 'string' ? d.description : '';
      const vimeoVideoId = parseVimeoVideoIdFromUrl(vimeoUrl);
      out.push({
        entryId: e.id,
        trackId: t.id,
        trackTitle,
        title,
        description,
        vimeoUrl,
        vimeoVideoId,
      });
    }
  }
  return out;
}

const TRANSCRIPT_MAX = 14_000;

async function getOrFetchTranscript(
  db: Firestore,
  entry: CatalogEntry,
  vimeoToken: string | undefined
): Promise<string> {
  const cacheRef = db.doc(`streamingTranscriptCache/${entry.entryId}`);
  const cached = await cacheRef.get();
  if (cached.exists) {
    const d = cached.data() as { fullText?: string; vimeoVideoId?: string };
    const text = typeof d.fullText === 'string' ? d.fullText : '';
    if (text.length > 80 && d.vimeoVideoId === (entry.vimeoVideoId ?? '')) {
      return text.slice(0, TRANSCRIPT_MAX);
    }
  }
  let fullText = '';
  if (entry.vimeoVideoId) {
    fullText = await fetchVimeoTranscriptPlain(entry.vimeoVideoId, vimeoToken);
  }
  if (!fullText.trim() && entry.description) {
    fullText = `(Sem legenda indexada; descrição do vídeo: ${entry.description})`;
  }
  const trimmed = fullText.slice(0, TRANSCRIPT_MAX);
  await cacheRef.set(
    {
      vimeoVideoId: entry.vimeoVideoId ?? '',
      entryTitle: entry.title,
      trackTitle: entry.trackTitle,
      fullText: trimmed,
      updatedAt: FieldValue.serverTimestamp(),
      source: fullText.trim() ? 'vimeo_api' : 'fallback',
    },
    { merge: true }
  );
  return trimmed;
}

const CATALOG_SUMMARY_SNIPPET = 300;

/**
 * Constrói o catálogo para o system prompt usando apenas metadados e um trecho curto
 * da transcrição (primeiros ~300 chars). A transcrição completa é enviada apenas para
 * o vídeo em foco (buildFocusStreamingContextForGemini), reduzindo tokens em ~90%.
 */
export async function buildCatalogContextForGemini(
  db: Firestore,
  vimeoToken: string | undefined
): Promise<string> {
  const catalog = await loadStreamingCatalog(db);
  const chunks = await Promise.all(
    catalog.map(async (e) => {
      const transcript = await getOrFetchTranscript(db, e, vimeoToken);
      const snippet = transcript
        ? transcript.slice(0, CATALOG_SUMMARY_SNIPPET).replace(/\s+\S*$/, '') + '…'
        : '(sem transcrição disponível)';
      return (
        `- Trilha: "${e.trackTitle}" | Vídeo: "${e.title}" (id_entrada: ${e.entryId})` +
        (e.description ? ` | ${e.description.slice(0, 200)}` : '') +
        `\n  Resumo: ${snippet}`
      );
    })
  );
  return chunks.join('\n');
}

/** Cursos com `catalogPublished` (aba Cursos / catálogo público). */
export async function buildPublishedCoursesContextForGemini(db: Firestore): Promise<string> {
  const snap = await db.collection('courses').where('catalogPublished', '==', true).get();
  if (snap.empty) {
    return '(Nenhum curso publicado no catálogo.)';
  }
  const parts: string[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    const title = typeof data.title === 'string' ? data.title : 'Sem título';
    const about =
      typeof data.about === 'string'
        ? data.about
        : typeof data.description === 'string'
          ? data.description
          : '';
    const snippet = about.replace(/\s+/g, ' ').trim().slice(0, 1500);
    parts.push(
      `- **${title}** (id_curso: ${d.id})\n` +
        `  Resumo: ${snippet || '(ver página do curso)'}\n` +
        `  Link no site: /curso/${d.id}`
    );
  }
  return parts.join('\n\n');
}

const COURSE_DETAIL_CONTEXT_MAX = 28_000;

/**
 * Conteúdo pedagógico do curso (Firestore) para o modo mentor na página `/curso/:id`.
 * Sem isto o modelo só vê o resumo do catálogo e inventa temas (ex.: NR1).
 */
export async function buildCourseDetailContextForGemini(
  db: Firestore,
  courseId: string
): Promise<string> {
  const cid = courseId.trim();
  if (!cid) return '';

  const courseSnap = await db.doc(`courses/${cid}`).get();
  if (!courseSnap.exists) {
    return '(Curso não encontrado no sistema.)';
  }
  const c = courseSnap.data()!;
  const title = typeof c.title === 'string' ? c.title : 'Sem título';
  const about =
    typeof c.about === 'string'
      ? c.about
      : typeof c.description === 'string'
        ? c.description
        : '';
  const header =
    `**Curso:** ${title} (id_curso: ${cid})\n` +
    (about.trim()
      ? `\n**Sobre / descrição geral:**\n${about.trim().slice(0, 6000)}\n`
      : '');

  const modulesSnap = await db.collection(`courses/${cid}/modules`).orderBy('order', 'asc').get();
  if (modulesSnap.empty) {
    return `${header}\n(Nenhum módulo cadastrado neste curso.)`.slice(0, COURSE_DETAIL_CONTEXT_MAX);
  }

  const chunks: string[] = [header, '\n**Módulos e passos (use isto para objetivos e temas reais):**\n'];
  let total = chunks.join('').length;

  for (const docSnap of modulesSnap.docs) {
    const d = docSnap.data();
    const modTitle = typeof d.title === 'string' ? d.title : 'Módulo';
    const modContent = typeof d.content === 'string' ? d.content.trim() : '';
    let block = `\n### ${modTitle} (id_modulo: ${docSnap.id})\n`;
    if (modContent) {
      block += `**Texto do módulo:**\n${modContent.slice(0, 4000)}\n`;
    }

    const rawSteps = Array.isArray(d.steps) ? d.steps : [];
    type StepRow = { order: number; title: string; kind: string; body: string };
    const steps: StepRow[] = [];
    for (const raw of rawSteps) {
      if (!raw || typeof raw !== 'object') continue;
      const s = raw as Record<string, unknown>;
      const st = typeof s.title === 'string' ? s.title : '';
      const ord = typeof s.order === 'number' ? s.order : 0;
      const kind =
        s.kind === 'video' || s.kind === 'quiz' || s.kind === 'materials' ? String(s.kind) : 'materials';
      const body = typeof s.body === 'string' ? s.body.trim() : '';
      if (st || body) steps.push({ order: ord, title: st || '(sem título)', kind, body });
    }
    steps.sort((a, b) => a.order - b.order);

    if (steps.length) {
      block += '**Passos:**\n';
      for (const st of steps) {
        block += `- [${st.kind}] ${st.title}\n`;
        if (st.body) {
          block += `  ${st.body.slice(0, 1500).replace(/\n/g, ' ')}\n`;
        }
        if (st.kind === 'quiz') {
          block +=
            '  (Passo de avaliação: não fornecer respostas de teste; só conceitos gerais se o utilizador pedir estudo.)\n';
        }
      }
    }

    if (total + block.length > COURSE_DETAIL_CONTEXT_MAX) {
      chunks.push(
        '\n[… restantes módulos omitidos por limite de contexto — o utilizador pode perguntar por um módulo específico.]'
      );
      break;
    }
    chunks.push(block);
    total += block.length;
  }

  return chunks.join('').slice(0, COURSE_DETAIL_CONTEXT_MAX);
}

function courseVideoTranscriptCacheKey(courseId: string, moduleId: string, stepId: string): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `cv_${safe(courseId)}_${safe(moduleId)}_${safe(stepId)}`.slice(0, 700);
}

export type CourseVideoFocusPayload = {
  moduleId: string;
  stepId: string;
  vimeoUrl: string;
  title: string;
  body?: string;
};

/** Payload enviado pelo cliente (campos opcionais; validação em `handleStreamingAssistantChat`). */
export type CourseVideoFocusClientPayload = {
  moduleId?: string;
  stepId?: string;
  vimeoUrl?: string;
  title?: string;
  body?: string;
};

/**
 * Transcrição Vimeo de um passo de vídeo do curso ("Saiba mais sobre o vídeo").
 * Reutiliza o mesmo cache `streamingTranscriptCache` com chave estável por curso/módulo/passo.
 */
export async function buildCourseVideoFocusContextForGemini(
  db: Firestore,
  courseId: string,
  focus: CourseVideoFocusPayload,
  vimeoToken: string | undefined
): Promise<string> {
  const vimeoUrl = focus.vimeoUrl.trim();
  const vid = parseVimeoVideoIdFromUrl(vimeoUrl);
  if (!vid) {
    return (
      '### Vídeo do curso em foco\n' +
      '(Link Vimeo inválido — não foi possível pedir legenda. Sugira verificar o vídeo na página do curso.)\n'
    );
  }
  const cacheKey = courseVideoTranscriptCacheKey(courseId, focus.moduleId, focus.stepId);
  const entry: CatalogEntry = {
    entryId: cacheKey,
    trackId: 'course',
    trackTitle: 'Curso',
    title: focus.title,
    description: (focus.body ?? '').trim(),
    vimeoUrl,
    vimeoVideoId: vid,
  };
  const transcript = await getOrFetchTranscript(db, entry, vimeoToken);
  const body = transcript.slice(0, TRANSCRIPT_MAX).trim();

  let textBlock: string;
  if (!body) {
    textBlock =
      '(Ainda sem texto indexado para este vídeo: confirme no Vimeo se existem faixas de legenda e que VIMEO_ACCESS_TOKEN está configurado nas Cloud Functions. Enquanto isso, não inventes o que foi dito no áudio.)\n' +
      'Se existir texto do passo acima (corpo do passo), podes usar só esse trecho como apoio geral.';
  } else if (body.includes('Sem legenda indexada')) {
    textBlock =
      `Texto disponível (descrição/corpo do passo; legenda completa do áudio pode não estar na API):\n${body}`;
  } else {
    textBlock = `Legenda / transcrição deste vídeo (prioridade para perguntas sobre o que foi dito):\n${body}`;
  }

  return (
    `### Vídeo do curso em foco ("Saiba mais")\n` +
    `id_modulo: ${focus.moduleId} | id_passo: ${focus.stepId}\n` +
    `Título: ${focus.title}\n` +
    `${textBlock}\n`
  );
}

/** Transcrição do vídeo em destaque na home (quando o cliente envia track+entry). */
async function buildFocusStreamingContextForGemini(
  db: Firestore,
  focusTrackId: string | undefined,
  focusEntryId: string | undefined,
  vimeoToken: string | undefined
): Promise<string> {
  const tid = focusTrackId?.trim();
  const eid = focusEntryId?.trim();
  if (!tid || !eid) return '';
  const trackSnap = await db.doc(`streamingTracks/${tid}`).get();
  const entrySnap = await db.doc(`streamingTracks/${tid}/entries/${eid}`).get();
  if (!trackSnap.exists || !entrySnap.exists) return '';
  const trackTitle =
    typeof trackSnap.data()?.title === 'string' ? trackSnap.data()!.title : 'Sem título';
  const ed = entrySnap.data()!;
  const title = typeof ed.title === 'string' ? ed.title : 'Sem título';
  const description = typeof ed.description === 'string' ? ed.description : '';
  const vimeoUrl = typeof ed.vimeoUrl === 'string' ? ed.vimeoUrl : '';
  const vimeoVideoId = parseVimeoVideoIdFromUrl(vimeoUrl);
  const entry: CatalogEntry = {
    entryId: eid,
    trackId: tid,
    trackTitle,
    title,
    description,
    vimeoUrl,
    vimeoVideoId,
  };
  const transcript = await getOrFetchTranscript(db, entry, vimeoToken);
  const body = transcript.slice(0, 12_000).trim();
  let textBlock: string;
  if (!body) {
    textBlock =
      '(Sem texto indexado: não há legenda obtida via API do Vimeo nem descrição no cadastro deste vídeo. ' +
      'Não inventes falas; sugere assistir ao vídeo no site.)';
  } else if (body.includes('Sem legenda indexada')) {
    textBlock =
      `Texto disponível para consulta (descrição do cadastro; a transcrição completa do áudio pode não estar indexada):\n${body}`;
  } else {
    textBlock = `Transcrição / texto falado indexado (usa isto para tópicos, nomes e citações sobre o que está a ver):\n${body}`;
  }
  return (
    `### Vídeo em destaque agora (utilizador a ver na página inicial)\n` +
    `Trilha: "${trackTitle}"\n` +
    `Vídeo: "${title}" (id_entrada: ${eid})\n` +
    `${textBlock}\n`
  );
}

const ASSISTANT_MAX_MESSAGES_PER_DAY = 30;
const ASSISTANT_MAX_COURSE_MESSAGES_PER_DAY = 15;

/** Limita custo Gemini por utilizador autenticado (1 unidade por chamada à callable). */
export async function assertAssistantDailyQuota(
  db: Firestore,
  uid: string,
  courseId?: string
): Promise<void> {
  const day = spCalendarDayKey();
  const globalRef = db.doc(`assistantQuota/${uid}/daily/${day}`);
  const cid = courseId?.trim() ?? '';
  const courseRef = cid
    ? db.doc(`assistantQuota/${uid}/course/${cid}/daily/${day}`)
    : null;

  await db.runTransaction(async (t) => {
    /** Firestore exige todas as leituras antes de qualquer escrita na transação. */
    const globalSnap = await t.get(globalRef);
    const courseSnap = courseRef ? await t.get(courseRef) : null;

    const globalCount = typeof globalSnap.data()?.count === 'number' ? globalSnap.data()!.count : 0;
    if (globalCount >= ASSISTANT_MAX_MESSAGES_PER_DAY) {
      const resetAt = nextMidnightSaoPaulo();
      const waitMs = resetAt.getTime() - Date.now();
      throw new HttpsError(
        'resource-exhausted',
        `Limite diário do assistente (${ASSISTANT_MAX_MESSAGES_PER_DAY} mensagens) atingido. ` +
          `Nova contagem a partir de ${formatPtBrDateTime(resetAt)} (horário de Brasília). ` +
          `Faltam aproximadamente ${formatDurationUntil(waitMs)}.`
      );
    }

    if (courseRef && courseSnap) {
      const courseCount =
        typeof courseSnap.data()?.count === 'number' ? courseSnap.data()!.count : 0;
      if (courseCount >= ASSISTANT_MAX_COURSE_MESSAGES_PER_DAY) {
        const resetAt = nextMidnightSaoPaulo();
        const waitMs = resetAt.getTime() - Date.now();
        throw new HttpsError(
          'resource-exhausted',
          `Limite de créditos deste curso (${ASSISTANT_MAX_COURSE_MESSAGES_PER_DAY} perguntas/dia) atingido. ` +
            `Nova contagem a partir de ${formatPtBrDateTime(resetAt)} (horário de Brasília). ` +
            `Faltam aproximadamente ${formatDurationUntil(waitMs)}.`
        );
      }
    }

    t.set(globalRef, { count: globalCount + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (courseRef && courseSnap) {
      const courseCount =
        typeof courseSnap.data()?.count === 'number' ? courseSnap.data()!.count : 0;
      t.set(
        courseRef,
        { count: courseCount + 1, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
  });
}

export async function incrementStreamingViewStats(
  db: Firestore,
  trackId: string,
  entryId: string,
  trackTitle: string,
  entryTitle: string,
  vimeoVideoId: string | null
): Promise<void> {
  const batch = db.batch();
  const eRef = db.doc(`streamingEntryStats/${entryId}`);
  const tRef = db.doc(`streamingTrackStats/${trackId}`);
  batch.set(
    eRef,
    {
      trackId,
      trackTitle,
      entryTitle,
      vimeoVideoId: vimeoVideoId ?? '',
      views: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  batch.set(
    tRef,
    {
      trackTitle,
      views: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  await batch.commit();
}

export async function handleLogStreamingView(
  db: Firestore,
  data: { trackId?: string; entryId?: string }
): Promise<{ ok: boolean }> {
  const trackId = data.trackId?.trim();
  const entryId = data.entryId?.trim();
  if (!trackId || !entryId) {
    throw new HttpsError('invalid-argument', 'trackId e entryId são obrigatórios.');
  }
  const trackSnap = await db.doc(`streamingTracks/${trackId}`).get();
  if (!trackSnap.exists) {
    throw new HttpsError('not-found', 'Trilha inválida.');
  }
  const entrySnap = await db.doc(`streamingTracks/${trackId}/entries/${entryId}`).get();
  if (!entrySnap.exists) {
    throw new HttpsError('not-found', 'Vídeo inválido.');
  }
  const trackTitle =
    typeof trackSnap.data()?.title === 'string' ? trackSnap.data()!.title : 'Sem título';
  const ed = entrySnap.data()!;
  const entryTitle = typeof ed.title === 'string' ? ed.title : 'Sem título';
  const vimeoUrl = typeof ed.vimeoUrl === 'string' ? ed.vimeoUrl : '';
  const vimeoVideoId = parseVimeoVideoIdFromUrl(vimeoUrl);
  await incrementStreamingViewStats(db, trackId, entryId, trackTitle, entryTitle, vimeoVideoId);
  return { ok: true };
}

export type StreamingAssistantCredentials = {
  googleApiKey: string;
  modelName: string;
  /** Token API Vimeo (opcional) para ler legendas. */
  vimeoToken?: string;
};

type GeminiTurn = { role: 'user' | 'model'; parts: { text: string }[] };

/**
 * O SDK (@google/generative-ai) exige que `startChat({ history })` comece com role `user`.
 * O widget envia primeiro um texto do assistente (intro) como `model` — isso fazia falhar
 * validateChatHistory e devolvia 500 INTERNAL antes de chamar a API.
 */
function stripLeadingModelTurns(prior: GeminiTurn[]): GeminiTurn[] {
  let i = 0;
  while (i < prior.length && prior[i]!.role === 'model') {
    i += 1;
  }
  return prior.slice(i);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Cota / faturação da API — retentar não resolve; o cliente deve ver mensagem clara (não 500 genérico). */
function isGeminiBillingQuotaError(msg: string): boolean {
  return /exceeded your current quota|check your plan and billing|billing details|quota.*exceeded/i.test(msg);
}

/** 503/429 sobrecarga — vale retentar; 429 por cota de faturagem — não; 400 chave inválida — não. */
function isRetryableGeminiError(msg: string): boolean {
  if (isGeminiBillingQuotaError(msg)) return false;
  if (/API key not valid|API_KEY_INVALID|permission denied.*key/i.test(msg)) return false;
  return /503|429|500|UNAVAILABLE|high demand|try again later|overloaded|Resource exhausted|temporarily/i.test(
    msg
  );
}

export type StreamingAssistantRequestData = {
  messages?: Array<{ role?: string; content?: string }>;
  /** Vídeo em destaque na home streaming — reforça transcrição para perguntas sobre o que está a ver. */
  focusEntryId?: string;
  focusTrackId?: string;
  /** Página de curso: reforço anti-resposta a avaliações. */
  courseId?: string;
  courseTitle?: string;
  /** Passo de vídeo selecionado: transcrição Vimeo como contexto prioritário. */
  courseVideoFocus?: CourseVideoFocusClientPayload;
};

export async function handleStreamingAssistantChat(
  db: Firestore,
  data: StreamingAssistantRequestData,
  creds?: StreamingAssistantCredentials
): Promise<{ reply: string }> {
  const apiKey =
    creds?.googleApiKey?.trim() ||
    process.env.GOOGLE_API_KEY?.trim();
  const modelName =
    creds?.modelName?.trim() ||
    process.env.GEMINI_MODEL?.trim() ||
    'gemini-2.5-flash';
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'Assistente indisponível: configure o secret GOOGLE_API_KEY (firebase functions:secrets:set) e volte a publicar as functions.'
    );
  }

  const raw = Array.isArray(data.messages) ? data.messages : [];
  const messages: GeminiTurn[] = raw
    .filter((m) => (m.role === 'user' || m.role === 'model') && m.content?.trim())
    .slice(-12)
    .map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content!.trim() }],
    }));

  if (messages.length === 0) {
    throw new HttpsError('invalid-argument', 'Envie pelo menos uma mensagem.');
  }
  const last = messages[messages.length - 1]!;
  if (last.role !== 'user') {
    throw new HttpsError('invalid-argument', 'A última mensagem deve ser do utilizador.');
  }
  if (last.parts[0]!.text!.length > 4000) {
    throw new HttpsError('invalid-argument', 'Mensagem demasiado longa.');
  }

  const courseId = data.courseId?.trim();
  const courseTitle = data.courseTitle?.trim();

  const vimeoToken =
    creds?.vimeoToken?.trim() || process.env.VIMEO_ACCESS_TOKEN?.trim();
  let catalogBlock: string;
  let coursesBlock: string;
  let focusBlock: string;
  try {
    catalogBlock = await buildCatalogContextForGemini(db, vimeoToken);
    coursesBlock = await buildPublishedCoursesContextForGemini(db);
    focusBlock = await buildFocusStreamingContextForGemini(
      db,
      data.focusTrackId,
      data.focusEntryId,
      vimeoToken
    );
  } catch (e) {
    console.error(e);
    throw new HttpsError('internal', 'Não foi possível carregar o catálogo de streaming.');
  }

  let courseDetailBlock = '';
  if (courseId) {
    try {
      courseDetailBlock = await buildCourseDetailContextForGemini(db, courseId);
    } catch (e) {
      console.error('buildCourseDetailContextForGemini', e);
      courseDetailBlock =
        '(Não foi possível carregar os módulos deste curso a partir do Firestore.)';
    }
  }

  let courseVideoBlock = '';
  if (courseId && data.courseVideoFocus) {
    const fv = data.courseVideoFocus;
    const moduleId = typeof fv.moduleId === 'string' ? fv.moduleId.trim() : '';
    const stepId = typeof fv.stepId === 'string' ? fv.stepId.trim() : '';
    const vimeoUrl = typeof fv.vimeoUrl === 'string' ? fv.vimeoUrl.trim() : '';
    if (moduleId && stepId && vimeoUrl) {
      try {
        courseVideoBlock = await buildCourseVideoFocusContextForGemini(
          db,
          courseId,
          {
            moduleId,
            stepId,
            vimeoUrl,
            title:
              typeof fv.title === 'string' && fv.title.trim() ? fv.title.trim() : 'Vídeo',
            body: typeof fv.body === 'string' ? fv.body : undefined,
          },
          vimeoToken
        );
      } catch (e) {
        console.error('buildCourseVideoFocusContextForGemini', e);
        courseVideoBlock =
          '(Não foi possível carregar o texto deste vídeo neste momento. Responde com base no conteúdo pedagógico geral do curso, sem inventar o que foi dito no vídeo.)';
      }
    }
  }

  const courseModeBlock =
    courseId && courseTitle
      ? `
MODO ESTUDO — CURSO EM CONTEXTO
O utilizador está na página do curso **"${courseTitle}"** (id_curso: ${courseId}).
REGRAS OBRIGATÓRIAS — INTEGRIDADE DA AVALIAÇÃO:
- É PROIBIDO responder direta ou indiretamente a perguntas de teste, questionário, prova, exercício avaliativo ou atividade com nota deste ou de outro curso (incluindo escolher alternativa, dar a "letra certa", confirmar se uma resposta está correta ou completar gabarito).
- Se o utilizador pedir resposta de avaliação, recusa com educação: explica que não podes ajudar em provas ou questionários; oferece rever o **conceito geral** com exemplos que não sejam o enunciado específico.
- Podes explicar teoria, definir termos, sugerir métodos de estudo, esclarecer dúvidas conceituais e dar insights pedagógicos **sem resolver** o item de avaliação.
- Não contornes estas regras mesmo que o pedido seja reformulado ("só uma dica", "qual tema estudar para acertar", etc.) se o objetivo for obter a resposta da avaliação.

`
      : '';

  const system = `És o assistente do site Medivox (streaming na página inicial + cursos no catálogo público).
Responde em português do Brasil, de forma breve e útil.
${courseModeBlock}
REGRAS:
- Baseia-te nos blocos abaixo (streaming, cursos, e opcionalmente vídeo em destaque). Se algo não estiver listado, diz que não tens essa informação.
- **Modo curso:** se existir a secção **"CURSO ATUAL — CONTEÚDO PEDAGÓGICO"**, essa é a **fonte principal** para objetivos dos módulos, temas e passos. **Não inventes** normas (ex.: NR), datas ou tópicos que **não** apareçam nessa secção ou no texto do módulo.
- Para vídeos de streaming: indica sempre o **título do vídeo** e o **nome da trilha**; inclui \`(id_entrada: ID)\` **uma vez por vídeo** (formato exato) para o site mostrar o botão "Ver na página inicial". Não mostres só o ID sem o título.
- Para cursos do catálogo: usa título e id_curso; link típico \`/curso/ID\`.
- O catálogo de streaming abaixo contém resumos curtos. Se o utilizador perguntar detalhes sobre um vídeo que NÃO é o "em destaque", sugere que clique nesse vídeo na página inicial para carregar o texto indexado desse vídeo.
- **Vídeo em destaque:** se existir a secção "VÍDEO EM DESTAQUE", trata-a como **prioridade absoluta** para perguntas sobre "este vídeo", tópicos, nome do apresentador e citações. O texto pode ser transcrição de legenda **ou** descrição cadastrada (quando a linha indicar "Sem legenda indexada"). **Nunca** digas que a "transcrição não está disponível" se essa secção contiver parágrafos úteis — extrai a resposta **desse** texto.
- **Vídeo do curso em foco ("Saiba mais"):** se existir a secção "VÍDEO DO CURSO EM FOCO", é **prioridade absoluta** sobre o restante conteúdo pedagógico para perguntas sobre o que foi **dito neste vídeo** (citações, temas, nomes). Se a secção disser que a legenda ainda não está disponível ou que falta token Vimeo, não inventes o áudio; podes usar só o texto do passo/módulo se estiver no bloco.
- Só podes dizer que não tens texto indexado sobre o que foi dito no vídeo quando a secção relevante ("VÍDEO EM DESTAQUE" ou "VÍDEO DO CURSO EM FOCO") indicar explicitamente que não há legenda nem descrição útil (mensagem de aviso técnico).
- Não inventes conteúdos clínicos que não apareçam nos textos fornecidos.

CURSOS (aba Cursos / catálogo):
---
${coursesBlock}
---

STREAMING — CATÁLOGO (resumos):
---
${catalogBlock}
---
${focusBlock ? `\nVÍDEO EM DESTAQUE — TEXTO INDEXADO (obrigatório usar para perguntas sobre o vídeo selecionado):\n---\n${focusBlock}\n---` : ''}${
    courseId && courseDetailBlock
      ? `\nCURSO ATUAL — CONTEÚDO PEDAGÓGICO (módulos e passos deste curso; prioridade em modo estudo):\n---\n${courseDetailBlock}\n---`
      : ''
  }${
    courseId && courseVideoBlock
      ? `\nVÍDEO DO CURSO EM FOCO ("Saiba mais") — TEXTO INDEXADO (prioridade para perguntas sobre **este** vídeo no curso):\n---\n${courseVideoBlock}\n---`
      : ''
  }`;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: system,
  });

  const prior = stripLeadingModelTurns(messages.slice(0, -1));
  let chat;
  try {
    chat = model.startChat({
      history: prior,
    });
  } catch (e) {
    console.error('startChat', e);
    throw new HttpsError(
      'invalid-argument',
      'Histórico de mensagens inválido para o modelo. Tente fechar e reabrir o assistente.'
    );
  }

  const userText = last.parts[0]!.text!;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await chat.sendMessage(userText);
      const reply = result.response.text()?.trim() ?? '';
      if (!reply) {
        throw new HttpsError('internal', 'Resposta vazia do modelo.');
      }
      return { reply };
    } catch (e: unknown) {
      if (e instanceof HttpsError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      if (isGeminiBillingQuotaError(msg)) {
        throw new HttpsError(
          'resource-exhausted',
          'A cota da API Gemini foi excedida ou o projeto não tem faturação ativa para este modelo (erro 429). ' +
            'No Google AI Studio ou Google Cloud Console, verifique plano, limites e faturação da chave em GOOGLE_API_KEY. ' +
            'Pode definir outro modelo (parâmetro GEMINI_MODEL, ex.: gemini-2.5-flash) e voltar a publicar as functions.'
        );
      }
      console.error(`Gemini sendMessage attempt ${attempt + 1}`, e);
      const retry = isRetryableGeminiError(msg) && attempt < 2;
      if (retry) {
        await sleep(1200 * (attempt + 1));
        continue;
      }
      const hint =
        /503|high demand|Service Unavailable/i.test(msg)
          ? ' O modelo Gemini está sob pressão — tente de novo em instantes. Se persistir, experimente outro modelo em GEMINI_MODEL (ex.: gemini-2.5-flash-lite, se disponível na tua chave).'
          : '';
      throw new HttpsError(
        'internal',
        `Erro ao contactar o modelo (${modelName}).${hint} Detalhe: ${msg.slice(0, 240)}`
      );
    }
  }
  throw new HttpsError('internal', `Erro ao contactar o modelo (${modelName}).`);
}
