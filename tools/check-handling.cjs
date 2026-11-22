/* Run with Node: node tools/check-handling.cjs */
'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const dist = path.join(__dirname, '..', 'dist');
global.window = globalThis;
global.THREE = require(path.join(dist, 'vendor/three.min.js'));
require(path.join(dist, 'js/course.js'));
require(path.join(dist, 'js/drive.js'));

const dt = 1 / 120;
const degrees = 180 / Math.PI;
const clamp = (x, low, high) => Math.max(low, Math.min(high, x));
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const rounded = (value, digits = 2) => Number(value.toFixed(digits));

// Unbanked open tarmac isolates the chassis for repeatable acceleration,
// braking and skidpad measurements. The delivery tests use the actual pass.
class Skidpad {
  constructor() {
    this.start = 1;
    this.finish = 1e6;
    this.distance = this.finish - this.start;
    this.half = 100;
    this.splits = [3e5, 6e5, this.finish];
  }
  sample(s) {
    return { x: 0, y: 0, z: -s, s, i: 0, fx: 0, fz: -1, rx: 1, rz: 0,
      heading: 0, curvature: 0, grade: 0, bank: 0, offset: 0 };
  }
  nearest(_x, z) { return this.sample(Math.max(this.start, -z)); }
}

function simulate(drive, input, seconds) {
  for (let i = 0; i < Math.round(seconds / dt); i++) drive.step(dt, input);
}

function straightBench() {
  const drive = new TougeDrive(new Skidpad());
  while (drive.kmh < 100 && drive.time < 16) drive.step(dt, { throttle: 1 });
  assert(drive.kmh >= 100 && drive.gear >= 3, 'the automatic gearbox must deliver a clean launch');
  const hundred = drive.time;
  const brakePoint = drive.z;
  let brakeG = 0;
  while (drive.kmh > 0.5 && drive.time < hundred + 9) {
    drive.step(dt, { brake: 1 });
    brakeG = Math.max(brakeG, -drive.longitudinalG);
  }
  const stoppingDistance = brakePoint - drive.z;
  assert(drive.kmh < 0.5 && stoppingDistance > 28 && stoppingDistance < 48);
  assert(brakeG > 0.75, 'braking must transfer axle load');
  simulate(drive, { brake: 1 }, 2);
  assert(drive.gear === -1 && drive.speed < -2);
  simulate(drive, { throttle: 1 }, 4);
  assert(drive.gear > 0 && drive.speed > 4, 'the accelerator must brake through reverse into first');
  return { zeroTo100Seconds: rounded(hundred), stopFrom100Metres: rounded(stoppingDistance),
    peakBrakingG: rounded(brakeG) };
}

function stabilityBench() {
  const drive = new TougeDrive(new Skidpad());
  drive.speed = 26;
  drive.gear = 3;
  let maxSlip = 0;
  while (drive.kmh > 27 && drive.time < 5) {
    drive.step(dt, { steer: 1, brake: 0.35 });
    maxSlip = Math.max(maxSlip, Math.abs(drive.angle) * degrees);
  }
  assert(maxSlip < 22 && drive.time < 5, 'trail braking must stay catchable on a digital steering key');
  return { initialKmh: 93.6, peakBodySlipDegrees: rounded(maxSlip) };
}

function throttleSteerBench() {
  function corner(pedal) {
    const drive = new TougeDrive(new Skidpad());
    drive.speed = 16;
    drive.gear = 2;
    simulate(drive, { steer: 0.75, throttle: 0.2 }, 0.4);
    let peak = 0;
    for (let i = 0; i < 2.5 / dt; i++) {
      drive.step(dt, { steer: 0.9, throttle: pedal });
      peak = Math.max(peak, Math.abs(drive.angle) * degrees);
    }
    return rounded(peak);
  }
  const balanced = corner(0.35);
  const powered = corner(1);
  assert(balanced < 18 && powered > balanced + 18 && powered < 50,
    'second-gear throttle must be able to break rear grip without using the handbrake');
  return { lightThrottleDegrees: balanced, fullThrottleDegrees: powered };
}

