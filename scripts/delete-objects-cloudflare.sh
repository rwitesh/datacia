#!/bin/bash

# Load .env (repo root first, then scripts/ for local overrides)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
set -a
if [[ -f "$SCRIPT_DIR/../.env" ]]; then
  source "$SCRIPT_DIR/../.env"
elif [[ -f "$SCRIPT_DIR/.env" ]]; then
  source "$SCRIPT_DIR/.env"
else
  echo "Error: no .env found. Put one at repo root (.env) or scripts/.env" >&2
  exit 1
fi
set +a

# Same names as upload-cloudflare-r2.sh, with short aliases for convenience
: "${ACCOUNT_ID:=${R2_ACCOUNT_ID:-}}"
: "${ACCESS_KEY_ID:=${R2_ACCESS_KEY_ID:-}}"
: "${SECRET_ACCESS_KEY:=${R2_SECRET_ACCESS_KEY:-}}"
: "${BUCKET_NAME:=${R2_BUCKET_NAME:-}}"

if [[ -z "$ACCOUNT_ID" || -z "$ACCESS_KEY_ID" || -z "$SECRET_ACCESS_KEY" || -z "$BUCKET_NAME" ]]; then
  echo "Error: set ACCOUNT_ID, ACCESS_KEY_ID, SECRET_ACCESS_KEY, BUCKET_NAME (or R2_* equivalents)" >&2
  exit 1
fi

R2_ENDPOINT="https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

# R2 requires region "auto" for SigV4; a region from ~/.aws/config breaks ListObjects (Unauthorized).
export AWS_ACCESS_KEY_ID="$ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$SECRET_ACCESS_KEY"
export AWS_DEFAULT_REGION=auto

# Delete all objects
echo "Deleting all objects from bucket: $BUCKET_NAME"

aws s3 rm "s3://${BUCKET_NAME}" \
  --recursive \
  --region auto \
  --endpoint-url "$R2_ENDPOINT"

echo "Done."