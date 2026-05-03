/**
 * Модуль процессора файлов.
 * Отвечает за чтение файлов через FileReader, валидацию и обновление UI при загрузке.
 */
import { FileState } from './fileState.js';
import { showToast } from '../notifications.js';
import { updateCharCounts } from '../ui.js';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

export function processFile(file, targetInputId) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
        showToast(`Файл слишком большой. Максимальный размер: ${MAX_FILE_SIZE / 1024 / 1024} МБ`, "error");
        return;
    }

    const reader = new FileReader();
    
    if (targetInputId === 'encode-input') {
        // --- ЗАГРУЗКА ДЛЯ ШИФРОВАНИЯ ---
        reader.onload = (event) => {
            FileState.encodeFile = {
                name: file.name,
                type: file.type || 'application/octet-stream',
                data: event.target.result
            };
            
            const targetEl = document.getElementById(targetInputId);
            if (targetEl) {
                // Компактный вывод информации
                targetEl.value = `📄 ФАЙЛ ГОТОВ К ШИФРОВАНИЮ\nИмя: ${file.name}\nРазмер: ${(file.size / (1024 * 1024)).toFixed(2)} МБ\nНажмите "Зашифровать".`;
                targetEl.classList.add('file-loaded');
                targetEl.readOnly = true;
                updateCharCounts();
                showToast(`Файл "${file.name}" загружен`, "success");
            }
        };
        reader.onerror = () => showToast("Ошибка при чтении файла", "error");
        reader.readAsDataURL(file);
        
    } else {
        // --- ЗАГРУЗКА ДЛЯ РАСШИФРОВКИ ---
        if (!file.name.endsWith('.crpt') && !file.name.endsWith('.txt')) {
            showToast("Рекомендуется выбирать файл .crpt", "warning");
        }
        reader.onload = (event) => {
            // Сохраняем сырые данные в состояние
            FileState.decodeFile = event.target.result;

            const targetEl = document.getElementById(targetInputId);
            if (targetEl) {
                // Компактный вывод информации
                targetEl.value = `🔐 ФАЙЛ ЗАГРУЖЕН\nИмя: ${file.name}\nРазмер: ${(file.size / 1024).toFixed(2)} КБ\nВведите ключ и нажмите "Расшифровать".`;
                targetEl.classList.add('file-loaded');
                targetEl.readOnly = true; 
                updateCharCounts();
                showToast(`Файл "${file.name}" готов`, "success");
            }
        };
        reader.onerror = () => showToast("Ошибка при чтении файла", "error");
        reader.readAsText(file);
    }
}