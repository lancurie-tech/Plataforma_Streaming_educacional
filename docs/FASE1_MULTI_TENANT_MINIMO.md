# Fase 1 — Multi-tenant minimo no dado

Implementacao inicial da Fase 1 do plano modular multi-tenant.

## Entregas aplicadas

- Schema base criado para:
  - `plans/{planId}`
  - `tenants/{tenantId}`
  - `tenants/{tenantId}/entitlements/current`
- Colecao piloto com isolamento por tenant:
  - `tenantPilotData/{docId}` com campo obrigatorio `tenantId`.
- Firestore Rules atualizadas para:
  - Ler tenant/plano com separacao por tenant.
  - Permitir escrita administrativa em `tenants` e `plans`.
  - Isolar `tenantPilotData` por `tenantId`.
- Camada de acesso Firestore adicionada em `src/lib/firestore/tenancy.ts`.
- Seed inicial adicionada em `scripts/seed-fase1-tenants.mjs`.

## Regras de transicao adotadas

Para nao quebrar o sistema legado (baseado em `companyId`), a regra usa:

- `actorTenantId = userData().tenantId` quando existir.
- Fallback para `userData().companyId` enquanto migracao nao termina.

Assim, usuarios atuais continuam funcionando e ja e possivel validar isolamento multi-tenant.

## Como semear dados de teste da Fase 1

1. Defina `GOOGLE_APPLICATION_CREDENTIALS`.
2. Execute:

```bash
npm run seed:fase1-tenants
```

Isso cria/atualiza planos, tenants, entitlements e um registro piloto por tenant.

## Validacao manual (gate da Fase 1)

1. Tenha dois usuarios de tenants diferentes (ex.: `seed_empresa_alpha` e `seed_empresa_beta`).
2. Com usuario A:
   - leia `tenants/seed_empresa_alpha` (deve permitir).
   - leia `tenants/seed_empresa_beta` (deve negar, exceto admin).
   - consulte `tenantPilotData` filtrando por `tenantId == seed_empresa_alpha` (deve retornar apenas seus docs).
3. Com usuario B, repita para o tenant dele.
4. Com usuario admin, confirme acesso global.

## Proximas acoes recomendadas (Fase 2)

- Conectar `enabledModuleIds` aos guards de rota.
- Bloquear superficies administrativas por entitlement.
- Migrar gradualmente de `companyId` para `tenantId` em todos os fluxos.
