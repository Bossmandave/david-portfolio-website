/* The Room — real-time interior.
 * Blender-baked GI, composited live into a single lightmap, with a real sun on top. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Pass } from 'three/addons/postprocessing/Pass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { createSky, createBackdrop, sampleSky, sunDirection } from './src/sky.js';
import { createDust, createSparks, createCord, rainMaterial } from './src/fx.js';
import { setupBooks, setupGlobe, setupProps, createHints, PROJECTS, GLOBE_PLACES } from './src/interact.js';
import { createAudio } from './src/audio.js';
import { createPhysics } from './src/physics.js';
import { createGuestbook } from './src/guestbook.js';
import { createFirebaseStore } from './src/backend.js';
import { CONFIG } from './src/config.js';
import { createCat } from './src/cat.js';
import { createWalk, isTyping } from './src/walk.js';

/* ------------------------------------------------------------------ constants */
const LM_MAX = 8.0;
const LM_SCALE = 2.5;

/* Phones get a half-resolution lightmap set.
 *
 * This is the single biggest thing in the payload: 9.3 MB of baked bounce
 * light that cannot be compressed any further, because it is already WebP.
 * At 640 instead of 1280 it is 2.5 MB - the same lighting, read from a
 * smaller texture. What is lost is a little softness at shadow boundaries,
 * which is invisible at phone pixel densities and is why this is phone-only.
 *
 * Decided here, at module scope, because the textures are requested on the
 * next few lines and the choice cannot be revisited afterwards. A desktop
 * browser that happens to have a touchscreen gets the full set; the width
 * test is what actually separates a phone from a laptop.
 */
const SMALL_SCREEN = (('ontouchstart' in window) || navigator.maxTouchPoints > 0)
  && Math.min(innerWidth, innerHeight) < 820;
const LM_SFX = SMALL_SCREEN ? '@h' : '';
const LM_SIZE = SMALL_SCREEN ? 512 : 1024;
const GOD_LAYER = 2;
const WINDOW = { x: -3.0, lat0: -1.28, lat1: 1.28, hi0: 0.50, hi1: 2.32 };
const FIRE_AT = new THREE.Vector3(0, 0.34, 2.18);
const LAMP_AT = new THREE.Vector3(-1.62, 1.47, -1.92);
const CORD_ANCHOR = new THREE.Vector3(-1.535, 1.395, -1.945);
const GLOBE_AT = new THREE.Vector3(2.35, 0.785, 1.42);

const VIEWS = {
  hero:   { pos: [2.44, 1.52, -1.30], tgt: [-0.95, 0.92, 1.45], hfov: 86,
            p: { pos: [2.62, 1.68, -1.62], tgt: [-0.90, 0.95, 1.50] } },
  art:    { pos: [0.10, 1.72, 1.02],  tgt: [-0.02, 1.90, 2.18], hfov: 62,
            p: { pos: [0.10, 1.68, 1.26], tgt: [-0.02, 1.90, 2.18] } },
  fire:   { pos: [0.28, 1.12, 0.30],  tgt: [-0.02, 0.72, 2.38], hfov: 74,
            p: { pos: [0.30, 1.22, -0.25], tgt: [-0.02, 0.80, 2.38] } },
  window: { pos: [0.85, 1.42, 0.95],  tgt: [-2.95, 1.15, -0.30], hfov: 82,
            p: { pos: [1.35, 1.55, 1.15], tgt: [-2.95, 1.15, -0.30] } },
  sofa:   { pos: [-1.05, 1.52, 1.52], tgt: [0.55, 0.82, -1.45], hfov: 88,
            p: { pos: [-1.05, 1.66, 1.82], tgt: [0.50, 0.85, -1.45] } },
  shelf:  { pos: [1.78, 1.33, 0.60],  tgt: [2.74, 1.30, 0.66], hfov: 62,
            p: { pos: [1.62, 1.33, 0.62], tgt: [2.74, 1.30, 0.66] } },
  globe:  { pos: [1.80, 1.26, 1.00],  tgt: [2.35, 0.86, 1.41], hfov: 40,
            p: { pos: [1.74, 1.28, 0.96], tgt: [2.35, 0.86, 1.41] } },
};

const WEATHER = {
  clear:    { sky: 1.00, tint: 0xffffff, sun: 1.00, over: 0.00, rain: 0, snow: 0, dust: 1.00, bloom: 1.00 },
  overcast: { sky: 1.12, tint: 0xa8b4c4, sun: 0.10, over: 1.00, rain: 0, snow: 0, dust: 0.35, bloom: 0.85 },
  rain:     { sky: 0.92, tint: 0x8e9cb0, sun: 0.04, over: 1.00, rain: 1, snow: 0, dust: 0.20, bloom: 0.80 },
  snow:     { sky: 1.20, tint: 0xc6d2e2, sun: 0.22, over: 0.85, rain: 0, snow: 1, dust: 0.30, bloom: 1.05 },
};

const STATE = {
  time: 0.40, timeTarget: 0.40,
  fire: 1, fireTarget: 1,
  lamp: 0, lampTarget: 0,
  curtain: 0, curtainTarget: 0,
  weather: 'clear', quality: 'high',
  view: 'hero', mode: 'room', openBook: -1,
};

/* ------------------------------------------------------------------ renderer */
const canvas = document.createElement('canvas');
document.body.appendChild(canvas);

const renderer = new THREE.WebGLRenderer({
  canvas, antialias: false, powerPreference: 'high-performance', stencil: false,
});
const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 0.88;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.info.autoReset = false;

const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(54, innerWidth / innerHeight, 0.05, 900);
camera.layers.enable(GOD_LAYER);
camera.position.set(...VIEWS.hero.pos);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.5;
controls.zoomSpeed = 0.78;
controls.panSpeed = 0.5;
controls.minDistance = 0.45;
controls.maxDistance = 4.35;
controls.maxPolarAngle = Math.PI * 0.88;
controls.target.set(...VIEWS.hero.tgt);

let hfovBase = VIEWS.hero.hfov;
let fovBoost = 0, fovBoostTarget = 0;

let panelOffset = 0, panelOffsetTarget = 0;
function applyFov() {
  const aspect = innerWidth / innerHeight;
  const h = THREE.MathUtils.degToRad(Math.min(hfovBase + fovBoost, 112));
  let v = 2 * Math.atan(Math.tan(h / 2) / aspect);
  v = THREE.MathUtils.clamp(v, THREE.MathUtils.degToRad(38), THREE.MathUtils.degToRad(82));
  camera.fov = THREE.MathUtils.radToDeg(v);
  camera.aspect = aspect;
  if (panelOffset > 0.004) {
    const w = innerWidth, h = innerHeight;
    if (w >= 900) camera.setViewOffset(w, h, Math.round(panelOffset * Math.min(w * 0.165, 108)), 0, w, h);
    else camera.setViewOffset(w, h, 0, Math.round(panelOffset * h * 0.17), w, h);
  } else if (camera.view && camera.view.enabled) {
    camera.clearViewOffset();
  }
  camera.updateProjectionMatrix();
}
function panelOpen(on) {
  panelOffsetTarget = on ? 1 : 0;
}

/* widen the lens once the room stops the camera going further back */
function atZoomLimit() {
  return controls.getDistance() >= controls.maxDistance - 0.03;
}
canvas.addEventListener('wheel', (e) => {
  if (STATE.mode !== 'room') return;
  if (e.deltaY > 0 && atZoomLimit()) {
    fovBoostTarget = Math.min(fovBoostTarget + e.deltaY * 0.035, 26);
    e.preventDefault(); e.stopPropagation();
  } else if (e.deltaY < 0 && fovBoostTarget > 0.01) {
    fovBoostTarget = Math.max(0, fovBoostTarget + e.deltaY * 0.035);
    e.preventDefault(); e.stopPropagation();
  }
}, { capture: true, passive: false });

const touches = new Map();
let pinchPrev = 0;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch') touches.set(e.pointerId, e);
}, { capture: true });
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
  touches.set(e.pointerId, e);
  if (touches.size !== 2) return;
  const [a, b] = [...touches.values()];
  const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  if (pinchPrev) {
    const delta = pinchPrev - d;
    if (delta > 0 && atZoomLimit()) {
      fovBoostTarget = Math.min(fovBoostTarget + delta * 0.09, 26);
      e.stopPropagation();
    } else if (delta < 0 && fovBoostTarget > 0.01) {
      fovBoostTarget = Math.max(0, fovBoostTarget + delta * 0.09);
      e.stopPropagation();
    }
  }
  pinchPrev = d;
}, { capture: true });
const endTouch = (e) => { touches.delete(e.pointerId); if (touches.size < 2) pinchPrev = 0; };
addEventListener('pointerup', endTouch, { capture: true });
addEventListener('pointercancel', endTouch, { capture: true });

/* ------------------------------------------------------------------ assets */
const ui = {};
for (const id of ['load', 'lbar', 'lpct', 'enter', 'top', 'bottom', 'hint', 'tip',
                  'notes', 'stats', 'hints', 'panel', 'panelBody', 'panelClose', 'sound'])
  ui[id] = document.getElementById(id);

const manager = new THREE.LoadingManager();
let itemPct = 0, glbPct = 0, shownPct = 0;
function paintProgress() {
  const p = Math.min(1, 0.3 * itemPct + 0.7 * glbPct);
  if (p <= shownPct) return;
  shownPct = p;
  ui.lbar.style.transform = `scaleX(${p})`;
  ui.lpct.textContent = Math.round(p * 100) + '%';
}
manager.onProgress = (_u, loaded, total) => {
  itemPct = Math.max(itemPct, loaded / Math.max(total, 1));
  paintProgress();
};

const texLoader = new THREE.TextureLoader(manager);

/* The lightmap channels, split by whether the opening frame needs them.
 *
 * The room opens in daylight with the fire lit, so sky, the three sun-bounce
 * positions and fire are on the critical path. The lamp and the night sky are
 * not: nothing reads them until someone drags the time slider past dusk or
 * pulls the lamp cord. Holding the Enter button hostage to 2.7 MB that the
 * first frame will multiply by zero is just making people wait.
 *
 * So the deferred pair loads outside the LoadingManager - it does not gate
 * Enter and does not move the progress bar - and starts the moment the scene
 * is up. In practice it has landed long before anyone reaches for the slider.
 * If someone is quicker than the network, ensureLateLightmaps() below holds
 * the weight at zero until the texture is actually decoded, so the worst case
 * is the lamp coming on a beat late rather than the room flashing black.
 */
const LM_EAGER = ['sky', 'sunb', 'sunb_noon', 'sunb_gold', 'fire'];
const LM_LATE = ['lamp', 'night'];
const LM = {};

function lmTexture(t) {
  t.colorSpace = THREE.NoColorSpace;
  t.flipY = false;
  t.generateMipmaps = false;
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

for (const k of LM_EAGER) LM[k] = lmTexture(texLoader.load(`./assets/lm_${k}${LM_SFX}.webp`));

/* A single black texel stands in for a channel that has not arrived. It
 * decodes to zero radiance, so the compositor adds nothing for it. */
const LM_ZERO = lmTexture(new THREE.DataTexture(
  new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat));
LM_ZERO.needsUpdate = true;
for (const k of LM_LATE) LM[k] = LM_ZERO;

const lmLate = { ready: false, started: false, pending: 0 };

/* Fetched without the LoadingManager on purpose: see the note above. */
function ensureLateLightmaps() {
  if (lmLate.started) return;
  lmLate.started = true;
  const bare = new THREE.TextureLoader();
  lmLate.pending = LM_LATE.length;
  for (const k of LM_LATE) {
    bare.load(`./assets/lm_${k}${LM_SFX}.webp`, (t) => {
      LM[k] = lmTexture(t);
      lmUni[k === 'lamp' ? 'tLamp' : 'tNight'].value = LM[k];
      if (--lmLate.pending === 0) lmLate.ready = true;
      envPending = 1.4;              // recomposite with the real channel in
    }, undefined, () => {
      // A channel that never arrives leaves the room lit by what did. Better
      // than a half-black scene, and the console says which one was lost.
      console.warn(`lightmap channel "${k}" failed to load`);
      if (--lmLate.pending === 0) lmLate.ready = true;
    });
  }
}

const aoTex = texLoader.load(`./assets/ao${LM_SFX}.webp`);
aoTex.colorSpace = THREE.NoColorSpace;
aoTex.flipY = false;
aoTex.channel = 1;
aoTex.wrapS = aoTex.wrapT = THREE.ClampToEdgeWrapping;

const skyTex = {
  day: texLoader.load('./assets/sky_day.jpg'),
  night: texLoader.load('./assets/sky_night.jpg'),
};
Object.values(skyTex).forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; });
const flameTex = texLoader.load('./assets/flame.png');
flameTex.colorSpace = THREE.SRGBColorSpace;

/* ------------------------------------------------- live lightmap compositor */
const lmRT = new THREE.WebGLRenderTarget(LM_SIZE, LM_SIZE, {
  type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false,
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
});
lmRT.texture.colorSpace = THREE.NoColorSpace;
lmRT.texture.flipY = false;
lmRT.texture.channel = 1;
lmRT.texture.generateMipmaps = false;

