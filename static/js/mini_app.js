document.addEventListener('DOMContentLoaded', function() {
    // Сначала получаем объект WebApp
    const tg = window.Telegram.WebApp;

    // А всю основную логику выполняем только когда Telegram сообщит, что все готово
    tg.ready(() => {
        // Элементы UI
        const loader = document.getElementById('loader');
        const noRoomState = document.getElementById('no-room-state');
        const activeRoomState = document.getElementById('active-room-state');
        const createRoomBtn = document.getElementById('create-room-btn');
        const goToRoomBtn = document.getElementById('go-to-room-btn');
        const shareRoomBtn = document.getElementById('share-room-btn');
        const roomTimerSpan = document.getElementById('room-timer');
        const userInfoSpan = document.getElementById('user-info');

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

            const updateTimer = () => {
                const now = new Date();
                const remaining = expiresAt - now;

                if (remaining <= 0) {
                    roomTimerSpan.textContent = '00:00:00';
                    clearInterval(countdownInterval);
                    fetchRoomStatus();
                    return;
                }

                const hours = Math.floor(remaining / (1000 * 60 * 60)).toString().padStart(2, '0');
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
                const seconds = Math.floor((remaining % (1000 * 60)) / 1000).toString().padStart(2, '0');
                
                roomTimerSpan.textContent = `${hours}:${minutes}:${seconds}`;
            };
            
            updateTimer(); // Вызываем сразу, чтобы не было задержки в 1 секунду
            countdownInterval = setInterval(updateTimer, 1000);
        }

        function updateUI(data) {
            if (data && data.room) {
                activeRoomId = data.room.room_id;
                showState('active-room');
                startCountdown(data.room.expires_at);
            } else {
                activeRoomId = null;
                if (countdownInterval) clearInterval(countdownInterval);
                showState('no-room');
            }
        }

        async function fetchRoomStatus() {
            if (!userId) {
                console.error("User ID not available.");
                userInfoSpan.textContent = "Ошибка: не удалось определить пользователя.";
                showState('no-room');
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
                userInfoSpan.textContent = "Ошибка: не удалось загрузить статус.";
            }
        }

        // --- Инициализация ---

        tg.expand();

        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            userId = tg.initDataUnsafe.user.id;
            const userFirstName = tg.initDataUnsafe.user.first_name;
            userInfoSpan.textContent = `Пользователь: ${userFirstName} (ID: ${userId})`;
            
            // Обработчики событий
            goToRoomBtn.addEventListener('click', () => {
                if (activeRoomId) {
                    tg.openLink(`${window.location.origin}/call/${activeRoomId}`);
                }
            });

            shareRoomBtn.addEventListener('click', () => {
                if (activeRoomId) {
                    tg.switchInlineQuery(activeRoomId);
                }
            });

            // Начинаем проверку статуса
            fetchRoomStatus();
            statusCheckInterval = setInterval(fetchRoomStatus, 15000);

        } else {
            console.warn("Telegram User ID not found. This app is intended to be run inside Telegram.");
            userInfoSpan.textContent = "Запустите приложение внутри Telegram";
            showState('no-room');
        }

        console.log('Mini App script loaded and initialized.');
    });
});