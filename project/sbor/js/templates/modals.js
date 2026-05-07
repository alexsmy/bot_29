export const modalsTemplate = `
    <div class="modal-overlay" id="modal-overlay"></div>

    <div class="modal" id="modal-exclusions">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 1: Исключенные файлы</h2>
                <div class="step-indicator">Проверьте, что мы не потеряли важное</div>
            </div>
            <input type="text" id="search-exc" class="search-box" placeholder="Поиск файлов...">
        </div>
        <div class="modal-body">
            <div class="info-box">
                Ниже список файлов, которые <strong>НЕ будут включены</strong> в сборку (системные файлы, .gitignore, тяжелые файлы).<br>
                Поставьте галочку, если хотите <strong>вернуть</strong> файл в сборку.
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
            <input type="text" id="search-fin" class="search-box" placeholder="Поиск целей...">
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
                        <button class="btn btn-secondary" id="btn-reset-smart">Сбросить</button>
                        <button class="btn btn-primary" id="btn-apply-smart">Применить умный фильтр</button>
                    </div>
                </div>
                <div id="smart-seed-hint" style="margin-top:0.85rem;"></div>
            </div>

            <div class="smart-picker-grid">
                <div class="smart-picker-col">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border); padding-bottom: 0.4rem; margin-bottom: 0.75rem;">
                        <h3 style="margin:0; border:none; padding:0;">Файлы-цели</h3>
                        <label style="font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:0.4rem; color: var(--text-muted);">
                            <input type="checkbox" id="cb-select-all-files" style="accent-color: var(--primary); cursor:pointer;"> Выбрать все
                        </label>
                    </div>
                    <div class="smart-picker-list" id="smart-seed-files-list"></div>
                </div>
                <div class="smart-picker-col">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid var(--border); padding-bottom: 0.4rem; margin-bottom: 0.75rem;">
                        <h3 style="margin:0; border:none; padding:0;">Папки-цели</h3>
                        <label style="font-size:0.85rem; cursor:pointer; display:flex; align-items:center; gap:0.4rem; color: var(--text-muted);">
                            <input type="checkbox" id="cb-select-all-folders" style="accent-color: var(--primary); cursor:pointer;"> Выбрать все
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
                <button class="btn btn-secondary" id="btn-back-final">&larr; Назад</button>
                <span style="font-size:0.9rem; color:var(--text-muted);">Выберите цели выше и примените фильтр.</span>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-review">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 3: Коррекция сборки</h2>
                <div class="step-indicator">Проверьте и подправьте итоговый набор файлов</div>
            </div>
            <input type="text" id="search-review" class="search-box" placeholder="Поиск в итоговом наборе...">
        </div>
        <div class="modal-body">
            <div class="info-box">
                Это уже <strong>готовый кандидатный набор</strong> после анализа зависимостей. Здесь можно вручную добавить или убрать любой файл перед финализацией.
            </div>
            <div id="review-summary" class="smart-summary"></div>
            <div class="file-list-container" id="list-review"></div>
        </div>
        <div class="modal-footer">
            <div class="footer-right" style="width:100%; justify-content: space-between; align-items:center;">
                <button class="btn btn-secondary" id="btn-back-review">&larr; Назад к фильтру</button>
                <button class="btn btn-primary" id="btn-prepare-gen">Далее: Финализация &rarr;</button>
            </div>
        </div>
    </div>

    <div class="modal" id="modal-secrets">
        <div class="modal-header">
            <div class="modal-header-content">
                <h2>Шаг 4: Финализация</h2>
                <div class="step-indicator">Проверка реальных секретов и подготовка итоговой сборки</div>
            </div>
        </div>
        <div class="modal-body">
            <h3 style="margin:0 0 1rem 0; color: var(--text); border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;">Анализ секретов</h3>
            <div class="info-box warning">
                Алгоритм показывает только реальные или почти реальные секреты: ключи с известными префиксами, длинные токены, JWT, private key блоки и похожие сигналы.
                Строки-плейсхолдеры или обычные имена, вроде <code>tokenKey: 'pvz_auth_token'</code>, не должны попадать в список.
                Для каждого файла можно отдельно решить: оставить его в сборке с маскированием или исключить целиком.
            </div>

            <div id="secret-scan-summary" class="smart-summary"></div>

            <div class="settings-extra" style="margin-top: 1rem;">
                <h3>🧠 Пакет для анализа</h3>
                <div class="rule-list" id="secrets-analysis-package-list"></div>
            </div>

            <div class="file-list-container" id="list-secrets" style="margin-top: 1rem;"></div>
        </div>
        <div class="modal-footer">
            <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <button class="btn btn-secondary" id="btn-back-secrets">&larr; Назад</button>

                <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="cb-repo-map" checked style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;">
                        <label for="cb-repo-map" style="font-size: 0.9rem; cursor: pointer; color: var(--text); font-weight: 500;">Добавить Repo Map</label>
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <input type="checkbox" id="cb-optimize" style="width: 18px; height: 18px; accent-color: var(--primary); cursor: pointer;">
                        <label for="cb-optimize" style="font-size: 0.9rem; cursor: pointer; color: var(--text); font-weight: 500;">Оптимизировать код (сжать)</label>
                    </div>

                    <select id="export-format-select" class="ai-select">
                        <option value="markdown">Формат: Markdown (.txt)</option>
                        <option value="xml">Формат: XML (.xml)</option>
                    </select>

                    <select id="ai-model-select" class="ai-select"></select>
                    <button class="btn btn-success" id="btn-execute-gen">Сгенерировать сборку</button>
                </div>
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
