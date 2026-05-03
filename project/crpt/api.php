<?php
/**
 * Простой API для сохранения и загрузки зашифрованных файлов.
 * Сервер хранит только зашифрованные данные (Base64).
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');

// Папка для хранения файлов (будет создана автоматически)
$uploadDir = __DIR__ . '/uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
    // Защита папки от прямого доступа через браузер
    file_put_contents($uploadDir . '.htaccess', "Order Deny,Allow\nDeny from all");
}

$action = $_GET['action'] ?? '';

if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    // Получаем сырые данные из тела запроса
    $data = file_get_contents('php://input');
    
    if (empty($data)) {
        echo json_encode(['success' => false, 'error' => 'Нет данных для сохранения']);
        exit;
    }

    // Ограничение размера (например, 50 МБ)
    if (strlen($data) > 50 * 1024 * 1024) {
        echo json_encode(['success' => false, 'error' => 'Файл слишком большой']);
        exit;
    }

    // Генерируем уникальный 8-значный ID
    $id = substr(str_shuffle("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"), 0, 8);
    $filePath = $uploadDir . $id . '.crpt';
    
    // Гарантируем уникальность
    while (file_exists($filePath)) {
        $id = substr(str_shuffle("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"), 0, 8);
        $filePath = $uploadDir . $id . '.crpt';
    }

    if (file_put_contents($filePath, $data)) {
        echo json_encode(['success' => true, 'id' => $id]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Ошибка записи на диск сервера']);
    }
} 
elseif ($action === 'load' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    // Очищаем ID от спецсимволов для защиты от Path Traversal
    $id = preg_replace('/[^a-zA-Z0-9]/', '', $_GET['id'] ?? '');
    
    if (empty($id)) {
        echo json_encode(['success' => false, 'error' => 'Не указан ID файла']);
        exit;
    }

    $filePath = $uploadDir . $id . '.crpt';

    if (file_exists($filePath)) {
        $data = file_get_contents($filePath);
        echo json_encode(['success' => true, 'data' => $data]);
    } else {
        echo json_encode(['success' => false, 'error' => 'Файл не найден или удален']);
    }
} 
else {
    echo json_encode(['success' => false, 'error' => 'Неверный запрос']);
}
?>