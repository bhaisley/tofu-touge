/* Tofu Touge. The driving voices are original offline SuperCollider renders. */
(() => {
  "use strict";

  const scriptUrl = document.currentScript?.src;
  const engineRpm = {
    "engine-idle": 960,
    "engine-low": 2400,
    "engine-drive": 3600,
    "engine-high": 6600,
    "engine-coast": 3600,
    "engine-intake": 5400,
  };
  const engineNames = Object.keys(engineRpm);
  const surfaceSounds = ["tire-scrub", "tire-squeal", "road-air"];
  const cues = {
    shift: { volume: 0.32, interval: 0.15, varies: true },
    overrun: { volume: 0.25, interval: 0.68, varies: true },
    impact: { volume: 0.63, interval: 0.38, varies: true },
    checkpoint: { volume: 0.31, interval: 0.50 },
    go: { volume: 0.33, interval: 0.50 },
    finish: { volume: 0.38, interval: 0.80 },
  };

  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const valid = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const unit = value => clamp(valid(value), 0, 1);
  function smooth(low, high, value) {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function soundUrl(name) {
    const filename = name + ".wav";
    if (window.TougeEmbeddedAudio?.[filename]) return window.TougeEmbeddedAudio[filename];
    return scriptUrl
      ? new URL("../assets/sfx/" + filename, scriptUrl).href
      : new URL("assets/sfx/" + filename, document.baseURI).href;
  }

  class TougeAudio {
    constructor({ radio = null, musicUrl = "" } = {}) {
      this.radio = radio || (musicUrl ? new TougeRadio([{id:"night-delivery", title:"Night Delivery", url:musicUrl}]) : null);
      this.musicPreview = false;
      this.context = null;
      this.active = false;
      this.enabled = true;
      this.musicEnabled = true;
      this.buffers = new Map();
      this.loading = new Map();
      this.loops = new Map();
      this.targets = new WeakMap();
      this.lastCue = new Map();
      this.pendingCue = new Map();
      if (this.radio) this.radio.onBuffer = buffer => this.buffers.set("music", buffer);
      this.nextMix = 0;
      this.lastMix = 0;
      this.shiftStarted = -Infinity;
      this.filteredLoad = 0;
      this.telemetry = {
        rpm: 1050, speed: 0, slip: 0, throttle: 0, brake: 0, gear: 0,
        engineLoad: 0, tireScrub: 0, handbrake: false, angle: 0, cameraMode: 0, wall: null,
      };
    }

    // Called directly in a keyboard, mouse or touch gesture.
    unlock() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return Promise.resolve(false);
      if (!this.context) {
        try {
          this.context = new Audio({ latencyHint: "interactive" });
        } catch {
          return Promise.resolve(false);
        }
        const ctx = this.context;
        this.master = ctx.createGain();
        this.master.gain.value = this.enabled ? 0.88 : 0;
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -7;
        limiter.knee.value = 5;
        limiter.ratio.value = 5;
        limiter.attack.value = 0.005;
        limiter.release.value = 0.15;
        // Leave the ordinary mix linear. A rare coincident rail hit and
        // checkpoint can outrun the compressor's attack on a drifting car.
        const ceiling = ctx.createWaveShaper();
        const curve = new Float32Array(2049);
        for (let i = 0; i < curve.length; i++) {
          const x = 2 * i / (curve.length - 1) - 1;
          const a = Math.abs(x);
          curve[i] = a <= 0.76 ? x : Math.sign(x) * (0.76 + 0.125 * Math.tanh((a - 0.76) / 0.125));
        }
        ceiling.curve = curve;
        ceiling.oversample = "2x";
        this.master.connect(limiter).connect(ceiling).connect(ctx.destination);

        this.driveBus = ctx.createGain();
        this.driveBus.gain.value = this.active ? 1 : 0;
        this.driveBus.connect(this.master);
        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = "lowpass";
        this.engineFilter.Q.value = 0.67;
        this.engineFilter.frequency.value = 2300;
        this.intakeFilter = ctx.createBiquadFilter();
        this.intakeFilter.type = "lowpass";
        this.intakeFilter.Q.value = 0.64;
        this.intakeFilter.frequency.value = 3100;
        // Body and outlet resonances stay at the car's acoustic frequencies
        // while the recordings follow RPM. The bonnet hears more low mids.
        this.outlet = ctx.createBiquadFilter();
        this.outlet.type = "peaking";
        this.outlet.frequency.value = 605;
        this.outlet.Q.value = 0.99;
        this.outlet.gain.value = 3.3;
        const motor = this.motorBody = ctx.createBiquadFilter();
        motor.type = "lowshelf";
        motor.frequency.value = 375;
        motor.gain.value = 0;
        this.engineFilter.connect(this.outlet).connect(motor);
        this.intakeFilter.connect(motor);
        motor.connect(this.driveBus);

        // A single, band-limited return from the visible stone wall. The
        // changing path length and the side of the road locate the reflection.
        const reflectionLow = ctx.createBiquadFilter();
        reflectionLow.type = "lowpass";
        reflectionLow.frequency.value = 2350;
        reflectionLow.Q.value = 0.625;
        const reflectionHigh = ctx.createBiquadFilter();
        reflectionHigh.type = "highpass";
        reflectionHigh.frequency.value = 155;
        reflectionHigh.Q.value = 0.60;
        this.wallDelay = ctx.createDelay(0.12);
        this.wallDelay.delayTime.value = 0.032;
        this.wallGain = ctx.createGain();
        this.wallGain.gain.value = 0;
        this.wallPan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        motor.connect(reflectionHigh).connect(reflectionLow).connect(this.wallDelay)
          .connect(this.wallGain).connect(this.wallPan).connect(this.driveBus);
        this.tireBus = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
        this.tireBus.connect(this.driveBus);
        this.radio?.connect(ctx, this.master);
      }
      const ctx = this.context;
      const resumed = ctx.state === "running"
        ? Promise.resolve(true)
        : ctx.resume().then(() => true, () => false);

      // Start the motor samples at the same crank angle. Their loops span a
      // whole number of four-stroke cycles and all receive the same RPM ramp.
      Promise.all(engineNames.map(name => this.load(name, soundUrl(name))))
        .then(() => this.startEngineVoices());
      for (const name of [...surfaceSounds, ...Object.keys(cues)]) this.load(name, soundUrl(name));
      this.syncMusic();
      return resumed;
    }

    load(name, url) {
      if (this.buffers.has(name)) return Promise.resolve();
      if (this.loading.has(name)) return this.loading.get(name);
      const ctx = this.context;
      const request = fetch(url)
        .then(response => {
          if (!response.ok) throw Error("HTTP " + response.status);
          return response.arrayBuffer();
        })
        .then(bytes => ctx.decodeAudioData(bytes))
        .then(buffer => {
          this.buffers.set(name, buffer);
          if (surfaceSounds.includes(name)) {
            const bus = name === "road-air" ? this.driveBus : this.tireBus;
            this.startLoop(name, bus, ctx.currentTime, 1);
            this.mix();
          } else if (this.pendingCue.has(name)) {
            const pending = this.pendingCue.get(name);
            if (performance.now() - pending.time < 700) this.event(name, pending.strength);
          }
        })
        .catch(reason => console.warn("Tofu Touge audio could not load " + name, reason.message))
        .finally(() => {
          this.loading.delete(name);
          this.pendingCue.delete(name);
        });
      this.loading.set(name, request);
      return request;
    }

    startLoop(name, bus, when, rate) {
      const ctx = this.context;
      const source = ctx.createBufferSource();
      source.buffer = this.buffers.get(name);
      source.loop = true;
      source.playbackRate.value = rate;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(bus);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start(when);
      this.loops.set(name, { source, gain });
    }

    startEngineVoices() {
      const ready = engineNames.filter(name => this.buffers.has(name));
      if (ready.every(name => this.loops.has(name))) return;
      const ctx = this.context;
      const start = ctx.currentTime + 0.012;
      for (const name of ready) {
        // A previously missing file may arrive after a retry. Rejoin the
        // bank on a common sample boundary with a short, click-free fade.
        const old = this.loops.get(name);
        if (old) {
          old.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.004);
          old.source.stop(start + 0.016);
        }
        const bus = name === "engine-intake" ? this.intakeFilter : this.engineFilter;
        this.startLoop(name, bus, start, this.telemetry.rpm / engineRpm[name]);
      }
      this.mix();
    }

    ramp(parameter, value, seconds, now = this.context.currentTime) {
      if (this.targets.get(parameter) === value) return;
      this.targets.set(parameter, value);
      parameter.setTargetAtTime(value, now, seconds);
    }

    setEnabled(enabled) {
      this.enabled = !!enabled;
      if (this.master) this.ramp(this.master.gain, this.enabled ? 0.88 : 0, 0.013);
      if (!this.enabled) this.pendingCue.clear();
      this.syncMusic();
    }

    setActive(active) {
      this.active = !!active;
      if (this.driveBus) this.ramp(this.driveBus.gain, this.active ? 1 : 0, 0.025);
      if (!this.active) {
        this.pendingCue.clear();
        this.telemetry.gear = 0;
        this.shiftStarted = -Infinity;
      }
      this.filteredLoad = this.telemetry.engineLoad;
      this.nextMix = 0;
      if (this.context && this.active) this.mix();
      this.syncMusic();
    }

    setMusicEnabled(enabled) {
      this.musicEnabled = !!enabled;
      this.syncMusic();
    }

    setMusicPreview(enabled) {
      this.musicPreview = !!enabled;
      this.syncMusic();
    }

    syncMusic() {
      this.radio?.setPlaying((this.active || this.musicPreview) && this.enabled && this.musicEnabled);
    }

    update(data = {}) {
      const previousGear = this.telemetry.gear;
      const throttle = unit(data.throttle);
      const brake = unit(data.brake);
      const gear = valid(data.gear);
      const slip = unit(data.slip);
      this.telemetry = {
        rpm: clamp(valid(data.rpm, 1050), 750, 8600),
        speed: Math.abs(valid(data.speed)),
        gear,
        throttle, slip,
        brake,
        engineLoad: unit(valid(data.engineLoad, gear < 0 ? brake : throttle)),
        tireScrub: unit(valid(data.tireScrub, slip)),
        handbrake: !!data.handbrake,
        angle: valid(data.angle),
        cameraMode: data.cameraMode === 2 ? 2 : data.cameraMode === 1 ? 1 : 0,
        wall: data.wall || null,
      };
      if (this.active && previousGear > 0 && data.gear > 0 && data.gear !== previousGear && this.telemetry.speed > 12) {
        this.event("shift");
      }
      if (!this.context || !this.active || this.context.currentTime < this.nextMix) return;
      this.nextMix = this.context.currentTime + 1 / 60;
      this.mix();
    }

    setLayer(name, rate, volume, now, gainTime = 0.026) {
      const loop = this.loops.get(name);
      if (!loop) return;
      this.ramp(loop.source.playbackRate, rate, 0.023, now);
      this.ramp(loop.gain.gain, volume, gainTime, now);
    }

    mix() {
      const now = this.context.currentTime;
      const dt = clamp(now - this.lastMix, 0, 0.12);
      this.lastMix = now;
      const { rpm, throttle, brake, gear, engineLoad, speed, angle, slip, tireScrub, handbrake,
        cameraMode, wall } = this.telemetry;
      const pedal = gear < 0 ? brake : throttle;
      const load = 0.84 * engineLoad + 0.16 * pedal;
      const throttleChange = load - this.filteredLoad;
      this.filteredLoad += throttleChange * (1 - Math.exp(-dt / 0.16));
      if (pedal < 0.12 && throttleChange < -0.24 && rpm > 3250 && speed > 16 && now - this.shiftStarted > 0.30) {
        const strength = clamp(-throttleChange * (0.33 + rpm / 10500), 0.13, 0.86);
        this.event("overrun", strength);
      }

      const low = smooth(1220, 2110, rpm);
      const mid = smooth(2630, 3550, rpm);
      const high = smooth(4440, 6100, rpm);
      const onCam = smooth(3900, 6150, rpm);
      const coast = smooth(1370, 2550, rpm) * (1 - smooth(0.045, 0.55, load));
      const shiftPower = 0.36 + 0.64 * smooth(0.045, 0.185, now - this.shiftStarted);
      const tipIn = Math.max(0, throttleChange);
      const bonnet = cameraMode === 2;
      const tailLevel = bonnet ? 0.79 : cameraMode === 1 ? 1.06 : 1;
      const inletLevel = bonnet ? 1.48 : cameraMode === 1 ? 0.85 : 1;
      const exhaust = (0.31 + 0.49 * load ** 0.72 + 0.075 * onCam) *
        (1 - 0.76 * coast) * shiftPower * tailLevel;
      // Adjacent exhaust recordings share the crank phase. The small
      // overlap compensation retains their body as the resonances change.
      const level = weight => exhaust * weight * (1 + 0.28 * (1 - weight));
      this.setLayer("engine-idle", rpm / engineRpm["engine-idle"], level(1 - low), now);
      this.setLayer("engine-low", rpm / engineRpm["engine-low"], level(low * (1 - mid)), now);
      this.setLayer("engine-drive", rpm / engineRpm["engine-drive"], level(mid * (1 - high)), now);
      this.setLayer("engine-high", rpm / engineRpm["engine-high"], level(high), now);
      const coastLevel = (0.34 + 0.15 * smooth(1750, 5000, rpm)) * (0.77 + 0.23 * smooth(3, 27, speed));
      this.setLayer("engine-coast", rpm / engineRpm["engine-coast"], coast * coastLevel * tailLevel, now);
      const intake = smooth(1460, 3070, rpm) *
        ((0.17 + 0.28 * onCam) * load ** 1.55 + 0.30 * tipIn);
      this.setLayer("engine-intake", rpm / engineRpm["engine-intake"], intake * shiftPower * inletLevel, now, 0.016);
      this.ramp(this.engineFilter.frequency, (bonnet ? 0.60 : 1) *
        (1850 + 4130 * Math.sqrt(load) + rpm * 0.24), 0.045, now);
      this.ramp(this.intakeFilter.frequency, (bonnet ? 0.60 : 0.94) *
        (2400 + 3700 * load + 1200 * onCam + 1350 * tipIn), 0.028, now);
      this.ramp(this.outlet.gain, bonnet ? 0.5 : 3.3 + 2.2 * (1 - low), 0.07, now);
      this.ramp(this.motorBody.gain, bonnet ? 3.6 : 0, 0.07, now);

      if (wall) {
        const distance = clamp(wall.distance, 1.5, 17);
        const listenerOffset = bonnet ? 1.5 : cameraMode === 1 ? 4.8 : 6.2;
        const extraPath = Math.hypot(2 * distance, listenerOffset) - listenerOffset;
        this.ramp(this.wallDelay.delayTime, extraPath / 343, 0.075, now);
        if (this.wallPan.pan) this.ramp(this.wallPan.pan, wall.side * 0.79, 0.06, now);
        this.ramp(this.wallGain.gain, unit(wall.amount) * (bonnet ? 0.15 : 0.21) /
          (1 + distance * 0.075), 0.045, now);
      } else {
        this.ramp(this.wallGain.gain, 0, 0.045, now);
      }

      // Axle scrub catches lockup and front push. Body angle keeps the rear
      // tires audible during a held slide, including a countersteered one.
      const moving = smooth(5, 22, speed);
      const rearSlide = Math.max(slip, clamp((Math.abs(angle) - 0.072) / 0.54, 0, 1));
      const rubber = moving * Math.max(smooth(0.085, 0.44, rearSlide), smooth(0.14, 0.63, tireScrub));
      const breakaway = handbrake ? smooth(0.075, 0.39, Math.max(rearSlide, tireScrub)) : 0;
      const squeal = moving * Math.max(smooth(0.095, 0.43, rearSlide), smooth(0.31, 0.75, tireScrub), breakaway);
      const pitch = 0.83 + 0.19 * smooth(12, 100, speed) + 0.15 * squeal;
      this.setLayer("tire-scrub", 0.83 + 0.26 * rubber + 0.09 * smooth(12, 100, speed), 0.44 * rubber, now, 0.038);
      this.setLayer("tire-squeal", pitch, 0.78 * Math.sqrt(squeal), now, 0.026);
      if (this.tireBus.pan) this.ramp(this.tireBus.pan, clamp(-angle * 0.39, -0.22, 0.22), 0.068, now);
      const rush = smooth(8, 145, speed);
      this.setLayer("road-air", 0.73 + 0.51 * rush, 0.25 * rush, now, 0.075);
    }

    event(name, strength = 1) {
      const cue = cues[name];
      if (!cue || !this.enabled || (!this.active && name !== "finish")) return;
      const buffer = this.buffers.get(name);
      if (!buffer || !this.context) {
        this.pendingCue.set(name, { time: performance.now(), strength });
        return;
      }
      const ctx = this.context;
      const now = ctx.currentTime;
      const last = this.lastCue.get(name);
      if (last !== undefined && now - last < cue.interval) return;
      this.lastCue.set(name, now);
      if (name === "shift") this.shiftStarted = now;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      if (cue.varies) source.playbackRate.value = 0.96 + Math.random() * 0.08;
      if (name === "overrun") source.playbackRate.value *= 0.84 + this.telemetry.rpm / 16000;
      const gain = ctx.createGain();
      gain.gain.value = cue.volume * unit(strength);
      const bus = name === "finish" ? this.master : name === "overrun" ? this.engineFilter : this.driveBus;
      source.connect(gain).connect(bus);
      source.onended = () => { source.disconnect(); gain.disconnect(); };
      source.start();
    }
  }

  window.TougeAudio = TougeAudio;
})();
