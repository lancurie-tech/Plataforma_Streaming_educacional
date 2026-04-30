/**
 * Métricas do instrumento de autopercepção (modelo do painel Saúde Mental).
 */
import { SAUDE_MENTAL_DIMENSIONS } from '@/features/saude-mental/config';
import type {
  CompareBy,
  DimensionAnalysis,
  GroupComparison,
  SurveyResponse,
  TimePoint,
} from '@/features/saude-mental/typesSurvey';

const DIMENSIONS = SAUDE_MENTAL_DIMENSIONS.map((d) => ({
  id: d.id,
  label: d.label,
  description: d.hint,
}));

export const likertTo100 = (value: number): number => ((value - 1) / 4) * 100;

export const calculateMean = (values: number[]): number => {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

export const calculatePositivePercent = (values: number[]): number => {
  if (values.length === 0) return NaN;
  const positive = values.filter((v) => v >= 4).length;
  return (positive / values.length) * 100;
};

export const calculateAlertPercent = (values: number[]): number => {
  if (values.length === 0) return NaN;
  const alerts = values.filter((v) => v <= 2).length;
  return (alerts / values.length) * 100;
};

export const calculateNeutralPercent = (values: number[]): number => {
  if (values.length === 0) return NaN;
  const neutral = values.filter((v) => v === 3).length;
  return (neutral / values.length) * 100;
};

export const getPriority = (alertPercent: number): DimensionAnalysis['priority'] => {
  if (alertPercent >= 25) return 'Crítica';
  if (alertPercent >= 15) return 'Alta';
  if (alertPercent >= 8) return 'Média';
  return 'Baixa';
};

export const calculateDimensionAnalysis = (
  currentData: SurveyResponse[],
  baselineData: SurveyResponse[]
): DimensionAnalysis[] => {
  return DIMENSIONS.map((dim) => {
    const dimKey = dim.id as keyof SurveyResponse;
    const currentValues = currentData.map((d) => d[dimKey] as number).filter((v) => !isNaN(v));
    const baselineValues = baselineData.map((d) => d[dimKey] as number).filter((v) => !isNaN(v));

    const currentMean = calculateMean(currentValues);
    const baselineMean = calculateMean(baselineValues);

    const score = likertTo100(currentMean);
    const baselineScore = likertTo100(baselineMean);
    const delta = isNaN(baselineScore) ? 0 : score - baselineScore;

    const positivePercent = calculatePositivePercent(currentValues);
    const neutralPercent = calculateNeutralPercent(currentValues);
    const negativePercent = calculateAlertPercent(currentValues);
    const priority = getPriority(negativePercent);

    return {
      dimension: dim.label,
      description: dim.description,
      score: isNaN(score) ? 0 : score,
      delta: isNaN(delta) ? 0 : delta,
      positivePercent: isNaN(positivePercent) ? 0 : positivePercent,
      neutralPercent: isNaN(neutralPercent) ? 0 : neutralPercent,
      negativePercent: isNaN(negativePercent) ? 0 : negativePercent,
      priority,
    };
  }).sort((a, b) => {
    const priorityOrder: Record<DimensionAnalysis['priority'], number> = {
      Crítica: 0,
      Alta: 1,
      Média: 2,
      Baixa: 3,
    };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.negativePercent - a.negativePercent;
  });
};

export const calculateQuestionStats = (
  data: SurveyResponse[],
  key: keyof SurveyResponse
): { mean: number; positivePercent: number; neutralPercent: number; negativePercent: number } => {
  const values = data.map((d) => d[key] as number).filter((v) => !isNaN(v));
  const mean = calculateMean(values);
  return {
    mean,
    positivePercent: calculatePositivePercent(values),
    neutralPercent: calculateNeutralPercent(values),
    negativePercent: calculateAlertPercent(values),
  };
};

export const calculateGroupComparison = (data: SurveyResponse[], compareBy: CompareBy): GroupComparison[] => {
  const groups = new Map<string, SurveyResponse[]>();

  data.forEach((response) => {
    let groupKey: string;
    switch (compareBy) {
      case 'trilha':
        groupKey = response.trilha || 'Não informado';
        break;
      case 'sexo':
        groupKey = response.sexo || 'Não informado';
        break;
      case 'faixa_etaria':
        groupKey = response.faixa_etaria || 'Não informado';
        break;
      case 'segunda_jornada':
        groupKey = response.segunda_jornada ? 'Sim' : 'Não';
        break;
      default:
        groupKey = 'Todos';
    }

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(response);
  });

  const comparisons: GroupComparison[] = [];
  groups.forEach((responses, group) => {
    const scoredResponses = responses.filter(
      (response): response is SurveyResponse & { score_geral: number } =>
        typeof response.score_geral === 'number' && !isNaN(response.score_geral)
    );
    const scores = scoredResponses.map((response) => response.score_geral);
    const mean = calculateMean(scores);

    if (isNaN(mean)) return;

    const alertCount = scoredResponses.filter((response) => response.q5 <= 2 || response.q6 <= 2).length;
    comparisons.push({
      group,
      score: mean,
      count: scoredResponses.length,
      alertPercent: scoredResponses.length === 0 ? 0 : (alertCount / scoredResponses.length) * 100,
    });
  });

  return comparisons.sort((a, b) => b.score - a.score);
};

export const calculateHeadlineFlag = (
  data: SurveyResponse[]
): {
  title: string;
  explanation: string;
  severity: 'critical' | 'warning' | 'attention' | 'ok';
  primaryRisk?: { label: string; percent: number; priority: DimensionAnalysis['priority'] };
} => {
  if (data.length === 0) {
    return { title: 'Sem dados', explanation: 'Não há respostas suficientes para calcular os alertas.', severity: 'ok' };
  }

  const q5Values = data.map((d) => d.q5).filter((v) => !isNaN(v));
  const q6Values = data.map((d) => d.q6).filter((v) => !isNaN(v));

  if (q5Values.length === 0 || q6Values.length === 0) {
    return {
      title: 'Sem sinalizador',
      explanation: 'As colunas de ambiente seguro e busca de apoio não foram encontradas.',
      severity: 'ok',
    };
  }

  const critDuplo = (data.filter((d) => d.q5 <= 2 && d.q6 <= 2).length / data.length) * 100;
  const critAmb = (q5Values.filter((v) => v <= 2).length / q5Values.length) * 100;
  const critApoio = (q6Values.filter((v) => v <= 2).length / q6Values.length) * 100;
  const primaryRisk =
    critDuplo >= 20
      ? { label: 'Crítico duplo', percent: critDuplo }
      : critAmb >= critApoio
        ? { label: 'Ambiente seguro', percent: critAmb }
        : { label: 'Busca de apoio', percent: critApoio };
  const priority = getPriority(primaryRisk.percent);
  const riskInfo = { ...primaryRisk, priority };

  if (critDuplo >= 20) {
    return {
      title: `Crítico duplo: ${critDuplo.toFixed(1)}%`,
      explanation:
        'Muitas pessoas relatam ambiente inseguro e também baixa busca de apoio ao mesmo tempo.',
      severity: 'critical',
      primaryRisk: riskInfo,
    };
  }

  if (Math.max(critAmb, critApoio) >= 25) {
    if (critAmb >= critApoio) {
      return {
        title: `Alerta em ambiente seguro: ${critAmb.toFixed(1)}%`,
        explanation: 'Prioridade em segurança do ambiente, para que as pessoas possam falar sem medo.',
        severity: 'critical',
        primaryRisk: riskInfo,
      };
    }
    return {
      title: `Alerta em busca de apoio: ${critApoio.toFixed(1)}%`,
      explanation:
        'Prioridade em acesso e cultura de apoio, para que as pessoas saibam onde e como pedir ajuda.',
      severity: 'critical',
      primaryRisk: riskInfo,
    };
  }

  if (Math.max(critAmb, critApoio) >= 10) {
    return {
      title: 'Atenção',
      explanation: 'Há um alerta moderado. Vale agir cedo para não piorar.',
      severity: 'warning',
      primaryRisk: riskInfo,
    };
  }

  return {
    title: 'Sob controle',
    explanation: 'Os alertas estão baixos. O foco pode ser manter e melhorar continuamente.',
    severity: 'ok',
    primaryRisk: riskInfo,
  };
};

export const calculateTimeEvolution = (
  data: SurveyResponse[]
): { tempo: string; score: number }[] => {
  const timePoints: TimePoint[] = ['T0', 'T1', 'T2'];

  return timePoints.map((tempo) => {
    const filtered = data.filter((d) => d.tempo === tempo);
    const scores = filtered.map((d) => d.score_geral).filter((s): s is number => s !== undefined);
    const mean = calculateMean(scores);
    return { tempo, score: isNaN(mean) ? 0 : mean };
  });
};
