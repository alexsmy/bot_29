const PIN_LENGTH_PATTERN = /^\d{4,6}$/;

function formatWaitMessage(seconds) {
    if (!seconds || seconds <= 0) {
        return '';
    }
    return `Повторная попытка будет доступна через ${seconds} сек.`;
}

export class KeepAlivePinModal {
    constructor(options = {}) {
        this.modal = document.getElementById('pin-modal');
        this.form = document.getElementById('pin-form');
        this.input = document.getElementById('pin-input');
        this.messageEl = document.getElementById('pin-message');
        this.submitButton = document.getElementById('pin-submit-btn');
        this.cancelButton = document.getElementById('pin-cancel-btn');
        this.closeButton = document.getElementById('pin-close-btn');
        this.onSubmit = options.onSubmit || (async () => {});
        this.onCancel = options.onCancel || (() => {});
        this.countdownTimer = null;
        this.remainingSeconds = 0;

        this._bindEvents();
    }

    _bindEvents() {
        if (this.form) {
            this.form.addEventListener('submit', async (event) => {
                event.preventDefault();
                await this._handleSubmit();
            });
        }

        [this.cancelButton, this.closeButton].filter(Boolean).forEach((button) => {
            button.addEventListener('click', () => {
                this.close();
                this.onCancel();
            });
        });

        if (this.modal) {
            this.modal.addEventListener('click', (event) => {
                if (event.target === this.modal) {
                    this.close();
                    this.onCancel();
                }
            });
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.isOpen()) {
                this.close();
                this.onCancel();
            }
        });

        if (this.input) {
            this.input.addEventListener('input', () => {
                this.input.value = this.input.value.replace(/\D/g, '').slice(0, 6);
            });
        }
    }

    async _handleSubmit() {
        const pin = this.input?.value?.trim() || '';
        if (!PIN_LENGTH_PATTERN.test(pin)) {
            this.setMessage('Введите пин-код: от 4 до 6 цифр.', 'error');
            return;
        }

        this.setLoading(true);
        this.setMessage('Проверка пин-кода...', 'info');
        try {
            await this.onSubmit(pin);
            this.setMessage('Доступ разрешён. Открываем настройки...', 'success');
            this.close();
        } catch (error) {
            const retryAfter = Number(error.retryAfter || 0);
            this.setMessage(error.message || 'Неверный пин-код.', 'error');
            if (retryAfter > 0) {
                this.startCooldown(retryAfter);
            }
        } finally {
            this.setLoading(false);
        }
    }

    isOpen() {
        return Boolean(this.modal && !this.modal.classList.contains('is-hidden'));
    }

    open(status = {}) {
        this.clearCountdown();
        if (this.input) {
            this.input.value = '';
        }
        this.setLoading(false);
        this.setMessage('Введите пин-код для доступа к настройкам.', 'info');

        if (this.modal) {
            this.modal.classList.remove('is-hidden');
            this.modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
        }

        const retryAfter = Number(status.retry_after_seconds || 0);
        if (retryAfter > 0) {
            this.startCooldown(retryAfter);
        } else if (this.input) {
            window.setTimeout(() => this.input.focus(), 50);
        }
    }

    close() {
        this.clearCountdown();
        if (this.modal) {
            this.modal.classList.add('is-hidden');
            this.modal.setAttribute('aria-hidden', 'true');
            document.body.classList.remove('modal-open');
        }
    }

    setLoading(isLoading) {
        if (this.submitButton) {
            this.submitButton.disabled = Boolean(isLoading) || this.remainingSeconds > 0;
        }
        if (this.input) {
            this.input.disabled = Boolean(isLoading) || this.remainingSeconds > 0;
        }
    }

    setMessage(text, tone = 'info') {
        if (!this.messageEl) return;
        this.messageEl.textContent = text;
        this.messageEl.dataset.tone = tone;
    }

    startCooldown(seconds) {
        this.clearCountdown();
        this.remainingSeconds = Math.max(1, Number(seconds) || 1);
        this._renderCooldown();
        this.countdownTimer = window.setInterval(() => {
            this.remainingSeconds -= 1;
            this._renderCooldown();
            if (this.remainingSeconds <= 0) {
                this.clearCountdown();
                this.setMessage('Можно повторить ввод пин-кода.', 'info');
                if (this.input) {
                    this.input.disabled = false;
                    this.input.value = '';
                    this.input.focus();
                }
                if (this.submitButton) {
                    this.submitButton.disabled = false;
                }
            }
        }, 1000);
    }

    _renderCooldown() {
        this.setMessage(formatWaitMessage(this.remainingSeconds), 'error');
        if (this.input) {
            this.input.disabled = true;
        }
        if (this.submitButton) {
            this.submitButton.disabled = true;
        }
    }

    clearCountdown() {
        if (this.countdownTimer) {
            window.clearInterval(this.countdownTimer);
            this.countdownTimer = null;
        }
        this.remainingSeconds = 0;
    }
}
