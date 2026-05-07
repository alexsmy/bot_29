export const layoutTemplate = `
    <div class="app-shell">
        <header class="app-topbar">
            <div class="brand">
                <div class="brand-badge">Code Preparer Pro</div>
                <h1>Сборка кода для ИИ</h1>
                <p>Выберите папку проекта, настройте фильтры, проверьте секреты и соберите аккуратный единый файл для анализа.</p>
            </div>
            <div class="top-actions">
                <button class="btn btn-ghost settings-button" id="btn-open-settings" type="button" aria-label="Открыть настройки">
                    <span>⚙️</span>
                    <span>Настройки</span>
                </button>
            </div>
        </header>

        <main class="container">
            <label for="folder-input" class="file-input-label">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                <span>Открыть папку проекта</span>
            </label>
            <input type="file" id="folder-input" webkitdirectory directory multiple>

            <div class="hero-strip">
                <div class="hero-card">
                    <strong>Что делает сборщик</strong>
                    <span>Применяет правила исключения, smart-фильтр, поиск секретов, Repo Map и экспорт в один файл.</span>
                </div>
                <div class="hero-card">
                    <strong>Поддержка экранов</strong>
                    <span>Интерфейс адаптирован для десктопа и мобильных устройств без выхода за границы окна.</span>
                </div>
            </div>

            <div class="loader" id="loader" aria-hidden="true"></div>
            <div id="status-area" role="status" aria-live="polite"></div>

            <button id="final-download-btn" class="btn btn-success download-button" style="display:none;" type="button">
                Скачать готовый файл
            </button>
        </main>
    </div>
`;