const lmUni = {
  tSky: { value: LM.sky }, tSunA: { value: LM.sunb_noon },
  tSunB: { value: LM.sunb }, tSunC: { value: LM.sunb_gold },
  tLamp: { value: LM.lamp }, tNight: { value: LM.night }, tFire: { value: LM.fire },
  wSky: { value: 1 }, wSun: { value: new THREE.Vector3(0, 1, 0) },
  wLamp: { value: 0 }, wNight: { value: 0 }, wFire: { value: 1 },
  cSky: { value: new THREE.Color(1, 1, 1) }, cSun: { value: new THREE.Color(1, 1, 1) },
};
const lmScene = new THREE.Scene();
const lmCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
lmScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: lmUni,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tSky, tSunA, tSunB, tSunC, tLamp, tNight, tFire;
    uniform float wSky, wLamp, wNight, wFire;
    uniform vec3 wSun, cSky, cSun;
    varying vec2 vUv;
    vec3 dec(vec4 t){ return pow(t.rgb * t.a, vec3(2.2)) * ${LM_MAX.toFixed(1)}; }
    void main(){
      vec3 c = dec(texture2D(tSky, vUv)) * wSky * cSky;
      c += (dec(texture2D(tSunA, vUv)) * wSun.x
          + dec(texture2D(tSunB, vUv)) * wSun.y
          + dec(texture2D(tSunC, vUv)) * wSun.z) * cSun;
      c += dec(texture2D(tLamp, vUv)) * wLamp;
      c += dec(texture2D(tNight, vUv)) * wNight;
      c += dec(texture2D(tFire, vUv)) * wFire;
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthTest: false, depthWrite: false,
})));

function compositeLightmap() {
  const prev = renderer.getRenderTarget();
  renderer.setRenderTarget(lmRT);
  renderer.render(lmScene, lmCam);
  renderer.setRenderTarget(prev);
}

/* ------------------------------------------------------------------ lights */
const SUN_BASE = { v: 13.0 };
const sun = new THREE.DirectionalLight(0xffd9ad, 13.0);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 34;
sun.shadow.camera.left = -6; sun.shadow.camera.right = 6;
sun.shadow.camera.top = 6; sun.shadow.camera.bottom = -6;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.022;
sun.shadow.radius = 2.0;
sun.target.position.set(0.4, 0.6, 0.4);
scene.add(sun, sun.target);

const lampLight = new THREE.PointLight(0xffb978, 0, 5.2, 2);
lampLight.position.copy(LAMP_AT);
scene.add(lampLight);

const fireLight = new THREE.PointLight(0xff6a2a, 1.0, 4.6, 2);
fireLight.position.copy(FIRE_AT);
scene.add(fireLight);

const fillHemi = new THREE.HemisphereLight(0x9fb8e8, 0x6b5a46, 0.03);
scene.add(fillHemi);

/* the globe corner is genuinely dark; stage it when the viewer goes to look */
const globeLight = new THREE.PointLight(0xfff2e0, 0.0, 0.62, 2);
globeLight.position.set(2.03, 1.06, 1.12);      // short throw: dies before the wall
scene.add(globeLight);
const globeFill = new THREE.PointLight(0xc6d8f4, 0.0, 0.55, 2);
globeFill.position.set(2.30, 0.56, 1.02);
scene.add(globeFill);

// The shelf sits in a deep recess on the wall away from the window, so the bake
// correctly leaves it dim - but it is also the portfolio menu and has to be
// readable. Two short-throw lamps fade in only while that view is held.
const shelfLight = new THREE.PointLight(0xffe9cf, 0.0, 1.45, 2);
shelfLight.position.set(2.28, 1.46, 0.62);
scene.add(shelfLight);
const shelfFill = new THREE.PointLight(0xffdfc0, 0.0, 1.30, 2);
shelfFill.position.set(2.30, 0.66, -0.05);
scene.add(shelfFill);

/* ------------------------------------------------------------------ sky */
const sky = createSky(scene, GOD_LAYER);
const backdrop = createBackdrop(scene, skyTex.day, skyTex.night, GOD_LAYER);
const lawn = new THREE.Mesh(
  new THREE.PlaneGeometry(22, 24),
  new THREE.MeshStandardMaterial({ color: 0x2b3a1c, roughness: 0.95 })
);
lawn.rotation.x = -Math.PI / 2;
lawn.position.set(-12.5, -0.04, 0);
scene.add(lawn);

const sunDir = new THREE.Vector3();

/* ------------------------------------------------------------------ model */
const parts = {};
let roomRoot = null, triCount = 0;
let books = null, globe = null, props = null, dust = null, sparks = null, cord = null;
let phys = null, physMeshes = [], dragMesh = null, pressInfo = null, tidyCheck = 0;
let curtainDrag = null;
let curtainUni = null, rainUni = null;
const lmMaterials = [];

function buildGLB(json, bin) {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const pad = (n) => (4 - (n % 4)) % 4;
  const jPad = pad(jsonBytes.length), bPad = pad(bin.length);
  const total = 12 + 8 + jsonBytes.length + jPad + 8 + bin.length + bPad;
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
  let o = 12;
  dv.setUint32(o, jsonBytes.length + jPad, true); dv.setUint32(o + 4, 0x4E4F534A, true); o += 8;
  u8.set(jsonBytes, o); o += jsonBytes.length;
  for (let i = 0; i < jPad; i++) u8[o++] = 0x20;
  dv.setUint32(o, bin.length + bPad, true); dv.setUint32(o + 4, 0x004E4942, true); o += 8;
  u8.set(bin, o);
  return buf;
}
function b64ToBytes(b64) {
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
function fetchModel(url) {
  return new Promise((res, rej) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'text';
    xhr.onprogress = (e) => {
      const t = e.lengthComputable ? e.total : 4.9e6;
      glbPct = Math.max(glbPct, Math.min(0.97, e.loaded / t)); paintProgress();
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300)
      ? res(xhr.responseText) : rej(new Error('HTTP ' + xhr.status));
    xhr.onerror = () => rej(new Error('network error'));
    xhr.send();
  });
}

const NO_LIGHTMAP = new Set(['Globe_Map', 'Glass', 'Flame', 'EmberGlow', 'Ember', 'Bulb']);

function onModel(gltf) {
  roomRoot = gltf.scene;
  roomRoot.traverse((o) => {
    if (!o.isMesh) return;
    const mat = o.material;
    triCount += o.geometry.index ? o.geometry.index.count / 3
                                 : o.geometry.attributes.position.count / 3;
    if (mat) {
      mat.side = THREE.FrontSide;
      for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) {
        const t = mat[slot];
        if (!t) continue;
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        // the normal and roughness maps drive the shimmer, so they get the most
        // filtering, not the least - this was backwards before
        t.anisotropy = MAX_ANISO;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = true;
        t.needsUpdate = true;
      }
    }
    const n = mat ? mat.name : '';
    if (mat && mat.normalScale) {
      const soft = { Fabric_Linen: 0.45, Fabric_Charcoal: 0.42, Fabric_Curtain: 0.55,
                     Fabric_Throw: 0.50, Wool_Rug: 0.55, Books: 0.65, Books_Portfolio: 0.7 };
      if (soft[n]) mat.normalScale.multiplyScalar(soft[n]);
    }

    if (n === 'Glass') {
      const g = new THREE.MeshPhysicalMaterial({
        color: 0xeaf2ef, metalness: 0, roughness: 0.03, transparent: true,
        opacity: 0.07, envMapIntensity: 2.4, depthWrite: false, side: THREE.DoubleSide,
      });
      g.map = mat.map || null;
      rainUni = rainMaterial(g);
      o.material = g; parts.glass = o; return;
    }
    if (n === 'Flame') { parts.flame = o; o.layers.enable(GOD_LAYER); return; }
    if (n === 'EmberGlow') { parts.glow = o; o.layers.enable(GOD_LAYER); return; }
    if (n === 'Ember') { parts.ember = o; o.layers.enable(GOD_LAYER); return; }
    if (n === 'Bulb') { parts.bulb = o; o.layers.enable(GOD_LAYER); return; }

    o.castShadow = true;
    o.receiveShadow = true;

    if (!NO_LIGHTMAP.has(n) && o.geometry.attributes.uv1) {
      mat.aoMap = aoTex;
      mat.aoMapIntensity = 1.0;
      mat.lightMap = lmRT.texture;
      mat.lightMapIntensity = LM_SCALE;
      if (!lmMaterials.includes(mat)) lmMaterials.push(mat);
    }
    if (n === 'Floor_Oak') { parts.floor = o; mat.envMapIntensity = 1.55; mat.roughness = 0.56; }
    if (n === 'Globe_Map') { parts.globeMat = mat; mat.envMapIntensity = 2.6; mat.roughness = 0.62; }
    if (n === 'Fabric_Curtain' && !curtainUni) curtainUni = patchCurtains(mat);
    if (n.startsWith('Metal')) mat.envMapIntensity = 1.8;
    if (n === 'Stone_Travertine' || n === 'Wood_Walnut' || n === 'Wood_Oak') mat.envMapIntensity = 1.25;
    // applied last so it composes on top of any material-specific patch above
    if (mat && mat.isMeshStandardMaterial) patchSpecAA(mat);
  });
  scene.add(roomRoot);
  setupFX();
  ready();
}

/* Specular antialiasing.
 *
 * SMAA smooths silhouettes in the final colour buffer; it cannot touch the
 * shimmer that comes from a surface. That shimmer is a filtering problem: when
 * the GPU halves a normal map, four normals pointing different ways average
 * toward flat, so a tiled fabric seen at a grazing angle flickers between rough
 * and smooth as the camera moves a fraction of a pixel.
 *
 * The fix is to measure how fast the shading normal varies across one pixel and
 * fold that variance back into roughness - a surface that loses its bumps to
 * filtering gains the roughness those bumps represented. Toksvig's idea, in the
 * per-pixel form (Kaplanyan et al.) that needs no offline mip chain.
 */
const SPEC_AA_GLSL = `
  {
    vec3 sa_dNx = dFdx( normal );
    vec3 sa_dNy = dFdy( normal );
    float sa_var = uSpecAA * ( dot( sa_dNx, sa_dNx ) + dot( sa_dNy, sa_dNy ) );
    float sa_k = min( sa_var, uSpecAAMax );
    float sa_r = material.roughness;
    material.roughness = min( 1.0, sqrt( sa_r * sa_r + sa_k ) );
  }
`;
const specAAUniforms = { uSpecAA: { value: 0.62 }, uSpecAAMax: { value: 0.30 } };

function injectSpecAA(shader) {
  shader.uniforms.uSpecAA = specAAUniforms.uSpecAA;
  shader.uniforms.uSpecAAMax = specAAUniforms.uSpecAAMax;
  shader.fragmentShader = shader.fragmentShader
    .replace('void main() {', 'uniform float uSpecAA;\nuniform float uSpecAAMax;\nvoid main() {')
    .replace('#include <lights_physical_fragment>',
             '#include <lights_physical_fragment>' + SPEC_AA_GLSL);
}

// composes with whatever patch a material already carries (curtains, glass)
function patchSpecAA(mat) {
  if (!mat || mat.userData.__specAA) return mat;
  mat.userData.__specAA = true;
  const prevCompile = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer);
    injectSpecAA(shader);
  };
  // three's default cache key reads `this`, so keep it a real function and
  // call the previous one bound to the material
  const prevKey = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (prevKey ? prevKey.call(this) : '') + '|saa1';
  };
  mat.needsUpdate = true;
  return mat;
}

