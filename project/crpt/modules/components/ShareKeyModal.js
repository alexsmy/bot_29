export const ShareKeyModalComponent = () => `
    <!-- Модальное окно: Поделиться ключом -->
    <div id="share-key-modal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Поделиться ключом</h3>
                <button id="share-close-btn" class="icon-btn-ghost" title="Закрыть">
                    <svg class="icon"><use href="#icon-x-circle"></use></svg>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="qr-key-display-wrapper">
                    <input type="text" id="share-key-display" readonly class="key-input" placeholder="Ключ пуст">
                    <button id="share-copy-btn" class="icon-btn-ghost" title="Скопировать">
                        <svg class="icon"><use href="#icon-copy"></use></svg>
                    </button>
                </div>

                <div class="qr-canvas-container">
                    <!-- Логотип теперь рисуется программно на canvas, HTML-наложение удалено -->

                    <!-- Контейнер для библиотеки qrcodejs -->
                    <div id="qrcode-display"></div>
                    
                    <div id="qr-loading-overlay" class="qr-overlay hidden">
                        <svg class="icon spinner"><use href="#icon-loader"></use></svg>
                    </div>
                </div>

                <div class="pin-protection-box">
                    <label class="checkbox-label">
                        <!-- Галочка активна по умолчанию -->
                        <input type="checkbox" id="use-pin-checkbox" checked>
                        <span class="custom-checkbox"></span>
                        Защитить QR ПИН-кодом
                    </label>
                    
                    <!-- Контейнер виден по умолчанию, так как галочка активна -->
                    <div id="pin-input-container" class="pin-input-container">
                        <p class="pin-hint">Введите 4 цифры для шифрования</p>
                        <!-- Placeholder с точками, но ввод цифр -->
                        <input type="text" id="share-pin-input" class="pin-input" maxlength="4" pattern="\\d{4}" placeholder="••••" inputmode="numeric">
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button id="share-download-btn" class="modal-btn btn-confirm full-width">
                    <svg class="icon"><use href="#icon-download"></use></svg> Сохранить QR-код
                </button>
            </div>
        </div>
    </div>
`;