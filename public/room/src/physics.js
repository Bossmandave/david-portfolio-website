/* Rigid-body layer.
 *
 * Everything in the room is lit by a baked lightmap, which assumes nothing
 * moves. So the solver is lazy: a body exists only while its object is away
 * from home, the world steps only while something is awake, and an object that
 * settles goes back to being ordinary static geometry.
 */
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const UP = new THREE.Vector3(0, 1, 0);
const MAX_AWAKE = 28;

// Bounding-box volume badly overestimates a hollow bowl or a thin tray, which
// made everything far too heavy to shift. Use the mesh's own signed volume.
function meshVolume(geo) {
  const pos = geo.attributes.position;
  if (!pos) return 0;
  const idx = geo.index;
  const n = idx ? idx.count : pos.count;
  let v = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i, i1 = idx ? idx.getX(i + 1) : i + 1,
          i2 = idx ? idx.getX(i + 2) : i + 2;
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    v += a.dot(b.clone().cross(c)) / 6;
  }
  return Math.abs(v);
}

const DENSITY = { books: 400, cyl: 1400, box: 480 };

export function createPhysics(scene, colliders, opts = {}) {
  const onImpact = opts.onImpact || (() => {});

  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
  world.allowSleep = true;
  world.solver.iterations = 9;
  world.solver.tolerance = 0.002;
  world.broadphase = new CANNON.SAPBroadphase(world);

  const matStatic = new CANNON.Material('static');
  const matProp = new CANNON.Material('prop');
  world.addContactMaterial(new CANNON.ContactMaterial(matStatic, matProp, {
    friction: 0.34, restitution: 0.14,
  }));
  world.addContactMaterial(new CANNON.ContactMaterial(matProp, matProp, {
    friction: 0.38, restitution: 0.06,
  }));
  world.defaultContactMaterial.friction = 0.42;
  world.defaultContactMaterial.restitution = 0.08;

  /* ---------------------------------------------------------------- statics */
  const R = colliders.room || { rx: 3.0, ry: 2.4, rz: 2.95 };
  function plane(nx, ny, nz, d) {
    const b = new CANNON.Body({ mass: 0, material: matStatic, shape: new CANNON.Plane() });
    const n = new CANNON.Vec3(nx, ny, nz);
    b.quaternion.setFromVectors(new CANNON.Vec3(0, 0, 1), n);
    b.position.set(n.x * d, n.y * d, n.z * d);
    world.addBody(b);
    return b;
  }
  plane(0, 1, 0, 0);                       // floor
  plane(0, -1, 0, -R.rz);                  // ceiling
  plane(1, 0, 0, -R.rx);                   // -X wall
  plane(-1, 0, 0, -R.rx);                  // +X wall
  plane(0, 0, 1, -R.ry);                   // -Z wall
  plane(0, 0, -1, -R.ry);                  // +Z wall

  for (const c of colliders.static || []) {
    const b = new CANNON.Body({
      mass: 0, material: matStatic,
      shape: new CANNON.Box(new CANNON.Vec3(c.half[0], c.half[1], c.half[2])),
    });
    b.position.set(c.pos[0], c.pos[1], c.pos[2]);
    if (c.quat) b.quaternion.set(c.quat[0], c.quat[1], c.quat[2], c.quat[3]);
    world.addBody(b);
  }

  /* ---------------------------------------------------------------- registry */
  const kinds = new Map();
  for (const d of colliders.dynamic || []) kinds.set(d.name, d);

  const items = new Map();        // mesh -> record
  const awake = [];               // records with a live body, oldest first

  function register(mesh) {
    if (items.has(mesh)) return;
    // prep() bakes world transforms into IX_ meshes, so the geometry sits in
    // world space with an identity node. Recentre it once so the mesh
    // transform and the body transform are the same thing.
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    const c = bb.getCenter(new THREE.Vector3());
    const size = bb.getSize(new THREE.Vector3());
    if (c.lengthSq() > 1e-10 && !mesh.geometry.userData.__centred) {
      mesh.geometry.userData.__centred = true;
      mesh.geometry.translate(-c.x, -c.y, -c.z);
      mesh.position.add(c);
      mesh.updateMatrixWorld(true);
    }
    mesh.geometry.computeBoundingSphere();
    const hint = kinds.get(mesh.name);
    const kind = (hint && hint.kind) || 'box';
    const bookish = /^IX_(BSB|BSS|Book|CT_Books|FL_Books|ST_Books)/.test(mesh.name);
    const vol = meshVolume(mesh.geometry) || (size.x * size.y * size.z * 0.5);
    const dens = bookish ? DENSITY.books : DENSITY[kind];
    items.set(mesh, {
      mesh,
      home: mesh.position.clone(),
      homeQ: mesh.quaternion.clone(),
      half: new THREE.Vector3(size.x / 2, size.y / 2, size.z / 2),
      kind,
      mass: THREE.MathUtils.clamp(vol * dens, 0.09, 3.2),
      body: null,
      sharedMat: mesh.material,
      ownMat: null,
      relight: 0,
      restTimer: 0,
    });
  }

  function makeShape(rec) {
    const h = rec.half;
    if (rec.kind === 'cyl') {
      const r = Math.max(h.x, h.z) * 0.96;
      return new CANNON.Cylinder(r, r * 0.92, h.y * 2, 10);
    }
    return new CANNON.Box(new CANNON.Vec3(h.x * 0.97, h.y * 0.97, h.z * 0.97));
  }

  function wake(mesh) {
    const rec = items.get(mesh);
    if (!rec) return null;
    if (rec.body) { rec.body.wakeUp(); rec.restTimer = 0; return rec.body; }

    const body = new CANNON.Body({
      mass: rec.mass,
      material: matProp,
      shape: makeShape(rec),
      linearDamping: 0.06,
      angularDamping: 0.14,
      allowSleep: true,
      sleepSpeedLimit: 0.055,
      sleepTimeLimit: 0.45,
    });
    body.position.set(mesh.position.x, mesh.position.y, mesh.position.z);
    body.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
    body.addEventListener('collide', (e) => {
      const v = e.contact.getImpactVelocityAlongNormal();
      if (Math.abs(v) > 0.55) onImpact(mesh, Math.min(1, Math.abs(v) / 3.4), rec.kind);
    });
    world.addBody(body);
    rec.body = body;
    rec.restTimer = 0;
    mesh.castShadow = true;

    // give it its own material so the baked lighting can fade out as it leaves
    // the spot it was baked in
    if (!rec.ownMat) {
      rec.ownMat = rec.sharedMat.clone();
      rec.ownMat.lightMap = rec.sharedMat.lightMap;
      rec.ownMat.aoMap = rec.sharedMat.aoMap;
    }
    mesh.material = rec.ownMat;

    awake.push(rec);
    while (awake.length > MAX_AWAKE) {
      const old = awake.shift();
      if (old !== rec) freeze(old);
    }
    return body;
  }

  function freeze(rec) {
    if (!rec.body) return;
    world.removeBody(rec.body);
    rec.body = null;
  }

  /* ------------------------------------------------------------------ grab */
  let grab = null;
  const jointBody = new CANNON.Body({ mass: 0, shape: new CANNON.Sphere(0.012) });
  jointBody.collisionFilterGroup = 0;
  jointBody.collisionFilterMask = 0;
  world.addBody(jointBody);

  function beginGrab(mesh, worldPoint, camera) {
    const body = wake(mesh);
    if (!body) return false;
    body.wakeUp();
    jointBody.position.set(worldPoint.x, worldPoint.y, worldPoint.z);
    const local = body.pointToLocalFrame(new CANNON.Vec3(worldPoint.x, worldPoint.y, worldPoint.z));
    const c = new CANNON.PointToPointConstraint(body, local, jointBody, new CANNON.Vec3(0, 0, 0), 62);
    world.addConstraint(c);
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(), worldPoint);
    grab = { rec: items.get(mesh), body, constraint: c, plane,
             last: worldPoint.clone(), vel: new THREE.Vector3(), t: 0 };
    return true;
  }

  const _hit = new THREE.Vector3();
  function moveGrab(raycaster, dt) {
    if (!grab) return;
    if (!raycaster.ray.intersectPlane(grab.plane, _hit)) return;
    // keep it inside the room and off the floor
    _hit.x = THREE.MathUtils.clamp(_hit.x, -R.rx + 0.12, R.rx - 0.12);
    _hit.z = THREE.MathUtils.clamp(_hit.z, -R.ry + 0.12, R.ry - 0.12);
    _hit.y = THREE.MathUtils.clamp(_hit.y, 0.05, R.rz - 0.15);
    if (dt > 0) grab.vel.copy(_hit).sub(grab.last).divideScalar(Math.max(dt, 1 / 120));
    grab.last.copy(_hit);
    grab.t += dt;
    jointBody.position.set(_hit.x, _hit.y, _hit.z);
    grab.body.wakeUp();
  }

  function endGrab() {
    if (!grab) return;
    world.removeConstraint(grab.constraint);
    // A released object that is already nearly flat is almost certainly meant to
    // be set down, so snap its tilt to level rather than letting it topple on a
    // corner. Anything thrown keeps whatever orientation it had.
    const b0 = grab.body;
    const v0 = grab.vel.length();
    if (v0 < 1.1) {
      const up = new CANNON.Vec3(0, 1, 0);
      const bodyUp = b0.quaternion.vmult(up);
      if (bodyUp.y > 0.72) {
        const yaw = Math.atan2(2 * (b0.quaternion.w * b0.quaternion.y +
                                    b0.quaternion.x * b0.quaternion.z),
                               1 - 2 * (b0.quaternion.y * b0.quaternion.y +
                                        b0.quaternion.z * b0.quaternion.z));
        b0.quaternion.setFromAxisAngle(up, yaw);
        b0.angularVelocity.set(0, 0, 0);
      }
    }
    // carry the throw through, capped so a flick cannot fire it across the room
    const v = grab.vel.clampLength(0, 4.2);
    grab.body.velocity.set(v.x, v.y, v.z);
    if (v0 >= 1.1) {
      grab.body.angularVelocity.set(
        (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 2.2);
    }
    grab.body.wakeUp();
    grab = null;
  }

  /* ----------------------------------------------------------------- knock */
  function knock(mesh, worldPoint, dir, strength = 1) {
    const body = wake(mesh);
    if (!body) return false;
    body.wakeUp();
    const rec = items.get(mesh);
    const d = dir.clone().normalize();
    // aim slightly up and sideways so it topples rather than sliding flat
    d.y += 0.26;
    d.normalize();
    // aim for a target speed rather than a fixed impulse, so a heavy bowl and a
    // light book both react the way a nudge looks like it should
    const j = rec.mass * 1.35 * strength;
    const p = worldPoint || mesh.position;
    let rx = p.x - body.position.x, ry = p.y - body.position.y, rz = p.z - body.position.z;
    if (rx * rx + ry * ry + rz * rz < 1e-6) {
      // dead-centre hit: give it a lever arm, or it slides without toppling
      rx = rec.half.x * 0.6; rz = rec.half.z * 0.6; ry = rec.half.y * 0.5;
    }
    body.applyImpulse(new CANNON.Vec3(d.x * j, d.y * j, d.z * j),
                      new CANNON.Vec3(rx, ry, rz));
    return true;
  }

  /* ------------------------------------------------------------- pull out */
  function pullOut(mesh, camera, strength = 1) {
    // a shelf book: ease it forward off the shelf first, then let it drop
    const body = wake(mesh);
    if (!body) return false;
    const out = new THREE.Vector3();
    camera.getWorldDirection(out).negate();
    out.y = 0;
    out.normalize();
    body.wakeUp();
    body.velocity.set(out.x * 0.85 * strength, 0.12, out.z * 0.85 * strength);
    body.angularVelocity.set((Math.random() - 0.5) * 1.1, (Math.random() - 0.5) * 0.8,
                             (Math.random() - 0.5) * 1.1);
    return true;
  }

  /* ----------------------------------------------------------------- reset */
  const tweens = [];
  function reset() {
    endGrab();
    for (const rec of items.values()) {
      if (!rec.body && rec.relight <= 0) continue;
      freeze(rec);
      tweens.push({
        rec, t: 0,
        from: rec.mesh.position.clone(),
        fromQ: rec.mesh.quaternion.clone(),
      });
    }
    awake.length = 0;
  }

  function disturbed() {
    let n = 0;
    for (const rec of items.values()) if (rec.body || rec.relight > 0) n++;
    return n;
  }

  /* ---------------------------------------------------------------- update */
  let acc = 0;
  const FIXED = 1 / 60;
  function update(dt, lmScale) {
    // settled tweens home
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t = Math.min(1, tw.t + dt * 1.7);
      const e = 1 - Math.pow(1 - tw.t, 3);
      const rec = tw.rec;
      rec.mesh.position.lerpVectors(tw.from, rec.home, e);
      rec.mesh.quaternion.slerpQuaternions(tw.fromQ, rec.homeQ, e);
      rec.relight = Math.max(0, 1 - e);
      if (rec.ownMat) {
        rec.ownMat.lightMapIntensity = lmScale * (1 - 0.42 * rec.relight);
        rec.ownMat.envMapIntensity = 1 + 0.9 * rec.relight;
      }
      if (tw.t >= 1) {
        rec.mesh.material = rec.sharedMat;
        rec.relight = 0;
        tweens.splice(i, 1);
      }
    }

    if (!awake.length && !grab) return;

    acc += Math.min(dt, 0.05);
    let steps = 0;
    while (acc >= FIXED && steps < 4) {
      world.step(FIXED);
      acc -= FIXED;
      steps++;
    }

    for (let i = awake.length - 1; i >= 0; i--) {
      const rec = awake[i];
      const b = rec.body;
      if (!b) { awake.splice(i, 1); continue; }
      rec.mesh.position.set(b.position.x, b.position.y, b.position.z);
      rec.mesh.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
      // fade the baked lighting out as it leaves where it was baked
      const d = rec.mesh.position.distanceTo(rec.home);
      rec.relight = Math.min(1, d / 0.42);
      if (rec.ownMat) {
        rec.ownMat.lightMapIntensity = lmScale * (1 - 0.42 * rec.relight);
        rec.ownMat.envMapIntensity = 1 + 0.9 * rec.relight;
      }
      // once it has been still for a while, stop simulating it entirely
      if (b.sleepState === CANNON.Body.SLEEPING && (!grab || grab.rec !== rec)) {
        rec.restTimer += dt;
        if (rec.restTimer > 1.2) { freeze(rec); awake.splice(i, 1); }
      } else {
        rec.restTimer = 0;
      }
    }
  }

  /* Collision for a walking camera.
   *
   * The static colliders are already here for the props, so a walking viewer
   * costs nothing extra: resolve a sphere against the same boxes rather than
   * adding a character body and waking the solver on every step.
   */
  const boxes = [];
  for (const c of colliders.static || []) {
    boxes.push({
      c: new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]),
      h: new THREE.Vector3(c.half[0], c.half[1], c.half[2]),
      q: new THREE.Quaternion(
        c.quat ? c.quat[0] : 0, c.quat ? c.quat[1] : 0,
        c.quat ? c.quat[2] : 0, c.quat ? c.quat[3] : 1).invert(),
    });
  }
  const _rel = new THREE.Vector3(), _cl = new THREE.Vector3(), _push = new THREE.Vector3();

  function slide(pos, radius, feetY, headY) {
    for (const b of boxes) {
      // only things the body could actually walk into
      if (b.c.y + b.h.y < feetY + 0.06 || b.c.y - b.h.y > headY) continue;
      _rel.copy(pos).sub(b.c).applyQuaternion(b.q);
      const cx = THREE.MathUtils.clamp(_rel.x, -b.h.x, b.h.x);
      const cz = THREE.MathUtils.clamp(_rel.z, -b.h.z, b.h.z);
      const dx = _rel.x - cx, dz = _rel.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= radius * radius) continue;
      const d = Math.sqrt(d2);
      if (d < 1e-5) {
        // dead centre: push out along the shallower axis
        const ox = b.h.x - Math.abs(_rel.x), oz = b.h.z - Math.abs(_rel.z);
        _push.set(ox < oz ? Math.sign(_rel.x || 1) * (ox + radius) : 0, 0,
                  ox < oz ? 0 : Math.sign(_rel.z || 1) * (oz + radius));
      } else {
        _push.set(dx / d * (radius - d), 0, dz / d * (radius - d));
      }
      _push.applyQuaternion(b.q.clone().invert());
      pos.x += _push.x; pos.z += _push.z;
    }
    pos.x = THREE.MathUtils.clamp(pos.x, -R.rx + radius, R.rx - radius);
    pos.z = THREE.MathUtils.clamp(pos.z, -R.ry + radius, R.ry - radius);
    return pos;
  }

  return {
    slide,
    register, wake, beginGrab, moveGrab, endGrab, knock, pullOut, reset, update,
    disturbed,
    get grabbing() { return !!grab; },
    get grabbedMesh() { return grab ? grab.rec.mesh : null; },
    get awakeCount() { return awake.length; },
    has(mesh) { return items.has(mesh); },
    debug(mesh) {
      const r = items.get(mesh);
      if (!r) return null;
      return {
        kind: r.kind, mass: +r.mass.toFixed(3),
        half: r.half.toArray().map((n) => +n.toFixed(3)),
        hasBody: !!r.body,
        sleep: r.body ? r.body.sleepState : -1,
        vel: r.body ? r.body.velocity.toArray().map((n) => +n.toFixed(3)) : null,
        bodyPos: r.body ? [+r.body.position.x.toFixed(3), +r.body.position.y.toFixed(3),
                           +r.body.position.z.toFixed(3)] : null,
        meshPos: r.mesh.position.toArray().map((n) => +n.toFixed(3)),
      };
    },
    isDisturbed(mesh) {
      const r = items.get(mesh);
      return !!r && (!!r.body || r.relight > 0);
    },
  };
}
