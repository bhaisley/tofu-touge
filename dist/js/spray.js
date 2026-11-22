(() => {
  'use strict';
  const T = THREE, capacity = 64;
  class TireSpray {
    constructor(scene, wetRoad) {
      this.wetRoad = wetRoad; this.cursor = 0; this.interval = 0; this.wetness = 0;
      this.contactWater=new Float32Array(2);
      this.particles = Array.from({length:capacity},() => ({age:2,x:0,y:0,z:0,dx:0,dz:0,dy:0,water:0,spin:0,life:.55}));
      const quad = new T.PlaneGeometry(1,1);
      const geo = new T.InstancedBufferGeometry();
      geo.index = quad.index; geo.attributes.position = quad.attributes.position; geo.attributes.uv = quad.attributes.uv;
      this.center = new T.InstancedBufferAttribute(new Float32Array(3*capacity),3).setUsage(T.DynamicDrawUsage);
      this.shape = new T.InstancedBufferAttribute(new Float32Array(4*capacity),4).setUsage(T.DynamicDrawUsage);
      geo.setAttribute('origin',this.center); geo.setAttribute('shape',this.shape); geo.instanceCount = 0;
      const material = new T.ShaderMaterial({
        uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),night:{value:0}},fog:true,transparent:true,depthWrite:false,
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
        fragmentShader: `uniform float night;varying vec2 sprayUv; varying float opacity;
          #include <fog_pars_fragment>
          void main(){
            vec2 q=sprayUv*2.-1.;
            float swirl=sin(q.x*9.+sin(q.y*6.))*sin(q.y*7.-q.x*3.);
            float density=1.-smoothstep(.0,1.,dot(q,q)+.17*swirl);
            float droplets=.72+.28*sin(36.*q.x+11.*q.y)*sin(29.*q.y+swirl);
            vec3 tint=mix(vec3(.61,.72,.78),vec3(.13,.17,.23),night);
            gl_FragColor=vec4(tint,density*density*droplets*opacity);
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
      this.mesh.visible=false;this.interval=0;this.wetness=0;this.contactWater.fill(0);
    }
    update(dt,car,contacts,eye,night=false) {
      this.mesh.material.uniforms.night.value=night?1:0;
      const speed=Math.abs(car.speed), sin=Math.sin(car.travel), cos=Math.cos(car.travel);
      this.interval+=dt;
      if(this.interval>=.039){
        this.interval%=.039;this.wetness=0;this.contactWater.fill(0);
        if(speed>1){
          const station=car.contact;
          for(let side=2;side<4;side++){
            const tire=contacts[side],dx=tire.x-station.x,dz=tire.z-station.z;
            const water=this.wetRoad.waterAt(station.s+dx*station.fx+dz*station.fz,
              dx*station.rx+dz*station.rz,tire.x,tire.z);
            this.contactWater[side-2]=water;
            this.wetness=Math.max(this.wetness,water);
            if(water<.12||speed<5)continue;
            const p=this.particles[this.cursor++%capacity],spread=(side===2?-1:1)*(.79+water*.99);
            p.age=0;p.x=tire.x;p.y=tire.y+.06;p.z=tire.z;
            p.dx=sin*car.speed*.34+spread*Math.cos(car.heading);
            p.dz=-cos*car.speed*.34+spread*Math.sin(car.heading);
            p.dy=.73+water*.85;p.life=.32+.29*water;
            p.water=water*T.MathUtils.smoothstep(speed,6,24);
            p.spin=(side===2?-.22:.22)+Math.sin(this.cursor*1.67)*.28;
          }
        }
      }
      let count=0;
      for(const p of this.particles){
        p.age+=dt;if(p.age>=p.life)continue;
        const t=p.age/p.life;
        p.x+=p.dx*dt;p.z+=p.dz*dt;p.y+=p.dy*dt;p.dy-=dt*2.9;
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
