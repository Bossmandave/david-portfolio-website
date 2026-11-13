/* Walk mode.
 *
 * The orbit camera rotates around a fixed pivot, which is right for framing the
 * room and wrong for exploring it — you are held at one point and spun. This
 * puts you inside the room at eye height: drag to look, WASD or an on-screen
 * stick to move, and you cannot walk through the furniture because the physics
 * layer already knows where it is.
 */
import * as THREE from 'three';

const EYE = 1.62;
const RADIUS = 0.26;
const SPEED = 1.5;
const RUN = 2.45;

export function createWalk(camera, dom, phys) {
  const pos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let yaw = 0, pitch = 0;
  let active = false;
  let look = null;                 // pointer id currently steering the view
  let lx = 0, ly = 0;              // last pointer position: touch has no movementX
  const keys = new Set();
  const stick = { on: false, x: 0, y: 0, id: -1, ox: 0, oy: 0, el: null, nub: null };
  let bob = 0;

  const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _want = new THREE.Vector3();

  function onKey(e, down) {
    if (!active) return;
    const k = e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
      if (down) keys.add(k); else keys.delete(k);
      e.preventDefault();
    }
  }
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));

  /* The joystick is a real element rather than a hot corner of the canvas: the
   * bottom-left of the screen is where the time slider lives, so a hidden zone
   * there was unreachable - the UI swallowed the touch before the canvas saw it. */
  function buildStick() {
    if (stick.el) return;
    const el = document.createElement('div');
    el.id = 'walkStick';
    const nub = document.createElement('i');
    el.appendChild(nub);
    document.body.appendChild(el);
    stick.el = el; stick.nub = nub;
    el.addEventListener('pointerdown', (e) => {
      if (!active) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      stick.on = true; stick.id = e.pointerId;
      stick.ox = r.left + r.width / 2; stick.oy = r.top + r.height / 2;
      el.setPointerCapture(e.pointerId);
      el.classList.add('live');
      stickMove(e);
    });
    el.addEventListener('pointermove', (e) => { if (stick.on && e.pointerId === stick.id) stickMove(e); });
    const end = (e) => {
      if (!stick.on || e.pointerId !== stick.id) return;
      stick.on = false; stick.x = 0; stick.y = 0;
      el.classList.remove('live');
      nub.style.transform = 'translate(-50%,-50%)';
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function stickMove(e) {
    const dx = THREE.MathUtils.clamp((e.clientX - stick.ox) / 42, -1, 1);
    const dy = THREE.MathUtils.clamp((e.clientY - stick.oy) / 42, -1, 1);
    stick.x = dx; stick.y = dy;
    stick.nub.style.transform =
      `translate(calc(-50% + ${dx * 22}px), calc(-50% + ${dy * 22}px))`;
  }

  function down(e) {
    if (!active) return;
    look = e.pointerId;
    lx = e.clientX; ly = e.clientY;
    dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!active || look !== e.pointerId) return;
    // touch events carry no movementX, so track the delta ourselves
    const dx = e.clientX - lx, dy = e.clientY - ly;
    lx = e.clientX; ly = e.clientY;
    const k = e.pointerType === 'touch' ? 0.0042 : 0.0030;
    yaw -= dx * k;
    pitch = THREE.MathUtils.clamp(pitch - dy * k, -1.15, 1.15);
  }
  function up(e) {
    if (look === e.pointerId) look = null;
  }
  dom.addEventListener('pointerdown', down);
  addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  return {
    get active() { return active; },

    enter() {
      active = true;
      // media queries alone are not reliable here (a headless or hybrid device
      // can report no pointer type at all), so decide from touch support
      const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 ||
                    innerWidth < 900;
      if (touch) {
        buildStick();
        if (stick.el) stick.el.classList.add('on');
      }
      pos.copy(camera.position);
      pos.y = EYE;
      // face wherever the orbit camera was looking, so the switch is seamless
      const d = camera.getWorldDirection(new THREE.Vector3());
      yaw = Math.atan2(-d.x, -d.z);
      pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
      if (phys) phys.slide(pos, RADIUS, pos.y - EYE, pos.y);
      vel.set(0, 0, 0);
      keys.clear();
    },

    exit() {
      active = false; keys.clear(); stick.on = false; stick.x = 0; stick.y = 0;
      if (stick.el) { stick.el.classList.remove('on', 'live'); }
    },

    update(dt) {
      if (!active) return;
      let fx = 0, fz = 0;
      if (keys.has('w') || keys.has('arrowup')) fz += 1;
      if (keys.has('s') || keys.has('arrowdown')) fz -= 1;
      if (keys.has('a') || keys.has('arrowleft')) fx -= 1;
      if (keys.has('d') || keys.has('arrowright')) fx += 1;
      if (stick.on) { fx += stick.x; fz -= stick.y; }

      const sp = keys.has('shift') ? RUN : SPEED;
      _f.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
      _want.set(0, 0, 0).addScaledVector(_f, fz).addScaledVector(_r, fx);
      if (_want.lengthSq() > 1) _want.normalize();
      _want.multiplyScalar(sp);

      // ease in and out rather than snapping, which reads as weight
      vel.lerp(_want, 1 - Math.pow(0.0015, dt));
      pos.addScaledVector(vel, dt);
      if (phys) phys.slide(pos, RADIUS, 0, EYE + 0.15);

      const moving = vel.length();
      bob += dt * moving * 4.2;
      camera.position.set(pos.x, EYE + Math.sin(bob) * 0.012 * Math.min(moving / SPEED, 1), pos.z);
      camera.rotation.set(0, 0, 0);
      camera.rotateY(yaw);
      camera.rotateX(pitch);
    },
  };
}
