// Exercise the activities with the shipping course, chassis and record format.
'use strict';
const assert=require('node:assert/strict');
const {followLine,hairpinInput}=require('./check-handling.cjs');
require('../dist/js/run-events.js');
const {hairpin,WaterCup,GhostTape,sectorTime,benchmark}=TougeEvents;
const dt=1/120;

function lessonInput(drive,turnTime){
  if(turnTime!==null)return hairpinInput(drive,drive.time-turnTime,true,-1,2);
  const line=followLine(drive,16.8,8);
  return {steer:line.steer,throttle:drive.speed<16.7?.4:.08,brake:drive.speed>17.1?.16:0};
}
function tryLesson(slide){
  const drive=new TougeDrive(new TougeCourse(),'ae86'),attempt=hairpin.startRun(drive);
  let turned=null;
  assert.equal(Math.round(drive.kmh),61);
  for(let i=0;i<27/dt;i++){
    if(turned===null && drive.contact.s>=hairpin.entry)turned=drive.time;
    drive.step(dt,slide?lessonInput(drive,turned):followLine(drive,16,4.5));
    if(hairpin.update(attempt,drive))break;
  }
  const result=hairpin.result(attempt,drive);
  assert.equal(result.clean,slide);
  assert(result.tip.length>12);
  if(slide){assert(drive.score>100 && drive.integrity===100);assert(attempt.entrySpeed>=55&&attempt.entrySpeed<=65);}
  return {entryKmh:Math.round(attempt.entrySpeed),score:drive.score,clean:result.clean};
}
function waterTest(){
  const smooth=new WaterCup(),corrections=new WaterCup();
  for(let i=0;i<1200;i++){
    smooth.step(dt,Math.min(.55,i/600),.07);
    corrections.step(dt,i%96<48?.88:-.88,.05);
  }
  assert.equal(smooth.water,100);assert(corrections.water<90);
  const bumped=new WaterCup();bumped.impact(12,1);
  for(let i=0;i<120;i++)bumped.step(dt,0,0);
  assert(bumped.water<100);
  const held=corrections.water;corrections.settle();assert.equal(corrections.water,held);
  for(let i=0;i<480;i++)smooth.step(dt,0,0);
  assert(Math.hypot(smooth.x,smooth.y)<.001);
  const deliveries={};
  for(const car of ['neo86','ae86']){
    const d=new TougeDrive(new TougeCourse(),car),cup=new WaterCup();
    while(!d.finished&&d.time<320){d.step(dt,followLine(d,24,4.6));cup.step(dt,d.lateralG,d.longitudinalG);}
    assert(d.finished&&d.integrity===100&&cup.water>=90);
    deliveries[car]=Math.floor(cup.water);
  }
  return deliveries;
}
function ghostTest(){
  const tape=new GhostTape(),pose={time:0,x:1,z:2,heading:3.13,contact:{s:0},placementId:1};
  tape.record(pose);
  Object.assign(pose,{time:.125,x:2,heading:-3.13});tape.record(pose);
  assert(Math.abs(GhostTape.sample(tape.rows,.065).heading)>3.13);
  assert.equal(GhostTape.sample(tape.rows,.065).x,1.5);
  Object.assign(pose,{time:3.13,x:42,placementId:2});tape.record(pose);tape.record(pose,true);
  assert.equal(GhostTape.sample(tape.rows,1),null);
  assert.equal(GhostTape.sample(tape.rows,3.13).x,42);
  for(let i=0;i<8500;i++){pose.time+=.125;pose.x+=.1;tape.record(pose);}
  tape.record(pose,true);
  assert(GhostTape.valid(tape.rows,pose.time));assert(tape.rows.length<=4800*6);
  assert(!GhostTape.valid(tape.rows,pose.time+1));assert(!GhostTape.valid([0,2],0));
  assert(!GhostTape.valid(tape.rows,undefined));
  assert.equal(sectorTime([12,25,54],1),13);assert.equal(sectorTime(undefined,1),null);
  assert.equal(sectorTime([12,-1],1),null);assert.equal(GhostTape.sample(tape.rows,pose.time+1),null);
}
if(require.main===module){
  ghostTest();
  assert.deepEqual(benchmark.summarize([12,31,43,16]),{frames:4,p95:43,p99:43,worst:43,slow:1});
  console.log({clean:tryLesson(true),grip:tryLesson(false),waterDelivered:waterTest()});
}
module.exports={lessonInput};
