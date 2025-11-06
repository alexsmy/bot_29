document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;

    // Элементы UI
    const loader = document.getElementById('loader');
    const noRoomState = document.getElementById('no-room-state');
    const activeRoomState = document.getElementById('active-room-state');
    const createRoomBtn = document.getElementById('create-room-btn');
    const goToRoomBtn = document.getElementById('go-to-room-btn');
    const shareRoomBtn = document.getElementById('share-room-btn');
    const roomTimerSpan = document.getElementById('room-timer');

    let userId = null;
    let activeRoomId = null;
    let countdownInterval = null;
    let statusCheckInterval = null;

    // --- Функции ---

    function showState(state) {
        loader.style.display = 'none';
        noRoomState.style.display = state === 'no-room' ? 'flex' : 'none';
        activeRoomState.style.display = state === 'active-room' ? 'flex' : 'none';
    }

    function startCountdown(expiresAtISO) {
        if (countdownInterval) clearInterval(countdownInterval);

        const expiresAt = new Date(expiresAtISO);

        countdownInterval = setInterval(() => {
            const now = new Date();
            const remaining = expiresAt - now;

            if (remaining <= 0) {
                roomTimerSpan.textContent = '00:00:00';
                clearInterval(countdownInterval);
                // Когда таймер истек, снова проверяем статус, чтобы UI обновился
                fetchRoomStatus();
                return;
            }

            const hours = Math.floor(remaining / (1000 * 60 * 60)).toString().padStart(2, '0');
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000).toString().padStart(2, '0');
            
            roomTimerSpan.textContent = `${hours}:${minutes}:${seconds}`;
        }, 1000);
    }

    function updateUI(data) {
        if (data && data.room) {
            // Есть активная комната
            activeRoomId = data.room.room_id;
            showState('active-room');
            startCountdown(data.room.expires_at);
        } else {
            // Нет активной комнаты
            activeRoomId = null;
            if (countdownInterval) clearInterval(countdownInterval);
            showState('no-room');
        }
    }

    async function fetchRoomStatus() {
        if (!userId) {
            console.error("User ID not available.");
            // Можно показать ошибку пользователю
            return;
        }
        console.log(`[TMA] Fetching room status for user: ${userId}`);
        try {
            const response = await fetch(`/api/tma/room-status?user_id=${userId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log("[TMA] Received data:", data);
            updateUI(data);
        } catch (error) {
            console.error("Failed to fetch room status:", error);
            // Можно показать ошибку пользователю
        }
    }

    // --- Инициализация ---

    tg.ready();
    tg.expand();

    // Получаем ID пользователя. В реальном приложении нужна проверка на подлинность.
    userId = tg.initDataUnsafe.user?.id;
    
    // Для тестирования в браузере
    if (!userId) {
        console.warn("Telegram User ID not found. Using a test ID.");
        userId = '123456789'; // Замените на ID для теста
    }

    // Обработчики событий
    goToRoomBtn.addEventListener('click', () => {
        if (activeRoomId) {
            tg.openLink(`/call/${activeRoomId}`);
        }
    });

    shareRoomBtn.addEventListener('click', () => {
        if (activeRoomId) {
            tg.switchInlineQuery(activeRoomId);
        }
    });

    // Начинаем проверку статуса
    fetchRoomStatus();
    // Устанавливаем периодическую проверку каждые 15 секунд
    statusCheckInterval = setInterval(fetchRoomStatus, 15000);

    console.log('Mini App script loaded and initialized.');
});