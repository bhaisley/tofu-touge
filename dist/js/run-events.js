(() => {
  'use strict';
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const angle = value => Math.atan2(Math.sin(value), Math.cos(value));

  function rollingStart(drive, station, speed, offset) {
    drive.place(station);
    const road = drive.contact;
    drive.x = road.x + road.rx * offset;
    drive.z = road.z + road.rz * offset;
    road.offset = offset;
    drive.furthest = station;
    drive.speed = speed;
    drive.gear = 2;
    drive.rpm = speed / drive.rollingRadius * 30 / Math.PI * drive.tune.ratios[1] * drive.tune.finalDrive;
  }

  const hairpin = {
    start: 498, brake: 523, entry: 543, exit: 632,
    startRun(drive) {
      rollingStart(drive, this.start, 17, .6);
      return { entrySpeed: null, peakAngle: 0, usedBrake: false };
    },
    update(attempt, drive) {
      if (drive.contact.s >= this.entry && attempt.entrySpeed === null) attempt.entrySpeed = drive.kmh;
      if (drive.contact.s >= this.brake) {
        attempt.peakAngle = Math.max(attempt.peakAngle, Math.abs(drive.angle) * 180 / Math.PI);
        attempt.usedBrake ||= drive.handbrake;
      }
      return drive.furthest >= this.exit || drive.time >= 26 || drive.finished;
    },
    cue(attempt, drive) {
      if (drive.score > 0) return 'Drift banked. Follow the road to the exit board.';
      if (drive.chain > 0 || attempt.peakAngle > 12) return 'Release the handbrake. Tap right to catch it, then straighten.';
      if (drive.contact.s >= this.entry - 4) return 'Turn left. Give the handbrake one short tap.';
      if (drive.contact.s >= this.brake - 5) return 'Brush the brake. Look left toward the turn-in board.';
      return 'Approach the orange brake board at 55–65 km/h.';
    },
    result(attempt, drive) {
      const clean = drive.furthest >= this.exit && drive.score > 0 && drive.integrity === 100;
      let tip;
      if (clean) tip = 'Try a shorter countersteer tap and carry the slide a little farther.';
      else if (drive.integrity < 100 || attempt.entrySpeed > 67) tip = 'Brake earlier at the orange board. Aim for 55–60 km/h at turn-in.';
      else if (drive.score > 0 && drive.furthest < this.exit) tip = 'You banked the slide. Feed in throttle and continue to the exit board.';
      else if (attempt.entrySpeed === null || attempt.entrySpeed < 44) tip = 'Carry a little throttle on approach. Aim for 55–60 km/h at turn-in.';
      else if (!attempt.usedBrake) tip = 'Tap the handbrake just after steering left at the turn-in board.';
      else if (attempt.peakAngle < 8) tip = 'Steer left a moment before the handbrake tap to load the front tires.';
      else tip = 'Release the handbrake sooner and tap right as the rear steps out. Straighten to bank the slide.';
      return {clean, tip};
    }
  };

  // Two damped waves in car coordinates. A sustained corner finds a steady
  // surface angle; a quick reversal excites the wave above that equilibrium.
  class WaterCup {
    constructor() { this.water = 100; this.settle(); }
    settle() {
      this.x = this.y = this.vx = this.vy = this.meanX = this.meanY = 0;
    }
    impact(damage, side) {
      const impulse = Math.min(1.3, damage / 10);
      this.vx += Math.sign(side) * impulse * 7.5;
      this.vy -= impulse * 2.4;
    }
    step(dt, lateralG, forwardG) {
      const ax = -clamp(lateralG, -2, 2), ay = clamp(forwardG, -2, 2);
      const mix = 1 - Math.exp(-dt * 2.2);
      this.meanX += (ax - this.meanX) * mix;
      this.meanY += (ay - this.meanY) * mix;
      this.vx += ((.40 * ax + 1.10 * (ax - this.meanX) - this.x) * 72 - 5.2 * this.vx) * dt;
      this.vy += ((.40 * ay + 1.10 * (ay - this.meanY) - this.y) * 72 - 5.2 * this.vy) * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const freeboard = .61 + (100 - this.water) * .027;
      const overRim = Math.max(0, Math.hypot(this.x, this.y) - freeboard);
      this.water = Math.max(0, this.water - overRim * 15 * dt);
    }
  }

  // Each row is time (centiseconds), x/z/station (decimetres), yaw
  // (milliradians) and a discontinuity bit. Long runs decimate in place.
  const stride = 6;
  class GhostTape {
    constructor() {
      this.rows = []; this.interval = .125; this.next = 0; this.placement = null;
    }
    record(drive, force = false) {
      let cut = this.placement !== null && this.placement !== drive.placementId;
      if (!force && !cut && drive.time < this.next) return;
      const time = Math.round(drive.time * 100), rows = this.rows;
      const prev = rows.length - stride;
      if (prev >= 0 && time - rows[prev] > this.interval * 300) cut = true;
      if (prev >= 0 && time === rows[prev]) {
        cut ||= !!rows[prev + 5];
        rows.length = prev;
      }
      rows.push(time, Math.round(drive.x * 10), Math.round(drive.z * 10),
        Math.round(drive.contact.s * 10), Math.round(angle(drive.heading) * 1000), Number(cut));
      this.placement = drive.placementId;
      this.next = drive.time + this.interval - 1e-6;
      if (rows.length >= 4800 * stride) {
        let dest = stride, crossedCut = false;
        for (let src = stride; src < rows.length; src += stride) {
          crossedCut ||= !!rows[src + 5];
          if ((src / stride) % 2 === 0 || src + stride === rows.length) {
            rows.copyWithin(dest, src, src + stride);
            rows[dest + 5] = Number(crossedCut); dest += stride; crossedCut = false;
          }
        }
        rows.length = dest; this.interval *= 2;
      }
    }
    static valid(rows, time) {
      if (!Number.isFinite(time) || !Array.isArray(rows) || rows.length < 2 * stride || rows.length % stride ||
        rows.length > 4804 * stride || rows[0] !== 0 || Math.abs(rows[rows.length - stride] / 100 - time) > .015) return false;
      for (let i = 0; i < rows.length; i += stride) {
        if (i && rows[i] <= rows[i - stride]) return false;
        for (let j = 0; j < stride; j++) if (!Number.isSafeInteger(rows[i + j]) || Math.abs(rows[i + j]) > 1e8) return false;
        if (Math.abs(rows[i + 4]) > 3142 || (rows[i + 5] !== 0 && rows[i + 5] !== 1)) return false;
      }
      return true;
    }
    static sample(rows, seconds) {
      const time = seconds * 100, last = rows.length / stride - 1;
      if (time < 0 || time > rows[last * stride]) return null;
      let lo = 0, hi = last;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (rows[mid * stride] <= time) lo = mid; else hi = mid - 1;
      }
      const i = lo * stride, j = Math.min(last, lo + 1) * stride;
      if (rows[j + 5] && time > rows[i] && j !== i) return null;
      const t = i === j ? 0 : (time - rows[i]) / (rows[j] - rows[i]);
      const mix = k => (rows[i + k] + (rows[j + k] - rows[i + k]) * t) / 10;
      return {x: mix(1), z: mix(2), s: mix(3), heading: rows[i + 4] / 1000 + angle((rows[j + 4] - rows[i + 4]) / 1000) * t};
    }
  }
  function sectorTime(splits, i) {
    if (!Array.isArray(splits) || !Number.isFinite(splits[i])) return null;
    const previous = i === 0 ? 0 : splits[i - 1];
    return Number.isFinite(previous) && splits[i] > previous ? splits[i] - previous : null;
  }

  // Repeated passes through the same wet, headlight-lit Mikuni switchback
  // use ordinary driving inputs and the active device's normal renderer.
  const benchmark = {
    duration: 6, passes: 4,
    place(drive) { rollingStart(drive, 1934, 18, -.6); },
    input(t) {
      if (t < .18) return {steer: 1};
      if (t < .47) return {steer: 1, throttle: 1, handbrake: true};
      if (t < 2.62) return {steer: (t - .47) % .38 < .07 ? -1 : 0, throttle: 1};
      if (t < 3.6) return {steer: -.2, throttle: .6};
      return {steer: .48, throttle: .35};
    },
    summarize(frames) {
      const sorted = frames.slice().sort((a, b) => a - b);
      const percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)] || 0;
      return {frames: sorted.length, p95: percentile(.95), p99: percentile(.99), worst: percentile(1),
        slow: sorted.filter(ms => ms > 1000 / 30 + .01).length};
    }
  };
  window.TougeEvents = {hairpin, WaterCup, GhostTape, sectorTime, benchmark};
})();
