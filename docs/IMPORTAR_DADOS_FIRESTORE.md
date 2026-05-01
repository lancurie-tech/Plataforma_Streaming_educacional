# Formas de alimentar o Firestore sem digitar tudo no Console

## 1. Script de seed no repositório (recomendado para desenvolvimento)

Na **raiz do repositório** Plataforma de streaming educacional existe:

- `scripts/seed-data.json` — edite este JSON (cursos, módulos, `answerKeys`).
- `scripts/seed-firestore.mjs` — envia esses dados com **Firebase Admin SDK**.

**Requisito:** arquivo JSON da **conta de serviço** (nunca commite no Git).

1. Firebase Console → ⚙️ **Configurações do projeto** → **Contas de serviço** → **Gerar nova chave privada**.
2. Salve o arquivo em um lugar seguro (ex.: `C:\Secrets\Plataforma de streaming educacional-adminsdk.json`).
3. Instale dependências: `npm install` (na raiz `Plataforma de streaming educacional/`).
4. No PowerShell:

```powershell
cd C:\Projetos\Plataforma de streaming educacional
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Secrets\Plataforma de streaming educacional-adminsdk.json"
# opcional: matricular um usuário existente (UID do Authentication)
$env:ENROLL_UID="coleAquiOUid"
npm run seed:firestore
```

O Admin SDK **ignora** as Security Rules; serve para carga inicial e manutenção. O app do aluno continua limitado pelas regras.

**Limite:** um único `batch` do Firestore aceita até **500** operações; para seeds enormes, divida em vários batches (o script atual é pequeno).

---

## 2. JSON “solto” no Console

O Console **não** importa um JSON arbitrário para vários documentos de uma vez. Você cola JSON **por campo** (ex.: um array), o que ajuda pouco em escala.

---

## 3. Exportar / importar (Google Cloud)

O fluxo oficial de **import/export** do Firestore usa **formato próprio** (bucket GCS), pensado em **backup/migração de banco inteiro**, não em editar um JSON de curso no dia a dia.

---

## 4. Outras ferramentas

- **Extensões** do Firebase marketplace (“import CSV/JSON”) — variam em custo e flexibilidade.
- **Cloud Functions** disparadas uma vez para popular dados.
- **Ferramentas de terceiros** (ex.: emulators + fixtures).

Para o Plataforma de streaming educacional, o caminho mais simples costuma ser **editar `seed-data.json` + `npm run seed:firestore`**.
