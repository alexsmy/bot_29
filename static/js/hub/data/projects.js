import { themes } from '../utils/theme.js';

export const projects =[
    {
        id: 'keepalive',
        title: 'Автоподдержка (Keep-Alive)',
        description: 'Мониторинг доступности сервисов, статистика аптайма и автоматическое поддержание активности URL.',
        url: '/keepalive',
        actionText: 'Открыть статистику',
        theme: themes.blue,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>`,
        hasStatus: true
    },
    {
        id: 'filevault',
        title: 'Файловое хранилище',
        description: 'Загрузка HTML, изображений и других файлов на сервер, просмотр списка, удаление и быстрый доступ по ссылке.',
        url: '/files',
        actionText: 'Открыть загрузчик',
        theme: themes.emerald,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16.5A4.5 4.5 0 018.5 12H9a5 5 0 1110 0h.5a4.5 4.5 0 010 9H8.5A4.5 4.5 0 014 16.5zM12 12v6m-3-3h6"></path>`
    },
    {
        id: 'radio',
        title: 'Vibe Radio',
        description: 'Музыкальный плеер с эквалайзером, поиском станций и динамическим фоном. Слушай любимые волны.',
        url: '/radio',
        actionText: 'Слушать радио',
        theme: themes.purple,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>`
    },
    {
        id: 'crypto',
        title: 'Шифратор (Crypto)',
        description: 'Продвинутое AES-GCM шифрование текста и файлов. Генерация ключей, передача через QR и облако.',
        url: '/crpt',
        actionText: 'Зашифровать данные',
        theme: themes.emerald,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>`
    },
    {
        id: 'sbor',
        title: 'Сборщик кода (Sbor)',
        description: 'Умный инструмент для подготовки кодовой базы к анализу ИИ. Фильтрация, скрытие секретов и Repo Map.',
        url: '/sbor',
        actionText: 'Собрать проект',
        theme: themes.orange,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>`
    },
    {
        id: 'time',
        title: 'Галактические 3D Часы',
        description: 'Интерактивные трехмерные часы с космическими частицами, неоновой подсветкой и настраиваемыми темами.',
        url: '/time',
        actionText: 'Открыть часы',
        theme: themes.cyan,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>`
    }
];