function patchCurtains(mat) {
  const uni = { uDraw: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uDraw;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float s = sign(transformed.z);
          float outer = 1.84 * s;
          float stretch = 1.0 + uDraw * 1.46;
          transformed.z = outer - (outer - transformed.z) * stretch;
          float fold = transformed.x - (-2.83);
          transformed.x = -2.83 + fold / stretch;
        }`);
  };
  mat.customProgramCacheKey = () => 'curtain-draw';
  mat.needsUpdate = true;
  return uni;
}

function fail(err) {
  console.error(err);
  ui.lpct.textContent = 'Could not load the room';
  ui.lbar.style.transform = 'scaleX(1)';
  ui.lbar.style.background = '#8a4a3c';
}

fetchModel('./assets/room.json').then((text) => {
  const json = JSON.parse(text);
  const bin = b64ToBytes(json._bin);
  delete json._bin;
  glbPct = 1; paintProgress();
  new GLTFLoader(manager).parse(buildGLB(json, bin), './assets/', onModel, fail);
}).catch(fail);

/* ------------------------------------------------------------------ fire fx */
function setupFX() {
  if (parts.flame) {
    parts.flame.material = new THREE.ShaderMaterial({
      uniforms: { tF: { value: flameTex }, uT: { value: 0 }, uI: { value: 1 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform sampler2D tF; uniform float uT, uI; varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          uv.x += sin(uv.y * 7.0 + uT * 2.3) * 0.022 * uv.y;
          vec4 t = texture2D(tF, vec2(uv.x, clamp(vUv.y + sin(uT * 1.7 + vUv.x * 4.0) * 0.01, 0.0, 1.0)));
          float a = t.a * uI;
          if (a < 0.01) discard;
          gl_FragColor = vec4(t.rgb * (0.85 + 0.22 * sin(uT * 6.0 + vUv.x * 9.0)) * uI, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, toneMapped: true,
    });
  }
  for (const k of ['glow', 'ember', 'bulb']) {
    const o = parts[k];
    if (o && o.material) {
      o.material.toneMapped = true;
      if (k === 'glow') {
        o.material.transparent = true;
        o.material.depthWrite = false;
        o.material.blending = THREE.AdditiveBlending;
      }
      o.material.userData.baseEmissive = o.material.emissiveIntensity ?? 1;
    }
  }
  // every book was unwrapped to the whole spine sheet, which puts twenty spines
  // on one volume. Give each book a single spine instead, picked by its name so
  // the shelf looks the same on every load.
  const BOOKISH = /^IX_(BSB|BSS|CT_Books|FL_Books|ST_Books)/;
  roomRoot.traverse((o) => {
    const nm = o.name || '';
    if (!BOOKISH.test(nm) || !o.geometry.attributes.uv) return;
    let h = 2166136261;
    for (let i = 0; i < nm.length; i++) { h ^= nm.charCodeAt(i); h = Math.imul(h, 16777619); }
    const r1 = ((h >>> 8) & 1023) / 1023;
    const r2 = ((h >>> 18) & 255) / 255;
    const w = 0.040 + r2 * 0.018;
    const u0 = 0.015 + r1 * (0.97 - w);
    const uv = o.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * w, 0.055 + uv.getY(i) * 0.885);
    }
    uv.needsUpdate = true;
  });

  // the spine faces -X, so its U runs the other way: flip within each atlas slice
  roomRoot.traverse((o) => {
    if (!/^IX_Book_/.test(o.name || '')) return;
    const uv = o.geometry.attributes.uv;
    if (!uv) return;
    const n = 9;
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i);
      const slice = Math.min(n - 1, Math.max(0, Math.floor(u * n + 1e-4)));
      uv.setX(i, (2 * slice + 1) / n - u);
    }
    uv.needsUpdate = true;
  });
  books = setupBooks(roomRoot);
  globe = setupGlobe(roomRoot, scene);
  props = setupProps(roomRoot, ['IX_Mug', 'IX_Bowl', 'IX_FireLog_0', 'IX_FireLog_1',
                                'IX_FireLog_2', 'IX_FireLog_3']);
  buildCV();
  buildGuestbook();
  buildClock();
  buildSteam();
  // The cat is not built. A procedural quadruped good enough to sit beside the
  // rest of this room is a bigger piece of work than it looks, and a mediocre
  // one costs more than it adds. src/cat.js is kept for a proper pass in
  // Blender, where she can be shaped and lit like everything else here.
  guest = createGuestbook(createFirebaseStore(CONFIG.firebase));
  guest.onChange(() => { if (ui.panel.classList.contains('on') &&
    /visitor book/i.test(ui.panelBody.textContent || '')) renderGuestPanel(); });
  guest.init();
  setupPhysics().then(() => {
    setShelfMerged(STATE.quality === 'low');
    walk = createWalk(camera, canvas, phys);
  });
  sparks = createSparks(scene);
  cord = createCord(scene, CORD_ANCHOR, { segments: 9, length: 0.285 });
}

/* A small parallax from the handset's own orientation. iOS needs the request to
 * come from a user gesture, so it rides on the same click that starts the room,
 * and a refusal is simply ignored. */
let gyro = null;
function enableGyro() {
  if (gyro || !matchMedia('(pointer: coarse)').matches) return;
  const attach = () => {
    gyro = { b: 0, g: 0, b0: null, g0: null };
    addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      if (gyro.b0 === null) { gyro.b0 = e.beta; gyro.g0 = e.gamma; }
      gyro.b = THREE.MathUtils.clamp((e.beta - gyro.b0) / 34, -1, 1);
      gyro.g = THREE.MathUtils.clamp((e.gamma - gyro.g0) / 34, -1, 1);
    }, { passive: true });
  };
  try {
    const DO = window.DeviceOrientationEvent;
    if (DO && typeof DO.requestPermission === 'function') {
      DO.requestPermission().then((r) => { if (r === 'granted') attach(); }).catch(() => {});
    } else if (DO) attach();
  } catch (e) { /* not available; the room is unaffected */ }
}

/* ------------------------------------------------------------------ walk mode */
let walk = null;

function setWalk(on) {
  if (!walk || !phys) return;
  if (on === walk.active) return;
  if (on) {
    closePanel();
    camAnim = null;
    controls.enabled = false;
    walk.enter();
    document.body.classList.add('walking');
    // on a handset the bar would sit under the thumbstick, so it steps aside
    if (matchMedia('(pointer: coarse)').matches || innerWidth < 900) setTucked(true);
  } else {
    walk.exit();
    // hand the orbit pivot a point in front of where you were standing
    const d = camera.getWorldDirection(new THREE.Vector3());
    controls.target.copy(camera.position).addScaledVector(d, 1.9);
    controls.target.y = Math.max(0.5, controls.target.y);
    controls.enabled = true;
    controls.update();
    document.body.classList.remove('walking');
  }
  const b = document.getElementById('btnWalk');
  if (b) { b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Orbit' : 'Walk'; }
  if (hints) hints.setVisible(!on);
}

/* ------------------------------------------------------------------ wall clock */
let clockHands = null;

/* The dial and case are baked with the rest of the room; only the hands move,
 * so they come out of the model as IX_ objects with no lightmap. prep() bakes
 * world transforms into them, which means turning them directly would swing
 * them around the world origin — so each one is hung in a group at the clock's
 * centre and the group is what rotates. */
// Mirrors build_props.wall_clock: x and z there, converted to three's Y-up
// frame. The wall is at z = -2.40 and the dial faces back into the room.
const CLOCK_AT = new THREE.Vector3(0.0, 2.06, -2.328);

function buildClock() {
  if (clockHands || !roomRoot) return;
  const h = roomRoot.getObjectByName('IX_ClockH');
  const m = roomRoot.getObjectByName('IX_ClockM');
  if (!h || !m) return;
  clockHands = { hour: null, min: null };
  for (const [key, obj] of [['hour', h], ['min', m]]) {
    const g = new THREE.Group();
    g.position.copy(CLOCK_AT);
    roomRoot.add(g);
    g.attach(obj);              // keeps the hand exactly where it is on screen
    clockHands[key] = g;
  }
}

function updateClock() {
  if (!clockHands) return;
  const d = new Date();
  const mm = d.getMinutes() + d.getSeconds() / 60;
  const hh = (d.getHours() % 12) + mm / 60;
  // the dial faces +Z, so clockwise from the viewer's side is negative about Z
  clockHands.min.rotation.z = -(mm / 60) * Math.PI * 2;
  clockHands.hour.rotation.z = -(hh / 12) * Math.PI * 2;
}

/* ------------------------------------------------------------------ mug steam */
let steam = null;
const STEAM_N = 48;

function buildSteam() {
  if (steam) return;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(STEAM_N * 3);
  const seed = new Float32Array(STEAM_N);
  for (let i = 0; i < STEAM_N; i++) seed[i] = Math.random();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const cg = c.getContext('2d');
  const rg = cg.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)');
  rg.addColorStop(0.45, 'rgba(255,255,255,0.28)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  cg.fillStyle = rg; cg.fillRect(0, 0, 64, 64);
  const sprite = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({
    size: 0.044, map: sprite, transparent: true, opacity: 0.0, depthWrite: false,
    color: 0xe8e2d6, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  steam = { pts, geo, mat, seed, life: 1, origin: new THREE.Vector3(-0.355, 0.525, 0.495) };
}

function updateSteam(dt, t) {
  if (!steam) return;
  // the tea goes cold: the plume thins out over a couple of minutes
  steam.life = Math.max(0, steam.life - dt / 150);
  const o = steam.mat;
  o.opacity = 0.085 * steam.life;
  if (o.opacity < 0.004) { steam.pts.visible = false; return; }
  steam.pts.visible = true;
  const pos = steam.geo.attributes.position.array;
  for (let i = 0; i < STEAM_N; i++) {
    const u = (t * 0.17 + steam.seed[i]) % 1;
    const rise = u * 0.19;
    const spread = 0.008 + u * 0.030;
    const a = steam.seed[i] * Math.PI * 2 + t * 0.5;
    pos[i * 3] = steam.origin.x + Math.sin(a) * spread;
    pos[i * 3 + 1] = steam.origin.y + rise;
    pos[i * 3 + 2] = steam.origin.z + Math.cos(a * 1.3) * spread;
  }
  steam.geo.attributes.position.needsUpdate = true;
  o.size = 0.030 + 0.026 * (1 - steam.life);
}

/* ------------------------------------------------------------------ cat */
let cat = null;

// places she is willing to settle, and how she sits when she gets there
// She sleeps on the armchair and stays there. The walking version was only ever
// going to be "recognisable", and a cat you can tell is a cat asleep beats a
// cat you have to squint at walking.
const CAT_SPOTS = [];

function buildCat() {
  if (cat) return;
  cat = createCat(scene, {
    color: 0x6f6358,
    // on the armchair cushion, forward of the throw, sinking a couple of
    // centimetres into it the way something warm actually sits
    start: { x: 1.90, z: 0.07 },
    yaw: 2.25,
    spots: CAT_SPOTS,
    sleepOnly: true,
    lift: 0.545,
    onMeow: () => audio.meow && audio.meow(),
  });
}

/* ------------------------------------------------------------------ guestbook */
let guest = null, guestObj = null;

function makeSpineLabel() {
  // gilt lettering to match the portfolio spines, drawn rather than baked so it
  // costs no bake and stays crisp up close
  const c = document.createElement('canvas');
  c.width = 128; c.height = 640;
  const g = c.getContext('2d');
  g.fillStyle = '#6d4526'; g.fillRect(0, 0, c.width, c.height);
  const grain = g.createLinearGradient(0, 0, c.width, 0);
  grain.addColorStop(0, 'rgba(0,0,0,0.35)');
  grain.addColorStop(0.5, 'rgba(255,255,255,0.05)');
  grain.addColorStop(1, 'rgba(0,0,0,0.40)');
  g.fillStyle = grain; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#e3c184'; g.lineWidth = 3;
  for (const y of [120, 132, 508, 520]) {
    g.beginPath(); g.moveTo(22, y); g.lineTo(106, y); g.stroke();
  }
  g.save();
  g.translate(c.width / 2, c.height / 2);
  g.rotate(-Math.PI / 2);
  g.fillStyle = '#f0d9a4';
  g.font = '600 46px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.letterSpacing = '7px';
  g.fillText('VISITORS', 0, 4);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
}

function buildGuestbook() {
  if (guestObj) return;
  // It belongs among the portfolio spines, not lying on a shelf where you would
  // only ever see its edge. One volume, a little taller than its neighbours.
  // the shelf is full, so it goes in the one real gap: just past NIVRAM at the
  // end of the portfolio row, narrow enough to fit and taller so it is obvious
  const W = 0.030, H = 0.272, D = 0.152;
  const leather = new THREE.MeshStandardMaterial({ color: 0x7a4f2e, roughness: 0.62 });
  const pages = new THREE.MeshStandardMaterial({ color: 0x8e8878, roughness: 0.92 });
  const spine = new THREE.MeshStandardMaterial({ map: makeSpineLabel(), roughness: 0.60 });
  // box faces: +x -x +y -y +z -z. The spine faces -x, out into the room.
  const geo = new THREE.BoxGeometry(D, H, W);
  const book = new THREE.Mesh(geo, [pages, spine, leather, leather, leather, leather]);
  book.castShadow = true;
  book.receiveShadow = true;
  book.name = 'IX_Guestbook';
  book.position.set(2.770, 1.224 + H / 2, 0.919);
  book.rotation.set(0, 0, THREE.MathUtils.degToRad(1.5));
  guestObj = book;
  scene.add(book);
}

function guestHTML(entries, status, canSign) {
  const head = `<div class="p-kind">The visitor book</div><h2>Leave a mark</h2>`;
  if (status === 'loading') return head + `<p class="g-muted">Opening the book…</p>`;
  if (status === 'unconfigured') {
    return head + `<p>The book is not wired up in this build. Everything else in
      the room works without it.</p>`;
  }
  if (status === 'unavailable') {
    return head + `<p>Could not reach the book just now — it may be blocked on
      this page. Try the hosted version, or come back in a moment.</p>`;
  }
  const list = entries.length
    ? entries.map((e) => `<div class="g-row"><b>${esc(e.name || 'Anonymous')}</b>
        <span>${esc(e.note || '')}</span>
        <i>${e.at ? new Date(e.at).toLocaleDateString() : ''}</i></div>`).join('')
    : `<p class="g-muted">Nobody has signed yet. You would be the first.</p>`;
  const form = canSign ? `
    <form id="gForm" class="g-form" autocomplete="off">
      <input id="gName" maxlength="40" placeholder="Your name" />
      <textarea id="gNote" maxlength="180" rows="2" placeholder="Say something"></textarea>
      <button type="submit">Sign the book</button>
      <span class="g-msg" id="gMsg"></span>
    </form>` : '';
  const count = entries.length
    ? `<p>${entries.length} ${entries.length === 1 ? 'person has' : 'people have'} signed.</p>`
    : '';
  return head + count + `<div class="g-list">${list}</div>` + form;
}

function esc(t) {
  return String(t).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderGuestPanel() {
  if (!guest) return;
  ui.panelBody.innerHTML = guestHTML(guest.entries, guest.status, guest.canSign);
  const f = document.getElementById('gForm');
  if (!f) return;
  const mine = guest.mine;
  if (mine) {
    document.getElementById('gName').value = mine.name || '';
    document.getElementById('gNote').value = mine.note || '';
  }
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('gMsg');
    msg.textContent = 'Signing…';
    const r = await guest.sign(document.getElementById('gName').value,
                               document.getElementById('gNote').value);
    msg.textContent = r.ok ? 'Signed — thank you.'
      : r.why === 'empty' ? 'Write a line first.' : 'Could not save that.';
  });
}

function openGuestbook() {
  STATE.openBook = -1;
  renderGuestPanel();
  ui.panel.classList.add('on');
  panelOpen(true);
  setDeepLink('guestbook');
}

/* ------------------------------------------------------------------ physics */
const PHYS_SKIP = new Set(['IX_Globe', 'IX_GlobePin', 'IX_ClockH', 'IX_ClockM']);
// the nine portfolio books are navigation, not scenery: they slide out on a tap
// and must not be draggable, or the shelf stops being a menu
const PHYS_SKIP_RE = /^IX_Book_/;

async function setupPhysics() {
  let data = null;
  try {
    const r = await fetch('./assets/colliders.json');
    if (r.ok) data = await r.json();
  } catch (e) { /* physics is an enhancement, not a dependency */ }
  if (!data) return;

  phys = createPhysics(scene, data, {
    onImpact(mesh, force, kind) {
      audio.thud(force, kind === 'cyl' ? 'hard' : 'soft');
    },
  });
  physMeshes = [];
  // Some objects left Blender as more than one mesh - the mug and its handle.
  // Registering each as its own body made the handle a separate draggable
  // thing. Anything named <body>_<Part> is attached to its body instead, after
  // registration (which recentres the body's geometry) so the part keeps its
  // place, and is kept out of the physics list entirely.
  const byName = new Map();
  roomRoot.traverse((o) => { if (o.isMesh && o.name) byName.set(o.name, o); });
  const parts = [];
  for (const [n, o] of byName) {
    const cut = n.lastIndexOf('_');
    if (cut <= 3) continue;
    const parent = byName.get(n.slice(0, cut));
    if (parent && parent !== o && n.startsWith('IX_')) parts.push([parent, o]);
  }
  const partSet = new Set(parts.map(([, c]) => c));

  roomRoot.traverse((o) => {
    if (!o.isMesh) return;
    const n = o.name || '';
    if (!n.startsWith('IX_') || PHYS_SKIP.has(n) || PHYS_SKIP_RE.test(n)) return;
    if (partSet.has(o)) return;
    phys.register(o);
    physMeshes.push(o);
    // a book wedged in a shelf has its shadow baked already; only pay for a
    // real-time one once it has actually moved
    if (/^IX_BSB/.test(n)) o.castShadow = false;
  });
  // attach() keeps the part where it is on screen while reparenting it
  for (const [parent, child] of parts) parent.attach(child);
  updateTidyButton();
}

/* On a phone the shelf alone is ~100 draw calls of a dozen triangles each. At
 * low quality the undisturbed books are drawn as one merged mesh instead; they
 * all share a material and a lightmap atlas, so merging is lossless. Any book
 * that has been moved keeps its own mesh. */
let shelfMerged = null, shelfSrc = [];
function setShelfMerged(on) {
  if (!roomRoot) return;
  if (!shelfSrc.length) {
    roomRoot.traverse((o) => { if (o.isMesh && /^IX_BSB/.test(o.name || '')) shelfSrc.push(o); });
  }
  if (!shelfSrc.length) return;
  if (on && !shelfMerged) {
    const geos = [];
    for (const o of shelfSrc) {
      const g = o.geometry.clone();
      o.updateMatrixWorld(true);
      g.applyMatrix4(o.matrixWorld);
      geos.push(g);
    }
    try {
      const merged = mergeGeometries(geos, false);
      if (merged) {
        shelfMerged = new THREE.Mesh(merged, shelfSrc[0].material);
        shelfMerged.name = 'ShelfBooksMerged';
        shelfMerged.castShadow = false;
        shelfMerged.receiveShadow = true;
        roomRoot.add(shelfMerged);
        for (const o of shelfSrc) o.visible = false;
      }
    } catch (e) { /* fall back to individual meshes */ }
    for (const g of geos) g.dispose();
  } else if (!on && shelfMerged) {
    roomRoot.remove(shelfMerged);
    shelfMerged.geometry.dispose();
    shelfMerged = null;
    for (const o of shelfSrc) o.visible = true;
  }
  // a book that has been pulled out always draws on its own
  if (shelfMerged && phys) {
    for (const o of shelfSrc) if (phys.isDisturbed(o)) o.visible = true;
  }
}

function physRoot(o) {
  for (let p = o; p; p = p.parent) if (physMeshes.includes(p)) return p;
  return null;
}

function updateTidyButton() {
  // keep the merged stand-in honest: a book that has been pulled out draws itself
  if (shelfMerged && phys) {
    for (const o of shelfSrc) {
      const want = phys.isDisturbed(o);
      if (o.visible !== want) o.visible = want;
    }
  }
  const b = document.getElementById('btnTidy');
  if (!b) return;
  const n = phys ? phys.disturbed() : 0;
  b.classList.toggle('on', n > 0);
  b.disabled = n === 0;
  b.title = n ? `Put ${n} thing${n > 1 ? 's' : ''} back` : 'Nothing to tidy';
}


/* ------------------------------------------------------------------ env probe */
let envRT = null, envPending = 0;
function captureEnv() {
  const cube = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
  const cam = new THREE.CubeCamera(0.1, 60, cube);
  cam.position.set(0, 1.35, -0.1);
  const hidden = [];
  for (const k of ['flame', 'glow', 'ember', 'bulb']) {
    if (parts[k]) { hidden.push(parts[k]); parts[k].visible = false; }
  }
  if (dust) dust.pts.visible = false;
  cam.update(renderer, scene);
  hidden.forEach((o) => { o.visible = true; });
  if (dust) dust.pts.visible = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  if (envRT) envRT.dispose();
  envRT = pmrem.fromCubemap(cube.texture);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.30;
  cube.dispose(); pmrem.dispose();
}

/* ------------------------------------------------------------------ post */
let composer, bloom, godPass, grainPass, godRT, blackMat, smaaPass, ssrPass, sceneRT;
const godUniforms = {
  tDiffuse: { value: null }, tGod: { value: null },
  uCenter: { value: new THREE.Vector2(0.2, 0.55) },
  uStrength: { value: 0.16 }, uDecay: { value: 0.955 },
  uDensity: { value: 0.52 }, uWeight: { value: 0.055 }, uSamples: { value: 28 },
  uThresh: { value: 1.10 }, uFade: { value: 1.0 },
};

/* Floor reflections.
 *
 * The oak floor is a third of most frames and had only a static environment
 * probe on it, so the room never appeared in its own floor. General SSR would
 * work, but the floor here is a known plane at y = 0, which makes the problem
 * much easier: the reflected ray is just the view ray with its vertical
 * component flipped, and a pixel belongs to the floor if its reconstructed
 * world height is ~0. No second scene render, no normal buffer.
 *
 * Oak at roughness 0.6 is not a mirror, so the march is deliberately coarse and
 * the result is blurred by distance - what we want is the fire and the window
 * smeared into the boards, not a reflection you could read.
 */
const ssrUniforms = {
  tDiffuse: { value: null },
  tDepth: { value: null },
  uInvProj: { value: new THREE.Matrix4() },
  uInvView: { value: new THREE.Matrix4() },
  uProj: { value: new THREE.Matrix4() },
  uView: { value: new THREE.Matrix4() },
  uCamPos: { value: new THREE.Vector3() },
  uRes: { value: new THREE.Vector2(1, 1) },
  uNear: { value: 0.05 },
  uFar: { value: 60 },
  uStrength: { value: 0.70 },
  uSteps: { value: 26 },
  uMaxDist: { value: 7.0 },
  uBlur: { value: 1.0 },
  uDebug: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uContact: { value: 0.45 },
  uContactLen: { value: 0.34 },
};

class SceneToTargetPass extends Pass {
  constructor(scn, cam, target) {
    super();
    this.scn = scn; this.cam = cam; this.target = target;
    this.needsSwap = false;
  }
  setSize(w, h) { this.target.setSize(w, h); }
  render(renderer) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(this.target);
    renderer.render(this.scn, this.cam);
    renderer.setRenderTarget(prev);
  }
}

function makeSSRPass(src) {
  ssrUniforms.tDepth.value = src.depthTexture;
  ssrUniforms.tDiffuse.value = src.texture;
  const pass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: ssrUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse, tDepth;
      uniform mat4 uInvProj, uInvView, uProj, uView;
      uniform vec3 uCamPos;
      uniform vec2 uRes;
      uniform float uNear, uFar, uStrength, uMaxDist, uBlur;
      uniform float uContact, uContactLen;
      uniform vec3 uSunDir;
      uniform int uSteps, uDebug;
      varying vec2 vUv;

      float readDepth( vec2 uv ) { return texture2D( tDepth, uv ).x; }

      // clip -> view, then view -> world
      vec3 viewFromDepth( vec2 uv, float d ) {
        vec4 clip = vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
        vec4 v = uInvProj * clip;
        return v.xyz / v.w;
      }

      void main() {
        vec3 base = texture2D( tDiffuse, vUv ).rgb;
        float d = readDepth( vUv );
        if ( uDebug == 3 ) { gl_FragColor = vec4( vec3( pow( d, 48.0 ) ), 1.0 ); return; }
        if ( d >= 1.0 || ( uStrength < 0.002 && uDebug == 0 ) ) { gl_FragColor = vec4( base, 1.0 ); return; }

        vec3 viewPos = viewFromDepth( vUv, d );
        vec3 world = ( uInvView * vec4( viewPos, 1.0 ) ).xyz;

        /* Screen-space contact shadows.
         *
         * A 2k shadow map spread over the whole room cannot resolve the few
         * centimetres where an object meets the floor, so everything floats a
         * little. Marching a short ray toward the sun through the depth buffer
         * recovers exactly that contact darkening - and unlike the baked
         * lightmap it follows objects that have been picked up and moved. */
        // a normal recovered from the depth buffer, so a surface turned away
        // from the sun is not darkened by marching straight into itself
        vec3 gN = normalize( cross( dFdx( world ), dFdy( world ) ) );
        if ( dot( gN, normalize( uCamPos - world ) ) < 0.0 ) gN = -gN;

        float contact = 0.0;
        float sunFacing = dot( gN, uSunDir );
        if ( uContact > 0.001 && uSunDir.y > 0.02 && sunFacing > 0.08 ) {
          float cstep = uContactLen / 10.0;
          vec3 cp = world + gN * 0.012 + uSunDir * cstep * 0.5;
          for ( int i = 0; i < 10; i++ ) {
            cp += uSunDir * cstep;
            vec4 cc = uProj * uView * vec4( cp, 1.0 );
            if ( cc.w <= 0.0 ) break;
            vec3 cn = cc.xyz / cc.w;
            vec2 cuv = cn.xy * 0.5 + 0.5;
            if ( cuv.x < 0.0 || cuv.x > 1.0 || cuv.y < 0.0 || cuv.y > 1.0 ) break;
            float sd = readDepth( cuv );
            if ( sd >= 1.0 ) continue;
            float rz = viewFromDepth( cuv, cn.z * 0.5 + 0.5 ).z;
            float sz = viewFromDepth( cuv, sd ).z;
            if ( rz < sz - 0.012 && rz > sz - 0.30 ) {
              // nearer blocker is darker, and a glancing sun fades it out
              contact = ( 1.0 - float( i ) / 10.0 ) * smoothstep( 0.08, 0.35, sunFacing );
              break;
            }
          }
        }
        if ( uDebug == 4 ) { gl_FragColor = vec4( vec3( 1.0 - contact * uContact ), 1.0 ); return; }
        base *= ( 1.0 - contact * uContact );

        // only the floor plane reflects; the rug sits 12 mm above it and must not
        if ( uDebug == 1 ) {
          float m = ( world.y <= 0.006 && world.y >= -0.05 ) ? 1.0 : 0.0;
          gl_FragColor = vec4( m, m * 0.3, 0.0, 1.0 ); return;
        }
        if ( world.y > 0.006 || world.y < -0.05 ) { gl_FragColor = vec4( base, 1.0 ); return; }

        vec3 V = normalize( world - uCamPos );
        if ( V.y > -0.02 ) { gl_FragColor = vec4( base, 1.0 ); return; }
        vec3 R = vec3( V.x, -V.y, V.z );

        float stepLen = uMaxDist / float( uSteps );
        vec3 p = world + R * stepLen * 0.6;
        vec3 hitCol = vec3( 0.0 );
        float hit = 0.0;
        float travelled = 0.0;

        for ( int i = 0; i < 40; i++ ) {
          if ( i >= uSteps ) break;
          p += R * stepLen;
          travelled += stepLen;

          vec4 clip = uProj * uView * vec4( p, 1.0 );
          if ( clip.w <= 0.0 ) break;
          vec3 ndc = clip.xyz / clip.w;
          vec2 uv = ndc.xy * 0.5 + 0.5;
          if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) break;

          float sceneD = readDepth( uv );
          if ( sceneD >= 1.0 ) continue;

          float rayZ = viewFromDepth( uv, ndc.z * 0.5 + 0.5 ).z;
          float sceneZ = viewFromDepth( uv, sceneD ).z;

          // the ray has gone behind something: that is the reflected surface
          if ( rayZ < sceneZ - 0.025 && rayZ > sceneZ - 1.4 ) {
            // oak is rough, so gather a soft disc rather than one sharp texel
            float rad = ( 0.004 + travelled * 0.0045 ) * uBlur;
            vec3 acc = texture2D( tDiffuse, uv ).rgb;
            acc += texture2D( tDiffuse, uv + vec2( rad, 0.0 ) ).rgb;
            acc += texture2D( tDiffuse, uv + vec2( -rad, 0.0 ) ).rgb;
            acc += texture2D( tDiffuse, uv + vec2( 0.0, rad ) ).rgb;
            acc += texture2D( tDiffuse, uv + vec2( 0.0, -rad ) ).rgb;
            hitCol = acc / 5.0;
            // fade with distance travelled and as the hit nears the screen edge
            vec2 e = min( uv, 1.0 - uv );
            float edge = smoothstep( 0.0, 0.14, min( e.x, e.y ) );
            hit = edge * ( 1.0 - smoothstep( 0.55, 1.0, travelled / uMaxDist ) );
            break;
          }
        }

        if ( uDebug == 2 ) { gl_FragColor = vec4( hit, hit, 0.0, 1.0 ); return; }
        if ( hit <= 0.0 ) { gl_FragColor = vec4( base, 1.0 ); return; }

        // grazing angles reflect more, which is what makes a wooden floor read
        float fres = pow( 1.0 - max( -V.y, 0.0 ), 2.0 );
        float k = clamp( uStrength * fres * hit, 0.0, 0.70 );
        gl_FragColor = vec4( mix( base, hitCol, k ), 1.0 );
      }`,
  }));
  // ShaderPass would otherwise overwrite tDiffuse with the chain's read buffer;
  // this pass is the source of the chain and reads the scene target instead
  pass.textureID = 'tSceneUnused';
  pass.material.depthTest = false;
  pass.material.depthWrite = false;
  return pass;
}

