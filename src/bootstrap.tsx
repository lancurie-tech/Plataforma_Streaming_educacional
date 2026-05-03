import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthProvider';
import { BrandingProvider } from '@/contexts/BrandingProvider';
import { PublicTenantProvider } from '@/contexts/PublicTenantProvider';
import { AnalyticsConsentProvider } from '@/contexts/AnalyticsConsentContext';
import { TenantHostGate } from '@/components/tenantHost/TenantHostGate';
import { initAppCheck } from '@/lib/firebase/appCheck';
import App from '@/App';

initAppCheck();

export function mountApp(rootEl: HTMLElement) {
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <AnalyticsConsentProvider>
          <PublicTenantProvider>
            <BrandingProvider>
              <AuthProvider>
                <TenantHostGate>
                  <App />
                </TenantHostGate>
              </AuthProvider>
            </BrandingProvider>
          </PublicTenantProvider>
        </AnalyticsConsentProvider>
      </BrowserRouter>
    </StrictMode>
  );
}
