/* Dust, sparks, rain on the glass, and the verlet pull cord. */
import * as THREE from 'three';

/* ----------------------------------------------------------------- dust */
export function createDust(scene, count, sunDir, win) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3 + 0] = -3.0 + Math.random() * 5.3;
    pos[i * 3 + 1] = 0.08 + Math.random() * 2.75;
    pos[i * 3 + 2] = -2.3 + Math.random() * 4.6;
    seed[i] = Math.random() * 100;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const uni = {
    uT: { value: 0 }, uShaft: { value: 1 }, uSize: { value: 1 },
    uSun: { value: sunDir.clone() },
    uWin: { value: new THREE.Vector4(win.lat0, win.lat1, win.hi0, win.hi1) },
    uWinX: { value: win.x },
    uCursor: { value: new THREE.Vector3(999, 999, 999) },
    uTint: { value: new THREE.Color(1.0, 0.86, 0.68) },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: `
      attribute float aSeed; uniform float uT, uSize, uShaft;
      uniform vec3 uSun, uCursor; uniform vec4 uWin; uniform float uWinX;
      varying float vA;
      void main(){
        vec3 p = position;
        p.x += sin(uT * 0.22 + aSeed) * 0.16;
        p.y += cos(uT * 0.17 + aSeed * 1.7) * 0.16;
        p.z += sin(uT * 0.13 + aSeed * 2.3) * 0.12;
        vec3 away = p - uCursor;
        float d = length(away);
        p += normalize(away + 1e-4) * (0.30 / (1.0 + d * d * 26.0));
        float t = (uWinX - p.x) / uSun.x;
        float hz = p.z - uSun.z * t;
        float hy = p.y - uSun.y * t;
        float inLat = smoothstep(0.0, 0.26, min(hz - uWin.x, uWin.y - hz));
        float inHi  = smoothstep(0.0, 0.26, min(hy - uWin.z, uWin.w - hy));
        float shaft = (t > 0.0) ? inLat * inHi : 0.0;
        vA = (0.055 + 0.95 * shaft * uShaft) * (0.45 + 0.55 * sin(aSeed * 9.0 + uT));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * (2.2 + 2.4 * fract(aSeed)) * (6.0 / max(-mv.z, 0.4));
      }`,
    fragmentShader: `
      uniform vec3 uTint; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.02, length(d));
        if (m < 0.01) discard;
        gl_FragColor = vec4(uTint * m * vA, m * vA);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return { pts, uni, dispose() { scene.remove(pts); geo.dispose(); mat.dispose(); } };
}

/* ----------------------------------------------------------------- sparks */
export function createSparks(scene, max = 260) {
  const pos = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const size = new Float32Array(max);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 } },
    vertexShader: `
      attribute float aLife; attribute float aSize; uniform float uScale;
      varying float vL;
      void main(){
        vL = aLife;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale * (9.0 / max(-mv.z, 0.4)) * (0.35 + 0.65 * aLife);
      }`,
    fragmentShader: `
      varying float vL;
      void main(){
        if (vL <= 0.001) discard;
        vec2 d = gl_PointCoord - 0.5;
        float m = smoothstep(0.5, 0.0, length(d));
        vec3 hot = mix(vec3(1.0, 0.22, 0.03), vec3(1.0, 0.82, 0.42), clamp(vL * 1.4, 0.0, 1.0));
        gl_FragColor = vec4(hot * m * vL * 2.0, m * vL);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  let head = 0;

  return {
    pts,
    burst(origin, n = 34, power = 1) {
      for (let i = 0; i < n; i++) {
        const k = head = (head + 1) % max;
        pos[k * 3 + 0] = origin.x + (Math.random() - 0.5) * 0.34;
        pos[k * 3 + 1] = origin.y + Math.random() * 0.07;
        pos[k * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.14;
        vel[k * 3 + 0] = (Math.random() - 0.5) * 0.45 * power;
        vel[k * 3 + 1] = (0.55 + Math.random() * 1.25) * power;
        vel[k * 3 + 2] = (Math.random() - 0.5) * 0.45 * power;
        life[k] = 0.55 + Math.random() * 0.75;
        size[k] = 0.7 + Math.random() * 1.5;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      geo.attributes.aSize.needsUpdate = true;
    },
    update(dt) {
      let any = false;
      for (let i = 0; i < max; i++) {
        if (life[i] <= 0) continue;
        any = true;
        life[i] -= dt * 0.72;
        vel[i * 3 + 1] += (0.55 - vel[i * 3 + 1] * 0.9) * dt;   // buoyancy, then drag
        vel[i * 3 + 0] *= 1 - 1.6 * dt;
        vel[i * 3 + 2] *= 1 - 1.6 * dt;
        pos[i * 3 + 0] += vel[i * 3 + 0] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (life[i] < 0) life[i] = 0;
      }
      if (any) {
        geo.attributes.position.needsUpdate = true;
        geo.attributes.aLife.needsUpdate = true;
      }
    },
  };
}

/* ----------------------------------------------------------------- pull cord */
export function createCord(scene, anchor, opts = {}) {
  const N = opts.segments || 9;
  const seg = (opts.length || 0.30) / (N - 1);
  const pts = [], prev = [];
  for (let i = 0; i < N; i++) {
    const p = new THREE.Vector3(anchor.x, anchor.y - seg * i, anchor.z);
    pts.push(p); prev.push(p.clone());
  }
  const beadAt = N - 1;

  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 28, 0.0023, 5, false);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8a6b35, metalness: 0.85, roughness: 0.42,
  });
  const tube = new THREE.Mesh(geo, mat);
  tube.frustumCulled = false;
  scene.add(tube);

  const bead = new THREE.Mesh(
    new THREE.SphereGeometry(0.0115, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x9a7a3c, metalness: 0.9, roughness: 0.3 })
  );
  scene.add(bead);

  let held = false, pulled = 0, armed = true;
  const grav = new THREE.Vector3(0, -7.4, 0);
  const tmp = new THREE.Vector3();

  function rebuild() {
    curve.points = pts;
    const g = new THREE.TubeGeometry(curve, 28, 0.0023, 5, false);
    tube.geometry.dispose();
    tube.geometry = g;
    bead.position.copy(pts[beadAt]);
  }

  return {
    tube, bead,
    get bottom() { return pts[beadAt]; },
    grab() { held = true; },
    drag(p) { if (held) pts[beadAt].copy(p); },
    release() {
      held = false;
      const fired = pulled > 0.085 && armed;
      if (fired) armed = false;
      setTimeout(() => { armed = true; }, 260);
      return fired;
    },
    update(dt) {
      const d = Math.min(dt, 0.033);
      for (let i = 1; i < N; i++) {
        if (held && i === beadAt) continue;
        tmp.copy(pts[i]);
        pts[i].x += (pts[i].x - prev[i].x) * 0.92 + grav.x * d * d;
        pts[i].y += (pts[i].y - prev[i].y) * 0.92 + grav.y * d * d;
        pts[i].z += (pts[i].z - prev[i].z) * 0.92 + grav.z * d * d;
        prev[i].copy(tmp);
      }
      pts[0].copy(anchor);
      for (let it = 0; it < 7; it++) {
        for (let i = 0; i < N - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          tmp.subVectors(b, a);
          const len = tmp.length() || 1e-5;
          const corr = (len - seg) / len;
          if (i === 0) { b.addScaledVector(tmp, -corr); }
          else if (held && i + 1 === beadAt) { a.addScaledVector(tmp, corr); }
          else { a.addScaledVector(tmp, corr * 0.5); b.addScaledVector(tmp, -corr * 0.5); }
        }
      }
      pulled = Math.max(0, (anchor.y - pts[beadAt].y) - (opts.length || 0.30) * 0.98);
      rebuild();
      return pulled;
    },
    dispose() {
      scene.remove(tube); scene.remove(bead);
      tube.geometry.dispose(); mat.dispose();
      bead.geometry.dispose(); bead.material.dispose();
    },
  };
}

