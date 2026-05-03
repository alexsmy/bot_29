export const CloudModalComponent = () => `
    <!-- Модальное окно: Работа с облаком -->
    <div id="cloud-modal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="cloud-modal-title">Облачное хранилище</h3>
                <button id="cloud-close-btn" class="icon-btn-ghost" title="Закрыть">
                    <svg class="icon"><use href="#icon-x-circle"></use></svg>
                </button>
            </div>
            
            <div class="modal-body">
                <!-- Секция успешного сохранения -->
                <div id="cloud-save-section" class="hidden" style="width: 100%; text-align: center;">
                    <div style="color: var(--success-color); margin-bottom: 10px;">
                        <svg class="icon" style="width: 48px; height: 48px;"><use href="#icon-cloud-check"></use></svg>
                    </div>
                    <p style="margin-bottom: 10px; font-weight: 600;">Файл успешно сохранен!</p>
                    <p class="pin-hint">Ваш уникальный ID для получения файла:</p>
                    
                    <div class="qr-key-display-wrapper" style="margin-top: 10px;">
                        <input type="text" id="cloud-id-display" readonly class="key-input" style="text-align: center; font-size: 1.2rem; letter-spacing: 2px; font-weight: bold; color: var(--primary-color);">
                        <button id="cloud-copy-id-btn" class="icon-btn-ghost" title="Скопировать ID">
                            <svg class="icon"><use href="#icon-copy"></use></svg>
                        </button>
                    </div>
                    <p class="pin-hint" style="margin-top: 10px; color: var(--warning-color);">Сохраните этот ID. Без него восстановить файл невозможно.</p>
                </div>

                <!-- Секция загрузки файла -->
                <div id="cloud-load-section" class="hidden" style="width: 100%;">
                    <p class="pin-hint" style="margin-bottom: 15px;">Введите 8-значный ID файла для загрузки из облака:</p>
                    <input type="text" id="cloud-id-input" class="key-input" placeholder="Например: A7x9K2mP" maxlength="8" style="text-align: center; font-size: 1.2rem; letter-spacing: 2px; font-weight: bold;">
                </div>
            </div>

            <div class="modal-footer" id="cloud-modal-footer">
                <button id="cloud-action-btn" class="modal-btn btn-confirm full-width">
                    <svg class="icon"><use href="#icon-cloud-download"></use></svg> Загрузить
                </button>
            </div>
        </div>
    </div>
`;