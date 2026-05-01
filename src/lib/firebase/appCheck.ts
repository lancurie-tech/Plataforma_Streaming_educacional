import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { app } from './config';

function isLoopbackHost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}

/**
 * App Check opcional: reduz tráfego abusivo de scripts que não passam pelo seu app.
 * 1) Firebase Console → App Check → registre o app Web (reCAPTCHA v3).
 * 2) Defina VITE_FIREBASE_APPCHECK_SITE_KEY no .env (Vercel inclua a mesma variável).
 * 3) Só depois ative enforcement em Firestore / Functions no Console (senão clientes sem token quebram).
 *
 * Localhost (`npm run prod`, `vite preview`, etc.): o domínio não está no reCAPTCHA → 403 em
 * exchangeRecaptchaV3Token. Por defeito **não** inicializamos App Check no loopback; use
 * `VITE_FIREBASE_APPCHECK_DEBUG=true` e registe o token de debug no Console (como em dev).
 */
export function initAppCheck(): void {
  const siteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
  if (!siteKey) return;

  const debugExplicit = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG === 'true';
  if (isLoopbackHost() && !debugExplicit) {
    return;
  }

  if (debugExplicit) {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
