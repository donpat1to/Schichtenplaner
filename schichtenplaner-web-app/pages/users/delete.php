<?php
/**
 * User Management - Delete/Deactivate User
 */

requireRole('admin');

if (!isPost()) {
    redirect('/users');
}

requireCsrf();

$userId = post('id');

if (!$userId) {
    flashError('Benutzer-ID fehlt.');
    redirect('/users');
}

// Prevent self-deletion
if ($userId === getCurrentUserId()) {
    flashError('Sie koennen sich nicht selbst deaktivieren.');
    redirect('/users');
}

$user = getUserById($userId);

if (!$user) {
    flashError('Benutzer nicht gefunden.');
    redirect('/users');
}

// Soft delete (deactivate) the user
if (deleteUser($userId)) {
    flashSuccess('Benutzer "' . h(fullName($user)) . '" wurde deaktiviert.');
} else {
    flashError('Fehler beim Deaktivieren des Benutzers.');
}

redirect('/users');
