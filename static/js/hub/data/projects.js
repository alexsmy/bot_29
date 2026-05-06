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
        id: 'radio',
        title: 'Vibe Radio',
        description: 'Выбор между несколькими версиями радио-приложения. Сюда позже можно добавлять новые сборки и интерфейсы.',
        actionText: 'Выбрать версию',
        theme: themes.purple,
        iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-2 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>`,
        selectorTitle: 'Выберите версию Vibe Radio',
        selectorDescription: 'Модульная карточка-меню. Новые версии радио-приложений можно добавлять сюда без изменения главной сетки хаба.',
        variants: [
            {
                id: 'radio-18',
                title: 'Vibe Radio 18',
                description: 'Текущая модульная версия с эквалайзером, поиском и улучшенным аудиографом для iPhone.',
                url: '/project/radio/radio_18.html',
                actionText: 'Открыть Vibe Radio 18',
                badge: 'Рекомендуемая',
                theme: themes.purple,
                iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-2 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>`
            },
            {
                id: 'radio-online-3',
                title: 'Online Radio 3',
                description: 'Предыдущий однофайловый вариант. Полезен для сравнения поведения и старого сценария запуска.',
                url: '/project/radio/radio_online_3.html',
                actionText: 'Открыть Online 3',
                badge: 'Legacy',
                theme: themes.cyan,
                iconSvg: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-2 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"></path>`
            }
        ]
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
