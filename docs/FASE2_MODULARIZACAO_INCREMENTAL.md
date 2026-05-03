# Fase 2 — Modularização incremental

Roteiros e navegação respeitam `tenants/{id}/entitlements/current.enabledModuleIds`.

## Contrato em `enabledModuleIds` (módulos comerciais)

Apenas: **`streaming`** | **`cursos`** | **`chat`** | **`vendedores`**.

- **Baseline** (sempre com tenant admin): `/admin/identidade-visual`, `/admin/conteudo-site` — ver `commercialEntitlements.ts` e `docs/MODULOS_IDS.md`.
- **Legacy**: tokens como `streaming-admin` ainda funcionam porque são inferidos para o comercial correspondente.

## Guards de rota (`ModuleEntitlementRoute`)

| Módulo comercial | Exemplos de rotas |
|------------------|-------------------|
| `cursos` | `/admin`, empresas, cursos admin, dashboards, relatórios vendedor (painel métricas), `/cursos`, `/curso/...`, certificados |
| `streaming` | `/streaming`, `/canal/:id`, operações `/admin/streaming*`, banners, audiência streaming |
| `vendedores` | `/admin/vendedores`, `/vendedor/...` |
| `chat` | Não tem rota isolada — ativa o widget de IA no streaming (com `streaming`) e Mentor no curso (com `cursos`). Visitantes **sem** conta continuam podendo usar o mentor nas superfícies públicas (comportamento anterior). |

## `hasModule(...)`

Aceita tanto o token comercial quanto um identificador técnico já mapeado (ex.: compatibilidade com dados antigos). A resolução encontra-se em `src/lib/modules/commercialEntitlements.ts`.

## Próximo passo

Reforço no backend (Functions / writes sensíveis) para que o entitlement não fique apenas no frontend.
