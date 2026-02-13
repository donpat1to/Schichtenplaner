<?php
/**
 * Logout Handler
 */

// Get auth method before destroying session
$authMethod = session('auth_method', 'local');
$oidcProvider = session('oidc_provider');

// Destroy local session
logoutUser();

// Flash message
flash('success', 'Sie wurden erfolgreich abgemeldet.');

// Redirect to login
redirect('/login');
