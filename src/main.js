import "./styles.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const canvas = document.querySelector("#mission-canvas");
const loading = document.querySelector("#loading-screen");
const labelLayer = document.querySelector("#label-layer");
const cockpitOverlay = document.querySelector("#cockpit-overlay");

const ui = {
  stage: document.querySelector("#stage-pill"),
  signal: document.querySelector("#signal-pill"),
  utc: document.querySelector("#utc-readout"),
  met: document.querySelector("#met-readout"),
  earthDistance: document.querySelector("#earth-distance"),
  moonDistance: document.querySelector("#moon-distance"),
  speed: document.querySelector("#speed-readout"),
  mode: document.querySelector("#mode-readout"),
  briefTitle: document.querySelector("#brief-title"),
  briefBody: document.querySelector("#brief-body"),
  sourceChip: document.querySelector("#source-chip"),
  slider: document.querySelector("#time-slider"),
  play: document.querySelector("#play-button"),
  reset: document.querySelector("#reset-button"),
  speedSelect: document.querySelector("#speed-select"),
  eventList: document.querySelector("#event-list"),
  panel: document.querySelector("#panel-body"),
  togglePanel: document.querySelector("#toggle-panel"),
  toggles: {
    trail: document.querySelector("#toggle-trail"),
    belts: document.querySelector("#toggle-belts"),
    labels: document.querySelector("#toggle-labels"),
    cockpit: document.querySelector("#toggle-cockpit"),
  },
};

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x02040b, 0.002);

const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.001, 5000);
camera.position.set(38, 24, 56);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxDistance = 220;
controls.minDistance = 0.08;
controls.enabled = false;

const textureLoader = new THREE.TextureLoader();
const missionClock = new THREE.Clock();
const reusableVector = new THREE.Vector3();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
raycaster.params.Line.threshold = 0.14;
const labels = new Map();
const state = {
  mission: null,
  playing: false,
  speed: 600,
  currentTime: 0,
  view: "overview",
  guidedZoom: 1,
  lastSliderSync: 0,
  lastHudPaint: 0,
  earthRadius: 1,
  moonRadius: 0.2727,
  ksc: null,
  splash: null,
};

const groups = {
  bodies: new THREE.Group(),
  trajectory: new THREE.Group(),
  overlays: new THREE.Group(),
  vehicle: new THREE.Group(),
  labels: new THREE.Group(),
};
scene.add(groups.bodies, groups.trajectory, groups.overlays, groups.vehicle);

const earth = makeEarth();
const moon = makeMoon();
const orion = makeOrion();
const rocket = makeRocket();
const sunLight = new THREE.DirectionalLight(0xfff3d0, 2.4);
const ambientLight = new THREE.AmbientLight(0x6d7ea0, 0.18);
const trailLine = makeDynamicTrail();
const trajectoryLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x49c8ff, transparent: true, opacity: 0.42 }),
);
const launchBridgeLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffb057, transparent: true, opacity: 0.38 }),
);
const moonOrbitLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1 }),
);
const belts = makeRadiationBelts();
const eclipseCorona = makeEclipseCorona();
const entryGlow = makeEntryGlow();

groups.bodies.add(earth, moon);
groups.vehicle.add(orion, rocket);
groups.trajectory.add(trajectoryLine, launchBridgeLine, trailLine, moonOrbitLine);
groups.overlays.add(belts, eclipseCorona, entryGlow);
scene.add(sunLight, ambientLight, makeStars());

addLabel("earth", "Earth", earth.position);
addLabel("moon", "Moon", moon.position);
addLabel("orion", "Orion Integrity", orion.position);

