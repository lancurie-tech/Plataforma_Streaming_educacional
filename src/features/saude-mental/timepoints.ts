import type { TimePoint } from '@/features/saude-mental/typesSurvey';

export const TIMEPOINT_LABELS: Record<TimePoint, string> = {
  T0: 'Instrumento 01',
  T1: 'Instrumento 02',
  T2: 'Instrumento 03',
};

export const TIMEPOINT_SHORT_LABELS: Record<TimePoint, string> = {
  T0: 'Início',
  T1: 'Meio do curso',
  T2: 'Fim do curso',
};