/* ----------------------------------------------------------------- rain on glass */
export function rainMaterial(base) {
  const uni = { uT: { value: 0 }, uRain: { value: 0 } };
  base.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGlassPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlassPos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `
        uniform float uT, uRain;
        varying vec3 vGlassPos;
        float rhash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        void main() {`)
      .replace('#include <dithering_fragment>', `
        if (uRain > 0.001) {
          vec2 uv = vec2(vGlassPos.z * 1.35, vGlassPos.y * 2.10);
          float acc = 0.0;
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            vec2 g = uv * (1.0 + fi * 0.7) + vec2(fi * 7.3, 0.0);
            vec2 cell = floor(g);
            float r = rhash(cell);
            float speed = 0.35 + r * 0.9;
            float y = fract(g.y - uT * speed + r * 10.0);
            vec2 f = vec2(fract(g.x) - 0.5, y - 0.5);
            float trail = smoothstep(0.5, 0.0, abs(f.x) * 9.0) * smoothstep(0.52, 0.0, f.y) * 0.35;
            float drop = smoothstep(0.085, 0.0, length(f * vec2(1.0, 0.75)));
            acc += (drop + trail) * step(0.55, r);
          }
          acc = clamp(acc, 0.0, 1.0) * uRain;
          gl_FragColor.rgb += vec3(0.42, 0.48, 0.55) * acc * 0.5;
          gl_FragColor.a = clamp(gl_FragColor.a + acc * 0.45, 0.0, 1.0);
        }
        #include <dithering_fragment>`);
  };
  base.customProgramCacheKey = () => 'glass-rain';
  base.needsUpdate = true;
  return uni;
}
