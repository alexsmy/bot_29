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
        return `<span class="call-status-icon ${glowClass}" title="Активный видеозвонок">${ICONS.videoCall}</span>`;
    }
    if (callType === 'audio') {
        return `<span class="call-status-icon ${glowClass}" title="Активный аудиозвонок">${ICONS.audioCall}</span>`;
    }

    return '';
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
        container.innerHTML = list.map(room => {
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
            <div class="room-item">
                <div class="room-info">
                    <div class="room-id-line">
                        <code>${room.room_id}</code>
                        ${creatorBadge}
                        ${getCallStatusIcon(room.call_status, room.call_type)}
                    </div>
                    <div class="meta">
                        <span class="meta-item">
                            <span class="icon icon-time">${ICONS.hourglass}</span>
                            ${formatRemainingTime(room.remaining_seconds)}
                        </span>
                        <span class="meta-item participants-icons ${participantsClass}">
                            ${participantsIcons}
                        </span>
                    </div>
                </div>
                <button class="action-btn close-room-btn" data-room-id="${room.room_id}">Закрыть</button>
            </div>
        `}).join('');
    };
    renderList(adminRoomsContainer, adminRooms);
    renderList(userRoomsContainer, userRooms);
}

export async function loadActiveRooms() {
    const rooms = await fetchData('active_rooms');
    if (rooms) {
        allRoomsData = rooms;
        renderRooms();
    }
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
                const result = await fetchData(`room/${roomId}`, { method: 'DELETE' });
                if (result) {
                    loadActiveRooms();
                }
            }
        }
    });

    loadActiveRooms();
}