fetch("/data/artemis-ii-mission.json")
  .then((response) => response.json())
  .then((mission) => {
    state.mission = mission;
    state.currentTime = Date.parse(mission.meta.launchTime);
    state.speed = Number(ui.speedSelect.value);
    state.ksc = latLonToVector(28.6084, -80.6043, mission.constants.earthRadiusKm);
    state.splash = latLonToVector(32.5, -118.2, mission.constants.earthRadiusKm);
    buildTrajectoryGeometry(mission);
    buildEventList(mission.events);
    loading.classList.add("hidden");
    setTime(state.currentTime, true);
    animate();
  })
  .catch((error) => {
    loading.innerHTML = `<span>데이터 로딩 실패: ${error.message}</span>`;
    console.error(error);
  });

function makeEarth() {
  const geometry = new THREE.SphereGeometry(1, 96, 64);
  const map = textureLoader.load("/assets/earth-blue-marble.jpg");
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.78,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geometry, material);

  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.025, 96, 64),
    new THREE.MeshBasicMaterial({
      color: 0x6ab7ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  mesh.add(atmosphere);
  return mesh;
}

function makeMoon() {
  const geometry = new THREE.SphereGeometry(0.2727, 96, 64);
  const map = textureLoader.load("/assets/moon-lro-color.jpg");
  map.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.95,
    metalness: 0,
  });
  return new THREE.Mesh(geometry, material);
}

function makeOrion() {
  const group = new THREE.Group();
  group.name = "Orion Integrity";
  group.scale.setScalar(0.22);

  const capsule = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.78, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xbec5ca, roughness: 0.58, metalness: 0.22 }),
  );
  capsule.rotation.x = Math.PI;
  capsule.position.y = 0.38;

  const heatShield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.95, 0.95, 0.16, 48),
    new THREE.MeshStandardMaterial({ color: 0x3c312a, roughness: 0.9 }),
  );
  heatShield.position.y = -0.08;

  const service = new THREE.Mesh(
    new THREE.CylinderGeometry(0.76, 0.76, 1.2, 48),
    new THREE.MeshStandardMaterial({ color: 0xd8d9d0, roughness: 0.5, metalness: 0.28 }),
  );
  service.position.y = -0.78;

  const nozzle = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 0.48, 32, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x15191f, roughness: 0.7, metalness: 0.45 }),
  );
  nozzle.position.y = -1.58;

  const panelMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c5c93,
    roughness: 0.45,
    metalness: 0.08,
    emissive: 0x052744,
    emissiveIntensity: 0.35,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < 4; i += 1) {
    const arm = new THREE.Group();
    const boom = new THREE.Mesh(
      new THREE.BoxGeometry(1.28, 0.04, 0.04),
      new THREE.MeshStandardMaterial({ color: 0xc8c9c1, roughness: 0.42, metalness: 0.4 }),
    );
    boom.position.x = 0.95;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.03, 0.62), panelMaterial);
    panel.position.x = 1.88;
    arm.add(boom, panel);
    arm.rotation.y = (Math.PI / 2) * i;
    arm.position.y = -0.76;
    group.add(arm);
  }

  const antenna = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.2 }),
  );
  antenna.position.set(0.2, 0.74, 0.28);

  group.add(capsule, heatShield, service, nozzle, antenna);
  return group;
}

function makeRocket() {
  const group = new THREE.Group();
  group.name = "SLS";
  group.scale.setScalar(0.16);

  const coreMat = new THREE.MeshStandardMaterial({ color: 0xf4a13f, roughness: 0.62 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf3f1e8, roughness: 0.45 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: 0.6 });

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 4.3, 32), coreMat);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 1.35, 32), whiteMat);
  upper.position.y = 2.82;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.65, 32), whiteMat);
  cone.position.y = 3.82;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.12, 32), blackMat);
  band.position.y = 1.92;

  for (const x of [-0.62, 0.62]) {
    const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.0, 24), whiteMat);
    booster.position.set(x, -0.1, 0);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.45, 24), whiteMat);
    nose.position.set(x, 2.15, 0);
    group.add(booster, nose);
  }

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.62, 1.3, 32),
    new THREE.MeshBasicMaterial({
      color: 0xff8b2a,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  flame.name = "flame";
  flame.position.y = -2.85;
  flame.rotation.x = Math.PI;
  group.add(core, upper, cone, band, flame);
  group.visible = false;
  return group;
}

function makeDynamicTrail() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color: 0xfff0ad, transparent: true, opacity: 0.96 }),
  );
}

