export const modalsTemplate = `
    <div class="modal-overlay" id="modal-overlay"></div>

    <div class="modal" id="modal-exclusions">
        <div class="modal-header modal-header-split">
            <div class="modal-header-content">
                <h2>Шаг 1: Исключённые файлы</h2>
                <div class="step-indicator">Проверьте, что мы не потеряли важное</div>
            </div>
            <input type="text" id="search-exc" class="search-box search-box-compact" placeholder="Поиск файлов...">
        </div>
        <div class="modal-body">
            <div class="step-layout">
                <div class="step-note-panel">
                    Ниже список файлов, которые <strong>НЕ будут включены</strong> в сборку (системные файлы, .gitignore, тяжелые файлы).<br>
                    Поставьте галочку, если хотите <strong>вернуть</strong> файл в сборку.
                </div>
                <div class="step-content-panel">
                    <div class="file-list-container" id="list-exclusions"></div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-settings-exc">⚙️ Настройка фильтров</button>
            <div class="footer-right">
                <button class="btn btn-secondary" id="btn-cancel-exc">Отмена</button>
                <button class="btn btn-primary" id="btn-next-exc">Далее: Умный фильтр →</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-final">
        <div class="modal-header modal-header-split">
            <div class="modal-header-content">
                <h2>Шаг 2: Умный фильтр</h2>
                <div class="step-indicator">Выберите файлы или папки-цели</div>
            </div>
            <input type="text" id="search-fin" class="search-box search-box-compact" placeholder="Поиск целей...">
        </div>
        <div class="modal-body">
            <div class="step-layout">
                <div class="step-note-panel">
                    Отметьте один или несколько исходных файлов или папок, выберите профиль задачи и примените умную выборку. После этого откроется отдельный шаг ручной коррекции итогового набора.
                </div>
                <div class="step-content-panel">
                    <div class="smart-filter-panel">
                        <div class="smart-filter-grid smart-filter-grid-step2">
                            <div class="smart-filter-field smart-profile-stack">
                                <label for="smart-profile-select">Профиль задачи</label>
                                <select id="smart-profile-select" class="ai-select"></select>
                                <div id="smart-seed-hint" class="smart-seed-hint"></div>
                            </div>

                            <div class="smart-toggle smart-toggle-compact">
                                <input type="checkbox" id="cb-smart-deps" checked>
                                <label for="cb-smart-deps">Автодобавлять зависимости</label>
                            </div>

                            <div class="smart-toggle smart-toggle-compact">
                                <input type="checkbox" id="cb-smart-folders" checked>
                                <label for="cb-smart-folders">Расширять по папке</label>
                            </div>
                        </div>
                        <div class="smart-actions" style="margin-top: 0.85rem;">
                            <button class="btn btn-secondary" id="btn-reset-smart">Сбросить</button>
                            <button class="btn btn-primary" id="btn-apply-smart">Применить умный фильтр</button>
                        </div>
                    </div>

                    <div class="smart-picker-grid">
                        <div class="smart-picker-col">
                            <div class="panel-headline">
                                <h3>Файлы-цели</h3>
                                <label class="select-all-toggle">
                                    <input type="checkbox" id="cb-select-all-files"> Выбрать все
                                </label>
                            </div>
                            <div class="smart-picker-list" id="smart-seed-files-list"></div>
                        </div>
                        <div class="smart-picker-col">
                            <div class="panel-headline">
                                <h3>Папки-цели</h3>
                                <label class="select-all-toggle">
                                    <input type="checkbox" id="cb-select-all-folders"> Выбрать все
                                </label>
                            </div>
                            <div class="smart-picker-list" id="smart-seed-folders-list"></div>
                        </div>
                    </div>

                    <div id="smart-filter-summary" class="smart-summary"></div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" id="btn-settings-final">⚙️ Настройка фильтров</button>
            <div class="footer-right">
                <button class="btn btn-secondary" id="btn-back-final">← Назад</button>
                <span class="footer-hint">Выберите цели выше и примените фильтр.</span>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-review">
        <div class="modal-header modal-header-split">
            <div class="modal-header-content">
                <h2>Шаг 3: Коррекция итогового набора</h2>
                <div class="step-indicator">Проверьте и подправьте итоговый набор файлов</div>
            </div>
            <input type="text" id="search-review" class="search-box search-box-compact" placeholder="Поиск в итоговом наборе...">
        </div>
        <div class="modal-body">
            <div class="step-layout">
                <div class="step-note-panel">
                    Это уже готовый кандидатный набор после анализа зависимостей. Здесь можно вручную добавить или убрать любой файл перед финализацией.
                </div>
                <div class="step-content-panel">
                    <div id="review-summary" class="smart-summary"></div>
                    <div class="file-list-container" id="list-review"></div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <div class="footer-right footer-right-wide">
                <button class="btn btn-secondary" id="btn-back-review">← Назад к фильтру</button>
                <button class="btn btn-primary" id="btn-prepare-gen">Далее: Проверка секретов →</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-secrets">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 4: Проверка секретов</h2>
                <div class="step-indicator">Отдельный шаг ручной проверки потенциальных секретов</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="step-layout step-layout-single">
                <div class="step-content-panel">
                    <div id="secret-scan-summary" class="smart-summary"></div>

                    <div class="info-box warning compact-info">
                        Алгоритм показывает только реальные или почти реальные секреты: ключи с известными префиксами, длинные токены, JWT, private key блоки и похожие сигналы.
                        Для каждого файла можно отдельно решить: оставить его в сборке с маскированием или исключить целиком.
                    </div>

                    <div class="file-list-container" id="list-secrets"></div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <div class="footer-right footer-right-wide">
                <button class="btn btn-secondary" id="btn-back-secrets">← Назад</button>
                <button class="btn btn-primary" id="btn-next-secrets">Далее: Финализация →</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-finalization">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 5: Финализация и подготовка итоговой сборки</h2>
                <div class="step-indicator">Настройте пакет анализа, сжатие и формат итогового файла</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="step-layout step-layout-single">
                <div class="step-content-panel">
                    <div class="settings-extra compact-note">
                        <h3>🧠 Пакет для анализа</h3>
                        <div id="secrets-analysis-package-list" class="analysis-package-grid"></div>
                    </div>

                    <div class="final-controls-grid">
                        <div class="final-control-item">
                            <label for="cb-repo-map">Добавить Repo Map</label>
                            <input type="checkbox" id="cb-repo-map" checked>
                        </div>

                        <div class="final-control-item">
                            <label for="cb-optimize">Оптимизировать код (сжать)</label>
                            <input type="checkbox" id="cb-optimize">
                        </div>

                        <div class="final-control-item">
                            <label for="export-format-select">Формат файла</label>
                            <select id="export-format-select" class="ai-select">
                                <option value="txt">TXT (.txt)</option>
                                <option value="xml">XML (.xml)</option>
                            </select>
                        </div>

                        <div class="final-control-item">
                            <label for="ai-model-select">Провайдер</label>
                            <select id="ai-model-select" class="ai-select"></select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <div class="footer-right footer-right-wide">
                <button class="btn btn-secondary" id="btn-back-finalization">← Назад</button>
                <button class="btn btn-success" id="btn-execute-gen">Сгенерировать сборку</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-save">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 6: Сохранение</h2>
                <div class="step-indicator">Готовый файл сформирован и готов к скачиванию</div>
            </div>
        </div>
        <div class="modal-body">
            <div class="step-layout step-layout-single">
                <div class="step-content-panel">
                    <div id="save-summary"></div>

                    <div class="save-columns">
                        <div class="save-column-card">
                            <h3>Умный профиль</h3>
                            <div id="save-smart-profile" class="save-card-body"></div>
                        </div>
                        <div class="save-column-card">
                            <h3>Результат оптимизации</h3>
                            <div id="save-optimization" class="save-card-body"></div>
                        </div>
                        <div class="save-column-card">
                            <h3>Загрузка контекста</h3>
                            <div id="save-context" class="save-card-body"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <div class="footer-right footer-right-save">
                <button class="btn btn-success btn-fit-content" id="final-download-btn">Скачать готовый файл</button>
                <button class="btn btn-secondary btn-fit-content" id="btn-new-build">Собрать новый файл</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-settings">
        <div class="modal-header">
            <h2>Настройка фильтров</h2>
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
