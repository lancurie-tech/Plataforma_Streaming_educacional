# App Check — passo a passo (Firebase + Vercel + Cloud Functions)

Este guia alinha-se ao código existente: `src/lib/firebase/appCheck.ts` (`initAppCheck`) e `functions/src/index.ts` (`enforceAppCheck` via `ENFORCE_APP_CHECK`).

**Quando executar:** de preferência **já no projeto Firebase definitivo** (conta Google Cloud da organização). Podes repetir os mesmos passos no projeto atual e migrar depois; não é obrigatório esperar, mas evita trabalho duplicado.

---

## 1. O que o App Check faz (e o que não faz)

- **Faz:** exige que pedidos à API do Firebase (Firestore, callables, etc.) tragam um **token** que prova que o pedido vem da tua app Web (com reCAPTCHA v3 por baixo), reduzindo **scripts e bots** a usarem as tuas chaves públicas.
- **Não substitui:** **Firestore Security Rules**, **autenticação** nem revisão de dados no servidor. Continua a ser a camada principal de segurança.

---

## 2. Custo e faturação (Blaze / mudança de conta Google Cloud)

| Item | Notas |
|------|--------|
| **Firebase App Check** | Não aparece como linha separada “App Check” no extrato por utilização típica; faz parte da proteção do produto Firebase. |
| **Plano Blaze** | Já necessário para Cloud Functions, etc. O App Check **não** exige um plano além do Blaze por si só. |
| **reCAPTCHA v3** (usado como fornecedor Web no App Check) | Uso normal de uma app legítima costuma ficar dentro das **quotas gratuitas** do Google; picos enormes de tráfego podem entrar em limites pagos do lado Google — consulta [preços reCAPTCHA](https://cloud.google.com/recaptcha-enterprise/pricing) se no futuro migrares para Enterprise; o fluxo **padrão App Check Web** segue a documentação Firebase. |
| **Nova conta Google Cloud** | Ao mudar o projeto para outra conta Google Cloud, **recrias** App Check e chaves no **novo** projeto Firebase; não há “transferência” automática de configuração App Check entre projetos. |

**Resumo:** para o volume típico de uma plataforma em crescimento, o impacto de custo direto do App Check é **geralmente nulo ou residual** em relação ao que já gastas em Functions/Firestore; o risco principal de custo continua a ser **uso da API** (ex.: Gemini), não o App Check em si.

---

## 3. Ordem correta (para não partir a app)

1. Registar a app Web no **App Check** e obter a **site key** reCAPTCHA v3.
2. Colocar `VITE_FIREBASE_APPCHECK_SITE_KEY` no **Vercel** (e localmente no `.env`) e **fazer deploy** do frontend.
3. **Testar** o site em produção/preview: abrir consola do browser e confirmar que não há erros de App Check; no Firebase → **App Check** → métricas, ver pedidos com token.
4. **Tokens de debug** para desenvolvimento local (opcional mas recomendado): ver secção 6.
5. Só depois: **enforcement** no Firebase (Firestore → App Check enforcement; Functions → idem) **e/ou** `ENFORCE_APP_CHECK=true` nas Cloud Functions.

Se ativares enforcement **antes** do frontend enviar tokens, **utilizadores legítimos** podem ver falhas (leituras Firestore bloqueadas, callables a falhar).

---

## 4. Passo a passo — Firebase Console

1. Entra em [Firebase Console](https://console.firebase.google.com) e seleciona o **projeto** Firebase correto.
2. Menu lateral → **Build** → **App Check** (ou pesquisa “App Check” na consola).
3. Clica em **Get started** / **Registar app** se ainda não existir app Web.
4. Escolhe a plataforma **Web** (`</>`).
5. Dá um **apelido** (ex.: “Web streaming educacional”).
6. Fornecedor: **reCAPTCHA v3** (predefinição para Web).
7. Segue o assistente: em geral precisas de criar / associar uma **reCAPTCHA key** no Google Cloud (a consola pode abrir o fluxo). Aceita os domínios onde a app corre:
   - Produção: `seudominio.com`, `www.seudominio.com`
   - Vercel: `*.vercel.app` (previews) se quiseres tokens nas previews
   - Localhost: para debug, usa **token de debug** (secção 6), não dependas só de `localhost` em produção.
8. No fim, copia a **Site key** (não confundir com secret key) — é o valor de `VITE_FIREBASE_APPCHECK_SITE_KEY`.

---

## 5. Passo a passo — Vercel

1. **Vercel** → projeto do frontend → **Settings** → **Environment Variables**.
2. Adiciona:
   - **Name:** `VITE_FIREBASE_APPCHECK_SITE_KEY`
   - **Value:** (site key do passo anterior)
   - **Environment:** Production (e Preview se quiseres App Check nas branch previews).
3. Faz **redeploy** do último deployment ou um commit novo para a variável entrar no build (variáveis `VITE_*` são injetadas em **build time**).

---

## 6. Desenvolvimento local (token de debug)

Sem isto, em `localhost` o reCAPTCHA pode falhar ou ser instável.

1. No `.env` local (não commitar):
   ```env
   VITE_FIREBASE_APPCHECK_SITE_KEY=<a_mesma_site_key>
   VITE_FIREBASE_APPCHECK_DEBUG=true
   ```
2. Arranca a app (`npm run dev`), abre o **DevTools** → **Consola**: o Firebase imprime um **debug token**.
3. Firebase Console → **App Check** → **Apps** → a tua app Web → **Manage debug tokens** / **Gerir tokens de debug** → **Add debug token** → cola o token.
4. Volta a carregar a app: pedidos devem ser aceites em dev.

Documentação: [Use App Check with the debug provider](https://firebase.google.com/docs/app-check/web/debug-provider).

---

## 7. Ativar enforcement (quando estiveres pronto)

### 7.1 Firestore

1. Firebase → **App Check** → separador **APIs** ou secção **Enforcement**.
2. Localiza **Cloud Firestore** → **Enforce** / **Aplicar**.
3. Opcional: começar em **Monitoring only** (só métricas, sem bloquear) durante 1–2 semanas, depois **Enforce**.

### 7.2 Cloud Functions (callables)

1. Na mesma área **App Check**, localiza **Cloud Functions for Firebase** (ou “Callable”) e ativa enforcement conforme a UI.
2. Em paralelo, no código já tens `enforceAppCheck` ligado a `ENFORCE_APP_CHECK === 'true'` em `functions/src/index.ts`. Define a variável no **ambiente das Functions** (ver secção 8) e faz `firebase deploy --only functions`.

**Dupla camada:** Console (Firebase) + variável nas functions — segue a documentação atual do Firebase para a tua versão; o importante é **não** ligar tudo no mesmo dia sem testes.

---

## 8. Variável `ENFORCE_APP_CHECK` nas Cloud Functions (2.ª geração)

O código lê `process.env.ENFORCE_APP_CHECK === 'true'`.

**Opções (escolhe uma):**

1. **Ficheiro `functions/.env`** (não versionado), com `ENFORCE_APP_CHECK=true`, e `firebase deploy --only functions` a partir da máquina onde esse ficheiro existe (o CLI pode carregar variáveis — confirma na [documentação atual](https://firebase.google.com/docs/functions/config-env) “Environment variables”).
2. **Google Cloud Console** → **Cloud Run** → serviço correspondente a cada function → **Edit & deploy new revision** → **Variables** → adicionar `ENFORCE_APP_CHECK` = `true` (repetir por serviço se necessário).
3. **CI/CD:** injetar a variável no passo de deploy das functions.

Depois de `true`, callables **rejeitam** pedidos **sem** token App Check válido — por isso o frontend **tem** de estar com `VITE_FIREBASE_APPCHECK_SITE_KEY` em produção antes.

---

## 9. Checklist final

- [ ] Site key no Vercel (Production) e redeploy
- [ ] Site key no `.env` local para testes
- [ ] Token de debug registado (se desenvolves com App Check ligado)
- [ ] Consola sem erros; App Check a mostrar tráfego com token válido
- [ ] Enforcement Firestore (após período de observação opcional)
- [ ] `ENFORCE_APP_CHECK=true` + deploy functions + enforcement Functions no Console

---

## 10. Migração para o projeto Firebase definitivo

1. Repete os passos 4–9 no **novo** projeto.
2. Gera nova site key / registo App Check para a app Web nesse projeto.
3. Atualiza **todas** as `VITE_FIREBASE_*` no Vercel para o novo projeto.
4. Redeploy frontend + functions + `firebase deploy --only firestore:rules` se necessário.
5. Remove ou desativa chaves antigas só quando o tráfego já não usar o projeto antigo.

---

## Referências

- [Firebase App Check — Web](https://firebase.google.com/docs/app-check/web/custom-resource)
- [Get started with App Check](https://firebase.google.com/docs/app-check)