function makeRadiationBelts() {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xe9d36d,
    transparent: true,
    opacity: 0.075,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const inner = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.22, 24, 128), material);
  const outer = new THREE.Mesh(new THREE.TorusGeometry(4.4, 0.42, 24, 160), material.clone());
  outer.material.opacity = 0.048;
  inner.rotation.x = Math.PI / 2;
  outer.rotation.x = Math.PI / 2;
  group.add(inner, outer);
  return group;
}

function makeEclipseCorona() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.34, 0.6, 96),
    new THREE.MeshBasicMaterial({
      color: 0xfff1a3,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(ring);
  return group;
}

function makeEntryGlow() {
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.115, 32, 18),
    new THREE.MeshBasicMaterial({
      color: 0xff6c21,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  return glow;
}

function makeStars() {
  const count = 2400;
  const positions = [];
  for (let i = 0; i < count; i += 1) {
    const radius = 360 + Math.random() * 900;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions.push(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta),
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xe9f2ff,
      size: 1.1,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.86,
    }),
  );
}

function buildTrajectoryGeometry(mission) {
  const positions = mission.samples.flatMap((sample) => scenePosition(sample.r).toArray());
  trajectoryLine.geometry.dispose();
  trajectoryLine.geometry = new THREE.BufferGeometry();
  trajectoryLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const first = scenePosition(mission.samples[0].r);
  const ksc = scenePosition(state.ksc);
  const bridge = [];
  for (let i = 0; i <= 80; i += 1) {
    const f = i / 80;
    const p = new THREE.Vector3().lerpVectors(ksc, first, f);
    p.normalize().multiplyScalar(1 + 0.05 + 3.0 * Math.sin(f * Math.PI));
    p.lerp(first, f * f * 0.62);
    bridge.push(...p.toArray());
  }
  launchBridgeLine.geometry.dispose();
  launchBridgeLine.geometry = new THREE.BufferGeometry();
  launchBridgeLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(bridge, 3));

  const moonPositions = mission.samples
    .filter((_, index) => index % 10 === 0)
    .flatMap((sample) => scenePosition(sample.moon).toArray());
  moonOrbitLine.geometry.dispose();
  moonOrbitLine.geometry = new THREE.BufferGeometry();
  moonOrbitLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(moonPositions, 3));
}

function buildEventList(events) {
  ui.eventList.innerHTML = "";
  for (const event of events) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.eventId = event.id;
    button.innerHTML = `<span>${event.title}</span><small>${event.phase}</small>`;
    button.addEventListener("click", () => {
      state.playing = false;
      ui.play.textContent = "재생";
      setTime(Date.parse(event.time), true);
    });
    item.append(button);
    ui.eventList.append(item);
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = missionClock.getDelta();
  if (state.playing) {
    setTime(state.currentTime + delta * 1000 * state.speed, false);
  }

  const now = performance.now() * 0.001;
  earth.rotation.y += delta * 0.018;
  moon.rotation.y += delta * 0.006;
  rocket.getObjectByName("flame").scale.setScalar(0.82 + Math.sin(now * 18) * 0.08);

  updateCamera(delta);
  updateLabels();
  controls.update();
  renderer.render(scene, camera);
}

