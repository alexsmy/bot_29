document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;

    const userGreetingEl = document.getElementById('user-greeting');
    const loadingScreen = document.getElementById('loading-screen');
    const homeScreen = document.getElementById('home-screen');
    const roomActiveScreen = document.getElementById('room-active-screen');
    const activeRoomIdEl = document.getElementById('active-room-id');

    function showScreen(screenElement) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screenElement.classList.add('active');
    }

    async function fetchUserState() {
        try {
            console.log('Fetching user state from server...');
            const response = await fetch('/api/user/state', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ init_data: tg.initData }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Received user state:', data);

            if (data.has_active_room) {
                activeRoomIdEl.textContent = data.room_id.substring(0, 8) + '...';
                showScreen(roomActiveScreen);
            } else {
                showScreen(homeScreen);
            }

        } catch (error) {
            console.error('Failed to fetch user state:', error);
            tg.showAlert('Не удалось загрузить данные. Попробуйте позже.');
            loadingScreen.innerHTML = '<p>Ошибка загрузки</p>';
        }
    }

    function initializeApp() {
        tg.ready();
        tg.expand();

        const user = tg.initDataUnsafe.user;
        if (user) {
            const displayName = user.first_name || user.username || `User ID: ${user.id}`;
            userGreetingEl.textContent = `👋 Привет, ${displayName}!`;
        } else {
            userGreetingEl.textContent = '👋 Привет!';
        }
        
        showScreen(loadingScreen);
        fetchUserState();
    }

    initializeApp();
});