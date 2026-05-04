// Модуль компонента карточки: отвечает за генерацию HTML-кода отдельного проекта

export function createCardHTML(project, index) {
    // Динамически вычисляем задержку анимации (0.1s, 0.2s, 0.3s и т.д.)
    // Это позволяет отказаться от жестко заданных nth-child в CSS и добавлять бесконечное число карточек
    const animationDelay = (index * 0.1 + 0.1).toFixed(1);
    
    return `
        <a href="${project.url}" 
           class="group block bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${project.theme.hoverShadow} ${project.theme.hoverBorder} hover:bg-slate-800/60"
           style="animation-delay: ${animationDelay}s;">
            <div class="flex items-start gap-5">
                <div class="flex-shrink-0 w-14 h-14 rounded-xl ${project.theme.bgIcon} flex items-center justify-center ${project.theme.textIcon} group-hover:scale-110 transition-transform duration-300">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        ${project.iconSvg}
                    </svg>
                </div>
                <div class="flex-1">
                    <h2 class="text-xl font-bold text-white mb-2 ${project.theme.hoverText} transition-colors">${project.title}</h2>
                    <p class="text-slate-400 text-sm leading-relaxed mb-4 font-medium">${project.description}</p>
                    <span class="inline-flex items-center text-sm font-bold ${project.theme.textAction}">
                        ${project.actionText}
                        <svg class="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </span>
                </div>
            </div>
        </a>
    `;
}