function setTime(nextTime, forceSlider) {
  const mission = state.mission;
  const start = Date.parse(mission.meta.launchTime);
  const end = Date.parse(mission.meta.splashdownTime);
  state.currentTime = THREE.MathUtils.clamp(nextTime, start, end);
  if (state.currentTime >= end) {
    state.playing = false;
    ui.play.textContent = "재생";
  }

  const stateAtTime = getStateAt(state.currentTime);
  updateSceneState(stateAtTime);
  const now = performance.now();
  if (forceSlider || !state.playing || now - state.lastHudPaint > 220) {
    updateHud(stateAtTime);
    state.lastHudPaint = now;
  }
  updateEventFocus(stateAtTime.event);

  if (forceSlider || performance.now() - state.lastSliderSync > 100) {
    const progress = (state.currentTime - start) / (end - start);
    ui.slider.value = String(Math.round(progress * 10000));
    state.lastSliderSync = performance.now();
  }
}

function getStateAt(time) {
  const mission = state.mission;
  const samples = mission.samples;
  const launchTime = Date.parse(mission.meta.launchTime);
  const ephemerisStart = samples[0].t;
  const entryInterface = samples[samples.length - 1].t;
  const splashdown = Date.parse(mission.meta.splashdownTime);
  const currentEvent = activeEvent(time);

  if (time < ephemerisStart) {
    const f = smoothstep((time - launchTime) / (ephemerisStart - launchTime));
    const first = samples[0];
    const launch = state.ksc;
    const target = first.r;
    const bridged = lerpArray(launch, target, f);
    const radialBoost = 12000 * Math.sin(f * Math.PI);
    const radial = normalizeArray(bridged).map((value) => value * radialBoost);
    const r = bridged.map((value, index) => value + radial[index] * (1 - f * 0.7));
    return {
      mode: "Launch / ascent visual bridge",
      sample: first,
      event: currentEvent,
      r,
      v: first.v,
      moon: first.moon,
      sun: first.sun,
      earthDistanceKm: norm(r),
      moonDistanceKm: norm(subArray(r, first.moon)),
      speedKms: 7.8 + f * 1.3,
      synthetic: true,
    };
  }

  if (time > entryInterface) {
    const last = samples[samples.length - 1];
    const f = smoothstep((time - entryInterface) / (splashdown - entryInterface));
    const splash = state.splash;
    const r = lerpArray(last.r, splash, f);
    return {
      mode: "Entry / descent procedural bridge",
      sample: last,
      event: currentEvent,
      r,
      v: last.v,
      moon: last.moon,
      sun: last.sun,
      earthDistanceKm: norm(r),
      moonDistanceKm: norm(subArray(r, last.moon)),
      speedKms: Math.max(0.03, last.speedKms * (1 - f) + 0.03 * f),
      synthetic: true,
    };
  }

  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].t <= time) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[Math.min(lo + 1, samples.length - 1)];
  const f = b.t === a.t ? 0 : (time - a.t) / (b.t - a.t);
  const r = lerpArray(a.r, b.r, f);
  const v = lerpArray(a.v, b.v, f);
  const moonVector = lerpArray(a.moon, b.moon, f);
  const sunVector = lerpArray(a.sun, b.sun, f);
  return {
    mode: "NASA OEM ephemeris",
    sample: a,
    event: currentEvent,
    r,
    v,
    moon: moonVector,
    sun: sunVector,
    earthDistanceKm: norm(r),
    moonDistanceKm: norm(subArray(r, moonVector)),
    speedKms: norm(v),
    synthetic: false,
  };
}

