(() => {
  'use strict';
  const T=THREE, clamp=T.MathUtils.clamp, mix=T.MathUtils.lerp;
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
  function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function texture(w,h,paint){
    const c=document.createElement('canvas');c.width=w;c.height=h;paint(c.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;return tex;
  }
  function geometry(pos,idx,uv,colors) {
    const g=new T.BufferGeometry();
    g.setAttribute('position',new T.Float32BufferAttribute(pos,3));
    if(uv)g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    if(colors)g.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    g.setIndex(idx);g.computeVertexNormals();return g;
  }
  function landHeight(course) {
    const anchors=course.points.filter((p,i)=>i%15===0);
    const plane=(x,z)=>z*0.143-x*0.21;
    const known=anchors.map(p=>({x:p.x,z:p.z,adjust:p.y-plane(p.x,p.z)}));
    return function groundAt(x,z) {
      const p=course.nearest(x,z),d=p.distance;
      let sum=0,wSum=0;
      if(d>9)for(const a of known){
        const d2=(a.x-x)**2+(a.z-z)**2+650;
        const w=1/(d2*d2);sum+=a.adjust*w;wSum+=w;
      }
      const undulation=12*Math.sin(x*.018+z*.009)+8*Math.sin(x*.011-z*.028)+15*Math.cos(x*.007+z*.008);
      const focal=Math.min(Math.abs(p.s-course.splits[0]),Math.abs(p.s-course.finish));
      const turnout=1-smooth(27,49,focal);
      const edge=course.surface(p,clamp(p.offset,-7,7));
      const local=edge-1.05-(1-smooth(6.8,12,d))*.65;
      if(d<=9)return local;
      const far=plane(x,z)+sum/wSum+undulation*smooth(10,110,d)-14*smooth(170,440,d);
      return mix(local,far,smooth(8+turnout*15,40+turnout*15,d));
    };
  }
  function addTerrain(scene,course,groundAt,sky){
    const b=course.bounds,step=7,margin=260,x0=b.minX-margin,z0=b.minZ-margin;
    const nx=Math.ceil((b.maxX-b.minX+2*margin)/step),nz=Math.ceil((b.maxZ-b.minZ+2*margin)/step);
    const pos=[],colors=[],uv=[],edges=[],cover=[],idx=[],r=rng(371);
    const a=new T.Color(0x6f796e),c=new T.Color(0xbcc1a8),stone=new T.Color(0x899794);
    const color=new T.Color();
    for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
      const x=x0+i*step,z=z0+j*step,y=groundAt(x,z);
      // Ease the outer terrain below the photographed foothills, beyond the playable road.
      const rim=1-smooth(0,125,step*Math.min(i,j,nx-i,nz-j));
      pos.push(x,y-48*rim,z);uv.push(x/3.8,z/3.8);edges.push(rim);
      cover.push(TougeGrass.habitat(x,z));
      const t=clamp(.46+.28*Math.sin(x*.076+z*.023+1.2*Math.sin(z*.03))+.24*Math.sin(z*.054-x*.011)+r()*.13,0,1);
      color.copy(a).lerp(c,t).lerp(stone,Math.max(0,Math.sin(x*.031-z*.027))*.44);
      colors.push(color.r,color.g,color.b);
      if(i<nx && j<nz){const k=j*(nx+1)+i;idx.push(k,k+nx+1,k+1,k+1,k+nx+1,k+nx+2);}
    }
    const geo=geometry(pos,idx,uv,colors);
    geo.setAttribute('rim',new T.Float32BufferAttribute(edges,1));
    geo.setAttribute('grassCover',new T.Float32BufferAttribute(cover,1));
    const material=TougeLighting.scannedSurface('forest-floor',.75,{vertexColors:true});
    const bankMaterial=material.clone();
    bankMaterial.side=T.DoubleSide;bankMaterial.onBeforeCompile=material.onBeforeCompile;
    TougeLighting.detailTerrainMaterial(bankMaterial,sky);
    TougeLighting.detailTerrainMaterial(material,sky);
    const m=new T.Mesh(geo,material);
    m.name='Cedar forest floor';m.receiveShadow=true;m.castShadow=true;scene.add(m);
    function drawnHeight(x,z){
      const u=clamp((x-x0)/step,0,nx-.00001),v=clamp((z-z0)/step,0,nz-.00001);
      const i=Math.floor(u),j=Math.floor(v),a=j*(nx+1)+i,dx=u-i,dz=v-j,ys=geo.attributes.position;
      const h0=ys.getY(a),h1=ys.getY(a+1),h2=ys.getY(a+nx+1),h3=ys.getY(a+nx+2);
      return dx+dz<=1?h0+(h1-h0)*dx+(h2-h0)*dz:h3+(h2-h3)*(1-dx)+(h1-h3)*(1-dz);
    }
    return {map:material.map,colors:geo.attributes.color,cover:geo.attributes.grassCover,x0,z0,step,nx,nz,drawnHeight,bankMaterial};
  }
  // Contact patches use the very triangles shown by the renderer. The road
  // crown, bank and shoulder lip differ from a plane at the vehicle's centre.
  function makeRoadHeight(course,pavement,shoulder,pavedOffsets,shoulderOffsets) {
    function inTriangle(vertices,a,b,c,x,z) {
      const ax=vertices.getX(a), az=vertices.getZ(a);
      const bx=vertices.getX(b)-ax, bz=vertices.getZ(b)-az;
      const cx=vertices.getX(c)-ax, cz=vertices.getZ(c)-az;
      const det=bx*cz-bz*cx;
      if(Math.abs(det)<1e-8)return NaN;
      const dx=x-ax,dz=z-az;
      const u=(dx*cz-dz*cx)/det, v=(bx*dz-bz*dx)/det;
      if(u < -0.00003 || v < -0.00003 || u+v > 1.00003)return NaN;
      const ay=vertices.getY(a);
      return ay+u*(vertices.getY(b)-ay)+v*(vertices.getY(c)-ay);
    }
    function onStrip(vertices,offsets,stride,first,offset,x,z,index) {
      let lane=0;
      while(lane<offsets.length-2 && offset>offsets[lane+1])lane++;
      for(const ds of [0,-1,1]) {
        const i=index+ds;
        if(i<0||i>=course.segments)continue;
        for(const dj of [0,-1,1]) {
          const j=lane+dj;
          if(j<0||j>=offsets.length-1)continue;
          const k=i*stride+first+j,n=k+stride;
          let h=inTriangle(vertices,k,k+1,n,x,z);
          if(Number.isNaN(h))h=inTriangle(vertices,k+1,n+1,n,x,z);
          if(Number.isFinite(h))return h;
        }
      }
      return NaN;
    }
    return (x,z,hint) => {
      const p=course.nearest(x,z,hint), d=Math.abs(p.offset);
      if(d<=course.half+0.06) {
        const h=onStrip(pavement,pavedOffsets,pavedOffsets.length,0,p.offset,x,z,p.i);
        if(Number.isFinite(h))return h;
      }
      const h=onStrip(shoulder,shoulderOffsets,shoulderOffsets.length*2,p.offset<0?0:shoulderOffsets.length,d,x,z,p.i);
      return Number.isFinite(h)?h:course.surface(p,p.offset);
    };
  }
  function addRoad(scene,course,groundAt,wetRoad) {
    const pos=[],uv=[],idx=[], shoulders=[],shouldUV=[],shouldColors=[],shouldIdx=[], r=rng(6501);
    const base=new T.Color(), dark=new T.Color(0xa7a29a),grass=new T.Color(0xb3bb98),gravel=new T.Color(0xdad5cb);
    const widths=[-course.half,-2.42,0,2.42,course.half];
    const strip=[course.half-.018,course.half+.26,course.half+1.35,course.half+3.8,course.half+8.8];
    for(let i=0;i<course.points.length;i++){
      const p=course.points[i];
      for(let j=0;j<widths.length;j++){
        const w=widths[j];
        pos.push(p.x+p.rx*w,course.surface(p,w),p.z+p.rz*w);
        uv.push(w,p.s);
        if(i<course.segments && j<widths.length-1) {
          const k=i*widths.length+j,n=k+widths.length;idx.push(k,k+1,n,k+1,n+1,n);
        }
      }
      for(const side of [-1,1]){
        const signIndex=side>0?1:0;
        for(let j=0;j<strip.length;j++){
          const o=side*strip[j],x=p.x+p.rx*o,z=p.z+p.rz*o;
          const y=j<=2?course.surface(p,o)-.025:j===3?mix(course.surface(p,side*6)-.1,groundAt(x,z),.53):groundAt(x,z)-.18;
          shoulders.push(x,y,z);
          shouldUV.push(o,p.s);
          base.copy(j<2?gravel:j===2?dark:grass).multiplyScalar(.87+r()*.17);
          shouldColors.push(base.r,base.g,base.b);
          if(i<course.segments && j<strip.length-1) {
            const k=i*10+signIndex*5+j,n=k+10;
            if(side>0)shouldIdx.push(k,k+1,n,k+1,n+1,n);else shouldIdx.push(k,n,k+1,k+1,n,n+1);
          }
        }
      }
    }
    const pavement=new T.Mesh(geometry(pos,idx,uv),wetRoad.pavement);
    pavement.name='Wet mountain asphalt';
    pavement.receiveShadow=true;scene.add(pavement);wetRoad.exclude(pavement);
    const gravelGeometry=geometry(shoulders,shouldIdx,shouldUV,shouldColors);
    wetRoad.matchForestFloor(gravelGeometry);
    const shoulder=new T.Mesh(gravelGeometry,wetRoad.shoulder);
    shoulder.name='Gravel shoulder';
    shoulder.receiveShadow=true;scene.add(shoulder);
    const ink=texture(768,512,(c,w,h)=>{
      c.fillStyle='rgba(240,224,185,.83)';
      for(let i=0;i<12;i++)for(let j=0;j<2;j++)if((i+j)%2===0)c.fillRect(i*w/12,j*64,w/12,64);
      c.fillStyle='rgba(233,172,86,.9)';c.font='bold 184px sans-serif';c.textAlign='center';
      c.fillText('40',w*.25,h*.83);
      c.fillStyle='rgba(232,229,211,.8)';
      c.beginPath();c.moveTo(w*.56,h*.8);c.lineTo(w*.75,h*.38);c.lineTo(w*.94,h*.8);
      c.lineTo(w*.75,h*.55);c.closePath();c.fill();
      c.globalCompositeOperation='destination-out';
      c.fillStyle='rgba(0,0,0,.72)';
      for(let chip=0;chip<7800;chip++)c.fillRect(r()*w,r()*h,.45+r()*1.55,.55+r()*2.1);
    });
    const marks=[],markUV=[],markIdx=[];
    function decal(s,o,w,len,v0,v1,u0=0,u1=1) {
      const n=Math.max(1,Math.ceil(len/1.5)),k=marks.length/3;
      for(let j=0;j<=n;j++){
        const at=s+len*(j/n-.5);
        for(const side of [-1,1]) {
          const v=course.at(at,o+side*w/2,.028);
          marks.push(v.x,v.y,v.z);markUV.push(side<0?u0:u1,mix(v0,v1,j/n));
        }
        if(j<n){const a=k+j*2;markIdx.push(a,a+1,a+2,a+1,a+3,a+2);}
      }
    }
    for(const s of [course.start,course.finish])decal(s,0,course.half*2-.84,.9,.7501,.999);
    for(const s of course.splits.slice(0,2))decal(s,0,course.half*2-.85,.53,.7501,.999);
    let previous=-100;
    for(const p of course.points)if(Math.abs(p.curvature)>.022 && p.s-previous>95){
      decal(Math.max(12,p.s-26),-2.3,2.15,3.7,0,.7,0,.5);
      for(let i=0;i<3;i++)decal(p.s-14+i*5,-2.3,1.7,1.8,0,.7,.5,1);
      previous=p.s;
    }
    const markings=new T.Mesh(geometry(marks,markIdx,markUV),new T.MeshStandardMaterial({
      map:ink,roughness:.62,metalness:0,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2
    }));
    markings.name='Weathered route markings';markings.receiveShadow=true;
    scene.add(markings);wetRoad.exclude(markings);
    const roadHeight=makeRoadHeight(course,pavement.geometry.attributes.position,gravelGeometry.attributes.position,widths,strip);
    wetRoad.dressVerge(scene,course,roadHeight);
    return roadHeight;
  }
  function addRetainingWalls(scene,course,groundAt,forestFloor){
    const stone=TougeLighting.scannedSurface('haruna-masonry',1.0,{side:T.DoubleSide,vertexColors:true});
    const pos=[],uv=[],idx=[],faceColors=[],cap=[],capUV=[],capIdx=[],earth=[],earthUV=[],earthIdx=[],soilColors=[];
    function strip(index,base,stride,side){
      const a=base,b=a+1,c=a+stride,d=c+1;
      if(side>0)index.push(a,b,c,b,d,c);else index.push(a,c,b,b,c,d);
    }
    const outlets=[],outletColors=[],outletIdx=[];
    function drainageOutlet(s,side,offset) {
      const station=course.sample(s),center=course.at(s,side*offset,.44);
      // The mouth sits flush with the batter of the wall, surrounded by a thin oxidised collar.
      center.x-=side*station.rx*.035;center.z-=side*station.rz*.035;
      const start=outlets.length/3;
      for(let k=0;k<12;k++){
        const a=2*Math.PI*k/12,px=Math.cos(a),py=Math.sin(a);
        for(const [radius,shade,depth] of [[.079,.105,0],[.058,.025,-.005],[.047,.009,.01]]){
          const along=px*radius,up=py*radius,across=side*(up*.34+depth);
          outlets.push(center.x+station.fx*along+station.rx*across,center.y+up,center.z+station.fz*along+station.rz*across);
          outletColors.push(shade*.91,shade,shade*.89);
        }
      }
      for(let k=0;k<12;k++){
        const a=start+3*k,b=start+3*((k+1)%12);
        outletIdx.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2);
        if(k>0&&k<11)outletIdx.push(start+2,a+2,b+2);
      }
    }
    const spans=[[114,213],[314,405],[638,745],[857,952],[1217,1315],[1446,1505],[1620,1734],[1837,1925],[2160,2274],[2634,2742],[2894,2999]];
    const walls=[],offset=7.5;
    for(const [start,end] of spans){
      const mid=(start+end)/2,L=course.at(mid,-23),R=course.at(mid,23);
      const side=groundAt(L.x,L.z)>groundAt(R.x,R.z)?-1:1;
      walls.push({start,end,side,offset});
      const first=pos.length/3,capStart=cap.length/3,earthStart=earth.length/3;
      const n=Math.ceil((end-start)/2.8);
      for(let j=0;j<=n;j++){
        const t=j/n,s=mix(start,end,t),ramp=Math.min(1,Math.min(j,n-j)*.17);
        const height=(2.3+1.1*Math.sin(s*.008+1)**2)*ramp;
        const foot=course.at(s,side*offset,-.7),shoulder=course.at(s,side*offset,.02);
        foot.y=Math.min(foot.y,forestFloor.drawnHeight(foot.x,foot.z)-.16);
        const head=course.at(s,side*(offset+height*.34));
        const endGrade=forestFloor.drawnHeight(head.x,head.z)-.12;
        head.y=mix(endGrade,shoulder.y+height,smooth(0,.85,ramp));
        pos.push(...foot.toArray(),...head.toArray());uv.push(s/3.6,0,s/3.6,(head.y-foot.y)/3.6);
        const damp=.70+.17*Math.sin(s*.159)*Math.cos(s*.047);
        faceColors.push(damp*.9,damp,damp*.88,.92,.95,.87);
        if(j%5===2&&ramp>.75)drainageOutlet(s,side,offset+.42*.34);
        const heel=offset+.28+height*.34;
        const lip=course.at(s,side*heel);lip.y=head.y-.035;
        const top=head.clone();top.y+=.055;
        cap.push(...head.toArray(),...top.toArray(),...lip.toArray());
        capUV.push(s/1.8,0,s/1.8,.032,s/1.8,.19);
        // Carry fill down to the drawn terrain. Shorten the bank if another
        // leg of a hairpin doubles back into its footprint.
        let reach=5.8;
        for(let d=1;d<=6;d++){
          const test=course.at(s,side*(heel+d)),next=course.nearest(test.x,test.z);
          if(Math.abs(next.s-s)>20 && next.distance<course.half+1.6){reach=Math.max(.8,d-1);break;}
        }
        for(const fraction of [0,.32,.68,1]){
          const point=course.at(s,side*(heel+reach*fraction));
          const base=forestFloor.drawnHeight(point.x,point.z)-.09;
          point.y=mix(lip.y-.018,base,smooth(0,1,fraction));
          earth.push(...point.toArray());earthUV.push(point.x/3.8,point.z/3.8);
          const tint=.28+.11*fraction+.037*Math.sin(s*.27+fraction*.7);
          soilColors.push(tint*.91,tint,tint*.82);
        }
        if(j<n){
          const k=first+2*j,m=capStart+3*j,b=earthStart+4*j;
          idx.push(k,k+1,k+2,k+1,k+3,k+2);
          strip(capIdx,m,3,side);strip(capIdx,m+1,3,side);
          for(let a=0;a<3;a++)strip(earthIdx,b+a,4,side);
        }
      }
    }
    const wall=new T.Mesh(geometry(pos,idx,uv,faceColors),stone);
    const concrete=new T.TextureLoader().load(window.TougeArtURLs?.['roadside-concrete.webp']||'assets/art/roadside-concrete.webp');
    concrete.wrapS=concrete.wrapT=T.RepeatWrapping;concrete.colorSpace=T.SRGBColorSpace;concrete.anisotropy=8;
    const coping=new T.Mesh(geometry(cap,capIdx,capUV),new T.MeshStandardMaterial({
      color:0xa0a497,map:concrete,bumpMap:concrete,bumpScale:.009,roughness:.87,side:T.DoubleSide}));
    const bank=geometry(earth,earthIdx,earthUV,soilColors),bankVertices=bank.attributes.position.count;
    bank.setAttribute('rim',new T.BufferAttribute(new Float32Array(bankVertices),1));
    bank.setAttribute('grassCover',new T.BufferAttribute(new Float32Array(bankVertices),1));
    forestFloor.fill=bank;
    const fill=new T.Mesh(bank,forestFloor.bankMaterial);
    const drains=new T.Mesh(geometry(outlets,outletIdx,null,outletColors),new T.MeshStandardMaterial({vertexColors:true,roughness:.74,side:T.DoubleSide}));
    wall.name='Mossy retaining masonry';coping.name='Retaining wall coping';drains.name='Wall drainage outlets';
    fill.name='Forested retaining banks';
    for(const m of [wall,coping,fill,drains]){m.receiveShadow=true;m.castShadow=m!==drains;scene.add(m);}
    return walls;
  }
  function discTexture(){
    return texture(96,96,(c,w,h)=>{const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);
      g.addColorStop(0,'rgba(255,255,255,.96)');g.addColorStop(.48,'rgba(255,255,255,.69)');g.addColorStop(1,'rgba(255,255,255,0)');
      c.fillStyle=g;c.fillRect(0,0,w,h);});
  }
  function chassisShadow(width,length,axles){
    return texture(192,384,(ctx,w,h)=>{
      const image=ctx.createImageData(w,h);
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const x=((i+.5)/w-.5)*width,z=(.5-(j+.5)/h)*length-.035;
        // The low underfloor cuts off skylight across the sill. At the tread,
        // ambient contact tightens to a short, much denser elliptical foot.
        const floor=.72*Math.exp(-1.9*((x/.96)**4+(z/2.10)**6));
        let contact=0;
        for(const [axle,track] of [[axles.front,axles.frontTrack],[axles.rear,axles.rearTrack]])
          contact+=.89*Math.exp(-1.7*(((Math.abs(x)-track)/.238)**2+((z-axle)/.35)**2));
        const p=(j*w+i)*4;image.data[p]=image.data[p+1]=image.data[p+2]=255;
        image.data[p+3]=Math.round(255*Math.min(.96,floor+contact*(1-floor)));
      }
      ctx.putImageData(image,0,0);
    });
  }
  // A brake reflection and a contact shadow belong to the asphalt, even as
  // the body rolls. Project their vertices onto the bank and shoulder.
  class GroundPatch {
    constructor(scene,material,width,length,offsetX,offsetZ,rows) {
      this.local=[];
      const idx=[],uv=[],cols=3;
      for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
        const u=col/(cols-1),v=row/(rows-1);
        this.local.push([offsetX+(u-.5)*width,offsetZ+(v-.5)*length]);
        uv.push(u,v);
        if(col<cols-1 && row<rows-1){
          const i=row*cols+col;
          idx.push(i,i+cols,i+1,i+1,i+cols,i+cols+1);
        }
      }
      const geo=new T.BufferGeometry();
      this.position=new T.BufferAttribute(new Float32Array(this.local.length*3),3).setUsage(T.DynamicDrawUsage);
      geo.setAttribute('position',this.position);
      geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      geo.setIndex(idx);
      this.mesh=new T.Mesh(geo,material);
      this.mesh.frustumCulled=false;
      this.mesh.renderOrder=-2;
      scene.add(this.mesh);
    }
    update(x,z,sin,cos,index,roadHeight) {
      for(let i=0;i<this.local.length;i++){
        const [across,back]=this.local[i];
        const px=x+cos*across-sin*back,pz=z+sin*across+cos*back;
        this.position.setXYZ(i,px,roadHeight(px,pz,index)+.009,pz);
      }
      this.position.needsUpdate=true;
    }
  }
  class TireEffects {
    constructor(scene){
      this.lastContacts=[new T.Vector3(),new T.Vector3()];this.connected=false;this.mark=0;
      this.positions=new Float32Array(720*6*3);
      const geo=new T.BufferGeometry();this.attribute=new T.BufferAttribute(this.positions,3).setUsage(T.DynamicDrawUsage);
      geo.setAttribute('position',this.attribute);
      this.skids=new T.Mesh(geo,new T.MeshBasicMaterial({color:0x141825,transparent:true,opacity:.58,depthWrite:false,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3}));
      this.skids.frustumCulled=false;this.skids.renderOrder=-1;scene.add(this.skids);
      const smokeTex=texture(96,96,(c,w,h)=>{
        const rand=rng(42);for(let i=0;i<46;i++){const a=rand()*Math.PI*2,rad=rand()*24,x=48+Math.sin(a)*rad,y=48+Math.cos(a)*rad,s=12+rand()*12;
          const g=c.createRadialGradient(x,y,0,x,y,s);g.addColorStop(0,'rgba(218,224,230,.19)');g.addColorStop(1,'rgba(218,224,230,0)');c.fillStyle=g;c.fillRect(x-s,y-s,s*2,s*2);}
      });
      this.pool=Array.from({length:34},()=>{const sprite=new T.Sprite(new T.SpriteMaterial({map:smokeTex,transparent:true,depthWrite:false,opacity:0,rotation:Math.random()*3}));scene.add(sprite);sprite.visible=false;return {sprite,life:2};});
      this.particle=0;this.timer=0;
    }
    cut(){this.connected=false;this.timer=0;for(const p of this.pool)p.sprite.visible=false;}
    clear(){this.positions.fill(0);this.attribute.needsUpdate=true;this.mark=0;this.cut();}
    update(dt,car,contacts,eye,water){
      for(const p of this.pool)if(p.sprite.visible){
        p.life+=dt;p.sprite.visible=p.life<1.05;
        p.sprite.position.x+=p.dx*dt;p.sprite.position.z+=p.dz*dt;p.sprite.position.y+=dt*(.7+p.life*.48);
        const nearCamera=smooth(.5,1.55,p.sprite.position.distanceTo(eye));
        p.sprite.material.opacity=p.power*nearCamera*smooth(0,.10,p.life)*Math.max(0,1-p.life/1.05)*.40;
        p.sprite.scale.setScalar(.38+p.life*1.95);
      }
      this.timer+=dt;
      if(car.slip<.21||car.kmh<23){this.connected=false;return;}
      if(this.timer<.034)return;
      this.timer%=.034;
      if(this.connected)for(let i=0;i<2;i++){
        const old=this.lastContacts[i],v=contacts[i+2],dx=v.x-old.x,dz=v.z-old.z,len=Math.hypot(dx,dz);
        if(len<.03||len>7)continue;
        const wx=-dz/len*.075,wz=dx/len*.075;
        const y0=old.y+.014,y1=v.y+.014;
        this.positions.set([old.x-wx,y0,old.z-wz,old.x+wx,y0,old.z+wz,v.x-wx,y1,v.z-wz,
          old.x+wx,y0,old.z+wz,v.x+wx,y1,v.z+wz,v.x-wx,y1,v.z-wz],this.mark*18);
        this.mark=(this.mark+1)%720;this.attribute.needsUpdate=true;
      }
      this.lastContacts[0].copy(contacts[2]);this.lastContacts[1].copy(contacts[3]);this.connected=true;
      const p=this.pool[this.particle++%this.pool.length],v=contacts[2+this.particle%2];
      p.sprite.position.copy(v);p.sprite.position.y+=.12;
      p.dx=Math.sin(car.travel)*car.speed*.12+.16;p.dz=-Math.cos(car.travel)*car.speed*.12;
      p.life=0;p.power=car.slip*(1-.76*water);p.sprite.scale.setScalar(.38);
      p.sprite.material.opacity=0;p.sprite.visible=true;
    }
  }
  class World {
    constructor(canvas,course){
      this.course=course;this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
      this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.04;
      this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
      this.scene=new T.Scene();this.scene.background=new T.Color(0x899da6);this.scene.fog=new T.FogExp2(0x596d74,.00215);
      this.camera=new T.PerspectiveCamera(60,1,.35,2350);this.camera.rotation.order='YXZ';
      this.cameraMode=0;this.viewHeading=0;this.look=new T.Vector3();this.targetPos=new T.Vector3();
      this.reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.sky=TougeLighting.makeSky(this.scene,this.renderer);
      this.sun=TougeLighting.makeSun(this.scene,innerWidth<760?1024:2048);
      const groundAt=landHeight(course),forestFloor=addTerrain(this.scene,course,groundAt,this.sky);
      this.wetRoad=new TougeWetRoad(this.renderer,forestFloor);
      this.roadHeight=addRoad(this.scene,course,groundAt,this.wetRoad);
      this.walls=addRetainingWalls(this.scene,course,groundAt,forestFloor);
      window.addRockCuts(this.scene,course,forestFloor,groundAt);
      this.forest=window.addForest(this.scene,course,groundAt,forestFloor,this.walls);
      this.roadside=window.addRoadside(this.scene,course);
      this.rig=new T.Group();this.rig.rotation.order='YXZ';this.scene.add(this.rig);
      this.car=TougeNeo86.create();this.rig.add(this.car.group);
      TougeCarOcclusion.install(this.car);
      this.carLighting=TougePassReflections.install(this.car.group,course);
      this.parkedStation=NaN;this.parkedMap=null;this.probeCenter=new T.Vector3();
      const {front,rear,frontTrack,rearTrack,radius}=this.car.axles;
      this.rollingScale=TougeDrive.rollingRadius/radius;
      this.wheelLocations=[[-frontTrack,front],[frontTrack,front],[-rearTrack,rear],[rearTrack,rear]];
      this.wheelContacts=this.wheelLocations.map(()=>new T.Vector3());
      this.legOffsets=new Float32Array(4);
      this.bodyRoll=0;this.bodyPitch=0;
      const map=discTexture();
      const shade=new T.MeshBasicMaterial({map:chassisShadow(2.52,4.84,this.car.axles),color:0x10151a,transparent:true,opacity:.85,
        depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
      this.groundPatches=[new GroundPatch(this.scene,shade,2.52,4.84,0,-.035,7)];
      this.tailReflection=new T.MeshBasicMaterial({map,color:0xfb4222,transparent:true,opacity:.095,
        depthWrite:false,blending:T.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-2});
      for(const side of [-1,1]){
        const light=new T.SpotLight(0xffe7be,82,45,.39,.61,1.55);
        light.position.set(side*.595,.639,-2.079);light.target.position.set(side*.81,-.7,-24);
        this.car.body.add(light,light.target);
        this.groundPatches.push(new GroundPatch(this.scene,this.tailReflection,.75,1.72,side*.635,2.33,3));
      }
      this.effects=new TireEffects(this.scene);this.spray=new TougeTireSpray(this.scene,this.wetRoad);
      this.shake=0;this.elapsed=0;this.cameraReady=false;
      this.scale=window.devicePixelRatio||1;this.slowTime=0;this.fastTime=0;
      this.resize();
    }
    resize(){
      const w=window.innerWidth,h=window.innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
      this.maxScale=Math.min(window.devicePixelRatio||1,w<760?1.45:1.75);
      this.scale=Math.min(this.scale,this.maxScale);
      this.renderer.setPixelRatio(this.scale);this.renderer.setSize(w,h,false);
    }
    reset(){this.effects.clear();this.spray.clear();this.cameraReady=false;this.shake=0;this.lastX=NaN;}
    cycleCamera(){this.cameraMode=(this.cameraMode+1)%3;this.cameraReady=false;return ['Chase','Low chase','Bonnet'][this.cameraMode];}
    wallReflection(contact,heading){
      const wall=this.walls.find(w=>contact.s>=w.start && contact.s<=w.end);
      if(!wall)return null;
      const facing=this.cameraMode===2?heading:this.viewHeading;
      return {
        side:wall.side*Math.cos(facing-contact.heading),
        distance:Math.abs(wall.side*wall.offset-contact.offset),
        amount:smooth(0,12,Math.min(contact.s-wall.start,wall.end-contact.s))
      };
    }
    plantWheels(c) {
      if(c.x===this.lastX && c.z===this.lastZ && c.heading===this.lastHeading)return;
      this.lastX=c.x;this.lastZ=c.z;this.lastHeading=c.heading;
      const sin=Math.sin(c.heading),cos=Math.cos(c.heading),index=c.contact.i;
      const pads=this.wheelContacts;
      for(let i=0;i<4;i++){
        const [across,back]=this.wheelLocations[i];
        const x=c.x+cos*across-sin*back,z=c.z+sin*across+cos*back;
        pads[i].set(x,this.roadHeight(x,z,index),z);
      }
      const frontY=(pads[0].y+pads[1].y)*.5,rearY=(pads[2].y+pads[3].y)*.5;
      const {front,rear,frontTrack,rearTrack}=this.car.axles;
      this.forwardGrade=(frontY-rearY)/(rear-front);
      this.rightGrade=((pads[1].y-pads[0].y)/frontTrack+(pads[3].y-pads[2].y)/rearTrack)*.25;
      const pitch=Math.atan(this.forwardGrade);
      const roll=Math.atan(this.rightGrade*Math.cos(pitch));
      const groundY=frontY+front*this.forwardGrade;
      this.rig.position.set(c.x,groundY+.002,c.z);
      this.rig.rotation.set(pitch,-c.heading,roll,'YXZ');
      const normalY=Math.cos(pitch)*Math.cos(roll);
      for(let i=0;i<4;i++){
        const [across]=this.wheelLocations[i];
        const support=(i<2?frontY:rearY)+this.rightGrade*across;
        this.legOffsets[i]=(pads[i].y-support)/normalY;
      }
      for(const patch of this.groundPatches)patch.update(c.x,c.z,sin,cos,index,this.roadHeight);
    }
    positionChase(dt,c,cut) {
      const p=c.contact,low=this.cameraMode===1,speed=this.viewSpeed;
      const drift=c.speed>0?clamp(wrap(c.heading-c.travel),-1.1,1.1)*smooth(2,9,speed):0;
      const desired=wrap(c.heading-drift*(low?.62:.76));
      this.viewHeading=cut?desired:wrap(this.viewHeading+wrap(desired-this.viewHeading)*(1-Math.exp(-dt*7.2)));
      const fx=Math.sin(this.viewHeading),fz=-Math.cos(this.viewHeading);
      const portrait=1-smooth(.53,1.04,this.camera.aspect);
      const sideView=Math.abs(Math.sin(c.heading-this.viewHeading));
      const framing=portrait*((low?1.85:1.15)+2.95*sideView);
      const arm=(low?4.75:5.95)+Math.min(44,speed)*.024+framing;
      // Keep translation locked to the interpolated car. Only the boom's
      // azimuth, elevation and lens ease; uneven frames cannot move the car
      // toward/away from an independently filtered world-space camera.
      const eye=this.targetPos;
      eye.set(c.x-fx*arm,0,c.z-fz*arm);
      const center=this.course.nearest(eye.x,eye.z,p.i);
      const railLimit=this.course.half+.34;
      const overflow=center.offset-clamp(center.offset,-railLimit,railLimit);
      eye.x-=center.rx*overflow;eye.z-=center.rz*overflow;
      const across=(eye.x-c.x)*p.rx+(eye.z-c.z)*p.rz;
      const along=(eye.x-c.x)*p.fx+(eye.z-c.z)*p.fz;
      const short=(low?3.8:4.45)+framing;
      if(across*across+along*along<short*short){
        const sign=along>.1?1:-1;
        const shift=sign*Math.sqrt(Math.max(0,short*short-across*across))-along;
        eye.x+=p.fx*shift;eye.z+=p.fz*shift;
        const shifted=this.course.nearest(eye.x,eye.z,p.i);
        const excess=shifted.offset-clamp(shifted.offset,-railLimit,railLimit);
        eye.x-=shifted.rx*excess;eye.z-=shifted.rz*excess;
      }
      const ground=this.roadHeight(eye.x,eye.z,p.i),y=this.rig.position.y;
      const rise=ground-y+(low?1.43:2.39)+Math.min(40,speed)*.009;
      this.viewRise=cut?rise:mix(this.viewRise,rise,1-Math.exp(-dt*8.5));
      eye.y=Math.max(y+this.viewRise,ground+(low?.98:1.38));
      this.camera.position.copy(eye);
      const forward=fx*p.fx+fz*p.fz>=0?1:-1;
      const ahead=this.course.sample(p.s+forward*(12+Math.min(23,speed*.5)));
      const nominalAim=this.viewHeading+clamp(wrap(ahead.heading-p.heading),-.9,.9)*.115;
      const boomHeading=Math.atan2(c.x-eye.x,eye.z-c.z);
      const aim=boomHeading+clamp(wrap(nominalAim-boomHeading),-.16,.16);
      const relative=wrap(aim-c.heading);
      const grade=this.forwardGrade*Math.cos(relative)+this.rightGrade*Math.sin(relative);
      this.viewGrade=cut?grade:mix(this.viewGrade,grade,1-Math.exp(-dt*6));
      this.look.set(c.x+Math.sin(aim)*11,y+1.08+this.viewGrade*11,c.z-Math.cos(aim)*11);
    }
    positionWalkaround(view){
      const distance=5.85/view.zoom,flat=distance*Math.cos(view.pitch);
      this.rig.localToWorld(this.targetPos.set(Math.sin(view.yaw)*flat,.61+distance*Math.sin(view.pitch),-Math.cos(view.yaw)*flat));
      this.rig.localToWorld(this.look.set(0,.61,-.025));
      this.camera.position.copy(this.targetPos);
    }
    render(dt,c,simulate,walkaround=null){
      this.elapsed+=dt;
      this.car.setDisplayMode(!!walkaround);
      const placed=c.placementId!==this.placementId,cut=!this.cameraReady||placed||!!walkaround;
      if(placed){this.placementId=c.placementId;this.effects.cut();this.spray.clear();this.shake=0;}
      this.plantWheels(c);
      const rightG=c.lateralG??c.yaw*c.speed/9.81;
      const targetRoll=clamp(rightG,-1.25,1.25)*.032;
      const targetPitch=clamp(c.longitudinalG??0,-1.3,1.15)*.021;
      this.bodyRoll=cut?targetRoll:mix(this.bodyRoll,targetRoll,1-Math.exp(-dt*11));
      this.bodyPitch=cut?targetPitch:mix(this.bodyPitch,targetPitch,1-Math.exp(-dt*10));
      const brake=clamp(Math.max(c.brake||0,c.handbrake?.72:0),0,1);
      this.car.setMotion({wheelAngle:c.wheelAngle*this.rollingScale,rearWheelAngle:c.rearWheelAngle*this.rollingScale,
        steer:-(c.steerAngle??c.wheel*.44),brake,bodyRoll:this.bodyRoll,bodyPitch:this.bodyPitch,
        suspensionOffsets:this.legOffsets});
      this.tailReflection.opacity=.027+.075*brake;
      const speed=Math.abs(c.speed);
      this.viewSpeed=cut?speed:mix(this.viewSpeed,speed,1-Math.exp(-dt*3.9));
      const bonnet=!walkaround && this.cameraMode===2;
      if(walkaround)this.positionWalkaround(walkaround);
      else if(bonnet){
        // Place the lens just forward of the windshield in the sprung frame.
        // The cowl/bonnet remain below the near plane through roll and pitch.
        this.car.body.localToWorld(this.targetPos.set(.15,1.085,-.83));
        this.car.body.localToWorld(this.look.set(.15,.545,-30));
        this.camera.position.copy(this.targetPos);
      }else this.positionChase(dt,c,cut);
      this.cameraReady=true;
      this.camera.lookAt(this.look);
      this.shake=Math.max(0,this.shake-dt*2.8);
      if(!walkaround && !this.reducedMotion){
        this.camera.rotateZ(Math.sin(this.elapsed*43)*this.shake*.008-this.bodyRoll*(bonnet?.8:.12));
      }
      const baseFov=walkaround?31:(bonnet?70:this.cameraMode===1?60:59)+Math.min(7,this.viewSpeed*.16);
      const minHorizontal=walkaround?52:bonnet?53:(this.cameraMode===1?50:46);
      const portraitFov=2*Math.atan(Math.tan(T.MathUtils.degToRad(minHorizontal*.5))/this.camera.aspect);
      const fov=Math.max(baseFov,Math.min(94,T.MathUtils.radToDeg(portraitFov)));
      const near=(walkaround || bonnet) ? .09 : .35;
      if(Math.abs(fov-this.camera.fov)>.0005 || near!==this.camera.near){
        this.camera.fov=fov;this.camera.near=near;this.camera.updateProjectionMatrix();
      }
      if(simulate){
        this.spray.update(dt,c,this.wheelContacts,this.camera.position);
        this.effects.update(dt,c,this.wheelContacts,this.camera.position,this.spray.wetness);
      }
      this.sky.position.copy(this.camera.position);
      TougeLighting.trackSun(this.sun,c.x,this.rig.position.y,c.z,c.contact.fx,c.contact.fz);
      this.carLighting.update(c.contact.s);
      this.forest?.userData.update?.(this.camera.position);
      this.roadside?.userData.updateView?.(this.renderer,this.camera,this.elapsed);
      if(walkaround && (Number.isNaN(this.parkedStation)||Math.abs(this.parkedStation-c.contact.s)>3)){
        this.parkedMap?.dispose();
        this.rig.localToWorld(this.probeCenter.set(0,.98,.08));
        this.parkedMap=TougePassReflections.captureParked(this,this.probeCenter);
        this.parkedStation=c.contact.s;
      }
      this.carLighting.setParked(walkaround?this.parkedMap?.texture||null:null,this.probeCenter);
      this.wetRoad.update(this.renderer,this.scene,this.camera,c,this.sky,dt,cut,this.scale);
      this.renderer.render(this.scene,this.camera);
    }
    measureFrame(dt) {
      if(dt>.043){this.slowTime+=Math.min(dt,.1);this.fastTime=0;}
      else {
        this.slowTime=Math.max(0,this.slowTime-dt*.65);
        this.fastTime=dt<.0195?Math.min(8,this.fastTime+dt):Math.max(0,this.fastTime-dt*2);
      }
      if(this.slowTime>2.4 && this.scale>.76){
        this.scale=Math.max(.75,this.scale*.82);this.slowTime=0;this.resize();
      }else if(this.fastTime>=8 && this.scale<this.maxScale-.001){
        this.scale=Math.min(this.maxScale,this.scale*1.12);this.fastTime=0;this.resize();
      }
    }
  }
  window.TougeWorld=World;
})();
