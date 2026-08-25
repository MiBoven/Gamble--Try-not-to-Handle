// Gamble - Try not to Handle
// 3D physically simulated dice. Three.js for rendering, Cannon-es for physics.
//
// SETUP REQUIRED: this app imports Three.js and Cannon-es as local, vendored
// ES modules (no CDN calls at runtime). Before deploying, place these files
// under ./vendor/ preserving the exact folder structure below, since
// three.js's own example loaders import three.module.js via a relative path:
//
//   vendor/three/build/three.module.js
//     <- https://unpkg.com/three@0.160.0/build/three.module.js
//   vendor/three/examples/jsm/loaders/GLTFLoader.js
//     <- https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js
//   vendor/cannon-es.js
//     <- https://unpkg.com/cannon-es@0.20.0/dist/cannon-es.js
//
// The die model lives in ./models/D6.glb — see README for details.
//
// NOTE: the three imports below are dynamic (not static `import` statements)
// on purpose. A static import of a missing/misplaced vendor file fails
// silently at parse time (nothing runs, no error shown). Dynamic import lets
// us catch that failure and show a clear message instead of an endless
// "Loading dice model…" with no explanation.

// ---------- Theme (works even if Three.js/Cannon-es fail to load) ----------
const root = document.documentElement;
const themeToggle = document.getElementById('themeToggle');
function setTheme(t) {
  root.setAttribute('data-theme', t);
  localStorage.setItem('gamble-theme', t);
  themeToggle.textContent = t === 'dark' ? '◐' : '◑';
}
setTheme(localStorage.getItem('gamble-theme') || 'dark');
themeToggle.addEventListener('click', () => {
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

// ---------- Constants ----------
const DIE_HALF = 0.5;          // half-extent of a die in world units
const MAX_DICE = 5;
const TRAY_SIZE = 6;           // inner floor size
const WALL_HEIGHT = 1.4;
const SETTLE_LIN_THRESHOLD = 0.05;
const SETTLE_ANG_THRESHOLD = 0.05;
const SETTLE_FRAMES_REQUIRED = 40;

// ---------- State ----------
let pipMode = 6;      // 6 = standard 1-6, 3 = doubled 1-3
let diceCount = 1;
let rolling = false;
let settleStreak = 0;
let lastPhysicalValues = [];

// ---------- UI elements ----------
const dieTypeToggle = document.getElementById('dieTypeToggle');
const pipModeToggle = document.getElementById('pipModeToggle');
const pipModeHint = document.getElementById('pipModeHint');
const diceCountStepper = document.getElementById('diceCountStepper');
const throwBtn = document.getElementById('throwBtn');
const loadingMsg = document.getElementById('loadingMsg');
const resultCard = document.getElementById('resultCard');
const diceValuesEl = document.getElementById('diceValues');
const diceSumEl = document.getElementById('diceSum');
const canvas = document.getElementById('scene');
const trayWrap = document.querySelector('.tray-wrap');
const statsToggle = document.getElementById('statsToggle');
const statsChev = document.getElementById('statsChev');
const statsBody = document.getElementById('statsBody');
const statsSummary = document.getElementById('statsSummary');
const statsBars = document.getElementById('statsBars');
const statsResetBtn = document.getElementById('statsResetBtn');

dieTypeToggle.addEventListener('click', () => {
  // Only D6 exists for now; kept as a no-op hook for future die types.
});

pipModeToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.seg-btn');
  if (!btn) return;
  pipModeToggle.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  pipMode = parseInt(btn.dataset.mode, 10);
  pipModeHint.textContent = pipMode === 6
    ? 'Standard die: each number 1–6 appears once.'
    : 'Each number 1–3 appears twice (physical roll shown in parentheses).';
  if (lastPhysicalValues.length && window.gambleRenderResults) window.gambleRenderResults(lastPhysicalValues);
});

