function escapeHTML(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function createProjectVariantCardHTML(variant, index = 0) {
    const animationDelay = (index * 0.08 + 0.05).toFixed(2);
    const theme = variant.theme || {
        hoverShadow: 'hover:shadow-blue-500/20',
        hoverBorder: 'hover:border-blue-400/40',
        hoverText: 'group-hover:text-blue-300',
        bgIcon: 'bg-blue-500/10',
        textIcon: 'text-blue-300',
        textAction: 'text-blue-300'
    };

    return `
        <a href="${escapeHTML(variant.url)}"
           id="project-variant-${escapeHTML(variant.id || index)}"
           class="group block bg-slate-800/50 backdrop-blur-md border border-slate-700/50 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${theme.hoverShadow} ${theme.hoverBorder} hover:bg-slate-800/70"
           style="animation-delay: ${animationDelay}s;">
            <div class="flex items-start gap-4">
                <div class="flex-shrink-0 w-12 h-12 rounded-xl ${theme.bgIcon} flex items-center justify-center ${theme.textIcon} group-hover:scale-110 transition-transform duration-300">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        ${variant.iconSvg || ''}
                    </svg>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-3 mb-2">
                        <h3 class="text-lg font-bold text-white ${theme.hoverText} transition-colors truncate">${escapeHTML(variant.title)}</h3>
                        ${variant.badge ? `<span class="shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-700/70 text-slate-200">${escapeHTML(variant.badge)}</span>` : ''}
                    </div>
                    <p class="text-slate-400 text-sm leading-relaxed mb-4 font-medium">${escapeHTML(variant.description || '')}</p>
                    <span class="inline-flex items-center text-sm font-bold ${theme.textAction}">
                        ${escapeHTML(variant.actionText || 'Открыть')}
                        <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </span>
                </div>
            </div>
        </a>
    `;
}

export function renderProjectSelectorModal() {
    return `
        <div id="project-selector-modal" class="fixed inset-0 z-50 hidden items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="project-selector-title" aria-hidden="true">
            <div class="w-full max-w-3xl bg-slate-900/95 border border-slate-700/60 rounded-3xl shadow-2xl overflow-hidden">
                <div class="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-slate-700/60">
                    <div class="min-w-0">
                        <p class="text-xs font-bold uppercase tracking-[0.25em] text-blue-300/80 mb-2">Выбор версии</p>
                        <h2 id="project-selector-title" class="text-2xl sm:text-3xl font-extrabold text-white leading-tight">Radio</h2>
                        <p id="project-selector-description" class="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">Выберите приложение для открытия радио-потоков.</p>
                    </div>
                    <button id="project-selector-close" type="button" class="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors" aria-label="Закрыть выбор версии">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div class="p-5 sm:p-6">
                    <div class="flex items-center justify-between gap-3 mb-4">
                        <p class="text-sm text-slate-400">Карточки ниже открывают отдельные версии радио-приложения.</p>
                        <button id="project-selector-back" type="button" class="text-sm font-semibold text-blue-300 hover:text-blue-200 transition-colors">Вернуться</button>
                    </div>
                    <div id="project-selector-list" class="grid grid-cols-1 md:grid-cols-2 gap-4"></div>
                </div>
            </div>
        </div>
    `;
}
