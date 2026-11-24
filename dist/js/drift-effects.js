(() => {
  'use strict';
  const T=THREE,{clamp,lerp:mix}=T.MathUtils,pi=Math.PI;
  const smooth=(a,b,x)=>T.MathUtils.smoothstep(x,a,b);
  function randomStream(seed){
    return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  }
  // Periodic value noise keeps tire mileage and each edge of the texture atlas continuous.
  function grainField(cols,rows,random){
    const grid=Float32Array.from({length:cols*rows},random);
    return (u,v)=>{
      const x=(u-Math.floor(u))*cols,y=(v-Math.floor(v))*rows,i=Math.floor(x),j=Math.floor(y);
      const a=x-i,b=y-j,s=a*a*(3-2*a),t=b*b*(3-2*b),next=(i+1)%cols;
      return mix(mix(grid[i+j*cols],grid[next+j*cols],s),
        mix(grid[i+(j+1)%rows*cols],grid[next+(j+1)%rows*cols],s),t);
    };
  }
  function pixelMap(width,height,write,repeat=false){
    const bytes=new Uint8Array(width*height*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const color=write((x+.5)/width,(y+.5)/height),i=(x+y*width)*4;
      for(let k=0;k<3;k++)bytes[i+k]=Math.round(255*clamp(color[k],0,1));
      bytes[i+3]=255;
    }
    const map=new T.DataTexture(bytes,width,height);
    if(repeat)map.wrapT=T.RepeatWrapping;
    map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;
    map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
  }
  function treadTexture(){
    const rand=randomStream(8441),wear=grainField(5,7,rand),rub=grainField(24,17,rand),fine=grainField(89,75,rand);
    return pixelMap(128,256,(u,v)=>{
      const w=wear(u,v),edge=smooth(.009,.09,Math.min(u,1-u)+.032*(rub(u,v)-.5));
      let ribs=1;
      for(const center of [.17,.385,.607,.831]){
        const groove=Math.abs(u-center-.008*(wear(center,v)-.5));
        ribs-=.24*(1-smooth(.005,.021,groove));
      }
      const compound=edge*ribs*(.51+.25*w+.19*rub(u,v)+.10*fine(u,v));
      return [compound,0,0];
    },true);
  }

  class RubberTrails {
    constructor(scene,heightAt){
      this.heightAt=heightAt;this.cursor=0;this.count=0;this.queued=0;
      const quads=4096,vertices=quads*4,geometry=new T.BufferGeometry();
      const attribute=(name,size)=>{
        const data=new T.BufferAttribute(new Float32Array(vertices*size),size).setUsage(T.DynamicDrawUsage);
        geometry.setAttribute(name,data);return data;
      };
      this.positions=attribute('position',3);this.uv=attribute('uv',2);this.deposit=attribute('deposit',2);
      const indices=new Uint16Array(quads*6);
      for(let i=0;i<quads;i++)indices.set([i*4,i*4+1,i*4+2,i*4+1,i*4+3,i*4+2],i*6);
      geometry.setIndex(new T.BufferAttribute(indices,1));geometry.setDrawRange(0,0);
      const uniforms={...T.UniformsUtils.clone(T.UniformsLib.fog),compound:{value:treadTexture()},clock:{value:0}};
      const mat=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:T.DoubleSide,
        forceSinglePass:true,fog:true,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-1,
        vertexShader:`attribute vec2 deposit;
          varying vec2 stampUv; varying vec2 ink;
          #include <fog_pars_vertex>
          void main(){
            stampUv=uv; ink=deposit;
            vec4 mvPosition=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mvPosition;
            #include <fog_vertex>
          }`,
        fragmentShader:`uniform sampler2D compound; uniform float clock;
          varying vec2 stampUv; varying vec2 ink;
          #include <fog_pars_fragment>
          void main(){
            float tread=texture2D(compound,stampUv).r;
            float opacity=.87*ink.x*tread*(1.-smoothstep(38.,125.,clock-ink.y));
            #ifdef USE_FOG
              #ifdef FOG_EXP2
                opacity*=exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
              #else
                opacity*=1.-smoothstep(fogNear,fogFar,vFogDepth);
              #endif
            #endif
            // Deposited rubber attenuates the actual lit or reflecting road.
            gl_FragColor=vec4(0.,0.,0.,opacity);
          }`});
      this.material=mat;this.capacity=quads;this.mesh=new T.Mesh(geometry,mat);
      this.mesh.name='Rear tire rubber on the road';this.mesh.frustumCulled=false;this.mesh.renderOrder=2;
      scene.add(this.mesh);
      this.tracks=[0,1].map(i=>({active:false,last:new T.Vector3(),edges:[new T.Vector3(),new T.Vector3()],
        next:[new T.Vector3(),new T.Vector3()],distance:.37+i*2.79,intensity:0,width:0}));
    }
    cut(){for(const track of this.tracks)track.active=false;}
    clear(){
      this.cut();this.cursor=this.count=this.queued=0;this.mesh.geometry.setDrawRange(0,0);
    }
    edges(target,x,z,wx,wz,index){
      for(let i=0;i<2;i++){
        const sign=i?1:-1,px=x+sign*wx,pz=z+sign*wz;
        target[i].set(px,this.heightAt(px,pz,index)+.0045,pz);
      }
    }
    segment(track,length,intensity,clock){
      const slot=this.cursor*4,start=track.distance,end=start+length/1.63;
      for(let i=0;i<4;i++){
        const edge=i<2?track.edges[i]:track.next[i-2];
        this.positions.setXYZ(slot+i,edge.x,edge.y,edge.z);
        this.uv.setXY(slot+i,i%2,i<2?start:end);
        this.deposit.setXY(slot+i,i<2?track.intensity:intensity,clock);
      }
      this.cursor=(this.cursor+1)%this.capacity;this.queued++;
      this.count=Math.min(this.capacity,this.count+1);track.distance=end;track.intensity=intensity;
      const previous=track.edges;track.edges=track.next;track.next=previous;
    }
    wheel(side,p,friction,heat,water,load,onPavement,car,dt,clock){
      const track=this.tracks[side],speed=Math.abs(car.speed),station=car.contact;
      const intensity=(.14+.78*smooth(.115,.87,friction))*(.84+.16*heat)*(1-.44*water)*load*onPavement;
      const width=(.059+.044*smooth(.10,.86,friction))*(.86+.14*load);
      if(friction<.103||speed<1.35||onPavement<.1){track.active=false;return;}
      const index=station.i;
      if(!track.active){
        track.last.copy(p);track.width=width;track.intensity=0;track.active=true;
        this.edges(track.edges,p.x,p.z,width*Math.cos(car.heading),width*Math.sin(car.heading),index);
        return;
      }
      const dx=p.x-track.last.x,dz=p.z-track.last.z,length=Math.hypot(dx,dz);
      if(length<.095)return;
      if(length>Math.max(1.45,.65+speed*dt*2)||Math.abs(p.y-track.last.y)>.8+length*.30){
        track.active=false;return;
      }
      let wx=-dz/length,wz=dx/length;
      const previousX=track.edges[1].x-track.edges[0].x,previousZ=track.edges[1].z-track.edges[0].z;
      if(wx*previousX+wz*previousZ<0){wx=-wx;wz=-wz;}
      // Neighbouring quads reuse their exact two edge positions. Sample both
      // sides of the tread on the actual triangles, including crown and banking.
      const steps=Math.ceil(length/.35),oldInk=track.intensity;
      for(let j=1;j<=steps;j++){
        const t=j/steps,w=mix(track.width,width,t);
        this.edges(track.next,track.last.x+t*dx,track.last.z+t*dz,w*wx,w*wz,index);
        this.segment(track,length/steps,mix(oldInk,intensity,t),clock);
      }
      track.last.copy(p);track.width=width;
    }
    flush(){
      if(!this.queued)return;
      const start=(this.cursor-this.queued+this.capacity)%this.capacity;
      const span=Math.min(this.queued,this.capacity-start);
      for(const attr of [this.positions,this.uv,this.deposit]){
        const components=attr.itemSize*4;
        attr.addUpdateRange(start*components,span*components);
        if(span<this.queued)attr.addUpdateRange(0,(this.queued-span)*components);
        attr.needsUpdate=true;
      }
      this.queued=0;
      this.mesh.geometry.setDrawRange(0,this.count*6);
    }
  }

  function smokeAtlas(){
    const rand=randomStream(9097),large=grainField(9,9,rand),medium=grainField(23,23,rand),fine=grainField(53,53,rand);
    return pixelMap(256,256,(u,v)=>{
      const cellX=Math.floor(u*2),cellY=Math.floor(v*2),x=(u*2-cellX)*2-1,y=(v*2-cellY)*2-1;
      const n=large(u,v)*.54+medium(u,v)*.32+fine(u,v)*.14;
      const dx=x+.15*(medium(u+.12,v)-.5),dy=y+.15*(large(u,v+.21)-.5);
      const angle=Math.atan2(dy,dx),lobes=.054*Math.sin(4*angle+cellX*3+cellY)+.044*Math.sin(3*angle-cellX);
      const radius=Math.hypot(dx,dy)+lobes;
      const density=smooth(.018,.62,1-radius+.53*(n-.5))*(.34+.80*n);
      const illumination=clamp(.49+.24*dy-.12*dx+.38*(large(u+.012,v+.014)-n)+.14*(1-radius),0,1);
      return [density,illumination,0];
    });
  }
  class DriftSmoke {
    constructor(scene){
      this.capacity=144;this.cursor=0;this.random=randomStream(13701);this.active=[];
      this.slots=Array.from({length:this.capacity},()=>({age:4,life:0}));
      const quad=new T.PlaneGeometry(1,1),geo=new T.InstancedBufferGeometry();
      geo.index=quad.index;geo.setAttribute('position',quad.attributes.position);geo.setAttribute('uv',quad.attributes.uv);
      const attr=(name,size)=>{
        const a=new T.InstancedBufferAttribute(new Float32Array(this.capacity*size),size).setUsage(T.DynamicDrawUsage);
        geo.setAttribute(name,a);return a;
      };
      this.origins=attr('origin',3);this.shapes=attr('shape',4);this.cells=attr('puff',3);geo.instanceCount=0;
      const uniforms={...T.UniformsUtils.clone(T.UniformsLib.fog),cloud:{value:smokeAtlas()},night:{value:0}};
      const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,fog:true,
        vertexShader:`attribute vec3 origin; attribute vec4 shape; attribute vec3 puff;
          varying vec2 texUV; varying vec3 appearance;
          #include <fog_pars_vertex>
          void main(){
            vec4 mvPosition=modelViewMatrix*vec4(origin,1.);
            float s=sin(shape.z),c=cos(shape.z);
            mvPosition.xy+=mat2(c,s,-s,c)*(position.xy*shape.xy);
            gl_Position=projectionMatrix*mvPosition;
            texUV=.5*(vec2(mod(puff.x,2.),floor(puff.x*.5))+uv*.984375+.0078125);
            appearance=vec3(shape.w,puff.yz);
            #include <fog_vertex>
          }`,
        fragmentShader:`uniform sampler2D cloud;uniform float night;
          varying vec2 texUV;varying vec3 appearance;
          #include <fog_pars_fragment>
          void main(){
            vec2 sampleCloud=texture2D(cloud,texUV).rg;
            float alpha=sampleCloud.r*appearance.x;
            if(alpha<.002)discard;
            vec3 lit=mix(vec3(.26,.275,.29),vec3(.67,.69,.68),sampleCloud.g);
            lit=mix(lit,mix(vec3(.042,.052,.069),vec3(.15,.175,.19),sampleCloud.g),night);
            lit+=vec3(.13,.014,.012)*appearance.y*(.28+night*.72);
            lit=mix(lit,lit*vec3(.95,1.025,1.045),appearance.z);
            gl_FragColor=vec4(lit,alpha);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            #include <fog_fragment>
          }`});
      this.mesh=new T.Mesh(geo,material);this.mesh.name='Hot rubber from both rear contact patches';
      this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=4;scene.add(this.mesh);
    }
    clear(){
      for(const p of this.slots)p.age=p.life;
      this.mesh.visible=false;this.mesh.geometry.instanceCount=0;
    }
    emit(from,to,f,side,heat,friction,water,car){
      const p=this.slots[this.cursor++%this.capacity],r=this.random,s=side?1:-1;
      const rightX=Math.cos(car.heading),rightZ=Math.sin(car.heading),out=s*(.25+.70*r()+.35*friction);
      const inertia=.12+.16*r(),travelX=car.speed*Math.sin(car.travel),travelZ=-car.speed*Math.cos(car.travel);
      p.age=0;p.life=(1.15+.67*heat+.38*r())*(1-.20*water);
      p.x=mix(from.x,to.x,f)+s*rightX*.024;p.z=mix(from.z,to.z,f)+s*rightZ*.024;
      p.y=mix(from.y,to.y,f)+.12+.033*r();
      p.dx=travelX*inertia+rightX*out;p.dz=travelZ*inertia+rightZ*out;
      p.dy=.53+heat*.83+.37*r()+car.contact.grade*(p.dx*car.contact.fx+p.dz*car.contact.fz);
      p.radius=.36+.10*r()+.15*friction;p.expansion=1.16+.51*heat+.41*r();
      p.opacity=(.22+.35*friction)*(.60+.40*heat)*(1-.24*water)*(.79+.32*r());
      p.angle=(r()-.5)*1.8;p.spin=(r()-.5)*.82;p.tile=Math.floor(r()*4);
      p.width=.98+.38*r();p.seed=r()*2*pi;p.water=water;
    }
    advance(dt,eye,night){
      this.active.length=0;this.mesh.material.uniforms.night.value=night?1:0;
      const drag=1-Math.exp(-1.9*dt);
      for(const p of this.slots){
        if(p.age>=p.life)continue;
        p.age+=dt;if(p.age>=p.life)continue;
        p.dx+=((.29+.13*Math.sin(p.seed+p.age*2))-p.dx)*drag;
        p.dz+=((-.14+.11*Math.cos(p.seed+p.age))-p.dz)*drag;
        p.x+=p.dx*dt;p.z+=p.dz*dt;p.y+=p.dy*dt;p.dy+=(.69-p.dy)*dt*.72;
        p.distance=(eye.x-p.x)**2+(eye.y-p.y)**2+(eye.z-p.z)**2;
        this.active.push(p);
      }
      this.active.sort((a,b)=>b.distance-a.distance);
      for(let i=0;i<this.active.length;i++){
        const p=this.active[i],t=p.age/p.life,diameter=p.radius+p.expansion*(t*1.6+.43*Math.sqrt(t));
        const alpha=p.opacity*smooth(0,.084,t)*(1-smooth(.34,1,t))*smooth(.46,1.85,Math.sqrt(p.distance));
        this.origins.setXYZ(i,p.x,p.y,p.z);
        this.shapes.setXYZW(i,diameter*p.width,diameter*(.61+.47*t),p.angle+p.spin*p.age,alpha);
        this.cells.setXYZ(i,p.tile,1-smooth(0,.26,t),p.water);
      }
      const count=this.active.length;this.mesh.visible=count>0;this.mesh.geometry.instanceCount=count;
      if(count){this.origins.needsUpdate=this.shapes.needsUpdate=this.cells.needsUpdate=true;}
    }
  }

  class ExhaustFlames {
    constructor(car){
      this.age=1;this.life=0;this.strength=0;this.serial=0;this.first=false;
      // Follow the sprung shell beside the scanned body meshes so transient
      // gas never enters the bodywork's static occlusion catalogue.
      const mounts=new T.Group();mounts.name='Gas leaving the exhaust outlets';
      mounts.position.copy(car.body.position);mounts.quaternion.copy(car.body.quaternion);
      mounts.scale.copy(car.body.scale);car.suspension.add(mounts);
      const rand=randomStream(486),eddy=grainField(6,7,rand),filament=grainField(14,18,rand);
      const flow=pixelMap(64,64,(x,y)=>[eddy(x,y),filament(x,y),0],true);flow.wrapS=T.RepeatWrapping;
      const hull=new T.BoxGeometry(2,2,1).translate(0,0,.5);
      this.jets=car.exhaustOutlets.map((outlet,i)=>{
        const uniforms={toLocal:{value:new T.Matrix4()},flow:{value:flow},phase:{value:0},power:{value:0},variant:{value:i*2.3}};
        const material=new T.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
          vertexShader:`uniform mat4 toLocal;varying vec3 pHull,eyeLocal;
            void main(){
              pHull=position;eyeLocal=(toLocal*vec4(cameraPosition,1.)).xyz;
              gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
            }`,
          fragmentShader:`varying vec3 pHull,eyeLocal;
            uniform sampler2D flow;uniform float phase,power,variant;
            void main(){
              vec3 ray=normalize(pHull-eyeLocal),safeRay=sign(ray+vec3(.0000001))*max(abs(ray),vec3(.00001));
              vec3 nearBox=(vec3(-1.,-1.,0.)-eyeLocal)/safeRay,farBox=(vec3(1.)-eyeLocal)/safeRay;
              vec3 lo=min(nearBox,farBox),hi=max(nearBox,farBox);
              float entry=max(0.,max(lo.x,max(lo.y,lo.z))),end=min(hi.x,min(hi.y,hi.z));
              float stepSize=max(0.,(end-entry)/12.),alpha=0.; vec3 light=vec3(0.);
              for(int k=0;k<12;k++){
                vec3 p=eyeLocal+ray*(entry+(float(k)+.5)*stepSize);float z=clamp(p.z,0.,1.);
                float wave=variant+phase*23.;vec2 jet=p.xy;
                jet-=z*z*vec2(.18*sin(10.*z-wave)+.12*sin(18.*z+.7*wave),.26+.16*sin(12.*z+.85*wave));
                float a=atan(jet.y,jet.x),tongue=.5+.5*sin(3.*a+.44*wave);
                vec2 streak=texture2D(flow,vec2(1.11*z-.05*wave,jet.y*.51+jet.x*.22+variant*.19)).rg;
                float width=(.43+.47*sin(3.14159*pow(z,.79)))*(1.-smoothstep(.38+.12*tongue,.82+.18*tongue,z));
                width*=1.+(.08+.14*z)*sin(4.*a+wave-12.*z)+.30*(streak.r-.5);
                float core=length(jet)/max(.018,width);
                float eddies=smoothstep(.24,.75,.67*streak.r+.33*streak.g+.12*(1.-core));
                float fuel=(1.-smoothstep(.35,1.,core))*(1.-smoothstep(.68,1.,z))*(.24+.76*eddies);
                float optical=1.-exp(-fuel*stepSize*4.35);
                float hot=(1.-smoothstep(.14,.75,core))*(1.-.65*z);
                vec3 color=mix(vec3(2.8,.14,.009),vec3(4.8,1.42,.19),hot*(.47+.53*eddies));
                color+=vec3(.81,1.12,.68)*hot*hot*eddies;
                color=mix(color,vec3(.10,.41,2.85),.88*(1.-smoothstep(.055,.195,z)));
                light+=(1.-alpha)*optical*color;alpha+=(1.-alpha)*optical;
              }
              if(alpha<.008)discard;
              gl_FragColor=vec4(light/max(.001,alpha),alpha*power);
              #include <tonemapping_fragment>
              #include <colorspace_fragment>
            }`});
        const jet=new T.Mesh(hull,material);jet.name='Exhaust flame '+(i?'right':'left');
        const axis=new T.Vector3(...outlet.direction).normalize();
        jet.position.fromArray(outlet.position).addScaledVector(axis,-.012);
        jet.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),axis);jet.renderOrder=5;
        jet.visible=false;mounts.add(jet);return jet;
      });
      this.lights=this.jets.map(jet=>{
        const light=new T.PointLight(0xff852e,0,1.6,2);light.name='Exhaust light on the rear bumper';
        light.position.copy(jet.position);light.position.z+=.17;
        light.visible=false;mounts.add(light);return light;
      });
    }
    clear(){
      this.age=this.life;this.strength=0;this.first=false;
      for(const light of this.lights)light.intensity=0;
      for(const jet of this.jets)jet.visible=false;
    }
    pop(strength){
      if(!Number.isFinite(strength)||strength<=0)return;
      this.strength=clamp(strength,0,1);this.age=0;this.life=.077+.078*this.strength;this.first=true;this.serial++;
    }
    advance(dt,night){
      // Keep the night lights registered at zero between bursts so the scene's
      // material programs retain the same light count on each gear change.
      for(const light of this.lights)light.visible=!!night;
      if(this.age>=this.life){this.clear();return;}
      const t=this.first?Math.min(.23,dt*.44/this.life):this.age/this.life;
      const burst=(.76+.24*Math.sin(6.8*pi*t+.49))*(1-smooth(.18,1,t));
      for(let i=0;i<this.jets.length;i++){
        const jet=this.jets[i],u=jet.material.uniforms;
        const jitter=.88+.12*Math.sin(this.serial*3.77+i*3.1+t*15.4);
        const diameter=(.067+.040*this.strength)*(.77+.23*burst);
        jet.scale.set(diameter,diameter,(.17+.32*this.strength)*(.25+.75*burst)*jitter);
        jet.visible=burst>.025;u.phase.value=t;u.power.value=(.59+.41*this.strength)*burst;
        u.variant.value=i*2.3+this.serial*1.73;
        jet.updateWorldMatrix(true,false);u.toLocal.value.copy(jet.matrixWorld).invert();
      }
      for(const light of this.lights)light.intensity=night?(.33+1.18*this.strength)*burst:0;
      this.first=false;this.age+=dt;
    }
  }

  class DriftEffects {
    constructor(scene,car,roadHeight,roadHalf){
      this.trails=new RubberTrails(scene,roadHeight);this.smoke=new DriftSmoke(scene);
      this.exhausts=new WeakMap();this.setCar(car);
      this.clock=0;this.contactReady=false;this.roadHalf=roadHalf;
      this.tires=[0,1].map(side=>({heat:0,emission:side*.47,previous:new T.Vector3()}));
    }
    setCar(car){
      this.exhaust?.clear();
      if(!this.exhausts.has(car))this.exhausts.set(car,new ExhaustFlames(car));
      this.exhaust=this.exhausts.get(car);
    }
    cut(){
      this.trails.cut();this.smoke.clear();this.exhaust.clear();this.contactReady=false;
      for(const tire of this.tires){tire.heat=0;tire.emission=0;}
    }
    clear(){this.cut();this.trails.clear();this.clock=0;}
    update(dt,car,contacts,eye,water,night){
      this.clock+=dt;this.trails.material.uniforms.clock.value=this.clock;
      const speed=Math.abs(car.speed),motion=smooth(.9,5.7,speed);
      const slipAngle=Math.abs(Math.sin(car.rearSlipAngle||0)),spin=car.wheelspin||0,lock=car.rearLock||0;
      const scrub=Math.max(1.77*slipAngle,.98*lock,.75*spin,.66*(car.slip||0));
      const slipSpeed=speed*Math.max(slipAngle,.95*lock,.42*spin,.32*(car.slip||0));
      const lateral=clamp(car.lateralG||0,-1.35,1.35),longitudinal=clamp(car.longitudinalG||0,-1.2,1.2);
      for(let side=0;side<2;side++){
        const tire=this.tires[side],p=contacts[side+2],film=water[side],load=clamp(1+(side?-1:1)*lateral*.19+.08*longitudinal,.67,1.29);
        const friction=clamp(scrub*motion*load,0,1);
        const across=(p.x-car.contact.x)*car.contact.rx+(p.z-car.contact.z)*car.contact.rz;
        const road=1-smooth(this.roadHalf-.12,this.roadHalf+.03,Math.abs(across));
        const heating=clamp(slipSpeed*.14,0,1)*friction*road*(1-.38*film);
        const rate=heating>tire.heat?1.08:.33+.86*film;
        tire.heat+=(heating-tire.heat)*(1-Math.exp(-dt*rate));
        this.trails.wheel(side,p,friction,tire.heat,film,load,road,car,dt,this.clock);
        const drift=road*smooth(.11,.56,friction)*smooth(.92,5.4,slipSpeed);
        const quantity=dt*drift*(4+30*tire.heat+16*friction)*(1-.36*film);
        const continuous=this.contactReady&&p.distanceTo(tire.previous)<Math.max(1.5,.70+speed*dt*2);
        if(continuous&&quantity>0){
          const budget=tire.emission+quantity,count=Math.floor(budget);
          for(let i=0;i<Math.min(count,8);i++)
            this.smoke.emit(tire.previous,p,(i+1-tire.emission)/quantity,side,tire.heat,friction,film,car);
          tire.emission=budget-count;
        }else tire.emission=side*.47;
        tire.previous.copy(p);
      }
      this.contactReady=true;this.trails.flush();this.smoke.advance(dt,eye,night);this.exhaust.advance(dt,night);
    }
  }
  window.TougeDriftEffects=DriftEffects;
})();
