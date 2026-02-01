#!/bin/bash
set -e

# Upload files to Supabase Storage
# Usage: ./scripts/upload-supabase.sh <source_directory>
#
# Required environment variables (can be set in .env file):
#   SUPABASE_URL         - Supabase project URL (e.g., https://xxx.supabase.co)
#   SUPABASE_SERVICE_KEY - Service role key for authentication
#   SUPABASE_BUCKET      - Target bucket name

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

if [ -z "$SUPABASE_URL" ]; then
    echo "Error: SUPABASE_URL environment variable not set"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "Error: SUPABASE_SERVICE_KEY environment variable not set"
    exit 1
fi

if [ -z "$SUPABASE_BUCKET" ]; then
    echo "Error: SUPABASE_BUCKET environment variable not set"
    exit 1
fi

# Get the version directory name (e.g., V0.6.16)
VERSION_DIR=$(basename "$SOURCE_DIR")

echo "Uploading files from '$SOURCE_DIR' to Supabase bucket '$SUPABASE_BUCKET'..."
echo "Version: $VERSION_DIR"

# Find all release files (exclude hidden files like .DS_Store)
find "$SOURCE_DIR" -type f \( -name "*.dmg" -o -name "*.exe" -o -name "*.zip" -o -name "*.tar.gz" -o -name "*.deb" -o -name "*.rpm" -o -name "*.msi" -o -name "*.AppImage" \) | while read -r FILE; do
    # Get relative path from source directory
    RELATIVE_PATH="${FILE#$SOURCE_DIR/}"
    
    # Construct the storage path: V<version>/os/arch/filename
    STORAGE_PATH="$VERSION_DIR/$RELATIVE_PATH"
    
    # Get content type based on file extension
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
    echo "Uploading: $STORAGE_PATH ($(numfmt --to=iec-i --suffix=B $FILE_SIZE 2>/dev/null || echo "${FILE_SIZE} bytes"))"
    
    # Upload to Supabase Storage using REST API (with upsert to handle existing files)
    RESPONSE_FILE=$(mktemp)
    HTTP_STATUS=$(curl -s -w "%{http_code}" \
        -o "$RESPONSE_FILE" \
        -X POST \
        -H "apikey: $SUPABASE_SERVICE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Content-Type: $CONTENT_TYPE" \
        -H "x-upsert: true" \
        --data-binary "@$FILE" \
        "$SUPABASE_URL/storage/v1/object/$SUPABASE_BUCKET/$STORAGE_PATH")
    
    if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 201 ]; then
        echo "  Success: $STORAGE_PATH"
        rm -f "$RESPONSE_FILE"
    else
        echo "  Error (HTTP $HTTP_STATUS): $STORAGE_PATH"
        echo "  Response: $(cat "$RESPONSE_FILE")"
        rm -f "$RESPONSE_FILE"
        exit 1
    fi
done

echo ""
echo "Upload complete!"
echo "Files available at: $SUPABASE_URL/storage/v1/object/public/$SUPABASE_BUCKET/$VERSION_DIR/"
