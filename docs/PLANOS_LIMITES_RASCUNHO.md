# PLANOS_LIMITES_RASCUNHO — Fase 0

Rascunho inicial das dimensoes de limite por plano para sustentar o modelo comercial multi-tenant.

Este documento e deliberadamente simples e revisavel: serve para destravar implementacao tecnica de cotas e validacoes no produto.

## Objetivo

- Definir eixos de limite que o sistema consegue medir.
- Padronizar nomes de campos para `plans/{planId}` e `tenants/{tenantId}/entitlements.limits`.
- Ter pelo menos 2 tiers para validacao inicial (gate da Fase 0).

## Dimensoes tecnicas de limite (v1)

| Campo (`limits`) | O que controla | Fonte primaria de medicao |
|------------------|----------------|----------------------------|
| `maxActiveUsers` | Numero maximo de usuarios ativos por tenant | Colecao de usuarios da empresa/tenant |
| `maxStorageGb` | Teto de armazenamento (videos/imagens/PDFs) | Storage usage agregado por tenant |
| `maxPublishedVideoHours` | Horas maximas de video publicado no catalogo/canais | Metadados de conteudo + duracao |
| `maxLiveStreamsPerMonth` | Quantidade de eventos de transmissao ao vivo por mes | Eventos criados/finalizados no modulo de live |
| `maxActiveCourses` | Cursos ativos/publicados simultaneamente | Colecao de cursos com status ativo |
| `maxEnabledModules` | Quantidade maxima de modulos habilitados por contrato | `enabledModuleIds.length` |

## Tiers iniciais (ficticios para validacao)

| `planId` | Nome comercial | `maxActiveUsers` | `maxStorageGb` | `maxPublishedVideoHours` | `maxLiveStreamsPerMonth` | `maxActiveCourses` | `maxEnabledModules` |
|----------|----------------|------------------|----------------|--------------------------|--------------------------|--------------------|---------------------|
| `essencial` | Essencial | 150 | 80 | 200 | 4 | 30 | 6 |
| `profissional` | Profissional | 800 | 400 | 1200 | 20 | 150 | 10 |
| `corporativo` | Corporativo | 4000 | 2000 | 6000 | 80 | 800 | 20 |

## Campos de apoio (fora de `limits`, mas necessarios)

- `planId`: identificador do plano contratado.
- `enabledModuleIds: string[]`: modulos habilitados no tenant.
- `usageSnapshot`: agregado periodico para comparacao `usage` vs `limits`.

## Criterio de validacao da Fase 0

Atendido quando:
- Existe um mapa de limites com pelo menos 2 tiers definidos.
- Os nomes de campos estao acordados para uso tecnico (frontend, functions e rules).
- O time consegue apontar quais validacoes serao "bloqueio" e quais serao "alerta" na Fase 5.

## Proximos passos

- Traduzir este rascunho em seed real de `plans/{planId}`.
- Definir politica por limite: bloqueia imediatamente, alerta, ou grace period.
- Criar dashboard operacional por tenant para revisar custo real x teto comercial.
