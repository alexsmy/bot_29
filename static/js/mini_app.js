document.addEventListener('DOMContentLoaded', function() {
    console.log("[INIT] DOMContentLoaded event fired.");

    // Проверяем, доступен ли объект Telegram
    if (typeof Telegram === 'undefined' || typeof Telegram.WebApp === 'undefined') {
        console.error("[INIT] CRITICAL: Telegram.WebApp object not found. App cannot run outside of Telegram environment.");
        document.body.innerHTML = '<h1>Ошибка</h1><p>Это приложение может быть запущено только внутри Telegram.</p>';
        return;
    }

    const tg = window.Telegram.WebApp;
    console.log("[INIT] Telegram WebApp object found:", tg);

    // --- DOM элементы ---
    const views = {
        loading: document.getElementById('loading-view'),
        noRoom: document.getElementById('no-room-view'),
        activeRoom: document.getElementById('active-room-view'),
        error: document.getElementById('error-view'),
    };
    const createRoomBtn = document.getElementById('create-room-btn');
    const goToRoomBtn = document.getElementById('go-to-room-btn');
    const shareLinkBtn = document.getElementById('share-link-btn');
    const roomTimerEl = document.getElementById('room-timer');
    const errorMessageEl = document.getElementById('error-message');
    const userInfoEl = document.getElementById('user-info');

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
            console.error("[API] User data not available for status check.");
            return;
        }
        console.log(`[API] Отправка запроса статуса для пользователя:`, currentUser);

        try {
            const response = await fetch('/api/room/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUser.id,
                    first_name: currentUser.first_name,
                    username: currentUser.username
                })
            });

            if (response.ok) {
                const roomData = await response.json();
                console.log("[API] Ответ: Найдена активная комната:", roomData);
                updateUI(roomData);
            } else if (response.status === 404) {
                console.log("[API] Ответ: Активная комната не найдена.");
                updateUI(null);
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error("[API] Ошибка при проверке статуса комнаты:", error);
            errorMessageEl.textContent = "Не удалось проверить статус комнаты. Проверьте интернет-соединение.";
            showView('error');
        }
    }

    async function createRoom() {
        showView('loading');
        console.log(`[API] Отправка запроса на создание комнаты для пользователя:`, currentUser);
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
                console.log("[API] Ответ: Комната успешно создана:", newRoomData);
                updateUI(newRoomData);
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error("[API] Ошибка при создании комнаты:", error);
            errorMessageEl.textContent = "Не удалось создать комнату. Попробуйте еще раз.";
            showView('error');
        }
    }

    // --- Инициализация ---
    // Вся логика теперь внутри tg.ready()
    tg.ready(() => {
        console.log("[INIT] tg.ready() called. Telegram WebApp is initialized.");
        tg.expand();

        currentUser = tg.initDataUnsafe.user;
        console.log("[INIT] Raw initData:", tg.initData);
        console.log("[INIT] Parsed initDataUnsafe:", tg.initDataUnsafe);

        if (!currentUser || !currentUser.id) {
            console.error("[INIT] CRITICAL: Не удалось получить данные пользователя из Telegram. initDataUnsafe.user is empty.");
            errorMessageEl.textContent = "Не удалось получить данные пользователя Telegram. Пожалуйста, откройте приложение через бота.";
            userInfoEl.textContent = "Пользователь: Не определен";
            showView('error');
            return;
        }

        const displayName = currentUser.first_name + (currentUser.last_name ? ` ${currentUser.last_name}` : '');
        userInfoEl.textContent = `Пользователь: ${displayName} (ID: ${currentUser.id})`;
        console.log("[INIT] Приложение инициализировано для пользователя:", currentUser);

        createRoomBtn.addEventListener('click', createRoom);
        goToRoomBtn.addEventListener('click', () => {
            if (activeRoomData) {
                console.log(`Переход в комнату: ${activeRoomData.room_id}`);
                tg.openLink(`${window.location.origin}/call/${activeRoomData.room_id}`);
            }
        });
        shareLinkBtn.addEventListener('click', () => {
            if (activeRoomData) {
                console.log(`Поделиться комнатой: ${activeRoomData.room_id}`);
                tg.switchInlineQuery(activeRoomData.room_id);
            }
        });

        checkRoomStatus();
        if (statusCheckInterval) clearInterval(statusCheckInterval);
        statusCheckInterval = setInterval(checkRoomStatus, 15000);
    });
});