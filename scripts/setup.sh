#!/bin/bash
set -e

# TripCaddie IQBE Setup Script
# Generates all required secrets and creates .env file

echo "============================================"
echo "  TripCaddie IQBE Setup"
echo "============================================"
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "WARNING: .env file already exists."
    read -p "Do you want to overwrite it? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Prompt for admin credentials
echo ""
echo "--- Admin Account Setup ---"
read -p "Admin Email: " ADMIN_EMAIL
while [ -z "$ADMIN_EMAIL" ]; do
    echo "Email is required."
    read -p "Admin Email: " ADMIN_EMAIL
done

read -p "Admin Name (optional, press Enter to skip): " ADMIN_NAME
if [ -z "$ADMIN_NAME" ]; then
    ADMIN_NAME="Admin"
fi

# Generate or prompt for admin password
echo ""
echo "Admin password options:"
echo "  1. Generate a secure random password (recommended)"
echo "  2. Enter your own password"
read -p "Choose (1 or 2): " pw_choice

if [ "$pw_choice" = "2" ]; then
    read -s -p "Enter Admin Password: " ADMIN_PASSWORD
    echo ""
    read -s -p "Confirm Admin Password: " ADMIN_PASSWORD_CONFIRM
    echo ""
    while [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD_CONFIRM" ]; do
        echo "Passwords do not match. Try again."
        read -s -p "Enter Admin Password: " ADMIN_PASSWORD
        echo ""
        read -s -p "Confirm Admin Password: " ADMIN_PASSWORD_CONFIRM
        echo ""
    done
else
    ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 20)
fi

# Generate secrets
echo ""
echo "Generating secrets..."

DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
NEXTAUTH_SECRET=$(openssl rand -base64 32)
ENCRYPTION_KEY=$(openssl rand -base64 32)

# Prompt for optional Resend API key
echo ""
echo "--- Email Configuration (Optional) ---"
echo "Resend API key is required for sending booking emails."
echo "Get one at https://resend.com"
read -p "Resend API Key (press Enter to skip): " RESEND_API_KEY

if [ -z "$RESEND_API_KEY" ]; then
    RESEND_API_KEY="re_your_api_key_here"
    echo "Note: Email functionality will not work until you add a valid API key."
fi

read -p "From Email (default: noreply@tripcaddie.com): " EMAIL_FROM
if [ -z "$EMAIL_FROM" ]; then
    EMAIL_FROM="noreply@tripcaddie.com"
fi

# Create .env file
cat > .env << EOF
# TripCaddie IQBE Configuration
# Generated on $(date)

# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=http://localhost:47319

# Database
DATABASE_URL=postgresql://tripcaddie:${DB_PASSWORD}@db:5432/tripcaddie
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_URL=redis://redis:6379

# Authentication
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
NEXTAUTH_URL=http://localhost:47319

# Admin Account (created on first startup)
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_NAME=${ADMIN_NAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# Email (Resend)
EMAIL_FROM=${EMAIL_FROM}
RESEND_API_KEY=${RESEND_API_KEY}

# Encryption (AES-256 key for PII)
ENCRYPTION_KEY=${ENCRYPTION_KEY}
EOF

chmod 600 .env

# Output summary
echo ""
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Configuration saved to .env"
echo ""
echo "--- IMPORTANT: Save these credentials ---"
echo ""
echo "Admin Login:"
echo "  Email:    ${ADMIN_EMAIL}"
if [ "$pw_choice" != "2" ]; then
    echo "  Password: ${ADMIN_PASSWORD}"
    echo ""
    echo "  (Password was auto-generated. Save it now!)"
fi
echo ""
echo "Database Password: ${DB_PASSWORD}"
echo ""
echo "--- Next Steps ---"
echo ""
echo "1. Review and update .env if needed"
echo "2. Build and start the application:"
echo "   docker compose build"
echo "   docker compose up -d"
echo ""
echo "3. Access the application at:"
echo "   http://localhost:47319"
echo ""
echo "4. Login to admin at:"
echo "   http://localhost:47319/admin/login"
echo ""
