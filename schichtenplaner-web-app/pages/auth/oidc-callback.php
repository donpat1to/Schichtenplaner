<?php
/**
 * OIDC Callback Handler
 *
 * Handles the callback from the identity provider after authentication.
 */

// Check if OIDC is enabled
if (!isOidcEnabled()) {
    flashError('OIDC-Authentifizierung ist nicht aktiviert.');
    redirect('/login');
}

// Check for errors from IdP
if (isset($_GET['error'])) {
    $errorDescription = get('error_description', get('error', 'Unknown error'));
    flashError('Authentifizierung fehlgeschlagen: ' . $errorDescription);
    cleanupOidcSession();
    redirect('/login');
}

// Verify state parameter
$state = get('state', '');
if (!validateOidcState($state)) {
    flashError('Ungueltiger Authentifizierungsstatus. Bitte versuchen Sie es erneut.');
    cleanupOidcSession();
    redirect('/login');
}

// Get authorization code
$code = get('code', '');
if (empty($code)) {
    flashError('Kein Autorisierungscode erhalten.');
    cleanupOidcSession();
    redirect('/login');
}

// Get provider slug from session
$slug = $_SESSION['oidc_idp_slug'] ?? 'keycloak';
$idp = getOidcProvider($slug);

if (!$idp) {
    flashError('Identity Provider nicht gefunden.');
    cleanupOidcSession();
    redirect('/login');
}

try {
    // Exchange code for tokens
    $tokens = exchangeCodeForTokens($idp, $code);

    // Decode ID token to get user claims
    $claims = decodeJwtPayload($tokens['id_token']);

    // Map claims to user data
    $userData = mapOidcClaimsToUser($claims, $idp['claimMapping'], $idp['defaultRole']);

    // Find or create user
    $user = findOrCreateOidcUser($idp['id'], $userData);

    // Check if user is active
    if (!$user['is_active']) {
        flashError('Ihr Konto ist deaktiviert. Bitte kontaktieren Sie den Administrator.');
        cleanupOidcSession();
        redirect('/login');
    }

    // Login user
    loginUser($user, 'oidc');
    setSession('oidc_provider', $slug);

    // Get return URL
    $returnUrl = $_SESSION['oidc_return_url'] ?? '/dashboard';

    // Clean up OIDC session data
    cleanupOidcSession();

    // Success message and redirect
    flashSuccess('Willkommen, ' . h($user['firstname'] ?: $user['username']) . '!');
    redirect($returnUrl);

} catch (Exception $e) {
    if (APP_DEBUG) {
        error_log('OIDC callback error: ' . $e->getMessage());
        flashError('OIDC-Fehler: ' . $e->getMessage());
    } else {
        flashError('Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
    cleanupOidcSession();
    redirect('/login');
}
