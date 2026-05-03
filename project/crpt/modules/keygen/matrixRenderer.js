/**
 * Класс, отвечающий за отрисовку матрицы на Canvas.
 * Изолирует логику работы с контекстом 2D.
 */
export class MatrixRenderer {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    }

    /**
     * Очищает холст и рисует сетку ячеек
     * @param {Array<Array<MatrixCell>>} cells - Двумерный массив ячеек
     * @param {number} rows - Количество строк
     * @param {number} cols - Количество колонок
     */
    draw(cells, rows, cols) {
        if (!this.ctx || !this.canvas) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const cellW = width / cols;
        const cellH = height / rows;
        const now = Date.now();

        // Очистка (черный фон)
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, width, height);

        // Настройка шрифта
        this.ctx.font = `bold ${Math.floor(cellH * 0.8)}px monospace`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const cell = cells[y][x];
                
                // Обновляем состояние ячейки перед отрисовкой
                cell.update(now);

                const cx = x * cellW + cellW / 2;
                const cy = y * cellH + cellH / 2;

                // Цвет: Матричный зеленый (0, 255, 70)
                // При максимальной яркости уходит в белый
                const r = Math.floor(255 * (cell.brightness > 0.8 ? (cell.brightness - 0.8) * 5 : 0));
                const g = 255;
                const b = Math.floor(255 * (cell.brightness > 0.8 ? (cell.brightness - 0.8) * 5 : 0));
                
                // Прозрачность зависит от яркости
                this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${cell.brightness})`;
                
                // Рисуем 0 или 1
                this.ctx.fillText(cell.value, cx, cy);
                
                // Дополнительное свечение для активных ячеек
                if (cell.brightness > 0.5) {
                    this.ctx.shadowColor = '#00ff00';
                    this.ctx.shadowBlur = 15 * cell.brightness;
                    this.ctx.fillText(cell.value, cx, cy);
                    this.ctx.shadowBlur = 0;
                }
            }
        }
    }
}