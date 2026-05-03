/**
 * Класс, представляющий одну ячейку в матрице.
 * Отвечает за свое состояние: значение (0/1), яркость, активность и фазу пульсации.
 */
export class MatrixCell {
    constructor() {
        this.value = Math.random() > 0.5 ? '1' : '0';
        this.lastSwitchTime = 0;
        // Случайная частота смены (от 4 до 10 изменений в секунду)
        this.switchInterval = Math.floor(Math.random() * (250 - 100 + 1) + 100);
        
        this.brightness = 0; // 0.0 to 1.0
        this.active = false; // Была ли задета курсором
        
        // Для плавного пульсирования в покое
        this.pulsePhase = Math.random() * Math.PI * 2;
        this.pulseSpeed = 0.02 + Math.random() * 0.03;
    }

    /**
     * Обновляет состояние ячейки на основе времени
     * @param {number} time - текущее время (Date.now())
     */
    update(time) {
        // 1. Смена значения 0/1
        if (time - this.lastSwitchTime > this.switchInterval) {
            this.value = this.value === '1' ? '0' : '1';
            this.lastSwitchTime = time;
            this.switchInterval = Math.floor(Math.random() * (250 - 100 + 1) + 100);
        }

        // 2. Логика яркости (Плавное затухание)
        if (this.active) {
            // Если ячейка активирована касанием
            if (this.brightness > 0) {
                // ОЧЕНЬ плавное затухание для длинного хвоста
                this.brightness -= 0.015; 
            } else {
                this.brightness = 0;
                this.active = false;
            }
        } else {
            // Если ячейка в покое - она плавно пульсирует в темноте
            this.pulsePhase += this.pulseSpeed;
            const pulse = (Math.sin(this.pulsePhase) + 1) / 2; // 0..1
            // Базовая яркость от 0.1 до 0.4
            this.brightness = 0.1 + (pulse * 0.3); 
        }
    }

    /**
     * Активирует ячейку (при касании курсором)
     */
    activate() {
        this.active = true;
        this.brightness = 1.0; // Вспышка до максимума
    }
}