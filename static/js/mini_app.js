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
    const userGreetingEls = document.querySelectorAll('.user-greeting');
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

    /**
     * Показывает один из экранов и скрывает остальные
     * @param {string} viewName - Ключ из объекта `views`
     */
    function showView(viewName) {
        Object.values(views).forEach(view => view.classList.add('hidden'));
        if (views[viewName]) {
            views[viewName].classList.remove('hidden');
        }
    }

    /**
     * Форматирует оставшиеся секунды в строку HH:MM:SS
     * @param {number} totalSeconds 
     * @returns {string}
     */
    function formatTime(totalSeconds) {
        if (totalSeconds < 0) totalSeconds = 0;
        const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    /**
     * Запускает таймер обратного отсчета
     * @param {string} expiryDateISO - Дата истечения в формате ISO
     */
    function startCountdown(expiryDateISO) {
        if (countdownInterval) clearInterval(countdownInterval);

        const expiryDate = new Date(expiryDateISO);

        const updateTimer = () => {
            const remainingSeconds = (expiryDate - new Date()) / 1000;
            if (remainingSeconds <= 0) {
                clearInterval(countdownInterval);
                roomTimerEl.textContent = "00:00:00";
                console.log("Countdown finished. Checking room status again.");
                checkRoomStatus(); 
            } else {
                roomTimerEl.textContent = formatTime(remainingSeconds);
            }
        };
        
        updateTimer(); // Вызываем сразу, чтобы не было задержки в 1 секунду
        countdownInterval = setInterval(updateTimer, 1000);
    }

    /**
     * Обновляет UI на основе данных о комнате
     * @param {object|null} roomData 
     */
    function updateUI(roomData) {
        activeRoomData = roomData;
        if (countdownInterval) clearInterval(countdownInterval);

        // Обновляем информацию о пользователе в UI
        const userName = currentUser.first_name || currentUser.username || 'Пользователь';
        userInfoEl.textContent = `User: ${userName} (ID: ${currentUser.id})`;
        userGreetingEls.forEach(el => {
            el.textContent = `Привет, ${userName}!`;
        });

        if (roomData) {
            showView('activeRoom');
            startCountdown(roomData.expires_at);
        } else {
            showView('noRoom');
        }
    }

    /**
     * Проверяет статус комнаты на сервере
     */
    async function checkRoomStatus() {
        if (!currentUser) {
            console.error("User data not available for status check.");
            return;
        }
        
        const payload = {
            user_id: currentUser.id,
            first_name: currentUser.first_name,
            username: currentUser.username
        };
        console.log('API Call: /api/room/status. Payload:', payload);

        try {
            const response = await fetch('/api/room/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const roomData = await response.json();
                console.log("API Response: Active room found:", roomData);
                updateUI(roomData);
            } else if (response.status === 404) {
                console.log("API Response: No active room found for user.");
                updateUI(null);
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error("Failed to check room status:", error);
            errorMessageEl.textContent = "Не удалось проверить статус комнаты. Проверьте интернет-соединение.";
            showView('error');
        }
    }

    /**
     * Создает новую комнату
     */
    async function createRoom() {
        showView('loading');
        const payload = {
            user_id: currentUser.id,
            first_name: currentUser.first_name,
            last_name: currentUser.last_name,
            username: currentUser.username
        };
        console.log('API Call: /api/room/create. Payload:', payload);

        try {
            const response = await fetch('/api/room/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const newRoomData = await response.json();
                console.log("API Response: Room created successfully:", newRoomData);
                updateUI(newRoomData);
            } else {
                throw new Error(`Server error: ${response.status}`);
            }
        } catch (error) {
            console.error("Failed to create room:", error);
            errorMessageEl.textContent = "Не удалось создать комнату. Попробуйте еще раз.";
            showView('error');
        }
    }

    // --- Инициализация ---

    tg.ready();
    tg.expand();

    currentUser = tg.initDataUnsafe.user;

    if (!currentUser || !currentUser.id) {
        console.error("CRITICAL: Could not get user data from Telegram. App cannot start.");
        errorMessageEl.textContent = "Не удалось получить данные пользователя Telegram. Пожалуйста, откройте приложение через бота.";
        showView('error');
        return;
    }
    
    console.log('TMA Init: User data received', currentUser);

    // --- Привязка событий ---
    createRoomBtn.addEventListener('click', createRoom);

    goToRoomBtn.addEventListener('click', () => {
        if (activeRoomData) {
            const roomUrl = `${window.location.origin}/call/${activeRoomData.room_id}`;
            console.log(`Opening link: ${roomUrl}`);
            tg.openLink(roomUrl);
        }
    });

    shareLinkBtn.addEventListener('click', () => {
        if (activeRoomData) {
            console.log(`Switching to inline query with room_id: ${activeRoomData.room_id}`);
            tg.switchInlineQuery(activeRoomData.room_id);
        }
    });

    // --- Запуск ---
    checkRoomStatus();
    if (statusCheckInterval) clearInterval(statusCheckInterval);
    statusCheckInterval = setInterval(checkRoomStatus, 15000);
});