function updateSceneState(stateAtTime) {
  const spacecraftPosition = scenePosition(stateAtTime.r);
  const moonPosition = scenePosition(stateAtTime.moon);
  const sunPosition = scenePosition(stateAtTime.sun).normalize();

  moon.position.copy(moonPosition);
  orion.position.copy(spacecraftPosition);
  rocket.position.copy(spacecraftPosition);
  sunLight.position.copy(sunPosition.multiplyScalar(120));

  orientVehicle(orion, spacecraftPosition, stateAtTime.v);
  orientVehicle(rocket, spacecraftPosition, stateAtTime.v);

  const isLaunch = stateAtTime.event?.id === "launch" || stateAtTime.mode.includes("Launch");
  rocket.visible = isLaunch;
  orion.visible = !isLaunch;
  if (isLaunch) {
    rocket.scale.setScalar(0.17 + Math.min(0.13, (stateAtTime.earthDistanceKm - 6371) / 180000));
  }

  const activeBlackout = inRange("2026-04-06T22:44:00Z", "2026-04-06T23:25:00Z")
    || inRange("2026-04-10T23:53:00Z", "2026-04-10T23:59:00Z");
  const activeEclipse = inRange("2026-04-07T00:35:00Z", "2026-04-07T01:32:00Z");
  const activeEntry = stateAtTime.event?.id === "entry" || stateAtTime.event?.id === "splashdown";

  eclipseCorona.visible = activeEclipse;
  eclipseCorona.position.copy(moon.position);
  eclipseCorona.quaternion.copy(camera.quaternion);
  eclipseCorona.children[0].material.opacity = activeEclipse ? 0.62 : 0;

  entryGlow.visible = activeEntry;
  entryGlow.position.copy(orion.visible ? orion.position : rocket.position);
  entryGlow.material.opacity = activeEntry ? 0.72 : 0;
  entryGlow.scale.setScalar(activeEntry ? 2.2 + Math.sin(performance.now() * 0.012) * 0.2 : 1);

  setText(ui.signal, activeBlackout ? "BLACKOUT" : "SIGNAL");
  ui.signal.classList.toggle("lost", activeBlackout);
  trajectoryLine.visible = true;
  launchBridgeLine.visible = true;
  trailLine.visible = ui.toggles.trail.checked;
  belts.visible = ui.toggles.belts.checked;
  labelLayer.classList.toggle("hidden", !ui.toggles.labels.checked);
  cockpitOverlay.classList.toggle("visible", ui.toggles.cockpit.checked || state.view === "window");

  updateTrail(state.currentTime);

  function inRange(start, end) {
    return state.currentTime >= Date.parse(start) && state.currentTime <= Date.parse(end);
  }
}

function updateTrail(time) {
  const mission = state.mission;
  const points = [];
  for (const sample of mission.samples) {
    if (sample.t <= time) points.push(...scenePosition(sample.r).toArray());
  }
  if (points.length < 6) {
    trailLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute([], 3));
    return;
  }
  trailLine.geometry.dispose();
  trailLine.geometry = new THREE.BufferGeometry();
  trailLine.geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
}

function updateHud(stateAtTime) {
  const event = stateAtTime.event;
  setText(ui.stage, event?.phase ?? "Mission");
  setText(ui.utc, new Date(state.currentTime).toISOString().replace(".000Z", "Z"));
  setText(ui.met, formatMet(state.currentTime - Date.parse(state.mission.meta.launchTime)));
  setText(ui.earthDistance, `${formatNumber(stateAtTime.earthDistanceKm)} km`);
  setText(ui.moonDistance, `${formatNumber(stateAtTime.moonDistanceKm)} km`);
  setText(ui.speed, `${stateAtTime.speedKms.toFixed(2)} km/s`);
  setText(ui.mode, stateAtTime.mode);
  setText(ui.briefTitle, event?.title ?? "Artemis II");
  setText(ui.briefBody, event?.body ?? "NASA 공개 데이터를 따라 임무를 재생합니다.");
  setText(ui.sourceChip, event?.source ?? "NASA/JSC/FOD/FDO OEM");
}

function setText(element, value) {
  if (element.textContent !== value) element.textContent = value;
}

function updateEventFocus(active) {
  for (const button of ui.eventList.querySelectorAll("button")) {
    button.classList.toggle("active", button.dataset.eventId === active?.id);
  }
}

function activeEvent(time) {
  const events = state.mission.events;
  let active = events[0];
  for (const event of events) {
    if (Date.parse(event.time) <= time) active = event;
    else break;
  }
  return active;
}