diceCountStepper.addEventListener('click', (e) => {
  const btn = e.target.closest('.count-btn');
  if (!btn || rolling) return;
  diceCountStepper.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  diceCount = parseInt(btn.dataset.count, 10);
  if (window.gambleSetDiceCount) window.gambleSetDiceCount(diceCount);
  resultCard.style.display = 'none';
  lastPhysicalValues = [];
});

// ---------- Statistics (persisted in localStorage, independent of 3D load) ----------
const STATS_KEY = 'gamble-stats';
function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) { /* ignore corrupt data */ }
  return { totalThrows: 0, totalDice: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } };
}
let statsData = loadStats();

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(statsData));
}

function recordStats(physicalValues) {
  statsData.totalThrows += 1;
  statsData.totalDice += physicalValues.length;
  physicalValues.forEach((v) => { statsData.counts[v] = (statsData.counts[v] || 0) + 1; });
  saveStats();
  renderStats();
}

function renderStats() {
  const max = Math.max(1, ...Object.values(statsData.counts));
  statsBars.innerHTML = '';
  for (let v = 1; v <= 6; v++) {
    const count = statsData.counts[v] || 0;
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.innerHTML = `
      <span class="stat-label">${v}</span>
      <span class="stat-track"><span class="stat-fill" style="width:${(count / max) * 100}%"></span></span>
      <span class="stat-count">${count}</span>
    `;
    statsBars.appendChild(row);
  }
  statsSummary.textContent = statsData.totalDice > 0
    ? `${statsData.totalThrows} throw${statsData.totalThrows === 1 ? '' : 's'} · ${statsData.totalDice} dice rolled in total (physical face distribution, unaffected by pip mode).`
    : 'No rolls yet.';
}
renderStats();

statsToggle.addEventListener('click', () => {
  const open = statsBody.style.display !== 'none';
  statsBody.style.display = open ? 'none' : 'block';
  statsChev.classList.toggle('open', !open);
});

statsResetBtn.addEventListener('click', () => {
  if (!confirm('Reset all statistics? This cannot be undone.')) return;
  statsData = { totalThrows: 0, totalDice: 0, counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 } };
  saveStats();
  renderStats();
});

