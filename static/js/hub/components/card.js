function escapeHTML(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function createCardHTML(project, index) {
    const animationDelay = (index * 0.1 + 0.1).toFixed(1);

    if (project.variants && project.variants.length > 0) {
        return `
            <button type="button"
                id="project-card-${escapeHTML(project.id)}"
                data-selector-id="${escapeHTML(project.id)}"
                aria-haspopup="dialog" aria-controls="project-selector-modal" class="group block w-full text-left bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${project.theme.hoverShadow} ${project.theme.hoverBorder} hover:bg-slate-800/60"
                style="animation-delay: ${animationDelay}s;">
                <div class="flex items-start gap-5">
                    <div class="flex-shrink-0 w-14 h-14 rounded-xl ${project.theme.bgIcon} flex items-center justify-center ${project.theme.textIcon} group-hover:scale-110 transition-transform duration-300">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            ${project.iconSvg}
                        </svg>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center gap-3 mb-2">
                            <h2 class="text-xl font-bold text-white ${project.theme.hoverText} transition-colors">${escapeHTML(project.title)}</h2>
                            <span class="shrink-0 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-700/70 text-slate-200">${project.variants.length} версии</span>
                        </div>
                        <p class="text-slate-400 text-sm leading-relaxed mb-4 font-medium">${escapeHTML(project.description)}</p>
                        <span class="inline-flex items-center text-sm font-bold ${project.theme.textAction}">
                            ${escapeHTML(project.actionText || 'Выбрать версию')}
                            <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                        </span>
                    </div>
                </div>
            </button>
        `;
    }

    return `
        <a href="${escapeHTML(project.url)}"
           id="project-card-${escapeHTML(project.id)}"
           data-id="${escapeHTML(project.id)}"
           class="group block bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${project.theme.hoverShadow} ${project.theme.hoverBorder} hover:bg-slate-800/60"
           style="animation-delay: ${animationDelay}s;">
            <div class="flex items-start gap-5">
                <div class="flex-shrink-0 w-14 h-14 rounded-xl ${project.theme.bgIcon} flex items-center justify-center ${project.theme.textIcon} group-hover:scale-110 transition-transform duration-300">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        ${project.iconSvg}
                    </svg>
                </div>
                <div class="flex-1">
                    <div class="flex justify-between items-center mb-2">
                        <h2 class="text-xl font-bold text-white ${project.theme.hoverText} transition-colors">${escapeHTML(project.title)}</h2>
                        <!-- Контейнер для индикатора статуса -->
                        <div class="status-indicator-container"></div>
                    </div>
                    <p class="text-slate-400 text-sm leading-relaxed mb-4 font-medium">${escapeHTML(project.description)}</p>
                    <span class="inline-flex items-center text-sm font-bold ${project.theme.textAction}">
                        ${escapeHTML(project.actionText)}
                        <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </span>
                </div>
            </div>
        </a>
    `;
}
