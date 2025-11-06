document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;

    // Сообщаем Telegram, что приложение готово к отображению
    tg.ready();

    // Расширяем приложение на весь экран
    tg.expand();

    console.log('Mini App script loaded.');
    console.log('Telegram WebApp object:', tg);

    // --- НАЧАЛО ИЗМЕНЕНИЙ ---

    /**
     * Асинхронная функция для проверки состояния пользователя на бэкенде.
     * Отправляет initData для валидации и получения информации об активной комнате.
     */
    async function checkUserState() {
        const appContainer = document.getElementById('app-container');
        
        if (!tg.initData) {
            console.error('Telegram initData is not available.');
            appContainer.innerHTML = '<h1>Ошибка</h1><p>Не удалось получить данные пользователя. Пожалуйста, попробуйте перезапустить приложение.</p>';
            return;
        }

        console.log('Sending initData to backend for validation and state check...');

        try {
            const response = await fetch('/api/user/state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ init_data: tg.initData }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('Received user state from backend:', data);

            // Пока что просто выводим информацию.
            // На следующем шаге мы будем здесь рендерить разный интерфейс.
            if (data.has_active_room) {
                appContainer.innerHTML = `
                    <h1>У вас есть активная комната!</h1>
                    <p>Room ID: ${data.room_id}</p>
                    <p>Осталось времени: ${Math.round(data.remaining_seconds / 60)} мин.</p>
                `;
            } else {
                appContainer.innerHTML = `
                    <h1>Комната для звонка</h1>
                    <p>У вас нет активных комнат. Готовы создать новую?</p>
                `;
            }

        } catch (error) {
            console.error('Failed to check user state:', error);
            appContainer.innerHTML = '<h1>Ошибка сети</h1><p>Не удалось связаться с сервером. Проверьте ваше интернет-соединение.</p>';
        }
    }

    // Вызываем проверку состояния пользователя сразу после инициализации
    checkUserState();

    // --- КОНЕЦ ИЗМЕНЕНИЙ ---
});