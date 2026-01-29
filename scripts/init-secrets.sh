#!/bin/bash
# Auto-generate internal secrets on first deployment
# These are cryptographic secrets that don't need to be memorable

SECRETS_FILE=".secrets"

# Only generate if .secrets doesn't exist
if [ -f "$SECRETS_FILE" ]; then
    echo "Secrets already exist in $SECRETS_FILE"
    exit 0
fi

echo "Generating internal secrets..."

# Generate cryptographically secure random values
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Write to .secrets file
cat > "$SECRETS_FILE" << EOF
# Auto-generated secrets - DO NOT COMMIT TO GIT
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Database password (internal PostgreSQL)
DB_PASSWORD=${DB_PASSWORD}

# NextAuth.js session encryption
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# AES-256 encryption key for PII
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

chmod 600 "$SECRETS_FILE"
echo "Secrets generated and saved to $SECRETS_FILE"
