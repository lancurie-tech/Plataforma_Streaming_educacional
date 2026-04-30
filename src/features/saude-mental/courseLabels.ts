const COURSE_TRACK_LABELS: Record<string, string> = {
  colaborador: 'Colaborador',
  gestor: 'Gestor',
};

export function getCourseTrackLabel(track: string): string {
  return COURSE_TRACK_LABELS[track] ?? track;
}
