(() => {
  'use strict';

  const linearFields = [
    'x', 'z', 'speed', 'yaw', 'wheel', 'steerAngle', 'wheelAngle', 'rearWheelAngle',
    'brake', 'slip', 'tireScrub', 'rearSlipAngle', 'wheelspin', 'rearLock', 'longitudinalG', 'lateralG'
  ];
  const mix = (a, b, t) => a + (b - a) * t;
  const mixDirection = (a, b, t) =>
    a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

  class RenderPose {
    constructor(drive) {
      this.previous = {};
      this.frame = {};
      this.capture(drive);
    }

    // Capture the last fixed-step boundary, before the simulation advances.
    capture(drive) {
      const p = this.previous;
      for (const key of linearFields) p[key] = drive[key] ?? 0;
      p.heading = drive.heading;
      p.travel = drive.travel;
      p.s = drive.contact.s;
      p.placementId = drive.placementId;
    }

    sample(drive, fraction) {
      const p = this.previous;
      if (p.placementId !== drive.placementId) this.capture(drive);

      const t = Math.max(0, Math.min(1, fraction));
      const frame = this.frame;
      for (const key of linearFields) frame[key] = mix(p[key], drive[key] ?? 0, t);
      frame.heading = mixDirection(p.heading, drive.heading, t);
      frame.travel = mixDirection(p.travel, drive.travel, t);
      frame.kmh = Math.abs(frame.speed) * 3.6;
      frame.handbrake = drive.handbrake;
      frame.gear = drive.gear;
      frame.rollingRadius = drive.rollingRadius;
      frame.placementId = drive.placementId;

      // Body, wheels, tire marks and camera all see the road under this same pose.
      const road = drive.course.sample(mix(p.s, drive.contact.s, t));
      road.offset = (frame.x - road.x) * road.rx + (frame.z - road.z) * road.rz;
      frame.contact = road;
      return frame;
    }
  }
  window.TougeRenderPose = RenderPose;
})();
