import type { CourseAnalyticsReport } from '@/lib/firestore/analytics';

/** Extrai visão resumida de uma empresa a partir do relatório já filtrado por `companyId`. */
export function courseReportToSellerPdfSlice(report: CourseAnalyticsReport) {
  const seg = report.segments.combined;
  const companyRow =
    report.filteredCompanyId != null
      ? seg.byCompany.find((c) => c.companyId === report.filteredCompanyId) ?? seg.byCompany[0]
      : seg.byCompany[0];

  const moduleRows = seg.moduleCompletion.map((m) => ({
    title: m.title,
    enrolled: m.enrolled,
    completed: m.completed,
    pct: m.enrolled > 0 ? Math.round((m.completed / m.enrolled) * 10000) / 100 : null,
  }));

  const enrolledUsers = seg.byUser.filter((u) => u.enrolled);

  return {
    courseTitle: report.courseTitle,
    courseId: report.courseId,
    moduleTotal: report.moduleTotal,
    enrolledInCourseCount: seg.enrolledInCourseCount,
    completedFullCourseCount: seg.completedFullCourseCount,
    hasGradableContent: report.hasGradableContent,
    companyStudents: companyRow?.students ?? 0,
    companyEnrolledInCourse: companyRow?.enrolledInCourse ?? seg.enrolledInCourseCount,
    aggregateAccuracyPercent: companyRow?.aggregateAccuracyPercent ?? null,
    avgUserAccuracyPercent: companyRow?.avgUserAccuracyPercent ?? null,
    avgModulesCompleted: companyRow?.avgModulesCompleted ?? null,
    gradedAnswersTotal: companyRow?.gradedAnswersTotal ?? 0,
    moduleRows,
    enrolledUsers: enrolledUsers.map((u) => ({
      name: u.name,
      email: u.email,
      modulesCompleted: u.modulesCompleted,
      moduleTotal: u.moduleTotal,
      scorePercent: u.scorePercent,
      gradedAnswers: u.gradedAnswers,
      correctAnswers: u.correctAnswers,
    })),
  };
}

export type SellerCompanyCourseMetricsPdf = ReturnType<typeof courseReportToSellerPdfSlice>;
