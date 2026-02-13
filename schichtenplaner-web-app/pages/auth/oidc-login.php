<?php
/**
 * OIDC Login Initiation
 *
 * Redirects to the identity provider for authentication.
 */

// Check if OIDC is enabled
if (!isOidcEnabled()) {
    flashError('OIDC-Authentifizierung ist nicht aktiviert.');
    redirect('/login');
}

// Get provider slug
$slug = get('provider', 'keycloak');
$returnUrl = get('return', '/dashboard');

// Get provider configuration
$idp = getOidcProvider($slug);

if (!$idp) {
    flashError('Identity Provider nicht gefunden oder nicht aktiviert.');
    redirect('/login');
}

try {
    // Build authorization URL and redirect
    $authUrl = buildAuthorizationUrl($idp, $returnUrl);
    redirect($authUrl);

} catch (Exception $e) {
    if (APP_DEBUG) {
        flashError('OIDC-Fehler: ' . $e->getMessage());
    } else {
        flashError('Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
    redirect('/login');
}
