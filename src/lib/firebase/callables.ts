import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './config';

const region = import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || 'southamerica-east1';

const fns = getFunctions(app, region);

export const registerWithCompanyCallable = httpsCallable<
  {
    companySlug: string;
    accessKey: string;
    email: string;
    password: string;
    name: string;
    cpf: string;
    legalAcceptance: {
      termsVersion: string;
      privacyVersion: string;
      commitmentsVersion: string;
    };
    demographics: {
      sexo: 'Masculino' | 'Feminino' | 'Outro';
      faixaEtaria: string;
      segundaJornada: boolean;
      idade?: number;
    };
  },
  { uid: string }
>(fns, 'registerWithCompany');

export const adminCreateCompanyCallable = httpsCallable<
  { name: string; slug: string },
  { companyId: string; slug: string; registrationPath: string }
>(fns, 'adminCreateCompany');

export const adminDeleteCompanyCallable = httpsCallable<{ companyId: string }, { ok: boolean }>(
  fns,
  'adminDeleteCompany'
);

export const adminUpdateCompanyConfigCallable = httpsCallable<
  {
    companyId: string;
    roles: Array<{ id: string; label: string }>;
    departments: Array<{ id: string; label: string }>;
    allowedEmailDomains?: string[];
  },
  { ok: boolean; keyCount: number; registrationPath: string }
>(fns, 'adminUpdateCompanyConfig');

export const adminCreateVendedorCallable = httpsCallable<
  {
    email: string;
    name: string;
    provisionalPassword: string;
    managedCompanyIds?: string[];
  },
  { uid: string; email: string }
>(fns, 'adminCreateVendedor');

export const adminUpdateVendedorCompaniesCallable = httpsCallable<
  { vendedorUid: string; managedCompanyIds: string[] },
  { ok: boolean }
>(fns, 'adminUpdateVendedorCompanies');

export const adminDeleteVendedorCallable = httpsCallable<{ vendedorUid: string }, { ok: boolean }>(
  fns,
  'adminDeleteVendedor'
);

export const vendedorClearMustChangePasswordCallable = httpsCallable<Record<string, never>, { ok: boolean }>(
  fns,
  'vendedorClearMustChangePassword'
);

export const vendedorAcceptConfidentialityCallable = httpsCallable<{ version: string }, { ok: boolean }>(
  fns,
  'vendedorAcceptConfidentiality'
);

export const logStreamingViewCallable = httpsCallable<
  { trackId: string; entryId: string },
  { ok: boolean }
>(fns, 'logStreamingView');

export const getModuleCompletionFeedbackCallable = httpsCallable<
  { courseId: string; moduleId: string },
  {
    hasGradedQuestions: boolean;
    correct: number;
    total: number;
    details: Array<{
      questionId: string;
      prompt: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      correctOptionIndex: number;
      userOptionIndex: number | null;
    }>;
  }
>(fns, 'getModuleCompletionFeedback');

export const deleteMyAccountCallable = httpsCallable<Record<string, never>, { ok: boolean }>(
  fns,
  'deleteMyAccount'
);

export const streamingAssistantChatCallable = httpsCallable<
  {
    messages: Array<{ role: 'user' | 'model'; content: string }>;
    /** Vídeo em destaque na home (opcional). */
    focusEntryId?: string;
    focusTrackId?: string;
    /** Página de curso: reforço anti-resposta a avaliações no servidor. */
    courseId?: string;
    courseTitle?: string;
    /** Modo "Saiba mais" — transcrição Vimeo deste passo como contexto prioritário. */
    courseVideoFocus?: {
      moduleId: string;
      stepId: string;
      vimeoUrl: string;
      title: string;
      body?: string;
    };
  },
  { reply: string }
>(fns, 'streamingAssistantChat');

export function mapCallableError(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = String((err as { code: string }).code);
    const msg = (err as { message?: string }).message ?? '';
    if (code === 'functions/invalid-argument') return msg || 'Dados inválidos.';
    if (code === 'functions/permission-denied') return msg || 'Sem permissão ou chave incorreta.';
    if (code === 'functions/not-found')
      return (
        msg ||
        'Função ou empresa não encontrada. Se a função ainda não foi publicada (ex.: plano Blaze), o cadastro por link não funciona.'
      );
    if (code === 'functions/already-exists') return msg || 'Já cadastrado.';
    if (code === 'functions/failed-precondition') {
      if (/GOOGLE_API_KEY|secret.*GEMINI|configure.*secret/i.test(msg)) {
        return (
          'O assistente de vídeos não está ativo no servidor: falta configurar a chave Gemini (secret GOOGLE_API_KEY) e voltar a publicar as Cloud Functions. ' +
          'Quem gere o Firebase deve seguir `functions/.env.example` na raiz da pasta `functions`. Até lá, use a lista de vídeos na página.'
        );
      }
      return msg || 'Não é possível concluir.';
    }
    if (code === 'functions/unauthenticated')
      return msg || 'Inicie sessão para usar o assistente.';
    if (code === 'functions/resource-exhausted')
      return msg || 'Limite diário do assistente atingido. Tente após a meia-noite (horário de Brasília).';
    if (code === 'functions/internal' || code === 'functions/unavailable')
      return (
        msg ||
        'Servidor de funções indisponível ou erro interno. Confira se as Cloud Functions foram publicadas e se VITE_FIREBASE_FUNCTIONS_REGION está correto.'
      );
    if (code === 'functions/deadline-exceeded') return msg || 'Tempo esgotado. Tente de novo.';
    if (msg) return msg;
  }
  return 'Não foi possível concluir. Tente novamente. (F12 → Consola / Rede para detalhes.)';
}
