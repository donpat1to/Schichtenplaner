#!/bin/bash
set -e

echo "🚀 Container Initialisierung gestartet..."

# Funktion zum Generieren eines sicheren Secrets
generate_secret() {
    length=$1
    tr -dc 'A-Za-z0-9!@#$%^&*()_+-=' < /dev/urandom | head -c $length
}

# Prüfe ob .env existiert, falls nicht erstelle sie
if [ ! -f /app/.env ]; then
    echo "📝 Erstelle .env Datei..."
    
    # Generiere automatisch ein sicheres JWT Secret falls nicht gesetzt
    if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "your-secret-key-please-change" ]; then
        export JWT_SECRET=$(generate_secret 64)
        echo "🔑 Automatisch generiertes JWT Secret wurde erstellt"
    fi
    
    # Erstelle .env aus Template
    envsubst < /app/.env.template > /app/.env
    
    # Logge die ersten Zeilen (ohne Secrets)
    echo "✅ .env Datei erstellt mit folgenden Einstellungen:"
    head -n 5 /app/.env
else
    echo "ℹ️  .env Datei existiert bereits"
    
    # Validiere bestehende .env Datei
    if ! grep -q "JWT_SECRET=" /app/.env; then
        echo "❌ Fehler: JWT_SECRET nicht in .env gefunden"
        exit 1
    fi
fi

# Sicherheitsüberprüfungen
if grep -q "your-secret-key" /app/.env; then
    echo "❌ FEHLER: Standard JWT Secret in .env gefunden - bitte ändern!"
    exit 1
fi

# Setze sichere Berechtigungen
chmod 600 /app/.env
chown -R schichtplaner:nodejs /app

echo "🔧 Starte Anwendung..."
exec "$@"