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
                checkRoomStatus();
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

    async function checkRoomStatus() {
        if (!currentUser) {
            console.error("User data not available for status check.");
            return;
        }
        console.log(`Checking room status for user ${currentUser.id}`);

        try {
            const response = await fetch('/api/room/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });

            if (response.ok) {
                const roomData = await response.json();
                console.log("Active room found:", roomData);
                updateUI(roomData);
            } else if (response.status === 404) {
                console.log("No active room found for user.");
                updateUI(null);
            } else {
                const errorData = await response.json();
                throw new Error(`Server error: ${response.status} - ${errorData.detail}`);
            }
        } catch (error) {
            console.error("Failed to check room status:", error);
            errorMessageEl.textContent = "Не удалось проверить статус комнаты. Проверьте интернет-соединение.";
            showView('error');
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

        // Отображаем информацию о пользователе
        const displayName = currentUser.first_name || currentUser.username || 'User';
        userInfoEl.textContent = `Пользователь: ${displayName} (ID: ${currentUser.id})`;

        // Привязываем события к кнопкам
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

        // Запускаем проверку статуса и периодические обновления
        checkRoomStatus();
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        statusCheckInterval = setInterval(checkRoomStatus, 15000);
    }

    // --- ЗАПУСК ПРИЛОЖЕНИЯ ---

    // ИСПОЛЬЗУЕМ tg.ready() ДЛЯ ГАРАНТИРОВАННОЙ ИНИЦИАЛИЗАЦИИ
    tg.ready();

    // Пытаемся получить данные пользователя.
    // tg.ready() гарантирует, что объект tg существует, но не гарантирует, что initDataUnsafe.user уже заполнен.
    // Поэтому добавляем небольшую задержку и проверку.
    let attempts = 0;
    const maxAttempts = 10;

    function tryToGetUser() {
        attempts++;
        if (tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
            currentUser = tg.initDataUnsafe.user;
            console.log("Successfully got user data:", currentUser);
            initializeApp();
        } else if (attempts < maxAttempts) {
            console.warn(`Attempt ${attempts}: User data not ready, retrying in 100ms...`);
            setTimeout(tryToGetUser, 100);
        } else {
            console.error("Failed to get user data after multiple attempts.");
            errorMessageEl.textContent = "Не удалось получить данные пользователя Telegram. Пожалуйста, откройте приложение через бота.";
            showView('error');
        }
    }

    tryToGetUser();
});