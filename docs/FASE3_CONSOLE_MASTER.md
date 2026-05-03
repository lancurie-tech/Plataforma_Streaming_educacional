# Fase 3 — Console Master (MVP)

## O que foi entregue

- **Custom claim** Firebase: `master_admin: true` no token (não substitui `users/{uid}.role`).
- **Firestore Rules**: `isMasterAdmin()` com `request.auth.token.master_admin == true`.
  - Leitura dos seus dados de tenant continua para `belongsToActorTenant`.
  - **Write** em `tenants/*`, `tenants/*/entitlements/*` e **`plans/*`** só pelo master (o admin de cliente deixa de poder alterar planos/entitlements pelo SDK).
- **UI** em `/master`:
  - Lista de tenants (`/master`)
  - Criar organização (`/master/tenants/novo`)
  - Editar tenant + entitlements (`/master/tenants/:tenantId`): plano de referência, estado, módulos comerciais (`streaming`, `cursos`, `chat`, `vendedores`), limites JSON.
- **Slug reservado**: `master` (não usar como slug de empresa).

## Conceder acesso master a um utilizador

1. Conta de serviço com permissão **Firebase Authentication Admin** (SDK Admin).
2. Na raiz do projeto:

```bash
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\serviceAccountKey.json"
npm run master:set-claim -- operador@suaempresa.com
```

3. O utilizador deve **voltar a autenticar-se** (logout/login) para o token incluir o claim.

## Validação recomendada

1. Login com utilizador **com** `master_admin`: abrir `/master`, listar e editar tenant de teste.
2. Alterar módulos ou limites, guardar; com utilizador do tenant, recarregar o app e confirmar `hasModule`/rotas.
3. Login **sem** claim: `/master` redireciona para `/`.
4. Tentativa de escrita em `tenants/...` ou `plans/...` com admin de cliente apenas: deve falhar nas Rules.

## Próximo passo

- Cloud Functions dedicadas para criar tenant + convite (em vez de escritas diretas opcionais).
- Auditoria de alterações (quem mudou o quê).
- `docs/RUNBOOK_NOVO_TENANT.md` pode detalhar onboarding comercial + comando de claim.
