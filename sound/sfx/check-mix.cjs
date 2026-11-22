/* Run with Node: node sound/sfx/check-mix.cjs */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '../../dist');
global.window = globalThis;
global.document = { currentScript: null };
require(path.join(dist, 'js/audio.js'));

// Exercise the game's actual control law. The meter uses the real shipped
// PCM, so lowering either the tire recording or its fader fails this check.
const mixer = new TougeAudio();
const parameter = () => ({ value: 0, setTargetAtTime(value) { this.value = value; } });
mixer.context = { currentTime: 1 };
mixer.engineFilter = { frequency: parameter() };
mixer.intakeFilter = { frequency: parameter() };
mixer.outlet = { gain: parameter() };
mixer.motorBody = { gain: parameter() };
mixer.wallDelay = { delayTime: parameter() };
mixer.wallGain = { gain: parameter() };
mixer.wallPan = { pan: parameter() };
mixer.tireBus = { pan: parameter() };
mixer.active = true;
for (const file of fs.readdirSync(path.join(dist, 'assets/sfx'))) {
  const name = path.basename(file, '.wav');
  mixer.loops.set(name, { source: { playbackRate: parameter() }, gain: { gain: parameter() } });
}

const base = { rpm: 4700, speed: 58, gear: 2, throttle: 0.7, engineLoad: 0.7 };
function drive(telemetry) {
  const frame = { ...base, ...telemetry };
  for (let i = 0; i < 32; i++) {
    mixer.context.currentTime += 1 / 60;
    mixer.update(frame);
  }
}

function pcmRms(name) {
  const bytes = fs.readFileSync(path.join(dist, 'assets/sfx', name + '.wav'));
  assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
  const data = bytes.indexOf('data', 12);
  assert(data >= 12);
  const length = bytes.readUInt32LE(data + 4) / 2;
  let energy = 0;
  for (let i = 0; i < length; i++) energy += (bytes.readInt16LE(data + 8 + 2 * i) / 32768) ** 2;
  return Math.sqrt(energy / length);
}

const gain = name => mixer.loops.get(name).gain.gain.value;
const squealRms = pcmRms('tire-squeal');
// A centered mono voice loses 3 dB per channel on the equal-power tire pan.
const squealDb = () => 20 * Math.log10(squealRms * gain('tire-squeal') * Math.SQRT1_2);
drive({ slip: 0.015, tireScrub: 0.032, angle: 0.028 });
assert.equal(gain('tire-squeal'), 0, 'a gripping car must leave the squeal voice silent');
drive({ slip: 0.19, tireScrub: 0.4, angle: 0.17, handbrake: true });
const onset = squealDb();
assert(onset > -29, 'the rear tires must announce handbrake breakaway');
drive({ slip: 0.62, tireScrub: 0.74, angle: -0.42 });
const sustained = squealDb();
assert(sustained > -23 && gain('tire-scrub') > 0.3, 'countersteer must sustain the rubber and squeal layers');
drive({ throttle: 0, engineLoad: 0, slip: 0, tireScrub: 0, angle: 0.021 });
assert.equal(gain('tire-squeal'), 0);
assert(gain('engine-coast') > 0.4 && gain('engine-intake') < 0.01, 'lifting must change the motor timbre');
drive({ rpm: 4420, gear: 3, slip: 0.55 });
assert(Math.abs(mixer.loops.get('engine-drive').source.playbackRate.value - 4420 / 3600) < 1e-7);
assert(squealDb() > -23, 'callers with only body slip must still get tire audio');
drive({ speed: 0, slip: 1, tireScrub: 1, angle: 0.5, handbrake: true });
assert.equal(gain('tire-squeal'), 0, 'stationary tires must stay quiet');

drive({ rpm: 1020, speed: 0, throttle: 0, engineLoad: 0 });
assert(gain('engine-idle') > 0.2 && gain('engine-low') === 0);
drive({ rpm: 2400, speed: 25, throttle: 0.85, engineLoad: 0.85 });
assert(gain('engine-low') > 0.7 && gain('engine-idle') === 0 && gain('engine-drive') === 0,
  'a loaded low-speed pull needs a recording at its own pitch');
const reverseLow = gain('engine-low');
drive({ rpm: 2400, speed: 15, gear: -1, throttle: 0, brake: 0.85, engineLoad: undefined });
assert(Math.abs(gain('engine-low') - reverseLow) < 1e-7, 'reverse uses the reverse pedal as motor load');

drive({ rpm: 6200, throttle: 1, engineLoad: 1, cameraMode: 1 });
const tail = gain('engine-high'), intake = gain('engine-intake');
const outsideCutoff = mixer.intakeFilter.frequency.value;
drive({ rpm: 6200, throttle: 1, engineLoad: 1, cameraMode: 2 });
assert(gain('engine-high') < tail && gain('engine-intake') > 1.4 * intake,
  'the bonnet hears more induction and low chase hears more tailpipe');
assert(mixer.motorBody.gain.value > 2 && mixer.intakeFilter.frequency.value < outsideCutoff,
  'the closer bonnet perspective should carry more low-mid body');
drive({ rpm: 4700, wall: { side: -1, distance: 5, amount: 1 } });
const nearDelay = mixer.wallDelay.delayTime.value, nearGain = mixer.wallGain.gain.value;
assert(mixer.wallPan.pan.value < -0.5 && nearDelay > 0 && nearGain > 0.07);
drive({ rpm: 4700, wall: { side: 1, distance: 12, amount: 1 } });
assert(mixer.wallPan.pan.value > 0.5 && mixer.wallDelay.delayTime.value > nearDelay &&
  mixer.wallGain.gain.value < nearGain, 'a farther wall should return later and quieter');
