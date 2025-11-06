document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const loader = document.getElementById('loader');
    const welcomeScreen = document.getElementById('welcome-screen');
    const roomCreatedScreen = document.getElementById('room-created-screen');
    const welcomeTitle = document.getElementById('welcome-title');
    const createRoomBtn = document.getElementById('create-room-btn');
    const enterRoomBtn = document.getElementById('enter-room-btn');
    const shareBtn = document.getElementById('share-btn');
    const modalContainer = document.getElementById('modal-container');
    const modalBody = document.getElementById('modal-body');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    let currentRoomId = null;

    const showScreen = (screenElement) => {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screenElement.classList.add('active');
    };

    const fetchWithInitData = async (url, options = {}) => {
        if (!tg.initData) {
            throw new Error("Telegram initData is not available.");
        }
        
        const body = {
            ...options.body,
            initData: tg.initData
        };

        const response = await fetch(url, {
            ...options,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    };

    const initializeApp = async () => {
        try {
            const data = await fetchWithInitData('/api/mini-app/user-status');
            welcomeTitle.textContent = `Привет, ${data.first_name}!`;

            if (data.active_room && data.active_room.room_id) {
                currentRoomId = data.active_room.room_id;
                showScreen(roomCreatedScreen);
            } else {
                showScreen(welcomeScreen);
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            tg.showAlert('Не удалось загрузить данные. Попробуйте перезапустить приложение.');
            loader.innerHTML = '<p>Ошибка загрузки</p>';
        }
    };

    const createRoom = async () => {
        createRoomBtn.disabled = true;
        createRoomBtn.textContent = 'Создание...';
        try {
            const data = await fetchWithInitData('/api/mini-app/create-room');
            currentRoomId = data.room_id;
            showScreen(roomCreatedScreen);
        } catch (error) {
            console.error('Room creation failed:', error);
            tg.showAlert('Не удалось создать комнату. Возможно, у вас уже есть активная комната.');
        } finally {
            createRoomBtn.disabled = false;
            createRoomBtn.textContent = 'Создать комнату для звонка';
        }
    };

    const enterRoom = () => {
        if (currentRoomId) {
            window.location.href = `/call/${currentRoomId}`;
        }
    };

    const shareRoom = () => {
        if (currentRoomId) {
            tg.switchInlineQuery(currentRoomId, []);
        }
    };

    const showModalWithContent = async (contentUrl) => {
        try {
            const response = await fetch(`/templates/${contentUrl}`);
            const htmlContent = await response.text();
            modalBody.innerHTML = htmlContent;
            modalContainer.classList.add('active');
        } catch (error) {
            console.error('Failed to load modal content:', error);
            tg.showAlert('Не удалось загрузить информацию.');
        }
    };

    const closeModal = () => {
        modalContainer.classList.remove('active');
    };

    createRoomBtn.addEventListener('click', createRoom);
    enterRoomBtn.addEventListener('click', enterRoom);
    shareBtn.addEventListener('click', shareRoom);
    
    document.getElementById('instructions-btn').addEventListener('click', () => showModalWithContent('instructions_bot.html'));
    document.getElementById('faq-btn').addEventListener('click', () => showModalWithContent('faq_bot.html'));
    document.getElementById('instructions-btn-2').addEventListener('click', () => showModalWithContent('instructions_bot.html'));
    document.getElementById('faq-btn-2').addEventListener('click', () => showModalWithContent('faq_bot.html'));

    modalCloseBtn.addEventListener('click', closeModal);
    modalContainer.querySelector('.modal-overlay').addEventListener('click', closeModal);

    initializeApp();
});