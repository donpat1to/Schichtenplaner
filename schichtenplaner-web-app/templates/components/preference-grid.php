<?php
/**
 * Preference Grid Component
 *
 * Interactive grid for entering shift/weekly preferences.
 * Uses Alpine.js for interactivity.
 */

/**
 * Render shift preference grid
 *
 * @param array $timeSlots Time slots with shifts grouped by day
 * @param array $preferences Existing preferences [shift_id => level]
 * @param string $planId Plan ID for saving
 * @param bool $readonly If true, grid is not editable
 */
function renderShiftPreferenceGrid(array $timeSlots, array $preferences, string $planId, bool $readonly = false): void {
    $days = [1 => 'Mo', 2 => 'Di', 3 => 'Mi', 4 => 'Do', 5 => 'Fr', 6 => 'Sa', 7 => 'So'];
    ?>
    <div x-data="preferenceGrid(<?= h(json_encode($preferences)) ?>, '<?= h($planId) ?>')" class="preference-grid">
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th style="width: 150px;">Zeitfenster</th>
                        <?php foreach ($days as $num => $day): ?>
                            <th style="width: 80px;"><?= $day ?></th>
                        <?php endforeach; ?>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($timeSlots as $slot): ?>
                    <tr>
                        <td>
                            <strong><?= h($slot['name']) ?></strong><br>
                            <span class="text-sm text-muted">
                                <?= formatTime($slot['start_time']) ?> - <?= formatTime($slot['end_time']) ?>
                            </span>
                        </td>
                        <?php for ($day = 1; $day <= 7; $day++): ?>
                            <?php if (isset($slot['shifts'][$day])):
                                $shift = $slot['shifts'][$day];
                                $pref = $preferences[$shift['id']] ?? 2;
                            ?>
                            <td>
                                <?php if ($readonly): ?>
                                    <div class="pref-cell <?= prefClass($pref) ?>">
                                        <?= prefShortLabel($pref) ?>
                                    </div>
                                <?php else: ?>
                                    <div class="pref-cell"
                                         :class="getPrefClass('<?= $shift['id'] ?>')"
                                         @click="cyclePreference('<?= $shift['id'] ?>')">
                                        <span x-text="getPrefLabel('<?= $shift['id'] ?>')"></span>
                                    </div>
                                <?php endif; ?>
                            </td>
                            <?php else: ?>
                            <td class="no-shift">-</td>
                            <?php endif; ?>
                        <?php endfor; ?>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <?php if (!$readonly): ?>
        <div class="flex flex-between flex-center mt-lg">
            <div class="flex gap-md">
                <span class="pref-cell pref-preferred" style="display: inline-block;">Ja! = Bevorzugt</span>
                <span class="pref-cell pref-available" style="display: inline-block;">OK = Verfuegbar</span>
                <span class="pref-cell pref-unavailable" style="display: inline-block;">Nein = Nicht verfuegbar</span>
            </div>
            <button @click="savePreferences()" class="btn btn-primary" :disabled="saving">
                <span x-show="!saving">Speichern</span>
                <span x-show="saving" class="spinner"></span>
            </button>
        </div>
        <?php endif; ?>
    </div>

    <script>
    function preferenceGrid(initialPrefs, planId) {
        return {
            preferences: initialPrefs || {},
            planId: planId,
            saving: false,

            cyclePreference(shiftId) {
                const current = this.preferences[shiftId] || 2;
                const next = current === 1 ? 2 : (current === 2 ? 3 : 1);
                this.preferences[shiftId] = next;
            },

            getPrefClass(shiftId) {
                const level = this.preferences[shiftId] || 2;
                return {
                    'pref-preferred': level === 1,
                    'pref-available': level === 2,
                    'pref-unavailable': level === 3
                };
            },

            getPrefLabel(shiftId) {
                const labels = {1: 'Ja!', 2: 'OK', 3: 'Nein'};
                return labels[this.preferences[shiftId] || 2];
            },

            async savePreferences() {
                this.saving = true;
                try {
                    const response = await fetch('/api/preferences', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            type: 'shift',
                            planId: this.planId,
                            preferences: this.preferences
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        alert('Praeferenzen gespeichert!');
                    } else {
                        alert('Fehler: ' + (result.error || 'Unbekannter Fehler'));
                    }
                } catch (error) {
                    alert('Fehler beim Speichern: ' + error.message);
                }
                this.saving = false;
            }
        };
    }
    </script>
    <?php
}