drive({ rpm: 4700 });
assert.equal(mixer.wallGain.gain.value, 0, 'open roadside clears the stone reflection');
drive({frontSlipAngle:.33,rearSlipAngle:.012,slip:0,tireScrub:.71});
assert(gain('tire-front')>.36 && gain('tire-squeal')===0 && gain('tire-lock')===0,
  'a pushing front axle has its own voice without rear howl');
drive({frontSlipAngle:.014,rearSlipAngle:.33,slip:.53,tireScrub:.72});
assert(gain('tire-squeal')>.6 && gain('tire-front')===0 && gain('tire-lock')===0);
drive({frontSlipAngle:.013,rearSlipAngle:.29,rearLock:1,slip:.64,tireScrub:.83,handbrake:true});
assert(gain('tire-lock')>.45 && gain('tire-front')===0, 'a locked rear contact patch adds dragged rubber');
drive({rpm:6400,boost:0,throttle:1,engineLoad:1});
assert.equal(gain('turbo-spool'),0,'RPM alone cannot make the compressor whistle');
drive({rpm:6400,boost:.94,throttle:1,engineLoad:1});
const chargedPitch=mixer.loops.get('turbo-spool').source.playbackRate.value;
assert(gain('turbo-spool')>.40 && chargedPitch>1.45);
drive({rpm:5600,boost:0,throttle:0,engineLoad:0});
assert(gain('turbo-spool')<.01 && mixer.loops.get('turbo-spool').source.playbackRate.value<chargedPitch*.65);

const prefs=new TougeAudio();
prefs.setSoundVolume(.29);prefs.setMusicVolume(.73);prefs.setEnabled(false);
assert.equal(prefs.soundVolume,.29);assert.equal(prefs.musicVolume,.73);assert.equal(prefs.enabled,false);
prefs.context={currentTime:1};prefs.soundBus={gain:parameter()};prefs.musicBus={gain:parameter()};
prefs.setSoundVolume(1.2);prefs.setMusicVolume(-.4);
assert.equal(prefs.soundBus.gain.value,1);assert.equal(prefs.musicBus.gain.value,0);

// Run the real transmission and charge model. A vent must follow the driver's
// cut, and a later tailpipe ignition comes from the same tick as its game event.
require(path.join(dist,'js/drive.js'));
const flat={
  start:1,finish:10000,half:100,distance:9999,splits:[10000],
  sample(s){return {x:0,y:0,z:-s,s,i:0,fx:0,fz:-1,rx:1,rz:0,heading:0,curvature:0,grade:0,bank:0,offset:0};},
  nearest(x,z){return {...this.sample(-z),offset:x};}
};
const car=new TougeDrive(flat),dt=1/120;
function runFor(person,seconds,throttle) {
  const events=[];
  for(let i=0;i<Math.round(seconds/dt);i++){
    person.step(dt,{throttle});
    assert(person.boost>=0 && person.boost<=1);
    events.push(...person.events.splice(0).map(e=>({...e,at:i*dt})));
  }
  return events;
}
runFor(car,.24,.42);
assert(!runFor(car,.5,0).some(e=>e.type==='blowoff'||e.type==='afterfire'));
const shifts=runFor(car,7.1,1);
assert(shifts.filter(e=>e.type==='shift').length>=2);
assert(shifts.filter(e=>e.type==='blowoff').length>=2 && shifts.filter(e=>e.type==='afterfire').length>=2);
assert(car.boost>.8,'a sustained forward pull builds pressure');
const lifted=runFor(car,1.5,0),vents=lifted.filter(e=>e.type==='blowoff'),pops=lifted.filter(e=>e.type==='afterfire');
assert.equal(vents.length,1);assert.equal(pops.length,1);
assert(vents[0].strength>.6 && pops[0].strength>.5 && pops[0].at>vents[0].at && pops[0].at-vents[0].at<.15);
assert(car.boost<.01,'the bypass must empty the inlet after a lift');
car.recover();assert.equal(car.boost,0);assert.equal(car.afterfireTime,-1);

const flutter=new TougeDrive(flat);
runFor(flutter,7.1,1);
const releases=[];
for(let tick=0;tick<170;tick++){
  flutter.step(dt,{throttle:tick%15<3 ? 0 : 1});
  for(const e of flutter.events.splice(0))if(e.type==='blowoff')releases.push(tick*dt);
}
assert(releases.length>1 && releases.slice(1).every((t,i)=>t-releases[i]>=.22),
  'rapid pedal feathering must let the valve close and rebuild pressure before another vent');
const starts=[],audio=new TougeAudio();
audio.active=true;
audio.context={
  currentTime:2,createBufferSource(){return {playbackRate:{},connect(n){return n;},start(){starts.push(this.buffer);}};},
  createGain(){return {gain:{},connect(n){return n;}};}
};
for(const cue of ['blowoff','afterfire']){
  audio.buffers.set(cue,cue);audio.event(cue,.75);audio.event(cue,.66);
}
assert.deepEqual(starts,['blowoff','blowoff','afterfire','afterfire'],'the mixer must honor each physics event in a catch-up frame');
console.log('Tire squeal per-channel RMS targets: turn-in ' + onset.toFixed(1) +
  ' dBFS, held slide ' + sustained.toFixed(1) + ' dBFS. Engine, turbo transients, tire modes and faders passed.');
