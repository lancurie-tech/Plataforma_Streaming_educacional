import { Navigate, Route, Routes, Outlet, useLocation } from 'react-router-dom';
import {
  publicSurfaceLegalRouteChildren,
  publicSurfaceRouteChildren,
} from '@/app/publicSurfaceRoutes';
import { TenantSlugSegmentOutlet } from '@/components/tenantHost/TenantSlugSegmentOutlet';
import { useTenantPublicPaths } from '@/contexts/useTenantPublicPaths';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { CookieConsentBar } from '@/components/legal/CookieConsentBar';
import { GuestRoute } from '@/components/auth/GuestRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { ModuleEntitlementRoute } from '@/components/auth/ModuleEntitlementRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage';
import { CompanyLoginPage } from '@/pages/CompanyLoginPage';
import { CompanyRegisterPage } from '@/pages/CompanyRegisterPage';
import { CourseDetailPage } from '@/pages/CourseDetailPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { CertificatesPage } from '@/pages/CertificatesPage';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminCompanies } from '@/pages/admin/AdminCompanies';
import { AdminCompanyDetail } from '@/pages/admin/AdminCompanyDetail';
import { AdminCourses } from '@/pages/admin/AdminCourses';
import { AdminCourseEditor } from '@/pages/admin/AdminCourseEditor';
import { AdminAnalytics } from '@/pages/admin/AdminAnalytics';
import { AdminAccountPage } from '@/pages/admin/AdminAccountPage';
import { AdminStreamingPage } from '@/pages/admin/AdminStreamingPage';
import { AdminStreamingAnalyticsPage } from '@/pages/admin/AdminStreamingAnalyticsPage';
import { AdminChannelsPage } from '@/pages/admin/AdminChannelsPage';
import { AdminChannelEditor } from '@/pages/admin/AdminChannelEditor';
import { AdminStreamingBannersPage } from '@/pages/admin/AdminStreamingBannersPage';
import { AdminVendedores } from '@/pages/admin/AdminVendedores';
import { VendedorRoute } from '@/components/auth/VendedorRoute';
import { VendedorLayout } from '@/components/layout/VendedorLayout';
import { VendedorHomePage } from '@/pages/vendedor/VendedorHomePage';
import { VendedorRelatoriosPage } from '@/pages/vendedor/VendedorRelatoriosPage';
import { VendedorDocumentationPage } from '@/pages/vendedor/VendedorDocumentationPage';
import { VendedorCoursesPage } from '@/pages/vendedor/VendedorCoursesPage';
import { VendedorDefinirSenhaPage } from '@/pages/vendedor/VendedorDefinirSenhaPage';
import { VendedorAcceptConfidentialityPage } from '@/pages/vendedor/VendedorAcceptConfidentialityPage';
import { AdminSiteContentPage } from '@/pages/admin/AdminSiteContentPage';
import { AdminIdentidadeVisualPage } from '@/pages/admin/AdminIdentidadeVisualPage';
import { AuthPublicChrome } from '@/components/layout/AuthPublicChrome';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { TenantSlugWelcomePage } from '@/pages/TenantSlugWelcomePage';
import { PublicWelcomeOverlay } from '@/components/layout/PublicWelcomeOverlay';
import { MasterRoute } from '@/components/auth/MasterRoute';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { MasterTenantsPage } from '@/pages/master/MasterTenantsPage';
import { MasterTenantNewPage } from '@/pages/master/MasterTenantNewPage';
import { MasterTenantDetailPage } from '@/pages/master/MasterTenantDetailPage';
import { MasterMarketplaceInboxPage } from '@/pages/master/MasterMarketplaceInboxPage';
import { AdminMarketplacePage } from '@/pages/admin/AdminMarketplacePage';

function MeusCursosRedirect() {
  const { cursos } = useTenantPublicPaths();
  return <Navigate to={cursos} replace />;
}

