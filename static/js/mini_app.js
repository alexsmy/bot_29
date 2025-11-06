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
                updateUI(null); // Комната истекла, показываем экран создания
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

    // 1. Ждем, пока Telegram Web App API будет готово.
    tg.ready();

    // 2. Проверяем наличие initData. Если его нет, значит, приложение открыто не из Telegram.
    if (!tg.initData) {
        console.error("CRITICAL: Telegram.WebApp.initData is missing. App cannot be initialized.");
        errorMessageEl.textContent = "Не удалось получить данные пользователя Telegram. Пожалуйста, откройте приложение через бота.";
        showView('error');
        return;
    }

    console.log("initData is present, sending to backend for validation...");

    // 3. Отправляем initData на бэкенд для валидации и получения начального состояния.
    fetch('/api/auth/validate_user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: tg.initData })
    })
    .then(response => {
        if (!response.ok) {
            // Если бэкенд отверг данные, это критическая ошибка.
            return response.json().then(err => {
                throw new Error(`Validation failed: ${err.detail || response.statusText}`);
            });
        }
        return response.json();
    })
    .then(data => {
        // 4. Если валидация прошла успешно, мы получили доверенные данные.
        console.log("Server validation successful. Data received:", data);
        currentUser = data.user;
        
        // 5. Инициализируем приложение и отображаем интерфейс.
        initializeApp();
        updateUI(data.room);
    })
    .catch(error => {
        // 6. Если на любом этапе произошла ошибка, показываем экран ошибки.
        console.error("Initialization failed:", error);
        errorMessageEl.textContent = "Ошибка аутентификации. Попробуйте перезапустить приложение из бота.";
        showView('error');
    });
});