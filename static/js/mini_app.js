
document.addEventListener('DOMContentLoaded', function() {
    const tg = window.Telegram.WebApp;

    tg.ready();

    tg.expand();

    console.log('Mini App script loaded.');
    console.log('Telegram WebApp object:', tg);
    console.log('InitData:', tg.initData);
    console.log('User:', tg.initDataUnsafe.user);
});