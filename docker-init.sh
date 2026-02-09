#!/bin/bash
set -e

echo "🚀 Container Initialisierung gestartet..."

generate_secret() {
    length=$1
    tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c $length
}

# Create .env if it doesn't exist
if [ ! -f /app/.env ]; then
    echo "📝 Erstelle .env Datei..."
    
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-secret-key-please-change" ]; then
        export JWT_SECRET=$(generate_secret 64)
        echo "🔑 Automatisch sicheres JWT Secret generiert"
    else
        echo "🔑 Verwende vorhandenes JWT Secret aus Umgebungsvariable"
    fi
    
    # Create .env with all proxy settings
    cat > /app/.env << EOF
NODE_ENV=${NODE_ENV:-production}
JWT_SECRET=${JWT_SECRET}
TRUST_PROXY_ENABLED=${TRUST_PROXY_ENABLED:-true}
TRUSTED_PROXY_IPS=${TRUSTED_PROXY_IPS:-172.0.0.0/8,10.0.0.0/8,192.168.0.0/16}
APP_PORT=${APP_PORT:-3002}
APP_URL=${APP_URL:-http://localhost:3002}
FORCE_HTTPS=${FORCE_HTTPS:-false}
RATE_LIMIT_MAX_REQUESTS=${RATE_LIMIT_MAX_REQUESTS:-500}
AUTH_RATE_LIMIT_MAX_REQUESTS=${AUTH_RATE_LIMIT_MAX_REQUESTS:-100}
EXPENSIVE_ENDPOINT_LIMIT=${EXPENSIVE_ENDPOINT_LIMIT:-100}
EOF
    
    echo "✅ .env Datei erstellt"
else
    echo "ℹ️  .env Datei existiert bereits"
    
    # Update JWT_SECRET if provided
    if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "your-secret-key-please-change" ]; then
        echo "🔑 Aktualisiere JWT Secret in .env Datei"
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" /app/.env
    fi
fi

# Validate JWT_SECRET
if grep -q "JWT_SECRET=your-secret-key-please-change" /app/.env; then
    echo "❌ FEHLER: Standard JWT Secret in .env gefunden!"
    echo "❌ Bitte setzen Sie JWT_SECRET Umgebungsvariable"
    exit 1
fi

chmod 600 /app/.env

echo "🔧 Proxy Configuration:"
echo "   - TRUST_PROXY_ENABLED: ${TRUST_PROXY_ENABLED:-true}"
echo "   - TRUSTED_PROXY_IPS: ${TRUSTED_PROXY_IPS:-172.0.0.0/8,10.0.0.0/8,192.168.0.0/16}"
echo "🔧 Starte Anwendung..."
exec "$@"