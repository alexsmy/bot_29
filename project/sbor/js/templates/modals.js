export const modalsTemplate = `
    <div class="modal-overlay" id="modal-overlay"></div>

    <div class="modal" id="modal-exclusions">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 1: Исключенные файлы</h2>
                <div class="step-indicator">Проверьте, что мы не потеряли важное</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="step-intro-grid">
                <div class="info-box step-intro-copy">
                    Ниже список файлов, которые <strong>НЕ будут включены</strong> в сборку (системные файлы, <code>.gitignore</code>, тяжелые файлы).<br>
                    Поставьте галочку, если хотите <strong>вернуть</strong> файл в сборку.
                </div>
                <div class="step-intro-search">
                    <label for="search-exc" class="step-search-label">Поиск</label>
                    <input type="text" id="search-exc" class="search-box search-box--compact" placeholder="Поиск файлов...">
                </div>
            </div>
            <div class="file-list-container" id="list-exclusions"></div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-settings-exc">⚙️ Настройка фильтров</button>
            <div class="footer-right">
                <button class="btn btn-secondary" id="btn-cancel-exc">Отмена</button>
                <button class="btn btn-primary" id="btn-next-exc">Далее: Умный фильтр &rarr;</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-final">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 2: Умный фильтр</h2>
                <div class="step-indicator">Выберите файлы или папки-цели</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="step-intro-grid">
                <div class="info-box step-intro-copy">
                    Отметьте один или несколько <strong>исходных файлов</strong> или <strong>папок</strong>, выберите профиль задачи и примените умную выборку.
                    После этого откроется отдельный шаг ручной коррекции итогового набора.
                </div>
                <div class="step-intro-search">
                    <label for="search-fin" class="step-search-label">Поиск</label>
                    <input type="text" id="search-fin" class="search-box search-box--compact" placeholder="Поиск целей...">
                </div>
            </div>

            <div class="smart-filter-panel">
                <div class="smart-filter-grid smart-filter-grid--three">
                    <div class="smart-filter-field">
                        <label for="smart-profile-select">Профиль задачи</label>
                        <select id="smart-profile-select" class="ai-select"></select>
                        <div id="smart-seed-hint" class="rule-meta" style="margin-top:0.45rem;"></div>
                    </div>

                    <label class="smart-toggle">
                        <input type="checkbox" id="cb-smart-deps" checked>
                        <span>Автодобавлять зависимости</span>
                    </label>

                    <label class="smart-toggle">
                        <input type="checkbox" id="cb-smart-folders" checked>
                        <span>Расширять по папке</span>
                    </label>

                    <div class="smart-actions">
                        <button class="btn btn-secondary" id="btn-reset-smart">Сбросить</button>
                        <button class="btn btn-primary" id="btn-apply-smart">Применить умный фильтр</button>
                    </div>
                </div>
            </div>

            <div class="smart-picker-grid">
                <div class="smart-picker-col">
                    <div class="smart-picker-title">
                        <h3>Файлы-цели</h3>
                        <label class="smart-select-all">
                            <input type="checkbox" id="cb-select-all-files"> Выбрать все
                        </label>
                    </div>
                    <div class="smart-picker-list" id="smart-seed-files-list"></div>
                </div>
                <div class="smart-picker-col">
                    <div class="smart-picker-title">
                        <h3>Папки-цели</h3>
                        <label class="smart-select-all">
                            <input type="checkbox" id="cb-select-all-folders"> Выбрать все
                        </label>
                    </div>
                    <div class="smart-picker-list" id="smart-seed-folders-list"></div>
                </div>
            </div>

            <div id="smart-filter-summary" class="smart-summary"></div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-settings-final">⚙️ Настройка фильтров</button>
            <div class="footer-right">
                <button class="btn btn-secondary" id="btn-back-final">&larr; Назад к исключениям</button>
                <span class="footer-hint">Выберите цели выше и примените фильтр.</span>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-review">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 3: Коррекция сборки</h2>
                <div class="step-indicator">Проверьте и подправьте итоговый набор файлов</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="step-intro-grid">
                <div class="info-box step-intro-copy">
                    Это уже <strong>готовый кандидатный набор</strong> после анализа зависимостей.
                    Здесь можно вручную добавить или убрать любой файл перед финализацией.
                </div>
                <div class="step-intro-search">
                    <label for="search-review" class="step-search-label">Поиск</label>
                    <input type="text" id="search-review" class="search-box search-box--compact" placeholder="Поиск в итоговом наборе...">
                </div>
            </div>
            <div id="review-summary" class="smart-summary"></div>
            <div class="file-list-container" id="list-review"></div>
        </div>
        <div class="modal-footer">
            <div class="footer-right footer-right--spaced">
                <button class="btn btn-secondary" id="btn-back-review">&larr; Назад к фильтру</button>
                <button class="btn btn-primary" id="btn-prepare-gen">Далее: Проверка секретов &rarr;</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-secrets">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 4: Проверка секретов</h2>
                <div class="step-indicator">Проверьте находки и решите, что оставить в сборке</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="info-box warning">
                Алгоритм показывает только реальные или почти реальные секреты: ключи с известными префиксами, длинные токены, JWT, private key блоки и похожие сигналы.
                Для каждого файла можно отдельно решить: оставить его в сборке с маскированием или исключить целиком.
            </div>

            <div id="secret-scan-summary" class="smart-summary"></div>
            <div class="file-list-container" id="list-secrets"></div>
        </div>
        <div class="modal-footer">
            <div class="footer-right footer-right--spaced">
                <button class="btn btn-secondary" id="btn-back-secrets">&larr; Назад к коррекции</button>
                <button class="btn btn-primary" id="btn-next-secrets">Далее: Финализация &rarr;</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-finalize">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 5: Финализация и подготовка итоговой сборки</h2>
                <div class="step-indicator">Проверьте пакет для анализа, формат и провайдера перед сохранением</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="info-box">
                🧠 Пакет для анализа, дополнительные флаги и формат итогового файла. После этого шага останется только собрать и скачать готовый файл.
            </div>

            <div class="settings-extra">
                <h3>🧠 Пакет для анализа</h3>
                <div id="final-analysis-package-list" class="rule-list analysis-package-grid"></div>
            </div>

            <div class="final-options-grid">
                <label class="final-option-card">
                    <input type="checkbox" id="cb-repo-map" checked>
                    <span>
                        <strong>Добавить Repo Map</strong>
                        <em>Краткая карта структуры и точек входа</em>
                    </span>
                </label>

                <label class="final-option-card">
                    <input type="checkbox" id="cb-optimize">
                    <span>
                        <strong>Оптимизировать код (сжать)</strong>
                        <em>Убрать комментарии и лишние пустые строки</em>
                    </span>
                </label>

                <div class="final-option-field">
                    <label for="export-format-select">Формат</label>
                    <select id="export-format-select" class="ai-select">
                        <option value="markdown">TXT (.txt)</option>
                        <option value="xml">XML (.xml)</option>
                    </select>
                </div>

                <div class="final-option-field">
                    <label for="ai-model-select">Провайдер</label>
                    <select id="ai-model-select" class="ai-select"></select>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-back-finalize">&larr; Назад</button>
            <button class="btn btn-success" id="btn-execute-gen">Сгенерировать сборку</button>
        </div>
    </div>

    <div class="modal" id="modal-settings">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Настройка фильтров</h2>
                <div class="step-indicator">Общие правила отбора и пакеты анализа</div>
            </div>
            <button class="btn-text" id="btn-close-settings" style="font-size: 1.5rem; line-height: 1;">&times;</button>
        </div>
        <div class="modal-body">
            <div class="settings-extra">
                <h3>⚙️ Общие фильтры</h3>
                <div id="settings-general-list" class="rule-list"></div>
            </div>

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

            <div class="settings-extra">
                <h3>🧩 Хард-правила по расширениям и папкам</h3>
                <div id="settings-rules-list" class="rule-list"></div>
            </div>

            <div class="settings-extra">
                <h3>🧠 Пакет для анализа</h3>
                <div class="rule-list" id="settings-analysis-package-list"></div>
            </div>
        </div>
        <div class="modal-footer" style="justify-content: flex-end;">
            <button class="btn btn-primary" id="btn-apply-settings">Применить настройки</button>
        </div>
    </div>
`;
