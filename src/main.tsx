import '@/fonts';
import '@/index.css';

const rootEl = document.getElementById('root');

const required = [
  ['VITE_FIREBASE_API_KEY', import.meta.env.VITE_FIREBASE_API_KEY],
  ['VITE_FIREBASE_AUTH_DOMAIN', import.meta.env.VITE_FIREBASE_AUTH_DOMAIN],
  ['VITE_FIREBASE_PROJECT_ID', import.meta.env.VITE_FIREBASE_PROJECT_ID],
  ['VITE_FIREBASE_STORAGE_BUCKET', import.meta.env.VITE_FIREBASE_STORAGE_BUCKET],
  ['VITE_FIREBASE_MESSAGING_SENDER_ID', import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID],
  ['VITE_FIREBASE_APP_ID', import.meta.env.VITE_FIREBASE_APP_ID],
] as const;

const missing = required.filter(([, v]) => !v || String(v).trim() === '').map(([k]) => k);

if (!rootEl) {
  document.body.textContent = 'Elemento #root não encontrado.';
} else if (missing.length > 0) {
  rootEl.innerHTML = `
    <div style="min-height:100vh;background:#0c0c0f;color:#e4e4e7;font-family:system-ui,sans-serif;padding:2rem;max-width:36rem;margin:0 auto;">
      <h1 style="font-size:1.25rem;margin-bottom:0.75rem;">Configuração do Firebase</h1>
      <p style="color:#a1a1aa;line-height:1.5;margin-bottom:1rem;">
        Crie o arquivo <strong style="color:#fff;">.env</strong> na <strong style="color:#fff;">raiz do projeto</strong>
        (copie de <code style="background:#27272a;padding:0.15rem 0.4rem;border-radius:6px;">.env.example</code>) e preencha todas as variáveis <code style="background:#27272a;padding:0.15rem 0.4rem;border-radius:6px;">VITE_FIREBASE_*</code> com os dados do Console Firebase.
      </p>
      <p style="color:#f87171;font-size:0.9rem;margin-bottom:1rem;">Variáveis ausentes ou vazias: ${missing.join(', ')}</p>
      <p style="color:#a1a1aa;font-size:0.875rem;">Depois de salvar o <strong>.env</strong>, pare o servidor (<kbd>Ctrl+C</kbd>) e rode <code style="background:#27272a;padding:0.15rem 0.4rem;border-radius:6px;">npm run dev</code> de novo.</p>
    </div>
  `;
} else {
  void import('./bootstrap').then(({ mountApp }) => mountApp(rootEl));
}
