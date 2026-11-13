/* Sky dome + garden backdrop. The dome has no edges, so there is no void to find. */
import * as THREE from 'three';

export const SKY_STOPS = [
  // t, zenith, horizon, haze, sunTint, sunIntensity, elevationDeg, azimuthDeg
  { t: 0.00, zen: 0x1b4f8f, hor: 0xa8bcd0, haze: 0xd9dfe4, sun: 0xfff3dd, I: 14.0, el: 62, az: -6 },
  { t: 0.40, zen: 0x265f98, hor: 0xc9bda2, haze: 0xe4d3b4, sun: 0xffe0b3, I: 11.0, el: 26, az: -28 },
  { t: 0.66, zen: 0x2b4c7a, hor: 0xd99a55, haze: 0xe8a765, sun: 0xffa860, I: 8.2, el: 9, az: -46 },
  { t: 0.84, zen: 0x1a2a4c, hor: 0x8a5a55, haze: 0x6d4a52, sun: 0xff7a48, I: 1.6, el: 1.5, az: -58 },
  { t: 1.00, zen: 0x05070f, hor: 0x121a2c, haze: 0x1b2338, sun: 0x9fb4d8, I: 0.0, el: -8, az: -64 },
];

const _a = new THREE.Color(), _b = new THREE.Color();

export function sampleSky(t) {
  const s = SKY_STOPS;
  let i = 0;
  while (i < s.length - 2 && t > s[i + 1].t) i++;
  const A = s[i], B = s[i + 1];
  const k = THREE.MathUtils.clamp((t - A.t) / (B.t - A.t), 0, 1);
  const mix = (ca, cb) => _a.setHex(ca, THREE.SRGBColorSpace)
    .lerp(_b.setHex(cb, THREE.SRGBColorSpace), k).clone();
  return {
    zen: mix(A.zen, B.zen), hor: mix(A.hor, B.hor), haze: mix(A.haze, B.haze),
    sun: mix(A.sun, B.sun),
    I: THREE.MathUtils.lerp(A.I, B.I, k),
    el: THREE.MathUtils.lerp(A.el, B.el, k),
    az: THREE.MathUtils.lerp(A.az, B.az, k),
  };
}

/** Travel direction of sunlight for an elevation/azimuth pair (three Y-up). */
export function sunDirection(elDeg, azDeg, out = new THREE.Vector3()) {
  const el = THREE.MathUtils.degToRad(elDeg);
  const az = THREE.MathUtils.degToRad(azDeg);
  // comes from the west (-X) and travels +X, descending
  const horiz = Math.cos(el);
  return out.set(horiz * Math.cos(az), -Math.sin(el), -horiz * Math.sin(az)).normalize();
}

export function createSky(scene, GOD_LAYER) {
  const uni = {
    uZen: { value: new THREE.Color(0x265f98) },
    uHor: { value: new THREE.Color(0xc9bda2) },
    uHaze: { value: new THREE.Color(0xe4d3b4) },
    uSunCol: { value: new THREE.Color(0xffe0b3) },
    uSunDir: { value: new THREE.Vector3(-0.8, 0.44, 0.42) },
    uStars: { value: 0 },
    uExp: { value: 1.0 },
    uOvercast: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, toneMapped: true,
    vertexShader: `
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: `
      uniform vec3 uZen, uHor, uHaze, uSunCol, uSunDir;
      uniform float uStars, uExp, uOvercast;
      varying vec3 vDir;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y * 0.5 + 0.5, 0.0, 1.0);
        float up = pow(clamp(d.y, 0.0, 1.0), 0.62);
        vec3 c = mix(uHor, uZen, up);
        float horizonBand = pow(1.0 - abs(d.y), 9.0);
        c = mix(c, uHaze, horizonBand * 0.75);
        float sd = max(dot(d, -normalize(uSunDir)), 0.0);
        c += uSunCol * pow(sd, 220.0) * 2.6;
        c += uSunCol * pow(sd, 7.0) * 0.26;
        if (uStars > 0.001) {
          vec3 g = floor(d * 240.0);
          float s = hash(g);
          float star = smoothstep(0.9975, 1.0, s) * clamp(d.y * 2.2, 0.0, 1.0);
          c += vec3(star) * uStars * (0.6 + 0.4 * hash(g + 11.0));
        }
        c = mix(c, vec3(dot(c, vec3(0.33))) * 1.04, uOvercast * 0.82);
        gl_FragColor = vec4(c * uExp, 1.0);
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -1000;
  dome.layers.enable(GOD_LAYER);
  scene.add(dome);
  return { dome, uni };
}

export function createBackdrop(scene, texDay, texNight, GOD_LAYER) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tDay: { value: texDay }, tNight: { value: texNight },
      mixN: { value: 0 }, exposure: { value: 0.80 },
      uTint: { value: new THREE.Color(1, 1, 1) }, uSnow: { value: 0 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D tDay, tNight; uniform float mixN, exposure, uSnow;
      uniform vec3 uTint; varying vec2 vUv;
      void main(){
        vec3 d = texture2D(tDay, vUv).rgb;
        vec3 n = texture2D(tNight, vUv).rgb;
        vec3 c = mix(d, n, mixN);
        if (uSnow > 0.001) {
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          vec3 snow = mix(vec3(l), vec3(0.62, 0.66, 0.74), 0.72);
          float ground = smoothstep(0.52, 0.34, vUv.y);
          c = mix(c, snow, uSnow * mix(0.35, 0.95, ground));
        }
        gl_FragColor = vec4(c * uTint * exposure, 1.0);
      }`,
    toneMapped: true, depthWrite: true, fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(46, 24), mat);
  mesh.position.set(-13.5, 2.05, 0);
  mesh.rotation.y = Math.PI / 2;
  mesh.layers.enable(GOD_LAYER);
  scene.add(mesh);
  return { mesh, uni: mat.uniforms };
}
