/**
 * Procedural flight soundscape for /fly — no audio files, all synthesised with
 * the Web Audio API and driven live from the sim state each frame.
 *
 * Layers:
 *   • Fan whine     — two detuned sawtooth oscillators whose pitch + gain rise
 *                     with N1; the turbofan "spool" you hear on the ramp.
 *   • Core rumble   — low sine + filtered noise for the combustor/exhaust roar.
 *   • Airflow hiss  — white noise through a band-pass that opens up with TAS
 *                     (wind over the hull), louder still with gear/flaps out.
 *   • Transients    — short filtered-noise "clunks" on gear and flap movement,
 *                     a wheel rumble on the ground, and warning tones.
 *
 * Browsers block audio until a user gesture, so the engine is created lazily on
 * the first start() call (wired to the on-screen SOUND toggle).
 */

export class FlightAudio {
  constructor() {
    this.ctx = null
    this.on = false
    this.nodes = null
    this._prevGear = true
    this._prevFlap = 1
    this._warnUntil = 0
  }

  /** Build the audio graph (called on first enable, from a user gesture). */
  _init() {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return false
    const ctx = new Ctx()
    this.ctx = ctx

    const master = ctx.createGain()
    master.gain.value = 0.0
    master.connect(ctx.destination)

    // ---- fan whine: two saws, detuned, through a low-pass ----
    const fanA = ctx.createOscillator(); fanA.type = 'sawtooth'; fanA.frequency.value = 90
    const fanB = ctx.createOscillator(); fanB.type = 'sawtooth'; fanB.frequency.value = 92
    const fanFilter = ctx.createBiquadFilter(); fanFilter.type = 'lowpass'; fanFilter.frequency.value = 1200; fanFilter.Q.value = 6
    const fanGain = ctx.createGain(); fanGain.gain.value = 0
    fanA.connect(fanFilter); fanB.connect(fanFilter); fanFilter.connect(fanGain); fanGain.connect(master)
    fanA.start(); fanB.start()

    // ---- core rumble: low sine + noise ----
    const core = ctx.createOscillator(); core.type = 'sine'; core.frequency.value = 45
    const coreGain = ctx.createGain(); coreGain.gain.value = 0
    core.connect(coreGain); coreGain.connect(master)
    core.start()

    // shared noise buffer source (looping white noise)
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    const makeNoise = () => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(); return n }

    // core noise (rumble body)
    const coreNoise = makeNoise()
    const coreNoiseFilter = ctx.createBiquadFilter(); coreNoiseFilter.type = 'lowpass'; coreNoiseFilter.frequency.value = 220
    const coreNoiseGain = ctx.createGain(); coreNoiseGain.gain.value = 0
    coreNoise.connect(coreNoiseFilter); coreNoiseFilter.connect(coreNoiseGain); coreNoiseGain.connect(master)

    // ---- airflow hiss: band-passed noise scaled by airspeed ----
    const air = makeNoise()
    const airFilter = ctx.createBiquadFilter(); airFilter.type = 'bandpass'; airFilter.frequency.value = 900; airFilter.Q.value = 0.7
    const airGain = ctx.createGain(); airGain.gain.value = 0
    air.connect(airFilter); airFilter.connect(airGain); airGain.connect(master)

    // ---- transient bus (clunks, warnings) ----
    const fxGain = ctx.createGain(); fxGain.gain.value = 0.9; fxGain.connect(master)

    this.nodes = {
      master, fanA, fanB, fanFilter, fanGain, core, coreGain,
      coreNoiseFilter, coreNoiseGain, airFilter, airGain, fxGain, noiseBuf,
    }
    return true
  }

  async start() {
    if (!this.ctx && !this._init()) return
    await this.ctx.resume()
    this.on = true
    this.nodes.master.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.3)
  }

  stop() {
    if (!this.ctx) return
    this.on = false
    this.nodes.master.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.2)
  }

  toggle() { this.on ? this.stop() : this.start() }

  /** short filtered-noise burst for gear/flap clunks etc. */
  _clunk(freq = 180, dur = 0.12, gain = 0.5) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const n = this.ctx.createBufferSource(); n.buffer = this.nodes.noiseBuf
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.5
    const g = this.ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    n.connect(f); f.connect(g); g.connect(this.nodes.fxGain)
    n.start(t); n.stop(t + dur)
  }

  /** short two-tone chirp for warnings (overspeed / stall). */
  _warn(freq = 700) {
    if (!this.ctx || this.ctx.currentTime < this._warnUntil) return
    this._warnUntil = this.ctx.currentTime + 0.5
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0, t)
    g.gain.linearRampToValueAtTime(0.25, t + 0.02); g.gain.linearRampToValueAtTime(0.0, t + 0.18)
    o.connect(g); g.connect(this.nodes.fxGain); o.start(t); o.stop(t + 0.2)
  }

  /**
   * Push live sim values every frame. `out` is the model's readout, `state` the
   * sim state. Cheap: just sets a few AudioParam targets + fires transients.
   */
  update(state, out) {
    if (!this.on || !this.ctx) return
    const n = this.nodes
    const t = this.ctx.currentTime
    const smooth = (param, val, tc = 0.08) => param.setTargetAtTime(val, t, tc)

    // engine N1 fraction (0..1), averaged across engines
    const n1 = out ? Math.max(0, Math.min(1.1, out.n1 / 100)) : 0
    // fan whine pitch: idle ~90 Hz → ~380 Hz at full
    const fanHz = 90 + n1 * 290
    smooth(n.fanA.frequency, fanHz)
    smooth(n.fanB.frequency, fanHz * 1.02)
    smooth(n.fanFilter.frequency, 700 + n1 * 2600)
    smooth(n.fanGain.gain, 0.03 + n1 * 0.16)
    // core rumble grows with N1
    smooth(n.core.frequency, 42 + n1 * 26)
    smooth(n.coreGain.gain, 0.04 + n1 * 0.14)
    smooth(n.coreNoiseFilter.frequency, 160 + n1 * 260)
    smooth(n.coreNoiseGain.gain, 0.02 + n1 * 0.10)

    // airflow hiss from TAS (m/s); gear + flaps add turbulent noise
    const tas = out ? out.tasKt * 0.514444 : 0
    const q = Math.min(1, tas / 260)
    const dirty = (state.gear ? 0.5 : 0) + (state.flap > 0 ? state.flap * 0.18 : 0) + state.speedbrake * 0.4
    smooth(n.airFilter.frequency, 500 + q * 2200)
    smooth(n.airGain.gain, q * (0.05 + dirty * 0.06))

    // ground wheel rumble when rolling
    if (state.onGround && tas > 2) {
      smooth(n.coreNoiseGain.gain, (0.02 + n1 * 0.10) + Math.min(0.12, tas / 60 * 0.12))
    }

    // transients on config change
    if (state.gear !== this._prevGear) { this._clunk(state.gear ? 150 : 200, 0.22, 0.55); this._prevGear = state.gear }
    if (state.flap !== this._prevFlap) { this._clunk(300, 0.16, 0.4); this._prevFlap = state.flap }

    // warnings
    if (out && out.overspeed) this._warn(880)
    if (state.stalled) this._warn(520)
  }
}