// ---------- Warn before an accidental reload/navigation ----------
window.addEventListener('beforeunload', (e) => {
  if (statsData.totalThrows > 0) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ---------- 3D boot (Three.js + Cannon-es), loaded dynamically ----------
async function boot() {
  let THREE, GLTFLoader, CANNON;
  try {
    const [threeMod, loaderMod, cannonMod] = await Promise.all([
      import('./vendor/three/build/three.module.js'),
      import('./vendor/three/examples/jsm/loaders/GLTFLoader.js'),
      import('./vendor/cannon-es.js'),
    ]);
    THREE = threeMod;
    GLTFLoader = loaderMod.GLTFLoader;
    CANNON = cannonMod;
  } catch (err) {
    console.error('Failed to load Three.js/Cannon-es from ./vendor/:', err);
    loadingMsg.textContent = 'Could not load the 3D engine from ./vendor/ — check that all 3 library files are present at the exact paths listed in README.md, then reload.';
    return;
  }

  // Local-axis -> pip value, measured directly from the D6.glb geometry
  // (opposite faces sum to 7, as on a real die).
  const FACE_MAP = [
    { axis: new THREE.Vector3(1, 0, 0), value: 3 },
    { axis: new THREE.Vector3(-1, 0, 0), value: 4 },
    { axis: new THREE.Vector3(0, 1, 0), value: 2 },
    { axis: new THREE.Vector3(0, -1, 0), value: 5 },
    { axis: new THREE.Vector3(0, 0, 1), value: 6 },
    { axis: new THREE.Vector3(0, 0, -1), value: 1 },
  ];

  // ---------- Three.js setup ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x184a30);

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 7.2, 6.4);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
  dirLight.position.set(3, 8, 4);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.left = -5;
  dirLight.shadow.camera.right = 5;
  dirLight.shadow.camera.top = 5;
  dirLight.shadow.camera.bottom = -5;
  scene.add(dirLight);

  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(TRAY_SIZE, TRAY_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x1f5a37, roughness: 0.9 })
  );
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.8 });
  function addWallMesh(w, h, d, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  const half = TRAY_SIZE / 2;
  addWallMesh(TRAY_SIZE + 0.3, WALL_HEIGHT, 0.3, 0, WALL_HEIGHT / 2, -half - 0.15);
  addWallMesh(TRAY_SIZE + 0.3, WALL_HEIGHT, 0.3, 0, WALL_HEIGHT / 2, half + 0.15);
  addWallMesh(0.3, WALL_HEIGHT, TRAY_SIZE + 0.3, -half - 0.15, WALL_HEIGHT / 2, 0);
  addWallMesh(0.3, WALL_HEIGHT, TRAY_SIZE + 0.3, half + 0.15, WALL_HEIGHT / 2, 0);

  function resize() {
    const size = trayWrap.clientWidth;
    renderer.setSize(size, size, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---------- Cannon-es physics setup ----------
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const dieMaterial = new CANNON.Material('die');
  const groundMaterial = new CANNON.Material('ground');
  world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial, groundMaterial, {
    friction: 0.45, restitution: 0.25,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(dieMaterial, dieMaterial, {
    friction: 0.3, restitution: 0.35,
  }));

  const floorBody = new CANNON.Body({ mass: 0, material: groundMaterial });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(floorBody);

  function addWallBody(w, h, d, x, y, z) {
    const body = new CANNON.Body({ mass: 0, material: groundMaterial });
    body.addShape(new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)));
    body.position.set(x, y, z);
    world.addBody(body);
  }
  addWallBody(TRAY_SIZE + 0.3, WALL_HEIGHT, 0.3, 0, WALL_HEIGHT / 2, -half - 0.15);
  addWallBody(TRAY_SIZE + 0.3, WALL_HEIGHT, 0.3, 0, WALL_HEIGHT / 2, half + 0.15);
  addWallBody(0.3, WALL_HEIGHT, TRAY_SIZE + 0.3, -half - 0.15, WALL_HEIGHT / 2, 0);
  addWallBody(0.3, WALL_HEIGHT, TRAY_SIZE + 0.3, half + 0.15, WALL_HEIGHT / 2, 0);

  // ---------- Dice pool ----------
  const dicePool = []; // { mesh, body, inScene }

  function createDie(templateMesh) {
    const mesh = templateMesh.clone();
    mesh.scale.setScalar(DIE_HALF); // model spans -1..1, scale to half-extent 0.5
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const body = new CANNON.Body({
      mass: 1,
      material: dieMaterial,
      shape: new CANNON.Box(new CANNON.Vec3(DIE_HALF, DIE_HALF, DIE_HALF)),
      angularDamping: 0.3,
      linearDamping: 0.05,
    });

    return { mesh, body, inScene: false };
  }

  function placeIdle(die, index) {
    const x = (index - (MAX_DICE - 1) / 2) * 0.9;
    die.body.position.set(x, DIE_HALF + 0.02, 0.5);
    die.body.velocity.set(0, 0, 0);
    die.body.angularVelocity.set(0, 0, 0);
    const q = new CANNON.Quaternion();
    q.setFromEuler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    die.body.quaternion.copy(q);
    die.body.sleep();
  }

  function setDiceCount(n) {
    for (let i = 0; i < MAX_DICE; i++) {
      const die = dicePool[i];
      if (!die) continue;
      const shouldShow = i < n;
      if (shouldShow && !die.inScene) {
        scene.add(die.mesh);
        world.addBody(die.body);
        die.inScene = true;
        placeIdle(die, i);
      } else if (!shouldShow && die.inScene) {
        scene.remove(die.mesh);
        world.removeBody(die.body);
        die.inScene = false;
      }
    }
  }
  window.gambleSetDiceCount = setDiceCount;

  // ---------- Load model ----------
  const loader = new GLTFLoader();
  loader.load('./models/D6.glb', (gltf) => {
    let templateMesh = null;
    gltf.scene.traverse((child) => {
      if (child.isMesh && !templateMesh) templateMesh = child;
    });
    if (!templateMesh) {
      loadingMsg.textContent = 'Could not find a mesh inside D6.glb.';
      return;
    }
    for (let i = 0; i < MAX_DICE; i++) {
      dicePool.push(createDie(templateMesh));
    }
    setDiceCount(diceCount);
    resize();
    loadingMsg.style.display = 'none';
    throwBtn.disabled = false;
    animate();
  }, undefined, (err) => {
    console.error(err);
    loadingMsg.textContent = 'Failed to load models/D6.glb — check that the file is committed at exactly that path (case-sensitive) and reload.';
  });

  // ---------- Throw ----------
  throwBtn.addEventListener('click', () => {
    if (rolling) return;
    rolling = true;
    settleStreak = 0;
    throwBtn.disabled = true;
    resultCard.style.display = 'none';

    const activeDice = dicePool.slice(0, diceCount);
    activeDice.forEach((die, i) => {
      die.body.wakeUp();
      const scatterX = (i - (diceCount - 1) / 2) * 0.8 + (Math.random() - 0.5) * 0.4;
      const scatterZ = (Math.random() - 0.5) * 0.6;
      die.body.position.set(scatterX, 2.2 + Math.random() * 0.6, scatterZ);
      const q = new CANNON.Quaternion();
      q.setFromEuler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      die.body.quaternion.copy(q);
      die.body.velocity.set((Math.random() - 0.5) * 2.5, -2, (Math.random() - 0.5) * 2.5);
      die.body.angularVelocity.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 18
      );
    });
  });

  // ---------- Face-up detection ----------
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  function getTopValue(cannonQuaternion) {
    q.set(cannonQuaternion.x, cannonQuaternion.y, cannonQuaternion.z, cannonQuaternion.w);
    let best = FACE_MAP[0].value;
    let bestDot = -Infinity;
    for (const f of FACE_MAP) {
      v.copy(f.axis).applyQuaternion(q);
      if (v.y > bestDot) { bestDot = v.y; best = f.value; }
    }
    return best;
  }

  function remap(physicalValue) {
    if (pipMode === 6) return physicalValue;
    return ((physicalValue - 1) % 3) + 1;
  }

  window.gambleRenderResults = function renderResults(physicalValues) {
    diceValuesEl.innerHTML = '';
    let sum = 0;
    physicalValues.forEach((pv) => {
      const logical = remap(pv);
      sum += logical;
      const chip = document.createElement('div');
      chip.className = 'die-value';
      chip.textContent = pipMode === 6 ? `${logical}` : `${logical} (${pv})`;
      diceValuesEl.appendChild(chip);
    });
    diceSumEl.innerHTML = `Sum: <strong>${sum}</strong>`;
    resultCard.style.display = 'block';
  };

  // ---------- Animation loop ----------
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 1 / 30);
    world.step(1 / 60, dt, 8);

    const activeDice = dicePool.slice(0, diceCount);
    activeDice.forEach((die) => {
      die.mesh.position.copy(die.body.position);
      die.mesh.quaternion.copy(die.body.quaternion);
    });

    if (rolling) {
      const allSlow = activeDice.every((die) =>
        die.body.velocity.length() < SETTLE_LIN_THRESHOLD &&
        die.body.angularVelocity.length() < SETTLE_ANG_THRESHOLD
      );
      settleStreak = allSlow ? settleStreak + 1 : 0;
      if (settleStreak >= SETTLE_FRAMES_REQUIRED) {
        rolling = false;
        throwBtn.disabled = false;
        lastPhysicalValues = activeDice.map((die) => getTopValue(die.body.quaternion));
        window.gambleRenderResults(lastPhysicalValues);
        recordStats(lastPhysicalValues);
      }
    }

    renderer.render(scene, camera);
  }
}

boot();