// Simple preview driver. Its only control path is the same four pedal and
// steering channels that the game supplies to the physics at each tick.
function followLine(drive, cruise = 29, lateralAcceleration = 6) {
  const { course, contact } = drive;
  const speed = Math.abs(drive.speed);
  const ahead = course.sample(contact.s + Math.max(8, 5 + speed * 0.55));
  const dx = ahead.x - 0.7 * ahead.rx - drive.x;
  const dz = ahead.z - 0.7 * ahead.rz - drive.z;
  const bearing = wrap(Math.atan2(dx, -dz) - drive.travel);
  const curvature = 2 * Math.sin(bearing) / Math.max(4, Math.hypot(dx, dz));
  const lock = Math.min(0.57, 0.055 + Math.atan(63 / (speed * speed + 18)));
  const requestedAngle = Math.atan(2.4 * curvature) + 0.0034 * speed * speed * curvature;
  const steer = clamp(requestedAngle / lock - 0.13 * (drive.yaw - speed * curvature), -1, 1);
  let bend = 0;
  for (let distance = 0; distance <= 55; distance += 5) {
    const p = course.sample(contact.s + distance);
    bend = Math.max(bend, Math.abs(p.curvature) / (1 + distance * 0.015));
  }
  const target = Math.min(cruise, Math.sqrt(lateralAcceleration / Math.max(0.004, bend)));
  return { steer, throttle: speed < target ? 0.75 : 0.05, brake: speed > target + 1.3 ? 0.5 : 0 };
}

function setupHairpin(drive) {
  const p = drive.course.sample(543);
  drive.place(p.s);
  drive.x = p.x + p.rx * 0.6;
  drive.z = p.z + p.rz * 0.6;
  drive.contact.offset = 0.6;
  drive.speed = 17;
  drive.gear = 2;
  drive.rpm = drive.speed / 0.287 * 60 / (2 * Math.PI) * 2.02 * 4.3;
}

function hairpinInput(drive, time, keyboard) {
  if (time < 0.18) return { steer: keyboard ? -1 : -0.65, throttle: keyboard ? 0 : 0.45 };
  const release = keyboard ? 0.47 : 0.51;
  if (time < release) return { steer: -1, throttle: keyboard ? 1 : 0.7, handbrake: true };
  if (time < release + (keyboard ? 2.6 : 2.7)) {
    if (keyboard) {
      // Short opposite-lock taps approximate how a keyboard driver catches
      // the rear while continuing to accelerate through this left hairpin.
      return { steer: (time - release) % 0.38 < 0.38 * 0.18 ? 1 : 0, throttle: 1 };
    }
    return { steer: 0.19, throttle: 0.8 };
  }
  return followLine(drive);
}

function hairpinBench(course, keyboard) {
  const drive = new TougeDrive(course);
  setupHairpin(drive);
  let maxAngle = 0, slidingTime = 0, scrubTime = 0, maxOffset = 0, railContacts = 0;
  let counterTime = 0, lockedRear = false, banked = false, driftExit = false;
  for (let i = 0; i < 12 / dt && drive.contact.s < 643; i++) {
    const time = i * dt;
    const input = hairpinInput(drive, time, keyboard);
    const front = drive.wheelAngle, rear = drive.rearWheelAngle;
    drive.step(dt, input);
    assert(Math.abs(drive.wheelAngle - front) < 2 && Math.abs(drive.rearWheelAngle - rear) < 2,
      'visible wheel rotations must remain continuous through a full revolution');
    if (input.handbrake && Math.abs(drive.rearWheelAngle - rear) < Math.abs(drive.wheelAngle - front) * 0.16) lockedRear = true;
    if (time < 3.21) {
      const angle = Math.abs(drive.angle) * degrees;
      maxAngle = Math.max(maxAngle, angle);
      maxOffset = Math.max(maxOffset, Math.abs(drive.contact.offset));
      if (angle > 12) {
        slidingTime += dt;
        if (drive.tireScrub > 0.42) scrubTime += dt;
      }
      if (drive.angle < -0.18 && input.steer > 0) counterTime += dt;
    } else if (Math.abs(drive.angle) < 0.10) {
      driftExit = true;
    }
    const relative = wrap(drive.heading - drive.contact.heading);
    const reach = 0.82 * Math.abs(Math.cos(relative)) + 1.98 * Math.abs(Math.sin(relative));
    const railClearance = course.half + 1.54 - reach - Math.abs(drive.contact.offset);
    if (railClearance < 0.005) railContacts++;
    for (const event of drive.events) if (event.type === 'bank') banked = true;
    drive.events.length = 0;
  }
  assert(drive.contact.s >= 643 && drive.integrity === 100 && railContacts === 0);
  assert(maxAngle > 23 && maxAngle < 44 && slidingTime > 2 && scrubTime > 2);
  assert(counterTime > (keyboard ? 0.35 : 2.4), 'countersteering should sustain the slide');
  assert(lockedRear && driftExit && banked && drive.score >= 100);
  return { peakBodySlipDegrees: rounded(maxAngle), secondsAbove12Degrees: rounded(slidingTime),
    strongScrubSeconds: rounded(scrubTime), countersteerSeconds: rounded(counterTime),
    peakOffsetMetres: rounded(maxOffset), score: drive.score, integrity: drive.integrity, railContacts };
}

