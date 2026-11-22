(() => {
  'use strict';
  const T = THREE, capacity = 48;
  class TireSpray {
    constructor(scene, wetRoad) {
      this.wetRoad = wetRoad; this.cursor = 0; this.interval = 0; this.wetness = 0;
      this.particles = Array.from({length:capacity},() => ({age:2,x:0,y:0,z:0,dx:0,dz:0,dy:0,water:0,spin:0,life:.55}));
      const quad = new T.PlaneGeometry(1,1);
      const geo = new T.InstancedBufferGeometry();
      geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
      this.center = new T.InstancedBufferAttribute(new Float32Array(3*capacity),3).setUsage(T.DynamicDrawUsage);
      this.shape = new T.InstancedBufferAttribute(new Float32Array(4*capacity),4).setUsage(T.DynamicDrawUsage);
      geo.setAttribute('origin',this.center); geo.setAttribute('shape',this.shape); geo.instanceCount = 0;
      const material = new T.ShaderMaterial({
        uniforms: T.UniformsUtils.clone(T.UniformsLib.fog), fog:true, transparent:true, depthWrite:false,
        vertexShader: `attribute vec3 origin; attribute vec4 shape;
          varying vec2 sprayUv; varying float opacity;
          #include <fog_pars_vertex>
          void main(){
            vec4 mvPosition=modelViewMatrix*vec4(origin,1.);
            vec2 p=position.xy*shape.xy;
            mvPosition.xy+=mat2(cos(shape.z),sin(shape.z),-sin(shape.z),cos(shape.z))*p;
            gl_Position=projectionMatrix*mvPosition;
            sprayUv=uv; opacity=shape.w;
            #include <fog_vertex>
          }`,
        fragmentShader: `varying vec2 sprayUv; varying float opacity;
          #include <fog_pars_fragment>
          void main(){
            vec2 q=sprayUv*2.-1.;
            float swirl=sin(q.x*9.+sin(q.y*6.))*sin(q.y*7.-q.x*3.);
            float density=1.-smoothstep(.0,1.,dot(q,q)+.13*swirl);
            gl_FragColor=vec4(.66,.72,.75,density*density*opacity);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`
      });
      this.mesh=new T.Mesh(geo,material);this.mesh.name='Water lifted by the rear tires';
      this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
    }
    clear() {
      for(const p of this.particles)p.age=2;
      this.mesh.visible=false; this.interval=0; this.wetness=0;
    }
    update(dt,car,contacts,eye) {
      const speed=Math.abs(car.speed), sin=Math.sin(car.travel), cos=Math.cos(car.travel);
      this.interval+=dt;
      if(this.interval>=.039){
        this.interval%=.039;this.wetness=0;
        if(speed>6){
          const station=car.contact;
          for(let side=2;side<4;side++){
            const tire=contacts[side],dx=tire.x-station.x,dz=tire.z-station.z;
            const water=this.wetRoad.waterAt(station.s+dx*station.fx+dz*station.fz,
              dx*station.rx+dz*station.rz,tire.x,tire.z);
            this.wetness=Math.max(this.wetness,water);
            if(water<.12)continue;
            const p=this.particles[this.cursor++%capacity],spread=(side===2?-1:1)*(.75+water*.85);
            p.age=0;p.x=tire.x;p.y=tire.y+.06;p.z=tire.z;
            p.dx=sin*speed*.30+spread*cos;p.dz=-cos*speed*.30+spread*sin;
            p.dy=.85+water*.9;p.life=.36+.28*water;
            p.water=water*T.MathUtils.smoothstep(speed,6,24);
            p.spin=(side===2?-.22:.22)+Math.sin(this.cursor*1.67)*.28;
          }
        }
      }
      let count=0;
      for(const p of this.particles){
        p.age+=dt;if(p.age>=p.life)continue;
        const t=p.age/p.life;
        p.x+=p.dx*dt;p.z+=p.dz*dt;p.y+=p.dy*dt;p.dy-=dt*1.45;
        const range=Math.hypot(p.x-eye.x,p.y-eye.y,p.z-eye.z);
        const opacity=p.water*.34*Math.sin(Math.PI*t)*(1.-t)*T.MathUtils.smoothstep(range,.8,2.4);
        this.center.setXYZ(count,p.x,p.y,p.z);
        this.shape.setXYZW(count,.29+t*1.46,.17+t*.94,p.spin,opacity);count++;
      }
      this.mesh.visible=count>0;this.mesh.geometry.instanceCount=count;
      if(count){this.center.needsUpdate=true;this.shape.needsUpdate=true;}
    }
  }
  window.TougeTireSpray=TireSpray;
})();
