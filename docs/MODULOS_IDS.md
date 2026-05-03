# MODULOS_IDS — modelo comercial vs interno

## Contrato gravado em `enabledModuleIds` no Firestore

O **painel master** e os planos usam apenas estes quarto módulos comerciais (ligar/desligar por tenant):

| `moduleId` | Inclui (produto) |
|------------|-------------------|
| `streaming` | Página/streaming público (`/streaming`, `/canal/...`), operação admin (trilhas, vídeos, banners, canais, métricas de audiência streaming). |
| `cursos` | Programas / catálogo e curso ao vivo (`/cursos`, `/curso/...`), administração de cursos, cadastro/liberação empresa×curso, dashboards operacionais, certificados. |
| `chat` | Assistente IA no **streaming** (quando `streaming` está ativo) e mentor no **contexto dos cursos** (quando `cursos` está ativo). |
| `vendedores` | Portal do vendedor (`/vendedor/...`), gestão administrativa `/admin/vendedores`. |

Combinar `streaming` + `chat` ou `cursos` + `chat` liga os chats correspondentes.

## Funcionalidades básicas (sempre ativas com tenant)

Não entram no marketplace nem em `enabledModuleIds` como módulos à venda:

- Conta e **identidade visual** (`/admin/identidade-visual`)
- **Conteúdo institucional** do site (`/admin/conteudo-site` — termos, privacidade, etc.)

No cliente, tratamos isso como **baseline**: `site-institucional` e `branding-white-label` em `commercialEntitlements.ts`.

## Implementação técnica (compatibilidade)

O ficheiro `src/lib/modules/commercialEntitlements.ts`:

- Expand `streaming` para capacidades já usadas no router (`streaming-publico`, `streaming-admin`)
- Expand `cursos` para `catalogo-cursos`, `admin-cursos`, `analytics-insights`, `certificados`, `core-tenant-admin`
- Expand `vendedores` para `portal-vendedor`
- **Tokens antigos** (ex.: apenas `streaming-admin`) ainda funcionam porque são inferidos como módulo comercial equivalente (`streaming` ou `cursos`).

Para referência rápida do mapa legado técnico (não obrigatório no contrato comercial):

| Área técnica (legado) | Mapeado quando comercial está ativo |
|----------------------|-------------------------------------|
| `streaming-publico` / `streaming-admin` | `streaming` |
| `catalogo-cursos` / `admin-cursos` / `analytics-insights` / `certificados` / `core-tenant-admin` | `cursos` |
| `portal-vendedor` | `vendedores` |

## Seed

`scripts/seed-fase1-tenants.mjs` grava apenas tokens comerciais em `enabledModuleIds` (ex.: `['cursos', 'streaming', 'chat', 'vendedores']`).
