

export const layoutTemplate = `
    <div class="container">
        <h1>Подготовка кода для ИИ</h1>
        <p>Выберите папку. Инструмент создаст карту проекта, применит <strong>.gitignore</strong>, позволит управлять исключениями, надежно скроет секретные ключи и сохранит всё в один файл.</p>

        <label for="folder-input" class="file-input-label">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span>Открыть папку проекта</span>
        </label>
        <input type="file" id="folder-input" webkitdirectory directory multiple>

        <div class="loader" id="loader"></div>
        <div id="status-area"></div>

        <button id="final-download-btn" class="btn btn-success" style="display:none; width:100%; margin-top:2rem; padding: 16px; justify-content: center;">
            Скачать готовый файл
        </button>
    </div>
`;

    