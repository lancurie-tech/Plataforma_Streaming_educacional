# Fase 6 — Hardening multi-tenant (checklist)

Lista curta para **revisão periódica** após fechar o MVP do plano modular (`docs/PLANO_MODULAR_MARKETPLACE_MULTITENANT.md`). Não substitui auditoria de segurança dedicada.

## Firestore Rules

- [ ] `isMasterAdmin()` só em caminhos que devem ser operação interna (`tenants`, `plans`, `tenantPublicSlugs`, `marketplaceRequests`, etc.).
- [ ] `isAdmin()` não consegue escrever `entitlements` nem `plans` de outro tenant.
- [ ] Coleções com dados de negócio exigem `belongsToActorTenant` ou equivalente onde aplicável.
- [ ] `users/{uid}`: criação continua **impossível** no cliente (`create: false`); alterações sensíveis só via Functions quando necessário.

## Cloud Functions

- [ ] Callables sensíveis validam **papel** (admin vs master) e argumentos (IDs, limites).
- [ ] Segredos (`GOOGLE_API_KEY`, …) em Secret Manager ou env seguro — nunca no repositório.
- [ ] Domínios em **Firebase Authentication → Authorized domains** incluem o `appOrigin` usado em `generatePasswordResetLink` (convite master).

## Cliente (SPA)

- [ ] Rotas de módulo atrás de `ModuleEntitlementRoute` / `hasModule` coerente com URL pública (`tenantPublicSlugs`).
- [ ] Nenhuma query Firestore em código de **admin do tenant** sem filtro por `companyId` / `tenantId` quando a regra exige.
- [ ] Master (`/master`) não expõe dados de cliente em componentes reutilizados sem guard explícito.

## Observabilidade (evolução)

- [ ] Logs estruturados nas Functions para convites ao admin do tenant e limites (`resource-exhausted`).
- [ ] Alertas de quota Firebase / erros 5xx nas callables.

## Experiência operador / cliente

- [ ] Runbook `docs/RUNBOOK_NOVO_TENANT.md` seguido em cada novo cliente.
- [ ] Após convite: cliente consegue **definir senha** e aceder a `/{slug}/` e `/admin` conforme módulos.

---

*Atualizar este checklist quando novos módulos ou coleções forem adicionados.*
