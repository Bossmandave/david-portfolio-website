import type { Tier } from "@/engine/runtime/tier";

/**
 * A fullscreen triangle generated from gl_VertexID.
 *
 * No vertex buffer, no attributes, no bindings — WebGL2 can derive the three corners
 * from the vertex index alone. One triangle rather than two also avoids the diagonal
 * seam where a quad's halves meet, which shows up in fragment-heavy shaders.
 */
const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

/**
 * The ambient field as a plant the control loop disturbs.
 *
 * `uRinging` is how much the loop actually running the page overshoots, and it sets
 * how far a disturbance travels before it dies. Detune the site and the ripples reach
 * further and keep oscillating; damp it and they die where they start. The background
 * is not decorated by the control system — it is inside the loop.
 */
const FRAGMENT = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform vec2  uPointer;
uniform float uEnergy;
uniform float uRinging;
uniform float uDetail;

out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, float octaves) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    if (float(i) >= octaves) break;
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution) / uResolution.y;
  float aspect = uResolution.x / uResolution.y;
  vec2 origin = vec2(uPointer.x * aspect, uPointer.y);

  // Named 'radius', not 'distance': shadowing a GLSL built-in compiles on most
  // drivers and is rejected by some, which is the worst kind of bug — invisible
  // here, a blank background on somebody else's phone.
  float radius = length(uv - origin);

  vec2 q = uv * 1.35;
  q += vec2(uTime * 0.018, uTime * -0.012);
  q += (uv - origin) * 0.14 * uEnergy;

  float field = fbm(q, uDetail);

  // How far a disturbance carries before it dies. Under-damped loops ring outward;
  // a critically damped one absorbs the same disturbance on contact.
  // A ringing loop throws disturbances that travel; a settled one absorbs them where
  // they start. uRinging spans the full 0…1, so both ends of a gain slider are visibly
  // different rather than being squeezed into the same corner of the range.
  float ring = clamp(uRinging, 0.0, 1.0);
  float reach = mix(6.2, 1.4, 1.0 - ring);
  float ripple = sin(radius * 15.0 - uTime * 2.3) * exp(-radius * reach);

  // A standing glow at the commanded point. Loose loops bloom wide and soft; a settled
  // one holds a tight point. This is what makes the loop's character readable at rest,
  // without having to move first.
  float halo = exp(-radius * mix(8.5, 2.0, ring));

  float intensity = field * 0.12 + ripple * 0.20 * uEnergy + halo * 0.17;

  // Falls away from the centre so it never competes with type for contrast.
  intensity *= smoothstep(2.4, 0.08, length(uv));
  intensity = max(intensity, 0.0);

  vec3 response = vec3(0.435, 0.890, 0.949);
  fragColor = vec4(response * intensity, clamp(intensity * 2.6, 0.0, 0.58));
}`;

export interface FieldState {
  /** Seconds since the field started. */
  time: number;
  /** Loop output, −1…1 in each axis. */
  pointerX: number;
  pointerY: number;
  /** 0…1. Drives ripple amplitude. */
  energy: number;
  /** 0…1. How much the loop driving the page rings. */
  ringing: number;
}

/** Fraction of CSS resolution to render at. Fog does not need crisp pixels. */
const SCALE: Record<Tier, number> = { 0: 0, 1: 0.5, 2: 0.72 };

function compile(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // A driver that rejects the shader is a real possibility on old Android. Fail
    // quietly and let the caller fall back rather than taking the page down.
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export class FieldRenderer {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uniforms: Record<string, WebGLUniformLocation | null>;
  private scale: number;
  private width = 0;
  private height = 0;

  lost = false;

  private constructor(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    tier: Tier,
  ) {
    this.gl = gl;
    this.program = program;
    this.scale = SCALE[tier];
    this.uniforms = {
      uResolution: gl.getUniformLocation(program, "uResolution"),
      uTime: gl.getUniformLocation(program, "uTime"),
      uPointer: gl.getUniformLocation(program, "uPointer"),
      uEnergy: gl.getUniformLocation(program, "uEnergy"),
      uRinging: gl.getUniformLocation(program, "uRinging"),
      uDetail: gl.getUniformLocation(program, "uDetail"),
    };
  }

  static create(canvas: HTMLCanvasElement, tier: Tier): FieldRenderer | null {
    if (tier === 0) return null;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      // The field is ambience; it should never wake a discrete GPU to draw it.
      powerPreference: "low-power",
    });
    if (!gl) return null;

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return null;

    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return null;
    }

    const renderer = new FieldRenderer(gl, program, tier);
    gl.useProgram(program);
    gl.uniform1f(renderer.uniforms.uDetail, tier === 2 ? 4 : 2);
    return renderer;
  }

  /** @returns true when the backing store changed size. */
  resize(cssWidth: number, cssHeight: number, dpr: number): boolean {
    const width = Math.max(1, Math.round(cssWidth * dpr * this.scale));
    const height = Math.max(1, Math.round(cssHeight * dpr * this.scale));
    if (width === this.width && height === this.height) return false;

    this.width = width;
    this.height = height;
    this.gl.canvas.width = width;
    this.gl.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    return true;
  }

  render(state: FieldState): void {
    if (this.lost || this.width === 0) return;

    const { gl, uniforms } = this;
    gl.useProgram(this.program);
    gl.uniform2f(uniforms.uResolution, this.width, this.height);
    gl.uniform1f(uniforms.uTime, state.time);
    gl.uniform2f(uniforms.uPointer, state.pointerX, state.pointerY);
    gl.uniform1f(uniforms.uEnergy, state.energy);
    gl.uniform1f(uniforms.uRinging, state.ringing);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    const extension = this.gl.getExtension("WEBGL_lose_context");
    this.gl.deleteProgram(this.program);
    // Releasing the context explicitly matters: browsers cap how many a tab may hold,
    // and route changes would otherwise leak one per mount until the field stops
    // working with no visible cause.
    extension?.loseContext();
  }
}
