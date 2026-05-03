/**
 * Модуль состояния файлов.
 * Хранит глобальные данные о загруженных и обработанных файлах.
 */

export const FileState = {
    encodeFile: null,       // Исходный файл для шифрования
    decodeFile: null,       // Исходный контент файла для расшифровки
    encryptedResult: null,  // Результат шифрования (строка Base64)
    decryptedResult: null   // Результат расшифровки файла (объект {name, type, data})
};