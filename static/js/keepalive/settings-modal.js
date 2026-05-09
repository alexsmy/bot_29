import { downloadJsonFile } from './api.js';

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function createTargetRow(target = {}) {
    const row = document.createElement('div');
    row.className = 'target-row';
    row.dataset.targetRow = 'true';
    row.dataset.targetId = target.id || '';

    row.innerHTML = `
        <input type="hidden" data-field="id" value="${escapeHtml(target.id || '')}">
        <div class="field-group field-group--wide">
            <label>Название</label>
            <input type="text" data-field="name" placeholder="Например: PRIMARY" value="${escapeHtml(target.name || '')}">
        </div>
        <div class="field-group field-group--wide">
            <label>URL</label>
            <input type="url" data-field="url" placeholder="https://example.com/ping" value="${escapeHtml(target.url || '')}">
        </div>
        <div class="field-group field-group--wide">
            <label>Переменная окружения</label>
            <input type="text" data-field="env_override" placeholder="WEB_APP_URL" value="${escapeHtml(target.env_override || '')}">
        </div>
        <div class="target-row-actions">
            <label class="compact-switch" aria-label="Активность URL">
                <input type="checkbox" data-field="enabled" ${target.enabled === false ? '' : 'checked'}>
                <span class="compact-switch-track" aria-hidden="true">
                    <span class="compact-switch-thumb"></span>
                </span>
                <span class="compact-switch-text">Активен</span>
            </label>
            <button type="button" class="row-delete-btn" data-action="remove-row" aria-label="Удалить URL">
                <i class="fa-solid fa-trash"></i>
                <span class="row-delete-text">Удалить</span>
            </button>
        </div>
    `;

    return row;
}

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `target-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeConfigForDownload(config) {
    return {
        settings: {
            min_wait_minutes: Number(config.settings.min_wait_minutes),
            max_wait_minutes: Number(config.settings.max_wait_minutes),
            error_wait_seconds: Number(config.settings.error_wait_seconds),
            initial_delay_seconds: Number(config.settings.initial_delay_seconds),
            request_timeout_seconds: Number(config.settings.request_timeout_seconds),
            internet_check_timeout_seconds: Number(config.settings.internet_check_timeout_seconds),
        },
        targets: config.targets.map((target) => ({
            id: target.id,
            name: target.name,
            url: target.url,
            env_override: target.env_override || null,
            enabled: Boolean(target.enabled),
        })),
    };
}

export class KeepAliveSettingsModal {
    constructor(options = {}) {
        this.modal = document.getElementById('settings-modal');
        this.form = document.getElementById('settings-form');
        this.targetList = document.getElementById('settings-target-list');
        this.messageEl = document.getElementById('settings-message');
        this.titleEl = document.getElementById('settings-title');
        this.onApply = options.onApply || (async () => {});
        this.onDownload = options.onDownload || (() => {});
        this.currentConfig = null;

        this._bindStaticEvents();
    }

    _bindStaticEvents() {
        const closeButtons = [
            document.getElementById('settings-close-btn'),
            document.getElementById('settings-cancel-btn'),
        ].filter(Boolean);

        closeButtons.forEach((button) => button.addEventListener('click', () => this.close()));

        const addButton = document.getElementById('settings-add-target-btn');
        if (addButton) {
            addButton.addEventListener('click', () => this.addTargetRow());
        }

        const applyButton = document.getElementById('settings-apply-btn');
        if (applyButton) {
            applyButton.addEventListener('click', async () => {
                try {
                    this.setMessage('Сохранение...', 'info');
                    const config = this.collectFormData(true);
                    const result = await this.onApply(config);
                    this.setMessage(result?.message || 'Настройки применены.', 'success');
                } catch (error) {
                    this.setMessage(error.message || 'Не удалось применить настройки.', 'error');
                }
            });
        }

        const downloadButton = document.getElementById('settings-download-btn');
        if (downloadButton) {
            downloadButton.addEventListener('click', () => {
                const config = this.collectFormData(false);
                const downloadConfig = normalizeConfigForDownload(config);
                downloadJsonFile('keep_alive_settings.json', downloadConfig);
                this.setMessage('JSON-файл подготовлен для скачивания.', 'success');
                this.onDownload(downloadConfig);
            });
        }

        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.close();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen()) {
                this.close();
            }
        });

        if (this.targetList) {
            this.targetList.addEventListener('click', (event) => {
                const removeButton = event.target.closest('[data-action="remove-row"]');
                if (!removeButton) return;

                const row = removeButton.closest('[data-target-row="true"]');
                if (row) {
                    this._handleDeleteRequest(row, removeButton);
                }
            });
        }
    }

    _resetDeleteConfirmation(row, button) {
        if (row.dataset.deleteConfirmTimer) {
            window.clearTimeout(Number(row.dataset.deleteConfirmTimer));
        }

        row.dataset.deleteConfirm = 'false';
        delete row.dataset.deleteConfirmTimer;
        row.classList.remove('target-row--confirm-delete');

        if (button) {
            button.classList.remove('is-confirming');
            button.setAttribute('aria-label', 'Удалить URL');
            const textEl = button.querySelector('.row-delete-text');
            if (textEl) {
                textEl.textContent = 'Удалить';
            }
        }
    }

    _handleDeleteRequest(row, button) {
        if (row.dataset.deleteConfirm === 'true') {
            this._resetDeleteConfirmation(row, button);
            row.remove();
            this.setMessage('URL удалён из списка. Нажмите «Сохранить», чтобы применить изменения.', 'info');
            return;
        }

        row.dataset.deleteConfirm = 'true';
        row.classList.add('target-row--confirm-delete');
        button.classList.add('is-confirming');
        button.setAttribute('aria-label', 'Подтвердить удаление URL');

        const textEl = button.querySelector('.row-delete-text');
        if (textEl) {
            textEl.textContent = 'Подтвердить';
        }

        this.setMessage('Нажмите «Подтвердить» в этой строке, чтобы удалить URL.', 'info');

        const timerId = window.setTimeout(() => {
            this._resetDeleteConfirmation(row, button);
        }, 6000);
        row.dataset.deleteConfirmTimer = String(timerId);
    }

    isOpen() {
        return Boolean(this.modal && !this.modal.classList.contains('is-hidden'));
    }

    setMessage(text, tone = 'info') {
        if (!this.messageEl) return;
        this.messageEl.textContent = text;
        this.messageEl.dataset.tone = tone;
    }

    clearMessage() {
        if (this.messageEl) {
            this.messageEl.textContent = '';
            this.messageEl.dataset.tone = 'info';
        }
    }

    open(config) {
        this.currentConfig = config;
        this.populate(config);
        this.clearMessage();
        if (this.modal) {
            this.modal.classList.remove('is-hidden');
            this.modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        }
    }

    close() {
        Array.from(this.targetList?.querySelectorAll('[data-target-row="true"]') || []).forEach((row) => {
            this._resetDeleteConfirmation(row, row.querySelector('[data-action="remove-row"]'));
        });

        if (this.modal) {
            this.modal.classList.add('is-hidden');
            this.modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        }
    }

    populate(config) {
        if (!config || !this.form) return;

        const settings = config.settings || {};
        const setValue = (selector, value) => {
            const input = this.form.querySelector(selector);
            if (input) input.value = value ?? '';
        };

        setValue('[name="min_wait_minutes"]', settings.min_wait_minutes ?? 13);
        setValue('[name="max_wait_minutes"]', settings.max_wait_minutes ?? 14);
        setValue('[name="error_wait_seconds"]', settings.error_wait_seconds ?? 60);
        setValue('[name="initial_delay_seconds"]', settings.initial_delay_seconds ?? 10);
        setValue('[name="request_timeout_seconds"]', settings.request_timeout_seconds ?? 30);
        setValue('[name="internet_check_timeout_seconds"]', settings.internet_check_timeout_seconds ?? 10);

        if (this.targetList) {
            this.targetList.innerHTML = '';
            const targets = Array.isArray(config.targets) ? config.targets : [];
            if (targets.length === 0) {
                this.targetList.appendChild(createTargetRow({ id: makeId(), enabled: true }));
            } else {
                targets.forEach((target) => this.targetList.appendChild(createTargetRow(target)));
            }
        }
    }

    addTargetRow(target = { id: makeId(), enabled: true }) {
        if (!this.targetList) return;
        this.targetList.appendChild(createTargetRow(target));
    }

    _readNumberField(name, fallback) {
        const input = this.form?.querySelector(`[name="${name}"]`);
        if (!input) return fallback;
        const value = Number.parseInt(String(input.value).trim(), 10);
        return Number.isFinite(value) ? value : fallback;
    }

    _readTargets() {
        const rows = Array.from(this.targetList?.querySelectorAll('[data-target-row="true"]') || []);
        return rows.map((row) => {
            const get = (field) => row.querySelector(`[data-field="${field}"]`);
            return {
                id: get('id')?.value?.trim() || makeId(),
                name: get('name')?.value?.trim() || '',
                url: get('url')?.value?.trim() || '',
                env_override: get('env_override')?.value?.trim() || null,
                enabled: Boolean(get('enabled')?.checked),
            };
        });
    }

    collectFormData(strict = true) {
        const config = {
            settings: {
                min_wait_minutes: this._readNumberField('min_wait_minutes', 13),
                max_wait_minutes: this._readNumberField('max_wait_minutes', 14),
                error_wait_seconds: this._readNumberField('error_wait_seconds', 60),
                initial_delay_seconds: this._readNumberField('initial_delay_seconds', 10),
                request_timeout_seconds: this._readNumberField('request_timeout_seconds', 30),
                internet_check_timeout_seconds: this._readNumberField('internet_check_timeout_seconds', 10),
            },
            targets: this._readTargets(),
        };

        if (!strict) {
            return config;
        }

        const settings = config.settings;
        if (settings.min_wait_minutes < 1 || settings.max_wait_minutes < 1) {
            throw new Error('Время ожидания должно быть больше 0.');
        }
        if (settings.max_wait_minutes < settings.min_wait_minutes) {
            throw new Error('Максимальное время ожидания не может быть меньше минимального.');
        }
        if (settings.error_wait_seconds < 1 || settings.initial_delay_seconds < 0 || settings.request_timeout_seconds < 1 || settings.internet_check_timeout_seconds < 1) {
            throw new Error('Проверьте значения таймеров. Они должны быть положительными.');
        }

        config.targets.forEach((target, index) => {
            if (!target.name) {
                throw new Error(`У строки №${index + 1} не заполнено название.`);
            }
            if (!target.url) {
                throw new Error(`У строки №${index + 1} не заполнен URL.`);
            }
            try {
                const url = new URL(target.url);
                if (!['http:', 'https:'].includes(url.protocol)) {
                    throw new Error('Неверный протокол.');
                }
            } catch (error) {
                throw new Error(`У строки №${index + 1} указан некорректный URL.`);
            }
        });

        return config;
    }
}