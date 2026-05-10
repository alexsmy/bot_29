(function (app) {
  function createParticles(count = 700) {
    if (app.particles) {
      app.scene.remove(app.particles);
      app.particlesGeometry.dispose();
      app.particlesMaterial.dispose();
    }

    app.particlesGeometry = new THREE.BufferGeometry();
    const positions = [];
    const velocities = [];
    const sizes = [];

    for (let i = 0; i < count; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      const radius = 30 + (Math.random() * 2 - 1);
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      positions.push(x, y, z);
      velocities.push((Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.05);
      sizes.push(0.3 + Math.random() * 1.5);
    }

    app.particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    app.particlesGeometry.setAttribute('velocity', new THREE.Float32BufferAttribute(velocities, 3));
    app.particlesGeometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    const particleTexture = new THREE.CanvasTexture(app.textures.createParticleTexture());
    app.particlesMaterial = new THREE.PointsMaterial({
      color: app.dom.getElementValue('particleColor'),
      size: parseFloat(app.dom.getElementValue('particleSize')),
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    app.particles = new THREE.Points(app.particlesGeometry, app.particlesMaterial);
    app.scene.add(app.particles);
  }

  function updateParticles() {
    if (!app.particles || !app.particlesGeometry) {
      return;
    }

    const positions = app.particlesGeometry.attributes.position.array;
    const velocities = app.particlesGeometry.attributes.velocity.array;
    const speedFactor = parseFloat(app.dom.getElementValue('particleSpeed')) * 0.5;

    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i] * speedFactor;
      positions[i + 1] += velocities[i + 1] * speedFactor;
      positions[i + 2] += velocities[i + 2] * speedFactor;

      const distance = Math.sqrt(
        positions[i] * positions[i] +
        positions[i + 1] * positions[i + 1] +
        positions[i + 2] * positions[i + 2]
      );

      if (distance < 29 || distance > 36) {
        const norm = 1 / distance;
        const newDistance = 30 + Math.random() * 2;
        positions[i] *= norm * newDistance;
        positions[i + 1] *= norm * newDistance;
        positions[i + 2] *= norm * newDistance;

        velocities[i] = (Math.random() - 0.5) * 0.05;
        velocities[i + 1] = (Math.random() - 0.5) * 0.05;
        velocities[i + 2] = (Math.random() - 0.5) * 0.05;
      }
    }

    app.particlesGeometry.attributes.position.needsUpdate = true;
  }

  app.particleSystem = {
    createParticles,
    updateParticles
  };
})(window.GalacticClock);
