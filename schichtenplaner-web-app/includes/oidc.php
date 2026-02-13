<?php
/**
 * OIDC (Keycloak) Authentication Functions
 */

/**
 * Get OIDC provider configuration from database
 *
 * @param string $slug Provider slug (e.g., 'keycloak')
 * @return array|null
 */
function getOidcProvider(string $slug): ?array {
    $idp = fetchOne(
        "SELECT * FROM identity_providers WHERE slug = ? AND enabled = 1",
        [$slug]
    );

    if (!$idp) {
        return null;
    }

    return [
        'id' => $idp['id'],
        'slug' => $idp['slug'],
        'name' => $idp['name'],
        'issuer' => $idp['issuer'],
        'clientId' => $idp['client_id'],
        'clientSecret' => $idp['client_secret'],
        'scope' => json_decode($idp['scope'], true) ?: ['openid', 'profile', 'email'],
        'claimMapping' => json_decode($idp['claim_mapping'], true) ?: [],
        'pkceEnabled' => (bool) $idp['pkce_enabled'],
        'defaultRole' => $idp['default_role'] ?: 'user',
    ];
}

/**
 * Get all enabled OIDC providers for login page
 *
 * @return array
 */
function getEnabledProviders(): array {
    return fetchAll(
        "SELECT id, slug, name FROM identity_providers WHERE enabled = 1"
    );
}

/**
 * Discover OIDC endpoints from issuer URL
 *
 * @param string $issuer
 * @return array
 * @throws Exception
 */
function discoverOidcEndpoints(string $issuer): array {
    $discoveryUrl = rtrim($issuer, '/') . '/.well-known/openid-configuration';

    $context = stream_context_create(['http' => ['timeout' => 10]]);
    $json = @file_get_contents($discoveryUrl, false, $context);

    if ($json === false) {
        throw new Exception("Failed to fetch OIDC discovery document from $discoveryUrl");
    }

    $config = json_decode($json, true);
    if (!$config) {
        throw new Exception("Invalid OIDC discovery document");
    }

    return [
        'authorization_endpoint' => $config['authorization_endpoint'],
        'token_endpoint' => $config['token_endpoint'],
        'userinfo_endpoint' => $config['userinfo_endpoint'] ?? null,
        'end_session_endpoint' => $config['end_session_endpoint'] ?? null,
    ];
}

/**
 * Generate PKCE code verifier and challenge
 *
 * @return array ['verifier' => string, 'challenge' => string]
 */
function generatePkce(): array {
    $verifier = bin2hex(random_bytes(32));
    $challenge = rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '=');

    return [
        'verifier' => $verifier,
        'challenge' => $challenge,
    ];
}

/**
 * Build authorization URL for OIDC login
 *
 * @param array $idp Provider configuration
 * @param string $returnUrl URL to return to after login
 * @return string
 */
function buildAuthorizationUrl(array $idp, string $returnUrl): string {
    $endpoints = discoverOidcEndpoints($idp['issuer']);
    $pkce = generatePkce();

    // Store PKCE verifier and state in session
    $state = bin2hex(random_bytes(16));
    $_SESSION['oidc_state'] = $state;
    $_SESSION['oidc_pkce_verifier'] = $pkce['verifier'];
    $_SESSION['oidc_return_url'] = $returnUrl;
    $_SESSION['oidc_idp_slug'] = $idp['slug'];

    $params = [
        'response_type' => 'code',
        'client_id' => $idp['clientId'],
        'redirect_uri' => APP_URL . '/auth/oidc/callback',
        'scope' => implode(' ', $idp['scope']),
        'state' => $state,
    ];

    if ($idp['pkceEnabled']) {
        $params['code_challenge'] = $pkce['challenge'];
        $params['code_challenge_method'] = 'S256';
    }

    return $endpoints['authorization_endpoint'] . '?' . http_build_query($params);
}

/**
 * Exchange authorization code for tokens
 *
 * @param array $idp Provider configuration
 * @param string $code Authorization code
 * @return array Tokens
 * @throws Exception
 */
