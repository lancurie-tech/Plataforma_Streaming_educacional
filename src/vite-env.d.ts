/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_FIREBASE_FUNCTIONS_REGION?: string;
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string;
  readonly VITE_FIREBASE_APPCHECK_DEBUG?: string;
  /** Domínio apex do site (ex.: plataforma.com) — extração de subdomínio por tenant. */
  readonly VITE_PUBLIC_APP_APEX_DOMAIN?: string;
  /** Origem canónica do apex (ex.: https://plataforma.com) — redirects do console master. */
  readonly VITE_PUBLIC_APP_ORIGIN?: string;
  /** Em localhost, simula o slug do tenant (subdomínio) para desenvolvimento. */
  readonly VITE_PUBLIC_TENANT_SLUG_DEV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
}
