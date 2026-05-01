import { Navigate, Route, Routes, Outlet, useLocation } from 'react-router-dom';
import { ScrollToTop } from '@/components/layout/ScrollToTop';
import { CookieConsentBar } from '@/components/legal/CookieConsentBar';
import { GuestRoute } from '@/components/auth/GuestRoute';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminRoute } from '@/components/auth/AdminRoute';
import { MainLayout } from '@/components/layout/MainLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { PublicCoursesPage } from '@/pages/PublicCoursesPage';
import { StreamingHomePage } from '@/pages/StreamingHomePage';
import { ChannelPublicPage } from '@/pages/ChannelPublicPage';
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
import { TermsOfServicePage } from '@/pages/legal/TermsOfServicePage';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage';
import { CommitmentsPage } from '@/pages/legal/CommitmentsPage';
import { VendorConfidentialityPage } from '@/pages/legal/VendorConfidentialityPage';
import { AboutPage } from '@/pages/legal/AboutPage';
import { ContactPage } from '@/pages/legal/ContactPage';
import { AdminSiteContentPage } from '@/pages/admin/AdminSiteContentPage';
import { AdminIdentidadeVisualPage } from '@/pages/admin/AdminIdentidadeVisualPage';
import { AuthPublicChrome } from '@/components/layout/AuthPublicChrome';
import { ResetPasswordPage } from '@/pages/ResetPasswordPage';
import { WelcomeGatePage } from '@/pages/WelcomeGatePage';
import { PublicWelcomeOverlay } from '@/components/layout/PublicWelcomeOverlay';

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
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="empresas" element={<AdminCompanies />} />
        <Route path="empresas/:companyId" element={<AdminCompanyDetail />} />
        <Route path="cursos" element={<AdminCourses />} />
        <Route path="cursos/novo" element={<AdminCourseEditor />} />
        <Route path="cursos/:courseId/edit" element={<AdminCourseEditor />} />
        <Route path="dashboard" element={<AdminAnalytics />} />
        <Route path="metricas" element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="conta" element={<AdminAccountPage />} />
        <Route path="streaming" element={<AdminStreamingPage />} />
        <Route path="canais" element={<AdminChannelsPage />} />
        <Route path="canais/:channelId/edit" element={<AdminChannelEditor />} />
        <Route path="streaming-banners" element={<AdminStreamingBannersPage />} />
        <Route path="streaming-analytics" element={<AdminStreamingAnalyticsPage />} />
        <Route path="vendedores" element={<AdminVendedores />} />
        <Route path="identidade-visual" element={<AdminIdentidadeVisualPage />} />
        <Route path="conteudo-site" element={<AdminSiteContentPage />} />
        <Route
          path="saude-mental"
          element={<Navigate to="/admin/dashboard?painel=saude-mental" replace />}
        />
      </Route>

      <Route path="/" element={<WelcomeGatePage />} />

      <Route element={<PublicLayout />}>
        <Route path="streaming" element={<StreamingHomePage />} />
        <Route path="canal/:channelId" element={<ChannelPublicPage />} />
        <Route path="cursos" element={<PublicCoursesPage />} />
        <Route
          path="curso/:courseId"
          element={
            <ProtectedRoute>
              <CourseDetailPage />
            </ProtectedRoute>
          }
        />
        <Route path="sobre" element={<AboutPage />} />
        <Route path="contato" element={<ContactPage />} />
        <Route path="termos" element={<TermsOfServicePage />} />
        <Route path="privacidade" element={<PrivacyPolicyPage />} />
        <Route path="compromissos" element={<CommitmentsPage />} />
        <Route path="confidencialidade-vendedor" element={<VendorConfidentialityPage />} />
      </Route>

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
        <Route path="/vendedor/definir-senha" element={<VendedorDefinirSenhaPage />} />
        <Route
          path="/vendedor/aceitar-confidencialidade"
          element={<VendedorAcceptConfidentialityPage />}
        />
        <Route
          path="/vendedor"
          element={
            <VendedorRoute>
              <VendedorLayout />
            </VendedorRoute>
          }
        >
          <Route index element={<VendedorHomePage />} />
          <Route path="relatorios" element={<VendedorRelatoriosPage />} />
          <Route path="documentacao" element={<VendedorDocumentationPage />} />
          <Route
            path="saude-mental"
            element={<Navigate to="/vendedor/relatorios?painel=saude-mental" replace />}
          />
          <Route path="cursos" element={<VendedorCoursesPage />} />
          <Route path="curso/:courseId" element={<CourseDetailPage />} />
        </Route>
      </Route>

      <Route path="/meus-cursos" element={<Navigate to="/cursos" replace />} />

      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/perfil" element={<ProfilePage />} />
        <Route path="/certificados" element={<CertificatesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
