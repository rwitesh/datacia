#!/bin/bash
set -e

# Upload files to Cloudflare R2 (S3-compatible)
# Usage: ./scripts/upload-cloudflare-r2.sh <source_directory>
#
# Required environment variables (can be set in .env file):
#   R2_ACCOUNT_ID       - Cloudflare account ID
#   R2_ACCESS_KEY_ID   - R2 API token access key
#   R2_SECRET_ACCESS_KEY - R2 API token secret
#   R2_BUCKET_NAME     - Target R2 bucket name
#
# See: https://developers.cloudflare.com/r2/objects/upload-objects/

# Load .env file if it exists (for local development)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env" ]; then
    echo "Loading environment from .env file..."
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
fi

SOURCE_DIR="$1"

if [ -z "$SOURCE_DIR" ]; then
    echo "Error: Source directory not provided"
    echo "Usage: $0 <source_directory>"
    exit 1
fi

if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Directory '$SOURCE_DIR' does not exist"
    exit 1
fi

if [ -z "$R2_ACCOUNT_ID" ]; then
    echo "Error: R2_ACCOUNT_ID environment variable not set"
    exit 1
fi

if [ -z "$R2_ACCESS_KEY_ID" ]; then
    echo "Error: R2_ACCESS_KEY_ID environment variable not set"
    exit 1
fi

if [ -z "$R2_SECRET_ACCESS_KEY" ]; then
    echo "Error: R2_SECRET_ACCESS_KEY environment variable not set"
    exit 1
fi

if [ -z "$R2_BUCKET_NAME" ]; then
    echo "Error: R2_BUCKET_NAME environment variable not set"
    exit 1
fi

# AWS CLI uses these env vars; R2 is S3-compatible
export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
R2_ENDPOINT="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

# Get the version directory name (e.g., V0.9.54)
VERSION_DIR=$(basename "$SOURCE_DIR")

echo "Uploading files from '$SOURCE_DIR' to R2 bucket '$R2_BUCKET_NAME'..."
echo "Version: $VERSION_DIR"
echo "Endpoint: $R2_ENDPOINT"

# Check for aws CLI
if ! command -v aws &>/dev/null; then
    echo "Error: AWS CLI is required for R2 upload. Install it: https://aws.amazon.com/cli/"
    exit 1
fi

# Find all release files (same patterns as Supabase script)
find "$SOURCE_DIR" -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.zip" -o -name "*.tar.gz" -o -name "*.deb" -o -name "*.rpm" -o -name "*.msi" -o -name "*.AppImage" \) | while read -r FILE; do
    # Get relative path from source directory
    RELATIVE_PATH="${FILE#$SOURCE_DIR/}"
    # Object key: V<version>/os/arch/filename
    OBJECT_KEY="$VERSION_DIR/$RELATIVE_PATH"

    # Content-Type based on file extension
    case "${FILE##*.}" in
        dmg)
            CONTENT_TYPE="application/x-apple-diskimage"
            ;;
        exe)
            CONTENT_TYPE="application/x-msdownload"
            ;;
        zip)
            CONTENT_TYPE="application/zip"
            ;;
        tar|gz|tgz)
            CONTENT_TYPE="application/gzip"
            ;;
        deb)
            CONTENT_TYPE="application/vnd.debian.binary-package"
            ;;
        rpm)
            CONTENT_TYPE="application/x-rpm"
            ;;
        *)
            CONTENT_TYPE="application/octet-stream"
            ;;
    esac

    FILE_SIZE=$(stat -f%z "$FILE" 2>/dev/null || stat -c%s "$FILE" 2>/dev/null)
    echo "Uploading: $OBJECT_KEY ($(numfmt --to=iec-i --suffix=B $FILE_SIZE 2>/dev/null || echo "${FILE_SIZE} bytes"))"

    aws s3 cp "$FILE" "s3://${R2_BUCKET_NAME}/${OBJECT_KEY}" \
        --endpoint-url "$R2_ENDPOINT" \
        --content-type "$CONTENT_TYPE" \
        --no-progress
    echo "  Success: $OBJECT_KEY"
done

echo ""
echo "Upload complete!"
echo "Bucket: s3://$R2_BUCKET_NAME (endpoint: $R2_ENDPOINT)"
echo "Objects under key prefix: $VERSION_DIR/"
