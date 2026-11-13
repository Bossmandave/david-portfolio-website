/* Portfolio books, the globe, prop nudges and the on-screen hints. */
import * as THREE from 'three';

export const PROJECTS = [
  { id: 'nivram', title: 'Nivram', kind: 'AI agent · client work',
    body: 'Streaming chat interface for an AI agent product. Token-by-token rendering, tool-call surfacing and interrupt handling, built to stay responsive while the model is still thinking.',
    stack: 'React · TypeScript · streaming SSE', url: '' },
  { id: 'branddrive', title: 'BrandDrive Mobile', kind: 'Production app · App Store',
    body: 'The mobile app for BrandDrive, shipped to the Apple App Store. Commerce flows, offline-tolerant state and a design system shared with the web product.',
    stack: 'React Native · TypeScript', url: '' },
  { id: 'duvane', title: 'Duvane', kind: 'B2B SaaS · founder',
    body: 'Estate management platform for gated residential communities in Nigeria. Built around the people who actually run estates — facility managers, developers and residents — rather than around the software.',
    stack: 'Next.js · TypeScript · product & brand', url: 'https://duvane.app' },
  { id: 'whitepenguin', title: 'WhitePenguin', kind: 'Multi-tenant platform',
    body: 'A preschool platform serving many schools from one deployment: per-tenant data isolation, branding and roles, with an admin surface that non-technical staff can actually use.',
    stack: 'Next.js · multi-tenancy', url: '' },
  { id: 'sanctuary', title: 'Sanctuary', kind: 'Donation platform',
    body: 'Giving platform with Paystack checkout and a Firebase backend. Built for reliability on patchy connections, where a failed payment means a lost donation.',
    stack: 'Firebase · Paystack · React', url: 'https://sanctuaryaltar.org' },
  { id: 'hyperskitchen', title: "Hyper's Kitchen", kind: 'Boutique storefront · own build',
    body: 'A pastry shop built to get browsing away from a grid. The collection is a drag-to-explore rail rather than a card wall, the limited run carries a live countdown, and the tray keeps its state as you move through the page. No client behind it — the brief was the typography.',
    stack: 'Next.js · TypeScript · motion', url: 'https://hyperskitchen.vercel.app' },
  { id: 'cverify', title: 'CVerify', kind: 'Certificate verification',
    body: 'Issue and verify certificates against a tamper-evident record, so a credential can be checked by anyone holding the link.',
    stack: 'Next.js · TypeScript', url: 'https://cverify.vercel.app' },
  { id: 'signal', title: 'Signal Engine', kind: 'Algorithmic trading research',
    body: 'A forex pipeline that detects ICT/SMC structure — fair-value gaps, order blocks, breaks of structure, liquidity sweeps — scores confluence, and delivers to Telegram. Walk-forward validated: only gold survived out-of-sample, at roughly 2.7 profit factor.',
    stack: 'Python · backtesting.py · Claude API', url: '' },
  { id: 'face', title: 'Face Access', kind: 'Mechatronics capstone',
    body: 'A face-recognition door access system on a Raspberry Pi — the project where the mechatronics degree and the software work met for the first time.',
    stack: 'Raspberry Pi · OpenCV · Python', url: '' },
];

export const GLOBE_PLACES = {
  home: { name: 'Abia State, Nigeria', lat: 5.45, lon: 7.52 },
  away: { name: 'Vilnius, Lithuania', lat: 54.687, lon: 25.280 },
};

const DEG = Math.PI / 180;

/** Blender-space lat/lon direction, converted to the glTF Y-up frame. */
export function latLonDir(lat, lon, out = new THREE.Vector3()) {
  const la = lat * DEG, lo = lon * DEG;
  return out.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo));
}

