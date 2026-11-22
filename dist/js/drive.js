(() => {
  'use strict';

  // Single-track planar chassis. Distances are metres, angles are radians,
  // tire forces are newtons. Positive steering and yaw turn the car right.
  const mass = 965;
  const inertia = 1240;
  const wheelbase = 2.40;
  const frontArm = 1.12;
  const rearArm = wheelbase - frontArm;
  const cgHeight = 0.47;
  const tireRadius = 0.287;
  const gravity = 9.81;
  const ratios = [3.59, 2.02, 1.38, 1.00, 0.86];
  const finalDrive = 4.30;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const follow = (value, target, rate, dt) => lerp(value, target, 1 - Math.exp(-rate * dt));
  const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));

  function smooth(low, high, value) {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function engineTorque(rpm) {
    // Broad midrange, a second intake peak, then a soft ignition cut.
    return (101 + 45 * smooth(1050, 4200, rpm) + 10 * smooth(4300, 6200, rpm) -
      17 * smooth(6300, 7400, rpm)) * (1 - 0.84 * smooth(7550, 7930, rpm));
  }

  function tireForce(angle, corneringStiffness, peakForce, longitudinalForce, falloff) {
    const fraction = clamp(longitudinalForce / peakForce, -1, 1);
    const lateralBudget = peakForce * Math.sqrt(1 - fraction * fraction);
    const slide = smooth(0.13, 0.56, Math.abs(angle));
    return -Math.tanh(corneringStiffness * angle) * lateralBudget * (1 - falloff * slide);
  }

  function gripLock(speed) {
    // Full keyboard lock stays useful at speed without asking the front
    // tires for a parking manoeuvre at 100 km/h.
    return clamp(0.055 + Math.atan(63 / (speed * speed + 18)), 0.08, 0.57);
  }

  class Drive {
    constructor(course) {
      this.course = course;
      this.placementId = 0;
      this.reset();
    }

    reset() {
      this.time = 0;
      this.score = 0;
      this.integrity = 100;
      this.chain = 0;
      this.chainTime = 0;
      this.grace = 0;
      this.sector = 0;
      this.splitTimes = [];
      this.furthest = this.course.start;
      this.cooldown = 0;
      this.events = [];
      this.finished = false;
      this.place(this.course.start);
    }

    place(s) {
      const p = this.course.sample(s);
      this.placementId++;
      this.x = p.x - p.rx * 1.8;
      this.z = p.z - p.rz * 1.8;
      this.heading = p.heading;
      // travel is the direction of the front of the car's velocity frame.
      // In reverse the signed speed changes, so chase view keeps facing forward.
      this.travel = p.heading;
      this.speed = 0;
      this.yaw = 0;
      this.angle = 0;
      this.wheel = 0;
      this.steerAngle = 0;
      this.wheelAngle = 0;
      this.rearWheelAngle = 0;
      this.loose = 0;
      this.slideSign = 0;
      this.entryTime = 0;
      this.slip = 0;
      this.tireScrub = 0;
      this.engineLoad = 0;
      this.wheelspin = 0;
      this.rearDriveFraction = 0;
      this.frontSlipAngle = 0;
      this.rearSlipAngle = 0;
      this.longitudinalG = 0;
      this.lateralG = 0;
      this.contact = p;
      this.contact.offset = -1.8;
      this.throttle = 0;
      this.brake = 0;
      this.handbrake = false;
      this.rearLock = 0;
      this.rpm = 1050;
      this.gear = 1;
      this.shiftTime = 0;
      this.reverseHold = 0;
    }

    recover() {
      if (this.finished) return;
      this.place(Math.max(this.course.start, this.furthest - 2));
      this.time += 3;
      this.chain = this.chainTime = this.grace = 0;
      this.cooldown = 1.5;
      this.events.push({ type: 'recover' });
    }

    get kmh() { return Math.abs(this.speed) * 3.6; }
    get multiplier() { return Math.min(5, 1 + Math.floor(this.chainTime / 1.25) * 0.5); }
    get progress() { return clamp((this.furthest - this.course.start) / this.course.distance, 0, 1); }

    bankDrift() {
      if (this.chain >= 1) {
        const points = Math.round(this.chain);
        this.score += points;
        this.events.push({ type: 'bank', points });
      }
      this.chain = this.chainTime = this.grace = 0;
    }

    updateTransmission(dt, u) {
      this.shiftTime = Math.max(0, this.shiftTime - dt);
      if (this.speed < 0.38 && this.brake > 0.12 && this.throttle < 0.05) {
        this.reverseHold += dt;
        if (this.reverseHold >= 0.24) this.gear = -1;
      } else {
        this.reverseHold = 0;
      }
      if (this.gear < 0 && this.throttle > 0.06 && u > -0.4) this.gear = 1;

      if (this.gear > 0 && this.shiftTime === 0) {
        const wheelRpm = Math.abs(u) * (60 / (2 * Math.PI * tireRadius));
        const coupled = wheelRpm * ratios[this.gear - 1] * finalDrive;
        const upAt = 6500 + this.throttle * 900;
        // A sliding rear tire can flare the motor without triggering an
        // unwanted upshift halfway through a hairpin.
        if (coupled > upAt && this.gear < ratios.length) {
          this.gear++;
        } else if (this.gear > 1 && coupled < 2450 + this.throttle * 900 &&
                   wheelRpm * ratios[this.gear - 2] * finalDrive < 7050) {
          this.gear--;
        } else {
          return;
        }
        this.shiftTime = 0.18;
        this.events.push({ type: 'shift' });
      }
    }

    updateSlide(dt, steer, speed) {
      const canSlide = this.speed > 5.3 && this.cooldown < 0.24;
      const steeringIntent = Math.abs(steer) > 0.14 ? steer : this.wheel;
      if (canSlide && this.handbrake && Math.abs(steeringIntent) > 0.11) {
        // Latch the corner direction when the rear tires first break away.
        // Countersteering while the lever is held must not reverse the slide.
        if (this.loose < 0.18 || !this.slideSign) this.slideSign = Math.sign(steeringIntent);
        this.entryTime = 0.46;
      } else {
        this.entryTime = Math.max(0, this.entryTime - dt);
      }
      const poweredExit = this.throttle > 0.74 && this.rearDriveFraction > 0.54 &&
        Math.abs(this.angle) > 0.15 && Math.abs(this.rearSlipAngle) > 0.18 &&
        this.wheel * Math.sign(this.angle) > 0.22;
      if (canSlide && !this.slideSign && poweredExit) {
        this.slideSign = Math.sign(this.angle);
        this.entryTime = 0.18;
      }

      const intoCorner = this.wheel * this.slideSign;
      const balance = Math.abs(this.wheel) > 0.075 && intoCorner > -0.86;
      const sustained = this.slideSign && this.loose > 0.16 && this.throttle > 0.23 &&
        this.angle * this.slideSign > 0.085 && balance && this.brake < 0.55;
      const target = canSlide && (this.entryTime > 0 || sustained) ? 1 : 0;
      this.loose = follow(this.loose, target, target ? 6.9 : 3.4, dt);
      if (!target && this.loose < 0.025) {
        this.loose = 0;
        this.slideSign = 0;
      }

      const lock = lerp(gripLock(speed), 0.57, this.loose);
      const selfAlign = this.loose * clamp(this.angle * 0.27, -0.15, 0.15);
      this.steerAngle = clamp(this.wheel * lock - selfAlign, -0.60, 0.60);
    }

    simulateChassis(dt) {
      const p = this.contact;
      const h = this.heading;
      const speed = Math.abs(this.speed);
      const delta = wrap(this.travel - h);
      const u = this.speed * Math.cos(delta);
      const v = this.speed * Math.sin(delta);
      const wheelSin = Math.sin(this.steerAngle);
      const wheelCos = Math.cos(this.steerAngle);
      const frontV = v + this.yaw * frontArm;
      const rearV = v - this.yaw * rearArm;
      const frontForward = u * wheelCos + frontV * wheelSin;
      const frontLateral = frontV * wheelCos - u * wheelSin;

      // The low-speed denominator is a tire relaxation speed. It keeps the
      // contact patch well conditioned when changing direction from rest.
      this.frontSlipAngle = Math.atan2(frontLateral, Math.max(2.8, Math.abs(frontForward)));
      this.rearSlipAngle = Math.atan2(rearV, Math.max(2.8, Math.abs(u)));

      const bodyRoad = wrap(h - p.heading);
      const cross = Math.sin(bodyRoad);
      const along = Math.cos(bodyRoad);
      const frontEdge = smooth(this.course.half - 0.35, this.course.half + 0.9,
        Math.abs(p.offset + frontArm * cross));
      const rearEdge = smooth(this.course.half - 0.35, this.course.half + 0.9,
        Math.abs(p.offset - rearArm * cross));
      const frontLoad = clamp(rearArm / wheelbase - this.longitudinalG * cgHeight / wheelbase, 0.33, 0.72);
      const frontCapacity = mass * gravity * frontLoad * (1.09 - 0.33 * frontEdge);
      const rearCapacity = mass * gravity * (1 - frontLoad) * (1.12 - 0.35 * rearEdge);

      const reverse = this.gear < 0;
      const ratio = (reverse ? 3.38 : ratios[this.gear - 1]) * finalDrive;
      const pedal = reverse ? this.brake : this.throttle;
      const footbrake = reverse ? this.throttle : this.brake;
      const load = pedal * (this.shiftTime > 0 ? 0.20 : 1);
      this.engineLoad = follow(this.engineLoad, load, load > this.engineLoad ? 13 : 23, dt);

      let motive = this.engineLoad * engineTorque(this.rpm) * ratio * 0.89 / tireRadius;
      if (reverse) motive = -Math.min(motive, mass * 3.2) * (1 - smooth(5.1, 6.6, -u));
      if (!reverse && speed > 4) {
        const overrun = (1 - this.throttle) * (0.19 + this.rpm / 7100 * 0.67);
        motive -= mass * overrun * (1 - this.loose * 0.4);
      }
      // Disengage the clutch while the hydraulic handbrake locks the rear.
      motive *= 1 - 0.84 * this.rearLock;
      this.rearDriveFraction = Math.max(0, motive) / rearCapacity;
      const rollingSign = Math.sign(u);
      const brakeDemand = mass * gravity * 1.08 * footbrake;
      const frontFx = clamp(-rollingSign * brakeDemand * 0.65, -frontCapacity * 0.94, frontCapacity * 0.94);
      const rearDemand = motive - rollingSign *
        (brakeDemand * 0.35 + rearCapacity * 1.12 * this.rearLock);
      const rearFx = clamp(rearDemand, -rearCapacity * 0.97, rearCapacity * 0.97);

      const frontFy = tireForce(this.frontSlipAngle, 11.7, frontCapacity, frontFx, 0.055);
      const rearGrip = (1 - this.loose * (0.19 + 0.20 * this.engineLoad)) * (1 - 0.60 * this.rearLock);
      const rearFy = tireForce(this.rearSlipAngle, 13.5, rearCapacity, rearFx, 0.105) * rearGrip;
      const frontBodyY = frontFx * wheelSin + frontFy * wheelCos;
      let ax = (frontFx * wheelCos - frontFy * wheelSin + rearFx) / mass;
      let ay = (frontBodyY + rearFy) / mass;
      const skinDrag = speed > 0.01 ? 0.115 + 0.00048 * speed * speed + (frontEdge + rearEdge) * 0.78 : 0;
      ax -= skinDrag * u / Math.max(0.2, speed);
      ay -= skinDrag * v / Math.max(0.2, speed);

      // A modest force perpendicular to travel lets a keyboard driver trace
      // the arc while countersteering. It does no work along the velocity.
      const directionF = u / Math.max(speed, 0.5);
      const directionR = v / Math.max(speed, 0.5);
      let pathAcceleration = ay * directionF - ax * directionR;
      if (this.loose > 0) {
        const intoCorner = this.wheel * this.slideSign;
        const target = this.slideSign * (7.6 + 3.7 * intoCorner);
        const assist = this.loose * clamp((target - pathAcceleration) * 0.70, -3.5, 3.5);
        ax -= directionR * assist;
        ay += directionF * assist;
        pathAcceleration += assist;
      }

      const terrainForward = -gravity * p.grade;
      const terrainAcross = gravity * (p.bank + 0.009 * p.offset);
      this.longitudinalG = follow(this.longitudinalG, ax / gravity, 8.8, dt);
      this.lateralG = follow(this.lateralG, ay / gravity, 11, dt);
      ax += terrainForward * along + terrainAcross * cross;
      ay += -terrainForward * cross + terrainAcross * along;

      const naturalYaw = (frontArm * frontBodyY - rearArm * rearFy) / inertia;
      // A light yaw-rate damper makes a released key settle on the same line.
      const rateLimit = Math.min(1.47, 11.8 / Math.max(speed, 3));
      const gripYaw = clamp(u * Math.tan(this.steerAngle) / wheelbase, -rateLimit, rateLimit);
      const gripCorrection = clamp((gripYaw - this.yaw) * 3.1, -2.3, 2.3);
      const pathRate = pathAcceleration / Math.max(speed, 3);
      // On a wet road a sustained steer/brake input can ask for more yaw
      // than the velocity vector can follow. Catch the growing sideslip
      // with a limited stability moment before the tail passes the nose.
      const stability = smooth(0.065, 0.245, Math.abs(this.angle)) * smooth(4.5, 12, speed);
      const gripAngle = this.wheel * (0.085 + 0.042 * this.engineLoad);
      const stableYaw = pathRate + clamp((gripAngle - this.angle) * 3.6, -1.2, 1.2);
      const stabilityMoment = clamp((stableYaw - this.yaw) * 8, -6.2, 6.2);
      let yawAcceleration = lerp(naturalYaw + gripCorrection, stabilityMoment, 0.95 * stability);
      if (this.loose > 0) {
        const intoCorner = this.slideSign * this.wheel;
        const targetAngle = this.slideSign * clamp(0.18 + this.throttle * 0.26 + 0.37 * intoCorner, -0.07, 0.72);
        const angleError = wrap(targetAngle - this.angle);
        const targetYaw = pathAcceleration / Math.max(5, speed) + clamp(angleError * 3.9, -1.75, 1.75);
        const slideYaw = naturalYaw * 0.18 + clamp((targetYaw - this.yaw) * 7.9, -7.2, 7.2);
        yawAcceleration = lerp(yawAcceleration, slideYaw, this.loose);
      }
      this.yaw = clamp(this.yaw + yawAcceleration * dt, -2.55, 2.55);

      let forward = u + ax * dt;
      let side = v + ay * dt;
      const stopped = speed < 0.28 && (this.handbrake || pedal < 0.035);
      if (stopped || (rollingSign && Math.sign(forward) !== rollingSign && footbrake > 0.15 && Math.abs(side) < 0.18)) {
        forward = 0;
        side = 0;
        this.yaw = follow(this.yaw, 0, 24, dt);
      } else if (speed < 4.5) {
        // Blend tire dynamics into rolling-wheel geometry at parking speeds.
        const slow = 1 - smooth(1.8, 4.5, speed);
        this.yaw = follow(this.yaw, forward * Math.tan(this.steerAngle) / wheelbase, 13 * slow, dt);
        side = follow(side, this.yaw * rearArm, 10 * slow, dt);
      }
      this.heading = wrap(h + this.yaw * dt);
      const sign = this.motionSign(forward);
      this.speed = Math.hypot(forward, side) * sign;
      this.travel = Math.abs(this.speed) > 0.055 ? wrap(h + Math.atan2(side * sign, forward * sign)) : this.heading;
      this.angle = wrap(this.heading - this.travel);
      this.x += Math.sin(this.travel) * this.speed * dt;
      this.z -= Math.cos(this.travel) * this.speed * dt;

      const spinDemand = this.handbrake ? 0 :
        clamp((Math.abs(rearDemand) / rearCapacity - 0.89) * 0.65 + this.loose * this.engineLoad * 0.52, 0, 1);
      this.wheelspin = follow(this.wheelspin, spinDemand, spinDemand > this.wheelspin ? 8 : 12, dt);
      const rollingRear = lerp(1 + this.wheelspin * 0.42, 0.035, this.rearLock);
      this.wheelAngle += frontForward * dt / tireRadius;
      this.rearWheelAngle += u * rollingRear * dt / tireRadius;
      const wheelRpm = Math.abs(u / tireRadius) * 60 / (2 * Math.PI);
      let rpmTarget = Math.max(1020 + pedal * 1580, wheelRpm * ratio * (1 + this.wheelspin * 0.32));
      rpmTarget = lerp(rpmTarget, 1110 + pedal * 5350, 0.6 * this.rearLock);
      this.rpm = follow(this.rpm, clamp(rpmTarget, 970, 7920), 12, dt);

      const moving = smooth(2.8, 8, speed);
      const tail = smooth(0.068, 0.59, Math.abs(this.angle));
      const rearScrub = smooth(0.075, 0.50, Math.abs(this.rearSlipAngle));
      const frontScrub = smooth(0.105, 0.39, Math.abs(this.frontSlipAngle));
      const lockScrub = 0.78 * this.rearLock;
      const scrubTarget = moving * Math.max(tail, rearScrub * 0.95, frontScrub * 0.69, lockScrub);
      this.tireScrub = follow(this.tireScrub, scrubTarget, scrubTarget > this.tireScrub ? 30 : 11, dt);
      this.slip = follow(this.slip, moving * Math.max(tail, rearScrub * 0.88), 16, dt);
    }

    motionSign(forward) {
      // At speed a sideways slide or a bounce can rotate past 90 degrees.
      // Keep the velocity frame continuous until the car actually reverses.
      return Math.abs(this.speed) > 1.2 ? Math.sign(this.speed) : (forward < 0 ? -1 : 1);
    }

    resolveRoad() {
      const p = this.course.nearest(this.x, this.z, this.contact.i);
      const relative = wrap(this.heading - p.heading);
      const sin = Math.sin(relative);
      const cos = Math.cos(relative);
      const reach = 0.82 * Math.abs(cos) + 1.98 * Math.abs(sin);
      const limit = this.course.half + 1.54 - reach;
      const depth = Math.abs(p.offset) - limit;
      if (depth > 0) {
        const side = Math.sign(p.offset);
        this.x -= p.rx * side * depth;
        this.z -= p.rz * side * depth;
        p.offset = side * limit;

        const vx = Math.sin(this.travel) * this.speed;
        const vz = -Math.cos(this.travel) * this.speed;
        const normalSpeed = (vx * p.rx + vz * p.rz) * side;
        // A glancing impact applies an impulse at the contacting corner.
        // Near parallel both tires share the wall, shortening the lever arm.
        const normalForward = sin * side, normalRight = cos * side;
        const lever = 1.98 * clamp(normalForward * 5.5, -1, 1) * normalRight -
          0.82 * Math.sign(normalRight) * normalForward;
        const closing = normalSpeed + this.yaw * lever;
        if (closing > 0.02) {
          const impulse = closing * (closing > 2.6 ? 1.13 : 1.01) / (1 + mass * lever * lever / inertia);
          const along = vx * p.fx + vz * p.fz;
          const tangent = along - Math.sign(along) * Math.min(Math.abs(along), impulse * 0.20);
          const normal = (normalSpeed - impulse) * side;
          const newX = tangent * p.fx + normal * p.rx;
          const newZ = tangent * p.fz + normal * p.rz;
          const sign = this.motionSign(newX * Math.sin(this.heading) - newZ * Math.cos(this.heading));
          this.speed = sign * Math.hypot(newX, newZ);
          if (Math.abs(this.speed) > 0.05) this.travel = Math.atan2(newX * sign, -newZ * sign);
          this.angle = wrap(this.heading - this.travel);
          this.yaw = clamp(this.yaw - impulse * mass * lever / inertia, -1.75, 1.75);
          if (closing > 2.65 && this.cooldown === 0) {
            const damage = clamp(Math.round(closing * 0.78), 2, 16);
            this.integrity = Math.max(0, this.integrity - damage);
            this.cooldown = 1;
            this.entryTime = 0;
            this.loose *= 0.4;
            this.chain = this.chainTime = this.grace = 0;
            this.events.push({ type: 'impact', damage });
          }
        }
      }

      if (p.s < 1 && (this.x - p.x) * p.fx + (this.z - p.z) * p.fz < 0) {
        this.place(this.course.start);
      } else {
        this.contact = p;
      }
      this.furthest = Math.max(this.furthest, this.contact.s);
    }

    updateRun(dt) {
      if (this.integrity === 0) {
        this.finished = true;
        this.events.push({ type: 'failed' });
        return;
      }
      const forwardProgress = Math.cos(wrap(this.travel - this.contact.heading)) * Math.sign(this.speed);
      if (Math.abs(this.angle) > 0.115 && Math.abs(this.angle) < 1.25 && this.slip > 0.14 && this.speed > 7 &&
          this.cooldown === 0 && forwardProgress > 0.3) {
        this.chainTime += dt;
        this.chain += dt * this.speed * (1.2 + this.slip * 7) * this.multiplier;
        this.grace = 0.88;
      } else if (this.chain > 0) {
        this.grace -= dt;
        if (this.grace <= 0) this.bankDrift();
      }
      if (this.furthest >= this.course.splits[this.sector]) {
        this.sector++;
        this.splitTimes.push(this.time);
        if (this.sector === this.course.splits.length) {
          this.bankDrift();
          this.finished = true;
          this.events.push({ type: 'finish' });
        } else {
          this.events.push({ type: 'checkpoint', sector: this.sector });
        }
      }
    }

    step(dt, input) {
      if (this.finished || dt <= 0) return;
      this.time += dt;
      this.cooldown = Math.max(0, this.cooldown - dt);
      this.throttle = clamp(input.throttle || 0, 0, 1);
      this.brake = clamp(input.brake || 0, 0, 1);
      this.handbrake = !!input.handbrake;
      this.rearLock = follow(this.rearLock, this.handbrake ? 1 : 0, this.handbrake ? 26 : 12, dt);
      const steer = clamp(input.steer || 0, -1, 1);
      const crossing = steer * this.wheel < 0;
      this.wheel = follow(this.wheel, steer, crossing || !steer ? 10.8 : 7.2, dt);
      const u = this.speed * Math.cos(this.angle);
      this.updateTransmission(dt, u);
      this.updateSlide(dt, steer, Math.abs(this.speed));
      this.simulateChassis(dt);
      this.resolveRoad();
      this.updateRun(dt);
    }
  }

  Drive.rollingRadius = tireRadius;
  window.TougeDrive = Drive;
})();
