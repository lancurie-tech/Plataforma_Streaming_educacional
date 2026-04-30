import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './config';

/**
 * App Check opcional: reduz tráfego abusivo de scripts que não passam pelo seu app.
 * 1) Firebase Console → App Check → registre o app Web (reCAPTCHA v3).
 * 2) Defina VITE_FIREBASE_APPCHECK_SITE_KEY no .env (Vercel inclua a mesma variável).
 * 3) Só depois ative enforcement em Firestore / Functions no Console (senão clientes sem token quebram).
 *
 * Dev local: VITE_FIREBASE_APPCHECK_DEBUG=true + registre o token de debug que aparecer no console.
 */
export function initAppCheck(): void {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
  if (!siteKey) return;

  if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === 'true') {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
