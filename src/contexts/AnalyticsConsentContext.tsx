/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  readAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentValue,
} from '@/lib/analyticsConsentStorage';

type AnalyticsConsentContextValue = {
  /** `null` = utilizador ainda não escolheu (mostrar barra). */
  consent: AnalyticsConsentValue | null;
  /** Métricas opcionais (ex.: visualizações no streaming) só com consentimento explícito. */
  analyticsAllowed: boolean;
  grant: () => void;
  deny: () => void;
};

const AnalyticsConsentContext = createContext<AnalyticsConsentContextValue | null>(null);

export function AnalyticsConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<AnalyticsConsentValue | null>(() => readAnalyticsConsent());

  const syncFromStorage = useCallback(() => {
    setConsent(readAnalyticsConsent());
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === ANALYTICS_CONSENT_STORAGE_KEY) syncFromStorage();
    }
    function onCustom() {
      syncFromStorage();
    }
    window.addEventListener('storage', onStorage);
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onCustom);
    };
  }, [syncFromStorage]);

  const grant = useCallback(() => {
    writeAnalyticsConsent('granted');
    setConsent('granted');
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
  }, []);

  const deny = useCallback(() => {
    writeAnalyticsConsent('denied');
    setConsent('denied');
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
  }, []);

  const value = useMemo<AnalyticsConsentContextValue>(
    () => ({
      consent,
      analyticsAllowed: consent === 'granted',
      grant,
      deny,
    }),
    [consent, grant, deny],
  );

  return (
    <AnalyticsConsentContext.Provider value={value}>{children}</AnalyticsConsentContext.Provider>
  );
}

export function useAnalyticsConsent(): AnalyticsConsentContextValue {
  const ctx = useContext(AnalyticsConsentContext);
  if (!ctx) {
    throw new Error('useAnalyticsConsent deve ser usado dentro de AnalyticsConsentProvider');
  }
  return ctx;
}
