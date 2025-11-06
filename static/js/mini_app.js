document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;

    // --- DOM элементы ---
    const views = {
        loading: document.getElementById('loading-view'),
        noRoom: document.getElementById('no-room-view'),
        activeRoom: document.getElementById('active-room-view'),
        error: document.getElementById('error-view'),
    };
    const userInfoEl = document.getElementById('user-info');
    const createRoomBtn = document.getElementById('create-room-btn');
    const goToRoomBtn = document.getElementById('go-to-room-btn');
    const shareLinkBtn = document.getElementById('share-link-btn');
    const roomTimerEl = document.getElementById('room-timer');
    const errorMessageEl = document.getElementById('error-message');

    // --- Глобальное состояние ---
    let currentUser = null;
    let activeRoomData = null;
    let countdownInterval = null;
    let statusCheckInterval = null;

    // --- Функции ---

    function showView(viewName) {
        Object.values(views).forEach(view => view.classList.add('hidden'));
        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
        }
    }

    function formatTime(totalSeconds) {
        if (totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function startCountdown(expiryDateISO) {
        if (countdownInterval) clearInterval(countdownInterval);
        const expiryDate = new Date(expiryDateISO);

        const updateTimer = () => {
            const remainingSeconds = (expiryDate - new Date()) / 1000;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                roomTimerEl.textContent = "00:00:00";
                // Просто переключаем на вид "нет комнаты", т.к. она истекла
                updateUI(null);
            } else {
                roomTimerEl.textContent = formatTime(remainingSeconds);
            }
        };
        updateTimer();
        countdownInterval = setInterval(updateTimer, 1000);
    }

    function updateUI(roomData) {
        activeRoomData = roomData;
        if (countdownInterval) clearInterval(countdownInterval);

        if (roomData) {
            showView('activeRoom');
            startCountdown(roomData.expires_at);
        } else {
            showView('noRoom');
        }
    }

    async function createRoom() {
        showView('loading');
        console.log(`Requesting room creation for user ${currentUser.id}`);
        try {
            const response = await fetch('/api/room/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    first_name: currentUser.first_name,
                    last_name: currentUser.last_name,
                    username: currentUser.username
                })
            });

            if (response.ok) {
                const newRoomData = await response.json();
                console.log("Room created successfully:", newRoomData);
                updateUI(newRoomData);
            } else {
                const errorData = await response.json();
                throw new Error(`Server error: ${response.status} - ${errorData.detail}`);
            }
        } catch (error) {
            console.error("Failed to create room:", error);
            errorMessageEl.textContent = "Не удалось создать комнату. Попробуйте еще раз.";
            showView('error');
        }
    }

    /**
     * Основная функция инициализации приложения
     */
    function initializeApp() {
        tg.expand();

        const displayName = currentUser.first_name || currentUser.username || 'User';
        userInfoEl.textContent = `Пользователь: ${displayName} (ID: ${currentUser.id})`;

        createRoomBtn.addEventListener('click', createRoom);
        goToRoomBtn.addEventListener('click', () => {
            if (activeRoomData) {
                tg.openLink(`${window.location.origin}/call/${activeRoomData.room_id}`);
            }
        });
        shareLinkBtn.addEventListener('click', () => {
            if (activeRoomData) {
                tg.switchInlineQuery(activeRoomData.room_id);
            }
        });
    }

    // --- ЗАПУСК ПРИЛОЖЕНИЯ ---

    tg.ready();

    // Проверяем, есть ли вообще initData. Если нет, приложение открыто не через Telegram.
    if (!tg.initData) {
        console.error("Telegram initData is missing. App was likely opened outside of Telegram.");
        errorMessageEl.textContent = "Не удалось получить данные пользователя. Пожалуйста, откройте приложение через бота в Telegram.";
        showView('error');
        return;
    }

    // Отправляем initData на бэкенд для валидации и получения состояния
    fetch('/api/auth/validate_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Validation failed with status: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Server validation successful. Data received:", data);
        currentUser = data.user;
        initializeApp();
        updateUI(data.room);
    })
    .catch(error => {
        console.error("Initialization failed:", error);
        errorMessageEl.textContent = "Ошибка аутентификации. Попробуйте перезапустить приложение из бота.";
        showView('error');
    });
});