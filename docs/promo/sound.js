// Soundtrack for promo.html, synthesised with the Web Audio API so every hit lands on its
// frame and there is nothing to license. renderSoundtrack() returns a 48 kHz stereo WAV.
// Style: retro funk, 110 BPM in E dorian — tight swung drums, slap bass, a wah clavinet
// chopping 16ths, a warm electric piano, and brass stabs on the cuts.
/* eslint-disable no-unused-vars */
const SOUND = {
  duration: 19.4,
  bpm: 110,
  rate: 48000,
};

// Cut points of the animation (seconds), matching promo.html.
const CUTS = {
  drop: 2.5, // the app appears
  click: 5.6, // click on the favorite
  black: 6.02, // dip to black
  back: 6.3, // first feature
  features: [9.1, 11.3, 13.5, 15.3],
  end: 17.1,
};

async function renderSoundtrack() {
  const { duration, bpm, rate } = SOUND;
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * rate), rate);
  const beat = 60 / bpm;
  const step = beat / 4;
  const SWING = 0.022; // late off-beat 16ths make it groove

  // ---- Buses ----
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -15;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.12;
  // A touch of tape-style saturation for warmth.
  const shaper = ctx.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(1.6 * x) / Math.tanh(1.6);
  }
  shaper.curve = curve;
  master.connect(shaper).connect(comp).connect(ctx.destination);

  const reverb = ctx.createConvolver();
  const irLen = Math.floor(rate * 1.6);
  const ir = ctx.createBuffer(2, irLen, rate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3.5);
  }
  reverb.buffer = ir;
  const reverbOut = ctx.createGain();
  reverbOut.gain.value = 0.25;
  reverb.connect(reverbOut).connect(master);

  const noise = ctx.createBuffer(1, rate * 2, rate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  const send = (node, gain = 1, wet = 0, p = 0) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    const sp = ctx.createStereoPanner();
    sp.pan.value = p;
    node.connect(g).connect(sp).connect(master);
    if (wet) {
      const w = ctx.createGain();
      w.gain.value = wet;
      node.connect(w).connect(reverb);
    }
  };
  const env = (param, t, a, peak, d, sustain = 0.0001) => {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + a);
    param.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  };
  const noiseSrc = (t, len) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.start(t, Math.random());
    s.stop(t + len);
    return s;
  };
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const osc = (type, freq, t, len) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start(t);
    o.stop(t + len);
    return o;
  };

  // ---- Drums ----
  const kick = (t, level = 1) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.08);
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.9 * level, 0.22);
    o.connect(g);
    send(g);
    o.start(t);
    o.stop(t + 0.3);
  };
  const snare = (t, level = 1, ghost = false) => {
    const s = noiseSrc(t, 0.25);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1900;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    env(g.gain, t, 0.001, (ghost ? 0.08 : 0.42) * level, ghost ? 0.05 : 0.17);
    s.connect(f).connect(g);
    send(g, 1, ghost ? 0 : 0.22);
    if (!ghost) {
      const body = osc('triangle', 190, t, 0.15);
      body.frequency.exponentialRampToValueAtTime(140, t + 0.1);
      const bg = ctx.createGain();
      env(bg.gain, t, 0.001, 0.3 * level, 0.1);
      body.connect(bg);
      send(bg);
    }
  };
  const hat = (t, level = 1, open = false) => {
    const s = noiseSrc(t, open ? 0.25 : 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 8500;
    const g = ctx.createGain();
    env(g.gain, t, 0.001, 0.13 * level, open ? 0.2 : 0.03);
    s.connect(f).connect(g);
    send(g, 1, 0.03, 0.25);
  };
  const tamb = (t, level = 1) => {
    const s = noiseSrc(t, 0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 6500;
    f.Q.value = 3;
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.12 * level, 0.09);
    s.connect(f).connect(g);
    send(g, 1, 0.1, -0.35);
  };
  const tom = (t, pitch, level = 1) => {
    const o = osc('sine', pitch, t, 0.35);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.25);
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.5 * level, 0.25);
    o.connect(g);
    send(g, 1, 0.15, pitch > 150 ? 0.3 : -0.3);
  };

  // ---- Band ----
  const slap = (t, note, len, level = 1, pop = false) => {
    const o = osc('sawtooth', midi(note), t, len + 0.05);
    const o2 = osc('square', midi(note) * 0.5, t, len + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = pop ? 9 : 5;
    f.frequency.setValueAtTime(pop ? 4200 : 2400, t);
    f.frequency.exponentialRampToValueAtTime(260, t + Math.min(len, 0.2));
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.32 * level, len, 0.03);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    o.connect(f);
    o2.connect(g2).connect(f);
    f.connect(g);
    send(g);
  };
  const clav = (t, notes, level = 1) => {
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.06 * level, 0.09);
    // auto-wah: a resonant band-pass that opens on every hit
    const wah = ctx.createBiquadFilter();
    wah.type = 'bandpass';
    wah.Q.value = 6;
    wah.frequency.setValueAtTime(500, t);
    wah.frequency.exponentialRampToValueAtTime(2600, t + 0.05);
    wah.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    notes.forEach((n) => {
      osc('square', midi(n), t, 0.14).connect(wah);
      osc('sawtooth', midi(n) * 2, t, 0.14).connect(wah);
    });
    wah.connect(g);
    send(g, 2.2, 0.08, 0.45);
  };
  const keys = (t, notes, len, level = 1) => {
    // electric piano: sine with a bell-like overtone and tremolo
    notes.forEach((n, i) => {
      const o = osc('sine', midi(n), t, len + 0.4);
      const b = osc('sine', midi(n) * 3.01, t, 0.4);
      const g = ctx.createGain();
      env(g.gain, t + i * 0.012, 0.01, 0.07 * level, len, 0.02);
      const bg = ctx.createGain();
      env(bg.gain, t, 0.002, 0.02 * level, 0.25);
      const trem = ctx.createGain();
      trem.gain.value = 1;
      const lfo = osc('sine', 5.5, t, len + 0.4);
      const depth = ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth).connect(trem.gain);
      o.connect(g).connect(trem);
      b.connect(bg).connect(trem);
      send(trem, 1, 0.35, -0.3);
    });
  };
  const brass = (t, notes, len = 0.3, level = 1, fall = false) => {
    notes.forEach((n, i) => {
      [-10, 0, 10].forEach((cents) => {
        const o = osc('sawtooth', midi(n), t, len + 0.35);
        o.detune.value = cents;
        if (fall) o.detune.linearRampToValueAtTime(cents - 400, t + len + 0.3);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(700, t);
        f.frequency.exponentialRampToValueAtTime(4200, t + 0.04);
        f.frequency.exponentialRampToValueAtTime(1300, t + len);
        const g = ctx.createGain();
        env(g.gain, t, 0.025, 0.05 * level, len + 0.2);
        o.connect(f).connect(g);
        send(g, 1, 0.35, (i - 1) * 0.3);
      });
    });
  };

  // ---- Effects ----
  const whoosh = (t, len, from, to, level = 1) => {
    const s = noiseSrc(t, len + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + len);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4 * level, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f).connect(g);
    send(g, 1, 0.3);
  };
  const impact = (t, level = 1) => {
    const o = osc('sine', 100, t, 0.9);
    o.frequency.exponentialRampToValueAtTime(32, t + 0.6);
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.9 * level, 0.7);
    o.connect(g);
    send(g, 1, 0.4);
  };
  const click = (t, level = 1) => {
    const s = noiseSrc(t, 0.03);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = ctx.createGain();
    env(g.gain, t, 0.001, 0.45 * level, 0.02);
    s.connect(f).connect(g);
    send(g, 1, 0.1);
  };
  const pop = (t, level = 1, pitch = 1) => {
    const o = osc('sine', 950 * pitch, t, 0.12);
    o.frequency.exponentialRampToValueAtTime(330 * pitch, t + 0.07);
    const g = ctx.createGain();
    env(g.gain, t, 0.002, 0.16 * level, 0.08);
    o.connect(g);
    send(g, 1, 0.15);
  };
  const cymbal = (t, level = 1, reverse = false, len = 0.6) => {
    const s = noiseSrc(reverse ? t - len : t, len + 0.05);
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 5000;
    const g = ctx.createGain();
    if (reverse) {
      g.gain.setValueAtTime(0.0001, t - len);
      g.gain.exponentialRampToValueAtTime(0.3 * level, t - 0.01);
      g.gain.setValueAtTime(0.0001, t);
    } else env(g.gain, t, 0.002, 0.28 * level, len);
    s.connect(f).connect(g);
    send(g, 1, 0.3);
  };

  // ---- Harmony: E dorian vamp, Em9 (2 bars) – A13 (2 bars) ----
  const bar = beat * 4;
  const CHORDS = {
    Em9: { root: 28, clav: [55, 59, 62, 66], keys: [55, 62, 66, 71], brass: [64, 67, 71] },
    A13: { root: 33, clav: [55, 61, 66, 69], keys: [55, 61, 66, 69], brass: [61, 66, 69] },
  };
  const chordAt = (t) => (Math.floor(Math.max(0, t - CUTS.drop) / (bar * 2)) % 2 ? CHORDS.A13 : CHORDS.Em9);
  const silent = (t) => t > CUTS.click + 0.25 && t < CUTS.back;
  const swing = (n) => (n % 2 ? SWING : 0);

  // Bass riff (16th steps): [step, semitones above root, length in steps, pop]
  const RIFF = [[0, 12, 1.5, false], [3, 12, 0.6, false], [4, 15, 1, false], [6, 24, 0.7, true], [7, 22, 1, false],
    [10, 7, 1, false], [11, 10, 1, false], [12, 12, 1.5, false], [14, 15, 0.8, false], [15, 17, 0.8, true]];
  // Clav chops (16th steps) and accents.
  const CLAV = [[0, 1], [2, 0.6], [3, 0.8], [6, 1], [8, 0.7], [10, 1], [11, 0.6], [14, 0.9]];
  // Kick and snare pattern per bar.
  const KICKS = [0, 7, 10];
  const GHOSTS = [3, 9, 15];

  // Intro: clav and hats alone, opening up; drum fill into the drop.
  for (let t = 0.2, n = 0; t < CUTS.drop - 0.3; t += step, n++) {
    if (n % 2 === 0) hat(t + swing(n), 0.4 + 0.5 * (t / CUTS.drop));
    const c = CLAV.find(([s]) => s === n % 16);
    if (c && t > 0.5) clav(t + swing(n), CHORDS.Em9.clav, c[1] * (0.5 + 0.6 * (t / CUTS.drop)));
  }
  keys(0, CHORDS.Em9.keys, CUTS.drop - 0.2, 0.9);
  click(0.98, 1.1);
  pop(1.06, 1.1, 1.2);
  [0, 1, 2, 3].forEach((i) => tom(CUTS.drop - 0.55 + i * step, [260, 200, 150, 110][i], 0.8));
  snare(CUTS.drop - step, 0.8);

  // The band, from the drop to the end card.
  for (let t = CUTS.drop, n = 0; t < CUTS.end - 0.01; t += step, n++) {
    if (silent(t)) continue;
    const s = n % 16;
    const ts = t + swing(n);
    const ch = chordAt(t);
    if (KICKS.includes(s)) kick(ts);
    if (s === 4 || s === 12) snare(ts);
    if (GHOSTS.includes(s)) snare(ts, 1, true);
    hat(ts, s % 2 ? 0.55 : 0.85, s === 14);
    if (s % 4 === 2) tamb(ts, 0.9);
    RIFF.filter(([rs]) => rs === s).forEach(([, semi, len, isPop]) => slap(ts, ch.root + semi, len * step, 1, isPop));
    CLAV.filter(([cs]) => cs === s).forEach(([, acc]) => clav(ts, ch.clav, acc));
    if (s === 0) keys(t, ch.keys, bar * 0.9, 0.7);
  }

  // Drop: full band hit with brass.
  cymbal(CUTS.drop, 1);
  brass(CUTS.drop, CHORDS.Em9.brass, 0.35, 1.2);
  for (let i = 0; i < 13; i++) pop(CUTS.drop + 0.65 + i * 0.12, 0.25, 0.85 + (i % 4) * 0.1);

  // Into the favorite: tom fill, click, rush, then a beat of silence on black.
  [0, 1, 2, 3, 4, 5].forEach((i) => tom(CUTS.click - 0.7 + i * (step * 0.9), [300, 260, 220, 180, 140, 110][i], 0.7));
  click(CUTS.click, 1.3);
  whoosh(CUTS.click, 0.42, 500, 10000, 1.1);
  impact(CUTS.black, 1);
  // Back in with a brass hit.
  cymbal(CUTS.back, 0.9, true, 0.3);
  kick(CUTS.back, 1.1);
  cymbal(CUTS.back, 1);
  brass(CUTS.back, chordAt(CUTS.back + 0.01).brass.map((n) => n + 2), 0.35, 1.2);

  // Feature scene details.
  whoosh(6.85, 0.6, 600, 3000, 0.35);
  whoosh(7.75, 0.9, 900, 2600, 0.3);
  whoosh(9.55, 1.0, 500, 3500, 0.35);
  pop(10.55, 0.8, 0.9);
  pop(11.85, 0.8, 0.7);
  pop(12.0, 0.8, 0.8);
  pop(12.15, 0.7, 1.3);
  pop(16.0, 0.6, 0.5);

  // Every feature cut: brass stab with a fall, crash.
  CUTS.features.forEach((t, i) => {
    cymbal(t, 0.7, true, 0.4);
    brass(t, chordAt(t + 0.01).brass, 0.25, 1, i % 2 === 1);
    cymbal(t, 0.6);
  });

  // Ending: big fill, final chord with brass, ring out.
  for (let i = 0; i < 8; i++) {
    const t = CUTS.end - 0.55 + i * (step * 0.5);
    if (i % 2) snare(t, 0.7);
    else tom(t, [300, 240, 180, 120][i >> 1], 0.8);
  }
  kick(CUTS.end, 1.1);
  cymbal(CUTS.end, 1.1, false, 1.4);
  brass(CUTS.end, [64, 67, 71, 74], 0.9, 1.3);
  slap(CUTS.end, 28, 1.2, 1.1);
  keys(CUTS.end, [52, 59, 62, 66, 71], duration - CUTS.end - 0.4, 1.2);

  const buffer = await ctx.startRendering();
  for (let c = 0; c < 2; c++) {
    const d = buffer.getChannelData(c);
    const fade = Math.floor(rate * 0.8);
    for (let i = 0; i < fade; i++) d[d.length - 1 - i] *= i / fade;
  }
  return toWav(buffer);
}

function toWav(buffer) {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const data = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => data.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF');
  data.setUint32(4, 36 + len * ch * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  data.setUint32(16, 16, true);
  data.setUint16(20, 1, true);
  data.setUint16(22, ch, true);
  data.setUint32(24, buffer.sampleRate, true);
  data.setUint32(28, buffer.sampleRate * ch * 2, true);
  data.setUint16(32, ch * 2, true);
  data.setUint16(34, 16, true);
  str(36, 'data');
  data.setUint32(40, len * ch * 2, true);
  const chans = Array.from({ length: ch }, (_, c) => buffer.getChannelData(c));
  let peak = 0;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) peak = Math.max(peak, Math.abs(chans[c][i]));
  const norm = peak > 0.98 ? 0.98 / peak : 1; // never clip
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, chans[c][i] * norm));
      data.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return { wav: data.buffer, peak };
}
