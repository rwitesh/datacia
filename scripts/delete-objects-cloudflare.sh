#!/bin/bash

# Load .env
set -a
source "$(dirname "$0")/.env"
set +a

# Delete all objects
echo "Deleting all objects from bucket: $BUCKET_NAME"

AWS_ACCESS_KEY_ID=$ACCESS_KEY_ID \
AWS_SECRET_ACCESS_KEY=$SECRET_ACCESS_KEY \
aws s3 rm "s3://${BUCKET_NAME}" \
  --recursive \
  --endpoint-url "https://${ACCOUNT_ID}.r2.cloudflarestorage.com"

echo "Done."