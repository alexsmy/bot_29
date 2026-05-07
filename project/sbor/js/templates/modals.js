export const modalsTemplate = `
    <div class="modal-overlay" id="modal-overlay"></div>

    <div class="modal" id="modal-exclusions" role="dialog" aria-modal="true" aria-labelledby="exclusions-title">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2 id="exclusions-title">Шаг 1: Исключенные файлы</h2>
                <div class="step-indicator">Проверьте, что мы не потеряли важное</div>
            </div>
            <input type="text" id="search-exc" class="search-box" placeholder="Поиск файлов..." autocomplete="off">
        </div>
        <div class="modal-body">
            <div class="info-box">
                Ниже список файлов, которые <strong>НЕ будут включены</strong> в сборку (системные файлы, .gitignore, тяжёлые файлы).
                Поставьте галочку, если хотите <strong>вернуть</strong> файл в сборку.
            </div>
            <div class="file-list-container" id="list-exclusions"></div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-settings-exc" type="button">⚙️ Настройки</button>
            <div class="footer-right">
                <button class="btn btn-secondary" id="btn-cancel-exc" type="button">Отмена</button>
                <button class="btn btn-primary" id="btn-next-exc" type="button">Далее: Умный фильтр →</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-final" role="dialog" aria-modal="true" aria-labelledby="smart-title">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2 id="smart-title">Шаг 2: Умный фильтр</h2>
                <div class="step-indicator">Выберите файлы или папки-цели</div>
            </div>
            <input type="text" id="search-fin" class="search-box" placeholder="Поиск целей..." autocomplete="off">
        </div>
        <div class="modal-body">
            <div class="info-box">
                Отметьте один или несколько <strong>исходных файлов</strong> или <strong>папок</strong>, выберите профиль задачи и примените умную выборку.
                После этого откроется отдельный шаг ручной коррекции итогового набора.
            </div>

            <div class="smart-filter-panel">
                <div class="smart-filter-grid">
                    <div class="smart-filter-field">
                        <label for="smart-profile-select">Профиль задачи</label>
                        <select id="smart-profile-select" class="ai-select"></select>
                    </div>

                    <div class="smart-toggle">
                        <input type="checkbox" id="cb-smart-deps" checked>
                        <label for="cb-smart-deps">Автодобавлять зависимости</label>
                    </div>

                    <div class="smart-toggle">
                        <input type="checkbox" id="cb-smart-folders" checked>
                        <label for="cb-smart-folders">Расширять по папке</label>
                    </div>

                    <div class="smart-actions">
                        <button class="btn btn-secondary" id="btn-reset-smart" type="button">Сбросить</button>
                        <button class="btn btn-primary" id="btn-apply-smart" type="button">Применить умный фильтр</button>
                    </div>
                </div>
                <div id="smart-seed-hint" style="margin-top:0.85rem;"></div>
            </div>

            <div class="smart-picker-grid">
                <div class="smart-picker-col">
                    <div class="picker-header">
                        <h3>Файлы-цели</h3>
                        <label class="mini-check">
                            <input type="checkbox" id="cb-select-all-files"> Выбрать все
                        </label>
                    </div>
                    <div class="smart-picker-list" id="smart-seed-files-list"></div>
                </div>
                <div class="smart-picker-col">
                    <div class="picker-header">
                        <h3>Папки-цели</h3>
                        <label class="mini-check">
                            <input type="checkbox" id="cb-select-all-folders"> Выбрать все
                        </label>
                    </div>
                    <div class="smart-picker-list" id="smart-seed-folders-list"></div>
                </div>
            </div>

            <div id="smart-filter-summary" class="smart-summary"></div>
        </div>
        <div class="modal-footer">
            <div class="footer-right" style="width:100%; justify-content: space-between; align-items:center;">
                <button class="btn btn-secondary" id="btn-settings-final" type="button">⚙️ Настройки</button>
                <div class="footer-right">
                    <button class="btn btn-secondary" id="btn-back-final" type="button">← Назад</button>
                    <button class="btn btn-primary" id="btn-prepare-gen" type="button">Далее: Финализация →</button>
                </div>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-review" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2 id="review-title">Шаг 3: Ручная коррекция</h2>
                <div class="step-indicator">Проверьте финальный состав сборки</div>
            </div>
            <input type="text" id="search-review" class="search-box" placeholder="Поиск по итогам..." autocomplete="off">
        </div>
        <div class="modal-body">
            <div id="review-summary" class="smart-summary"></div>
            <div class="file-list-container" id="list-review"></div>
        </div>
        <div class="modal-footer">
            <div class="footer-right" style="width:100%; justify-content: space-between; align-items:center;">
                <button class="btn btn-secondary" id="btn-back-review" type="button">← Назад к фильтру</button>
                <button class="btn btn-primary" id="btn-prepare-gen" type="button">Далее: Финализация →</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-secrets" role="dialog" aria-modal="true" aria-labelledby="secrets-title">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2 id="secrets-title">Шаг 4: Финализация</h2>
                <div class="step-indicator">Анализ секретов и оптимизация</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="info-box">
                Ниже список файлов, которые <strong>НЕ будут включены</strong> в сборку (системные файлы, .gitignore, тяжёлые файлы).
                Поставьте галочку, если хотите <strong>вернуть</strong> файл в сборку.
            </div>

            <div class="settings-extra">
                <h3>🧠 Пакет для анализа</h3>
                <div class="rule-list" id="secrets-analysis-package-list"></div>
            </div>

            <div class="file-list-container" id="list-secrets"></div>
        </div>
        <div class="modal-footer">
            <div class="secret-controls">
                <button class="btn btn-secondary" id="btn-back-secrets" type="button">← Назад</button>

                <label class="mini-check">
                    <input type="checkbox" id="cb-repo-map" checked>
                    <span>Добавить Repo Map</span>
                </label>

                <label class="mini-check">
                    <input type="checkbox" id="cb-optimize">
                    <span>Оптимизировать код (сжать)</span>
                </label>

                <select id="export-format-select" class="ai-select">
                    <option value="markdown">Формат: Markdown (.txt)</option>
                    <option value="xml">Формат: XML (.xml)</option>
                </select>

                <select id="ai-model-select" class="ai-select"></select>
                <button class="btn btn-success" id="btn-execute-gen" type="button">Сгенерировать сборку</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-settings" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2 id="settings-title">Настройки</h2>
                <div class="step-indicator">Тема, лимиты и качество поиска секретов</div>
            </div>
            <button class="btn btn-ghost modal-close" id="btn-close-settings" type="button" aria-label="Закрыть настройки">×</button>
        </div>
        <div class="modal-body">
            <section class="settings-extra">
                <h3>🎨 Внешний вид</h3>
                <div id="settings-appearance-list" class="rule-list"></div>
            </section>

            <section class="settings-extra">
                <h3>⚙️ Общие фильтры</h3>
                <div id="settings-general-list" class="rule-list"></div>
            </section>

            <section class="settings-extra">
                <h3>📏 Лимиты файлов</h3>
                <div id="settings-limits-list" class="rule-list"></div>
            </section>

            <section class="settings-extra">
                <h3>🧩 Хард-правила по расширениям и папкам</h3>
                <div class="settings-grid">
                    <div class="settings-col">
                        <h3>✅ Включены</h3>
                        <div id="settings-included-list"></div>
                    </div>
                    <div class="settings-col">
                        <h3>❌ Исключены</h3>
                        <div id="settings-excluded-list"></div>
                    </div>
                </div>
                <div id="settings-rules-list" class="rule-list"></div>
            </section>

            <section class="settings-extra">
                <h3>🔐 Поиск секретов</h3>
                <div id="settings-secret-list" class="rule-list"></div>
            </section>

            <section class="settings-extra">
                <h3>🧠 Пакет для анализа</h3>
                <div class="rule-list" id="settings-analysis-package-list"></div>
            </section>
        </div>
        <div class="modal-footer">
            <div class="footer-right" style="width:100%; justify-content:flex-end;">
                <button class="btn btn-primary" id="btn-apply-settings" type="button">Применить настройки</button>
            </div>
        </div>
    </div>
`;
