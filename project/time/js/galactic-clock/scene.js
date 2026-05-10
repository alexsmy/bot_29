(function (app) {
  function createHand(length, width, color, tipLength = 0, tipColor = null) {
    const group = new THREE.Group();

    const handGeometry = new THREE.BoxGeometry(width, length * 0.8, width * 0.5);
    handGeometry.translate(0, length * 0.4, 0);
    const handMaterial = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.7,
      roughness: 0.3
    });
    const hand = new THREE.Mesh(handGeometry, handMaterial);
    group.add(hand);

    if (tipLength > 0) {
      const tipGeometry = new THREE.ConeGeometry(width * 1.2, tipLength, 8);
      tipGeometry.translate(0, length * 0.8 + tipLength * 0.5, 0);
      const tipMaterial = new THREE.MeshStandardMaterial({
        color: tipColor || color,
        metalness: 0.8,
        roughness: 0.2
      });
      const tip = new THREE.Mesh(tipGeometry, tipMaterial);
      group.add(tip);
    }

    const baseGeometry = new THREE.CylinderGeometry(width * 2, width * 2, width, 16);
    baseGeometry.rotateX(Math.PI / 2);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color,
      metalness: 0.8,
      roughness: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    group.add(base);
    return group;
  }

  function createStarField(scene) {
    const starGeometry = new THREE.BufferGeometry();
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
      const x = THREE.MathUtils.randFloatSpread(2000);
      const y = THREE.MathUtils.randFloatSpread(2000);
      const z = THREE.MathUtils.randFloatSpread(2000);
      starVertices.push(x, y, z);
    }
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xFFFFFF,
      size: 0.7,
      transparent: true
    });
    app.stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(app.stars);
  }

  function createOrbitalShell(scene) {
    const sphereGeometry = new THREE.SphereGeometry(30, 128, 128);
    app.sphereMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x223344,
      transparent: true,
      opacity: 0.3,
      metalness: 0.2,
      roughness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
      ior: 1.5,
      side: THREE.DoubleSide
    });
    app.sphere = new THREE.Mesh(sphereGeometry, app.sphereMaterial);
    scene.add(app.sphere);

    const atmosphereGeometry = new THREE.SphereGeometry(32, 128, 128);
    const atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.6 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 4.0);
          gl_FragColor = vec4(0.1, 0.5, 1.0, 1.0) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true
    });
    app.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    scene.add(app.atmosphere);

    const ringGeometry = new THREE.RingGeometry(38, 45, 128);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xaaccff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.3
    });
    app.ring = new THREE.Mesh(ringGeometry, ringMaterial);
    app.ring.rotation.x = Math.PI / 2;
    scene.add(app.ring);
  }

  function createLights(scene) {
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(50, 50, 50);
    scene.add(directionalLight);

    const blueLight = new THREE.PointLight(0x3366ff, 2, 100);
    blueLight.position.set(50, -30, 20);
    scene.add(blueLight);

    const purpleLight = new THREE.PointLight(0xff33ff, 2, 100);
    purpleLight.position.set(-50, 30, 20);
    scene.add(purpleLight);
  }

  function createClock(scene) {
    const clockGroup = new THREE.Group();
    scene.add(clockGroup);

    const clockFaceGeometry = new THREE.CircleGeometry(15, 64);
    app.clockFaceTexture = new THREE.CanvasTexture(app.textures.createClockFaceTexture());
    app.clockFaceMaterial = new THREE.MeshBasicMaterial({
      map: app.clockFaceTexture,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    app.clockFace = new THREE.Mesh(clockFaceGeometry, app.clockFaceMaterial);
    app.clockFace.position.z = -0.01;
    clockGroup.add(app.clockFace);

    app.hands.hour = createHand(8, 0.8, 0xffaa00, 1.5, 0xff8800);
    app.hands.minute = createHand(12, 0.6, 0x33ccff, 2, 0x00aaff);
    app.hands.second = createHand(14, 0.3, 0xff3366, 2.5, 0xff0044);
    app.hands.hour.position.z = 0.3;
    app.hands.minute.position.z = 0.4;
    app.hands.second.position.z = 0.5;
    clockGroup.add(app.hands.hour);
    clockGroup.add(app.hands.minute);
    clockGroup.add(app.hands.second);

    const centerPinGeometry = new THREE.SphereGeometry(1, 16, 16);
    const centerPinMaterial = new THREE.MeshStandardMaterial({
      color: 0xdddddd,
      metalness: 1.0,
      roughness: 0.1,
      envMapIntensity: 1.0
    });
    const centerPin = new THREE.Mesh(centerPinGeometry, centerPinMaterial);
    centerPin.position.z = 0.6;
    clockGroup.add(centerPin);
  }

  function initScene() {
    app.scene = new THREE.Scene();
    app.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    app.camera.position.set(0, 0, 60);

    app.renderer = new THREE.WebGLRenderer({ antialias: true });
    app.renderer.setSize(window.innerWidth, window.innerHeight);
    app.renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(app.renderer.domElement);

    const renderScene = new THREE.RenderPass(app.scene, app.camera);
    app.bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.4,
      0.85
    );
    app.composer = new THREE.EffectComposer(app.renderer);
    app.composer.addPass(renderScene);
    app.composer.addPass(app.bloomPass);

    app.controls = new THREE.OrbitControls(app.camera, app.renderer.domElement);
    app.controls.enableDamping = true;
    app.controls.dampingFactor = 0.1;
    app.controls.enablePan = false;
    app.controls.enableZoom = true;
    app.controls.minDistance = 10;
    app.controls.maxDistance = 100;
    app.controls.autoRotate = true;
    app.controls.autoRotateSpeed = 0.5;

    createStarField(app.scene);
    createOrbitalShell(app.scene);
    createLights(app.scene);
    createClock(app.scene);
  }

  app.sceneFactory = {
    initScene
  };
})(window.GalacticClock);
