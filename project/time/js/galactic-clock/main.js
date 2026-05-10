(function (app) {
  function boot() {
    app.dom.cacheElements();
    app.sceneFactory.initScene();
    app.controlPanel.bindControls();
    app.particleSystem.createParticles();
    app.animation.bindResize();
    window.addEventListener('load', app.dom.hideLoadingScreen);
    app.animation.animate();
  }

  boot();
})(window.GalacticClock);
