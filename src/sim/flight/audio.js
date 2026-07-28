/**
 * Procedural flight soundscape for /fly — no audio files, all synthesised with
 * the Web Audio API and driven live from the sim state each frame.
 *
 * Turbofan model (the previous version used raw sawtooth oscillators, which
 * buzzed like an angry wasp — a real turbofan is mostly AIR, not buzz):
 *   • Fan whine    — a tonal whistle at the blade-pass frequency made by pushing
 *                    looping noise through a high-Q bandpass (resonant, breathy),
 *                    with a soft sine partial for body. Pitch rises with N1.
 *   • Core roar    — low sine + lowpassed noise for combustor/exhaust rumble.
 *   • Environment  — wind (bandpassed noise scaled by actual wind speed) and
 *                    airflow over the hull (scaled by TAS, louder dirty), plus a
 *                    ground/rolling rumble. These layers are prominent now so the
 *                    world doesn't feel silent around the engine.
 *   • Transients   — gear/flap clunks, engine light-off whoomph, warning tones.
 *
 * A soft-clip waveshaper on the master bus tames peaks so nothing crackles.
 * Browsers block audio until a gesture, so it's built lazily on first start().
 */

// tanh-ish soft clip curve so summed layers saturate gently instead of digitally
// clipping (the old graph could overshoot and crackle at full thrust)
function softClipCurve(k = 2.2) {
  const n = 1024
  const curve = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x) / Math.tanh(k)
  }
  return curve
}

export class FlightAudio {
  constructor() {
    this.ctx = null
    this.on = false
    this.nodes = null
    this._prevGear = true
    this._prevFlap = 1
    this._warnUntil = 0
  }

  _init() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return false
    const ctx = new Ctx()
    this.ctx = ctx

    // master bus: gain → soft-clip limiter → destination
    const master = ctx.createGain()
    master.gain.value = 0.0
    const limiter = ctx.createWaveShaper()
    limiter.curve = softClipCurve(2.2)
    limiter.oversample = '2x'
    master.connect(limiter); limiter.connect(ctx.destination)

