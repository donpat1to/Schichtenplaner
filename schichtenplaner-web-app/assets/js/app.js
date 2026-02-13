/**
 * Schichtenplaner Web App - Custom JavaScript
 */

// Get CSRF token from meta tag
function getCsrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
}

// AJAX helper with CSRF support
async function ajax(url, options = {}) {
    const defaults = {
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': getCsrfToken()
        }
    };

    const config = { ...defaults, ...options };
    if (options.headers) {
        config.headers = { ...defaults.headers, ...options.headers };
    }

    const response = await fetch(url, config);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

// POST helper
function postJson(url, data) {
    return ajax(url, {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

// Auto-dismiss flash messages
document.addEventListener('DOMContentLoaded', function() {
    const flashes = document.querySelectorAll('.alert');
    flashes.forEach(function(flash) {
        // Auto-dismiss success messages after 5 seconds
        if (flash.classList.contains('alert-success')) {
            setTimeout(function() {
                flash.style.transition = 'opacity 0.3s ease';
                flash.style.opacity = '0';
                setTimeout(function() {
                    flash.remove();
                }, 300);
            }, 5000);
        }

        // Add click to dismiss
        flash.style.cursor = 'pointer';
        flash.addEventListener('click', function() {
            flash.remove();
        });
    });
});

// Confirmation dialog
function confirmAction(message) {
    return confirm(message || 'Sind Sie sicher?');
}

// Delete confirmation
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-confirm]').forEach(function(el) {
        el.addEventListener('click', function(e) {
            if (!confirm(el.dataset.confirm)) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });
});

// Modal component for Alpine.js
document.addEventListener('alpine:init', function() {
    Alpine.data('modal', function() {
        return {
            open: false,
            show() {
                this.open = true;
                document.body.style.overflow = 'hidden';
            },
            close() {
                this.open = false;
                document.body.style.overflow = '';
            },
            toggle() {
                this.open ? this.close() : this.show();
            }
        };
    });

    // Dropdown component
    Alpine.data('dropdown', function() {
        return {
            open: false,
            toggle() {
                this.open = !this.open;
            },
            close() {
                this.open = false;
            }
        };
    });

    // Tabs component
    Alpine.data('tabs', function(defaultTab) {
        return {
            activeTab: defaultTab || '',
            setTab(tab) {
                this.activeTab = tab;
            },
            isActive(tab) {
                return this.activeTab === tab;
            }
        };
    });

    // Preference grid component
    Alpine.data('preferenceGrid', function(config) {
        return {
            preferences: config.preferences || {},
            saving: false,
            saveUrl: config.saveUrl || '/api/preferences',
            entityType: config.entityType || 'shift',

            init() {
                // Initialize from existing data if provided
            },

            getPreference(entityId) {
                return this.preferences[entityId] || 2;
            },

            setPreference(entityId, level) {
                this.preferences[entityId] = level;
                this.save(entityId, level);
            },

            async save(entityId, level) {
                this.saving = true;
                try {
                    const data = {
                        entityId: entityId,
                        preferenceLevel: level
                    };

                    if (this.entityType === 'shift') {
                        data.shiftId = entityId;
                    } else {
                        data.weekId = entityId;
                    }

                    await postJson(this.saveUrl, data);
                } catch (error) {
                    console.error('Failed to save preference:', error);
                    alert('Fehler beim Speichern der Praeferenz.');
                } finally {
                    this.saving = false;
                }
            },

            prefClass(entityId, level) {
                const current = this.getPreference(entityId);
                let classes = ['pref-btn'];
                if (current === level) {
                    classes.push('active');
                }
                if (level === 1) classes.push('pref-preferred');
                if (level === 2) classes.push('pref-available');
                if (level === 3) classes.push('pref-unavailable');
                return classes.join(' ');
            }
        };
    });

    // Assignment grid component
    Alpine.data('assignmentGrid', function(config) {
        return {
            assignments: config.assignments || {},
            employees: config.employees || [],
            entities: config.entities || [],
            saving: false,
            saveUrl: config.saveUrl || '/api/assignments',

            isAssigned(employeeId, entityId) {
                const key = `${employeeId}_${entityId}`;
                return this.assignments[key] || false;
            },

            async toggleAssignment(employeeId, entityId) {
                const key = `${employeeId}_${entityId}`;
                const newValue = !this.assignments[key];
                this.assignments[key] = newValue;

                this.saving = true;
                try {
                    await postJson(this.saveUrl, {
                        employeeId: employeeId,
                        entityId: entityId,
                        assigned: newValue
                    });
                } catch (error) {
                    console.error('Failed to save assignment:', error);
                    // Revert on error
                    this.assignments[key] = !newValue;
                    alert('Fehler beim Speichern der Zuweisung.');
                } finally {
                    this.saving = false;
                }
            }
        };
    });

    // Collapsible section component
    Alpine.data('collapsible', function(defaultOpen = false) {
        return {
            open: defaultOpen,
            toggle() {
                this.open = !this.open;
            }
        };
    });
});

