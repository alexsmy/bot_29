/**
 * Модуль обработчиков событий (Handlers).
 * Инициализирует слушатели событий для кнопок загрузки, сохранения и Drag & Drop.
 */
import { processFile } from './fileProcessor.js';
import { FileState } from './fileState.js';
import { getRandomFileName, downloadString } from './fileUtils.js';
import { showToast } from '../notifications.js';

export function initLoadButtons() {
    const loadBtns = document.querySelectorAll('.load-btn');
    
    // ИСПРАВЛЕНИЕ ОШИБКИ: 
    // Вместо глобального querySelectorAll('input[type="file"]'), который ошибочно 
    // перехватывал загрузку QR-кода, мы явно указываем только целевые инпуты.
    const fileInputs =[
        document.getElementById('file-upload-encode'),
        document.getElementById('file-upload-decode')
    ].filter(Boolean);

    loadBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const fileInputId = btn.getAttribute('data-file');
            const input = document.getElementById(fileInputId);
            if (input) input.click();
        });
    });

    fileInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            if (!e.target.files || e.target.files.length === 0) return;
            
            const targetId = input.id === 'file-upload-encode' ? 'encode-input' : 'decode-input';
            processFile(e.target.files[0], targetId);
            e.target.value = ''; // Сброс значения для возможности повторной загрузки того же файла
        });
    });
}

export function initSaveButtons() {
    const saveBtns = document.querySelectorAll('.save-btn');
    saveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const el = document.getElementById(targetId);
            
            // Логика сохранения
            if (el && el.classList.contains('file-loaded')) {
                
                // 1. Сохранение ЗАШИФРОВАННОГО файла
                if (targetId === 'encode-output' && FileState.encryptedResult) {
                    const randomName = getRandomFileName();
                    const filename = `${randomName}.crpt`;
                    
                    downloadString(FileState.encryptedResult, filename, 'text/plain;charset=utf-8');
                    showToast(`Файл сохранен: ${filename}`, "success");
                    return;
                } 
                
                // 2. Сохранение РАСШИФРОВАННОГО файла
                else if (targetId === 'decode-output' && FileState.decryptedResult) {
                    const fileData = FileState.decryptedResult;
                    
                    // Создаем ссылку для скачивания Data URL (который хранится в fileData.data)
                    const a = document.createElement('a');
                    a.href = fileData.data;
                    a.download = fileData.name; // Используем оригинальное имя файла
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    showToast(`Файл сохранен: ${fileData.name}`, "success");
                    return;
                }
                
                // Если пытаются сохранить просто статусное сообщение
                else {
                    showToast("Нет данных для сохранения или файл не обработан.", "warning");
                    return;
                }
            } else {
                // 3. Сохранение ОБЫЧНОГО ТЕКСТА
                const textToSave = el ? el.value : '';
                if (!textToSave) {
                    showToast("Нет данных для сохранения", "warning");
                    return;
                }

                const isEncode = targetId.includes('encode');
                const extension = isEncode ? '.crpt' : '.txt';
                const randomName = getRandomFileName();
                const filename = `${randomName}${extension}`;
                
                downloadString(textToSave, filename, 'text/plain;charset=utf-8');
                showToast(`Файл сохранен: ${filename}`, "success");
            }
        });
    });
}

export function initDragAndDrop() {
    const dropZones = document.querySelectorAll('.drop-zone');

    dropZones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFile(e.dataTransfer.files[0], zone.id);
            }
        });
    });
}