function setupPost() {
  const s = new THREE.Vector2();
  renderer.getDrawingBufferSize(s);
  // The scene goes to a target of its own rather than straight into the
  // composer chain. Sharing a depth texture with a buffer the chain is writing
  // to is a feedback loop - the reflection pass would be sampling a texture
  // currently attached to the framebuffer it renders into, which reads as
  // garbage. With its own target the depth is stable and nothing else touches it.
  sceneRT = new THREE.WebGLRenderTarget(s.x, s.y, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    depthTexture: new THREE.DepthTexture(s.x, s.y, THREE.UnsignedIntType),
  });
  composer = new EffectComposer(renderer);
  composer.setSize(s.x, s.y);
  composer.addPass(new SceneToTargetPass(scene, camera, sceneRT));

  // always enabled: with strength 0 it is simply the copy that feeds the chain
  ssrPass = makeSSRPass(sceneRT);
  composer.addPass(ssrPass);

  godRT = new THREE.WebGLRenderTarget(
    Math.max(160, Math.floor(s.x * 0.26)), Math.max(90, Math.floor(s.y * 0.26)),
    { type: THREE.HalfFloatType });
  blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  godUniforms.tGod.value = godRT.texture;

  godPass = new ShaderPass(new THREE.ShaderMaterial({
    uniforms: godUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse, tGod;
      uniform vec2 uCenter; uniform float uStrength, uDecay, uDensity, uWeight;
      uniform float uThresh, uFade; uniform int uSamples; varying vec2 vUv;
      void main(){
        vec3 base = texture2D(tDiffuse, vUv).rgb;
        if (uStrength * uFade < 0.002) { gl_FragColor = vec4(base, 1.0); return; }
        vec2 uv = vUv;
        vec2 delta = (uv - uCenter) * (uDensity / float(uSamples));
        float illum = 1.0; vec3 acc = vec3(0.0);
        for (int i = 0; i < 40; i++) {
          if (i >= uSamples) break;
          uv -= delta;
          vec3 s = max(texture2D(tGod, uv).rgb - uThresh, 0.0);
          acc += s * illum * uWeight;
          illum *= uDecay;
        }
        gl_FragColor = vec4(base + acc * uStrength * uFade, 1.0);
      }`,
  }));
  composer.addPass(godPass);

  bloom = new UnrealBloomPass(new THREE.Vector2(s.x, s.y), 0.42, 0.72, 0.80);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  smaaPass = new SMAAPass();
  if (smaaPass.setSize) smaaPass.setSize(s.x, s.y);
  composer.addPass(smaaPass);

  grainPass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uT: { value: 0 },
      uGrain: { value: 0.014 }, uVig: { value: 0.52 }, uAb: { value: 0.0012 },
      uCon: { value: 1.115 }, uSat: { value: 1.12 }, uLift: { value: 0.003 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float uT, uGrain, uVig, uAb, uCon, uSat, uLift;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 d = vUv - 0.5;
        vec2 off = d * uAb * (0.4 + dot(d, d) * 2.2);
        vec3 c;
        c.r = texture2D(tDiffuse, vUv + off).r;
        c.g = texture2D(tDiffuse, vUv).g;
        c.b = texture2D(tDiffuse, vUv - off).b;
        c = (c - 0.5) * uCon + 0.5;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(vec3(l), c, uSat);
        c += uLift * (1.0 - l);
        c *= clamp(1.0 - uVig * dot(d, d) * 1.55, 0.0, 1.0);
        c = clamp(c, 0.0, 1.0);
        float g = hash(vUv * vec2(1920.0, 1080.0) + fract(uT) * 91.7) - 0.5;
        c += g * uGrain * (1.25 - 0.75 * l);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  grainPass.renderToScreen = true;
  composer.addPass(grainPass);
}

const _clear = new THREE.Color();
function renderGodSource() {
  const old = renderer.getRenderTarget();
  renderer.getClearColor(_clear);
  const oldAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(godRT);
  renderer.setClearColor(0x000000, 1);
  renderer.clear(true, true, false);
  scene.overrideMaterial = blackMat;
  camera.layers.set(0);
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  camera.layers.set(GOD_LAYER);
  const ac = renderer.autoClear; renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = ac;
  camera.layers.set(0);
  camera.layers.enable(GOD_LAYER);
  renderer.setClearColor(_clear, oldAlpha);
  renderer.setRenderTarget(old);
}

/* ------------------------------------------------------------------ audio */
const audio = createAudio();

/* ------------------------------------------------------------------ state */
function weights(t) {
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const tri = (x, c, w) => clamp01(1 - Math.abs(x - c) / w);
  const dayFade = clamp01(1 - (t - 0.70) / 0.22);
  return {
    sky: clamp01(1.08 - t * 0.35) * dayFade,
    sun: new THREE.Vector3(tri(t, 0.00, 0.42), tri(t, 0.42, 0.34), tri(t, 0.68, 0.28))
      .multiplyScalar(dayFade),
    night: clamp01((t - 0.72) / 0.26),
  };
}

function setTime(t, snap) {
  STATE.timeTarget = THREE.MathUtils.clamp(t, 0, 1);
  if (STATE.timeTarget > 0.42) ensureLateLightmaps();   // heading for dusk
  if (snap) STATE.time = STATE.timeTarget;
  envPending = 1.4;
  shadowDirty = 3;
  const slider = document.getElementById('timeRange');
  if (slider && +slider.value !== Math.round(STATE.timeTarget * 1000))
    slider.value = Math.round(STATE.timeTarget * 1000);
  if (STATE.timeTarget > 0.62 && STATE.lampTarget < 0.5) setLamp(true);
  updateTimeLabel();
}
function updateTimeLabel() {
  const t = STATE.timeTarget;
  const label = t < 0.18 ? 'Midday' : t < 0.52 ? 'Afternoon' : t < 0.74 ? 'Golden hour'
    : t < 0.9 ? 'Dusk' : 'Night';
  const el = document.getElementById('timeLabel');
  if (el) el.textContent = label;
}
function setFire(v) {
  STATE.fireTarget = v ? 1 : 0;
  document.getElementById('btnFire').setAttribute('aria-pressed', String(!!v));
}
function setLamp(v) {
  STATE.lampTarget = typeof v === 'number' ? THREE.MathUtils.clamp(v, 0, 1) : (v ? 1 : 0);
  if (STATE.lampTarget > 0) ensureLateLightmaps();
  document.getElementById('btnLamp').setAttribute('aria-pressed', String(STATE.lampTarget > 0.05));
}
function setCurtain(v) {
  // accepts a number as well as a boolean, so the drag can set any opening
  STATE.curtainTarget = typeof v === 'number' ? THREE.MathUtils.clamp(v, 0, 1) : (v ? 1 : 0);
  shadowDirty = 3;
  const b = document.getElementById('btnCurtain');
  if (b) b.setAttribute('aria-pressed', String(STATE.curtainTarget > 0.5));
}
function setWeather(w) {
  STATE.weather = w;
  document.querySelectorAll('#weatherSeg button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.weather === w)));
  envPending = 1.2; shadowDirty = 3;
}

let camAnim = null;
function flyTo(viewKey, dur = 1.25) {
  const portrait = innerWidth / innerHeight < 0.92;
  const V = VIEWS[viewKey];
  const src = portrait && V.p ? { ...V, ...V.p } : V;
  camAnim = {
    t: 0, dur,
    p0: camera.position.clone(), p1: new THREE.Vector3(...src.pos),
    t0: controls.target.clone(), t1: new THREE.Vector3(...src.tgt),
    f0: hfovBase, f1: V.hfov,
  };
  fovBoostTarget = 0;
}
function setView(v) {
  STATE.view = v;
  document.querySelectorAll('#viewSeg button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.view === v)));
  flyTo(v);
}

const QUALITY = {
  high:   { dpr: Math.min(devicePixelRatio, 2),   shadow: 2048, dust: 1500, god: 28, grain: 0.014 },
  medium: { dpr: Math.min(devicePixelRatio, 1.5), shadow: 1024, dust: 850,  god: 18, grain: 0.012 },
  low:    { dpr: 1,                               shadow: 512,  dust: 420,  god: 10, grain: 0.010 },
};
function setQuality(q) {
  STATE.quality = q;
  const c = QUALITY[q];
  renderer.setPixelRatio(c.dpr);
  sun.shadow.mapSize.set(c.shadow, c.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  shadowDirty = 3;
  godUniforms.uSamples.value = c.god;
  if (grainPass) grainPass.uniforms.uGrain.value = c.grain;
  if (dust) dust.dispose();
  dust = createDust(scene, c.dust, sunDir, WINDOW);
  setShelfMerged(q === 'low');
  if (ssrPass) {
    const ssr = { low: { steps: 0, strength: 0.0 },
                  medium: { steps: 18, strength: 0.60 },
                  high: { steps: 28, strength: 0.72 } }[q] || { steps: 24, strength: 0.5 };
    ssrUniforms.uSteps.value = ssr.steps;
    ssrUniforms.uStrength.value = ssr.strength;
    ssrUniforms.uContact.value = q === 'low' ? 0.0 : 0.45;
    // the pass always runs; at zero strength it is just the copy into the chain
  }
  const b = document.getElementById('btnQual');
  if (b) b.textContent = 'Quality: ' + q[0].toUpperCase() + q.slice(1);
  onResize();
}

/* ------------------------------------------------------------------ panels */
/* The CV, as an object.
 *
 * It is added here rather than in Blender because anything new in the model
 * means another two-hour lightmap bake. A mesh built at runtime takes its light
 * from the environment probe and the room's live lights instead, which is also
 * what lets it be picked up later.
 */
let cvObj = null;

function makeCVCover() {
  const c = document.createElement('canvas');
  c.width = 744; c.height = 1052;                 // A4 at 90dpi
  const g = c.getContext('2d');
  g.fillStyle = '#f3efe7'; g.fillRect(0, 0, c.width, c.height);
  // faint paper tone
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, 'rgba(0,0,0,0.00)');
  grad.addColorStop(1, 'rgba(60,48,34,0.10)');
  g.fillStyle = grad; g.fillRect(0, 0, c.width, c.height);

  g.fillStyle = '#1d1a16';
  g.font = '600 62px Georgia, serif';
  g.fillText('Agodi David', 74, 190);
  g.fillText('Uchenna', 74, 258);

  g.fillStyle = '#8a6a3c';
  g.fillRect(74, 300, 128, 4);

  g.fillStyle = '#4a4238';
  g.font = '300 31px Helvetica, Arial, sans-serif';
  g.fillText('Frontend Engineer', 74, 364);
  g.font = '300 25px Helvetica, Arial, sans-serif';
  g.fillStyle = '#6b6154';
  g.fillText('React · React Native · AI interfaces', 74, 406);
  g.fillText('Vilnius, Lithuania', 74, 446);

  g.strokeStyle = 'rgba(40,34,26,0.16)';
  g.lineWidth = 2;
  for (let i = 0; i < 16; i++) {
    const y = 560 + i * 28;
    g.beginPath(); g.moveTo(74, y);
    g.lineTo(74 + (i % 4 === 3 ? 320 : 596), y); g.stroke();
  }
  g.fillStyle = '#8a6a3c';
  g.font = '400 22px Helvetica, Arial, sans-serif';
  g.fillText('Curriculum Vitae', 74, 1004);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = MAX_ANISO;
  return t;
}

function buildCV() {
  if (cvObj) return;
  const W = 0.210, H = 0.297, T = 0.008;
  const cover = makeCVCover();
  // nothing here is lightmapped, so the materials are toned down to sit in a
  // room whose other surfaces carry baked light
  const paper = new THREE.MeshStandardMaterial({ color: 0x9c968a, roughness: 0.88, metalness: 0 });
  const face = new THREE.MeshStandardMaterial({ map: cover, color: 0x9a948a, roughness: 0.80, metalness: 0 });
  // box face order: +x, -x, +y, -y, +z, -z  -> the printed side faces up
  const geo = new THREE.BoxGeometry(W, T, H, 1, 1, 1);
  cvObj = new THREE.Mesh(geo, [paper, paper, face, paper, paper, paper]);
  cvObj.name = 'IX_CV';
  cvObj.castShadow = true;
  cvObj.receiveShadow = true;
  // on the table top at the left end, where it reads as something set down
  // rather than as a stray sheet lost under the furniture
  cvObj.position.set(-0.505, 0.4325, 0.295);
  cvObj.rotation.set(0, THREE.MathUtils.degToRad(19), 0);
  scene.add(cvObj);
}

const CV_HTML = `
  <div class="p-kind">Curriculum vitae</div>
  <h2>Agodi David Uchenna</h2>
  <p>Frontend Engineer shipping production React, Next.js, TypeScript and React
     Native. Most recently the client for Nivram, a live AI assistant: the
     streaming pipeline that coalesces 600 tokens a second into 60 renders and
     holds 60&nbsp;fps, and 70+ action cards that turn partial model output into
     calls against the same production endpoints as the app's own screens.</p>
  <p>Mechatronics background in embedded systems and control — comfortable where
     physical systems meet the web, which is roughly what this room is.</p>
  <div class="p-stack">React · React Native · TypeScript · Next.js · WebGL · Firebase · Python</div>
  <a class="p-link" href="./assets/cv.pdf" target="_blank" rel="noopener" download="Agodi-David-Uchenna-CV.pdf">Download the PDF &darr;</a>
  <a class="p-link" href="${CONFIG.contact.site}" target="_blank" rel="noopener">${CONFIG.contact.site.replace(/^https?:\/\//, '')} &nearr;</a>`;

function openCV() {
  STATE.openBook = -1;
  ui.panelBody.innerHTML = CV_HTML;
  ui.panel.classList.add('on');
  panelOpen(true);
  setDeepLink('cv');
}

/* Deep links: a recruiter can be sent straight to one project. */
function setDeepLink(key) {
  try {
    const u = new URL(location.href);
    if (key) u.searchParams.set('open', key);
    else u.searchParams.delete('open');
    history.replaceState(null, '', u);
  } catch (e) { /* non-critical */ }
}

function openProject(i) {
  const p = PROJECTS[i];
  if (!p) return;
  STATE.openBook = i;
  ui.panelBody.innerHTML = `
    <div class="p-kind">${p.kind}</div>
    <h2>${p.title}</h2>
    <p>${p.body}</p>
    <div class="p-stack">${p.stack}</div>
    ${p.url ? `<a class="p-link" href="${p.url}" target="_blank" rel="noopener">
        ${p.url.replace(/^https?:\/\//, '')} &nearr;</a>` : ''}`;
  ui.panel.classList.add('on');
  panelOpen(true);
  setDeepLink(p.id);
}
function openGlobePanel() {
  ui.panelBody.innerHTML = `
    <div class="p-kind">Where this is being made</div>
    <h2>${GLOBE_PLACES.away.name}</h2>
    <p>From ${GLOBE_PLACES.home.name} to Vilnius — a mechatronics engineer who kept
       writing software, now reading for a master's in Mechatronic Systems at
       Vilnius Gediminas Technical University while building for the web.</p>
    <div class="p-stack">5.45&deg;N 7.52&deg;E &rarr; 54.69&deg;N 25.28&deg;E &middot; 5,100 km</div>`;
  ui.panel.classList.add('on');
  panelOpen(true);
}
function closePanel() {
  ui.panel.classList.remove('on');
  panelOpen(false);
  STATE.openBook = -1;
  setDeepLink(null);
  if (books) books.closeAll();
  if (STATE.mode === 'globe') exitGlobe();
}
function enterGlobe() {
  STATE.mode = 'globe';
  flyTo('globe', 1.4);
  if (globe) { globe.focus(new THREE.Vector3(...VIEWS.globe.pos)); globe.revealing = true; }
  openGlobePanel();
  document.body.classList.add('focus-mode');
}
function exitGlobe() {
  if (STATE.mode !== 'globe') return;
  STATE.mode = 'room';
  if (globe) globe.release();
  document.body.classList.remove('focus-mode');
  // leaving the globe also puts its card away, or the room comes back with a
  // panel still covering half the screen
  ui.panel.classList.remove('on');
  panelOpen(false);
  flyTo(STATE.view, 1.2);
}

/* ------------------------------------------------------------------ picking */
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hoverObj = null, cordHeld = false, cordPull = 0;
const dragPlane = new THREE.Plane();
const dragPoint = new THREE.Vector3();

const REGIONS = [
  { key: 'fire', label: 'The hearth', box: new THREE.Box3(
      new THREE.Vector3(-0.80, 0.0, 1.80), new THREE.Vector3(0.80, 1.10, 2.50)) },
  { key: 'curtain', label: 'Curtains', box: new THREE.Box3(
      new THREE.Vector3(-3.30, 0.30, -2.10), new THREE.Vector3(-2.60, 2.60, -1.00)) },
  { key: 'curtain2', label: 'Curtains', box: new THREE.Box3(
      new THREE.Vector3(-3.30, 0.30, 1.00), new THREE.Vector3(-2.60, 2.60, 2.10)) },
];

function pick(e) {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(pointer, camera);
  const out = { obj: null, key: null, label: null, point: null };
  if (cord) {
    const hb = ray.intersectObject(cord.bead, false);
    const ht = ray.intersectObject(cord.tube, false);
    if (hb.length || ht.length) { out.key = 'cord'; out.label = 'Pull'; return out; }
  }
  if (guestObj) {
    const hg = ray.intersectObject(guestObj, true);
    if (hg.length) {
      out.obj = guestObj; out.point = hg[0].point;
      out.key = 'guestbook'; out.label = 'Visitor book';
      return out;
    }
  }
  if (cvObj) {
    const hc = ray.intersectObject(cvObj, false);
    if (hc.length) {
      const blocked = roomRoot ? ray.intersectObject(roomRoot, true) : [];
      if (!blocked.length || blocked[0].distance > hc[0].distance - 0.002) {
        out.obj = cvObj; out.point = hc[0].point; out.key = 'cv'; out.label = 'CV';
        return out;
      }
    }
  }
  if (!roomRoot) return out;
  const hits = ray.intersectObject(roomRoot, true);
  if (!hits.length) return out;
  const h = hits[0];
  // a part resolves to the body it belongs to, so grabbing the mug's handle
  // grabs the mug
  out.obj = physRoot(h.object) || h.object;
  out.point = h.point;
  const n = out.obj.name || '';
  if (/^IX_Book_/.test(n)) {
    out.key = 'book';
    const i = +n.split('_')[2];
    out.label = PROJECTS[i] ? PROJECTS[i].title : 'Project';
    return out;
  }
  if (n === 'IX_Globe' || n === 'IX_GlobePin') { out.key = 'globe'; out.label = 'Lithuania'; return out; }
  if (n === 'IX_ClockH' || n === 'IX_ClockM') return out;
  if (/^IX_BSB/.test(n)) { out.key = 'shelfbook'; out.label = 'Pull out'; return out; }
  if (/^IX_(BSS|CT|FL|ST)/.test(n)) { out.key = 'loose'; out.label = 'Drag'; return out; }
  if (props && props.meshes.includes(h.object)) { out.key = 'prop'; out.label = ''; return out; }
  for (const r of REGIONS) if (r.box.containsPoint(h.point)) {
    out.key = r.key.replace(/\d$/, ''); out.label = r.label; return out;
  }
  return out;
}

addEventListener('pointermove', (e) => {
  if (curtainDrag) {
    const dx = e.clientX - curtainDrag.x;
    if (Math.abs(dx) > 3) curtainDrag.moved = true;
    // dragging across roughly a third of the screen runs them fully open
    setCurtain(curtainDrag.from + dx / (innerWidth * 0.34));
    return;
  }
  if (pressInfo && !cordHeld) {
    if (!pressInfo.dragging &&
        Math.hypot(e.clientX - pressInfo.x, e.clientY - pressInfo.y) > (pressInfo.touch ? 11 : 6)) {
      pressInfo.dragging = true;
      controls.enabled = false;
      dragMesh = pressInfo.mesh;
      phys.beginGrab(pressInfo.mesh, pressInfo.point, camera);
      audio.start();
      ui.hints && ui.hints.classList.add('hints-off');
    }
    if (pressInfo.dragging) {
      ray.setFromCamera(
        new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
        camera);
      phys.moveGrab(ray, 1 / 60);
      return;
    }
  }
  if (cordHeld && cord) {
    ray.setFromCamera(
      new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
      camera);
    if (ray.ray.intersectPlane(dragPlane, dragPoint)) {
      dragPoint.y = Math.min(dragPoint.y, CORD_ANCHOR.y - 0.05);
      const max = CORD_ANCHOR.y - 0.52;
      dragPoint.y = Math.max(dragPoint.y, max);
      cordPull = (CORD_ANCHOR.y - 0.05 - dragPoint.y) / 0.47;
      cord.drag(dragPoint);
    }
    return;
  }
  if (e.pointerType === 'touch') return;
  const h = pick(e);
  hoverObj = h.obj;
  if (books) books.hover(h.key === 'book' ? h.obj : null);
  const movable = h.key === 'shelfbook' || h.key === 'loose' || h.key === 'prop';
  canvas.style.cursor = movable ? 'grab' : (h.key ? 'pointer' : 'grab');
  if (pressInfo && pressInfo.dragging) canvas.style.cursor = 'grabbing';
  if (h.key && h.label) {
    ui.tip.textContent = h.label;
    ui.tip.style.left = e.clientX + 'px';
    ui.tip.style.top = e.clientY + 'px';
    ui.tip.classList.add('on');
  } else ui.tip.classList.remove('on');
});

let downAt = null;
addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
  const h = pick(e);
  if (h.key === 'cord' && cord) {
    cordHeld = true;
    cord.grab();
    controls.enabled = false;
    const nrm = camera.getWorldDirection(new THREE.Vector3()).negate();
    dragPlane.setFromNormalAndCoplanarPoint(nrm, cord.bottom);
    ui.hints && ui.hints.classList.add('hints-off');
    return;
  }
  if (walk && walk.active) return;      // a drag belongs to looking around
  if (h.key === 'curtain' && STATE.mode === 'room') {
    curtainDrag = { x: e.clientX, from: STATE.curtainTarget, moved: false };
    controls.enabled = false;
    return;
  }
  // anything loose in the room can be picked up and moved for real. h came from
  // the shared pick(), so something in front of it blocks the grab.
  if (phys && STATE.mode === 'room' && h.obj && physMeshes.includes(h.obj)) {
    pressInfo = { mesh: h.obj, point: h.point.clone(), x: e.clientX, y: e.clientY,
                  touch: e.pointerType === 'touch', dragging: false };
  }
});
addEventListener('pointercancel', () => {
  if (pressInfo && pressInfo.dragging) { phys.endGrab(); controls.enabled = true; }
  pressInfo = null;
  dragMesh = null;
});
addEventListener('pointerup', (e) => {
  if (curtainDrag) {
    const d = curtainDrag;
    curtainDrag = null;
    controls.enabled = true;
    // a tap rather than a drag still toggles, so the old gesture keeps working
    if (!d.moved) setCurtain(d.from < 0.5);
    else setCurtain(STATE.curtainTarget < 0.12 ? 0 : STATE.curtainTarget > 0.88 ? 1 : STATE.curtainTarget);
    audio.start();
    downAt = null;
    return;
  }
  if (pressInfo) {
    const info = pressInfo;
    pressInfo = null;
    if (info.dragging) {
      phys.endGrab();
      dragMesh = null;
      controls.enabled = true;
      updateTidyButton();
      downAt = null;
      return;
    }
    // a tap, not a drag: knock it over, or ease a book off the shelf
    const n = info.mesh.name || '';
    if (/^IX_BSB/.test(n)) {
      phys.pullOut(info.mesh, camera, 1);
    } else if (!/^IX_Book_/.test(n)) {
      const dir = camera.getWorldDirection(new THREE.Vector3());
      phys.knock(info.mesh, info.point, dir, 1);
      if (/FireLog/.test(n)) {
        setFire(true); fireFlare = 1.0;
        sparks.burst(FIRE_AT.clone().setY(0.22), 20, 0.9);
      }
      audio.start();
      updateTidyButton();
      downAt = null;
      return;
    }
    audio.start();
    updateTidyButton();
  }
  if (cordHeld && cord) {
    cordHeld = false;
    controls.enabled = true;
    const pulled = cord.release();
    if (pulled) {
      // how far it was pulled sets the level, so the cord is a dimmer and not
      // just a switch; a short tug is the old on/off
      const lvl = THREE.MathUtils.clamp(cordPull, 0, 1);
      if (STATE.lampTarget > 0.5 && lvl < 0.45) setLamp(false);
      else setLamp(0.42 + lvl * 0.58);
      audio.start();
    }
    cordPull = 0;
    downAt = null;
    return;
  }
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  const quick = performance.now() - downAt.t < 500;
  downAt = null;
  if (moved > 7 || !quick) return;
  const h = pick(e);
  if (!h.key) { if (STATE.mode === 'globe') exitGlobe(); return; }
  audio.start();
  if (h.key === 'book' && books) {
    const idx = books.toggle(h.obj);
    if (idx >= 0) { openProject(idx); if (STATE.view !== 'shelf') { STATE.view = 'shelf'; flyTo('shelf'); } }
    else closePanel();
  } else if (h.key === 'guestbook') {
    openGuestbook();
    if (STATE.view !== 'shelf') { STATE.view = 'shelf'; flyTo('shelf'); }
  } else if (h.key === 'cv') {
    openCV();
    if (STATE.view !== 'fire') { STATE.view = 'fire'; flyTo('fire'); }
  } else if (h.key === 'globe') {
    STATE.mode === 'globe' ? exitGlobe() : enterGlobe();
  } else if (h.key === 'fire') {
    if (STATE.fireTarget > 0.5) {
      sparks.burst(FIRE_AT.clone().setY(0.22), 42, 1.15);
      fireFlare = 1.0;
    } else setFire(true);
  } else if (h.key === 'curtain') {
    setCurtain(!(STATE.curtainTarget > 0.5));
  } else if (h.key === 'prop' && props) {
    props.nudge(h.obj);
    if (/FireLog/.test(h.obj.name)) { setFire(true); fireFlare = 1.0; sparks.burst(FIRE_AT.clone().setY(0.22), 20, 0.9); }
  }
});

/* ------------------------------------------------------------------ hints */
let hints = null;
function buildHints() {
  hints = createHints(ui.hints, [
    { key: 'fire', label: 'Hearth', pos: new THREE.Vector3(0, 0.62, 2.07) },
    { key: 'cord', label: 'Pull', pos: CORD_ANCHOR.clone().setY(CORD_ANCHOR.y - 0.30) },
    { key: 'globe', label: 'Globe', pos: GLOBE_AT.clone().setY(0.96) },
    { key: 'shelf', label: 'Projects', pos: new THREE.Vector3(2.70, 1.40, 0.66) },
    { key: 'curtain', label: 'Curtains', pos: new THREE.Vector3(-2.86, 1.70, -1.48) },
    { key: 'cv', label: 'CV', pos: new THREE.Vector3(-0.505, 0.52, 0.295) },
    { key: 'guestbook', label: 'Sign the book', pos: new THREE.Vector3(2.64, 1.52, 0.919) },
  ]);
  ui.hints.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    audio.start();
    const k = b.dataset.key;
    if (k === 'cv') { openCV(); setView('fire'); return; }
    if (k === 'guestbook') { openGuestbook(); setView('shelf'); return; }
    if (k === 'fire') { setView('fire'); setFire(true); }
    if (k === 'cord') { setLamp(!(STATE.lampTarget > 0.5)); }
    if (k === 'globe') enterGlobe();
    if (k === 'shelf') setView('shelf');
    if (k === 'curtain') setCurtain(!(STATE.curtainTarget > 0.5));
  });
}

/* ------------------------------------------------------------------ ui */
let tucked = false, tuckTimer = 0;
function setTucked(on) {
  tucked = on;
  ui.bottom.classList.toggle('tucked', on);
  const tab = document.getElementById('chromeTab');
  tab.setAttribute('aria-expanded', String(!on));
  tuckTimer = on ? 0 : 7.5;
}
function pokeChrome() { if (!tucked) tuckTimer = 7.5; }

function wireUI() {
  const tab = document.getElementById('chromeTab');
  tab.addEventListener('click', () => setTucked(!tucked));
  ui.bottom.addEventListener('pointerdown', pokeChrome);
  ui.bottom.addEventListener('pointermove', pokeChrome);
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    if (tucked && e.clientY > innerHeight * 0.86) setTucked(false);
  });
  // swipe the mobile sheet away
  let sy = null;
  const grab = document.getElementById('panelGrab');
  if (grab) {
    grab.addEventListener('pointerdown', (e) => { sy = e.clientY; grab.setPointerCapture(e.pointerId); });
    grab.addEventListener('pointermove', (e) => {
      if (sy === null) return;
      const d = e.clientY - sy;
      if (d > 0) ui.panel.style.transform = `translateY(${d}px)`;
    });
    grab.addEventListener('pointerup', (e) => {
      if (sy !== null && e.clientY - sy > 70) closePanel();
      ui.panel.style.transform = '';
      sy = null;
    });
  }
  document.getElementById('viewSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (b) { exitGlobe(); closePanel(); setView(b.dataset.view); }
  });
  document.getElementById('weatherSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (b) setWeather(b.dataset.weather);
  });
  document.getElementById('btnFire').addEventListener('click', () => setFire(!(STATE.fireTarget > 0.5)));
  document.getElementById('btnLamp').addEventListener('click', () => setLamp(!(STATE.lampTarget > 0.5)));
  document.getElementById('btnCurtain').addEventListener('click', () => setCurtain(!(STATE.curtainTarget > 0.5)));
  const exitWalk = document.getElementById('btnExitWalk');
  if (exitWalk) exitWalk.addEventListener('click', () => { audio.start(); setWalk(false); });
  const walkBtn = document.getElementById('btnWalk');
  if (walkBtn) walkBtn.addEventListener('click', () => {
    audio.start();
    setWalk(!(walk && walk.active));
  });
  const bookBtn = document.getElementById('btnBook');
  if (bookBtn) bookBtn.addEventListener('click', () => {
    audio.start();
    openGuestbook();
    if (STATE.view !== 'shelf') setView('shelf');
  });
  const tidyBtn = document.getElementById('btnTidy');
  if (tidyBtn) tidyBtn.addEventListener('click', () => {
    if (!phys) return;
    phys.reset();
    audio.start();
    setTimeout(updateTidyButton, 900);
    tidyBtn.classList.remove('on');
    tidyBtn.disabled = true;
  });
  document.getElementById('btnQual').addEventListener('click', () => {
    const order = ['high', 'medium', 'low'];
    setQuality(order[(order.indexOf(STATE.quality) + 1) % order.length]);
  });
  document.getElementById('timeRange').addEventListener('input', (e) => setTime(+e.target.value / 1000));
  document.getElementById('btnNotes').addEventListener('click', () => ui.notes.classList.add('on'));
  document.getElementById('close').addEventListener('click', () => ui.notes.classList.remove('on'));
  ui.panelClose.addEventListener('click', closePanel);
  ui.sound.addEventListener('click', () => {
    audio.start();
    const m = audio.toggleMute();
    ui.sound.setAttribute('aria-pressed', String(!m));
    ui.sound.textContent = m ? 'Sound off' : 'Sound on';
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { ui.notes.classList.remove('on'); closePanel(); exitGlobe(); }
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = +e.key;
    const keys = ['hero', 'fire', 'window', 'sofa', 'shelf'];
    if (n >= 1 && n <= 5) setView(keys[n - 1]);
    if (e.key.toLowerCase() === 'f') setFire(!(STATE.fireTarget > 0.5));
    if (e.key.toLowerCase() === 'l') setLamp(!(STATE.lampTarget > 0.5));
    if (e.key.toLowerCase() === 'c') setCurtain(!(STATE.curtainTarget > 0.5));
    if (e.key.toLowerCase() === 'g') STATE.mode === 'globe' ? exitGlobe() : enterGlobe();
    if (e.key.toLowerCase() === 'h') setTucked(!tucked);
  });
}

