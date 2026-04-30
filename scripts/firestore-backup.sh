#!/usr/bin/env bash
# ============================================================================
# Backup manual do Firestore → Google Cloud Storage
# ============================================================================
# Pré-requisitos:
#   1. gcloud CLI instalado e autenticado: gcloud auth login
#   2. Projeto selecionado: gcloud config set project medivox-sp
#   3. Bucket de backup criado (uma vez):
#        gsutil mb -l southamerica-east1 gs://medivox-backups
#   4. API Firestore habilitada: gcloud services enable firestore.googleapis.com
#
# Uso:
#   bash scripts/firestore-backup.sh
#
# Para AGENDAR backups automáticos (recomendado antes de ir para produção):
#   1. No Google Cloud Console → Firestore → Backups → Configurar agendamento
#   2. Ou via gcloud:
#        gcloud firestore databases update --database="(default)" \
#          --backup-schedule="0 3 * * *" \
#          --retention-period="7d"
#
# Para RESTAURAR um backup:
#   gcloud firestore import gs://medivox-backups/BACKUP_FOLDER
# ============================================================================

set -euo pipefail

PROJECT_ID="${GCP_PROJECT:-medivox-sp}"
BUCKET="gs://${BACKUP_BUCKET:-medivox-backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

echo "Exportando Firestore do projeto $PROJECT_ID para $BUCKET/$TIMESTAMP..."
gcloud firestore export "$BUCKET/$TIMESTAMP" --project="$PROJECT_ID"
echo "Backup concluído: $BUCKET/$TIMESTAMP"
