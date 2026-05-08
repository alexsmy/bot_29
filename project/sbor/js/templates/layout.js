export const layoutTemplate = `
    <div class="container app-shell">
        <button type="button" class="hub-back-link" id="btn-back-hub">
            <span class="hub-back-icon">←</span>
            <span>Назад в Хаб</span>
        </button>

        <div class="hero-panel">
            <h1>Сборка кода для ИИ</h1>
            <p>Выберите папку проекта. Инструмент построит карту структуры, применит .gitignore, поможет с исключениями, проверит секреты по реальным паттернам и сохранит всё в один файл.</p>
        </div>

        <label for="folder-input" class="file-input-label">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>Открыть папку проекта</span>
        </label>
        <input type="file" id="folder-input" webkitdirectory directory multiple>

        <div class="loader" id="loader"></div>
        <div id="status-area"></div>
    </div>
`;