function updateCamera(delta) {
  if (state.view === "free" || !state.mission) return;
  const focus = orion.visible ? orion.position : rocket.position;
  let desiredPosition = new THREE.Vector3();
  let desiredTarget = new THREE.Vector3();

  if (state.view === "overview") {
    desiredPosition.set(46, 24, 62);
    desiredTarget.set(0, 0, 0);
  } else if (state.view === "earth") {
    const dir = focus.clone().normalize();
    desiredPosition.copy(dir.multiplyScalar(Math.max(4.5, focus.length() + 3.4)));
    desiredPosition.y += 2.0;
    desiredTarget.copy(focus);
  } else if (state.view === "moon") {
    const moonToShip = focus.clone().sub(moon.position).normalize();
    desiredPosition.copy(moon.position).add(moonToShip.multiplyScalar(3.3));
    desiredTarget.copy(focus);
  } else if (state.view === "reentry") {
    const dir = focus.clone().normalize();
    desiredPosition.copy(focus).add(dir.multiplyScalar(2.4)).add(new THREE.Vector3(0.8, 0.5, 0.4));
    desiredTarget.copy(focus);
  } else if (state.view === "window") {
    const forward = moon.position.clone().sub(focus).normalize();
    if (focus.distanceTo(moon.position) > 7) forward.copy(new THREE.Vector3(0, 0, -1).applyQuaternion(orion.quaternion));
    desiredPosition.copy(focus).sub(forward.multiplyScalar(0.38)).add(new THREE.Vector3(0, 0.05, 0));
    desiredTarget.copy(moon.position);
    if (focus.distanceTo(moon.position) > 25) desiredTarget.copy(earth.position);
  }

  const blend = 1 - Math.pow(0.001, delta);
  applyGuidedZoom(desiredPosition, desiredTarget);
  camera.position.lerp(desiredPosition, blend * 0.65);
  controls.target.lerp(desiredTarget, blend * 0.8);
}

function applyGuidedZoom(position, target) {
  const offset = position.clone().sub(target);
  if (offset.lengthSq() < 0.001) return;
  const distance = THREE.MathUtils.clamp(offset.length() * state.guidedZoom, 0.18, 220);
  position.copy(target).add(offset.normalize().multiplyScalar(distance));
}

function orientVehicle(group, position, velocity) {
  const forward = sceneDirection(velocity).normalize();
  if (forward.lengthSq() < 0.001) return;
  const up = position.clone().normalize();
  const matrix = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), forward, up);
  group.quaternion.setFromRotationMatrix(matrix);
}

function addLabel(id, text, objectPosition) {
  const element = document.createElement("div");
  element.className = "space-label";
  element.textContent = text;
  labelLayer.appendChild(element);
  labels.set(id, { element, position: objectPosition });
}

function updateLabels() {
  for (const { element, position } of labels.values()) {
    reusableVector.copy(position).project(camera);
    const visible = reusableVector.z < 1;
    element.style.transform = `translate3d(${(reusableVector.x * 0.5 + 0.5) * window.innerWidth}px, ${(-reusableVector.y * 0.5 + 0.5) * window.innerHeight}px, 0)`;
    element.style.opacity = visible ? "1" : "0";
  }
}

function scenePosition(kmVector) {
  const scale = state.mission?.constants.kmToScene ?? 1 / 6371;
  return new THREE.Vector3(kmVector[0] * scale, kmVector[2] * scale, -kmVector[1] * scale);
}

function sceneDirection(kmVector) {
  return new THREE.Vector3(kmVector[0], kmVector[2], -kmVector[1]);
}

function latLonToVector(latDeg, lonDeg, radiusKm) {
  const lat = THREE.MathUtils.degToRad(latDeg);
  const lon = THREE.MathUtils.degToRad(lonDeg);
  return [
    radiusKm * Math.cos(lat) * Math.cos(lon),
    radiusKm * Math.cos(lat) * Math.sin(lon),
    radiusKm * Math.sin(lat),
  ];
}

function lerpArray(a, b, f) {
  return a.map((value, index) => value + (b[index] - value) * f);
}

