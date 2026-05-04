// Модуль компонентов макета: отвечает за статические части интерфейса (фон, шапка)

export function renderBackground() {
    return `
        <div class="fixed inset-0 z-0 pointer-events-none overflow-hidden">
            <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px]"></div>
            <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]"></div>
        </div>
    `;
}

export function renderHeader() {
    return `
        <h1 class="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
            Модульный <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Хаб</span>
        </h1>
        <p class="text-slate-400 text-lg max-w-2xl font-medium">Единая точка доступа ко всем внутренним сервисам и приложениям.</p>
    `;
}