function onResize() {
  applyFov();
  renderer.setSize(innerWidth, innerHeight);
  const s = new THREE.Vector2();
  renderer.getDrawingBufferSize(s);
  if (composer) composer.setSize(s.x, s.y);
  if (bloom) bloom.setSize(s.x, s.y);
  if (smaaPass && smaaPass.setSize) smaaPass.setSize(s.x, s.y);
  if (godRT) godRT.setSize(Math.max(160, Math.floor(s.x * 0.26)), Math.max(90, Math.floor(s.y * 0.26)));
  ssrUniforms.uRes.value.set(s.x, s.y);
}
addEventListener('resize', onResize);

/* ------------------------------------------------------------------ lifecycle */
let started = false;
let pendingOpen = null;
function ready() {
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  setupPost();
  dust = createDust(scene, mobile ? 800 : 1500, sunDir, WINDOW);
  buildHints();
  wireUI();
  setTime(0.40, true);
  setFire(true); setLamp(false); setCurtain(true); setWeather('clear');
  applyWeights(0);
  compositeLightmap();
  captureEnv();
  const q0 = new URLSearchParams(location.search);
  if (q0.has('q')) setQuality(q0.get('q'));
  else if (mobile) setQuality('medium');
  const kt = document.getElementById('kTri');
  if (kt) kt.textContent = Math.round(triCount).toLocaleString();
  itemPct = glbPct = 1; paintProgress();
  ui.enter.classList.add('on');
  if (!new URLSearchParams(location.search).has('fast')) renderer.compile(scene, camera);

  const start = () => {
    if (started) return; started = true;
    ui.load.classList.add('done');
    ui.top.classList.add('on'); ui.bottom.classList.add('on');
    ui.stats.classList.add('on'); ui.hints.classList.add('on');
    document.getElementById('chromeTab').classList.add('on');
    tuckTimer = 9;
    setTimeout(() => ui.hint.classList.add('on'), 900);
    setTimeout(() => ui.hint.classList.remove('on'), 10000);
    audio.start();
    enableGyro();
    // The room is interactive now, so the deferred lightmap channels can come
    // down in the background without anyone waiting on them.
    ensureLateLightmaps();
    // the reveal: the room draws its own curtains back rather than fading in
    setTimeout(() => setCurtain(false), 260);
    // a shared link lands on the thing it points at, after the opening move
    if (pendingOpen !== null) {
      const target = pendingOpen;
      pendingOpen = null;
      setTimeout(() => {
        if (target === 'cv') { openCV(); setView('fire'); }
        else if (target === 'guestbook') { openGuestbook(); setView('shelf'); }
        else { openProject(target); setView('shelf'); if (books) books.openOnly(target); }
      }, 1100);
    }
  };
  ui.enter.addEventListener('click', start, { once: true });
  window.__start = start;
  window.__api = {
    setTime, setFire, setLamp, setCurtain, setWeather, setView, setQuality,
    enterGlobe, exitGlobe, openProject, STATE, PROJECTS,
    // handles for measuring post-processing from a test harness
    _post: () => ({ bloom, lampLight, god: godUniforms }),
    dbg: () => ({ curtain: +STATE.curtain.toFixed(2), patched: !!curtainUni,
                  mode: STATE.mode, calls: renderer.info.render.calls,
                  books: books ? books.books.length : 0, globe: !!globe }),
    phys: () => ({ ready: !!phys, items: physMeshes.length,
                   awake: phys ? phys.awakeCount : 0,
                   disturbed: phys ? phys.disturbed() : 0 }),
    poke(name, up = 0.2) {
      if (!phys) return 'no physics';
      const m = physMeshes.find((o) => o.name === name);
      if (!m) return 'no mesh ' + name;
      const before = m.position.clone();
      phys.knock(m, m.position.clone(), new THREE.Vector3(0.3, up, 0.9), 1.4);
      return { name, before: before.toArray().map((n) => +n.toFixed(3)) };
    },
    where(name) {
      const m = physMeshes.find((o) => o.name === name);
      return m ? m.position.toArray().map((n) => +n.toFixed(3)) : null;
    },
    tidy() { if (phys) phys.reset(); return 'ok'; },
    cat(o) {
      if (!cat) return 'no cat';
      if (o && o.pose) cat.setPoseDebug && cat.setPoseDebug(o.pose);
      if (o && o.to !== undefined) cat.gotoDebug && cat.gotoDebug(o.to);
      return { p: cat.position.toArray().map((n) => +n.toFixed(2)), busy: cat.busy };
    },
    nudgeCam(d) { camera.position.x += d; camera.updateMatrixWorld(); return 'ok'; },
    camSet(px, py, pz, tx, ty, tz, fov) {
      camAnim = null;
      camera.position.set(px, py, pz);
      controls.target.set(tx, ty, tz);
      if (fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
      controls.update(); camera.updateMatrixWorld();
      return 'ok';
    },
    solo(on) {
      if (roomRoot) roomRoot.visible = !on;
      if (cvObj) cvObj.visible = !on;
      if (guestObj) guestObj.visible = !on;
      scene.environmentIntensity = on ? 1.6 : 0.30;
      return 'ok';
    },
    find(name) {
      let hit = null;
      scene.traverse((o) => { if (o.name === name) hit = o; });
      if (!hit) return 'not found: ' + name;
      const bb = new THREE.Box3().setFromObject(hit);
      return {
        type: hit.type, visible: hit.visible, parent: hit.parent ? hit.parent.type : null,
        pos: hit.position.toArray().map((n) => +n.toFixed(3)),
        min: bb.min.toArray().map((n) => +n.toFixed(3)),
        max: bb.max.toArray().map((n) => +n.toFixed(3)),
      };
    },
    catInfo() {
      if (!cat) return 'no cat';
      const g = cat.group;
      const bb = new THREE.Box3().setFromObject(g);
      return {
        children: g.children.length,
        visible: g.visible,
        inScene: !!g.parent,
        min: bb.min.toArray().map((n) => +n.toFixed(3)),
        max: bb.max.toArray().map((n) => +n.toFixed(3)),
      };
    },
    catCam() {
      if (!cat) return 'no cat';
      const p = cat.position;
      camAnim = null;
      camera.position.set(p.x + 0.10, 0.92, p.z + 0.86);
      controls.target.set(p.x, 0.11, p.z);
      camera.fov = 40; camera.updateProjectionMatrix();
      controls.update(); camera.updateMatrixWorld();
      return 'ok';
    },
    pdbg(name) {
      const m = physMeshes.find((o) => o.name === name);
      return m && phys ? phys.debug(m) : ('no mesh ' + name);
    },
    names(re) { return physMeshes.map((o) => o.name).filter((n) => new RegExp(re).test(n)).slice(0, 14); },
    cam: () => ({ p: camera.position.toArray().map((n) => +n.toFixed(2)),
                  t: controls.target.toArray().map((n) => +n.toFixed(2)),
                  fov: +camera.fov.toFixed(1), boost: +fovBoost.toFixed(1), anim: !!camAnim }),
    set(o = {}) {
      if (o.exp !== undefined) renderer.toneMappingExposure = o.exp;
      if (o.sun !== undefined) SUN_BASE.v = o.sun;
      if (o.lm !== undefined) lmMaterials.forEach((m) => { m.lightMapIntensity = o.lm; });
      if (o.env !== undefined) scene.environmentIntensity = o.env;
      if (o.bloom !== undefined) bloom.strength = o.bloom;
      if (o.god !== undefined) godUniforms.uStrength.value = o.god;
      if (o.saa !== undefined) specAAUniforms.uSpecAA.value = o.saa;
      if (o.saaMax !== undefined) specAAUniforms.uSpecAAMax.value = o.saaMax;
      if (o.ssr !== undefined) ssrUniforms.uStrength.value = o.ssr;
      if (o.ssrSteps !== undefined) ssrUniforms.uSteps.value = o.ssrSteps;
      if (o.ssrBlur !== undefined) ssrUniforms.uBlur.value = o.ssrBlur;
      if (o.ssrDebug !== undefined) ssrUniforms.uDebug.value = o.ssrDebug;
      if (o.contact !== undefined) ssrUniforms.uContact.value = o.contact;
      if (o.floorEnv !== undefined && parts.floor) parts.floor.material.envMapIntensity = o.floorEnv;
      return 'ok';
    },
  };
  const q = new URLSearchParams(location.search);
  if (q.has('time')) setTime(parseFloat(q.get('time')), true);
  if (q.has('view') && VIEWS[q.get('view')]) setView(q.get('view'));
  if (q.get('lamp') === '1') setLamp(true);
  if (q.get('fire') === '0') setFire(false);
  if (q.has('weather')) setWeather(q.get('weather'));
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && grainPass)
    grainPass.uniforms.uGrain.value = 0.010;
  const openKey = q.get('open');
  if (openKey) {
    const pi = PROJECTS.findIndex((pr) => pr.id === openKey);
    pendingOpen = (openKey === 'cv' || openKey === 'guestbook') ? openKey : (pi >= 0 ? pi : null);
  }
  if (q.has('auto')) start();
}

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
let fpsAcc = 0, fpsN = 0, lastStat = 0, autoDropped = false;
let frame = 0, shadowDirty = 4, idle = 0, fireFlare = 0, globeStage = 0, shelfStage = 0;
const idleBase = new THREE.Vector3();
let idleSettled = 0;
const AUX_EVERY = { high: 2, medium: 3, low: 6 };
controls.addEventListener('start', () => { idle = -1e9; });

