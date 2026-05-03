/**
 * Модуль работы с файлами (Точка входа / Фасад)
 * Объединяет функционал подмодулей для использования в основном приложении.
 */
import { initLoadButtons, initSaveButtons, initDragAndDrop } from './files/fileHandlers.js';

// Ре-экспорт необходимых сущностей для внешнего использования (в app_advanced.js)
export { FileState } from './files/fileState.js';
export { getRandomFileName } from './files/fileUtils.js';

/**
 * Инициализация всех обработчиков файлов
 */
export function initFileHandlers() {
    initLoadButtons();
    initSaveButtons();
    initDragAndDrop();
}