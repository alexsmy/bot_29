/**
 * Модуль управления общими элементами UI
 * (Табы, счетчики, кнопки копирования/вставки, видимость пароля, оценка ключа)
 */
import { showToast } from './notifications.js';
import { FileState } from './fileManager.js';

export function initUI() {
    initTabs();
    initCharCounters();
    initPasswordToggles();
    initClipboardActions();
    initClearButtons();
    updateAllKeyUI();
}

// --- Логика оценки надежности ключа (Обновленная) ---
export function evaluateKeyStrength(len) {
    if (len === 0) return { status: "Пусто", styleClass: "strength-default" };
    if (len < 4) return { status: "Короткий", styleClass: "strength-default" };
    if (len <= 6) return { status: "Простой", styleClass: "strength-simple" };
    if (len <= 10) return { status: "Средний", styleClass: "strength-medium" };
    if (len <= 14) return { status: "Надёжный", styleClass: "strength-reliable" };
    if (len <= 18) return { status: "Мощный", styleClass: "strength-strong" };
    if (len <= 22) return { status: "Продвинутый", styleClass: "strength-advanced" };
    if (len < 25) return { status: "Абсолютный", styleClass: "strength-absolute" };
    // Ровно 25 символов
    return { status: "Максимальный", styleClass: "strength-max" };
}

export function updateAllKeyUI() {
    const encodeKey = document.getElementById('encode-key');
    const decodeKey = document.getElementById('decode-key');
    const encodeStatus = document.getElementById('encode-key-status');
    const decodeStatus = document.getElementById('decode-key-status');

    const update = (input, statusEl) => {
        if (!input || !statusEl) return;
        const len = input.value.length;
        const { status, styleClass } = evaluateKeyStrength(len);
        
        statusEl.innerText = `${len}/25 (${status})`;
        
        input.classList.remove(
            'strength-default', 'strength-simple', 'strength-medium', 
            'strength-reliable', 'strength-strong', 'strength-advanced', 
            'strength-absolute', 'strength-max'
        );
        input.classList.add(styleClass);
    };

    update(encodeKey, encodeStatus);
    update(decodeKey, decodeStatus);
}

function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

function initCharCounters() {
    const inputs =[
        document.getElementById('encode-input'),
        document.getElementById('encode-output'),
        document.getElementById('decode-input'),
        document.getElementById('decode-output')
    ];

    function updateCounts() {
        inputs.forEach(el => {
            if (el) {
                const countEl = document.getElementById(`${el.id}-count`);
                if (countEl) {
                    if (el.classList.contains('file-loaded')) {
                        countEl.innerText = "Файл";
                        countEl.style.opacity = "0.5";
                    } else {
                        countEl.innerText = `${el.value.length} симв.`;
                        countEl.style.opacity = "1";
                    }
                }
            }
        });
    }

    inputs.forEach(el => {
        if (el) {
            el.addEventListener('input', updateCounts);
        }
    });
    
    return updateCounts;
}

export const updateCharCounts = initCharCounters();

function initPasswordToggles() {
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const input = btn.previousElementSibling.previousElementSibling || btn.previousElementSibling; 
            
            if (input && (input.type === 'password' || input.type === 'text')) {
                if (input.type === 'password') {
                    input.type = 'text';
                    btn.innerHTML = '<svg class="icon"><use href="#icon-eye-off"></use></svg>';
                } else {
                    input.type = 'password';
                    btn.innerHTML = '<svg class="icon"><use href="#icon-eye"></use></svg>';
                }
            }
        });
    });
}

function initClipboardActions() {
    const copyBtns = document.querySelectorAll('.copy-btn');
    const pasteBtns = document.querySelectorAll('.paste-btn');

    copyBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);
            
            if (!targetEl || !targetEl.value || targetEl.classList.contains('file-loaded')) {
                showToast("Нет текста для копирования или это файл", "warning");
                return;
            }

            try {
                await navigator.clipboard.writeText(targetEl.value);
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<svg class="icon"><use href="#icon-check"></use></svg> Скопировано';
                showToast("Скопировано в буфер обмена", "success");
                setTimeout(() => btn.innerHTML = originalHTML, 2000);
            } catch (err) {
                showToast("Не удалось скопировать. Проверьте разрешения браузера.", "error");
            }
        });
    });

    pasteBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const targetId = btn.getAttribute('data-target');
            const targetEl = document.getElementById(targetId);

            try {
                const text = await navigator.clipboard.readText();
                if (text && targetEl) {
                    targetEl.value = text;
                    targetEl.classList.remove('file-loaded');
                    targetEl.readOnly = false;
                    
                    if (targetId === 'encode-input') FileState.encodeFile = null;
                    if (targetId === 'decode-input') FileState.decodeFile = null;
                    
                    updateCharCounts();
                    showToast("Текст вставлен", "success");
                }
            } catch (err) {
                showToast("Не удалось вставить. Разрешите доступ к буферу обмена.", "error");
            }
        });
    });
}

function initClearButtons() {
    const clearBtns = document.querySelectorAll('.clear-btn');
    clearBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const el = document.getElementById(targetId);
            if (el) {
                el.value = '';
                el.classList.remove('file-loaded');
                
                if (targetId === 'encode-input' || targetId === 'decode-input') {
                    el.readOnly = false;
                }
                
                if (targetId === 'encode-input') FileState.encodeFile = null;
                if (targetId === 'encode-output') FileState.encryptedResult = null;
                if (targetId === 'decode-input') FileState.decodeFile = null;
                if (targetId === 'decode-output') FileState.decryptedResult = null;
                
                updateCharCounts();
            }
        });
    });
}