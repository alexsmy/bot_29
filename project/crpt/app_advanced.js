import { renderApp } from './modules/AppRenderer.js'; 
import { initIcons } from './modules/icons.js';
import { initTheme } from './modules/theme.js';
import { initUI, updateCharCounts, updateAllKeyUI } from './modules/ui.js';
import { showToast } from './modules/notifications.js';
import { initFileHandlers, FileState, getRandomFileName } from './modules/fileManager.js';
import { KeyGenerator } from './modules/keyGenerator.js';
import { AdvancedCryptoModule } from './modules/crypto.js';
import { initQRKeyManager } from './modules/qrKeyManager.js';
import { CloudManager } from './modules/cloudManager.js'; // Импорт менеджера облака

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. Рендеринг структуры приложения ---
    renderApp();

    // --- 2. Инициализация модулей ---
    initIcons(); 
    initTheme();
    initUI();
    initFileHandlers();
    new KeyGenerator(); 
    initQRKeyManager(); 

    // --- Элементы DOM для основной логики ---
    const encodeInput = document.getElementById('encode-input');
    const encodeKey = document.getElementById('encode-key');
    const encodeBtn = document.getElementById('encode-btn');
    const encodeOutput = document.getElementById('encode-output');

    const decodeInput = document.getElementById('decode-input');
    const decodeKey = document.getElementById('decode-key');
    const decodeBtn = document.getElementById('decode-btn');
    const decodeOutput = document.getElementById('decode-output');

    // --- Элементы Облака ---
    const saveToCloudBtn = document.getElementById('save-to-cloud-btn');
    const loadFromCloudBtn = document.getElementById('load-from-cloud-btn');
    const cloudModal = document.getElementById('cloud-modal');
    const cloudCloseBtn = document.getElementById('cloud-close-btn');
    const cloudSaveSection = document.getElementById('cloud-save-section');
    const cloudLoadSection = document.getElementById('cloud-load-section');
    const cloudModalTitle = document.getElementById('cloud-modal-title');
    const cloudIdDisplay = document.getElementById('cloud-id-display');
    const cloudCopyIdBtn = document.getElementById('cloud-copy-id-btn');
    const cloudIdInput = document.getElementById('cloud-id-input');
    const cloudActionBtn = document.getElementById('cloud-action-btn');
    const cloudModalFooter = document.getElementById('cloud-modal-footer');

    // --- Синхронизация ключей ---
    const savedKey = sessionStorage.getItem('secretKey') || '';
    if (encodeKey) encodeKey.value = savedKey;
    if (decodeKey) decodeKey.value = savedKey;
    
    updateAllKeyUI();

    function handleKeyChange(e) {
        const newKey = e.target.value;
        if (encodeKey) encodeKey.value = newKey;
        if (decodeKey) decodeKey.value = newKey;
        sessionStorage.setItem('secretKey', newKey);
        updateAllKeyUI();
    }
    
    if (encodeKey) encodeKey.addEventListener('input', handleKeyChange);
    if (decodeKey) decodeKey.addEventListener('input', handleKeyChange);

    // --- Валидация ---
    function validateKey(key) {
        if (key.length < 4 || key.length > 25) {
            showToast("Длина ключа должна быть от 4 до 25 символов!", "error");
            return false;
        }
        return true;
    }

    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 50));

    // --- Обработчики Шифрования / Расшифровки ---
    
    if (encodeBtn) {
        encodeBtn.addEventListener('click', async () => {
            let payloadStr = "";
            const isFileMode = !!FileState.encodeFile;
            
            if (isFileMode) {
                const payload = {
                    t: 'file',
                    n: FileState.encodeFile.name,
                    m: FileState.encodeFile.type,
                    d: FileState.encodeFile.data
                };
                payloadStr = JSON.stringify(payload);
            } else {
                const text = encodeInput.value;
                if (!text) {
                    showToast("Введите текст или загрузите файл для преобразования.", "error");
                    return;
                }
                payloadStr = JSON.stringify({ t: 'txt', d: text });
            }
            
            const key = encodeKey.value;
            if (!validateKey(key)) return;

            try {
                encodeBtn.disabled = true;
                encodeBtn.innerHTML = `<svg class="icon spinner"><use href="#icon-loader"></use></svg> Обработка...`;
                
                await yieldToMain();

                const result = await AdvancedCryptoModule.encrypt(payloadStr, key);
                
                if (isFileMode) {
                    FileState.encryptedResult = result;
                    const randomName = getRandomFileName();
                    const newFileName = `${randomName}.crpt`;
                    
                    encodeOutput.value = `🔒 ФАЙЛ ЗАШИФРОВАН\nИсходный: ${FileState.encodeFile.name}\nНовое имя: ${newFileName}\nНажмите "Сохранить" или "В облако"!`;
                    encodeOutput.classList.add('file-loaded');
                    encodeOutput.readOnly = true;
                } else {
                    FileState.encryptedResult = null; 
                    encodeOutput.value = result;
                    encodeOutput.classList.remove('file-loaded');
                    encodeOutput.readOnly = true;
                }

                updateCharCounts();
                showToast("Данные успешно зашифрованы!", "success");
            } catch (error) {
                showToast("Ошибка при шифровании: " + error.message, "error");
            } finally {
                encodeBtn.disabled = false;
                encodeBtn.innerHTML = `<svg class="icon"><use href="#icon-lock"></use></svg> Зашифровать`;
            }
        });
    }

    if (decodeBtn) {
        decodeBtn.addEventListener('click', async () => {
            let code = "";
            
            if (decodeInput.classList.contains('file-loaded') && FileState.decodeFile) {
                code = FileState.decodeFile;
            } else {
                code = decodeInput.value.trim();
            }

            const key = decodeKey.value;

            if (!code) {
                showToast("Введите код или загрузите файл для расшифровки.", "error");
                return;
            }
            if (!validateKey(key)) return;

            try {
                decodeBtn.disabled = true;
                decodeBtn.innerHTML = `<svg class="icon spinner"><use href="#icon-loader"></use></svg> Обработка...`;
                
                await yieldToMain();

                const resultStr = await AdvancedCryptoModule.decrypt(code, key);
                
                try {
                    const payload = JSON.parse(resultStr);
                    
                    if (payload.t === 'file') {
                        FileState.decryptedResult = {
                            name: payload.n,
                            type: payload.m,
                            data: payload.d
                        };

                        decodeOutput.value = `✅ ФАЙЛ РАСШИФРОВАН\nИмя: ${payload.n}\nТип: ${payload.m}\nНажмите "Сохранить", чтобы скачать файл.`;
                        decodeOutput.classList.add('file-loaded');
                        decodeOutput.readOnly = true;
                        
                    } else if (payload.t === 'txt') {
                        FileState.decryptedResult = null;
                        decodeOutput.value = payload.d;
                        decodeOutput.classList.remove('file-loaded');
                        decodeOutput.readOnly = true;
                    }
                } catch (e) {
                    FileState.decryptedResult = null;
                    decodeOutput.value = resultStr;
                    decodeOutput.classList.remove('file-loaded');
                    decodeOutput.readOnly = true;
                }
                
                updateCharCounts();
                showToast("Данные успешно расшифрованы!", "success");
            } catch (error) {
                showToast(error.message, "error");
            } finally {
                decodeBtn.disabled = false;
                decodeBtn.innerHTML = `<svg class="icon"><use href="#icon-unlock"></use></svg> Расшифровать`;
            }
        });
    }

    // ==========================================
    // ЛОГИКА РАБОТЫ С ОБЛАКОМ
    // ==========================================

    // Закрытие модального окна облака
    if (cloudCloseBtn) {
        cloudCloseBtn.addEventListener('click', () => {
            cloudModal.classList.remove('active');
        });
    }

    // Копирование ID
    if (cloudCopyIdBtn) {
        cloudCopyIdBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(cloudIdDisplay.value);
                showToast("ID скопирован в буфер обмена", "success");
            } catch (e) {
                showToast("Ошибка копирования", "error");
            }
        });
    }

    // Кнопка "В облако" (Сохранение)
    if (saveToCloudBtn) {
        saveToCloudBtn.addEventListener('click', async () => {
            let dataToSave = "";
            
            if (encodeOutput.classList.contains('file-loaded') && FileState.encryptedResult) {
                dataToSave = FileState.encryptedResult;
            } else {
                dataToSave = encodeOutput.value.trim();
            }

            if (!dataToSave) {
                showToast("Нет зашифрованных данных для сохранения", "warning");
                return;
            }

            saveToCloudBtn.disabled = true;
            saveToCloudBtn.innerHTML = `<svg class="icon spinner"><use href="#icon-loader"></use></svg> Отправка...`;

            const id = await CloudManager.saveToCloud(dataToSave);
            
            saveToCloudBtn.disabled = false;
            saveToCloudBtn.innerHTML = `<svg class="icon"><use href="#icon-cloud-upload"></use></svg> В облако`;

            if (id) {
                // Настраиваем модальное окно для показа ID
                cloudModalTitle.innerText = "Успешно сохранено";
                cloudSaveSection.classList.remove('hidden');
                cloudLoadSection.classList.add('hidden');
                cloudModalFooter.classList.add('hidden'); // Кнопка действия не нужна
                
                cloudIdDisplay.value = id;
                cloudModal.classList.add('active');
            }
        });
    }

    // Кнопка "Из облака" (Открытие модалки для ввода ID)
    if (loadFromCloudBtn) {
        loadFromCloudBtn.addEventListener('click', () => {
            cloudModalTitle.innerText = "Загрузка из облака";
            cloudSaveSection.classList.add('hidden');
            cloudLoadSection.classList.remove('hidden');
            cloudModalFooter.classList.remove('hidden');
            
            cloudIdInput.value = '';
            cloudModal.classList.add('active');
            setTimeout(() => cloudIdInput.focus(), 100);
        });
    }

    // Кнопка "Загрузить" внутри модалки облака
    if (cloudActionBtn) {
        cloudActionBtn.addEventListener('click', async () => {
            const id = cloudIdInput.value.trim();
            if (id.length !== 8) {
                showToast("ID должен состоять из 8 символов", "warning");
                return;
            }

            cloudActionBtn.disabled = true;
            cloudActionBtn.innerHTML = `<svg class="icon spinner"><use href="#icon-loader"></use></svg> Загрузка...`;

            const data = await CloudManager.loadFromCloud(id);

            cloudActionBtn.disabled = false;
            cloudActionBtn.innerHTML = `<svg class="icon"><use href="#icon-cloud-download"></use></svg> Загрузить`;

            if (data) {
                // Помещаем данные в поле расшифровки
                FileState.decodeFile = data;
                decodeInput.value = `☁️ ФАЙЛ ИЗ ОБЛАКА\nID: ${id}\nРазмер: ${(data.length / 1024).toFixed(2)} КБ\nВведите ключ и нажмите "Расшифровать".`;
                decodeInput.classList.add('file-loaded');
                decodeInput.readOnly = true;
                
                updateCharCounts();
                cloudModal.classList.remove('active');
                showToast("Данные успешно загружены из облака!", "success");
            }
        });
    }
});