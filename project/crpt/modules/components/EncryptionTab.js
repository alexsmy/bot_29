export const EncryptionTabComponent = () => `
    <!-- Вкладка: Шифрование -->
    <div id="encode-tab" class="tab-content active">
        <div class="input-group">
            <div class="group-header">
                <label>Исходные данные:</label>
                <span class="char-count" id="encode-input-count">0 симв.</span>
            </div>
            <div class="editor-container">
                <div class="toolbar compact-toolbar">
                    <button class="toolbar-btn load-btn gradient-btn-blue" data-target="encode-input" data-file="file-upload-encode" title="Загрузить">
                        <svg class="icon"><use href="#icon-folder"></use></svg> Загрузить
                    </button>
                    <button class="toolbar-btn paste-btn gradient-btn-orange" data-target="encode-input" title="Вставить">
                        <svg class="icon"><use href="#icon-clipboard"></use></svg> Вставить
                    </button>
                    <button class="toolbar-btn clear-btn gradient-btn-red" data-target="encode-input" title="Очистить">
                        <svg class="icon"><use href="#icon-trash"></use></svg> Очистить
                    </button>
                </div>
                <textarea id="encode-input" class="drop-zone" placeholder="Текст или перетащите файл..."></textarea>
                <input type="file" id="file-upload-encode" accept="*/*" style="display: none;">
            </div>
        </div>

        <div class="controls">
            <div class="key-row">
                <div class="group-header">
                    <div class="label-with-action">
                        <label>Ключ:</label>
                        <button id="open-share-modal-btn" class="icon-btn-ghost small-btn" title="Поделиться ключом (QR)">
                            <svg class="icon"><use href="#icon-share"></use></svg> Поделиться
                        </button>
                    </div>
                    <span class="char-count" id="encode-key-status">0/25</span>
                </div>
                <div class="password-wrapper">
                    <input type="password" id="encode-key" class="key-input strength-default" placeholder="Придумайте пароль" minlength="4" maxlength="25">
                    <button class="toggle-password" tabindex="-1" title="Показать/Скрыть">
                        <svg class="icon"><use href="#icon-eye"></use></svg>
                    </button>
                </div>
            </div>
            
            <div class="actions-row">
                <button id="generate-key-btn" class="action-btn square-btn secondary-btn" title="Сгенерировать ключ">
                    <svg class="icon"><use href="#icon-generate-x"></use></svg>
                </button>
                <button id="encode-btn" class="action-btn primary-btn flex-grow-btn">
                    <svg class="icon"><use href="#icon-lock"></use></svg> Зашифровать
                </button>
            </div>
        </div>

        <div class="input-group">
            <div class="group-header">
                <label>Результат:</label>
                <span class="char-count" id="encode-output-count">0 симв.</span>
            </div>
            <div class="editor-container">
                <div class="toolbar compact-toolbar">
                    <button class="toolbar-btn save-btn gradient-btn-blue" data-target="encode-output" title="Сохранить локально">
                        <svg class="icon"><use href="#icon-save"></use></svg> Сохранить
                    </button>
                    <!-- НОВАЯ КНОПКА: Сохранить в облако -->
                    <button id="save-to-cloud-btn" class="toolbar-btn gradient-btn-blue" title="Сохранить в облако" style="background: linear-gradient(to bottom, #f0fdf4, #dcfce7); color: #166534; border-color: rgba(22, 101, 52, 0.1);">
                        <svg class="icon"><use href="#icon-cloud-upload"></use></svg> В облако
                    </button>
                    <button class="toolbar-btn copy-btn gradient-btn-orange" data-target="encode-output" title="Копировать">
                        <svg class="icon"><use href="#icon-copy"></use></svg> Копировать
                    </button>
                    <button class="toolbar-btn clear-btn gradient-btn-red" data-target="encode-output" title="Очистить">
                        <svg class="icon"><use href="#icon-trash"></use></svg> Очистить
                    </button>
                </div>
                <textarea id="encode-output" readonly placeholder="Результат..."></textarea>
            </div>
        </div>
    </div>
`;