function fullRoute(course) {
  const drive = new TougeDrive(course);
  let shifts = 0, maxSpeed = 0;
  for (let i = 0; i < 260 / dt && !drive.finished; i++) {
    drive.step(dt, followLine(drive, 27, 5.15));
    for (const event of drive.events) if (event.type === 'shift') shifts++;
    drive.events.length = 0;
    maxSpeed = Math.max(maxSpeed, drive.kmh);
    assert(Number.isFinite(drive.x + drive.z + drive.heading + drive.rpm));
    assert(drive.slip >= 0 && drive.slip <= 1 && drive.tireScrub >= 0 && drive.tireScrub <= 1);
  }
  assert(drive.finished && drive.progress === 1 && drive.integrity === 100);
  assert(drive.splitTimes.length === 3 && shifts > 4 && maxSpeed > 90);
  return { seconds: rounded(drive.time), kilometres: rounded(course.distance / 1000),
    peakKmh: rounded(maxSpeed), shifts, splits: drive.splitTimes.map(t => rounded(t)), integrity: drive.integrity };
}

function barrierBench(course) {
  const drive = new TougeDrive(course);
  const p = course.sample(103);
  drive.place(p.s);
  drive.x = p.x + p.rx * 4.25;
  drive.z = p.z + p.rz * 4.25;
  drive.contact.offset = 4.25;
  drive.speed = 19;
  drive.heading = drive.travel = p.heading + 0.8;
  drive.gear = 2;
  let hits = 0, maxFrameHeadingChange = 0;
  for (let i = 0; i < 0.7 / dt; i++) {
    const before = drive.heading;
    drive.step(dt, {});
    maxFrameHeadingChange = Math.max(maxFrameHeadingChange, Math.abs(wrap(drive.heading - before)) * degrees);
    for (const event of drive.events) if (event.type === 'impact') hits++;
    drive.events.length = 0;
  }
  assert(hits === 1 && drive.integrity < 100 && maxFrameHeadingChange < 2,
    'impact must resolve through velocity and angular impulse without snapping the visible heading');
  const id = drive.placementId, impactTime = drive.time, damage = 100 - drive.integrity;
  drive.recover();
  assert(drive.placementId === id + 1 && drive.time === impactTime + 3 && drive.speed === 0);
  assert(drive.slip === 0 && drive.tireScrub === 0 && drive.chain === 0);
  drive.reset();
  assert(drive.placementId === id + 2 && drive.integrity === 100 && drive.score === 0);
  return { hits, damage, maxDegreesPerPhysicsStep: rounded(maxFrameHeadingChange) };
}

if (require.main === module) {
  const course = new TougeCourse();
  console.log(JSON.stringify({
    wetStraight: straightBench(),
    fullLockTrailBrake: stabilityBench(),
    secondGearThrottleSteer: throttleSteerBench(),
    analogHairpin: hairpinBench(course, false),
    keyboardHairpin: hairpinBench(course, true),
    route: fullRoute(course),
    barrier: barrierBench(course),
  }, null, 2));
}