function flicker(t) {
  return 0.80 + 0.13 * Math.sin(t * 7.3) + 0.07 * Math.sin(t * 13.9 + 1.4)
    + 0.06 * Math.sin(t * 23.1 + 0.6) + 0.04 * Math.sin(t * 41.0 + 2.2);
}

const _c = new THREE.Color();
function applyWeights(fl) {
  const w = weights(STATE.time);
  const S = sampleSky(STATE.time);
  const W = WEATHER[STATE.weather];
  const curtainBlock = 1 - 0.88 * STATE.curtain;

  lmUni.wSky.value = w.sky * W.sky * curtainBlock;
  lmUni.wSun.value.copy(w.sun).multiplyScalar(W.sun * curtainBlock);
  lmUni.cSky.value.setHex(W.tint, THREE.SRGBColorSpace);
  lmUni.cSun.value.copy(S.sun);
  lmUni.wLamp.value = STATE.lamp;
  lmUni.wNight.value = w.night;
  lmUni.wFire.value = STATE.fire * (0.86 + 0.26 * fl) * (1 + fireFlare * 0.9);

  sunDirection(S.el, S.az, sunDir);
  sun.position.copy(sunDir).multiplyScalar(-16).add(new THREE.Vector3(0, 1.2, 0));
  sun.color.copy(S.sun);
  sun.intensity = S.I * W.sun * curtainBlock * (SUN_BASE.v / 11);
  sun.visible = sun.intensity > 0.02;

  sky.uni.uZen.value.copy(S.zen);
  sky.uni.uHor.value.copy(S.hor);
  sky.uni.uHaze.value.copy(S.haze);
  sky.uni.uSunCol.value.copy(S.sun);
  sky.uni.uSunDir.value.copy(sunDir);
  sky.uni.uStars.value = w.night * 0.9;
  sky.uni.uOvercast.value = W.over;
  sky.uni.uExp.value = 1.0;

  backdrop.uni.mixN.value = w.night;
  backdrop.uni.uTint.value.setHex(W.tint, THREE.SRGBColorSpace);
  backdrop.uni.uSnow.value = W.snow;

  globeLight.intensity = 0.10 + 0.52 * globeStage;
  globeFill.intensity = 0.05 + 0.20 * globeStage;
  shelfLight.intensity = 0.92 * shelfStage;
  shelfFill.intensity = 0.46 * shelfStage;
  lampLight.intensity = 5.0 * STATE.lamp;
  fireLight.intensity = 3.2 * STATE.fire * fl * (1 + fireFlare);
  fillHemi.intensity = 0.03 * (1 - w.night * 0.6);

  if (curtainUni) curtainUni.uDraw.value = STATE.curtain;
  if (rainUni) rainUni.uRain.value = W.rain;
  if (dust) {
    dust.uni.uShaft.value = W.dust * (0.25 + 0.75 * (w.sun.x + w.sun.y + w.sun.z)) * curtainBlock;
    dust.uni.uTint.value.copy(S.sun).lerp(_c.setRGB(1, 1, 1), 0.3);
  }
  if (bloom) {
    /* Night bloom used to climb with darkness, which is backwards for this
     * room. After dark the dominant light is the floor lamp, and a lampshade
     * is a *large* bright surface rather than a point. A wide-radius bloom
     * over a large emitter does not glow, it fogs: measured across the frame,
     * the lamp third sat at nearly three times the brightness of the far wall
     * and swallowed the detail around it.
     *
     * So after dark the threshold rises instead. The shade falls back below
     * it and reads as lit; the bulb, an order of magnitude brighter, still
     * crosses it and still blooms - which is also how a real lamp behaves.
     * The radius tightens at the same time so what is left is a halo rather
     * than a haze. */
    bloom.strength = (0.42 + w.night * 0.08) * W.bloom * (1 - globeStage * 0.72);
    bloom.threshold = 0.80 + w.night * 0.34;
    bloom.radius = 0.72 - w.night * 0.30;
  }
  godUniforms.uStrength.value = 0.56 * (1 - w.night * 0.85) * curtainBlock * (1 - W.over * 0.7)
    * (1 - globeStage * 0.9);
  const stageDim = 1 - globeStage * 0.55;
  for (const m of lmMaterials) m.lightMapIntensity = LM_SCALE * stageDim;
  if (parts.globeMat) parts.globeMat.envMapIntensity = 2.6 + globeStage * 1.9;
  scene.environmentIntensity = 0.30 * (1 - globeStage * 0.25);
}

