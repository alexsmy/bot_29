export const KeyGenModalComponent = () => `
    <!-- Модальное окно генератора ключей -->
    <div id="key-gen-modal" class="modal-overlay">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Генератор энтропии</h3>
                <button id="gen-reset-btn" class="icon-btn-ghost" title="Сбросить">
                    <svg class="icon"><use href="#icon-trash"></use></svg>
                </button>
            </div>
            
            <div class="modal-body">
                <div class="gen-display-wrapper">
                    <input type="text" id="gen-key-display" readonly placeholder="...." class="strength-default">
                    <div class="gen-status-badge" id="gen-status-text">ОЖИДАНИЕ</div>
                </div>
                
                <div class="matrix-container">
                    <canvas id="matrix-canvas" width="300" height="300"></canvas>
                    <div class="matrix-overlay-hint">
                        <svg class="icon move-icon"><use href="#icon-generate-x"></use></svg>
                        <span>Водите пальцем для сбора случайности</span>
                    </div>
                </div>
            </div>

            <div class="modal-footer">
                <button id="gen-cancel-btn" class="modal-btn btn-cancel">Отмена</button>
                <button id="gen-confirm-btn" class="modal-btn btn-confirm" disabled>
                    <svg class="icon"><use href="#icon-check"></use></svg> Применить
                </button>
            </div>
        </div>
    </div>
`;