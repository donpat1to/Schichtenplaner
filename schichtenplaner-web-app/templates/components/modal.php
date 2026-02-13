<?php
/**
 * Modal Component
 *
 * Usage with Alpine.js:
 *
 * <button @click="$dispatch('open-modal', 'my-modal')">Open Modal</button>
 *
 * <?php startModal('my-modal', 'Modal Title'); ?>
 *   <p>Modal content goes here</p>
 * <?php endModal(); ?>
 */

function startModal(string $id, string $title, string $size = ''): void {
    $sizeClass = $size ? "modal-{$size}" : '';
    ?>
    <div x-data="{ open: false }"
         x-show="open"
         x-cloak
         @open-modal.window="if ($event.detail === '<?= h($id) ?>') open = true"
         @close-modal.window="open = false"
         @keydown.escape.window="open = false"
         class="modal-overlay"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0">
        <div class="modal <?= $sizeClass ?>" @click.away="open = false">
            <div class="modal-header">
                <h3 class="modal-title"><?= h($title) ?></h3>
                <button type="button" class="modal-close" @click="open = false">&times;</button>
            </div>
            <div class="modal-body">
    <?php
}

function endModal(bool $showFooter = false, string $footerContent = ''): void {
    ?>
            </div>
            <?php if ($showFooter): ?>
            <div class="modal-footer">
                <?= $footerContent ?>
            </div>
            <?php endif; ?>
        </div>
    </div>
    <?php
}

/**
 * Confirmation Modal Component
 */
function confirmModal(string $id, string $title, string $message, string $confirmText = 'Bestaetigen', string $confirmClass = 'btn-danger'): void {
    ?>
    <div x-data="{ open: false, callback: null }"
         x-show="open"
         x-cloak
         @confirm-modal.window="if ($event.detail.id === '<?= h($id) ?>') { open = true; callback = $event.detail.callback; }"
         @keydown.escape.window="open = false"
         class="modal-overlay">
        <div class="modal" @click.away="open = false">
            <div class="modal-header">
                <h3 class="modal-title"><?= h($title) ?></h3>
                <button type="button" class="modal-close" @click="open = false">&times;</button>
            </div>
            <div class="modal-body">
                <p><?= h($message) ?></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn" @click="open = false">Abbrechen</button>
                <button type="button" class="btn <?= h($confirmClass) ?>" @click="if(callback) callback(); open = false">
                    <?= h($confirmText) ?>
                </button>
            </div>
        </div>
    </div>
    <?php
}