/* ----------------------------------------------------------------- books */
export function setupBooks(root) {
  const books = [];
  root.traverse((o) => {
    const m = /^IX_Book_(\d+)$/.exec(o.name || '');
    if (m) books[+m[1]] = o;
  });
  const state = books.map((o) => {
    if (!o) return null;
    return { obj: o, home: o.position.clone(), out: 0, target: 0, open: false };
  }).filter(Boolean);
  return {
    books: state,
    meshes: state.map((s) => s.obj),
    hover(obj) {
      for (const s of state) if (!s.open) s.target = (s.obj === obj) ? 0.055 : 0;
    },
    toggle(obj) {
      let opened = null;
      for (const s of state) {
        if (s.obj === obj) { s.open = !s.open; opened = s.open ? s : null; }
        else { s.open = false; s.target = 0; }
      }
      for (const s of state) s.target = s.open ? 0.175 : s.target;
      return opened ? state.indexOf(opened) : -1;
    },
    closeAll() { for (const s of state) { s.open = false; s.target = 0; } },
    // used by a shared link, which names a project rather than a mesh
    openOnly(i) {
      for (let k = 0; k < state.length; k++) {
        state[k].open = k === i;
        state[k].target = k === i ? 0.175 : 0;
      }
    },
    update(dt) {
      const k = 1 - Math.pow(0.0012, dt);
      for (const s of state) {
        s.out += (s.target - s.out) * k;
        s.obj.position.x = s.home.x - s.out;
        s.obj.rotation.z = -s.out * 0.9;
        s.obj.position.y = s.home.y + s.out * 0.012;
      }
    },
  };
}

/* ----------------------------------------------------------------- globe */
export function setupGlobe(root, scene) {
  let globe = null;
  root.traverse((o) => { if (o.name === 'IX_Globe') globe = o; });
  if (!globe) return null;

  const R = 0.165;
  const pos = new THREE.Vector3();
  globe.getWorldPosition(pos);

  const group = new THREE.Group();
  globe.add(group);                       // rides along with the spin

  const mk = (col, size) => new THREE.Mesh(
    new THREE.SphereGeometry(size, 16, 12),
    new THREE.MeshBasicMaterial({ color: col, toneMapped: false })
  );
  const a = latLonDir(GLOBE_PLACES.home.lat, GLOBE_PLACES.home.lon).multiplyScalar(R * 1.012);
  const b = latLonDir(GLOBE_PLACES.away.lat, GLOBE_PLACES.away.lon).multiplyScalar(R * 1.012);
  const m1 = mk(0xff7a1e, 0.0095); m1.position.copy(a); group.add(m1);
  const m2 = mk(0xffd98a, 0.0115); m2.position.copy(b); group.add(m2);

  // great-circle arc, lifted off the surface
  const na = a.clone().normalize(), nb = b.clone().normalize();
  const steps = 96;
  const curvePts = [];
  const ang = Math.acos(THREE.MathUtils.clamp(na.dot(nb), -1, 1));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const s = Math.sin(ang) || 1e-5;
    const p = na.clone().multiplyScalar(Math.sin((1 - t) * ang) / s)
      .addScaledVector(nb, Math.sin(t * ang) / s).normalize();
    const lift = 1.008 + Math.sin(t * Math.PI) * 0.10;
    curvePts.push(p.multiplyScalar(R * lift));
  }
  const curve = new THREE.CatmullRomCurve3(curvePts);
  const arcGeo = new THREE.TubeGeometry(curve, 180, 0.0045, 7, false);
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xff8a2c, transparent: true, opacity: 1.0,
    toneMapped: false, depthWrite: false });
  const arc = new THREE.Mesh(arcGeo, arcMat);
  arc.renderOrder = 5;
  group.add(arc);
  const total = arcGeo.index ? arcGeo.index.count : 0;
  arcGeo.setDrawRange(0, 0);

  // how far to spin so Vilnius faces a given world point
  const angOf = (v) => Math.atan2(v.z, v.x);
  function spinFor(target) {
    const want = target.clone().sub(pos).normalize();
    const keep = globe.rotation.y;          // measure against the un-spun frame
    globe.rotation.y = 0;
    globe.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(globe.matrixWorld).invert();
    const u = want.clone().transformDirection(inv).normalize();
    globe.rotation.y = keep;
    globe.updateMatrixWorld(true);
    return angOf(nb) - angOf(u);
  }

  let spinTarget = globe.rotation.y;
  let idleSpin = true;
  let reveal = 0;

  const _mw = new THREE.Vector3();
  return {
    obj: globe, group, position: pos, radius: R,
    markerWorld(out = _mw) { return m2.getWorldPosition(out); },
    focus(camPos) {
      idleSpin = false;
      const want = spinFor(camPos);
      const cur = globe.rotation.y;
      spinTarget = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur));
    },
    release() { idleSpin = true; },
    set revealing(v) { reveal = v ? 1 : 0; },
    update(dt, active) {
      if (active) {
        const k = 1 - Math.pow(0.004, dt);
        globe.rotation.y += (spinTarget - globe.rotation.y) * k;
        reveal = Math.min(1, reveal + dt * 1.6);
      } else {
        if (idleSpin) globe.rotation.y += dt * 0.035;
        reveal = Math.max(0, reveal - dt * 1.8);
      }
      arcGeo.setDrawRange(0, Math.floor(total * THREE.MathUtils.smoothstep(reveal, 0, 1)));
      arcMat.opacity = 0.35 + 0.6 * reveal;
      m1.visible = m2.visible = reveal > 0.02;
      const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.26;
      m2.scale.setScalar(pulse * (0.6 + 0.4 * reveal));
    },
  };
}