function GuestLayout() {
  const { pathname } = useLocation();
  /** Primeiro contacto de muitos alunos — mesmo overlay da home (`/`). */
  const showWelcomeOnCompanyRegister = /^\/[^/]+\/cadastro$/.test(pathname);

  return (
    <AuthPublicChrome>
      <>
        {showWelcomeOnCompanyRegister ? <PublicWelcomeOverlay variant="sessionOnce" /> : null}
        <Outlet />
      </>
    </AuthPublicChrome>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <CookieConsentBar />
      <Routes>
      <Route
        path="/redefinir-senha"
        element={
          <AuthPublicChrome>
            <ResetPasswordPage />
          </AuthPublicChrome>
        }
      />
      <Route
        path="/master"
        element={
          <MasterRoute>
            <MasterLayout />
          </MasterRoute>
        }
      >
        <Route index element={<MasterTenantsPage />} />
        <Route path="tenants/novo" element={<MasterTenantNewPage />} />
        <Route path="tenants/:tenantId" element={<MasterTenantDetailPage />} />
        <Route path="marketplace" element={<MasterMarketplaceInboxPage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route
          index
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminDashboard />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="empresas"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminCompanies />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="empresas/:companyId"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminCompanyDetail />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="cursos"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminCourses />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="cursos/novo"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminCourseEditor />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="cursos/:courseId/edit"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminCourseEditor />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="dashboard"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <AdminAnalytics />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="metricas"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <Navigate to="/admin/dashboard" replace />
            </ModuleEntitlementRoute>
          }
        />
        <Route path="conta" element={<AdminAccountPage />} />
        <Route path="marketplace" element={<AdminMarketplacePage />} />
        <Route
          path="streaming"
          element={
            <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/admin/conta">
              <AdminStreamingPage />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="canais"
          element={
            <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/admin/conta">
              <AdminChannelsPage />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="canais/:channelId/edit"
          element={
            <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/admin/conta">
              <AdminChannelEditor />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="streaming-banners"
          element={
            <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/admin/conta">
              <AdminStreamingBannersPage />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="streaming-analytics"
          element={
            <ModuleEntitlementRoute moduleId="streaming" fallbackTo="/admin/conta">
              <AdminStreamingAnalyticsPage />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="vendedores"
          element={
            <ModuleEntitlementRoute moduleId="vendedores" fallbackTo="/admin/conta">
              <AdminVendedores />
            </ModuleEntitlementRoute>
          }
        />
        <Route path="identidade-visual" element={<AdminIdentidadeVisualPage />} />
        <Route path="conteudo-site" element={<AdminSiteContentPage />} />
        <Route
          path="saude-mental"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/admin/conta">
              <Navigate to="/admin/dashboard?painel=saude-mental" replace />
            </ModuleEntitlementRoute>
          }
        />
      </Route>

      {/** Apex sem slug: só área master — visitantes vão para login (conteúdo público em `/:slug/...`). */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/** Institucional no apex; plataforma (streaming/cursos) só em `/:slug/...`. */}
      <Route element={<PublicLayout />}>{publicSurfaceLegalRouteChildren}</Route>

      <Route path="/streaming" element={<Navigate to="/login" replace />} />
      <Route path="/cursos" element={<Navigate to="/login" replace />} />
      <Route path="/canal/:channelId" element={<Navigate to="/login" replace />} />
      <Route path="/curso/:courseId" element={<Navigate to="/login" replace />} />

      <Route
        element={
          <GuestRoute>
            <GuestLayout />
          </GuestRoute>
        }
      >
        <Route path="/login" element={<LoginPage />} />
        <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/:companySlug/login" element={<CompanyLoginPage />} />
        <Route path="/:companySlug/cadastro" element={<CompanyRegisterPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <Outlet />
          </ProtectedRoute>
        }
      >
        <Route
          path="/vendedor/definir-senha"
          element={
            <ModuleEntitlementRoute moduleId="vendedores" fallbackTo="/">
              <VendedorDefinirSenhaPage />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="/vendedor/aceitar-confidencialidade"
          element={
            <ModuleEntitlementRoute moduleId="vendedores" fallbackTo="/">
              <VendedorAcceptConfidentialityPage />
            </ModuleEntitlementRoute>
          }
        />
        <Route
          path="/vendedor"
          element={
            <ModuleEntitlementRoute moduleId="vendedores" fallbackTo="/">
              <VendedorRoute>
                <VendedorLayout />
              </VendedorRoute>
            </ModuleEntitlementRoute>
          }
        >
          <Route index element={<VendedorHomePage />} />
          <Route path="relatorios" element={<VendedorRelatoriosPage />} />
          <Route path="documentacao" element={<VendedorDocumentationPage />} />
          <Route
            path="saude-mental"
            element={
              <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/vendedor">
                <Navigate to="/vendedor/relatorios?painel=saude-mental" replace />
              </ModuleEntitlementRoute>
            }
          />
          <Route path="cursos" element={<VendedorCoursesPage />} />
          <Route path="curso/:courseId" element={<CourseDetailPage />} />
        </Route>
      </Route>

      <Route path="/meus-cursos" element={<MeusCursosRedirect />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/perfil" element={<ProfilePage />} />
        <Route
          path="/certificados"
          element={
            <ModuleEntitlementRoute moduleId="cursos" fallbackTo="/perfil">
              <CertificatesPage />
            </ModuleEntitlementRoute>
          }
        />
      </Route>

      <Route path="/:tenantSlug" element={<TenantSlugSegmentOutlet />}>
        <Route index element={<TenantSlugWelcomePage />} />
        <Route element={<PublicLayout />}>{publicSurfaceRouteChildren}</Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
