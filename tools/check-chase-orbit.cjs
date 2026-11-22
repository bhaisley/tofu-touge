// Run with Node. Exercise the real pointer controller and chase-camera geometry.
const assert=require('node:assert/strict');
global.window=globalThis;
global.THREE=require('../dist/vendor/three.min.js');
require('../dist/js/course.js');
require('../dist/js/neo-view.js');
require('../dist/js/world.js');
const T=THREE,dt=1/60;

function pointerChecks(){
  const canvas=new EventTarget();
  let captured=null,active=true;
  Object.assign(canvas,{clientWidth:1200,clientHeight:750,classList:{add(){},remove(){}},
    setPointerCapture:id=>{captured=id;},hasPointerCapture:id=>captured===id,releasePointerCapture:()=>{captured=null;}});
  const orbit=new TougeChaseOrbit(canvas,()=>active);
  function pointer(name,x,y,props={}){
    const event=Object.assign(new Event(name,{cancelable:true}),
      {clientX:x,clientY:y,pointerId:1,pointerType:'mouse',button:0,buttons:1,...props});
    canvas.dispatchEvent(event);
  }
  for(const props of [{pointerType:'touch'},{pointerType:'pen'},{button:2}]){
    pointer('pointerdown',0,0,props);assert.equal(captured,null);
  }
  pointer('pointerdown',0,0);assert.equal(captured,1);
  const turn=canvas.clientWidth*.49;
  pointer('pointermove',turn/2,10000);assert(Math.abs(Math.abs(orbit.yaw)-Math.PI)<1e-10);
  assert.equal(orbit.pitch,.98);
  pointer('pointermove',turn*1.25,-10000);assert(Math.abs(orbit.yaw-Math.PI/2)<1e-10);
  assert.equal(orbit.pitch,-.34);
  pointer('pointerup',0,0,{buttons:0});assert.equal(captured,null);
  const half=orbit.returnTime/2,initial=orbit.yaw;
  orbit.sample(half);assert(Math.abs(orbit.yaw-initial*.5)<1e-10);
  pointer('pointerdown',100,100);const caught=orbit.yaw;orbit.sample(.5);assert.equal(orbit.yaw,caught);
  pointer('lostpointercapture',100,100);orbit.sample(1);assert.equal(orbit.sample(dt),null);
  pointer('pointerdown',0,0);active=false;pointer('pointermove',50,50);
  assert.equal(captured,null);assert.equal(orbit.sample(dt),null);
}

function cameraChecks(){
  const down=new TougeCourse(),point=new T.Vector3(),carCorners=[];
  for(const x of [-1.025,1.025])for(const y of [.10,1.34])for(const z of [-2.12,2.12])carCorners.push(new T.Vector3(x,y,z));
  let samples=0,maxView=0,maxRail=0;
  for(const course of [down,down.reversed()])for(const mode of [0,1])for(const aspect of [16/9,.54]){
    const w=Object.create(TougeWorld.prototype);
    Object.assign(w,{course,cameraMode:mode,viewSpeed:22,look:new T.Vector3(),targetPos:new T.Vector3(),
      rig:new T.Group(),camera:new T.PerspectiveCamera(60,aspect,.35,2350)});
    w.roadHeight=(x,z,hint)=>{const p=course.nearest(x,z,hint);return course.surface(p,p.offset);};
    const minimumHorizontal=(mode?50:46)*Math.PI/180;
    w.camera.fov=Math.max((mode?60:59)+w.viewSpeed*.16,Math.min(94,2*Math.atan(Math.tan(minimumHorizontal/2)/aspect)*180/Math.PI));
    w.camera.updateProjectionMatrix();
    for(const station of [course.start+39,course.start+557,course.start+1605])
    for(const offset of [-5.38,-1.8,5.38])for(const slip of [-.58,0,.58]){
      const p=course.sample(station),heading=p.heading+slip;
      p.offset=offset;
      const car={x:p.x+p.rx*offset,z:p.z+p.rz*offset,heading,travel:p.heading,speed:w.viewSpeed,contact:p};
      const across=-p.bank-.009*offset;
      w.forwardGrade=p.grade*Math.cos(slip)+across*Math.sin(slip);
      w.rightGrade=across*Math.cos(slip)-p.grade*Math.sin(slip);
      w.rig.position.set(car.x,course.surface(p,offset)+.002,car.z);
      w.rig.rotation.set(Math.atan(w.forwardGrade),-heading,Math.atan(w.rightGrade),'YXZ');
      w.rig.updateMatrixWorld();
      const dense=station===course.start+557 && Math.abs(offset)>5 && aspect<1;
      const steps=dense?100:8,lastEye=new T.Vector3(),lastAngle=new T.Quaternion();
      for(const pitch of [-.34,0,.98])for(let i=-steps;i<=steps;i++){
        const yaw=i*Math.PI/steps;
        w.camera.up.set(0,1,0);w.positionChase(dt,car,true);
        w.positionMouseOrbit(car,{yaw,pitch});w.camera.lookAt(w.look);w.camera.updateMatrixWorld();
        const eye=w.camera.position,edge=Math.abs(course.nearest(eye.x,eye.z,p.i).offset);
        if(dense && i>-steps){
          assert(lastAngle.angleTo(w.camera.quaternion)<.17,'orbit rolled abruptly at a hairpin');
          assert(lastEye.distanceTo(eye)<.85,'boom jumped at a roadside joint');
        }
        lastAngle.copy(w.camera.quaternion);lastEye.copy(eye);
        maxRail=Math.max(maxRail,edge);
        assert(edge<course.half+.35,'camera crossed the rail clearance at '+station);
        assert(eye.y-w.roadHeight(eye.x,eye.z,p.i)>=(mode?.98:1.38)-.0001);
        for(const corner of carCorners){
          point.copy(corner).applyMatrix4(w.rig.matrixWorld).project(w.camera);
          const extent=Math.max(Math.abs(point.x),Math.abs(point.y));
          maxView=Math.max(maxView,extent);
          assert(extent<1 && point.z>0 && point.z<1,
            JSON.stringify({station,offset,slip,mode,aspect,yaw,pitch,screen:point.toArray()}));
        }
        samples++;
      }
    }
  }
  return {samples,maxView:+maxView.toFixed(3),maxRoadOffset:+maxRail.toFixed(3)};
}
pointerChecks();console.log('Mouse capture, wrap, pitch, release and re-grab passed.',cameraChecks());
