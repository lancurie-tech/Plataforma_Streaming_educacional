import { Fragment } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { ModuleEntitlementRoute } from '@/components/auth/ModuleEntitlementRoute';
import { StreamingHomePage } from '@/pages/StreamingHomePage';
import { ChannelPublicPage } from '@/pages/ChannelPublicPage';
import { PublicCoursesPage } from '@/pages/PublicCoursesPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { AboutPage } from '@/pages/legal/AboutPage';
import { ContactPage } from '@/pages/legal/ContactPage';
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage';
import { CommitmentsPage } from '@/pages/legal/CommitmentsPage';
import { VendorConfidentialityPage } from '@/pages/legal/VendorConfidentialityPage';

/** Streaming, canais e cursos — só faz sentido com tenant em URL (`/:slug/...`). */
export const publicSurfacePlatformRouteChildren = (
  <Fragment>
    <Route
      path="streaming"
      element={
        <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/">
          <StreamingHomePage />
        </ModuleEntitlementRoute>
      }
    />
    <Route
      path="canal/:channelId"
      element={
        <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/">
          <ChannelPublicPage />
        </ModuleEntitlementRoute>
      }
    />
    <Route
      path="cursos"
      element={
        <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/">
          <PublicCoursesPage />
        </ModuleEntitlementRoute>
      }
    />
    <Route
      path="curso/:courseId"
      element={
        <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/">
          <ProtectedRoute>
            <CourseDetailPage />
          </ProtectedRoute>
        </ModuleEntitlementRoute>
      }
    />
  </Fragment>
);

/** Páginas legais — também disponíveis no apex (`/termos`, …) sem slug de empresa. */
export const publicSurfaceLegalRouteChildren = (
  <Fragment>
    <Route path="sobre" element={<AboutPage />} />
    <Route path="contato" element={<ContactPage />} />
    <Route path="termos" element={<TermsOfServicePage />} />
    <Route path="privacidade" element={<PrivacyPolicyPage />} />
    <Route path="compromissos" element={<CommitmentsPage />} />
    <Route path="confidencialidade-vendedor" element={<VendorConfidentialityPage />} />
  </Fragment>
);

/**
 * Filhos de `<Route element={<PublicLayout />}>` sob `/:tenantSlug` — tem de ser `<Route>` ou `<Fragment>`.
 */
export const publicSurfaceRouteChildren = (
  <Fragment>
    {publicSurfacePlatformRouteChildren}
    {publicSurfaceLegalRouteChildren}
  </Fragment>
);
