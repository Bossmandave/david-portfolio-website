/* The cat.
 *
 * Built in code rather than in Blender, because anything added to the model
 * costs a two-hour lightmap bake and a cat that moves could never be baked
 * anyway. It takes its light from the room's probe and live lights.
 *
 * There are no bones. The body and tail are tubes whose vertices are rebuilt
 * each frame from a spine curve, which is cheap at this vertex count and gives
 * real squash and stretch through the poses. Legs are two-bone chains solved
 * with plain trigonometry against foot targets that step while walking.
 */
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
const ease = (t) => t * t * (3 - 2 * t);

/* ------------------------------------------------------------------ tube */
function buildTube(segs, radial) {
  const verts = (segs + 1) * (radial + 1);
  const pos = new Float32Array(verts * 3);
  const uv = new Float32Array(verts * 2);
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      uv[k * 2] = j / radial;
      uv[k * 2 + 1] = i / segs;
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.userData.segs = segs;
  g.userData.radial = radial;
  return g;
}

const _t = new THREE.Vector3(), _n = new THREE.Vector3(), _b = new THREE.Vector3();
const _prev = new THREE.Vector3();

function deformTube(geo, pts, radii, squashY) {
  const segs = geo.userData.segs, radial = geo.userData.radial;
  const pos = geo.attributes.position.array;
  _prev.set(0, 0, 1);
  for (let i = 0; i <= segs; i++) {
    const p = pts[i];
    if (i === 0) _t.copy(pts[1]).sub(pts[0]);
    else if (i === segs) _t.copy(pts[segs]).sub(pts[segs - 1]);
    else _t.copy(pts[i + 1]).sub(pts[i - 1]);
    _t.normalize();
    // A body tube wants its belly down, so the frame is referenced to world up
    // rather than parallel-transported. Transport drifts and flips where the
    // spine bends hard - which is exactly what a curled cat does.
    _b.crossVectors(_t, UP);
    if (_b.lengthSq() < 1e-6) _b.set(1, 0, 0).addScaledVector(_t, -_t.x);
    _b.normalize();
    _n.crossVectors(_b, _t).normalize();
    const r = radii[i];
    const sy = squashY ? squashY[i] : 1;
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const c = Math.cos(a) * r, sv = Math.sin(a) * r * sy;
      const k = (i * (radial + 1) + j) * 3;
      pos[k] = p.x + _b.x * c + _n.x * sv;
      pos[k + 1] = p.y + _b.y * c + _n.y * sv;
      pos[k + 2] = p.z + _b.z * c + _n.z * sv;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.computeVertexNormals();
}

/* ------------------------------------------------------------------ poses */
// spine runs tail-base (0) -> shoulders (N). Local space: +X forward, Y up.
const SPINE_N = 10;
const TAIL_N = 9;

function spineFor(name) {
  const p = [];
  for (let i = 0; i <= SPINE_N; i++) {
    const t = i / SPINE_N;
    let x, y;
    if (name === 'stand') {
      x = lerp(-0.170, 0.178, t);
      y = 0.172 + Math.sin(t * Math.PI) * 0.011 + t * 0.015;
    } else if (name === 'sit') {
      x = lerp(-0.138, 0.128, t * t * 0.55 + t * 0.45);
      y = lerp(0.062, 0.243, Math.pow(t, 1.45)) + Math.sin(t * Math.PI) * 0.008;
    } else if (name === 'curl') {
      const a = lerp(-2.35, 1.75, t);
      x = Math.cos(a) * 0.082 + 0.012;
      y = 0.068 + Math.sin(t * Math.PI) * 0.020;
    } else if (name === 'stretch') {
      x = lerp(-0.188, 0.228, t);
      y = lerp(0.196, 0.068, Math.pow(t, 1.9)) + Math.sin(t * Math.PI) * 0.005;
    } else {                       // 'crouch' - mid pose while walking
      x = lerp(-0.168, 0.174, t);
      y = 0.164 + Math.sin(t * Math.PI) * 0.010 + t * 0.013;
    }
    let z = 0;
    if (name === 'curl') {
      const a = lerp(-2.35, 1.75, t);
      z = Math.sin(a) * 0.082;
    }
    p.push(new THREE.Vector3(x, y, z));
  }
  return p;
}

const POSES = {};
for (const n of ['stand', 'sit', 'curl', 'stretch', 'crouch']) POSES[n] = spineFor(n);

// body thickness along the spine: narrow at the hips, deepest at the ribs
const BODY_R = [];
for (let i = 0; i <= SPINE_N; i++) {
  const t = i / SPINE_N;
  // hips narrow, ribs deepest, neck narrow again
  BODY_R.push(0.0295 + Math.sin(Math.pow(t, 0.80) * Math.PI) * 0.0225 - t * 0.0015);
}
// taller than wide through the ribs, like a real ribcage
const BODY_SQ = BODY_R.map((_, i) => 1.18 - Math.sin((i / SPINE_N) * Math.PI) * 0.12);

/* ------------------------------------------------------------------ cat */
export function createCat(scene, opts = {}) {
  const group = new THREE.Group();
  group.name = 'IX_Cat';

  const fur = new THREE.MeshStandardMaterial({
    color: opts.color || 0x6f6358, roughness: 0.94, metalness: 0,
  });
  const furDark = new THREE.MeshStandardMaterial({
    color: 0x40382f, roughness: 0.95, metalness: 0,
  });
  const eyeMat = new THREE.MeshStandardMaterial({
    color: 0xc8a63c, roughness: 0.22, metalness: 0,
    emissive: 0x6a4e12, emissiveIntensity: 0.35,
  });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0x9a6a68, roughness: 0.6 });

  const bodyGeo = buildTube(SPINE_N, 10);
  const body = new THREE.Mesh(bodyGeo, fur);
  body.castShadow = true; body.receiveShadow = true;
  group.add(body);

  const tailGeo = buildTube(TAIL_N, 7);
  const tail = new THREE.Mesh(tailGeo, fur);
  tail.castShadow = true;
  group.add(tail);

  // head rides on the shoulder end of the spine
  const head = new THREE.Group();
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.047, 18, 14), fur);
  skull.scale.set(1.04, 0.95, 0.92);
  skull.castShadow = true;
  head.add(skull);
  const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.027, 14, 10), fur);
  muzzle.position.set(0.040, -0.011, 0);
  muzzle.scale.set(0.95, 0.74, 0.92);
  head.add(muzzle);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0062, 8, 6), noseMat);
  nose.position.set(0.063, -0.008, 0);
  head.add(nose);
  const ears = [];
  for (const sgn of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.040, 4), fur);
    ear.position.set(-0.008, 0.042, sgn * 0.026);
    ear.rotation.set(sgn * 0.30, 0, -0.10);
    ear.castShadow = true;
    head.add(ear);
    ears.push(ear);
  }
  const eyes = [];
  for (const sgn of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 10, 8), eyeMat);
    e.position.set(0.034, 0.008, sgn * 0.020);
    e.scale.set(0.62, 1, 1);
    head.add(e);
    eyes.push(e);
  }
  group.add(head);

  // four two-bone legs
  const legs = [];
  const LEG_DEF = [
    { name: 'FL', hip: new THREE.Vector3(0.110, 0.0, -0.034), len: 0.196, front: true },
    { name: 'FR', hip: new THREE.Vector3(0.110, 0.0, 0.034), len: 0.196, front: true },
    { name: 'BL', hip: new THREE.Vector3(-0.116, 0.0, -0.038), len: 0.212, front: false },
    { name: 'BR', hip: new THREE.Vector3(-0.116, 0.0, 0.038), len: 0.212, front: false },
  ];
  for (const d of LEG_DEF) {
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.0205, 0.0145, 1, 8), fur);
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.0140, 0.0108, 1, 8), fur);
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 10, 8), furDark);
    paw.scale.set(1.15, 0.72, 1);
    upper.castShadow = lower.castShadow = paw.castShadow = true;
    group.add(upper, lower, paw);
    legs.push({ ...d, upper, lower, paw,
      foot: new THREE.Vector3(), rest: new THREE.Vector3(), phase: d.front ? 0 : 0.5 });
  }

  scene.add(group);

  /* -------------------------------------------------------------- state */
  const spine = [];
  for (let i = 0; i <= SPINE_N; i++) spine.push(new THREE.Vector3());
  const tailPts = [];
  for (let i = 0; i <= TAIL_N; i++) tailPts.push(new THREE.Vector3());
  const tailR = [];
  for (let i = 0; i <= TAIL_N; i++) tailR.push(0.0155 - (i / TAIL_N) * 0.0048);

  let poseFrom = 'curl', poseTo = 'curl', poseT = 1;
  let state = 'sleep', stateT = 0, nextDecision = opts.sleepOnly ? 1e9 : 6;
  let blink = 0, nextBlink = 3;
  let earTwitch = 0, nextTwitch = 5;
  let walkPhase = 0, speed = 0;
  let lookAt = null, lookW = 0;
  let meowCb = opts.onMeow || null;

  const pos = new THREE.Vector3(opts.start ? opts.start.x : 0, 0, opts.start ? opts.start.z : 0);
  let yaw = opts.yaw || 0;
  let target = null, path = [];

  // places the cat is willing to be, with the pose it adopts there
  const SPOTS = opts.spots || [];

  function setPose(name, instant) {
    if (poseTo === name) return;
    poseFrom = poseTo; poseTo = name; poseT = instant ? 1 : 0;
    if (instant) poseFrom = name;
  }

  function pickSpot() {
    if (!SPOTS.length) return null;
    const away = SPOTS.filter((s) => s.pos.distanceTo(pos) > 0.5);
    const pool = away.length ? away : SPOTS;
    return pool[(Math.random() * pool.length) | 0];
  }

  function decide() {
    if (opts.sleepOnly) {
      // she stays asleep; she only ever stirs when you talk to her
      state = 'sleep'; setPose('curl'); nextDecision = 30;
      return;
    }
    if (state === 'sleep') {
      state = 'waking'; stateT = 0; setPose('sit');
      nextDecision = 2.6;
    } else if (state === 'waking') {
      state = 'stretching'; stateT = 0; setPose('stretch');
      nextDecision = 2.2;
    } else if (state === 'stretching') {
      const s = pickSpot();
      if (s) { target = s; state = 'walking'; stateT = 0; setPose('crouch'); nextDecision = 40; }
      else { state = 'sitting'; setPose('sit'); nextDecision = 8; }
    } else if (state === 'sitting') {
      if (Math.random() < 0.45) {
        const s = pickSpot();
        if (s) { target = s; state = 'walking'; setPose('crouch'); nextDecision = 40; return; }
      }
      state = 'sleep'; setPose('curl'); nextDecision = 18 + Math.random() * 20;
    } else {
      state = 'sitting'; setPose('sit'); nextDecision = 7 + Math.random() * 8;
    }
  }

  function arrive() {
    const s = target;
    target = null;
    state = s && s.pose === 'curl' ? 'sleep' : 'sitting';
    setPose(s ? s.pose : 'sit');
    if (s && s.yaw !== undefined) yaw = s.yaw;
    nextDecision = s && s.pose === 'curl' ? 20 + Math.random() * 25 : 8 + Math.random() * 9;
  }

  const _a = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  // placeBone and solveLeg get scratch of their own: they are called with the
  // outer temporaries as arguments, and reusing those here aliases the inputs
  const _pb = new THREE.Vector3();
  const _lh = new THREE.Vector3(), _lf = new THREE.Vector3();
  const _ld = new THREE.Vector3(), _lk = new THREE.Vector3(), _lb = new THREE.Vector3();

  function placeBone(mesh, a, b, radiusScale) {
    _pb.copy(b).sub(a);
    const len = Math.max(_pb.length(), 1e-4);
    mesh.position.copy(a).addScaledVector(_pb, 0.5);
    _q.setFromUnitVectors(UP, _pb.normalize());
    mesh.quaternion.copy(_q);
    mesh.scale.set(radiusScale || 1, len, radiusScale || 1);
  }

  function solveLeg(leg, hipWorld, footWorld) {
    _lh.copy(hipWorld); _lf.copy(footWorld);
    // two bones of equal length; knee pushed forward for the front pair,
    // backward for the rear, which is what gives a cat its hock
    const L = leg.len * 0.5;
    _ld.copy(_lf).sub(_lh);
    const d = Math.min(_ld.length(), L * 1.96);
    _ld.normalize();
    const h = Math.sqrt(Math.max(L * L - (d * 0.5) * (d * 0.5), 1e-6));
    _lk.copy(_lh).addScaledVector(_ld, d * 0.5);
    _lb.set(Math.cos(yaw), 0, -Math.sin(yaw)).multiplyScalar(leg.front ? 1 : -1);
    _lb.addScaledVector(UP, 0.18).normalize();
    _lk.addScaledVector(_lb, h);
    placeBone(leg.upper, _lh, _lk, 1);
    placeBone(leg.lower, _lk, _lf, 1);
    leg.paw.position.copy(_lf);
    leg.paw.rotation.set(0, yaw, 0);
  }

  const _sp = new THREE.Vector3();
  const LIFT = opts.lift || 0;
  function toWorld(local, out) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out.set(pos.x + local.x * c + local.z * s, local.y + LIFT, pos.z - local.x * s + local.z * c);
    return out;
  }

  return {
    group,
    get position() { return pos; },
    get busy() { return state === 'walking'; },

    // test handles
    setPoseDebug(n) { state = 'sitting'; nextDecision = 999; setPose(n, true); },
    gotoDebug(i) {
      if (!SPOTS[i]) return;
      target = SPOTS[i]; state = 'walking'; setPose('crouch'); nextDecision = 999;
    },

    /* a click: look up, perk the ears, and get up if asleep */
    poke(fromPoint) {
      lookAt = fromPoint ? fromPoint.clone() : null;
      lookW = 1;
      earTwitch = 1;
      if (!opts.sleepOnly && state === 'sleep') { state = 'waking'; setPose('sit'); nextDecision = 3; }
      if (meowCb) meowCb();
    },

    update(dt, t) {
      stateT += dt;
      nextDecision -= dt;
      if (nextDecision <= 0 && state !== 'walking') decide();

      // ---- locomotion
      if (state === 'walking' && target) {
        _d.set(target.pos.x - pos.x, 0, target.pos.z - pos.z);
        const dist = _d.length();
        if (dist < 0.06) { speed = Math.max(0, speed - dt * 1.6); if (speed < 0.02) arrive(); }
        else {
          speed = Math.min(0.42, speed + dt * 0.9);
          _d.normalize();
          const want = Math.atan2(-_d.z, _d.x);
          let dy = want - yaw;
          while (dy > Math.PI) dy -= Math.PI * 2;
          while (dy < -Math.PI) dy += Math.PI * 2;
          yaw += clamp(dy, -2.6 * dt, 2.6 * dt);
          pos.addScaledVector(_d, speed * dt);
        }
        walkPhase += speed * dt * 7.5;
      } else {
        speed = Math.max(0, speed - dt * 2.0);
      }

      // ---- pose blend
      poseT = Math.min(1, poseT + dt * 1.6);
      const e = ease(poseT);
      const A = POSES[poseFrom], B = POSES[poseTo];
      const bob = (state === 'sleep' ? 0.0022 : 0.0012) * Math.sin(t * (state === 'sleep' ? 1.5 : 2.4));
      for (let i = 0; i <= SPINE_N; i++) {
        _sp.lerpVectors(A[i], B[i], e);
        _sp.y += bob * Math.sin((i / SPINE_N) * Math.PI);
        if (speed > 0.01) _sp.y += Math.sin(walkPhase * 2 + i * 0.4) * 0.004 * (speed / 0.42);
        toWorld(_sp, spine[i]);
      }
      deformTube(bodyGeo, spine, BODY_R, BODY_SQ);

      // ---- head
      const hv = spine[SPINE_N];
      _d.copy(spine[SPINE_N]).sub(spine[SPINE_N - 2]).normalize();
      head.position.copy(hv).addScaledVector(_d, 0.040);
      head.position.y += poseTo === 'curl' ? 0.004 : 0.018;
      let hy = yaw;
      let hp = poseTo === 'curl' ? 0.5 : 0.08;
      if (lookAt) {
        _d.copy(lookAt).sub(head.position);
        const want = Math.atan2(-_d.z, _d.x);
        let dy = want - yaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        hy = yaw + clamp(dy, -0.85, 0.85) * lookW;
        hp = lerp(hp, -Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) * 0.6, lookW);
      }
      head.rotation.set(0, hy, 0);
      head.rotateZ(hp);
      lookW = Math.max(0, lookW - dt * 0.22);
      if (lookW <= 0) lookAt = null;

      // ---- blink and ear twitch
      nextBlink -= dt;
      if (nextBlink <= 0) { blink = 1; nextBlink = 2.5 + Math.random() * 5; }
      blink = Math.max(0, blink - dt * 7);
      const open = state === 'sleep' ? 0.06 : (1 - Math.sin(Math.min(blink, 1) * Math.PI) * 0.94);
      for (const ey of eyes) ey.scale.y = Math.max(0.04, open);
      nextTwitch -= dt;
      if (nextTwitch <= 0) { earTwitch = 1; nextTwitch = 3 + Math.random() * 7; }
      earTwitch = Math.max(0, earTwitch - dt * 3);
      const tw = Math.sin(earTwitch * Math.PI * 2) * 0.28 * earTwitch;
      ears[0].rotation.x = -0.30 + tw;
      ears[1].rotation.x = 0.30 - tw * 0.6;

      // ---- tail
      const base = spine[0];
      _d.copy(spine[0]).sub(spine[2]).normalize();
      for (let i = 0; i <= TAIL_N; i++) {
        const u = i / TAIL_N;
        const sway = Math.sin(t * 1.5 - u * 2.4) * (poseTo === 'curl' ? 0.012 : 0.030) * u;
        const lift = poseTo === 'curl' ? -0.02 * u
          : poseTo === 'sit' ? Math.sin(u * 2.1) * 0.035
          : 0.045 * Math.sin(u * 1.5) + (speed > 0.05 ? 0.05 * u : 0);
        tailPts[i].copy(base)
          .addScaledVector(_d, u * 0.225)
          .add(new THREE.Vector3(0, lift, 0));
        tailPts[i].x += Math.sin(yaw) * sway;
        tailPts[i].z += Math.cos(yaw) * sway;
        if (poseTo === 'curl') {
          const a = u * 3.2;
          tailPts[i].x = base.x + Math.cos(a + yaw) * 0.10 * u + Math.sin(yaw) * sway;
          tailPts[i].z = base.z - Math.sin(a + yaw) * 0.10 * u + Math.cos(yaw) * sway;
          tailPts[i].y = base.y - 0.012 * u;
        }
      }
      deformTube(tailGeo, tailPts, tailR);

      // ---- legs
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        // the hip rides on the spine at its own station, offset sideways, and
        // the foot sits directly under it: anything else bends the knee out
        const si = leg.front ? SPINE_N - 2 : 1;
        const sp = spine[si];
        const lat = leg.hip.z;
        _a.set(sp.x + Math.sin(yaw) * lat, sp.y - 0.012, sp.z + Math.cos(yaw) * lat);

        // a curled cat is one rounded shape, so the legs are hidden - but they
        // are still solved, or they keep a stale transform at the origin and
        // drag the bounding box (and every raycast against it) with them
        const hide = poseTo === 'curl' && poseT > 0.85;
        leg.upper.visible = leg.lower.visible = leg.paw.visible = !hide;
        if (poseTo === 'curl') {
          _c.set(_a.x, Math.max(LIFT + 0.012, sp.y - 0.038), _a.z);
        } else {
          _c.set(_a.x, LIFT + 0.010, _a.z);
          const fwd = leg.front ? 1 : -1;
          if (poseTo === 'sit' && !leg.front) {
            // haunches folded forward under the hips
            _c.x += Math.cos(yaw) * 0.050; _c.z -= Math.sin(yaw) * 0.050;
            _c.y = 0.020;
          }
          if (poseTo === 'stretch' && leg.front) {
            _c.x += Math.cos(yaw) * 0.095; _c.z -= Math.sin(yaw) * 0.095;
          }
          if (speed > 0.02) {
            const ph = walkPhase + (leg.front ? 0 : Math.PI) + (lat > 0 ? Math.PI : 0);
            const sw = Math.sin(ph);
            _c.x += Math.cos(yaw) * sw * 0.042 * fwd;
            _c.z -= Math.sin(yaw) * sw * 0.042 * fwd;
            _c.y += Math.max(0, Math.sin(ph)) * 0.034 * (speed / 0.42);
          }
        }
        solveLeg(leg, _a, _c);
      }
    },

    dispose() {
      scene.remove(group);
      bodyGeo.dispose(); tailGeo.dispose();
    },
  };
}
