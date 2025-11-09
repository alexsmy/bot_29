// static/js/welcome.js

document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Плавное появление элементов при прокрутке
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });

    const elementsToFadeIn = document.querySelectorAll('.fade-in');
    elementsToFadeIn.forEach(el => observer.observe(el));

    // 2. Параллакс-эффект для фоновых фигур (только на десктопах)
    const shapes = document.querySelectorAll('.shape');
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;

    if (isDesktop) {
        window.addEventListener('scroll', () => {
            const scrollY = window.scrollY;
            shapes.forEach((shape, index) => {
                let speed = 0.1;
                if (index === 0) speed = 0.2;
                if (index === 1) speed = 0.15;
                
                const yPos = -scrollY * speed;
                shape.style.transform = `translateY(${yPos}px)`;
            });
        });
    }
});