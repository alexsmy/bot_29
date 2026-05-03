/**
 * Модуль генератора ключей (Matrix Effect)
 * Является контроллером, объединяющим логику ячеек, отрисовку и сбор энтропии.
 * Реализует взаимодействие с DOM и обработку событий ввода.
 */
import { showToast } from './notifications.js';
import { evaluateKeyStrength } from './ui.js';
import { MatrixCell } from './keygen/matrixCell.js';
import { MatrixRenderer } from './keygen/matrixRenderer.js';
import { EntropyCollector } from './keygen/entropyCollector.js';

export class KeyGenerator {
    constructor() {
        this.COLS = 20; 
        this.ROWS = 20;
        this.cells = [];
        
        this.isDrawing = false;
        this.animationId = null;
        
        // Инициализация подмодулей
        this.entropyCollector = new EntropyCollector(25);
        
        // DOM Elements
        this.modal = document.getElementById('key-gen-modal');
        this.canvas = document.getElementById('matrix-canvas');
        this.display = document.getElementById('gen-key-display');
        this.confirmBtn = document.getElementById('gen-confirm-btn');
        this.cancelBtn = document.getElementById('gen-cancel-btn');
        this.resetBtn = document.getElementById('gen-reset-btn');
        this.openBtn = document.getElementById('generate-key-btn');
        
        this.statusBadge = document.getElementById('gen-status-text');
        this.matrixContainer = document.querySelector('.matrix-container');
        
        // Inputs to update
        this.encodeKeyInput = document.getElementById('encode-key');
        this.decodeKeyInput = document.getElementById('decode-key');

        // Инициализация рендерера (после получения canvas)
        this.renderer = new MatrixRenderer(this.canvas);

        this.initEvents();
    }

    initEvents() {
        if (!this.openBtn || !this.canvas) return;

        this.openBtn.addEventListener('click', () => {
            this.modal.classList.add('active');
            this.resetGenerator();
            this.startAnimation();
        });

        this.cancelBtn.addEventListener('click', () => this.closeModal());
        this.resetBtn.addEventListener('click', () => this.resetGenerator());
        
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        this.confirmBtn.addEventListener('click', () => {
            const finalKey = this.entropyCollector.getKey();
            
            if (this.encodeKeyInput) this.encodeKeyInput.value = finalKey;
            if (this.decodeKeyInput) this.decodeKeyInput.value = finalKey;
            
            sessionStorage.setItem('secretKey', finalKey);
            
            if (this.encodeKeyInput) this.encodeKeyInput.dispatchEvent(new Event('input'));
            
            showToast("Ключ успешно применен!", "success");
            this.closeModal();
        });

        // --- Mouse / Touch Events ---
        
        const startInteraction = (x, y) => {
            if (this.entropyCollector.isComplete()) return;
            this.isDrawing = true;
            this.matrixContainer.classList.add('active');
            this.handleInteraction(x, y);
        };

        const moveInteraction = (x, y) => {
            if (this.entropyCollector.isComplete()) {
                this.isDrawing = false;
                this.matrixContainer.classList.remove('active');
                return;
            }
            if (this.isDrawing) {
                this.handleInteraction(x, y);
            }
        };

        const endInteraction = () => {
            this.isDrawing = false;
            this.matrixContainer.classList.remove('active');
        };

        // Mouse
        this.canvas.addEventListener('mousedown', (e) => startInteraction(e.clientX, e.clientY));
        window.addEventListener('mouseup', endInteraction);
        this.canvas.addEventListener('mousemove', (e) => moveInteraction(e.clientX, e.clientY));

        // Touch
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            endInteraction();
        });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            moveInteraction(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
    }

    closeModal() {
        this.modal.classList.remove('active');
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    resetGenerator() {
        // Пересоздаем сетку ячеек
        this.cells = [];
        for (let y = 0; y < this.ROWS; y++) {
            const row = [];
            for (let x = 0; x < this.COLS; x++) {
                row.push(new MatrixCell());
            }
            this.cells.push(row);
        }
        
        // Сбрасываем коллектор энтропии
        this.entropyCollector.reset();
        this.updateGenUI();
    }

    startAnimation() {
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        const loop = () => {
            if (this.modal.classList.contains('active')) {
                // Делегируем отрисовку рендереру
                this.renderer.draw(this.cells, this.ROWS, this.COLS);
                this.animationId = requestAnimationFrame(loop);
            }
        };
        loop();
    }

    handleInteraction(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const cellW = this.canvas.width / this.COLS;
        const cellH = this.canvas.height / this.ROWS;
        
        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);

        if (col >= 0 && col < this.COLS && row >= 0 && row < this.ROWS) {
            const cell = this.cells[row][col];
            
            // Если ячейка еще не активна (не в следе)
            if (!cell.active) {
                // 1. Визуальный эффект ВСЕГДА
                cell.activate();
                
                // 2. Сбор данных С ПРОПУСКАМИ (для замедления процесса)
                // Собираем бит только в 50% случаев (пропускаем 50%)
                if (Math.random() > 0.5) {
                    const keyChanged = this.entropyCollector.collect(cell.value);
                    if (keyChanged) {
                        this.updateGenUI();
                    }
                }
            }
        }
    }

    updateGenUI() {
        const currentKey = this.entropyCollector.getKey();
        const len = this.entropyCollector.getLength();
        
        this.display.value = currentKey;
        
        const { status, styleClass } = evaluateKeyStrength(len);
        
        // Обновляем статус
        this.statusBadge.innerText = status;
        
        // Обновляем классы цветов
        this.display.className = ''; // сброс
        this.display.classList.add(styleClass);

        // Управление кнопкой подтверждения
        if (len < 4) {
            this.confirmBtn.disabled = true;
            this.confirmBtn.innerHTML = `<svg class="icon"><use href="#icon-loader"></use></svg> Сбор...`;
        } else {
            this.confirmBtn.disabled = false;
            this.confirmBtn.innerHTML = `<svg class="icon"><use href="#icon-check"></use></svg> Применить`;
        }
        
        if (this.entropyCollector.isComplete()) {
            this.confirmBtn.innerHTML = `<svg class="icon"><use href="#icon-check-circle"></use></svg> Готово`;
            this.isDrawing = false;
            this.matrixContainer.classList.remove('active');
        }
    }
}