function exchangeCodeForTokens(array $idp, string $code): array {
    $endpoints = discoverOidcEndpoints($idp['issuer']);

    $params = [
        'grant_type' => 'authorization_code',
        'client_id' => $idp['clientId'],
        'client_secret' => $idp['clientSecret'],
        'code' => $code,
        'redirect_uri' => APP_URL . '/auth/oidc/callback',
    ];

    if ($idp['pkceEnabled'] && isset($_SESSION['oidc_pkce_verifier'])) {
        $params['code_verifier'] = $_SESSION['oidc_pkce_verifier'];
    }

    $context = stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => http_build_query($params),
            'timeout' => 10,
        ]
    ]);

    $response = @file_get_contents($endpoints['token_endpoint'], false, $context);
    if ($response === false) {
        throw new Exception("Failed to exchange authorization code");
    }

    $tokens = json_decode($response, true);
    if (isset($tokens['error'])) {
        throw new Exception("Token error: " . ($tokens['error_description'] ?? $tokens['error']));
    }

    return $tokens;
}

/**
 * Decode JWT token payload (without verification - tokens already verified by IdP)
 *
 * @param string $jwt
 * @return array
 * @throws Exception
 */
function decodeJwtPayload(string $jwt): array {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        throw new Exception("Invalid JWT format");
    }

    $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
    if (!$payload) {
        throw new Exception("Failed to decode JWT payload");
    }

    return $payload;
}

/**
 * Map OIDC claims to internal user data
 *
 * @param array $claims Claims from ID token
 * @param array $claimMapping Mapping configuration
 * @param string $defaultRole Default role for new users
 * @return array
 */
function mapOidcClaimsToUser(array $claims, array $claimMapping, string $defaultRole): array {
    $mapping = array_merge([
        'id' => 'sub',
        'email' => 'email',
        'username' => 'preferred_username',
        'firstName' => 'given_name',
        'lastName' => 'family_name',
    ], $claimMapping);

    return [
        'idp_subject' => $claims[$mapping['id']] ?? null,
        'email' => $claims[$mapping['email']] ?? null,
        'username' => $claims[$mapping['username']] ?? $claims[$mapping['email']] ?? null,
        'firstname' => $claims[$mapping['firstName']] ?? null,
        'lastname' => $claims[$mapping['lastName']] ?? null,
        'role' => $defaultRole,
    ];
}

/**
 * Find or create user from OIDC login
 *
 * @param string $idpId Identity provider ID
 * @param array $userData Mapped user data
 * @return array User record
 */
function findOrCreateOidcUser(string $idpId, array $userData): array {
    // Check if identity link exists
    $user = fetchOne(
        "SELECT u.* FROM users u
         JOIN user_identities ui ON u.id = ui.user_id
         WHERE ui.idp_id = ? AND ui.idp_subject = ?",
        [$idpId, $userData['idp_subject']]
    );

    if ($user) {
        // Update last login
        query(
            "UPDATE user_identities SET last_login = NOW() WHERE idp_id = ? AND idp_subject = ?",
            [$idpId, $userData['idp_subject']]
        );
        return $user;
    }

    // Check if user exists by username (account linking)
    $user = fetchOne(
        "SELECT * FROM users WHERE username = ?",
        [$userData['username']]
    );

    if ($user) {
        // Link existing user to IdP
        insert('user_identities', [
            'id' => generateUUID(),
            'user_id' => $user['id'],
            'idp_id' => $idpId,
            'idp_subject' => $userData['idp_subject'],
            'idp_email' => $userData['email'],
            'last_login' => date('Y-m-d H:i:s'),
        ]);
        return $user;
    }

    // Create new user
    $userId = generateUUID();
    $placeholderPassword = hashPassword(bin2hex(random_bytes(32)));

    insert('users', [
        'id' => $userId,
        'username' => $userData['username'],
        'password_hash' => $placeholderPassword,
        'firstname' => $userData['firstname'],
        'lastname' => $userData['lastname'],
        'employee_type' => 'personell',
        'role' => $userData['role'],
        'is_active' => 1,
    ]);

    // Create identity link
    insert('user_identities', [
        'id' => generateUUID(),
        'user_id' => $userId,
        'idp_id' => $idpId,
        'idp_subject' => $userData['idp_subject'],
        'idp_email' => $userData['email'],
        'last_login' => date('Y-m-d H:i:s'),
    ]);

    return fetchOne("SELECT * FROM users WHERE id = ?", [$userId]);
}

/**
 * Clean up OIDC session data
 */
function cleanupOidcSession(): void {
    unset(
        $_SESSION['oidc_state'],
        $_SESSION['oidc_pkce_verifier'],
        $_SESSION['oidc_return_url'],
        $_SESSION['oidc_idp_slug']
    );
}

/**
 * Validate OIDC state parameter
 *
 * @param string $state
 * @return bool
 */
function validateOidcState(string $state): bool {
    $sessionState = $_SESSION['oidc_state'] ?? '';
    return !empty($state) && hash_equals($sessionState, $state);
}
