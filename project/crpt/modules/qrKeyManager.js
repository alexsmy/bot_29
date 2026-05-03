/**
 * Модуль управления QR-кодами и ПИН-кодами.
 * Интегрирована логика из рабочего примера (qrcodejs).
 * ИСПРАВЛЕНО: В центре QR-кода теперь отрисовывается новая иконка генерации (Х/Искра).
 */
import { showToast } from './notifications.js';
import { AdvancedCryptoModule } from './crypto.js';

export function initQRKeyManager() {
    // --- Элементы Share Modal ---
    const openShareBtn = document.getElementById('open-share-modal-btn');
    const shareModal = document.getElementById('share-key-modal');
    const shareCloseBtn = document.getElementById('share-close-btn');
    const shareKeyDisplay = document.getElementById('share-key-display');
    const shareCopyBtn = document.getElementById('share-copy-btn');
    const qrDisplay = document.getElementById('qrcode-display');
    const usePinCheckbox = document.getElementById('use-pin-checkbox');
    const pinInputContainer = document.getElementById('pin-input-container');
    const sharePinInput = document.getElementById('share-pin-input');
    const shareDownloadBtn = document.getElementById('share-download-btn');
    const qrLoadingOverlay = document.getElementById('qr-loading-overlay');

    // --- Элементы Receive Modal ---
    const openReceiveBtn = document.getElementById('open-receive-modal-btn');
    const receiveModal = document.getElementById('receive-key-modal');
    const receiveCloseBtn = document.getElementById('receive-close-btn');
    const receivePasteBtn = document.getElementById('receive-paste-btn');
    const receiveFileInput = document.getElementById('receive-file-input');
    const receivePastedDisplay = document.getElementById('receive-pasted-display');
    const receivePinSection = document.getElementById('receive-pin-section');
    const receivePinInput = document.getElementById('receive-pin-input');
    const receiveUnlockBtn = document.getElementById('receive-unlock-btn');
    const qrReaderContainer = document.getElementById('qr-reader');

    // --- Глобальные инпуты ключей ---
    const encodeKeyInput = document.getElementById('encode-key');
    const decodeKeyInput = document.getElementById('decode-key');

    let html5QrCode = null;
    let scannedEncryptedPayload = null; 

    // ==========================================
    // ЛОГИКА SHARE (ПОДЕЛИТЬСЯ)
    // ==========================================

    if (openShareBtn) {
        openShareBtn.addEventListener('click', () => {
            const currentKey = encodeKeyInput.value;
            if (!currentKey) {
                showToast("Сначала введите или сгенерируйте ключ!", "warning");
                return;
            }
            
            shareKeyDisplay.value = currentKey;
            
            usePinCheckbox.checked = true;
            pinInputContainer.classList.remove('hidden');
            sharePinInput.value = ''; 
            
            generateQR(currentKey, false);
            
            shareModal.classList.add('active');
            setTimeout(() => sharePinInput.focus(), 100);
        });
    }

    if (shareCloseBtn) {
        shareCloseBtn.addEventListener('click', () => shareModal.classList.remove('active'));
    }

    if (shareCopyBtn) {
        shareCopyBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(shareKeyDisplay.value);
                showToast("Ключ скопирован", "success");
            } catch (e) {
                showToast("Ошибка копирования", "error");
            }
        });
    }

    if (usePinCheckbox) {
        usePinCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                pinInputContainer.classList.remove('hidden');
                sharePinInput.focus();
                generateQR(shareKeyDisplay.value, false);
            } else {
                pinInputContainer.classList.add('hidden');
                sharePinInput.value = '';
                generateQR(shareKeyDisplay.value, false);
            }
        });
    }

    if (sharePinInput) {
        sharePinInput.addEventListener('input', async (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
            const pin = e.target.value;
            
            if (pin.length === 4) {
                await generateQR(shareKeyDisplay.value, true, pin);
            } else {
                generateQR(shareKeyDisplay.value, false);
            }
        });
    }

    if (shareDownloadBtn) {
        shareDownloadBtn.addEventListener('click', () => {
            if (!qrDisplay.hasChildNodes()) {
                showToast("QR-код еще не сгенерирован", "warning");
                return;
            }
            
            const canvas = qrDisplay.querySelector('canvas');
            if (!canvas) {
                showToast("Ошибка: Canvas не найден", "error");
                return;
            }
            
            const url = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'crpt-key-qr.png';
            link.href = url;
            link.click();
            showToast("QR-код сохранен", "success");
        });
    }

    /**
     * Функция отрисовки логотипа поверх Canvas
     */
    function drawLogoOnCanvas(canvas, qrDisplayElement) {
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const size = canvas.width; 
        const logoSize = size * 0.24; // Размер иконки
        const logoPos = (size - logoSize) / 2;
        
        // 1. Рисуем белый круг (подложка)
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, (logoSize / 2) + 6, 0, 2 * Math.PI);
        ctx.fillStyle = "#ffffff";
        ctx.fill();

        // 2. Подготавливаем SVG иконку (Новая иконка: Искра / X)
        // Используем fill="none" и stroke="#2563eb", чтобы она была контурной, как в интерфейсе
        const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"></path>
        </svg>`;
        
        const img = new Image();
        img.onload = () => {
            // Рисуем иконку по центру canvas
            ctx.drawImage(img, logoPos, logoPos, logoSize, logoSize);
            
            // Обновляем видимый тег <img>, чтобы логотип появился в интерфейсе
            if (qrDisplayElement) {
                const qrImg = qrDisplayElement.querySelector('img');
                if (qrImg) {
                    qrImg.src = canvas.toDataURL('image/png');
                }
            }
        };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);
    }

    async function generateQR(key, usePin, pin = '') {
        if (typeof QRCode === 'undefined') {
            showToast("Ошибка: Библиотека QR не загружена.", "error");
            return;
        }

        qrLoadingOverlay.classList.remove('hidden');
        qrDisplay.innerHTML = ''; 
        
        try {
            let payload = "";
            if (usePin && pin.length === 4) {
                const encryptedKey = await AdvancedCryptoModule.encrypt(key, pin);
                payload = `CRPT:ENC:${encryptedKey}`;
            } else {
                payload = `CRPT:RAW:${key}`;
            }

            new QRCode(qrDisplay, {
                text: payload,
                width: 200,
                height: 200,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H 
            });

            // Сразу после генерации находим canvas и рисуем логотип
            const canvas = qrDisplay.querySelector('canvas');
            if (canvas) {
                drawLogoOnCanvas(canvas, qrDisplay);
            }

        } catch (error) {
            console.error("QR Generation Error:", error);
            showToast("Ошибка генерации QR", "error");
        } finally {
            qrLoadingOverlay.classList.add('hidden');
        }
    }

    // ==========================================
    // ЛОГИКА RECEIVE (ПОЛУЧИТЬ)
    // ==========================================

    if (openReceiveBtn) {
        openReceiveBtn.addEventListener('click', () => {
            receiveModal.classList.add('active');
            resetReceiveModal();
            startCameraScanner();
        });
    }

    if (receiveCloseBtn) {
        receiveCloseBtn.addEventListener('click', () => {
            receiveModal.classList.remove('active');
            stopCameraScanner();
        });
    }

    if (receivePasteBtn) {
        receivePasteBtn.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                if (!text) {
                    showToast("Буфер обмена пуст", "warning");
                    return;
                }
                if (text.length > 25) {
                    showToast("Текст слишком длинный (>25)", "warning");
                    return;
                }
                stopCameraScanner();
                qrReaderContainer.style.display = 'none';
                if (receivePastedDisplay) {
                    receivePastedDisplay.value = text;
                    receivePastedDisplay.classList.remove('hidden');
                }
                applyReceivedKey(text, false);
                showToast("Ключ вставлен из буфера!", "success");
            } catch (err) {
                showToast("Не удалось вставить. Разрешите доступ.", "error");
            }
        });
    }

    if (receiveFileInput) {
        receiveFileInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files.length > 0) {
                scanFile(e.target.files[0]);
            }
            e.target.value = ''; 
        });
    }

    if (receiveUnlockBtn) {
        receiveUnlockBtn.addEventListener('click', async () => {
            const pin = receivePinInput.value;
            if (pin.length !== 4) {
                showToast("Введите 4 цифры ПИН-кода", "warning");
                return;
            }
            if (!scannedEncryptedPayload) return;

            try {
                receiveUnlockBtn.disabled = true;
                receiveUnlockBtn.innerHTML = `<svg class="icon spinner"><use href="#icon-loader"></use></svg>`;
                const decryptedKey = await AdvancedCryptoModule.decrypt(scannedEncryptedPayload, pin);
                applyReceivedKey(decryptedKey, true);
                showToast("Ключ успешно расшифрован!", "success");
            } catch (error) {
                showToast("Неверный ПИН-код!", "error");
                receivePinInput.value = '';
                receivePinInput.focus();
            } finally {
                receiveUnlockBtn.disabled = false;
                receiveUnlockBtn.innerHTML = `Открыть`;
            }
        });
    }

    function resetReceiveModal() {
        receivePinSection.classList.add('hidden');
        if (receivePastedDisplay) receivePastedDisplay.classList.add('hidden');
        receivePinInput.value = '';
        scannedEncryptedPayload = null;
        qrReaderContainer.style.display = 'block';
    }

    function startCameraScanner() {
        if (typeof Html5Qrcode === 'undefined') {
            qrReaderContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Сканер недоступен</div>`;
            return;
        }
        if (html5QrCode) {
            try { html5QrCode.stop(); } catch(e){}
        }
        html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 200, height: 200 } };
        html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess)
            .catch(err => {
                qrReaderContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Камера недоступна.</div>`;
            });
    }

    function stopCameraScanner() {
        if (html5QrCode && html5QrCode.isScanning) {
            html5QrCode.stop().then(() => { html5QrCode.clear(); }).catch(console.error);
        }
    }

    function scanFile(file) {
        if (typeof Html5Qrcode === 'undefined') return;
        const html5QrCodeFile = new Html5Qrcode("qr-reader");
        html5QrCodeFile.scanFile(file, true)
            .then(decodedText => { onScanSuccess(decodedText); })
            .catch(err => { showToast("QR-код не найден", "error"); });
    }

    function onScanSuccess(decodedText) {
        stopCameraScanner();
        qrReaderContainer.style.display = 'none';
        if (decodedText.startsWith('CRPT:RAW:')) {
            const key = decodedText.replace('CRPT:RAW:', '');
            applyReceivedKey(key, true);
            showToast("Ключ успешно считан!", "success");
        } else if (decodedText.startsWith('CRPT:ENC:')) {
            scannedEncryptedPayload = decodedText.replace('CRPT:ENC:', '');
            receivePinSection.classList.remove('hidden');
            receivePinInput.focus();
            showToast("Требуется ПИН-код", "info");
        } else {
            applyReceivedKey(decodedText, true);
            showToast("Считан обычный текст", "info");
        }
    }

    function applyReceivedKey(key, closeWindow = true) {
        if (encodeKeyInput) encodeKeyInput.value = key;
        if (decodeKeyInput) decodeKeyInput.value = key;
        sessionStorage.setItem('secretKey', key);
        if (decodeKeyInput) decodeKeyInput.dispatchEvent(new Event('input'));
        if (closeWindow) receiveModal.classList.remove('active');
    }
}