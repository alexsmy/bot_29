document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;

    const screens = {
        loading: document.getElementById('loading-screen'),
        home: document.getElementById('home-screen'),
        activeRoom: document.getElementById('active-room-screen'),
        error: document.getElementById('error-screen'),
    };

    const welcomeMessage = document.getElementById('welcome-message');
    const activeRoomTimer = document.getElementById('active-room-timer');
    const errorMessage = document.getElementById('error-message');
    
    const createRoomBtn = document.getElementById('create-room-btn');
    const goToRoomBtn = document.getElementById('go-to-room-btn');
    const shareRoomBtn = document.getElementById('share-room-btn');

    const instructionsModal = document.getElementById('instructions-modal');
    const faqModal = document.getElementById('faq-modal');
    
    let activeRoomState = {
        roomId: null,
        timerInterval: null
    };

    function showScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        if (screens[screenName]) {
            screens[screenName].classList.add('active');
        }
    }

    function formatRemainingTime(seconds) {
        if (seconds <= 0) return '00:00:00';
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = Math.floor(seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    }

    function startTimer(duration) {
        if (activeRoomState.timerInterval) {
            clearInterval(activeRoomState.timerInterval);
        }
        let remaining = duration;
        activeRoomTimer.textContent = formatRemainingTime(remaining);

        activeRoomState.timerInterval = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(activeRoomState.timerInterval);
                fetchUserState();
            }
            activeRoomTimer.textContent = formatRemainingTime(remaining);
        }, 1000);
    }

    function updateUI(state) {
        if (state.has_active_room) {
            activeRoomState.roomId = state.room_id;
            startTimer(state.remaining_seconds);
            showScreen('activeRoom');
        } else {
            if (activeRoomState.timerInterval) {
                clearInterval(activeRoomState.timerInterval);
            }
            activeRoomState.roomId = null;
            showScreen('home');
        }
    }

    async function fetchUserState() {
        console.log('Fetching user state...');
        showScreen('loading');

        if (!tg.initData) {
            console.error('Validation Error: Telegram initData is missing.');
            errorMessage.textContent = 'Ошибка: данные Telegram недоступны. Пожалуйста, убедитесь, что вы открыли приложение внутри Telegram.';
            showScreen('error');
            return;
        }
        
        const params = new URLSearchParams(tg.initData);
        if (!params.has('hash')) {
            console.error('Validation Error: Hash is missing in initData. App might be opened outside of Telegram.');
            errorMessage.textContent = 'Ошибка аутентификации. Пожалуйста, запускайте приложение только из клиента Telegram.';
            showScreen('error');
            return;
        }

        try {
            const response = await fetch('/api/user/state', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: tg.initData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData.detail || response.statusText}`);
            }

            const state = await response.json();
            console.log('Received state:', state);
            updateUI(state);

        } catch (error) {
            console.error('Failed to fetch user state:', error);
            errorMessage.textContent = `Не удалось загрузить данные: ${error.message}. Пожалуйста, попробуйте перезапустить приложение.`;
            showScreen('error');
        }
    }

    function setupEventListeners() {
        const allInstructionBtns = document.querySelectorAll('#show-instructions-btn, #show-instructions-btn-active');
        const allFaqBtns = document.querySelectorAll('#show-faq-btn, #show-faq-btn-active');
        const allCloseBtns = document.querySelectorAll('.close-modal-btn');

        allInstructionBtns.forEach(btn => btn.addEventListener('click', () => instructionsModal.classList.add('active')));
        allFaqBtns.forEach(btn => btn.addEventListener('click', () => faqModal.classList.add('active')));
        allCloseBtns.forEach(btn => btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('active');
        }));
        
        createRoomBtn.addEventListener('click', () => {
            console.log('"Create Room" button clicked. (Functionality to be added in next step)');
            tg.HapticFeedback.impactOccurred('light');
        });
        
        goToRoomBtn.addEventListener('click', () => {
            console.log(`"Go to Room" button clicked for room: ${activeRoomState.roomId}. (Functionality to be added in next step)`);
            tg.HapticFeedback.impactOccurred('light');
        });
        
        shareRoomBtn.addEventListener('click', () => {
            console.log(`"Share" button clicked for room: ${activeRoomState.roomId}. (Functionality to be added in next step)`);
            tg.HapticFeedback.notificationOccurred('success');
        });
    }

    function init() {
        tg.ready();
        tg.expand();
        
        const user = tg.initDataUnsafe.user;
        if (user && user.first_name) {
            welcomeMessage.textContent = `Добро пожаловать, ${user.first_name}!`;
        }
        
        console.log('Mini App Initialized');
        console.log('User:', user);

        setupEventListeners();
        fetchUserState();
        
        setInterval(fetchUserState, 5 * 60 * 1000);
    }

    init();
});