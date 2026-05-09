(function (app) {
  function updateZoomSlider() {
    if (!app.sliderActive) {
      const currentDistance = app.camera.position.distanceTo(app.controls.target);
      app.elements.zoomSlider.value = currentDistance;
    }
  }

  function updateClockHands() {
    const now = new Date();
    const seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    const minutes = now.getMinutes() + seconds / 60;
    const hours = (now.getHours() % 12) + minutes / 60;

    app.hands.second.rotation.z = -seconds * Math.PI / 30;
    app.hands.minute.rotation.z = -minutes * Math.PI / 30;
    app.hands.hour.rotation.z = -hours * Math.PI / 6;
  }

  function animate() {
    requestAnimationFrame(animate);

    app.controls.update();
    updateZoomSlider();
    app.particleSystem.updateParticles();

    app.ring.rotation.z += 0.001;
    app.stars.rotation.y += 0.0001;
    app.stars.rotation.z += 0.0002;

    updateClockHands();
    app.dom.updateDigitalTimeAndDate();
    app.composer.render();
  }

  function bindResize() {
    window.addEventListener('resize', () => {
      app.camera.aspect = window.innerWidth / window.innerHeight;
      app.camera.updateProjectionMatrix();
      app.renderer.setSize(window.innerWidth, window.innerHeight);
      app.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  app.animation = {
    animate,
    bindResize
  };
})(window.GalacticClock);
