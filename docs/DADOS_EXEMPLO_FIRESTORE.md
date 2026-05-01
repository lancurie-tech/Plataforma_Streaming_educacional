# Dados de exemplo — Firestore (Plataforma de streaming educacional)

Use no **Console Firebase** para testar o esqueleto. Ajuste IDs (`demo`, `mod-01`, `SEU_UID`) conforme necessário.

## 1. Curso


**Coleção:** `courses`  
**ID do documento:** `demo`

| Campo | Valor exemplo |
| --- | --- |
| `title` | Curso demonstração Plataforma de streaming educacional |
| `description` | Texto opcional para a listagem |

## 2. Módulo (subcoleção `modules` de `courses/demo`)

**ID:** `mod-01`

| Campo | Tipo | Exemplo |
| --- | --- | --- |
| `title` | string | Introdução |
| `content` | string | Texto longo do módulo… |
| `vimeoUrl` | string | `https://vimeo.com/76979871` |
| `pdfUrl` | string | URL pública do PDF ou link do Storage |
| `order` | number | `0` |
| `questions` | array | Ver JSON abaixo |

**`questions` (3 objetivas):**

```json
[
  {
    "id": "q1",
    "prompt": "Qual é a capital do Brasil?",
    "options": ["São Paulo", "Brasília", "Rio de Janeiro"]
  },
  {
    "id": "q2",
    "prompt": "2 + 2 é igual a?",
    "options": ["3", "4", "5"]
  },
  {
    "id": "q3",
    "prompt": "O sol nasce no…",
    "options": ["Norte", "Sul", "Leste"]
  }
]
```

### Importante — não misture gabarito no módulo

**Não** adicione `correctByQuestionId` (nem qualquer gabarito) no documento `courses/demo/modules/mod-01`.

O aluno **precisa** ler esse documento para ver texto, vídeo e perguntas; no Firestore a leitura é do **documento inteiro**. Se o gabarito estiver no mesmo doc, qualquer cliente autenticado com acesso ao módulo **veria as respostas corretas** no painel de rede ou no SDK.

O gabarito fica **somente** na coleção `answerKeys` (seção 3), com regras que bloqueiam leitura pelo app.

## 3. Gabarito (coleção `answerKeys`)

**ID do documento:** `demo__mod-01` (convênio `courseId__moduleId`)

| Campo | Exemplo |
| --- | --- |
| `correctByQuestionId` | `{ "q1": 1, "q2": 1, "q3": 2 }` |

Índices = posição da opção correta (0 = primeira). O app **não** lê esta coleção.

## 4. Matrícula

1. Copie o **UID** do usuário (Authentication → usuários).
2. Crie documento em `users/{UID}/courses/demo` com pelo menos um campo, ex.:  
   `enrolledAt` = timestamp do servidor.

Sem esse documento, o aluno **não** vê o curso nem os módulos (regras de segurança).
