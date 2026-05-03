export const ReceiveKeyModalComponent = () => `
    <!-- Модальное окно: Получить ключ -->
    <div id="receive-key-modal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Получить ключ</h3>
                <button id="receive-close-btn" class="icon-btn-ghost" title="Закрыть">
                    <svg class="icon"><use href="#icon-x-circle"></use></svg>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="receive-actions">
                    <button id="receive-paste-btn" class="action-btn secondary-btn flex-grow-btn">
                        <svg class="icon"><use href="#icon-clipboard"></use></svg> Вставить из буфера
                    </button>
                    <label class="action-btn secondary-btn flex-grow-btn file-upload-label">
                        <svg class="icon"><use href="#icon-folder"></use></svg> Из файла
                        <input type="file" id="receive-file-input" accept="image/*" style="display: none;">
                    </label>
                </div>

                <!-- Поле для отображения вставленного текста (появляется при вставке) -->
                <input type="text" id="receive-pasted-display" class="pasted-key-display hidden" readonly>

                <div class="scanner-container">
                    <div id="qr-reader"></div>
                    <div class="scanner-hint">Наведите камеру на QR-код</div>
                </div>

                <!-- Блок ввода ПИН-кода (скрыт по умолчанию) -->
                <div id="receive-pin-section" class="pin-protection-box hidden">
                    <p class="pin-hint warning-text">
                        <svg class="icon"><use href="#icon-lock"></use></svg> QR-код защищен ПИН-кодом
                    </p>
                    <div class="pin-input-row">
                        <input type="text" id="receive-pin-input" class="pin-input" maxlength="4" pattern="\\d{4}" placeholder="••••" inputmode="numeric">
                        <button id="receive-unlock-btn" class="action-btn primary-btn">Открыть</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
`;