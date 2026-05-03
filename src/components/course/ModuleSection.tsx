import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/useAuth';
import {
  ChevronDown,
  CircleCheck,
  FileDown,
  ListVideo,
  ClipboardList,
  Paperclip,
  Lock,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useBrand } from '@/contexts/useBrand';
import { buildVimeoPlayerEmbedSrc } from '@/lib/vimeo';
import { getUserModuleSubmission, saveUserModuleSubmission } from '@/lib/firestore/courses';
import { getModuleCompletionFeedbackCallable } from '@/lib/firebase/callables';
import {
  clearModuleDraftLocal,
  loadModuleDraftLocal,
  saveModuleDraftLocal,
} from '@/lib/moduleDraftLocal';
import { issueCertificateIfEligible } from '@/lib/firestore/certificates';
import { computeStudentModuleView } from '@/lib/courseVisibility';
import {
  LEGACY_PROGRESS_KEY,
  canFinalizeStepModule,
  getStepProgressForIndex,
  isLegacyModuleSatisfied,
  maxUnlockedStepIndex,
  stepProgressStorageKey,
} from '@/lib/courseModuleProgress';
import type {
  ModuleContent,
  ModuleMaterialLink,
  ModuleStep,
  ModuleStepKind,
  ModuleStepProgress,
  QuestionDef,
} from '@/types';
import { Button } from '@/components/ui/Button';
import { ModuleStepNavScroller, VerticalScrollArrows } from '@/components/course/VerticalScrollArrows';
import { StepVideoWithProgress } from '@/components/course/StepVideoWithProgress';
import {
  useAssistantChatPanelOptional,
  useAssistantCourseOptional,
} from '@/components/layout/PublicLayout';

/** id_modulo no cache de transcrição do assistente para vídeo “legado” (sem passos). */
const LEGACY_COURSE_VIDEO_STEP_ID = '__legacy_video__';

type Props = {
  courseId: string;
  uid: string;
  module: ModuleContent;
  /** Admin / demo: ignora travas e gravação. */
  previewMode?: boolean;
  accordionOpenModuleId?: string | null;
  onToggleAccordion?: (moduleId: string) => void;
  onModuleFinished?: (moduleId: string) => void;
  /** Abre o próximo módulo no acordeão e rola até ele (lista do curso). */
  onGoToNextModule?: () => void;
  /** Aluno: módulo só abre após concluir o anterior na ordem do curso. */
  isModuleLocked?: boolean;
  /** Texto sob o título quando `isModuleLocked` (ex.: calendário da empresa). */
  moduleLockExplanation?: string;
  /** Ancora para `scrollIntoView` ao abrir o módulo seguinte (ex.: `course-module-{id}`). */
  scrollAnchorId?: string;
  /** Próximo módulo na trilha (mensagem ao concluir). */
  afterFinishNextModule?: { title: string; unlocked: boolean } | null;
};

function stepKindLabel(kind: ModuleStepKind, title: string): string {
  if (kind === 'video') return 'Vídeo';
  if (kind === 'quiz') return 'Questões';
  if (/anexo/i.test(title)) return 'Anexos';
  return 'Materiais';
}

function StepIcon({ kind, title }: { kind: ModuleStepKind; title: string }) {
  if (kind === 'video') return <ListVideo size={16} className="shrink-0 text-zinc-500" />;
  if (kind === 'quiz') return <ClipboardList size={16} className="shrink-0 text-zinc-500" />;
  if (/anexo/i.test(title)) return <Paperclip size={16} className="shrink-0 text-zinc-500" />;
  return <FileDown size={16} className="shrink-0 text-zinc-500" />;
}

