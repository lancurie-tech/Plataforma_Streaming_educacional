export type CompletionStatus = 'nao_iniciado' | 'em_andamento' | 'concluido';

export interface CourseParticipant {
  company_id: string;
  company_name?: string;
  participant_id: string;
  track: string;
  eligible: boolean;
  invited: boolean;
  enrolled: boolean;
  started: boolean;
  completed: boolean;
  enrolled_at?: string;
  first_access_at?: string;
  last_access_at?: string;
  completed_at?: string;
  progress_pct: number;
  instrument_1_status?: CompletionStatus;
  instrument_2_status?: CompletionStatus;
  instrument_3_status?: CompletionStatus;
  instrument_1_at?: string;
  instrument_2_at?: string;
  instrument_3_at?: string;
}

export interface CourseMetrics {
  eligibleCount: number;
  invitedCount: number;
  enrolledCount: number;
  startedCount: number;
  completedCount: number;
  adherenceRate: number;
  penetrationRate: number;
  completionRate: number;
  completionPenetrationRate: number;
  avgProgress: number;
  avgDaysToStart: number;
  avgDaysToCompletion: number;
  instrument1Rate: number;
  instrument2Rate: number;
  instrument3Rate: number;
}

export interface CourseFunnelStage {
  key: 'eligible' | 'enrolled' | 'started' | 'completed';
  label: string;
  count: number;
  rateFromEligible: number;
}

export interface TrackDistribution {
  track: string;
  participants: number;
  share: number;
  completed: number;
  completionRate: number;
}

export interface ModulePerformance {
  moduleId: string;
  moduleOrder: number;
  moduleName: string;
  applicableParticipants: number;
  completedParticipants: number;
  completionRate: number;
  averageProgress: number;
  requiredItems: number;
  audience: 'all' | 'gestor' | 'mixed';
}

export interface TrackRequirementSummary {
  collaboratorRequiredItems: number;
  managerRequiredItems: number;
  managerExclusiveItems: number;
  collaboratorRequiredModules: number;
  managerRequiredModules: number;
  instrumentCount: number;
}

export interface CoursePeriodOption {
  value: string;
  label: string;
}