// Table sorting (simple click-to-sort)
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('table[data-sortable]').forEach(function(table) {
        const headers = table.querySelectorAll('th[data-sort]');
        headers.forEach(function(header, index) {
            header.style.cursor = 'pointer';
            header.addEventListener('click', function() {
                sortTable(table, index, header.dataset.sort);
            });
        });
    });
});

function sortTable(table, columnIndex, type) {
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    const direction = table.dataset.sortDir === 'asc' ? 'desc' : 'asc';
    table.dataset.sortDir = direction;

    rows.sort(function(a, b) {
        const aCell = a.cells[columnIndex];
        const bCell = b.cells[columnIndex];

        let aVal = aCell.textContent.trim();
        let bVal = bCell.textContent.trim();

        if (type === 'number') {
            aVal = parseFloat(aVal) || 0;
            bVal = parseFloat(bVal) || 0;
        } else if (type === 'date') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
        }

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    rows.forEach(function(row) {
        tbody.appendChild(row);
    });
}

// Form validation helper
function validateForm(form) {
    const inputs = form.querySelectorAll('[required]');
    let valid = true;

    inputs.forEach(function(input) {
        if (!input.value.trim()) {
            input.classList.add('error');
            valid = false;
        } else {
            input.classList.remove('error');
        }
    });

    return valid;
}

// Date formatting helper
function formatDate(date) {
    if (typeof date === 'string') {
        date = new Date(date);
    }
    return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Time formatting helper
function formatTime(time) {
    if (!time) return '';
    return time.substring(0, 5);
}

// Print function
function printPage() {
    window.print();
}

// Export to PDF (trigger browser print dialog)
function exportToPdf() {
    window.print();
}

// Loading overlay
function showLoading(message) {
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">${message || 'Laden...'}</div>
        </div>
    `;
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Solver integration
async function runSolver(planId, type) {
    showLoading('Solver wird ausgefuehrt...');

    try {
        const result = await postJson(`/api/solver/${type}`, {
            planId: planId
        });

        hideLoading();

        if (result.success) {
            alert('Solver erfolgreich ausgefuehrt!');
            location.reload();
        } else {
            alert('Solver-Fehler: ' + (result.violations?.join(', ') || 'Unbekannter Fehler'));
        }
    } catch (error) {
        hideLoading();
        console.error('Solver error:', error);
        alert('Fehler beim Ausfuehren des Solvers.');
    }
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Escape closes modals
    if (e.key === 'Escape') {
        const openModals = document.querySelectorAll('[x-data*="modal"]');
        openModals.forEach(function(modal) {
            if (modal.__x && modal.__x.$data.open) {
                modal.__x.$data.close();
            }
        });
    }

    // Ctrl+S prevents default and could trigger save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        const saveBtn = document.querySelector('[data-save-shortcut]');
        if (saveBtn) {
            saveBtn.click();
        }
    }
});

// Initialize tooltips (simple title-based)
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-tooltip]').forEach(function(el) {
        el.title = el.dataset.tooltip;
    });
});

// Console log for debugging
console.log('Schichtenplaner App initialized');
