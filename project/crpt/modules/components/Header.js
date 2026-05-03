export const HeaderComponent = () => `
    <header>
        <div class="header-top">
            <h1>Шифратор</h1>
            <button id="theme-toggle" class="theme-btn" title="Переключить тему">
                <svg class="icon"><use href="#icon-moon"></use></svg>
            </button>
        </div>
        <div class="tabs">
            <button class="tab-btn active" data-tab="encode-tab">
                <svg class="icon"><use href="#icon-lock"></use></svg> Зашифровать
            </button>
            <button class="tab-btn" data-tab="decode-tab">
                <svg class="icon"><use href="#icon-unlock"></use></svg> Расшифровать
            </button>
        </div>
    </header>
`;