function subArray(a, b) {
  return a.map((value, index) => value - b[index]);
}

function normalizeArray(a) {
  const length = norm(a) || 1;
  return a.map((value) => value / length);
}

function norm(a) {
  return Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
}

function smoothstep(value) {
  const x = THREE.MathUtils.clamp(value, 0, 1);
  return x * x * (3 - 2 * x);
}

function formatMet(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return `T+${days}d ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
}

ui.play.addEventListener("click", () => {
  state.playing = !state.playing;
  ui.play.textContent = state.playing ? "정지" : "재생";
});

ui.reset.addEventListener("click", () => {
  state.playing = false;
  ui.play.textContent = "재생";
  setTime(Date.parse(state.mission.meta.launchTime), true);
});

ui.speedSelect.addEventListener("change", () => {
  state.speed = Number(ui.speedSelect.value);
});

ui.slider.addEventListener("input", () => {
  const mission = state.mission;
  const start = Date.parse(mission.meta.launchTime);
  const end = Date.parse(mission.meta.splashdownTime);
  const progress = Number(ui.slider.value) / 10000;
  state.playing = false;
  ui.play.textContent = "재생";
  setTime(start + (end - start) * progress, false);
});

document.querySelectorAll(".view-button").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view, { resetGuidedZoom: true });
  });
});

for (const toggle of Object.values(ui.toggles)) {
  toggle.addEventListener("change", () => setTime(state.currentTime, false));
}

ui.togglePanel.addEventListener("click", () => {
  ui.panel.classList.toggle("collapsed");
  ui.togglePanel.textContent = ui.panel.classList.contains("collapsed") ? "+" : "−";
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

renderer.domElement.addEventListener("dblclick", (event) => {
  if (!state.mission) return;
  const target = getDoubleClickTarget(event);
  if (target) zoomToPoint(target.point, target.distance);
});

renderer.domElement.addEventListener(
  "wheel",
  (event) => {
    if (!state.mission || state.view === "free") return;
    event.preventDefault();
    const zoomFactor = Math.exp(event.deltaY * 0.001);
    state.guidedZoom = THREE.MathUtils.clamp(state.guidedZoom * zoomFactor, 0.18, 5.5);
  },
  { passive: false },
);

function setActiveView(view, options = {}) {
  document.querySelectorAll(".view-button").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === view);
  });
  if (options.resetGuidedZoom) state.guidedZoom = 1;
  state.view = view;
  controls.enabled = view === "free";
  cockpitOverlay.classList.toggle("visible", ui.toggles.cockpit.checked || state.view === "window");
}

function getDoubleClickTarget(event) {
  const bounds = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(
    [orion, rocket, earth, moon, trajectoryLine, trailLine, launchBridgeLine, moonOrbitLine],
    true,
  );
  const visibleHit = hits.find((hit) => hit.object.visible && hit.distance > 0);
  if (visibleHit) {
    return {
      point: visibleHit.point.clone(),
      distance: zoomDistanceForObject(visibleHit.object),
    };
  }

  return {
    point: (orion.visible ? orion.position : rocket.position).clone(),
    distance: 1.2,
  };
}

function zoomDistanceForObject(object) {
  let node = object;
  while (node) {
    if (node === earth) return 2.65;
    if (node === moon) return 0.95;
    if (node === orion || node === rocket) return 0.72;
    if (node === trajectoryLine || node === trailLine || node === launchBridgeLine || node === moonOrbitLine) return 1.4;
    node = node.parent;
  }
  return 1.4;
}

function zoomToPoint(point, distance) {
  const direction = camera.position.clone().sub(point);
  if (direction.lengthSq() < 0.001) {
    camera.getWorldDirection(direction).multiplyScalar(-1);
  }
  direction.normalize();
  setActiveView("free");
  controls.target.copy(point);
  camera.position.copy(point).add(direction.multiplyScalar(distance));
  controls.update();
}