function StepMaterials({
  step,
  materials,
  materialsSatisfied,
  onConfirmRead,
  previewMode,
}: {
  step: ModuleStep;
  materials: ModuleMaterialLink[];
  materialsSatisfied: boolean;
  onConfirmRead: () => void;
  previewMode: boolean;
}) {
  const needsConfirm =
    !previewMode &&
    !materialsSatisfied &&
    (materials.length > 0 || !!step.body?.trim());

  return (
    <div className="space-y-6">
      {step.body ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-zinc-300">{step.body}</p>
        </div>
      ) : null}
      {materials.length === 0 ? null : (
        <ul className="space-y-5">
          {materials.map((item, i) => (
            <li
              key={`${item.pdfUrl}-${i}`}
              className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4"
            >
              <p className="font-medium text-zinc-100">{item.title}</p>
              {item.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">{item.description}</p>
              ) : null}
              <a
                href={item.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-emerald-400 hover:text-emerald-300"
              >
                <FileDown size={16} />
                Baixar ou visualizar
              </a>
            </li>
          ))}
        </ul>
      )}
      {needsConfirm ? (
        <div className="border-t border-zinc-800 pt-4">
          <Button type="button" variant="outline" onClick={onConfirmRead}>
            Finalizar leitura do material
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StepVideo({ step }: { step: ModuleStep }) {
  const embedSrc = buildVimeoPlayerEmbedSrc(step.vimeoUrl ?? '');
  return (
    <div className="space-y-4">
      {step.body ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-zinc-300">{step.body}</p>
        </div>
      ) : null}
      {embedSrc ? (
        <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black">
          <iframe
            title={step.title}
            src={embedSrc}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
          />
        </div>
      ) : step.vimeoUrl ? (
        <p className="text-sm text-amber-400/90">Link de vídeo inválido ou formato não suportado.</p>
      ) : null}
      {!embedSrc && step.vimeoUrl ? (
        <p className="text-xs text-zinc-500">
          Vídeos privados do Vimeo precisam do link completo (com o código após o ID), como no painel do
          Vimeo.
        </p>
      ) : null}
    </div>
  );
}

/** Modo revisão: mostra marcação inicial vs gabarito; novas escolhas ficam só no dispositivo (não regravam o módulo). */
type QuizPracticeReview = {
  firstPickByQuestionId: Record<string, number>;
  correctIndexByQuestionId: Record<string, number>;
};

function ObjectiveQuizPager({
  questions,
  answers,
  onChoice,
  namePrefix,
  linearFlow,
  readOnly,
  practiceReview,
}: {
  questions: QuestionDef[];
  answers: Record<string, number>;
  onChoice: (questionId: string, optionIndex: number) => void;
  namePrefix: string;
  linearFlow?: boolean;
  /** Módulo já concluído: só leitura até entrar em modo revisão. */
  readOnly?: boolean;
  practiceReview?: QuizPracticeReview | null;
}) {
  const [index, setIndex] = useState(0);

  const total = questions.length;
  if (total === 0) return null;

  const safeIndex = Math.min(index, total - 1);
  const q = questions[safeIndex]!;
  const answered = answers[q.id] !== undefined;
  const isLast = safeIndex === total - 1;
  const radioGroup = `${namePrefix}-q-${q.id}`;
  const rev = practiceReview;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
        <h3 className="text-sm font-medium uppercase tracking-wide text-zinc-500">Questões objetivas</h3>
        <span className="shrink-0 text-sm tabular-nums text-zinc-400">
          {safeIndex + 1} / {total}
        </span>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium text-zinc-200">{q.prompt}</legend>
        <div className="space-y-2 pl-0">
          {q.options.map((opt, oi) => {
            const firstPick = rev?.firstPickByQuestionId[q.id];
            const correctIdx = rev?.correctIndexByQuestionId[q.id];
            const wasFirstWrong =
              rev &&
              typeof firstPick === 'number' &&
              typeof correctIdx === 'number' &&
              firstPick === oi &&
              firstPick !== correctIdx;
            const isCorrectOption = rev && typeof correctIdx === 'number' && correctIdx === oi;
            return (
              <label
                key={oi}
                className={clsx(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  rev
                    ? clsx(
                        'cursor-pointer',
                        wasFirstWrong &&
                          'border-red-500/60 bg-red-500/10 ring-1 ring-red-500/50',
                        isCorrectOption &&
                          'border-emerald-500/70 bg-emerald-500/10 ring-2 ring-emerald-500/60',
                        !wasFirstWrong && !isCorrectOption && 'border-zinc-700/80 hover:bg-zinc-800/50',
                      )
                    : 'cursor-pointer border-zinc-700/80 hover:bg-zinc-800/50 has-checked:border-emerald-600/50 has-checked:bg-emerald-500/5',
                )}
              >
                <input
                  type="radio"
                  name={radioGroup}
                  checked={answers[q.id] === oi}
                  onChange={() => onChoice(q.id, oi)}
                  disabled={readOnly && !rev}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600 disabled:opacity-60"
                />
                <span className="min-w-0 flex-1 text-sm leading-snug text-zinc-300">{opt}</span>
                <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                  {wasFirstWrong ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-red-300/90">
                      Sua marcação
                    </span>
                  ) : null}
                  {isCorrectOption ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-300/90">
                      Correta
                    </span>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          type="button"
          variant="outline"
          className="text-xs sm:text-sm"
          disabled={safeIndex <= 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          Anterior
        </Button>
        {!isLast ? (
          <Button
            type="button"
            className="text-xs sm:text-sm"
            disabled={!answered}
            onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
          >
            Próxima
          </Button>
        ) : linearFlow ? null : (
          <p className="max-w-md text-xs text-zinc-500">
            {readOnly && !rev
              ? 'Módulo concluído. Reabra o módulo e use o aviso ao concluir para revisar as questões, se desejar.'
              : rev
                ? 'Teste outras alternativas, compare com a opção indicada e, ao terminar, use o botão abaixo para seguir.'
                : 'Quando terminar, use o botão abaixo para registrar as respostas deste módulo.'}
          </p>
        )}
      </div>
    </div>
  );
}

function StepQuiz({
  step,
  questions,
  answers,
  onChoice,
  linearFlow,
  readOnly,
  practiceReview,
}: {
  step: ModuleStep;
  questions: QuestionDef[];
  answers: Record<string, number>;
  onChoice: (questionId: string, optionIndex: number) => void;
  linearFlow?: boolean;
  readOnly?: boolean;
  practiceReview?: QuizPracticeReview | null;
}) {
  return (
    <div className="space-y-6">
      {step.body ? (
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-zinc-300">{step.body}</p>
        </div>
      ) : null}
      <ObjectiveQuizPager
        key={questions.map((q) => q.id).join('|')}
        questions={questions}
        answers={answers}
        onChoice={onChoice}
        namePrefix={`m-step-${step.id}`}
        linearFlow={linearFlow}
        readOnly={readOnly}
        practiceReview={practiceReview}
      />
    </div>
  );
}

export function ModuleSection({
  courseId,
  uid,
  module,
  previewMode = false,
  accordionOpenModuleId,
  onToggleAccordion,
  onModuleFinished,
  onGoToNextModule,
  isModuleLocked = false,
  moduleLockExplanation = 'Conclua o módulo anterior para desbloquear este.',
  scrollAnchorId,
  afterFinishNextModule = null,
}: Props) {
  const brand = useBrand();
  const { profile, hasModule } = useAuth();
  const courseAiChatEnabled =
    previewMode || (hasModule('cursos') && hasModule('chat'));
  const assistantLayout = useAssistantCourseOptional();
  const assistantChatPanel = useAssistantChatPanelOptional();
  const [internalOpen, setInternalOpen] = useState(false);
  const parentAccordion = !previewMode && typeof onToggleAccordion === 'function';
  const open = parentAccordion ? accordionOpenModuleId === module.id : internalOpen;

  function toggleOpen() {
    if (previewMode || !parentAccordion) {
      setInternalOpen((o) => !o);
      return;
    }
    onToggleAccordion(module.id);
  }
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [stepProgress, setStepProgress] = useState<Record<string, ModuleStepProgress>>({});
  const [completed, setCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [completionFeedback, setCompletionFeedback] = useState<{
    correct: number;
    total: number;
    details: Array<{
      questionId?: string;
      prompt: string;
      userAnswer: string;
      correctAnswer: string;
      isCorrect: boolean;
      correctOptionIndex?: number;
      userOptionIndex?: number | null;
    }>;
  } | null>(null);
  /**
   * Só mostra o modal de parabéns após concluir o módulo nesta sessão (handleSave).
   * Carregar módulo já concluído do Firestore não deve reabrir o modal ao expandir o acordeão.
   */
  const [pendingCompletionCelebration, setPendingCompletionCelebration] = useState(false);
  /** Revisão: escolhas extras só no estado local (não regravam a conclusão do módulo). */
  const [quizPracticeMode, setQuizPracticeMode] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [practiceRevisionScore, setPracticeRevisionScore] = useState<{ correct: number; total: number } | null>(
    null,
  );
  const [stepIndex, setStepIndex] = useState(0);
  const userEditedRef = useRef(false);
  /** Evita avanço automático duplicado ao mesmo passo (voltar ao sumário e cumprir de novo). */
  const stepAutoNavOnceRef = useRef<Set<string>>(new Set());

  const ctx = useMemo(() => ({ previewMode, profile }), [previewMode, profile]);
  const view = useMemo(() => computeStudentModuleView(module, ctx), [module, ctx]);
  const {
    showInCourseList,
    useSteps,
    visibleSteps,
    quizQuestions,
    visibleLegacyQuestions,
    gateModule,
    seeMat,
    seeQInStep,
  } = view;

  const currentStep = visibleSteps[stepIndex];

  const visibleStepsRef = useRef(visibleSteps);
  visibleStepsRef.current = visibleSteps;
  const stepIndexRef = useRef(stepIndex);
  stepIndexRef.current = stepIndex;

  const legacyEmbedSrc = buildVimeoPlayerEmbedSrc(module.vimeoUrl ?? '');

  const maxUnlockedIdx = useMemo(() => {
    if (previewMode || completed || visibleSteps.length === 0) {
      return visibleSteps.length - 1;
    }
    return maxUnlockedStepIndex(visibleSteps, answers, stepProgress, seeQInStep, seeMat);
  }, [previewMode, completed, visibleSteps, answers, stepProgress, seeQInStep, seeMat]);

  const canFinalize = useMemo(() => {
    if (previewMode || completed) return false;
    if (useSteps && visibleSteps.length > 0) {
      return canFinalizeStepModule(visibleSteps, quizQuestions, answers, stepProgress, seeQInStep, seeMat);
    }
    return isLegacyModuleSatisfied(
      module,
      visibleLegacyQuestions,
      answers,
      stepProgress[LEGACY_PROGRESS_KEY],
      Boolean(legacyEmbedSrc),
      Boolean(module.pdfUrl?.trim())
    );
  }, [
    previewMode,
    completed,
    useSteps,
    visibleSteps,
    quizQuestions,
    answers,
    stepProgress,
    seeQInStep,
    seeMat,
    module,
    visibleLegacyQuestions,
    legacyEmbedSrc,
  ]);

  useEffect(() => {
    if (previewMode || completed) return;
    setStepIndex((i) => Math.min(i, Math.max(0, maxUnlockedIdx)));
  }, [maxUnlockedIdx, previewMode, completed]);

  useEffect(() => {
    if (previewMode) {
      setLoading(false);
      setAnswers({});
      setStepProgress({});
      setCompleted(false);
      setCompletionFeedback(null);
      setPendingCompletionCelebration(false);
      userEditedRef.current = false;
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const sub = await getUserModuleSubmission(uid, courseId, module.id);
        const localDraft = loadModuleDraftLocal(uid, courseId, module.id);
        if (cancelled) return;
        userEditedRef.current = false;

        if (sub?.status === 'completed') {
          clearModuleDraftLocal(uid, courseId, module.id);
          setAnswers(sub.answers ?? {});
          setStepProgress(sub.stepProgress ?? {});
          setCompleted(true);
          setStepIndex(0);
          try {
            const { data } = await getModuleCompletionFeedbackCallable({
              courseId,
              moduleId: module.id,
            });
            if (data?.hasGradedQuestions && data.total > 0) {
              setCompletionFeedback({
                correct: data.correct,
                total: data.total,
                details: data.details,
              });
            } else {
              setCompletionFeedback(null);
            }
          } catch {
            setCompletionFeedback(null);
          }
          setPendingCompletionCelebration(false);
          return;
        }

        setCompleted(false);
        setCompletionFeedback(null);
        setPendingCompletionCelebration(false);
        if (localDraft) {
          setAnswers(localDraft.answers ?? {});
          setStepProgress(localDraft.stepProgress ?? {});
          setStepIndex(
            typeof localDraft.stepIndex === 'number' && localDraft.stepIndex >= 0
              ? localDraft.stepIndex
              : 0
          );
        } else if (sub) {
          setAnswers(sub.answers ?? {});
          setStepProgress(sub.stepProgress ?? {});
          setStepIndex(0);
        } else {
          setAnswers({});
          setStepProgress({});
          setStepIndex(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [uid, courseId, module.id, previewMode]);

  useEffect(() => {
    if (previewMode || completed || loading) return;
    const t = setTimeout(() => {
      saveModuleDraftLocal(uid, courseId, module.id, {
        v: 1,
        answers,
        stepProgress,
        stepIndex,
        savedAt: Date.now(),
      });
    }, 500);
    return () => clearTimeout(t);
  }, [stepProgress, answers, stepIndex, previewMode, completed, loading, uid, courseId, module.id]);

  useEffect(() => {
    stepAutoNavOnceRef.current.clear();
  }, [module.id, open]);

  useEffect(() => {
    if (visibleSteps.length === 0) return;
    setStepIndex((i) => (i >= visibleSteps.length ? 0 : i));
  }, [visibleSteps.length]);

  useEffect(() => {
    setQuizPracticeMode(false);
    setPracticeAnswers({});
    setPracticeRevisionScore(null);
  }, [module.id]);

  const quizDisplayAnswers = completed && quizPracticeMode ? practiceAnswers : answers;
  const quizReadOnly = Boolean(completed && !quizPracticeMode && !previewMode);

  const quizPracticeReviewPayload = useMemo((): QuizPracticeReview | null => {
    if (!completed || !quizPracticeMode || !completionFeedback?.details?.length) return null;
    const correctIndexByQuestionId: Record<string, number> = {};
    for (const d of completionFeedback.details) {
      if (d.questionId && typeof d.correctOptionIndex === 'number') {
        correctIndexByQuestionId[d.questionId] = d.correctOptionIndex;
        continue;
      }
      const q = quizQuestions.find((x) => x.prompt.trim() === d.prompt.trim());
      if (q) {
        const ci = q.options.findIndex((o) => o === d.correctAnswer);
        if (ci >= 0) correctIndexByQuestionId[q.id] = ci;
      }
    }
    if (Object.keys(correctIndexByQuestionId).length === 0) return null;
    return {
      firstPickByQuestionId: { ...answers },
      correctIndexByQuestionId,
    };
  }, [completed, quizPracticeMode, completionFeedback, answers, quizQuestions]);

  /** Deve permanecer com os demais hooks — antes de qualquer `return` antecipado do componente. */
  const showCompletionCelebrationModal =
    pendingCompletionCelebration &&
    !previewMode &&
    completed &&
    completionFeedback !== null &&
    open &&
    !quizPracticeMode;

  useEffect(() => {
    if (!open) setPendingCompletionCelebration(false);
  }, [open]);

  useEffect(() => {
    if (!showCompletionCelebrationModal) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showCompletionCelebrationModal]);

  const markEdited = useCallback(() => {
    userEditedRef.current = true;
  }, []);

  function setChoice(questionId: string, optionIndex: number) {
    if (completed) {
      if (!quizPracticeMode) return;
      setPracticeAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
      setMsg(null);
      return;
    }
    markEdited();
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
    setMsg(null);
  }

  function startQuizReview() {
    if (!completionFeedback?.details?.length) return;
    setPendingCompletionCelebration(false);
    setPracticeAnswers({ ...answers });
    setPracticeRevisionScore(null);
    setQuizPracticeMode(true);
    if (useSteps) {
      const idx = visibleSteps.findIndex((s) => s.kind === 'quiz');
      if (idx >= 0) {
        setStepIndex(idx);
        window.setTimeout(() => {
          document
            .getElementById(`quiz-practice-anchor-${module.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
      }
    } else if (visibleLegacyQuestions.length > 0) {
      window.setTimeout(() => {
        document
          .getElementById(`quiz-practice-legacy-${module.id}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 120);
    }
  }

  function finalizePracticeRevision() {
    const fb = completionFeedback;
    if (!fb?.details.length) return;
    let correct = 0;
    let total = 0;
    for (const d of fb.details) {
      let qid = d.questionId;
      let correctIdx: number | undefined =
        typeof d.correctOptionIndex === 'number' ? d.correctOptionIndex : undefined;
      if (!qid || correctIdx === undefined) {
        const q = quizQuestions.find((x) => x.prompt.trim() === d.prompt.trim());
        if (q) {
          qid = q.id;
          if (correctIdx === undefined) {
            const ci = q.options.findIndex((o) => o === d.correctAnswer);
            if (ci >= 0) correctIdx = ci;
          }
        }
      }
      if (!qid || correctIdx === undefined) continue;
      total++;
      if (practiceAnswers[qid] === correctIdx) correct++;
    }
    if (total === 0) return;
    setPracticeRevisionScore({ correct, total });
  }

  function finalizeReviewAndGoNext() {
    finalizePracticeRevision();
    if (afterFinishNextModule?.unlocked && onGoToNextModule) {
      window.setTimeout(() => onGoToNextModule(), 80);
    }
  }

  const markVideoWatchedToEnd = useCallback(
    (storageKey: string) => {
      markEdited();
      setStepProgress((prev) => {
        if (prev[storageKey]?.videoWatchedToEnd === true) return prev;
        return { ...prev, [storageKey]: { ...prev[storageKey], videoWatchedToEnd: true } };
      });
    },
    [markEdited],
  );

  function confirmMaterialsAtIndex(idx: number) {
    markEdited();
    const sk = stepProgressStorageKey(visibleSteps, idx);
    setStepProgress((prev) => ({
      ...prev,
      [sk]: { ...prev[sk], materialsDone: true },
    }));
    setMsg(null);
    if (idx >= 0 && idx < visibleSteps.length - 1) {
      window.setTimeout(() => {
        setStepIndex(idx + 1);
      }, 0);
    }
  }

  const handleVideoPlaybackEnded = useCallback(() => {
    if (previewMode || completed || !open || loading || !useSteps) return;
    const steps = visibleStepsRef.current;
    const idx = stepIndexRef.current;
    const st = steps[idx];
    if (!st || st.kind !== 'video') return;
    if (idx >= steps.length - 1) return;
    const sk = stepProgressStorageKey(steps, idx);
    const onceKey = `auto:${sk}:videoEnded`;
    if (stepAutoNavOnceRef.current.has(onceKey)) return;
    stepAutoNavOnceRef.current.add(onceKey);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
    setMsg(null);
  }, [previewMode, completed, open, loading, useSteps]);

  useEffect(() => {
    if (previewMode || completed || !open || loading || !useSteps) return;
    const st = visibleSteps[stepIndex];
    if (!st || st.kind !== 'quiz') return;
    const qs = st.questions?.filter((q) => seeQInStep(st, q)) ?? [];
    if (qs.length === 0) return;
    if (!qs.every((q) => answers[q.id] !== undefined)) return;
    if (stepIndex >= visibleSteps.length - 1) return;
    const key = `auto:${stepProgressStorageKey(visibleSteps, stepIndex)}:quiz`;
    if (stepAutoNavOnceRef.current.has(key)) return;
    const t = window.setTimeout(() => {
      stepAutoNavOnceRef.current.add(key);
      setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
      setMsg(null);
    }, 400);
    return () => clearTimeout(t);
  }, [
    stepIndex,
    answers,
    visibleSteps,
    seeQInStep,
    open,
    loading,
    previewMode,
    completed,
    useSteps,
  ]);

  async function handleSave() {
    if (previewMode) return;
    if (!canFinalize) {
      setMsg('Ainda há conteúdo pendente neste módulo.');
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      await saveUserModuleSubmission(uid, courseId, module.id, {
        answers,
        stepProgress,
      });
      clearModuleDraftLocal(uid, courseId, module.id);
      setCompleted(true);
      onModuleFinished?.(module.id);
      if (!previewMode && profile?.role !== 'admin') {
        const name = profile?.name ?? '';
        void issueCertificateIfEligible(uid, courseId, name, profile).catch(() => {});
      }

      try {
        const { data } = await getModuleCompletionFeedbackCallable({
          courseId,
          moduleId: module.id,
        });
        if (data?.hasGradedQuestions && data.total > 0) {
          setCompletionFeedback({
            correct: data.correct,
            total: data.total,
            details: data.details,
          });
          setPendingCompletionCelebration(true);
        } else {
          setCompletionFeedback(null);
          setPendingCompletionCelebration(false);
        }
      } catch {
        setCompletionFeedback(null);
        setPendingCompletionCelebration(false);
      }
    } catch {
      setMsg('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function renderFinalizeBlock() {
    const showMsg = Boolean(msg);
    const showPreviewNote = previewMode;
    const showCompletedNote = !previewMode && completed;
    const showFinalizeBtn = !previewMode && !completed && canFinalize;
    if (!showMsg && !showPreviewNote && !showCompletedNote && !showFinalizeBtn) {
      return null;
    }

    return (
      <div className="border-t border-zinc-800 pt-6">
        {showMsg ? (
          <p
            className={clsx(
              'text-sm',
              completed && msg?.includes('sucesso') ? 'text-emerald-400' : 'text-amber-400',
            )}
          >
            {msg}
          </p>
        ) : null}
        {showPreviewNote ? (
          <p className="text-sm text-zinc-500">
            Pré-visualização: você pode marcar as opções, mas nada é gravado no sistema.
          </p>
        ) : null}
        {showCompletedNote && completionFeedback ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">
              Um resumo do questionário foi mostrado ao concluir o módulo. Você pode voltar ao questionário quando
              quiser para revisar o conteúdo e fixar o aprendizado.
            </p>
            {afterFinishNextModule ? (
              afterFinishNextModule.unlocked ? (
                <p className="text-xs text-zinc-400">
                  Próximo módulo: <strong className="text-zinc-200">{afterFinishNextModule.title}</strong>
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  Quando <strong className="text-zinc-300">{afterFinishNextModule.title}</strong> estiver disponível para a
                  sua empresa, você poderá continuar.
                </p>
              )
            ) : (
              <p className="text-xs text-zinc-500">Você concluiu a trilha deste curso neste ponto.</p>
            )}
          </div>
        ) : showCompletedNote ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-5 py-4">
            <p className="text-base font-semibold text-emerald-300">
              Parabéns! Você concluiu o módulo {module.title}.
            </p>
            <p className="mt-2 text-sm text-zinc-400">
              Módulo concluído com sucesso. Você pode revisar qualquer item pelo sumário.
            </p>
            {afterFinishNextModule ? (
              afterFinishNextModule.unlocked ? (
                <p className="mt-2 text-xs text-zinc-400">
                  Você pode seguir para <strong className="text-zinc-200">{afterFinishNextModule.title}</strong>.
                </p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">
                  Quando <strong className="text-zinc-300">{afterFinishNextModule.title}</strong> estiver disponível, você
                  poderá continuar.
                </p>
              )
            ) : (
              <p className="mt-2 text-xs text-zinc-500">Você concluiu a trilha deste curso neste ponto.</p>
            )}
          </div>
        ) : null}
        {showFinalizeBtn ? (
          <Button type="button" onClick={() => void handleSave()} isLoading={saving} disabled={saving}>
            Finalizar módulo
          </Button>
        ) : null}
      </div>
    );
  }

  if (!showInCourseList) {
    return null;
  }

  if (isModuleLocked && !previewMode) {
    return (
      <section
        id={scrollAnchorId}
        className="scroll-mt-40 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50 sm:scroll-mt-44"
      >
        <div className="flex w-full items-center gap-4 px-5 py-4 text-left">
          <Lock className="shrink-0 text-amber-500/90" size={20} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-zinc-300">{module.title}</p>
            <p className="mt-1 text-xs text-zinc-500">{moduleLockExplanation}</p>
          </div>
        </div>
      </section>
    );
  }

  const materialsSatisfiedForCurrent =
    currentStep?.kind === 'materials'
      ? (getStepProgressForIndex(visibleSteps, stepIndex, stepProgress)?.materialsDone ?? false)
      : false;

  const linearQuizFlow = Boolean(useSteps && visibleSteps.length > 0 && !previewMode && !completed);

  return (
    <>
    <section
      id={scrollAnchorId}
      className="scroll-mt-40 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40 sm:scroll-mt-44"
    >
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-800/40"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="truncate font-medium text-zinc-100">{module.title}</span>
          {!previewMode && completed ? (
            <CircleCheck className="shrink-0 text-emerald-500" size={20} aria-label="Concluído" />
          ) : null}
        </div>
        <ChevronDown
          size={22}
          className={clsx('shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="border-t border-zinc-800">
          {loading ? (
            <p className="px-5 py-6 text-sm text-zinc-500">Carregando…</p>
          ) : useSteps && visibleSteps.length > 0 && currentStep ? (
            <div className="flex flex-col lg:flex-row lg:items-start">
              <aside
                className="order-2 border-t border-zinc-800 lg:order-0 lg:w-60 lg:shrink-0 lg:border-t-0 lg:border-r lg:border-zinc-800 xl:w-64"
                aria-label="Sumário do módulo"
              >
                <details className="group lg:[&>summary]:hidden lg:open" open>
                <summary className="flex cursor-pointer list-none items-center justify-between border-b border-zinc-800/80 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-500 [&::-webkit-details-marker]:hidden">
                  Conteúdo do módulo
                  <ChevronDown size={16} className="shrink-0 transition-transform group-open:rotate-180 lg:hidden" />
                </summary>
                <nav aria-label="Passos do módulo">
                  <ModuleStepNavScroller
                    scrollKey={`${module.id}:${visibleSteps.map((s) => s.id).join('|')}`}
                  >
                    <ul className="py-2">
                    {visibleSteps.map((st, i) => {
                      const stepLocked = !previewMode && !completed && i > maxUnlockedIdx;
                      return (
                        <li key={st.id}>
                          <button
                            type="button"
                            onClick={() => {
                              if (stepLocked) {
                                setMsg('Continue pelo conteúdo na ordem do sumário.');
                                return;
                              }
                              setStepIndex(i);
                              setMsg(null);
                            }}
                            className={clsx(
                              'flex w-full items-start gap-2 px-4 py-2.5 text-left text-sm transition-colors',
                              i === stepIndex
                                ? 'bg-emerald-500/10 text-emerald-200'
                                : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200',
                              stepLocked && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-zinc-400',
                            )}
                          >
                            <span className="mt-0.5 w-5 shrink-0 text-right tabular-nums text-xs text-zinc-600">
                              {i + 1}.
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                {stepLocked ? (
                                  <Lock size={14} className="shrink-0 text-zinc-600" aria-hidden />
                                ) : (
                                  <StepIcon kind={st.kind} title={st.title} />
                                )}
                                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                                  {stepKindLabel(st.kind, st.title)}
                                </span>
                              </span>
                              <span className="mt-0.5 block leading-snug">{st.title}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    </ul>
                  </ModuleStepNavScroller>
                </nav>
                </details>
              </aside>

              <div
                className={clsx(
                  'order-1 min-w-0 flex-1 px-5 py-6 lg:order-0',
                  'flex flex-col gap-6',
                  currentStep.kind === 'materials' && 'min-h-0 max-h-[min(78dvh,42rem)] lg:max-h-[min(70vh,40rem)]',
                )}
              >
                <header className="shrink-0 border-b border-zinc-800/80 pb-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {currentStep.title}
                  </p>
                </header>

                {currentStep.kind === 'materials' ? (
                  <VerticalScrollArrows
                    scrollKey={`${module.id}-mat-${currentStep.id}-${stepIndex}`}
                    rootClassName="relative flex min-h-0 min-w-0 flex-1 flex-col"
                    scrollClassName="min-h-0 flex-1 overflow-y-auto pr-0.5 [scrollbar-gutter:stable]"
                    ariaLabelUp="Ver conteúdo acima"
                    ariaLabelDown="Ver mais conteúdo"
                  >
                    <StepMaterials
                      step={currentStep}
                      materials={currentStep.materials?.filter((m) => seeMat(currentStep, m)) ?? []}
                      materialsSatisfied={materialsSatisfiedForCurrent}
                      onConfirmRead={() => confirmMaterialsAtIndex(stepIndex)}
                      previewMode={previewMode}
                    />
                  </VerticalScrollArrows>
                ) : null}
                {currentStep.kind === 'video' ? (
                  <div className="shrink-0">
                    {(() => {
                      const embedSrc = buildVimeoPlayerEmbedSrc(currentStep.vimeoUrl ?? '');
                      if (previewMode || !embedSrc) {
                        return <StepVideo step={currentStep} />;
                      }
                      const progressKey = stepProgressStorageKey(visibleSteps, stepIndex);
                      const videoAssistActive =
                        assistantLayout?.courseVideoAssist?.moduleId === module.id &&
                        assistantLayout?.courseVideoAssist?.stepId === currentStep.id;
                      return (
                        <div className="space-y-3">
                          <StepVideoWithProgress
                            title={currentStep.title}
                            body={currentStep.body}
                            embedSrc={embedSrc}
                            progressStorageKey={progressKey}
                            initialWatchedToEnd={
                              getStepProgressForIndex(visibleSteps, stepIndex, stepProgress)
                                ?.videoWatchedToEnd === true
                            }
                            onVideoEnded={markVideoWatchedToEnd}
                            onPlaybackEnded={handleVideoPlaybackEnded}
                            previewMode={false}
                          />
                          {assistantLayout?.setCourseVideoAssist &&
                          currentStep.vimeoUrl &&
                          courseAiChatEnabled ? (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                              <Button
                                type="button"
                                variant={videoAssistActive ? 'primary' : 'outline'}
                                className="w-full text-sm sm:w-fit"
                                onClick={() => {
                                  assistantLayout.setCourseVideoAssist({
                                    moduleId: module.id,
                                    stepId: currentStep.id,
                                    vimeoUrl: currentStep.vimeoUrl!,
                                    title: currentStep.title,
                                    body: currentStep.body,
                                  });
                                  assistantChatPanel?.setOpen(true);
                                }}
                              >
                                <span className="sm:hidden">{videoAssistActive ? 'Mentor ativo' : 'Pedir ajuda ao Mentor'}</span>
                                <span className="hidden sm:inline">{videoAssistActive
                                  ? 'Mentor ativo neste vídeo'
                                  : `Dúvidas? Solicite ajuda ao seu mentor (${brand.platformShortName})`}</span>
                              </Button>
                              {videoAssistActive ? (
                                <button
                                  type="button"
                                  className="text-left text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                                  onClick={() => assistantLayout.setCourseVideoAssist(null)}
                                >
                                  Voltar ao contexto geral do curso
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                {currentStep.kind === 'quiz' ? (
                  <div id={`quiz-practice-anchor-${module.id}`} className="scroll-mt-28 shrink-0">
                    <StepQuiz
                      step={currentStep}
                      questions={currentStep.questions?.filter((q) => seeQInStep(currentStep, q)) ?? []}
                      answers={quizDisplayAnswers}
                      onChoice={setChoice}
                      linearFlow={linearQuizFlow}
                      readOnly={quizReadOnly}
                      practiceReview={quizPracticeReviewPayload}
                    />
                    {quizPracticeMode && completionFeedback ? (
                      <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
                        <Button type="button" variant="outline" onClick={finalizeReviewAndGoNext}>
                          {afterFinishNextModule?.unlocked && onGoToNextModule
                            ? 'Finalizar revisão e passar para o próximo módulo'
                            : 'Finalizar revisão'}
                        </Button>
                        {practiceRevisionScore ? (
                          <p className="text-sm text-zinc-300">
                            Nesta revisão:{' '}
                            <span className="font-semibold text-emerald-400 tabular-nums">
                              {practiceRevisionScore.correct}
                            </span>{' '}
                            de <span className="font-semibold tabular-nums">{practiceRevisionScore.total}</span>
                            <span className="ml-1.5 text-xs text-zinc-500">
                              — bom indicador de quanto você consolidou agora.
                            </span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="shrink-0">{renderFinalizeBlock()}</div>
              </div>
            </div>
          ) : !useSteps ? (
            <div className="space-y-6 px-5 py-6">
              {gateModule ? (
                <>
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-zinc-300">{module.content}</div>
                  </div>

                  {legacyEmbedSrc ? (
                    previewMode ? (
                      <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black">
                        <iframe
                          title={module.title}
                          src={legacyEmbedSrc}
                          className="h-full w-full"
                          allow="autoplay; fullscreen; picture-in-picture"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <StepVideoWithProgress
                          title={module.title}
                          embedSrc={legacyEmbedSrc}
                          progressStorageKey={LEGACY_PROGRESS_KEY}
                          initialWatchedToEnd={stepProgress[LEGACY_PROGRESS_KEY]?.videoWatchedToEnd === true}
                          onVideoEnded={markVideoWatchedToEnd}
                          previewMode={false}
                        />
                        {assistantLayout?.setCourseVideoAssist &&
                        module.vimeoUrl &&
                        courseAiChatEnabled ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                            <Button
                              type="button"
                              variant={
                                assistantLayout.courseVideoAssist?.moduleId === module.id &&
                                assistantLayout.courseVideoAssist?.stepId === LEGACY_COURSE_VIDEO_STEP_ID
                                  ? 'primary'
                                  : 'outline'
                              }
                              className="w-full text-sm sm:w-fit"
                              onClick={() => {
                                assistantLayout.setCourseVideoAssist({
                                  moduleId: module.id,
                                  stepId: LEGACY_COURSE_VIDEO_STEP_ID,
                                  vimeoUrl: module.vimeoUrl,
                                  title: module.title,
                                  body: module.content,
                                });
                                assistantChatPanel?.setOpen(true);
                              }}
                            >
                              <span className="sm:hidden">
                                {assistantLayout.courseVideoAssist?.moduleId === module.id &&
                                assistantLayout.courseVideoAssist?.stepId === LEGACY_COURSE_VIDEO_STEP_ID
                                  ? 'Mentor ativo'
                                  : 'Pedir ajuda ao Mentor'}
                              </span>
                              <span className="hidden sm:inline">
                                {assistantLayout.courseVideoAssist?.moduleId === module.id &&
                                assistantLayout.courseVideoAssist?.stepId === LEGACY_COURSE_VIDEO_STEP_ID
                                  ? 'Mentor ativo neste vídeo'
                                  : `Dúvidas? Solicite ajuda ao seu mentor (${brand.platformShortName})`}
                              </span>
                            </Button>
                            {assistantLayout.courseVideoAssist?.moduleId === module.id &&
                            assistantLayout.courseVideoAssist?.stepId === LEGACY_COURSE_VIDEO_STEP_ID ? (
                              <button
                                type="button"
                                className="text-left text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                                onClick={() => assistantLayout.setCourseVideoAssist(null)}
                              >
                                Voltar ao contexto geral do curso
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  ) : module.vimeoUrl ? (
                    <p className="text-sm text-amber-400/90">
                      Link de vídeo inválido. Verifique o campo vimeoUrl no Firebase.
                    </p>
                  ) : null}

                  {module.pdfUrl ? (
                    <div className="space-y-3">
                      <a
                        href={module.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800"
                      >
                        <FileDown size={18} />
                        Baixar material (PDF)
                      </a>
                      {!previewMode && stepProgress[LEGACY_PROGRESS_KEY]?.materialsDone !== true ? (
                        <div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              markEdited();
                              setStepProgress((prev) => ({
                                ...prev,
                                [LEGACY_PROGRESS_KEY]: { ...prev[LEGACY_PROGRESS_KEY], materialsDone: true },
                              }));
                              setMsg(null);
                            }}
                          >
                            Confirmar que acedi ao material (PDF)
                          </Button>
                        </div>
                      ) : !previewMode && module.pdfUrl ? (
                        <p className="text-sm text-emerald-400/90">Material confirmado.</p>
                      ) : null}
                    </div>
                  ) : null}

                  {visibleLegacyQuestions.length > 0 ? (
                    <div id={`quiz-practice-legacy-${module.id}`} className="scroll-mt-28">
                      <ObjectiveQuizPager
                        key={visibleLegacyQuestions.map((q) => q.id).join('|')}
                        questions={visibleLegacyQuestions}
                        answers={quizDisplayAnswers}
                        onChoice={setChoice}
                        namePrefix={`m-legacy-${module.id}`}
                        linearFlow={!previewMode && !completed}
                        readOnly={quizReadOnly}
                        practiceReview={quizPracticeReviewPayload}
                      />
                      {quizPracticeMode && completionFeedback ? (
                        <div className="mt-5 space-y-2 border-t border-zinc-800 pt-4">
                          <Button type="button" variant="outline" onClick={finalizeReviewAndGoNext}>
                            {afterFinishNextModule?.unlocked && onGoToNextModule
                              ? 'Finalizar revisão e passar para o próximo módulo'
                              : 'Finalizar revisão'}
                          </Button>
                          {practiceRevisionScore ? (
                            <p className="text-sm text-zinc-300">
                              Nesta revisão:{' '}
                              <span className="font-semibold text-emerald-400 tabular-nums">
                                {practiceRevisionScore.correct}
                              </span>{' '}
                              de <span className="font-semibold tabular-nums">{practiceRevisionScore.total}</span>
                              <span className="ml-1.5 text-xs text-zinc-500">
                                — bom indicador de quanto você consolidou agora.
                              </span>
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}

              {renderFinalizeBlock()}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>

    {showCompletionCelebrationModal && completionFeedback ? (
      <div
        className="fixed inset-0 z-70 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`module-celebration-${module.id}`}
      >
        <div
          className="max-h-[min(88dvh,36rem)] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-emerald-400/45 bg-zinc-950/98 p-6 shadow-[0_8px_48px_rgba(16,185,129,0.25)] ring-2 ring-emerald-500/25"
          role="document"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={`module-celebration-${module.id}`} className="text-lg font-semibold text-emerald-300">
            Parabéns!
          </h2>
          <p className="mt-1 text-sm text-zinc-200">
            Você concluiu o módulo &ldquo;{module.title}&rdquo;.
          </p>
          <p className="mt-4 text-sm text-zinc-100">
            Você acertou{' '}
            <span className="font-bold text-emerald-400 tabular-nums">{completionFeedback.correct}</span> de{' '}
            <span className="font-bold tabular-nums">{completionFeedback.total}</span> questões neste módulo.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            Refazer o questionário é uma boa forma de revisar o conteúdo, comparar alternativas e fortalecer o que faz
            sentido no seu contexto — especialmente em temas sensíveis. Quando estiver pronto, pode seguir para o
            próximo módulo.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={startQuizReview}
              className="w-full min-[480px]:w-auto"
            >
              Revisar o questionário
            </Button>
            {afterFinishNextModule?.unlocked && onGoToNextModule ? (
              <Button
                type="button"
                onClick={() => {
                  setPendingCompletionCelebration(false);
                  onGoToNextModule();
                }}
                className="w-full min-[480px]:w-auto"
              >
                Ir para o próximo módulo
              </Button>
            ) : afterFinishNextModule && !afterFinishNextModule.unlocked ? (
              <p className="rounded-lg border border-zinc-700/60 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
                O próximo módulo (&ldquo;{afterFinishNextModule.title}&rdquo;) ainda não está disponível para a sua
                empresa.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
