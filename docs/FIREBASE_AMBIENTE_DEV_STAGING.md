# Ambiente de desenvolvimento / staging (Firebase separado da produção)

**Objetivo:** ter um **segundo projeto Firebase** (ou mais) onde podes testar regras, dados e deploys **sem** tocar no Firestore/Auth de **produção**.

Este documento descreve o racional do **segundo projeto Firebase** e como alinhar **variáveis** e *deploy* com o *front-end* em **Firebase Hosting** (a app **não** é publicada na Vercel). O repositório já inclui *workflow* de GitHub Actions (`.github/workflows/deploy.yml`) que separa **dev** e **produção**.

---

## 1. Porque vale a pena

| Risco sem ambiente separado | Com projeto `dev` / `staging` |
|-----------------------------|----------------------------------|
| Script de seed apaga dados reais | Dados de teste isolados |
| Teste de `firestore.rules` incorreto bloqueia utilizadores | Experimentas regras sem impacto em produção |
| *Preview* de PR no mesmo *backend* de prod | *Previews* de Hosting e *build* no **projeto dev** (PR → Firebase Hosting *preview* no `streaming-educacional-dev` ou ID equivalente) |

---

## 2. O que não duplicas (importante)

- **Código** é o mesmo repositório Git.
- **Duplicas:** projeto Firebase (novo projeto na consola), eventualmente **domínio** de preview ou subdomínio `staging.seu-dominio...`.
- **Custos:** segundo projeto na Blaze pode gerar custos adicionais (Firestore, Functions, leituras). Para dev podes usar dados mínimos e desligar o que não precisares.

---

## 3. Passo a passo — criar o projeto Firebase de desenvolvimento

1. [Firebase Console](https://console.firebase.google.com) → **Add project** / **Adicionar projeto**.
2. Nome sugerido: `streaming-educacional-dev` ou `streaming-educacional-staging` (nome interno; o **Project ID** tem de ser único globalmente).
3. Ativa **Google Analytics** só se precisares; para dev é opcional.
4. No novo projeto:
   - **Build** → **Firestore** → criar base de dados (modo **produção** ou **teste** — para regras realistas usa produção com dados falsos).
   - **Authentication** → ativar Email/Password (igual ao projeto principal).
   - **Functions** → região alinhada com produção (ex.: `southamerica-east1`).
5. Copia as chaves Web: **Project settings** → **Your apps** → Web → `firebaseConfig` (os mesmos campos que já usas em `VITE_FIREBASE_*`).

---

## 4. Aplicar regras e índices no projeto dev

No teu computador, com Firebase CLI:

```bash
firebase login
firebase use --add
# Escolhe o projeto de dev e dá um alias, ex.: dev
firebase use dev
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
```

**Nota:** o ficheiro `.firebaserc` pode ter vários aliases:

```json
{
  "projects": {
    "default": "streaming-educacional",
    "dev": "streaming-educacional-dev"
  }
}
```

Não commits **secrets**; o `.firebaserc` só com IDs de projeto é aceitável em equipa (confirma política interna).

---

## 5. Variáveis de ambiente e *deploy* — duas “personalidades”

### Produção (branch `main` e *build* local de prod)

- **CI/CD:** o GitHub Actions injeta *secrets* de produção (`VITE_FIREBASE_*`) no *job* de `main`.
- **Local:** ficheiro **`.env.production`** (a partir de `.env.production.example`, se usares *build* local contra o projeto de **produção** — cuidado com chaves no PC).

Todas as `VITE_FIREBASE_*` devem apontar para o projeto Firebase de **produção** nesses contextos.

### Desenvolvimento (branch `dev`, PRs e *build* `build:dev`)

- **CI/CD:** *secrets* com sufixo `*_DEV` para *push* em `dev` e para PRs; o *hosting* *preview* e o *live* de `dev` usam **só** o projeto **dev** no Firebase.
- **Local:** **`.env.development`** a partir de `.env.development.example` + `npm run dev` / `npm run build:dev`.

Nunca correr *seed* destrutivo ou testes ad hoc contra o Firestore de **produção**; usar o projeto **dev** ou o emulador.

---

## 6. Secrets das Cloud Functions no projeto dev

No projeto `streaming-educacional-dev`:

```bash
firebase use dev
cd functions
firebase functions:secrets:set GOOGLE_API_KEY
firebase deploy --only functions
```

Usa uma chave de API **separada** ou a mesma política de quotas — o que importa é o **projeto** GCP associado ser o de dev.

---

## 7. Dados iniciais no Firestore dev

- Usa os scripts em `scripts/` (ex.: `seed-firestore.mjs`) **apontando** o CLI ou variáveis para o projeto **dev**.
- Documenta num README interno: “Nunca correr seed contra produção sem `--project` explícito”.

Exemplo de segurança:

```bash
firebase use dev
node scripts/seed-firestore.mjs
```

(Adapta ao script real do repositório.)

---

## 8. Autenticação e domínios

- **Authentication** → **Settings** → **Authorized domains**: adiciona `localhost`, domínios de **Firebase Hosting** (`*.web.app`, `*.firebaseapp.com` ou domínio personalizado) e qualquer *preview* de Hosting que o projeto dev use.
- Os utilizadores de **dev** são **outros UIDs** — não são os mesmos que em produção.

---

## 9. Migração quando passares da conta pessoal para Plataforma de streaming educacional

1. Cria o projeto **produção** Plataforma de streaming educacional (definitivo).
2. Cria o projeto **dev** Plataforma de streaming educacional.
3. Atualiza os **GitHub Actions secrets** (e variáveis) de *build* de **produção** com o `firebaseConfig` do projeto **produção**.
4. Idem para os *secrets* `*_DEV` e *deploy* de `dev` / PRs com o projeto **dev**.
5. Migra dados se necessário (export/import Firestore — fora do âmbito deste guia; trata com cuidado e em janela de manutenção).
6. Desativa ou arquiva o projeto Firebase antigo quando não for mais necessário.

---

## 10. Checklist (para marcares quando implementares)

- [ ] Projeto Firebase `streaming-educacional-dev` criado
- [ ] Firestore + Auth + Functions configurados na mesma região que produção
- [ ] `firebase deploy --only firestore:rules,firestore:indexes` no projeto dev
- [ ] *Secrets* `VITE_*_DEV` / fluxo de `dev` e PRs apontam **só** para o Firebase **dev**
- [ ] *Secrets* de produção (sem sufixo `_DEV` no *workflow* de `main`) apontam **só** para o Firebase de **produção**
- [ ] Secrets das functions configurados no projeto dev
- [ ] Equipa treinada: **nunca** usar credenciais de prod em scripts de teste

---

## Referências

- [Firebase — multiple projects](https://firebase.google.com/docs/projects/learn-more#best-practices)
- [GitHub — Encrypted secrets](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions) (valores `VITE_*` no repositório)
