# Fase 4 — Marketplace por solicitação (MVP)

## Objetivo

Permitir que um **admin de tenant** peça novos **módulos comerciais** (`streaming`, `cursos`, `chat`, `vendedores`), com **inbox** no **master** para aprovar (atualiza `tenants/{id}/entitlements/current`) ou recusar/arquivar sem alterar direitos.

## Dados Firestore

| Caminho | Uso |
|--------|-----|
| `catalog/platform` | Doc raiz opcional (`kind: marketplace_catalog_root`). |
| `catalog/platform/modules/{moduleId}` | Metadados de oferta (`title`, `description`, `commercialModuleId`, `status`: `active` \| `beta` \| `hidden`). |
| `marketplaceRequests/{id}` | Pedidos com `tenantId`, `moduleId`, `commercialModuleId`, `status`, mensagem opcional, auditoria (`requestedBy*`, `handledBy*`, timestamps). |

O id do doc do catálogo alinha ao contrato (`streaming`, `cursos`, …): `moduleId === commercialModuleId` na criação do pedido (validado pelas Rules).

## Firestore Rules (resumo)

- **Catálogo**: leitura `master_admin` OU `admin`; escrita apenas `master_admin`; só vale para `catalogDoc == 'platform'`.
- **Pedidos**: criação por `admin` do próprio `actorTenantId()`; leitura do tenant ou master; atualização apenas master (aprovação/recusa/arquivo).

## UI

| Rota | Papel |
|------|-------|
| `/admin/marketplace` | Admin com `tenantId`/`companyId` no perfil: catálogo (sem docs `hidden`) + formulário por módulo + histórico. |
| `/master/marketplace` | Master: tabela de pendentes, ações Aprovar / Recusar / Arquivar. |

## Índices

Compostos em `marketplaceRequests`:

- `status` + `createdAt` descendente (inbox pendente).
- `tenantId` + `createdAt` descendente (histórico do tenant).

Declarados em `firestore.indexes.json` — aplicar no projeto (`firebase deploy --only firestore:indexes`) quando o compilador solicitar ou antecipadamente.

## Seed

```bash
npm run seed:marketplace-catalog
```

Requer variável `GOOGLE_APPLICATION_CREDENTIALS` com service account autorizada na base.

## Validação manual sugerida

1. Deploy de **rules** (+ índices).
2. Correr seed do catálogo.
3. Utilizador admin de um tenant solicita um módulo ainda não ativo.
4. Master vê pedido em `/master/marketplace`, aprova.
5. Recarregar o admin do tenant: `hasModule` / UI reflete o novo módulo após atualização das entitlements (pode precisar de reload da página ou novo login conforme caching do `AuthProvider`).
