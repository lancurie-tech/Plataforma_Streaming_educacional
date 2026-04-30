export interface SurveyResponse {
  empresa_id: string;
  empresa_nome?: string;
  participante_id: string;
  trilha: string;
  tempo: 'T0' | 'T1' | 'T2';
  q1: number;
  q2: number;
  q3: number;
  q4: number;
  q5: number;
  q6: number;
  q7?: number;
  q8?: number;
  q9?: number;
  q10?: number;
  sexo?: string;
  idade?: number;
  faixa_etaria?: string;
  segunda_jornada?: boolean;
  score_geral?: number;
}

export interface DimensionAnalysis {
  dimension: string;
  description: string;
  score: number;
  delta: number;
  positivePercent: number;
  neutralPercent: number;
  negativePercent: number;
  priority: 'Crítica' | 'Alta' | 'Média' | 'Baixa';
}

export interface GroupComparison {
  group: string;
  score: number;
  count: number;
  alertPercent: number;
}

export type TimePoint = 'T0' | 'T1' | 'T2';
export type CompareBy = 'trilha' | 'sexo' | 'faixa_etaria' | 'segunda_jornada';
