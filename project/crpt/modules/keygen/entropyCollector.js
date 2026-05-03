/**
 * Класс для сбора энтропии и генерации ключа.
 * Отвечает за накопление битов и преобразование их в символы ASCII.
 */
export class EntropyCollector {
    constructor(targetLength = 25) {
        this.targetLength = targetLength;
        this.collectedBits = "";
        this.generatedKey = "";
    }

    /**
     * Сбрасывает состояние коллектора
     */
    reset() {
        this.collectedBits = "";
        this.generatedKey = "";
    }

    /**
     * Добавляет бит в коллекцию.
     * @param {string} bit - '0' или '1'
     * @returns {boolean} - true, если был сгенерирован новый символ ключа
     */
    collect(bit) {
        if (this.isComplete()) return false;

        this.collectedBits += bit;
        
        // Каждые 8 бит собираем в символ
        if (this.collectedBits.length >= 8) {
            const charCode = parseInt(this.collectedBits, 2);
            this.collectedBits = "";

            // Используем печатные символы ASCII (33-126)
            // Формула обеспечивает равномерное распределение в диапазоне
            const validChar = 33 + (charCode % (126 - 33));
            
            this.generatedKey += String.fromCharCode(validChar);
            return true; // Ключ обновился
        }
        
        return false; // Ключ не изменился
    }

    /**
     * Возвращает текущий сгенерированный ключ
     */
    getKey() {
        return this.generatedKey;
    }

    /**
     * Проверяет, достигнута ли целевая длина ключа
     */
    isComplete() {
        return this.generatedKey.length >= this.targetLength;
    }

    /**
     * Возвращает текущую длину ключа
     */
    getLength() {
        return this.generatedKey.length;
    }
}