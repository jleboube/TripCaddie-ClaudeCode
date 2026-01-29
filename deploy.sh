#!/bin/bash
# TripCaddie IQBE - One-command deployment
# Usage: ./deploy.sh [up|down|restart|logs]

set -e

SECRETS_FILE=".secrets"
ENV_FILE=".env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "============================================"
echo "  TripCaddie IQBE Deployment"
echo "============================================"
echo ""

# Function to generate secrets
generate_secrets() {
    if [ -f "$SECRETS_FILE" ]; then
        echo -e "${GREEN}✓${NC} Secrets file exists"
        return 0
    fi

    echo -e "${YELLOW}→${NC} Generating cryptographic secrets..."

    # Generate cryptographically secure random values
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_KEY=$(openssl rand -base64 32)

    # Write to .secrets file
    cat > "$SECRETS_FILE" << EOF
# Auto-generated secrets - DO NOT COMMIT TO GIT
# Generated on: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Database password (used by both app and PostgreSQL)
DB_PASSWORD=${DB_PASSWORD}
POSTGRES_PASSWORD=${DB_PASSWORD}

# NextAuth.js session encryption
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# AES-256 encryption key for PII
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

    chmod 600 "$SECRETS_FILE"
    echo -e "${GREEN}✓${NC} Secrets generated: $SECRETS_FILE"
}

# Function to check/create .env
check_env() {
    if [ -f "$ENV_FILE" ]; then
        echo -e "${GREEN}✓${NC} Environment file exists"
        return 0
    fi

    echo -e "${YELLOW}→${NC} Creating default .env file..."

    cat > "$ENV_FILE" << 'EOF'
# TripCaddie IQBE - User Configuration
# Only user-specific and third-party settings here
# Internal secrets are auto-generated in .secrets

# Application URL
NEXTAUTH_URL=http://localhost:47319

# Admin Account (created on first startup)
ADMIN_EMAIL=admin@tripcaddie.com
ADMIN_NAME=Admin
ADMIN_PASSWORD=changeme123

# Email Service (optional - get key at https://resend.com)
EMAIL_FROM=noreply@tripcaddie.com
RESEND_API_KEY=
EOF

    echo -e "${GREEN}✓${NC} Default .env created"
    echo -e "${YELLOW}!${NC} Edit .env to set your admin email/password"
}

# Main command handling
case "${1:-up}" in
    up)
        generate_secrets
        check_env
        echo ""
        echo -e "${YELLOW}→${NC} Building and starting containers..."
        docker compose up -d --build
        echo ""
        echo -e "${GREEN}✓${NC} Deployment complete!"
        echo ""
        echo "  Quote Form:  http://localhost:47319/quote"
        echo "  Admin Login: http://localhost:47319/admin/login"
        echo "  Health:      http://localhost:47319/api/health"
        echo ""
        ;;
    down)
        echo -e "${YELLOW}→${NC} Stopping containers..."
        docker compose down
        echo -e "${GREEN}✓${NC} Containers stopped"
        ;;
    restart)
        echo -e "${YELLOW}→${NC} Restarting containers..."
        docker compose restart
        echo -e "${GREEN}✓${NC} Containers restarted"
        ;;
    reset)
        echo -e "${RED}!${NC} This will delete all data. Are you sure? (y/N)"
        read -r confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            docker compose down -v
            rm -f "$SECRETS_FILE"
            echo -e "${GREEN}✓${NC} Reset complete. Run ./deploy.sh to start fresh."
        else
            echo "Cancelled."
        fi
        ;;
    logs)
        docker compose logs -f "${2:-app}"
        ;;
    *)
        echo "Usage: ./deploy.sh [up|down|restart|reset|logs]"
        echo ""
        echo "Commands:"
        echo "  up      - Build and start (default)"
        echo "  down    - Stop containers"
        echo "  restart - Restart containers"
        echo "  reset   - Delete all data and secrets"
        echo "  logs    - View logs (optional: service name)"
        ;;
esac
