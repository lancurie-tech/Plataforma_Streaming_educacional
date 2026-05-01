import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthProvider';
import { BrandingProvider } from '@/contexts/BrandingProvider';
import { AnalyticsConsentProvider } from '@/contexts/AnalyticsConsentContext';
import { initAppCheck } from '@/lib/firebase/appCheck';
import App from '@/App';

initAppCheck();

export function mountApp(rootEl: HTMLElement) {
  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>
        <AnalyticsConsentProvider>
          <BrandingProvider>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrandingProvider>
        </AnalyticsConsentProvider>
      </BrowserRouter>
    </StrictMode>
  );
}