function tick() {
  requestAnimationFrame(tick);
  const raw = clock.getDelta();
  const dt = Math.min(raw, 0.05);
  const t = clock.elapsedTime;
  frame++;

  const k = 1 - Math.pow(0.0015, dt);
  STATE.time += (STATE.timeTarget - STATE.time) * (1 - Math.pow(0.02, dt));
  STATE.fire += (STATE.fireTarget - STATE.fire) * k;
  STATE.lamp += (STATE.lampTarget - STATE.lamp) * k;
  STATE.curtain += (STATE.curtainTarget - STATE.curtain) * (1 - Math.pow(0.05, dt));
  fovBoost += (fovBoostTarget - fovBoost) * (1 - Math.pow(0.004, dt));
  panelOffset += (panelOffsetTarget - panelOffset) * (1 - Math.pow(0.004, dt));
  if (tuckTimer > 0 && started) {
    tuckTimer -= dt;
    if (tuckTimer <= 0 && !tucked) setTucked(true);
  }
  fireFlare = Math.max(0, fireFlare - dt * 1.1);
  globeStage += ((STATE.mode === 'globe' ? 1 : 0) - globeStage) * (1 - Math.pow(0.02, dt));
  const wantShelf = (STATE.view === 'shelf' && STATE.mode === 'room') ? 1 : 0;
  shelfStage += (wantShelf - shelfStage) * (1 - Math.pow(0.03, dt));
  applyFov();

  if (ssrPass) {
    ssrUniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    ssrUniforms.uInvView.value.copy(camera.matrixWorld);
    ssrUniforms.uProj.value.copy(camera.projectionMatrix);
    ssrUniforms.uView.value.copy(camera.matrixWorldInverse);
    ssrUniforms.uCamPos.value.copy(camera.position);
    ssrUniforms.uNear.value = camera.near;
    ssrUniforms.uFar.value = camera.far;
    // sunDir points from the sun toward the scene; the march goes the other way
    ssrUniforms.uSunDir.value.copy(sunDir).normalize().negate();
  }

  const fl = STATE.fire > 0.01 ? flicker(t) : 0;
  applyWeights(fl);
  compositeLightmap();

  if (parts.flame) {
    parts.flame.material.uniforms.uT.value = t;
    parts.flame.material.uniforms.uI.value = STATE.fire * (0.42 + 0.46 * fl) * (1 + fireFlare * 0.8);
    parts.flame.visible = STATE.fire > 0.02;
  }
  if (parts.glow) {
    parts.glow.visible = STATE.fire > 0.02;
    if (parts.glow.material.emissiveIntensity !== undefined)
      parts.glow.material.emissiveIntensity =
        (parts.glow.material.userData.baseEmissive || 1) * STATE.fire * fl;
  }
  if (parts.ember && parts.ember.material.emissiveIntensity !== undefined)
    parts.ember.material.emissiveIntensity =
      (parts.ember.material.userData.baseEmissive || 1) * STATE.fire * (0.7 + 0.5 * fl);
  if (parts.bulb && parts.bulb.material.emissiveIntensity !== undefined)
    parts.bulb.material.emissiveIntensity =
      (parts.bulb.material.userData.baseEmissive || 1) * STATE.lamp;

  if (dust) dust.uni.uT.value = t;
  if (sparks) sparks.update(dt);
  if (cord) cord.update(dt);
  if (books) books.update(dt);
  if (cat) cat.update(dt, t);
  if (frame % 30 === 0) updateClock();
  updateSteam(dt, t);
  if (props) props.update(dt);
  if (phys) {
    phys.update(dt, LM_SCALE * (1 - globeStage * 0.55));
    if (phys.grabbing) controls.enabled = false;
    tidyCheck -= dt;
    if (tidyCheck <= 0) { tidyCheck = 0.5; updateTidyButton(); }
  }
  if (globe) globe.update(dt, STATE.mode === 'globe');

  const wc = new THREE.Vector3(WINDOW.x, (WINDOW.hi0 + WINDOW.hi1) / 2, 0);
  const inFront = wc.clone().applyMatrix4(camera.matrixWorldInverse).z < 0;
  wc.project(camera);
  const cx = wc.x * 0.5 + 0.5, cy = wc.y * 0.5 + 0.5;
  godUniforms.uCenter.value.set(cx, cy);
  const off = Math.max(0, Math.max(-cx, cx - 1, -cy, cy - 1));
  const fade = inFront ? Math.max(0, 1 - off / 0.55) : 0;
  godUniforms.uFade.value += (fade - godUniforms.uFade.value) * 0.12;

  if (walk && walk.active) {
    walk.update(dt);
    idle = 0;
  } else if (!camAnim) {
    idle += dt;
    if (idle > 2.2) {
      if (idle - dt <= 2.2) { idleBase.copy(camera.position); idleSettled = 0; }
      const a = idle - 2.2;
      // breathe in, then settle to a dead stop: a camera left parked should
      // resolve to a still frame rather than wandering forever
      const rise = Math.min(a / 4.0, 1);
      const settle = a < 26 ? 1 : Math.max(0, 1 - (a - 26) / 14);
      const amp = rise * settle * 0.011;
      if (amp > 1e-5) {
        camera.position.set(
          idleBase.x + Math.sin(a * 0.13) * amp,
          idleBase.y + Math.sin(a * 0.11 + 1.1) * amp * 0.7,
          idleBase.z + Math.cos(a * 0.12 + 0.4) * amp);
      } else if (idleSettled !== 1) {
        idleSettled = 1;
        camera.position.copy(idleBase);
      }
      if (gyro) {
        camera.position.x += gyro.g * 0.045;
        camera.position.y += -gyro.b * 0.030;
      }
    }
  } else {
    idle = 0;
    camAnim.t += Math.min(raw, 0.30) / camAnim.dur;
    const a = Math.min(camAnim.t, 1);
    const e = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2;
    camera.position.lerpVectors(camAnim.p0, camAnim.p1, e);
    controls.target.lerpVectors(camAnim.t0, camAnim.t1, e);
    hfovBase = camAnim.f0 + (camAnim.f1 - camAnim.f0) * e;
    if (a >= 1) { camAnim = null; idle = 0; }
  }
  // OrbitControls.update() recomputes the camera from its own pivot whether or
  // not it is enabled, so letting it run in walk mode put the camera straight
  // back where it was every frame - you could not move at all.
  if (!(walk && walk.active)) {
    controls.update();

    const P = camera.position, T = controls.target;
    P.x = Math.min(2.88, Math.max(-2.90, P.x));
    P.y = Math.min(3.50, Math.max(0.32, P.y));
    P.z = Math.min(2.28, Math.max(-2.28, P.z));
    T.x = Math.min(3.1, Math.max(-3.1, T.x));
    T.y = Math.min(3.6, Math.max(0.05, T.y));
    T.z = Math.min(2.5, Math.max(-2.5, T.z));

    if (STATE.mode === 'globe' && globe && !camAnim) {
      const mk = globe.markerWorld();
      controls.target.lerp(mk, 1 - Math.pow(0.02, dt));
    }
  }

  if (hints) {
    hints.setVisible(STATE.mode === 'room' && !cordHeld && !(walk && walk.active));
    if (frame % 3 === 0 && roomRoot) hints.update(camera, ray, [roomRoot]);
  }

  const fireScreen = FIRE_AT.clone().project(camera);
  audio.update(dt, {
    fire: STATE.fire * (STATE.mode === 'room' ? 1 : 0.6),
    rain: WEATHER[STATE.weather].rain,
    panX: THREE.MathUtils.clamp(fireScreen.x, -1, 1) * 0.6,
  });

  if (envPending > 0) {
    envPending -= dt;
    if (envPending <= 0) { envPending = 0; captureEnv(); }
  }

  if (composer) {
    if (shadowDirty > 0) { renderer.shadowMap.needsUpdate = true; shadowDirty--; }
    const every = AUX_EVERY[STATE.quality] || 2;
    const moving = !!camAnim || cordHeld;
    if (godUniforms.uFade.value > 0.01 && godUniforms.uStrength.value > 0.01 &&
        (frame % every === 0 || moving)) renderGodSource();
    renderer.info.reset();
    composer.render();
    grainPass.uniforms.uT.value = t;
  }

  fpsAcc += raw; fpsN++;
  if (t - lastStat > 0.5) {
    const fps = fpsN / Math.max(fpsAcc, 1e-3);
    ui.stats.textContent = `${fps.toFixed(0)} fps · ${renderer.info.render.calls} calls`;
    const kd = document.getElementById('kDraw');
    if (kd) kd.textContent = renderer.info.render.calls;
    if (!autoDropped && t > 6 && fps < 26 && STATE.quality === 'high') {
      autoDropped = true; setQuality('medium');
    }
    fpsAcc = 0; fpsN = 0; lastStat = t;
  }
}
tick();