/* ----------------------------------------------------------------- nudgeable props */
export function setupProps(root, names) {
  const items = [];
  root.traverse((o) => {
    if (names.some((n) => o.name === n)) {
      items.push({ obj: o, home: o.position.clone(), rot: o.rotation.clone(), t: 0, dir: 1 });
    }
  });
  return {
    meshes: items.map((i) => i.obj),
    nudge(obj) {
      const it = items.find((i) => i.obj === obj);
      if (!it) return false;
      it.t = 1; it.dir = Math.random() < 0.5 ? -1 : 1;
      return true;
    },
    update(dt) {
      for (const it of items) {
        if (it.t <= 0) continue;
        it.t = Math.max(0, it.t - dt * 1.5);
        const e = it.t * it.t;
        const w = Math.sin((1 - it.t) * 26) * e;
        it.obj.rotation.x = it.rot.x + w * 0.12 * it.dir;
        it.obj.rotation.z = it.rot.z - w * 0.09 * it.dir;
        it.obj.position.y = it.home.y + Math.abs(w) * 0.008;
        it.obj.position.x = it.home.x + w * 0.004 * it.dir;
      }
    },
  };
}

/* ----------------------------------------------------------------- screen hints */
export function createHints(container, specs) {
  const els = specs.map((s) => {
    const el = document.createElement('button');
    el.className = 'hint';
    el.type = 'button';
    el.innerHTML = `<i></i><span>${s.label}</span>`;
    el.dataset.key = s.key;
    container.appendChild(el);
    return el;
  });
  const v = new THREE.Vector3();
  let shown = true;
  return {
    els,
    setVisible(on) { shown = on; container.classList.toggle('hints-off', !on); },
    update(camera, raycaster, occluders) {
      if (!shown) return;
      for (let i = 0; i < specs.length; i++) {
        const s = specs[i], el = els[i];
        v.copy(s.pos).project(camera);
        const onScreen = v.z < 1 && v.x > -0.97 && v.x < 0.97 && v.y > -0.92 && v.y < 0.92;
        let vis = onScreen;
        if (vis && occluders) {
          const dir = s.pos.clone().sub(camera.position);
          const dist = dir.length();
          raycaster.set(camera.position, dir.normalize());
          raycaster.far = dist - 0.12;
          const hit = raycaster.intersectObjects(occluders, true);
          vis = hit.length === 0;
          raycaster.far = Infinity;
        }
        el.style.display = vis ? 'flex' : 'none';
        if (vis) {
          el.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
          el.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
        }
      }
    },
  };
}
