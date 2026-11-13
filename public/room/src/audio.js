/* Procedurally synthesised room sound — no audio files. */
export function createAudio() {
  let ctx = null, master = null, nodes = null, started = false;
  let fireAmt = 0, rainAmt = 0, muted = false;
  let crackleTimer = 0, lastThud = 0;

  function noiseBuffer(seconds, kind) {
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        b0 = (b0 + 0.021 * w) / 1.021; d[i] = b0 * 12;
      } else if (kind === 'pink') {
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      } else {
        d[i] = w;
      }
    }
    return buf;
  }

  function loop(buf, dest, filters) {
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    let node = src;
    for (const f of filters) { node.connect(f); node = f; }
    node.connect(dest);
    src.start();
    return src;
  }

  function start() {
    if (started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    started = true;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);

    const brown = noiseBuffer(4, 'brown');
    const pink = noiseBuffer(4, 'pink');
    const white = noiseBuffer(4, 'white');

    // --- hearth: low rumble + band-passed body, panned slightly left of centre
    const fireGain = ctx.createGain(); fireGain.gain.value = 0;
    const firePan = ctx.createStereoPanner(); firePan.pan.value = -0.15;
    fireGain.connect(firePan); firePan.connect(master);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.7;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
    loop(brown, fireGain, [bp, lp]);

    // --- rain on the glass
    const rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rainGain.connect(master);
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 700;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 5200;
    loop(white, rainGain, [rhp, rlp]);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 900;
    lfo.connect(lfoG); lfoG.connect(rlp.frequency); lfo.start();

    // --- room tone
    const roomGain = ctx.createGain(); roomGain.gain.value = 0.012;
    roomGain.connect(master);
    const rtl = ctx.createBiquadFilter(); rtl.type = 'lowpass'; rtl.frequency.value = 260;
    loop(pink, roomGain, [rtl]);

    nodes = { fireGain, rainGain, firePan, white };
  }

  function crackle() {
    if (!ctx || !nodes) return;
    const dur = 0.035 + Math.random() * 0.11;
    const src = ctx.createBufferSource();
    src.buffer = nodes.white;
    src.playbackRate.value = 0.7 + Math.random() * 0.9;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900 + Math.random() * 2600;
    f.Q.value = 2.5 + Math.random() * 7;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const peak = (0.05 + Math.random() * 0.16) * fireAmt;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(nodes.firePan);
    const off = (Math.random() - 0.5) * 2;
    src.start(t, Math.random() * 3, dur + 0.02);
    src.stop(t + dur + 0.05);
  }

  return {
    get running() { return started && ctx && ctx.state === 'running'; },
    get muted() { return muted; },
    start() {
      start();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    // a short filtered-noise knock: books land soft, ceramics land hard
    thud(force = 0.5, kind = 'soft') {
      if (!started || !ctx || muted) return;
      const t = ctx.currentTime;
      if (t - lastThud < 0.045) return;
      lastThud = t;
      const dur = kind === 'hard' ? 0.16 : 0.11;
      const n = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      const d = buf.getChannelData(0);
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        const e = Math.pow(1 - i / d.length, kind === 'hard' ? 3.2 : 4.6);
        lp += ((Math.random() * 2 - 1) - lp) * (kind === 'hard' ? 0.55 : 0.22);
        d[i] = lp * e;
      }
      n.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = kind === 'hard' ? 2600 : 900;
      f.Q.value = 0.9;
      const g = ctx.createGain();
      g.gain.value = Math.min(0.5, 0.10 + force * 0.34);
      const body = ctx.createBiquadFilter();
      body.type = 'peaking';
      body.frequency.value = kind === 'hard' ? 420 : 180;
      body.gain.value = 7;
      body.Q.value = 1.3;
      n.connect(f); f.connect(body); body.connect(g); g.connect(master);
      n.start(t); n.stop(t + dur + 0.02);
    },
    // a short formant-ish chirp rather than a sample
    meow() {
      if (!started || !ctx || muted) return;
      const t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t);
      o.frequency.exponentialRampToValueAtTime(760, t + 0.09);
      o.frequency.exponentialRampToValueAtTime(410, t + 0.34);
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 3.2;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'lowpass'; f2.frequency.value = 2200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.085, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.40);
      o.connect(f); f.connect(f2); f2.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.42);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.12);
      return muted;
    },
    update(dt, { fire, rain, panX }) {
      fireAmt = fire; rainAmt = rain;
      if (!started || !nodes) return;
      const t = ctx.currentTime;
      nodes.fireGain.gain.setTargetAtTime(0.085 * fire, t, 0.25);
      nodes.rainGain.gain.setTargetAtTime(0.055 * rain, t, 0.5);
      if (typeof panX === 'number') nodes.firePan.pan.setTargetAtTime(
        Math.max(-0.9, Math.min(0.9, panX)), t, 0.3);
      if (fire > 0.05) {
        crackleTimer -= dt;
        if (crackleTimer <= 0) {
          crackle();
          crackleTimer = 0.045 + Math.random() * 0.38 / Math.max(fire, 0.2);
        }
      }
    },
  };
}
