<?php
/**
 * Alert Component
 *
 * Usage:
 * <?php include_alert('success', 'Operation completed!'); ?>
 * <?php include_alert('error', 'Something went wrong.'); ?>
 */

function renderAlert(string $type, string $message, bool $dismissible = true): string {
    $typeClass = 'alert-' . h($type);
    $dismissButton = $dismissible
        ? '<button type="button" class="alert-close" onclick="this.parentElement.remove()">&times;</button>'
        : '';

    return <<<HTML
    <div class="alert {$typeClass}" role="alert">
        {$dismissButton}
        {$message}
    </div>
    HTML;
}

function includeAlert(string $type, string $message, bool $dismissible = true): void {
    echo renderAlert($type, h($message), $dismissible);
}
?>

<style>
.alert {
    position: relative;
}

.alert-close {
    position: absolute;
    right: var(--spacing-sm);
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: var(--font-size-lg);
    cursor: pointer;
    opacity: 0.6;
    padding: 0 var(--spacing-xs);
}

.alert-close:hover {
    opacity: 1;
}
</style>
