(() => {
  'use strict';
  class ChaseOrbit {
    constructor(canvas,active) {
      this.canvas=canvas;this.pointer=null;this.yaw=0;this.pitch=0;this.returnTime=0;
      canvas.addEventListener('pointerdown',e=>{
        if(!active() || e.pointerType!=='mouse' || e.button!==0 || e.ctrlKey || this.pointer!==null)return;
        e.preventDefault();canvas.setPointerCapture(e.pointerId);
        this.pointer=e.pointerId;this.x=e.clientX;this.y=e.clientY;this.returnTime=0;
        canvas.classList.add('orbiting');
      });
      canvas.addEventListener('pointermove',e=>{
        if(e.pointerId!==this.pointer)return;
        if(!active()){this.reset();return;}
        if(!(e.buttons&1)){this.release();return;}
        // A drag across half a desktop viewport can cover a full revolution.
        const turn=2*Math.PI/THREE.MathUtils.clamp(canvas.clientWidth*.49,310,870);
        const tilt=1.98/THREE.MathUtils.clamp(canvas.clientHeight,320,900);
        const yaw=this.yaw+(e.clientX-this.x)*turn;
        this.yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
        this.pitch=THREE.MathUtils.clamp(this.pitch+(e.clientY-this.y)*tilt,-.34,.98);
        this.x=e.clientX;this.y=e.clientY;
      });
      for(const name of ['pointerup','pointercancel','lostpointercapture']){
        canvas.addEventListener(name,e=>{if(e.pointerId===this.pointer)this.release();});
      }
    }
    release(){
      const id=this.pointer;this.pointer=null;
      this.canvas.classList.remove('orbiting');
      if(id!==null && this.canvas.hasPointerCapture(id))this.canvas.releasePointerCapture(id);
      this.startYaw=this.yaw;this.startPitch=this.pitch;
      this.returnTime=.37+.37*Math.max(Math.abs(this.yaw)/Math.PI,Math.abs(this.pitch));
      this.remaining=this.returnTime;
    }
    reset(){
      if(this.pointer!==null)this.release();
      this.yaw=this.pitch=this.returnTime=0;
    }
    sample(dt){
      if(this.returnTime){
        this.remaining=Math.max(0,this.remaining-dt);
        const t=this.remaining/this.returnTime,weight=t*t*t*(t*(t*6-15)+10);
        this.yaw=this.startYaw*weight;this.pitch=this.startPitch*weight;
        if(!this.remaining)this.returnTime=0;
      }
      return this.yaw || this.pitch ? this : null;
    }
  }
  class CarWalkaround {
    constructor(canvas,active) {
      this.view={yaw:.92,pitch:.135,zoom:1};
      this.pointers=new Map();this.pending=2;
      const coords=e=>({x:e.clientX,y:e.clientY});
      const distance=()=>{const [a,b]=this.pointers.values();return Math.hypot(a.x-b.x,a.y-b.y);};
      canvas.addEventListener('pointerdown',e=>{
        if(!active() || (e.pointerType==='mouse' && e.button!==0))return;
        e.preventDefault();canvas.setPointerCapture(e.pointerId);this.pointers.set(e.pointerId,coords(e));
      });
      canvas.addEventListener('pointermove',e=>{
        if(!active() || !this.pointers.has(e.pointerId))return;
        const last=this.pointers.get(e.pointerId),pinching=this.pointers.size===2;
        const oldGap=pinching?distance():0;
        this.pointers.set(e.pointerId,coords(e));
        if(pinching){if(oldGap>3)this.move(0,0,distance()/oldGap);}
        else if(this.pointers.size===1){
          const unit=3.35/Math.max(300,Math.min(canvas.clientWidth,canvas.clientHeight));
          this.move((e.clientX-last.x)*unit,(e.clientY-last.y)*unit*.62);
        }
      });
      for(const name of ['pointerup','pointercancel','lostpointercapture'])
        canvas.addEventListener(name,e=>this.pointers.delete(e.pointerId));
      canvas.addEventListener('wheel',e=>{
        if(!active())return;e.preventDefault();
        const pixels=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);
        this.move(0,0,Math.exp(-THREE.MathUtils.clamp(pixels,-250,250)*.0015));
      },{passive:false});
    }
    reset(){this.pointers.clear();Object.assign(this.view,{yaw:.92,pitch:.135,zoom:1});this.pending=2;}
    move(yaw,pitch,zoom=1) {
      const v=this.view;
      v.yaw=(v.yaw+yaw)%(Math.PI*2);
      v.pitch=THREE.MathUtils.clamp(v.pitch+pitch,-.058,.64);
      v.zoom=THREE.MathUtils.clamp(v.zoom*zoom,.89,1.7);this.pending=2;
    }
    key(code) {
      const delta={ArrowLeft:[-.16,0],ArrowRight:[.16,0],ArrowUp:[0,.062],ArrowDown:[0,-.062],
        Equal:[0,0,1.1],NumpadAdd:[0,0,1.1],Minus:[0,0,1/1.1],NumpadSubtract:[0,0,1/1.1]}[code];
      if(!delta)return false;this.move(...delta);return true;
    }
    render(world,car,dt,pad) {
      const x=pad?.axes[2]||0,y=pad?.axes[3]||0;
      if(Math.abs(x)>.16 || Math.abs(y)>.16)this.move(x*dt*2.2,-y*dt*.9);
      if(this.pending>0){world.render(dt,car,false,this.view);this.pending--;}
    }
  }
  window.TougeCarWalkaround=CarWalkaround;
  window.TougeChaseOrbit=ChaseOrbit;
})();
