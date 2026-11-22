// Exercise the display/physics boundary with a constant velocity and a steering seam.
'use strict';
const assert = require('node:assert/strict');
global.window = globalThis;
require('../dist/js/pose.js');

const tick = 1 / 120;
const speed = 27;
const turnRate = 0.45;
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const straight = {
  sample: s => ({ s, x: 0, z: -s, y: -s * 0.08, rx: 1, rz: 0, i: Math.floor(s / 2) })
};
const car = {
  course: straight, wheel: 0, steerAngle: 0, brake: 0, handbrake: false, slip: 0,
  tireScrub: 0, yaw: turnRate, longitudinalG: 0, lateralG: 0, placementId: 1, speed
};
function placeAt(seconds) {
  const s = speed * seconds;
  car.contact = { ...straight.sample(s), offset: -1.6 };
  car.x = -1.6;
  car.z = -s;
  car.heading = wrap(Math.PI - 0.04 + seconds * turnRate);
  car.travel = wrap(car.heading - 0.16);
  car.wheelAngle = s / 0.287;
  car.rearWheelAngle = car.wheelAngle * 1.24;
}
function near(a, b) { assert(Math.abs(a - b) < 1e-7, `${a} should equal ${b}`); }

for (const intervals of [[1/30], [1/60], [1/90], [1/144], [1/144, 1/48, 1/120, 1/24]]) {
  let time = 0, physicsTime = 0, remainder = 0;
  placeAt(0);
  const poses = new TougeRenderPose(car);
  for (let i = 0; i < 240; i++) {
    const dt = intervals[i % intervals.length];
    time += dt;
    remainder += dt;
    while (remainder + 1e-9 >= tick) {
      poses.capture(car);
      physicsTime += tick;
      placeAt(physicsTime);
      remainder -= tick;
    }
    const frame = poses.sample(car, remainder / tick);
    const visibleTime = Math.max(0, time - tick);
    near(frame.contact.s, visibleTime * speed);
    near(frame.z, -visibleTime * speed);
    near(frame.contact.offset, -1.6);
    near(wrap(frame.heading - (Math.PI - .04 + turnRate * visibleTime)), 0);
    near(wrap(frame.heading - frame.travel), .16);
    near(frame.rearWheelAngle, 1.24 * visibleTime * speed / .287);
  }
  // Recovery while a fractional frame is pending must never fly back along the pass.
  car.placementId++;
  placeAt(0);
  const recovered = poses.sample(car, .45);
  near(recovered.z, 0);
  near(recovered.contact.s, 0);
  near(recovered.rearWheelAngle, 0);
}
console.log('Continuous chassis and wheel poses at 30, 60, 90, 144 and irregular Hz; recovery snaps to the road.');
