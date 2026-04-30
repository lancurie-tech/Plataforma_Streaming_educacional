# Checklist de Produção — Medivox

## 1. Branch Protection (GitHub)

### 1.1 Preciso de GitHub Team ou organização agora?

**Não.** Branch protection **não exige** GitHub Team por si só. O que importa é:

| Situação | Branch protection (revisões, status checks, etc.) |
|----------|---------------------------------------------------|
| Repositório **público** + conta **Free** (pessoal ou org) | **Disponível** — [documentação oficial](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) |
| Repositório **privado** + GitHub **Free** (pessoal) | **Limitado** — regras avançadas (ex.: revisores obrigatórios, branches protegidas completas em privado) costumam exigir **GitHub Pro** (conta pessoal) ou plano pago na organização |
| Organização **Team** | Útil por **equipes**, permissões, SSO, auditoria — não é pré-requisito técnico só para “ligar” proteção em repo público |

**Se o Medivox está no seu GitHub pessoal, repo privado, sem Pro:** você pode **adiar** as regras formais até migrar para o GitHub da empresa. **O que você perde ao não configurar agora:**

- **Processo:** risco maior de `git push` direto em `main` sem PR (erro humano).
- **Não perde:** o workflow **CI** (`.github/workflows/ci.yml`) continua a correr em **push** e em **PR** — o código continua validado; só falta o **bloqueio** no servidor GitHub.

**Enquanto isso (boa prática sem proteção formal):**

1. Trabalhar em `dev` ou feature branches e integrar em `main` só via PR no GitHub (mesmo sendo só você).
2. Não usar `git push origin main` com commits locais diretos em produção.
3. Opcional: no Vercel, confirmar que **Production** faz deploy **apenas** a partir de `main`, para um push errado não ir parar em produção sem passar pelo fluxo que você definir.

Quando o repositório estiver na **organização Medivox**, aí vale aplicar a regra completa abaixo (e, se o repo for **privado** na org, conferir no plano da org se as opções aparecem; em **público** na org Free, as regras costumam ser as mesmas que em repo público pessoal).

---

### 1.2 Onde clicar (passo a passo)

1. Abra o repositório no GitHub (ex.: `https://github.com/USUARIO/Medivox`).
2. **Settings** (aba do repositório; só aparece se você tiver permissão de admin).
3. Menu lateral: **Code and automation** → **Rules** → **Rulesets** (recomendado no GitHub atual) **ou** **Branches** → **Branch protection rules** → **Add rule** / **Add branch ruleset** (a interface pode mostrar “rulesets” em contas novas).
4. Se usar **classic** “Branch protection rules”:
   - **Branch name pattern:** `main` (ou `main` como nome exato conforme o formulário).
   - Ative as opções da secção seguinte.

**Nome exato do job de CI neste projeto:** no ficheiro `.github/workflows/ci.yml` o job chama-se **`web`**. Ao pedir “status checks”, procure por **`web`** na lista (após pelo menos um run bem-sucedido do workflow no repositório; se não aparecer, faça um push ou PR para disparar o CI primeiro).

---

### 1.3 Regra para a branch `main` (produção)

Marque conforme a sua política (recomendado para equipa):

| Opção (nome pode variar ligeiramente na UI) | O que faz | Notas |
|---------------------------------------------|-----------|--------|
| **Require a pull request before merging** | Impede merge direto sem PR | Base do fluxo |
| **Required number of approvals** → `1` | Exige pelo menos uma aprovação em PR | Em projeto solo, pode ser incómodo: pode usar `0` aprovações mas ainda “só via PR”, ou manter `1` e aprovar o próprio PR (depende da política da empresa) |
| **Require status checks to pass** | Só faz merge se o CI passar | Adicionar o check **`web`** |
| **Require branches to be up to date before merging** | O PR tem de estar atualizado com a base | Evita merges com base antiga |
| **Do not allow bypassing the above settings** / **Include administrators** | Aplica as regras também a administradores | Evita que admin faça merge à fora das regras |
| **Allow force pushes** | Deixar **desligado** (predefinição) | Evita `git push --force` em `main` |
| **Allow deletions** | Deixar **desligado** | Evita apagar `main` por engano |

**“Restrict who can push to matching branches”:** em muitos fluxos, **não é obrigatório** marcar isto se já existe “Require PR before merging”. Quem pode dar merge no PR continua a ser quem tem permissão de escrita; pushes **diretos** à branch são que bloqueados. Se ativar “restrict push”, tem de listar utilizadores/equipas com permissão explícita — em repos pessoais só você, por vezes confunde mais do que ajuda. **Na organização**, pode-se restringir pushes a uma equipa CI/CD.

