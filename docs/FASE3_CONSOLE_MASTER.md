# Fase 3 — Console Master (MVP)

## O que foi entregue

- **Custom claim** Firebase: `master_admin: true` no token **ou** documento `users/{uid}` com **`role: "master"`** (alternativa sem script de claims).
- **Firestore Rules**: `isMasterAdmin()` quando `request.auth.token.master_admin == true` **ou** `userData().role == 'master'`.
  - Leitura dos seus dados de tenant continua para `belongsToActorTenant`.
  - **Write** em `tenants/*`, `tenants/*/entitlements/*` e **`plans/*`** só pelo master (o admin de cliente deixa de poder alterar planos/entitlements pelo SDK).
- **UI** em `/master`:
  - Lista de tenants (`/master`)
  - Criar organização (`/master/tenants/novo`)
  - Editar tenant + entitlements (`/master/tenants/:tenantId`): plano de referência, estado, módulos comerciais (`streaming`, `cursos`, `chat`, `vendedores`), limites JSON.
- **Slug reservado**: `master` (não usar como slug de empresa).

## Conceder acesso master a um utilizador

### Opção A — `role: master` no Firestore (recomendado para operação simples)

1. No Firebase Console → **Firestore**, documento `users/{uid}` do operador (o utilizador já deve existir no **Authentication** com o mesmo uid).
2. Defina o campo **`role`** com o valor exacto **`master`** (e remova `companyId`/`tenantId` se não fizer sentido para este utilizador).
3. Publique as **Firestore Rules** actualizadas (`firebase deploy --only firestore:rules`) para a regra `isMasterAdmin()` reconhecer `role == 'master'`.
4. O utilizador entra em **`/login`** e é **redirecionado para `/master`**.

### Opção B — Custom claim `master_admin` (sem alterar `role` no perfil)

1. Conta de serviço com permissão **Firebase Authentication Admin** (SDK Admin).
2. Na raiz do projeto:

```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
npm run master:set-claim -- operador@suaempresa.com
```

3. O utilizador deve **voltar a autenticar-se** (logout/login) para o token incluir o claim.

## Validação recomendada

1. Login com utilizador **com** `master_admin` **ou** `role: master` no Firestore: abrir `/master` (ou fazer login em `/login` — redireciona para `/master`).
2. Alterar módulos ou limites, guardar; com utilizador do tenant, recarregar o app e confirmar `hasModule`/rotas.
3. Login **sem** claim: `/master` redireciona para `/`.
4. Tentativa de escrita em `tenants/...` ou `plans/...` com admin de cliente apenas: deve falhar nas Rules.

## Próximo passo

- Cloud Functions dedicadas para criar tenant + convite (em vez de escritas diretas opcionais).
- Auditoria de alterações (quem mudou o quê).
- `docs/RUNBOOK_NOVO_TENANT.md` — onboarding (tenant, slug público, convite do primeiro admin com `masterInviteTenantAdmin` + Resend opcional, empresa ↔ limites); claim `master_admin` na secção **Conceder acesso master** deste ficheiro.
