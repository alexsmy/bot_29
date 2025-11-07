// static/js/admin_ui.js

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

export function navigateToTab(targetId) {
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');

    navLinks.forEach(link => {
        const isActive = link.getAttribute('href') === `#${targetId}`;
        link.classList.toggle('active', isActive);
    });

    contentSections.forEach(section => {
        section.classList.toggle('active', section.id === targetId);
    });
    
    window.scrollTo(0, 0);
}

function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);
            navigateToTab(targetId);
            
            if (window.innerWidth <= 768) {
                closeMobileMenu();
            }
        });
    });
}

let sidebar, sidebarOverlay;

function openMobileMenu() {
    sidebar.classList.add('is-open');
    sidebarOverlay.classList.add('is-visible');
}

function closeMobileMenu() {
    sidebar.classList.remove('is-open');
    sidebarOverlay.classList.remove('is-visible');
}

function setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    sidebar = document.querySelector('.sidebar');
    sidebarOverlay = document.getElementById('sidebar-overlay');

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
    const expiryDate = new Date(tokenExpiresAtIso);

    const updateTokenTimer = () => {
        const remainingSeconds = Math.floor((expiryDate - new Date()) / 1000);
        
        if (remainingSeconds <= 0) {
            tokenTimerEl.textContent = 'Истёк!';
            tokenTimerEl.style.color = 'var(--danger-action)';
            clearInterval(tokenInterval);
            // Можно добавить автоматическую перезагрузку страницы
            // setTimeout(() => window.location.reload(), 2000);
            return;
        }
        // Отображаем только минуты и секунды
        tokenTimerEl.textContent = formatRemainingTime(remainingSeconds).substring(3);
    };
    
    updateTokenTimer(); // Первый вызов, чтобы не ждать секунду
    const tokenInterval = setInterval(updateTokenTimer, 1000);
}

export function initUi(tokenExpiresAtIso) {
    populateIcons();
    setupThemeToggle();
    setupNavigation();
    setupMobileMenu();
    setupTokenTimer(tokenExpiresAtIso);
}