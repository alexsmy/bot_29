import { fetchData } from './admin_api.js';
import { formatRemainingTime } from './admin_utils.js';

let allRoomsData = [];
let adminRoomsContainer, userRoomsContainer, adminRoomCountEl, userRoomCountEl, roomSearchInput;

function getCallStatusIcon(callStatus, callType) {
    if (callStatus !== 'active') {
        return '';
    }
    const glowClass = 'glowing';
    if (callType === 'video') {
        return `<span class="call-status-icon ${glowClass}" title="Активный видеозвонок"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z" /></svg></span>`;
    }
    if (callType === 'audio') {
        return `<span class="call-status-icon ${glowClass}" title="Активный аудиозвонок"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12,3A3,3 0 0,0 9,6V12A3,3 0 0,0 12,15A3,3 0 0,0 15,12V6A3,3 0 0,0 12,3M19,12V13A7,7 0 0,1 5,13V12H3V13A9,9 0 0,0 12,22A9,9 0 0,0 21,13V12H19Z" /></svg></span>`;
    }
    return '';
}

function createRoomHTML(room) {
    const creatorBadge = room.is_admin_room 
        ? `<span class="creator-badge admin">admin</span>`
        : `<span class="creator-badge user">${room.generated_by_user_id || 'N/A'}</span>`;
    
    let participantsIcons = '';
    let participantsClass = '';
    if (room.user_count === 1) {
        participantsIcons = `<span class="icon icon-person">${ICONS.person}</span>`;
    } else if (room.user_count >= 2) {
        participantsIcons = `<span class="icon icon-person">${ICONS.person}</span><span class="icon icon-person">${ICONS.person}</span>`;
        participantsClass = 'participants-online';
    }

    return `
    <div class="room-item" data-room-id="${room.room_id}">
        <div class="room-info">
            <div class="room-id-line">
                <code>${room.room_id}</code>
                ${creatorBadge}
                <span class="call-status-container">${getCallStatusIcon(room.call_status, room.call_type)}</span>
            </div>
            <div class="meta">
                <span class="meta-item time-container">
                    <span class="icon icon-time">${ICONS.hourglass}</span>
                    <span class="time-value">${formatRemainingTime(room.remaining_seconds)}</span>
                </span>
                <span class="meta-item participants-icons ${participantsClass}">
                    ${participantsIcons}
                </span>
            </div>
        </div>
        <button class="action-btn close-room-btn" data-room-id="${room.room_id}">Закрыть</button>
    </div>`;
}

function renderRooms() {
    const searchTerm = roomSearchInput.value.trim().toLowerCase();
    const filteredRooms = searchTerm 
        ? allRoomsData.filter(r => r.room_id.toLowerCase().includes(searchTerm))
        : allRoomsData;

    const adminRooms = filteredRooms.filter(r => r.is_admin_room);
    const userRooms = filteredRooms.filter(r => !r.is_admin_room);

    adminRoomCountEl.textContent = adminRooms.length;
    userRoomCountEl.textContent = userRooms.length;

    const renderList = (container, list) => {
        if (list.length === 0) {
            container.innerHTML = '<p class="empty-list">Активных комнат этого типа нет.</p>';
            return;
        }
        container.innerHTML = list.map(createRoomHTML).join('');
    };
    renderList(adminRoomsContainer, adminRooms);
}

export async function loadActiveRooms() {
    const rooms = await fetchData('active_rooms');
    if (rooms) {
        allRoomsData = rooms;
        renderRooms();
    }
}

export function handleRoomUpdate(data) {
    const roomItem = document.querySelector(`.room-item[data-room-id="${data.room_id}"]`);
    if (!roomItem) return;

    // Обновляем данные в нашем локальном кеше
    const roomData = allRoomsData.find(r => r.room_id === data.room_id);
    if (roomData) {
        Object.assign(roomData, data);
    }

    // Обновляем иконки участников
    if (data.user_count !== undefined) {
        const participantsContainer = roomItem.querySelector('.participants-icons');
        let participantsIcons = '';
        let participantsClass = '';
        if (data.user_count === 1) {
            participantsIcons = `<span class="icon icon-person">${ICONS.person}</span>`;
        } else if (data.user_count >= 2) {
            participantsIcons = `<span class="icon icon-person">${ICONS.person}</span><span class="icon icon-person">${ICONS.person}</span>`;
            participantsClass = 'participants-online';
        }
        participantsContainer.innerHTML = participantsIcons;
        participantsContainer.className = `meta-item participants-icons ${participantsClass}`;
    }

    // Обновляем статус звонка
    if (data.call_status !== undefined) {
        const callStatusContainer = roomItem.querySelector('.call-status-container');
        callStatusContainer.innerHTML = getCallStatusIcon(data.call_status, data.call_type);
    }
}

export function handleRoomAdded(roomData) {
    allRoomsData.unshift(roomData); // Добавляем в начало массива
    renderRooms(); // Перерисовываем, чтобы учесть фильтр и сортировку
}

export function handleRoomRemoved({ room_id }) {
    allRoomsData = allRoomsData.filter(r => r.room_id !== room_id);
    const roomItem = document.querySelector(`.room-item[data-room-id="${room_id}"]`);
    if (roomItem) {
        roomItem.style.transition = 'opacity 0.5s, transform 0.5s';
        roomItem.style.opacity = '0';
        roomItem.style.transform = 'translateX(-20px)';
        setTimeout(() => {
            roomItem.remove();
            renderRooms(); // Обновляем счетчики
        }, 500);
    }
}

function updateTimers() {
    allRoomsData.forEach(room => {
        if (room.remaining_seconds > 0) {
            room.remaining_seconds--;
            const roomItem = document.querySelector(`.room-item[data-room-id="${room.room_id}"] .time-value`);
            if (roomItem) {
                roomItem.textContent = formatRemainingTime(room.remaining_seconds);
            }
        }
    });
}

export function initRooms() {
    adminRoomsContainer = document.getElementById('admin-rooms-list');
    userRoomsContainer = document.getElementById('user-rooms-list');
    adminRoomCountEl = document.querySelector('details:nth-of-type(1) summary span');
    userRoomCountEl = document.querySelector('details:nth-of-type(2) summary span');
    roomSearchInput = document.getElementById('room-search');

    roomSearchInput.addEventListener('input', renderRooms);

    document.getElementById('rooms').addEventListener('click', async (e) => {
        if (e.target.classList.contains('close-room-btn')) {
            const roomId = e.target.dataset.roomId;
            if (confirm(`Вы уверены, что хотите принудительно закрыть комнату ${roomId}?`)) {
                await fetchData(`room/${roomId}`, { method: 'DELETE' });
                // Удаление произойдет через WebSocket событие
            }
        }
    });

    loadActiveRooms();
    setInterval(updateTimers, 1000);
}