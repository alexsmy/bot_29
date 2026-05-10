(function (app) {
  function cacheElements() {
    app.elements.zoomSlider = document.getElementById('zoomSlider');
    app.elements.particleSpeed = document.getElementById('particleSpeed');
    app.elements.particleSize = document.getElementById('particleSize');
    app.elements.particleCount = document.getElementById('particleCount');
    app.elements.glowIntensity = document.getElementById('glowIntensity');
    app.elements.clockTheme = document.getElementById('clockTheme');
    app.elements.autoRotate = document.getElementById('autoRotate');
    app.elements.particleColor = document.getElementById('particleColor');
    app.elements.digitalTime = document.getElementById('digitalTime');
    app.elements.currentDate = document.getElementById('currentDate');
    app.elements.timezone = document.getElementById('timezone');
    app.elements.loadingScreen = document.getElementById('loadingScreen');
  }

  function getElementValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : 1;
  }

  function updateDigitalTimeAndDate() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const timezone = now.toLocaleTimeString('ru-RU', { timeZoneName: 'short' }).split(' ')[1];

    app.elements.digitalTime.textContent = `${hours}:${minutes}:${seconds}`;
    app.elements.currentDate.textContent = `${day}.${month}.${year}`;
    app.elements.timezone.textContent = timezone;
  }

  function hideLoadingScreen() {
    setTimeout(() => {
      app.elements.loadingScreen.style.opacity = '0';
      setTimeout(() => {
        app.elements.loadingScreen.style.display = 'none';
      }, 1000);
    }, 1000);
  }

  app.dom = {
    cacheElements,
    getElementValue,
    updateDigitalTimeAndDate,
    hideLoadingScreen
  };
})(window.GalacticClock);
