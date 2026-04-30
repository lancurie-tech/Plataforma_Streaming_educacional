import type { SurveyResponse } from '@/features/saude-mental/typesSurvey';
import {
  calculateAlertPercent,
  calculateNeutralPercent,
  calculatePositivePercent,
  calculateQuestionStats,
} from '@/features/saude-mental/surveyAnalysis';

/** Painel “área da mulher” (Q9, Q10) — mesmo recorte do dashboard de referência. */
export function computeWomenPanel(currentData: SurveyResponse[]) {
  if (currentData.length === 0) return undefined;
  const female = currentData.filter((row) => row.sexo === 'Feminino');
  const male = currentData.filter((row) => row.sexo === 'Masculino');

  const makeComposite = (rows: SurveyResponse[]) => {
    const values = rows
      .flatMap((row) => [row.q9, row.q10])
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : Number.NaN;
    return Number.isNaN(mean)
      ? undefined
      : {
          mean,
          positivePercent: calculatePositivePercent(values),
          neutralPercent: calculateNeutralPercent(values),
          negativePercent: calculateAlertPercent(values),
        };
  };

  const femaleQ9 = calculateQuestionStats(female, 'q9');
  const femaleQ10 = calculateQuestionStats(female, 'q10');
  const maleQ9 = calculateQuestionStats(male, 'q9');
  const maleQ10 = calculateQuestionStats(male, 'q10');
  const totalQ9 = calculateQuestionStats(currentData, 'q9');
  const totalQ10 = calculateQuestionStats(currentData, 'q10');

  return {
    female: {
      q9: Number.isNaN(femaleQ9.mean) ? undefined : femaleQ9,
      q10: Number.isNaN(femaleQ10.mean) ? undefined : femaleQ10,
      composite: makeComposite(female),
    },
    male: {
      q9: Number.isNaN(maleQ9.mean) ? undefined : maleQ9,
      q10: Number.isNaN(maleQ10.mean) ? undefined : maleQ10,
      composite: makeComposite(male),
    },
    total: {
      q9: Number.isNaN(totalQ9.mean) ? undefined : totalQ9,
      q10: Number.isNaN(totalQ10.mean) ? undefined : totalQ10,
      composite: makeComposite(currentData),
    },
  };
}

/** Segunda jornada — compara quem respondeu sim vs não (Q9/Q10). */
export function computeSecondShiftPanel(currentData: SurveyResponse[]) {
  if (currentData.length === 0) return undefined;
  const uniqueMap = new Map<string, SurveyResponse>();
  currentData.forEach((row) => {
    const key = `${row.empresa_id}-${row.participante_id}`;
    const existing = uniqueMap.get(key);
    if (!existing) {
      uniqueMap.set(key, row);
      return;
    }
    uniqueMap.set(key, {
      ...existing,
      segunda_jornada: existing.segunda_jornada === true || row.segunda_jornada === true,
      sexo: existing.sexo || row.sexo,
    });
  });
  const uniqueRows = Array.from(uniqueMap.values());
  const yes = uniqueRows.filter((row) => row.segunda_jornada === true);
  const no = uniqueRows.filter((row) => row.segunda_jornada === false);
  const yesQ9 = calculateQuestionStats(yes, 'q9');
  const yesQ10 = calculateQuestionStats(yes, 'q10');
  const noQ9 = calculateQuestionStats(no, 'q9');
  const noQ10 = calculateQuestionStats(no, 'q10');

  const makeComposite = (q9: typeof yesQ9, q10: typeof yesQ10) => {
    if (!q9 || !q10 || Number.isNaN(q9.mean) || Number.isNaN(q10.mean)) return undefined;
    return { mean: (q9.mean + q10.mean) / 2 };
  };

  return {
    yes: {
      q9: Number.isNaN(yesQ9.mean) ? undefined : yesQ9,
      q10: Number.isNaN(yesQ10.mean) ? undefined : yesQ10,
      composite: makeComposite(yesQ9, yesQ10),
      count: yes.length,
    },
    no: {
      q9: Number.isNaN(noQ9.mean) ? undefined : noQ9,
      q10: Number.isNaN(noQ10.mean) ? undefined : noQ10,
      composite: makeComposite(noQ9, noQ10),
      count: no.length,
    },
  };
}
