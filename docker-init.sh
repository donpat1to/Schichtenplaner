#!/bin/bash
set -e

echo "🚀 Container Initialisierung gestartet..."

# Funktion zum Generieren eines sicheren Secrets
generate_secret() {
    length=$1
    tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c $length
}

# Prüfe ob .env existiert
if [ ! -f /app/.env ]; then
    echo "📝 Erstelle .env Datei..."
    
    # Verwende vorhandenes JWT_SECRET oder generiere ein neues
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-secret-key-please-change" ]; then
        export JWT_SECRET=$(generate_secret 64)
        echo "🔑 Automatisch sicheres JWT Secret generiert"
    else
        echo "🔑 Verwende vorhandenes JWT Secret aus Umgebungsvariable"
    fi
    
    # Erstelle .env aus Template mit envsubst
    envsubst < /app/.env.template > /app/.env
    echo "✅ .env Datei erstellt"
    
else
    echo "ℹ️  .env Datei existiert bereits"
    
    # Wenn .env existiert, aber JWT_SECRET Umgebungsvariable gesetzt ist, aktualisiere sie
    if [ -n "$JWT_SECRET" ] && [ "$JWT_SECRET" != "your-secret-key-please-change" ]; then
        echo "🔑 Aktualisiere JWT Secret in .env Datei"
        # Aktualisiere nur das JWT_SECRET in der .env Datei
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" /app/.env
    fi
fi

# Validiere dass JWT_SECERT nicht der Standardwert ist
if grep -q "JWT_SECRET=your-secret-key-please-change" /app/.env; then
    echo "❌ FEHLER: Standard JWT Secret in .env gefunden!"
    echo "❌ Bitte setzen Sie JWT_SECRET Umgebungsvariable"
    exit 1
fi

# Setze sichere Berechtigungen
chmod 600 /app/.env

echo "🔧 Starte Anwendung..."
exec "$@"