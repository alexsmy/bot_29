// static/js/welcome.js

document.addEventListener('DOMContentLoaded', () => {
    
    // Плавное появление элементов при прокрутке
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Отключаем наблюдение после того, как элемент стал видимым, для оптимизации
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1 // Элемент считается видимым, когда 10% его площади в зоне видимости
    });

    const elementsToFadeIn = document.querySelectorAll('.fade-in');
    elementsToFadeIn.forEach(el => observer.observe(el));

});