/**
 * Render weekly preference grid
 *
 * @param array $weeks Weeks in the plan
 * @param array $preferences Existing preferences [week_id => level]
 * @param string $planId Plan ID for saving
 * @param bool $readonly If true, grid is not editable
 */
function renderWeeklyPreferenceGrid(array $weeks, array $preferences, string $planId, bool $readonly = false): void {
    ?>
    <div x-data="weeklyPreferenceGrid(<?= h(json_encode($preferences)) ?>, '<?= h($planId) ?>')" class="preference-grid">
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Woche</th>
                        <th>Zeitraum</th>
                        <th style="width: 120px;">Praeferenz</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($weeks as $week):
                        $pref = $preferences[$week['id']] ?? 2;
                    ?>
                    <tr>
                        <td>KW <?= getCalendarWeek($week['start_date']) ?></td>
                        <td><?= formatWeekRange($week['start_date'], $week['end_date']) ?></td>
                        <td>
                            <?php if ($readonly): ?>
                                <div class="pref-cell <?= prefClass($pref) ?>">
                                    <?= prefShortLabel($pref) ?>
                                </div>
                            <?php else: ?>
                                <div class="pref-cell"
                                     :class="getPrefClass('<?= $week['id'] ?>')"
                                     @click="cyclePreference('<?= $week['id'] ?>')">
                                    <span x-text="getPrefLabel('<?= $week['id'] ?>')"></span>
                                </div>
                            <?php endif; ?>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>

        <?php if (!$readonly): ?>
        <div class="flex flex-between flex-center mt-lg">
            <div class="flex gap-md">
                <span class="pref-cell pref-preferred" style="display: inline-block;">Ja! = Bevorzugt</span>
                <span class="pref-cell pref-available" style="display: inline-block;">OK = Verfuegbar</span>
                <span class="pref-cell pref-unavailable" style="display: inline-block;">Nein = Nicht verfuegbar</span>
            </div>
            <button @click="savePreferences()" class="btn btn-primary" :disabled="saving">
                <span x-show="!saving">Speichern</span>
                <span x-show="saving" class="spinner"></span>
            </button>
        </div>
        <?php endif; ?>
    </div>

    <script>
    function weeklyPreferenceGrid(initialPrefs, planId) {
        return {
            preferences: initialPrefs || {},
            planId: planId,
            saving: false,

            cyclePreference(weekId) {
                const current = this.preferences[weekId] || 2;
                const next = current === 1 ? 2 : (current === 2 ? 3 : 1);
                this.preferences[weekId] = next;
            },

            getPrefClass(weekId) {
                const level = this.preferences[weekId] || 2;
                return {
                    'pref-preferred': level === 1,
                    'pref-available': level === 2,
                    'pref-unavailable': level === 3
                };
            },

            getPrefLabel(weekId) {
                const labels = {1: 'Ja!', 2: 'OK', 3: 'Nein'};
                return labels[this.preferences[weekId] || 2];
            },

            async savePreferences() {
                this.saving = true;
                try {
                    const response = await fetch('/api/preferences', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
                        },
                        body: JSON.stringify({
                            type: 'weekly',
                            planId: this.planId,
                            preferences: this.preferences
                        })
                    });

                    const result = await response.json();
                    if (result.success) {
                        alert('Praeferenzen gespeichert!');
                    } else {
                        alert('Fehler: ' + (result.error || 'Unbekannter Fehler'));
                    }
                } catch (error) {
                    alert('Fehler beim Speichern: ' + error.message);
                }
                this.saving = false;
            }
        };
    }
    </script>
    <?php
}
