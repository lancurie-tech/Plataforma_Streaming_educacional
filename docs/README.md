# Documentação Medivox

Material de apoio ao projeto (setup, dados de exemplo e arquitetura). O **README principal** está na [raiz do repositório](../README.md).

| Documento | Conteúdo |
|-----------|----------|
| [PRODUCAO_CHECKLIST.md](./PRODUCAO_CHECKLIST.md) | **Checklist de produção:** branch protection, backup, security headers, domínio e monitoramento. |
| [APP_CHECK_PASSO_A_PASSO.md](./APP_CHECK_PASSO_A_PASSO.md) | **App Check:** passo a passo Firebase + Vercel + Functions, custos, tokens de debug, enforcement. |
| [FIREBASE_AMBIENTE_DEV_STAGING.md](./FIREBASE_AMBIENTE_DEV_STAGING.md) | **Firebase dev/staging:** projeto separado, variáveis Vercel, deploy de rules — para quando migrares para a conta Medivox. |
| [ASSISTENTE_IA_MEDIVOX.md](./ASSISTENTE_IA_MEDIVOX.md) | **Assistente de IA (Gemini):** onde aparece, contexto por rota, anti-cola em cursos, quota diária, secrets e ficheiros no repo. |
| [DOCUMENTACAO_NEGOCIO_CONFORMIDADE_MEDIVOX.md](./DOCUMENTACAO_NEGOCIO_CONFORMIDADE_MEDIVOX.md) | **Visão de negócio, funcionalidades, LGPD/aceites e segurança** — para decisores e revisão jurídica (não substitui parecer de advogado). Inclui secção sobre o assistente de IA. |
| [GUIA_SETUP_MANUAL_MEDIVOX.md](./GUIA_SETUP_MANUAL_MEDIVOX.md) | Configuração manual do ambiente e do Firebase. |
| [IMPORTAR_DADOS_FIRESTORE.md](./IMPORTAR_DADOS_FIRESTORE.md) | Importação de dados para o Firestore. |
| [DADOS_EXEMPLO_FIRESTORE.md](./DADOS_EXEMPLO_FIRESTORE.md) | Estrutura e exemplos de documentos/coleções. |
| [ARQUITETURA_PLATAFORMA_CURSO.md](./ARQUITETURA_PLATAFORMA_CURSO.md) | Decisões de arquitetura do modelo de curso e stack (referência de produto). |

## Ficheiros locais (não versionar)

- Não commits com credenciais, chaves JSON do Firebase ou listas de logins.
- O `.gitignore` na raiz ignora padrões comuns; ficheiros como notas de login devem permanecer só na tua máquina ou em gestor de secrets da equipa.
