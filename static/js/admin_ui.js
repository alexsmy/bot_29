// static/js/admin_ui.js

// Этот модуль отвечает за общий интерфейс: навигация, тема, мобильное меню, таймер токена.

import { formatRemainingTime } from './admin_utils.js';

function populateIcons() {
    document.getElementById('sidebar-header-icon-placeholder').innerHTML = ICONS.gear;
    document.getElementById('mobile-menu-icon-placeholder').innerHTML = ICONS.menu;
    document.getElementById('icon-stats').innerHTML = ICONS.stats;
    document.getElementById('icon-rooms').innerHTML = ICONS.rooms;
    document.getElementById('icon-users').innerHTML = ICONS.users;
    document.getElementById('icon-connections').innerHTML = ICONS.connections;
    document.getElementById('icon-notifications').innerHTML = ICONS.notifications;
    document.getElementById('icon-reports').innerHTML = ICONS.reports;
    document.getElementById('icon-logs').innerHTML = ICONS.logs;
    document.getElementById('icon-danger').innerHTML = ICONS.danger;
}

function setupThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeIconPlaceholder = document.getElementById('theme-icon-placeholder');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.add(savedTheme);
    themeIconPlaceholder.innerHTML = savedTheme === 'dark' ? ICONS.sun : ICONS.moon;

    themeToggle.addEventListener('click', () => {
        const newTheme = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(newTheme);
        localStorage.setItem('theme', newTheme);
        themeIconPlaceholder.innerHTML = newTheme === 'dark' ? ICONS.sun : ICONS.moon;
    });
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            contentSections.forEach(section => {
                section.classList.toggle('active', section.id === targetId);
            });
            
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    const openMobileMenu = () => {
        sidebar.classList.add('is-open');
        sidebarOverlay.classList.add('is-visible');
    };

    const closeMobileMenu = () => {
        sidebar.classList.remove('is-open');
        sidebarOverlay.classList.remove('is-visible');
    };

    mobileMenuBtn.addEventListener('click', () => {
        if (sidebar.classList.contains('is-open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    });
    sidebarOverlay.addEventListener('click', closeMobileMenu);
}

function setupTokenTimer(tokenExpiresAtIso) {
    const tokenTimerEl = document.getElementById('token-timer');
    let tokenLifetime = Math.floor((new Date(tokenExpiresAtIso) - new Date()) / 1000);
    
    const updateTokenTimer = () => {
        tokenLifetime--;
        if (tokenLifetime <= 0) {
            tokenTimerEl.textContent = 'Истёк!';
            clearInterval(tokenInterval);
            return;
        }
        tokenTimerEl.textContent = formatRemainingTime(tokenLifetime).substring(3);
    };
    
    const tokenInterval = setInterval(updateTokenTimer, 1000);
}

export function initUi(tokenExpiresAtIso) {
    populateIcons();
    setupThemeToggle();
    setupNavigation();
    setupMobileMenu();
    setupTokenTimer(tokenExpiresAtIso);
}