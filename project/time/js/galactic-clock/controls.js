(function (app) {
  function bindZoomControl() {
    const zoomSlider = app.elements.zoomSlider;

    zoomSlider.addEventListener('mousedown', () => {
      app.sliderActive = true;
    });

    zoomSlider.addEventListener('mouseup', () => {
      app.sliderActive = false;
    });

    zoomSlider.addEventListener('touchstart', () => {
      app.sliderActive = true;
    });

    zoomSlider.addEventListener('touchend', () => {
      app.sliderActive = false;
    });

    zoomSlider.addEventListener('input', () => {
      const distance = parseFloat(zoomSlider.value);
      const direction = new THREE.Vector3().subVectors(app.camera.position, app.controls.target).normalize();
      app.camera.position.copy(direction.multiplyScalar(distance).add(app.controls.target));
      app.controls.update();
    });
  }

  function bindParticleControls() {
    app.elements.particleSize.addEventListener('input', () => {
      if (app.particlesMaterial) {
        app.particlesMaterial.size = parseFloat(app.elements.particleSize.value);
      }
    });

    app.elements.particleCount.addEventListener('input', () => {
      app.particleSystem.createParticles(parseInt(app.elements.particleCount.value, 10));
    });

    app.elements.particleColor.addEventListener('input', () => {
      if (app.particlesMaterial) {
        app.particlesMaterial.color.set(app.elements.particleColor.value);
      }
    });

    app.elements.glowIntensity.addEventListener('input', () => {
      app.bloomPass.strength = parseFloat(app.elements.glowIntensity.value);
    });
  }

  function copyHandAccentColors(hand) {
    if (hand.children[2]) hand.children[2].material.color.copy(hand.children[0].material.color);
    if (hand.children[1]) hand.children[1].material.color.copy(hand.children[0].material.color).multiplyScalar(1.2);
  }

  function applyClockTheme(theme) {
    switch (theme) {
      case 'classic':
        app.clockFaceMaterial.map = new THREE.CanvasTexture(app.textures.createClockFaceTexture());
        app.hands.hour.children[0].material.color.set(0xffaa00);
        app.hands.minute.children[0].material.color.set(0x33ccff);
        app.hands.second.children[0].material.color.set(0xff3366);
        app.sphereMaterial.color.set(0x223344);
        break;
      case 'neon':
        app.clockFaceMaterial.map = new THREE.CanvasTexture(app.textures.createNeonClockFace());
        app.hands.hour.children[0].material.color.set(0xff00ff);
        app.hands.minute.children[0].material.color.set(0x00ffff);
        app.hands.second.children[0].material.color.set(0xffff00);
        app.sphereMaterial.color.set(0x000022);
        break;
      case 'galaxy':
        app.clockFaceMaterial.map = new THREE.CanvasTexture(app.textures.createGalaxyClockFace());
        app.hands.hour.children[0].material.color.set(0xff6600);
        app.hands.minute.children[0].material.color.set(0x4488ff);
        app.hands.second.children[0].material.color.set(0xff0066);
        app.sphereMaterial.color.set(0x110022);
        break;
      case 'minimal':
        app.clockFaceMaterial.map = new THREE.CanvasTexture(app.textures.createMinimalClockFace());
        app.hands.hour.children[0].material.color.set(0xffffff);
        app.hands.minute.children[0].material.color.set(0xffffff);
        app.hands.second.children[0].material.color.set(0xff4444);
        app.sphereMaterial.color.set(0x111111);
        break;
      default:
        return;
    }

    copyHandAccentColors(app.hands.hour);
    copyHandAccentColors(app.hands.minute);
    copyHandAccentColors(app.hands.second);
  }

  function bindSceneControls() {
    app.elements.autoRotate.addEventListener('change', () => {
      app.controls.autoRotate = app.elements.autoRotate.checked;
    });

    app.elements.clockTheme.addEventListener('change', () => {
      applyClockTheme(app.elements.clockTheme.value);
    });
  }

  function bindControls() {
    bindZoomControl();
    bindParticleControls();
    bindSceneControls();
  }

  app.controlPanel = {
    bindControls,
    applyClockTheme
  };
})(window.GalacticClock);