**“Ninguém (só via PR merge)”** no checklist anterior era intenção de **fluxo**, não uma opção literal chamada “nobody”. O efeito desejado é: **ninguém faz `git push` direto em `main`**; merges entram via botão **Merge pull request** no GitHub (que respeita checks e revisões).

---

### 1.4 Regra para a branch `dev` (desenvolvimento)

Opção mínima útil:

- **Require status checks to pass before merging** → check **`web`**.

Opcional: também exigir PR de `feature/*` → `dev`, sem ser tão estrito quanto `main`.

---

### 1.5 Rulesets (alternativa moderna)

Se o GitHub mostrar **Repository rules** / **Rulesets** em vez de “Branch protection rules”, pode criar um **ruleset** para `main` e outro para `dev` com os mesmos objetivos. A documentação: [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets).

---

### 1.6 Checklist rápido (copiar para a equipa)

**`main`**

- [ ] Require pull request before merging (e número de aprovações definido)
- [ ] Require status checks → **`web`**
- [ ] Require branch up to date before merging (recomendado)
- [ ] Administradores sujeitos às mesmas regras (sem bypass)
- [ ] Force push e delete da branch desativados

**`dev`**

- [ ] Require status checks → **`web`**

## 2. App Check (Firebase Console)

Guia completo (ordem dos passos, custos, debug local, enforcement, migração para conta Medivox):

**[APP_CHECK_PASSO_A_PASSO.md](./APP_CHECK_PASSO_A_PASSO.md)**

Resumo: registar app Web no App Check → colocar `VITE_FIREBASE_APPCHECK_SITE_KEY` no Vercel e redeploy → validar tráfego → só então enforcement no Console e `ENFORCE_APP_CHECK=true` nas Functions.

---

## 2b. Ambiente dev / staging (Firebase separado da produção)

Passo a passo para criar um segundo projeto Firebase, variáveis no Vercel (Preview vs Production) e boas práticas — **para implementares quando estiveres no Firebase certo** (ex.: organização Medivox):

**[FIREBASE_AMBIENTE_DEV_STAGING.md](./FIREBASE_AMBIENTE_DEV_STAGING.md)**

## 3. Backup do Firestore

### Opção A: Agendamento nativo (recomendado)
Google Cloud Console → Firestore → **Backups** → criar agendamento (ex: diário às 03:00, retenção 7 dias).

### Opção B: Script manual
```bash
bash scripts/firestore-backup.sh
```

Pré-requisito: criar bucket `gs://medivox-backups` na região `southamerica-east1`.

## 4. Security Headers

Já configurados no `vercel.json`. Após deploy, validar com:
- https://securityheaders.com — espera-se nota A ou A+
- https://observatory.mozilla.org

## 5. Variáveis de Ambiente (Vercel)

Garantir que estão configuradas para o ambiente de **Production**:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_FUNCTIONS_REGION=southamerica-east1`
- `VITE_FIREBASE_APPCHECK_SITE_KEY` (quando configurar App Check)

## 6. Cloud Functions — Secrets e Config

```bash
firebase functions:secrets:set GOOGLE_API_KEY
firebase functions:config:set gemini.model="gemini-2.5-flash"
firebase deploy --only functions
```

Variáveis de ambiente / secrets das Functions:
- `GEMINI_MODEL=gemini-2.5-flash` (parâmetro; ou variável no deploy)
- `VIMEO_ACCESS_TOKEN` — **Secret Manager**, como `GOOGLE_API_KEY`: `firebase functions:secrets:set VIMEO_ACCESS_TOKEN`
- `ENFORCE_APP_CHECK=false` (ativar quando pronto)
- `CALLABLE_CORS_ORIGINS=https://seudominio.com.br`

## 7. Domínio Customizado

1. Configurar domínio no Vercel
2. Adicionar o domínio em `CALLABLE_CORS_ORIGINS` nas Functions
3. Adicionar o domínio em Firebase Console → Authentication → Settings → Domínios autorizados
4. Atualizar a URL de redefinição de senha em Authentication → Templates

## 8. Monitoramento

- Firebase Console → **Performance** e **Crashlytics** (se aplicável)
- Google Cloud Console → **Cloud Monitoring** → criar alertas para:
  - Erros 5xx nas Cloud Functions
  - Uso de quota do Gemini API
  - Latência alta nas Functions
- Vercel → **Analytics** (plano Pro)

## 9. Ambiente de Staging (recomendado)

Para evitar que testes afetem dados de produção:
1. Criar segundo projeto Firebase (`medivox-staging`)
2. Configurar `.env.staging` com as variáveis do projeto staging
3. No Vercel, criar ambiente Preview com variáveis do staging
4. Branch `dev` faz deploy para staging automaticamente