    // shared looping white-noise buffer (2 s)
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const makeNoise = () => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(); return n }

    // ---- fan whine: resonant bandpassed noise (the breathy turbofan whistle) ----
    // high-Q bandpass on broadband noise gives a pitched-but-airy tone — far
    // smoother than a sawtooth. A quiet sine adds tonal body underneath.
    const fanNoise = makeNoise()
    const fanBP = ctx.createBiquadFilter(); fanBP.type = 'bandpass'; fanBP.frequency.value = 480; fanBP.Q.value = 3.2
    const fanBP2 = ctx.createBiquadFilter(); fanBP2.type = 'bandpass'; fanBP2.frequency.value = 960; fanBP2.Q.value = 5 // 2nd harmonic shimmer
    const fanGain = ctx.createGain(); fanGain.gain.value = 0
    const fan2Gain = ctx.createGain(); fan2Gain.gain.value = 0
    fanNoise.connect(fanBP); fanBP.connect(fanGain); fanGain.connect(master)
    fanNoise.connect(fanBP2); fanBP2.connect(fan2Gain); fan2Gain.connect(master)
    // tonal body under the whine
    const fanTone = ctx.createOscillator(); fanTone.type = 'sine'; fanTone.frequency.value = 240
    const fanToneGain = ctx.createGain(); fanToneGain.gain.value = 0
    fanTone.connect(fanToneGain); fanToneGain.connect(master); fanTone.start()

    // ---- core roar: low sine + lowpassed noise ----
    const core = ctx.createOscillator(); core.type = 'sine'; core.frequency.value = 45
    const coreGain = ctx.createGain(); coreGain.gain.value = 0
    core.connect(coreGain); coreGain.connect(master); core.start()

    const coreNoise = makeNoise()
    const coreNoiseFilter = ctx.createBiquadFilter(); coreNoiseFilter.type = 'lowpass'; coreNoiseFilter.frequency.value = 220
    const coreNoiseGain = ctx.createGain(); coreNoiseGain.gain.value = 0
    coreNoise.connect(coreNoiseFilter); coreNoiseFilter.connect(coreNoiseGain); coreNoiseGain.connect(master)

    // ---- wind: the moving air around you, scaled by real wind speed ----
    const wind = makeNoise()
    const windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 500; windFilter.Q.value = 0.5
    const windLP = ctx.createBiquadFilter(); windLP.type = 'lowpass'; windLP.frequency.value = 1400
    const windGain = ctx.createGain(); windGain.gain.value = 0
    wind.connect(windFilter); windFilter.connect(windLP); windLP.connect(windGain); windGain.connect(master)

    // ---- airflow over the hull, scaled by TAS (louder with gear/flaps out) ----
    const air = makeNoise()
    const airFilter = ctx.createBiquadFilter(); airFilter.type = 'bandpass'; airFilter.frequency.value = 900; airFilter.Q.value = 0.7
    const airGain = ctx.createGain(); airGain.gain.value = 0
    air.connect(airFilter); airFilter.connect(airGain); airGain.connect(master)

    // ---- transient bus (clunks, warnings) ----
    const fxGain = ctx.createGain(); fxGain.gain.value = 0.9; fxGain.connect(master)

    this.nodes = {
      master, fanBP, fanBP2, fanGain, fan2Gain, fanTone, fanToneGain,
      core, coreGain, coreNoiseFilter, coreNoiseGain,
      windFilter, windLP, windGain, airFilter, airGain, fxGain, noiseBuf,
    }
    return true
  }

  async start() {
    if (!this.ctx && !this._init()) return
    await this.ctx.resume()
    this.on = true
    this.nodes.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.3)
  }

  stop() {
    if (!this.ctx) return
    this.on = false
    this.nodes.master.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.2)
  }

  toggle() { this.on ? this.stop() : this.start() }

  _startStarter() {
    if (!this.ctx || this._starter) return
    // starter/APU whine — a soft filtered triangle, gentle not piercing
    const osc = this.ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 240
    const filt = this.ctx.createBiquadFilter(); filt.type = 'bandpass'; filt.frequency.value = 550; filt.Q.value = 2
    const gain = this.ctx.createGain(); gain.gain.value = 0
    osc.connect(filt); filt.connect(gain); gain.connect(this.nodes.master)
    osc.start()
    this._starter = { osc, gain }
  }

  _clunk(freq = 180, dur = 0.12, gain = 0.5) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const n = this.ctx.createBufferSource(); n.buffer = this.nodes.noiseBuf
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.5
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    n.connect(f); f.connect(g); g.connect(this.nodes.fxGain)
    n.start(t); n.stop(t + dur)
  }

  _warn(freq = 700) {
    if (!this.ctx || this.ctx.currentTime < this._warnUntil) return
    this._warnUntil = this.ctx.currentTime + 0.5
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0, t)
    g.gain.linearRampToValueAtTime(0.22, t + 0.02); g.gain.linearRampToValueAtTime(0.0, t + 0.18)
    o.connect(g); g.connect(this.nodes.fxGain); o.start(t); o.stop(t + 0.2)
  }

  update(state, out) {
    if (!this.on || !this.ctx) return
    const n = this.nodes
    const t = this.ctx.currentTime
    const smooth = (param, val, tc = 0.08) => param.setTargetAtTime(val, t, tc)

    // --- engine start: starter whine while cranking + light-off whoomph ---
    const cranking =
      (state.eng1Master && state.fuelPump1 && !state.eng1Started && (state.eng1N1 || 0) > 0.01) ||
      (state.eng2Master && state.fuelPump2 && !state.eng2Started && (state.eng2N1 || 0) > 0.01)
    if (cranking) {
      const crankN1 = Math.max(state.eng1N1 || 0, state.eng2N1 || 0)
      const wHz = 200 + crankN1 * 700
      if (!this._starter) this._startStarter()
      if (this._starter) {
        this._starter.osc.frequency.setTargetAtTime(wHz, t, 0.15)
        this._starter.gain.gain.setTargetAtTime(0.05, t, 0.2)
      }
    } else if (this._starter) {
      this._starter.gain.gain.setTargetAtTime(0, t, 0.25)
    }
    const bothStarted = !!state.eng1Started + !!state.eng2Started
    if (bothStarted > (this._prevStarted ?? bothStarted)) this._clunk(80, 0.45, 0.5) // combustor whoomph
    this._prevStarted = bothStarted

    // engine N1 fraction (0..1+), averaged across engines
    const n1 = out ? Math.max(0, Math.min(1.1, out.n1 / 100)) : 0

    // fan whine: blade-pass frequency climbs with N1. Both bandpass bands track
    // it (fundamental + a harmonic shimmer); a sine partial gives tonal weight.
    const bladeHz = 300 + n1 * 1500          // resonant centre — the whistle pitch
    smooth(n.fanBP.frequency, bladeHz)
    smooth(n.fanBP2.frequency, bladeHz * 2)
    smooth(n.fanGain.gain, 0.05 + n1 * 0.22)
    smooth(n.fan2Gain.gain, 0.02 + n1 * 0.10)
    smooth(n.fanTone.frequency, 120 + n1 * 220)
    smooth(n.fanToneGain.gain, 0.02 + n1 * 0.05)

    // core roar
    smooth(n.core.frequency, 40 + n1 * 24)
    smooth(n.coreGain.gain, 0.05 + n1 * 0.16)
    smooth(n.coreNoiseFilter.frequency, 150 + n1 * 300)
    let coreNoiseLvl = 0.03 + n1 * 0.12

    // --- environment: wind + airflow (now clearly audible) ---
    const tas = out ? out.tasKt * 0.514444 : 0
    const q = Math.min(1, tas / 240)
    const dirty = (state.gear ? 0.5 : 0) + (state.flap > 0 ? state.flap * 0.2 : 0) + (state.speedbrake || 0) * 0.4
    smooth(n.airFilter.frequency, 500 + q * 2200)
    smooth(n.airGain.gain, q * (0.10 + dirty * 0.10))   // ~2x the old level

    // wind: driven by the actual wind field (m/s), always present outside, and a
    // touch of gust flutter via the filter centre
    const windMs = out?.wind ? (out.wind.spdKt || 0) * 0.514444 : 0
    const windQ = Math.min(1, windMs / 25)
    const gust = out?.wind?.shear ? out.wind.shear : 0
    smooth(n.windFilter.frequency, 320 + windQ * 500 + Math.sin(t * 3) * 60 * gust, 0.2)
    smooth(n.windGain.gain, 0.04 + windQ * 0.14 + gust * 0.06)

    // ground/rolling rumble on the takeoff/landing roll
    if (state.onGround && tas > 2) {
      coreNoiseLvl += Math.min(0.16, tas / 55 * 0.16)
    }
    smooth(n.coreNoiseGain.gain, coreNoiseLvl)

    // transients on config change
    if (state.gear !== this._prevGear) { this._clunk(state.gear ? 150 : 200, 0.24, 0.55); this._prevGear = state.gear }
    if (state.flap !== this._prevFlap) { this._clunk(300, 0.16, 0.4); this._prevFlap = state.flap }

    // warnings
    if (out && out.overspeed) this._warn(880)
    if (state.stalled) this._warn(520)
  }
}
