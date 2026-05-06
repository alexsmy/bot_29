const canVibrate = window.navigator && window.navigator.vibrate;

export const Haptics = {

    light: () => {
        if (canVibrate) window.navigator.vibrate(10);
    },

    medium: () => {
        if (canVibrate) window.navigator.vibrate(40);
    },

    heavy: () => {
        if (canVibrate) window.navigator.vibrate([50, 30, 50]);
    },

    success: () => {
        if (canVibrate) window.navigator.vibrate([30, 50, 30]);
    }
};


export function createRipple(event, element) {
    const circle = document.createElement("span");
    const diameter = Math.max(element.clientWidth, element.clientHeight);
    const radius = diameter / 2;


    const rect = element.getBoundingClientRect();


    let clientX = event.clientX;
    let clientY = event.clientY;

    if (event.touches && event.touches.length > 0) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    }

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${clientX - rect.left - radius}px`;
    circle.style.top = `${clientY - rect.top - radius}px`;
    circle.classList.add("ripple");


    const oldRipple = element.getElementsByClassName("ripple")[0];
    if (oldRipple) {
        oldRipple.remove();
    }

    element.appendChild(circle);


    setTimeout(() => {
        circle.remove();
    }, 800);
}


export function initInteractions() {


    document.addEventListener('click', (e) => {

        const target = e.target.closest('button, .radio-menu-item, .control-btn, .glass-button');

        if (target) {

            if (!target.hasAttribute('data-no-haptic')) {

                if (target.classList.contains('main-btn')) {
                    Haptics.medium();
                } else if (target.classList.contains('del-btn')) {
                    Haptics.heavy();
                } else {
                    Haptics.light();
                }
            }


            createRipple(e, target);
        }
    });


    document.addEventListener('mousedown', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) target.classList.add('btn-pressed');
    });

    document.addEventListener('mouseup', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) setTimeout(() => target.classList.remove('btn-pressed'), 200);
    });


    document.addEventListener('touchstart', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) target.classList.add('btn-pressed');
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        const target = e.target.closest('button, .radio-menu-item, .control-btn');
        if (target) setTimeout(() => target.classList.remove('btn-pressed'), 200);
    });
}
