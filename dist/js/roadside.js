/* Static roadside furniture. Geometry is collected by course section and material. */
(() => {
  "use strict";
  const T = window.THREE;
  const UP = new T.Vector3(0, 1, 0);
  const Z = new T.Vector3(0, 0, 1);
  const TAU = 2 * Math.PI;
  const colorCache = new Map();
  const artUrl = name => window.TougeArtURLs?.[name] || "assets/art/" + name;
  function rgb(value) {
    let result = colorCache.get(value);
    if (!result) { result = new T.Color(value); colorCache.set(value, result); }
    return result;
  }

  function makeAtlas() {
    const canvas = document.createElement("canvas");
    canvas.width = 2048; canvas.height = 1024;
    const c = canvas.getContext("2d");
    const regions = {};
    const font = '"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,Arial,sans-serif';
    let seed=43975;
    const noise=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    function art(key, x, y, w, h, draw) {
      c.save(); c.translate(x, y);
      c.beginPath(); c.rect(0, 0, w, h); c.clip();
      c.lineJoin = "round"; c.lineCap = "round";
      draw(w, h);
      // Screen printing and road grit sit on the enamel. Work inside the
      // existing alpha, including on the borders of circular signs.
      c.globalCompositeOperation="source-atop";
      const dirt=c.createLinearGradient(0,0,0,h);
      dirt.addColorStop(0,"rgba(18,21,18,.045)");dirt.addColorStop(.78,"rgba(18,21,18,0)");
      dirt.addColorStop(1,"rgba(43,34,22,.19)");
      c.fillStyle=dirt;c.fillRect(0,0,w,h);
      for(let i=0;i<w*h/130;i++){
        const px=noise()*w,py=noise()*h;
        c.fillStyle=noise()>.5?"rgba(32,36,30,.13)":"rgba(250,245,218,.13)";
        c.fillRect(px,py,.5+noise()*1.4,.45+noise()*.65);
      }
      c.restore();
      regions[key] = [(x + 1) / canvas.width, 1 - (y + h - 1) / canvas.height,
        (x + w - 1) / canvas.width, 1 - (y + 1) / canvas.height];
    }
    function label(value, x, y, size, fill = "#f6f7ed", align = "left", width) {
      c.font = "bold " + size + "px " + font;
      c.textBaseline = "middle"; c.textAlign = align; c.fillStyle = fill;
      if (width) c.fillText(value, x, y, width); else c.fillText(value, x, y);
    }
    function poly(points, fill, stroke, width = 1) {
      c.beginPath();
      points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y));
      c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    function shield(x, y, size) {
      const shape = [[-.46,-.48],[.46,-.48],[.63,0],[.46,.46],[-.46,.46],[-.63,0]];
      poly(shape.map(([a,b])=>[x + a * size, y + b * size]), "#0b5a93", "#f2f3df", size * .045);
      label("県 道", x, y - size * .28, size * .17, "#fbf3db", "center");
      label("33", x, y + size * .07, size * .64, "#f9f7e9", "center");
    }
    function guide(jp, en, bottom) {
      return (w, h) => {
        const g = c.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, "#124f8a"); g.addColorStop(1, "#06396d");
        c.fillStyle = g; c.fillRect(0, 0, w, h);
        c.strokeStyle = "#e8efe4"; c.lineWidth = 6; c.strokeRect(10, 10, w - 20, h - 20);
        shield(86, h * .43, 90);
        label(jp, 161, 89, 64, "#f8f5e9", "left", 365);
        label(en, 164, 153, 36, "#f3f5e9", "left", 355);
        c.fillStyle = "#d8e9e4"; c.fillRect(160, 190, 350, 3);
        label(bottom, 163, 225, 24, "#d9eaf0");
        poly([[565,181],[565,108],[539,108],[582,53],[626,108],[599,108],[599,181]], "#f6f7ee");
      };
    }
    art("spa", 8, 8, 665, 274, guide("伊香保温泉", "Ikaho Onsen", "渋川方面   SHIBUKAWA"));
    art("valley", 692, 8, 665, 274, guide("渋川市街", "Shibukawa", "市街方面   CITY CENTER"));
    art("ridge", 1375, 8, 665, 274, guide("榛名峠", "Haruna Pass", "下り坂   DOWNHILL"));
    art("chevron", 8, 302, 242, 152, (w,h) => {
      c.fillStyle = "#eac653"; c.fillRect(0,0,w,h);
      c.strokeStyle = "#382e29"; c.lineWidth = 7; c.strokeRect(6,6,w-12,h-12);
      for (const left of [24,123]) poly([[left,18],[left+47,18],[left+95,76],[left+47,134],[left,134],[left+50,76]], "#292d2e");
    });
    art("shield", 545, 302, 187, 167, (w,h) => shield(w/2,h/2,141));
    art("limit", 746, 302, 176, 176, w => {
      c.beginPath(); c.arc(w/2,w/2,w/2-2,0,Math.PI*2); c.fillStyle="#cb4a42"; c.fill();
      c.beginPath(); c.arc(w/2,w/2,w/2-16,0,Math.PI*2); c.fillStyle="#eee8d7"; c.fill();
      label("40",w/2,w*.53,92,"#234668","center");
    });
    art("turn", 940, 302, 176, 176, (w,h) => {
      poly([[88,2],[174,88],[88,174],[2,88]],"#eac450");
      poly([[88,10],[166,88],[88,166],[10,88]],null,"#312e2b",4);
      c.lineWidth = 14; c.strokeStyle = "#302e2b"; c.beginPath(); c.moveTo(68,134); c.lineTo(68,112);
      c.bezierCurveTo(68,94,115,101,114,75); c.bezierCurveTo(113,61,91,62,84,55); c.stroke();
      poly([[73,76],[62,39],[99,42]],"#302e2b");
    });
    art("plaque", 1132, 302, 90, 228, (w,h) => {
      c.fillStyle="#303736"; c.fillRect(0,0,w,h); c.strokeStyle="#af8c50";c.lineWidth=5;c.strokeRect(4,4,w-8,h-8);
      ["榛","名","社"].forEach((v,i)=>label(v,w/2,47+i*65,49,"#e1c588","center"));
    });
    art("vend", 1240, 302, 250, 510, (w,h) => {
      c.fillStyle="#aa463d"; c.fillRect(0,0,w,h);
      c.fillStyle="#38424a"; c.fillRect(13,20,w-26,296);
      c.fillStyle="#b9d7d2"; c.fillRect(20,26,w-40,278);
      const cans=["#b4d4db","#d77f59","#384f72","#c8be76","#7b9b7a","#e5dfc9","#9b413b"];
      for(let row=0;row<3;row++){
        for(let col=0;col<7;col++){
          const x=27+col*28,y=47+row*82;
          c.fillStyle=cans[(col+row*2)%cans.length];c.fillRect(x,y,19,44);
          c.fillStyle="#e5e2d5";c.fillRect(x+2,y-3,15,4);c.fillRect(x+2,y+12,14,7);
          c.fillStyle="#bdcbbe";c.fillRect(x+1,y+44,17,3);
          c.fillStyle="#31434f";c.fillRect(x-1,y+58,23,8);c.fillStyle="#dbb567";c.fillRect(x+8,y+59,5,4);
        }
        c.fillStyle="#e8e2c9";c.fillRect(22,143+row*82,205,4);
      }
      label("つめたい",19,346,22,"#f2ddc4");
      c.fillStyle="#573e3a";c.fillRect(163,330,61,104);c.fillStyle="#c6b69e";c.fillRect(173,341,40,14);
      c.fillStyle="#633b36";c.fillRect(31,446,181,39);c.fillStyle="#2b3435";c.fillRect(38,451,167,23);
    });
    art("vertical", 1510,302,138,338,(w,h)=>{
      c.fillStyle="#eed7a4";c.fillRect(0,0,w,h);c.strokeStyle="#78453d";c.lineWidth=6;c.strokeRect(6,6,w-12,h-12);
      ["と","う","ふ"].forEach((v,i)=>label(v,w/2,56+105*i,80,"#403f3b","center"));
    });
    art("shop", 8, 582, 962, 185, (w,h) => {
      const g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,"#ead9b6");g.addColorStop(.5,"#f6e7c9");g.addColorStop(1,"#c7ac83");
      c.fillStyle=g;c.fillRect(0,0,w,h);c.strokeStyle="#806449";c.lineWidth=7;c.strokeRect(4,4,w-8,h-8);
      c.fillStyle="#9b4838";c.fillRect(28,28,114,127);label("豆",86,94,78,"#f1ddb4","center");
      label("藤原とうふ店",171,78,87,"#373b39","left",745);
      label("自 家 製   ・   F U J I W A R A   T O F U",176,147,25,"#595247");
    });
    art("noren", 8, 789, 520, 156, (w,h) => {
      const symbols=["手","造","り","豆","腐"];
      for(let i=0; i<5; i++){
        c.fillStyle=i%2?"#344956":"#3b505f";c.fillRect(i*104,0,102,h-2);
        c.fillStyle="#63717a";c.fillRect(i*104+4,5,3,h-9);
        label(symbols[i],i*104+53,76,57,"#d7cfb4","center");
      }
    });
    art("summit",987,818,655,196,(w,h)=>{
      c.scale(w/665,h/274);
      guide("榛名湖","Lake Haruna","峠方面   SUMMIT")(665,274);
    });
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    new T.ImageLoader().load(artUrl("roadside-vending.webp"), vendPhoto => {
      c.drawImage(vendPhoto,1240,302,250,510);
      texture.needsUpdate = true;
    });
    return {regions, texture};
  }

  // Local x points right across the road; local +z faces approaching traffic.
  function frame(course, s, offset, angle = 0) {
    const p = course.sample(s), center = course.at(s, offset, 0), a = p.heading + angle;
    const cs = Math.cos(a), sn = Math.sin(a);
    return (x,y,z) => new T.Vector3(center.x + cs*x - sn*z, center.y + y, center.z + sn*x + cs*z);
  }

  class Batch {
    constructor(withUV = false) {
      this.positions = []; this.colors = []; this.indices = []; this.uv = withUV ? [] : null;
      this.curved = [];
    }
    face(vertices, shade, uv, smoothNormals) {
      const base = this.positions.length/3, col = rgb(shade);
      if(this.uv && !uv) {
        // Metric texture coordinates follow the surface, including a tilted
        // roof or a rotated flange. Ordinary upright box faces keep vertical grain.
        const a=vertices[0],u=vertices[1].clone().sub(a).normalize();
        const n=vertices[vertices.length-1].clone().sub(a);
        const v=n.addScaledVector(u,-n.dot(u)).normalize();
        uv=vertices.map(p=>{const d=p.clone().sub(a);return [d.dot(u),d.dot(v)];});
      }
      vertices.forEach((v,i) => {
        this.positions.push(v.x, v.y, v.z); this.colors.push(col.r,col.g,col.b);
        if (this.uv) this.uv.push(uv[i][0], uv[i][1]);
        if (smoothNormals) this.curved.push(base+i,smoothNormals[i].x,smoothNormals[i].y,smoothNormals[i].z);
      });
      for (let i=1; i<vertices.length-1; i++) this.indices.push(base,base+i,base+i+1);
    }
    box(f, x, y, z, w, h, d, color) {
      const a=x-w/2,b=x+w/2,l=y-h/2,u=y+h/2,n=z-d/2,v=z+d/2;
      const p=[f(a,l,n),f(b,l,n),f(b,u,n),f(a,u,n),f(a,l,v),f(b,l,v),f(b,u,v),f(a,u,v)];
      for(const sides of [[4,5,6,7],[1,0,3,2],[0,4,7,3],[5,1,2,6],[7,6,2,3],[0,1,5,4]]) {
        this.face(sides.map(i=>p[i]),color);
      }
    }
    tube(a,b,r0,r1,color,sides=7,cap=false,round=true) {
      const axis = b.clone().sub(a).normalize();
      const u = new T.Vector3().crossVectors(axis, Math.abs(axis.y)>.8 ? Z : UP).normalize();
      const v = new T.Vector3().crossVectors(axis,u);
      const lower=[], upper=[], normals=[],length=a.distanceTo(b);
      if(length<1e-6)return;
      for(let i=0;i<sides;i++){
        const t=2*Math.PI*i/sides, rad=u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v,Math.sin(t));
        lower.push(a.clone().addScaledVector(rad,r0)); upper.push(b.clone().addScaledVector(rad,r1));
        normals.push(rad.addScaledVector(axis,(r0-r1)/length).normalize());
      }
      if(round){
        const base=this.positions.length/3,col=rgb(color);
        for(let i=0;i<=sides;i++){
          const k=i%sides,p=lower[k],q=upper[k],n=normals[k],index=base+i*2;
          this.positions.push(p.x,p.y,p.z,q.x,q.y,q.z);
          this.colors.push(col.r,col.g,col.b,col.r,col.g,col.b);
          this.curved.push(index,n.x,n.y,n.z,index+1,n.x,n.y,n.z);
          if(this.uv){const x=TAU*r0*i/sides;this.uv.push(x,0,x,length);}
          if(i<sides)this.indices.push(index,index+2,index+3,index,index+3,index+1);
        }
      }else{
        for(let i=0;i<sides;i++){
          const j=(i+1)%sides,u0=TAU*r0*i/sides,u1=TAU*r0*(i+1)/sides;
          this.face([lower[i],lower[j],upper[j],upper[i]],color,
            this.uv?[[u0,0],[u1,0],[u1,length],[u0,length]]:null);
        }
      }
      if(cap)this.face(upper,color);
      if(cap===true)this.face(lower.reverse(),color);
    }
    panel(f,x,y,z,w,h,region,mirror=false,tint=0xffffff) {
      const [u,b,v,t] = region, left=mirror?v:u, right=mirror?u:v;
      this.face([f(x-w/2,y-h/2,z),f(x+w/2,y-h/2,z),f(x+w/2,y+h/2,z),f(x-w/2,y+h/2,z)],
        tint, [[left,b],[right,b],[right,t],[left,t]]);
    }
    build(material) {
      if (!this.indices.length) return null;
      const geom = new T.BufferGeometry();
      geom.setAttribute("position",new T.Float32BufferAttribute(this.positions,3));
      geom.setAttribute("color",new T.Float32BufferAttribute(this.colors,3));
      if(this.uv) geom.setAttribute("uv",new T.Float32BufferAttribute(this.uv,2));
      geom.setIndex(this.indices);
      if(!material.isMeshBasicMaterial){
        geom.computeVertexNormals();
        const normals=geom.attributes.normal;
        for(let k=0;k<this.curved.length;k+=4){
          normals.setXYZ(this.curved[k],this.curved[k+1],this.curved[k+2],this.curved[k+3]);
        }
      }
      geom.computeBoundingSphere();
      return new T.Mesh(geom,material);
    }
  }

  function makeGlow() {
    const c=document.createElement("canvas"); c.width=64; c.height=64;
    const ctx=c.getContext("2d"), g=ctx.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,"rgba(255,255,255,.8)");g.addColorStop(.18,"rgba(255,255,255,.43)");
    g.addColorStop(.58,"rgba(255,255,255,.085)");g.addColorStop(1,"rgba(255,255,255,0)");
    ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
    return new T.CanvasTexture(c);
  }

  function texturedFinish(filename,roughness,metalness,metres,relief) {
    const material=new T.MeshStandardMaterial({
      vertexColors:true,roughness,metalness,side:T.DoubleSide
    });
    new T.TextureLoader().load(artUrl(filename),map=>{
      map.colorSpace=T.SRGBColorSpace;map.wrapS=map.wrapT=T.RepeatWrapping;
      map.repeat.setScalar(1/metres);map.anisotropy=6;
      material.map=map;material.bumpMap=map;material.bumpScale=relief;
      material.needsUpdate=true;
    });
    return material;
  }

  // Each lens is a spherical cap aimed between the approaching driver and
  // the road beyond the bend. Only the nearest visible lens gets a live
  // local view. Its metal and the distant lenses also reflect the scene IBL.
  function trafficMirrorMaterial() {
    const material=new T.MeshStandardMaterial({
      color:0xe3e9e6,metalness:1,roughness:.115,envMapIntensity:1.05
    });
    const uniforms={
      localImage:{value:null},localReady:{value:0},localOrigin:{value:new T.Vector3()},
      viewRotation:{value:new T.Matrix3()}
    };
    material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader=shader.vertexShader.replace("#include <common>",
        "#include <common>\nvarying vec3 mirrorWorld;")
        .replace("#include <worldpos_vertex>","#include <worldpos_vertex>\nmirrorWorld=(modelMatrix*vec4(transformed,1.0)).xyz;");
      shader.fragmentShader=shader.fragmentShader.replace("#include <common>",
        `#include <common>
          varying vec3 mirrorWorld;
          uniform sampler2D localImage;
          uniform float localReady;
          uniform vec3 localOrigin;
          uniform mat3 viewRotation;`)
        .replace("#include <opaque_fragment>",`
          vec3 mirrorNormal=inverseTransformDirection(normal,viewMatrix);
          vec3 direction=viewRotation*reflect(normalize(mirrorWorld-cameraPosition),mirrorNormal);
          vec2 mirrorUV=.5+.5*direction.xy/(max(.001,-direction.z)*1.96261);
          float border=min(min(mirrorUV.x,1.-mirrorUV.x),min(mirrorUV.y,1.-mirrorUV.y));
          float coverage=localReady*step(length(mirrorWorld-localOrigin),.58)*step(.001,-direction.z)*smoothstep(0.,.09,border);
          vec3 localRadiance=texture2D(localImage,clamp(mirrorUV,0.,1.)).rgb;
          outgoingLight=mix(outgoingLight,localRadiance*vec3(.87,.91,.89),coverage*.94);
          #include <opaque_fragment>`);
    };
    return {material,uniforms};
  }

  function makeLens(profile,centre,axis,region) {
    const across=new T.Vector3().crossVectors(UP,axis).normalize(),up=new T.Vector3().crossVectors(axis,across);
    const radius=.464, sphereRadius=1.14, edge=Math.sqrt(sphereRadius*sphereRadius-radius*radius);
    const dome=new Batch(),rings=[],normals=[];
    const transform=(x,y,z)=>centre.clone().addScaledVector(across,x).addScaledVector(up,y).addScaledVector(axis,z);
    for(let j=0;j<=5;j++){
      const r=radius*j/5,z=Math.sqrt(sphereRadius*sphereRadius-r*r),ring=[],n=[];
      for(let i=0;i<32;i++){
        const t=TAU*i/32,x=r*Math.cos(t),y=r*Math.sin(t);
        ring.push(transform(x,y,z-edge));
        n.push(across.clone().multiplyScalar(x).addScaledVector(up,y).addScaledVector(axis,z).normalize());
      }
      rings.push(ring);normals.push(n);
      if(!j)continue;
      for(let i=0;i<32;i++){
        const k=(i+1)%32;
        if(j===1) dome.face([rings[0][0],ring[i],ring[k]],0xffffff,null,[axis,n[i],n[k]]);
        else dome.face([rings[j-1][i],ring[i],ring[k],rings[j-1][k]],0xffffff,null,
          [normals[j-1][i],n[i],n[k],normals[j-1][k]]);
      }
    }
    const mesh=dome.build(profile.material);mesh.name="Convex traffic mirror";
    mesh.receiveShadow=false;region.add(mesh);
    return {transform,mesh};
  }

  function updateRoadsideView(scene,mirrors,profile,details) {
    const eye=new T.PerspectiveCamera(126,1,.32,380);
    eye.userData.tougeReflectionPass=true;eye.userData.tougeMirrorProbe=true;
    const direction=new T.Vector3(),screen=new T.Vector3();
    let target=null,active=null,previous=-Infinity,updating=false;
    return (renderer,camera,time,night)=>{
      if(updating || camera.userData.tougeReflectionPass || renderer.getRenderTarget())return;
      for(const {mesh,center,nearSq,farSq} of details){
        const distance=center.distanceToSquared(camera.position);
        mesh.visible=distance>=nearSq && distance<farSq;
      }
      camera.updateMatrixWorld();
      const mobile=renderer.domElement.clientWidth<720;
      let nearest=null,closest=(mobile?25:37)**2;
      for(const mirror of mirrors){
        direction.subVectors(camera.position,mirror.centre);
        const d2=direction.lengthSq();
        if(d2>=closest || direction.dot(mirror.face)<.08*Math.sqrt(d2))continue;
        screen.copy(mirror.centre).project(camera);
        if(Math.abs(screen.x)>1.12 || Math.abs(screen.y)>1.12 || screen.z<0 || screen.z>1)continue;
        nearest=mirror;closest=d2;
      }
      const u=profile.uniforms;
      if(!nearest){active=null;u.localReady.value=0;return;}
      if(nearest===active && u.localReady.value && time>=previous && time-previous<(mobile?.32:.16))return;
      if(!target){
        const size=mobile?96:160;
        target=new T.WebGLRenderTarget(size,size,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:true});
        target.texture.colorSpace=T.LinearSRGBColorSpace;
      }
      active=nearest;previous=time;updating=true;
      const before=renderer.getRenderTarget(),shadow=renderer.shadowMap.autoUpdate,xr=renderer.xr.enabled;
      eye.position.copy(active.centre).addScaledVector(active.face,.11);
      eye.lookAt(night?active.uphillLook:active.look);eye.updateMatrixWorld(true);
      u.viewRotation.value.setFromMatrix4(eye.matrixWorldInverse);
      try{
        profile.material.visible=false;renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;
        renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,eye);
        u.localImage.value=target.texture;u.localOrigin.value.copy(active.centre);u.localReady.value=1;
      }finally{
        renderer.setRenderTarget(before);renderer.shadowMap.autoUpdate=shadow;renderer.xr.enabled=xr;
        profile.material.visible=true;updating=false;
      }
    };
  }

  window.addRoadside = function addRoadside(scene, course) {
    const group = new T.Group(); group.name = "Haruna roadside";
    const atlas=makeAtlas(), tiles=atlas.regions;
    const materials={
      steel:texturedFinish("roadside-zinc.webp",.45,.68,.77,.0009),
      farSteel:new T.MeshStandardMaterial({vertexColors:true,roughness:.49,metalness:.54,side:T.DoubleSide}),
      hardware:new T.MeshStandardMaterial({vertexColors:true,roughness:.40,metalness:.58,side:T.DoubleSide}),
      concrete:texturedFinish("roadside-concrete.webp",.88,.015,1.32,.006),
      timber:texturedFinish("roadside-cedar.webp",.70,.025,1.48,.004),
      tile:texturedFinish("roadside-ceramic.webp",.39,.065,.91,.0017),
      solid:new T.MeshStandardMaterial({vertexColors:true,roughness:.81,metalness:.055,side:T.DoubleSide}),
      lit:new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide}),
      signs:new T.MeshStandardMaterial({map:atlas.texture,vertexColors:true,alphaTest:.35,roughness:.47,metalness:.06}),
      pane:new T.MeshPhysicalMaterial({color:0xa8bbb5,roughness:.10,metalness:.06,clearcoat:1,clearcoatRoughness:.12,
        transparent:true,opacity:.20,depthWrite:false,side:T.FrontSide}),
      interior:new T.MeshBasicMaterial({color:0xe0d8c5,side:T.FrontSide}),
      glow:new T.MeshBasicMaterial({map:makeGlow(),vertexColors:true,transparent:true,depthWrite:false,blending:T.AdditiveBlending,opacity:.20,side:T.DoubleSide}),
      wire:new T.LineBasicMaterial({color:0x30323b,transparent:true,opacity:.80})
    };
    new T.TextureLoader().load(artUrl("tofu-workshop.webp"),map=>{
      map.colorSpace=T.SRGBColorSpace;map.anisotropy=7;
      materials.interior.map=map;materials.interior.needsUpdate=true;
    });
    const mirrorProfile=trafficMirrorMaterial(),mirrors=[],details=[];
    const climbSigns=new Batch(true),climbPosts=new Batch(),lightboxes=new Batch(true),fixtures=[];
    const rearFace=f=>(x,y,z)=>f(-x,y,-z);
    // The distant hillside needs road silhouettes. Below-pixel bolt heads,
    // glazing and reflectors need far less range than steel and porcelain poles.
    const drawDistance={hardware:42,steel:150,farSteel:470,concrete:370,solid:340,lit:180,
      timber:300,tile:310,signs:440,pane:135,interior:150,glow:125,wire:460,mirror:150};
    function limitRange(mesh,key,bounds=mesh.geometry.boundingSphere,inner=0){
      const {center,radius}=bounds,far=radius+drawDistance[key],near=inner?radius+inner:0;
      details.push({mesh,center,nearSq:near*near,farSq:far*far});
    }
    const mapped=new Set(["steel","concrete","timber","tile","signs","glow","interior"]);
    const sections=[],sectionLength=155;
    function section(s) {
      const i=Math.floor(Math.max(0,s)/sectionLength);
      if (!sections[i]) {
        const b={wire:[]};
        for(const key of Object.keys(materials))if(key!=="wire")b[key]=new Batch(mapped.has(key));
        sections[i]=b;
      }
      return sections[i];
    }
    function distantPost(b,f,x,z,bottom,top,width,tint){
      const r=width*.5;
      b.farSteel.face([f(x-r,bottom,z),f(x+r,bottom,z),f(x+r,top,z),f(x-r,top,z)],tint);
      b.farSteel.face([f(x,bottom,z-r),f(x,bottom,z+r),f(x,top,z+r),f(x,top,z-r)],tint);
    }
    const finish=course.finish, split=course.splits[0];
    const dRail=course.half+1.75;
    const spans=[
      {side:-1,ranges:[[1,split-35],[split-9,course.length-1]]},
      {side:1,ranges:[[1,finish-13],[finish+17.5,course.length-1]]}
    ];
    const sectionProfile=[[.070,.422],[.054,.440],[-.018,.461],[-.123,.510],[-.144,.529],[-.140,.550],
      [-.113,.577],[-.052,.624],[-.041,.644],[-.055,.670],[-.129,.719],[-.145,.740],
      [-.136,.761],[-.105,.785],[-.018,.828],[.048,.847],[.067,.841]];
    const metalTints=[0xe0e2dd,0xd9dbd5,0xd4d7d1,0xe5e6df,0xd1d4cf,0xdcded7];
    function railRing(s,side,bend) {
      const p=course.sample(s),points=[],normals=[];
      for(let k=0;k<sectionProfile.length;k++){
        const [off,height]=sectionProfile[k],d=side*(dRail+off+bend*.29);
        points.push(new T.Vector3(p.x+p.rx*d,course.surface(p,d)+height*(1-bend*.64),p.z+p.rz*d));
        const a=sectionProfile[Math.max(0,k-1)],b=sectionProfile[Math.min(sectionProfile.length-1,k+1)];
        const dy=(b[1]-a[1])*(1-bend*.64),dx=b[0]-a[0];
        normals.push(new T.Vector3(-side*p.rx*dy,dx,-side*p.rz*dy).normalize());
      }
      return {points,normals,s};
    }
    for(const {side,ranges} of spans) for(const [from,to] of ranges) {
      const count=Math.ceil((to-from)/3.0);
      let prev,farStart;
      for(let j=0;j<=count;j++){
        const s=from+(to-from)*j/count;
        const edgeDist=Math.min(s-from,to-s);
        const drop=Math.max(0,1-edgeDist/3.6);
        const bend=drop*drop;
        const ring=railRing(s,side,bend);
        if(prev){
          const current=section(s),b=current.steel;
          const tint=metalTints[(Math.floor(j/3)*13+Math.floor(j/13))%metalTints.length];
          for(let k=0;k<sectionProfile.length-1;k++){
            const verts=[prev.points[k],prev.points[k+1],ring.points[k+1],ring.points[k]];
            const normals=[prev.normals[k],prev.normals[k+1],ring.normals[k+1],ring.normals[k]];
            const a=sectionProfile[k][1]*1.7,t=sectionProfile[k+1][1]*1.7;
            const uv=[[prev.s,a],[prev.s,t],[s,t],[s,a]];
            if(side<0){verts.reverse();normals.reverse();uv.reverse();}
            b.face(verts,tint,uv,normals);
          }
          // Past 150 m the folds are subpixel. This version reaches precisely
          // to the matching high-detail section endpoints at both sides.
          farStart=farStart||prev;
          const nextSection=Math.floor((s+(to-from)/count)/sectionLength);
          if(j%3===0||j===count||nextSection!==Math.floor(s/sectionLength)){
            for(const [a,k] of [[0,4],[4,8],[8,12],[12,16]]){
              const p=[farStart.points[a],farStart.points[k],ring.points[k],ring.points[a]];
              const n=[farStart.normals[a],farStart.normals[k],ring.normals[k],ring.normals[a]];
              if(side<0){p.reverse();n.reverse();}
              current.farSteel.face(p,0xb3b9b2,null,n);
            }
            farStart=ring;
          }
        }
        prev=ring;
      }
      for(let s=from+1.7,i=0;s<to-1.1;s+=4.05,i++){
        const f=frame(course,s,side*(dRail+.16));
        const b=section(s);
        const terminal=Math.min(s-from,to-s)<2.1;
        const head=terminal?.42:.775;
        b.steel.box(f,0,(head-.4)/2,0,.12,head+.4,.144,i%9?0xc5c6bd:0xb5b4a5);
        distantPost(b,f,0,0,-.15,head,.13,0xa2a69e);
        b.hardware.box(f,-side*.041,head+.006,0,.058,.013,.15,0x909695);
        if(!terminal){
          b.hardware.box(f,-side*.097,.655,0,.16,.14,.125,0x92978f);
          b.hardware.tube(f(-side*.20,.645,0),f(-side*.226,.645,0),.034,.029,0xbbbdb1,6,"end",false);
          if(i%2===1){
            // The next stamped beam laps the preceding one at the splice.
            for(let k=0;k<sectionProfile.length-1;k++){
              const [ax,ay]=sectionProfile[k], [bx,by]=sectionProfile[k+1];
              const delta=-.165;
              b.hardware.face([f(side*(ax+delta),ay,-.012),f(side*(bx+delta),by,-.012),
                f(side*(bx+delta),by,.002),f(side*(ax+delta),ay,.002)],0x959991);
            }
            for(const y of [.54,.735])for(const z of [-.091,.065]){
              b.hardware.tube(f(-side*.303,y,z),f(-side*.315,y,z),.027,.022,0xc6c8bf,6,"end",false);
            }
          }
        }
        if(i%6===2&&!terminal){
          b.steel.box(f,0,.89,0,.055,.29,.043,0xd0d0c7);
          b.steel.tube(f(0,1.04,-.022),f(0,1.04,.031),.078,.079,0xc7c8ba,10,true);
          b.lit.tube(f(0,1.04,.032),f(0,1.04,.038),.059,.056,side===1?0xd99748:0xe4d8ad,10,true);
        }
      }
    }

    function wire(a,b,sag,sectionS,steps=8) {
      const data=section(sectionS).wire;
      let last=a;
      for(let k=1;k<=steps;k++){
        const t=k/steps, point=a.clone().lerp(b,t);
        point.y-=4*sag*t*(1-t);
        data.push(last.x,last.y,last.z,point.x,point.y,point.z);
        last=point;
      }
    }
    // Reinforced-concrete utility poles, porcelain pin insulators and service drops.
    let previousPole=null, shopFeeder=null, feederDistance=Infinity;
    for(let nominal=10, i=0; nominal<course.length-2; nominal+=46+5*Math.cos(i*1.83),i++) {
      const s=Math.abs(nominal-finish)<15 ? finish+(nominal<finish?-18:21) : nominal;
      const f=frame(course,s,8.05), b=section(s);
      const h=9.05+.28*Math.sin(i*1.65);
      b.concrete.tube(f(0,-1.7,0),f(0,h+.31,0),.183,.125,0xd3d3c9,12,true);
      b.concrete.tube(f(0,-.10,0),f(0,.63,0),.187,.173,0xabaea3,12);
      for(const y of [2.35,4.87,7.38]){
        const r=.174-y*.0055;
        b.hardware.tube(f(0,y,0),f(0,y+.023,0),r+.002,r+.002,0x8a8a7e,12);
      }
      for(let rung=0;rung<6;rung++){
        const x=rung%2===0?1:-1,y=2.65+.51*rung,r=.171-y*.006;
        b.hardware.tube(f(x*r,y,0),f(x*(r+.098),y+.03,0),.012,.013,0x858780,5);
      }
      b.steel.box(f,0,h+.035,0,2.50,.055,.17,0x8f9795);
      b.steel.box(f,0,h-.019,-.058,2.50,.126,.045,0x828883);
      b.farSteel.box(f,0,h,0,2.50,.094,.13,0x838982);
      for(const sign of [-1,1]) b.steel.tube(f(0,h-.73,0),f(sign*.86,h-.04,0),.026,.026,0x696c6a,5);
      const cables=[];
      for(const x of [-1.03,-.19,1.03]){
        b.hardware.tube(f(x,h+.05,0),f(x,h+.34,0),.026,.024,0x727672,7);
        b.solid.tube(f(x,h+.11,0),f(x,h+.32,0),.044,.052,0xb9bdac,9,true);
        for(const y of [.15,.235]){
          b.solid.tube(f(x,h+y-.025,0),f(x,h+y,0),.090,.108,0xb3b9a9,10);
          b.solid.tube(f(x,h+y,0),f(x,h+y+.040,0),.108,.045,0xd5d7c6,10);
        }
        cables.push(f(x,h+.33,0));
      }
      b.steel.box(f,.13,h-1.05,0,.55,.075,.13,0x64686a);
      cables.push(f(.32,h-.94,0),f(.35,h-1.70,0));
      if(previousPole) cables.forEach((end,n)=>wire(previousPole[n],end,n<3?.53:1.09,s));
      previousPole=cables;
      if(Math.abs(s-finish)<feederDistance){feederDistance=Math.abs(s-finish);shopFeeder=cables[4];}
      if(i%5===2){
        b.steel.tube(f(.36,h-2.50,.02),f(.36,h-1.83,.02),.205,.205,0x99a6a4,12,true);
        for(const y of [-2.47,-1.91,-1.83]){
          b.hardware.tube(f(.36,h+y,.02),f(.36,h+y+.035,.02),.216,.219,0x8d9995,12,true);
        }
        b.steel.box(f,.18,h-2.42,0,.54,.054,.22,0x535757);
        for(const z of [-.075,.105]){
          b.solid.tube(f(.36,h-1.81,z),f(.36,h-1.66,z),.054,.038,0xbcc1b2,8,true);
          wire(f(.36,h-1.66,z),f(.54,h-.99,z),.34,s,5);
        }
      }
      if(i%3!==1){
        b.solid.box(f,-.164,1.66,0,.035,.77,.19,0xdfb551);
        for(let z=0;z<3;z++) b.solid.box(f,-.186,1.40+z*.22,0,.018,.089,.195,0x403d39);
      }
    }

    function streetLamp(s,side) {
      const f=frame(course,s,side*7.43), b=section(s);
      const inwards=-side, h=6.47;
      b.steel.tube(f(0,-.70,0),f(0,h-.55,0),.104,.066,0x737c80,7);
      distantPost(b,f,0,0,-.14,h-.55,.135,0x777d78);
      b.farSteel.face([f(0,h-.57,0),f(inwards*1.62,h-.07,0),f(inwards*1.62,h+.012,0),f(0,h-.46,0)],0x838982);
      b.concrete.tube(f(0,-.28,0),f(0,.24,0),.176,.15,0xb4b5a5,10,true);
      b.steel.tube(f(0,h-.55,0),f(inwards*.39,h-.11,0),.067,.058,0x929a9b,7);
      b.steel.tube(f(inwards*.39,h-.11,0),f(inwards*1.51,h,0),.058,.045,0x99a0a1,7);
      b.steel.box(f,inwards*1.65,h-.035,0,.68,.12,.285,0x77807f);
      b.lit.box(f,inwards*1.66,h-.105,0,.56,.036,.206,0xf9e0b6);
      for(const x of [1.45,1.63,1.82])b.hardware.box(f,inwards*x,h-.123,0,.014,.012,.215,0x929188);
      b.glow.panel(f,inwards*1.66,h-.08,.06,.66,.36,[0,0,1,1],false,0xfbd4a3);
      fixtures.push({position:f(inwards*1.66,h-.13,0),aim:f(inwards*5.35,0,0),color:0xffc997,power:365,reach:27});
    }

    function guideSign(s,side,key) {
      const f=frame(course,s,side*8.45,side*.065), b=section(s);
      const width=4.45,height=1.83,center=3.91;
      for(const x of [-1.48,1.48]){
        b.steel.tube(f(x,-.90,-.112),f(x,4.77,-.112),.073,.063,0xc1c4bb,10,true);
        distantPost(b,f,x,-.112,-.16,4.77,.135,0xa8afa5);
        b.concrete.tube(f(x,-.53,-.112),f(x,.16,-.112),.155,.132,0xb4b5a8,10,true);
      }
      b.steel.box(f,0,center,0,width+.065,height+.065,.095,0xb7bcb6);
      b.farSteel.box(f,0,center,0,width+.065,height+.065,.093,0xa3a9a0);
      for(const y of [center-.48,center+.48]){
        b.steel.box(f,0,y,-.09,width-.20,.065,.095,0x8f9998);
        for(const x of [-1.48,1.48]){
          b.hardware.box(f,x,y,-.167,.20,.155,.041,0x9fa39c);
          for(const dx of [-.074,.074])b.hardware.tube(f(x+dx,y,-.183),f(x+dx,y,-.205),.022,.021,0x939a91,6,true,false);
        }
      }
      b.signs.panel(f,0,center,.052,width,height,tiles[key]);
      climbSigns.panel(rearFace(f),0,center,.228,width,height,tiles.summit);
    }
    guideSign(course.start+40,-1,"spa");
    guideSign(split+164,1,"ridge");
    guideSign(course.splits[1]+161,-1,"valley");

    function marker(s,side,key,mirror=false) {
      const f=frame(course,s,side*7.24), b=section(s);
      const h=key==="shield"?2.33:2.46, w=key==="shield"?.71:.74;
      b.steel.tube(f(0,-.62,-.055),f(0,h+.18,-.055),.044,.041,0xbbc0b5,9,true);
      distantPost(b,f,0,-.055,-.16,h+.18,.084,0xa4aaa0);
      for(const y of [h-.13,h+.13])b.hardware.box(f,0,y,-.06,.20,.047,.088,0x94988d);
      // Thin stamped backs keep the circular and diamond boards visible on exit.
      if(key==="limit")b.steel.tube(f(0,h,-.014),f(0,h,.003),w*.485,w*.485,0xacb3a8,28,true);
      if(key==="turn")b.steel.face([f(0,h-.352,-.009),f(.352,h,-.009),f(0,h+.352,-.009),f(-.352,h,-.009)],0xb3b7aa);
      b.signs.panel(f,0,h,.015,w,key==="shield"?.64:.74,tiles[key],mirror);
      if(key!=="turn")climbSigns.panel(rearFace(f),0,h,.109,w,key==="shield"?.64:.74,tiles[key]);
    }
    marker(course.start+17,1,"shield");
    marker(course.start+221,-1,"limit");
    marker(split+57,-1,"shield");
    marker(course.splits[1]-54,-1,"limit");
    marker(finish-87,-1,"shield");

    function chevron(s,outer,right) {
      const f=frame(course,s,outer*7.05), b=section(s);
      b.steel.tube(f(0,-.60,-.025),f(0,1.85,-.025),.048,.041,0xa8aaa5,6);
      distantPost(b,f,0,-.025,-.16,1.85,.087,0x969d93);
      b.steel.box(f,0,1.92,0,1.17,.74,.052,0xa2a59b);
      b.farSteel.box(f,0,1.92,0,1.17,.74,.05,0x969d93);
      b.signs.panel(f,0,1.92,.031,1.14,.715,tiles.chevron,!right);
      climbSigns.panel(rearFace(f),0,1.92,.031,1.14,.715,tiles.chevron,right);
    }
    function convexMirror(s,side,turn) {
      const f=frame(course,s,side*7.46,turn*.24), b=section(s);
      const orange=0xc6743d,centre=f(-side*.32,3.28,.035),look=course.at(s+22,0,1.22);
      const approach=course.at(s-16,-.35,1.55).sub(centre).normalize();
      const face=look.clone().sub(centre).normalize().add(approach);
      if(face.lengthSq()<.001)face.copy(approach);
      face.normalize();
      const {transform:local,mesh}=makeLens(mirrorProfile,centre,face,group);
      limitRange(mesh,"mirror");
      mirrors.push({centre,face,look,uphillLook:course.at(s-22,0,1.22)});
      b.concrete.tube(f(0,-.56,0),f(0,.125,0),.17,.135,0xa8aaa0,12,true);
      b.solid.tube(f(0,-.02,0),f(0,3.32,0),.061,.053,orange,10,true);
      b.steel.tube(f(0,2.89,0),local(0,-.13,-.15),.025,.026,0xa5a9a0,7);
      b.steel.tube(f(0,3.13,0),local(0,0,-.13),.039,.042,0x93998e,8);
      b.solid.tube(local(0,0,-.16),local(0,0,-.025),.38,.489,orange,32,true);
      b.solid.tube(local(0,0,-.03),local(0,0,-.004),.479,.471,0x3c3e38,32,true);
      const polar=(r,t,z)=>local(r*Math.cos(t),r*Math.sin(t),z);
      for(let i=0;i<32;i++){
        const a=TAU*i/32,e=TAU*(i+1)/32;
        b.solid.tube(polar(.479,a,-.005),polar(.479,e,-.005),.012,.012,orange,5);
        if(i<2||i>=14)continue;
        const lip=t=>.06+.107*Math.sin(t);
        b.solid.face([polar(.494,a,-.07),polar(.494,e,-.07),polar(.494,e,lip(e)),polar(.494,a,lip(a))],0xd1834a);
        b.solid.tube(polar(.494,a,lip(a)),polar(.494,e,lip(e)),.009,.009,0xc2723c,5);
      }
      for(let j=0;j<2;j++){
        const y=.93+j*.24;
        b.solid.tube(f(0,y,0),f(0,y+.139,0),.061,.061,0xd3ccae,10);
      }
    }

    // Select separated runoff-facing hairpins from measured signed curvature.
    const bendCandidates=[];
    for(let s=course.start+90;s<finish-100;s+=3.5) {
      const k=course.sample(s).curvature;
      if(Math.abs(k)>.025) bendCandidates.push({s,k});
    }
    bendCandidates.sort((a,b)=>Math.abs(b.k)-Math.abs(a.k));
    const turns=[];
    for(const bend of bendCandidates){
      if(turns.every(other=>Math.abs(other.s-bend.s)>190)) turns.push(bend);
      if(turns.length===5) break;
    }
    turns.sort((a,b)=>a.s-b.s);
    for(const {s,k} of turns){
      const outer=-Math.sign(k);
      marker(s-61,-1,"turn",k>0);
      const f=frame(course,s+61,7.24,Math.PI);
      climbPosts.tube(f(0,-.53,-.055),f(0,2.64,-.055),.044,.041,0xbbc0b5,8,true);
      climbSigns.panel(f,0,2.46,.015,.74,.74,tiles.turn,k<0);
      for(const shift of [-22,-6,10,26]) chevron(s+shift,outer,k>0);
      convexMirror(s-12,-outer,Math.sign(k));
      streetLamp(s-32,outer);
      streetLamp(s+26,-outer);
    }
    for(const [s,side] of [[course.start+2,-1],[course.start+95,1],[split-48,-1],
      [course.splits[1]+39,1],[finish-26,1],[finish+16,-1]]) streetLamp(s,side);
    // The first uphill guide sits on the driver's left, leaving the shop apron open.
    const firstGuide=frame(course,finish-73,8.4,Math.PI+.035);
    for(const x of [-1.48,1.48])climbPosts.tube(firstGuide(x,-.7,-.11),firstGuide(x,4.2,-.11),.071,.061,0xb8beb8,8,true);
    climbPosts.box(firstGuide,0,3.49,0,4.29,1.78,.10,0x9da4a2);
    climbSigns.panel(firstGuide,0,3.49,.052,4.23,1.72,tiles.summit);

    function turnout(start,end,side,depth,tones) {
      // The apron follows the course grade. Its tapered sides join the gravel
      // shoulder at the guardrail gap, and the outer soil lip meets the hillside.
      const sections=32, columns=7, b=section((start+end)/2);
      let previous;
      for(let i=0;i<=sections;i++){
        const s=start+(end-start)*i/sections, edge=Math.min((s-start)/5.2,(end-s)/5.2,1);
        const envelope=edge*edge*(3-2*edge);
        const inside=course.half+.04, outside=inside+1.43+(depth-inside-1.43)*envelope;
        const row=[];
        for(let j=0;j<=columns;j++){
          const t=j/columns,d=inside+(outside-inside)*t;
          row.push(course.at(s,side*d,.009+.023*t));
          if(previous&&j){
            const tone=tones[j===columns?2:(i*11+j*17)%19<4?1:0];
            const vertices=[previous[j-1],row[j-1],row[j],previous[j]];
            if(side===1)vertices.reverse();
            b.concrete.face(vertices,tone,vertices.map(v=>[v.x,v.z]));
          }
        }
        if(previous){
          const a=previous[columns],v=row[columns],low=v.clone(),old=a.clone();
          low.y-=1.40;old.y-=1.4;
          b.concrete.face([a,v,low,old],tones[2]);
        }
        previous=row;
      }
      // Galvanized grates bridge the runoff channel across each vehicle entrance.
      const drain=side*(course.half+.80);
      for(let s=start+1.1;s<end-1;s+=.99){
        const f=frame(course,s,drain),p=course.sample(s);
        const grade=course.at(s+.5,drain,0).y-course.at(s-.5,drain,0).y;
        const crossfall=-p.bank-.009*drain;
        const sloped=(x,y,z)=>f(x,y-grade*z+crossfall*x,z);
        b.concrete.box(sloped,0,.026,0,.33,.032,.983,0x575d56);
        for(const x of [-.148,.148])b.hardware.box(sloped,x,.053,0,.023,.02,.98,0xb9bcb0);
        for(let k=0;k<11;k++)b.hardware.box(sloped,0,.055,-.457+k*.091,.283,.024,.022,0xb0b2a8);
      }
    }
    turnout(split-34.7,split-9.2,-1,15.75,[0x8b8d81,0x8d8e82,0x7c8172]);
    turnout(finish-12.8,finish+17.0,1,15.8,[0x858883,0x888a84,0x72796d]);

    function shrine(s) {
      // The steps lead away from the left shoulder, behind an opening in its beam.
      const f=frame(course,s,-12.1,-Math.PI/2+.13), b=section(s);
      const stone=0xb1b2a2, wood=0xbc6746, shade=0x9f503b;
      b.concrete.box(f,0,-.54,.14,5.65,.95,5.5,0xa0a395);
      for(let i=0;i<5;i++){
        const y=-.31+i*.087,z=3.06-i*.64;
        for(let j=0;j<4;j++)b.concrete.box(f,-1.72+j*1.146,y,z,1.14,.26,.68,(i+j)%3?0xb7b6a4:stone);
      }
      for(const x of [-1.92,1.92]){
        b.concrete.tube(f(x,-.68,0),f(x,.24,0),.29,.26,0x929689,16,true);
        b.timber.tube(f(x,.18,0),f(x*.95,4.61,0),.212,.178,wood,20,true);
        b.timber.tube(f(x,.15,0),f(x*.991,.87,0),.228,.211,0x4c4a40,20,true);
        b.timber.box(f,x*.962,3.70,.01,.50,.09,.48,shade);
        b.timber.box(f,x*.971,3.72,.02,.36,.07,.53,0xa95b3d);
      }
      b.timber.box(f,0,3.60,.01,5.26,.25,.31,wood);
      b.timber.box(f,0,4.01,0,.26,.77,.245,shade);
      // The kasagi rises slightly at either tip.
      function lintel(width,base,depth,height,color) {
        const rise=x=>.19*Math.pow(Math.abs(x)/(width*.5),3);
        for(let i=0;i<8;i++){
          const a=-width/2+width*i/8,e=a+width/8,lo=base+rise(a),hi=base+rise(e);
          b.timber.face([f(a,lo,depth),f(e,hi,depth),f(e,hi+height,depth),f(a,lo+height,depth)],color);
          b.timber.face([f(e,hi,-depth),f(a,lo,-depth),f(a,lo+height,-depth),f(e,hi+height,-depth)],color);
          b.timber.face([f(a,lo+height,depth),f(e,hi+height,depth),f(e,hi+height,-depth),f(a,lo+height,-depth)],color);
          b.timber.face([f(a,lo,-depth),f(e,hi,-depth),f(e,hi,depth),f(a,lo,depth)],color);
          if(i===0||i===7){
            const x=i===0?a:e,y=i===0?lo:hi;
            b.timber.face([f(x,y,-depth),f(x,y,depth),f(x,y+height,depth),f(x,y+height,-depth)],color);
          }
        }
      }
      lintel(5.61,4.36,.233,.22,wood);
      lintel(5.93,4.57,.284,.148,0x494842);
      lintel(5.98,4.70,.29,.030,0x626055);
      b.signs.panel(f,0,4.02,.171,.34,.68,tiles.plaque);
      for(let i=0;i<10;i++){
        const x=-1.74+i*.348,xx=x+.348;
        const y=t=>3.46-.24*(1-Math.pow(t/1.74,2));
        for(let strand=0;strand<3;strand++)for(let j=0;j<6;j++){
          const twist=n=>{
            const along=x+(xx-x)*n/6,t=(i*6+n)*1.29+strand*TAU/3;
            return f(along,y(along)+.011*Math.sin(t),.18+.011*Math.cos(t));
          };
          b.solid.tube(twist(j),twist(j+1),.018,.018,0xb49b72,5);
        }
        if(i%2===1){
          b.solid.face([f(x-.055,y(x)-.022,.19),f(x+.047,y(x)-.045,.19),f(x+.072,y(x)-.16,.205),
            f(x+.004,y(x)-.145,.205),f(x+.011,y(x)-.24,.19),f(x-.07,y(x)-.17,.19)],0xd7d3c1);
        }
      }
      for(const x of [-2.8,2.8]){
        b.concrete.box(f,x,.08,1.45,.65,.22,.65,stone);
        b.concrete.tube(f(x,.17,1.45),f(x,.26,1.45),.243,.168,0xa5aa9b,8,true);
        b.concrete.tube(f(x,.24,1.45),f(x,.78,1.45),.151,.119,stone,10);
        b.concrete.tube(f(x,.72,1.45),f(x,.81,1.45),.135,.214,0xa5aa9b,8,true);
        b.concrete.box(f,x,.84,1.45,.49,.15,.49,0x989d90);
        b.lit.box(f,x,1.09,1.45,.23,.30,.23,0xa79c83);
        for(const dx of [-.17,.17])for(const dz of [-.17,.17])
          b.concrete.box(f,x+dx,1.09,1.45+dz,.065,.38,.065,0x92988d);
        for(const [lo,hi,r0,r1] of [[1.27,1.32,.27,.402],[1.32,1.37,.402,.349],[1.37,1.52,.349,.11],[1.52,1.55,.11,.073],[1.56,1.62,.058,.095],[1.62,1.72,.095,.012]]){
          b.concrete.tube(f(x,lo,1.45),f(x,hi,1.45),r0,r1,0x92988c,lo<1.55?6:9,true,false);
        }
      }
      // A narrow stone path continues beyond the gate, with an old split-rail fence.
      for(let i=0;i<8;i++){
        const z=-1.84-.82*i;
        b.concrete.box(f,.055*Math.sin(i),-.34+i*.046,z,2.59,.65,.812,i%3===1?0xa6a794:0x9ea391);
      }
      for(const side of [-1,1]){
        for(let i=0;i<4;i++){
          const x=side*(2.29+.07*Math.cos(i)), z=-2.28-i*1.69, y=i*.06;
          b.timber.tube(f(x,-.81+y,z),f(x,.52+y,z),.113,.085,0x85816b,9,true);
          if(i<3)for(const lift of [.12,.43])
            b.timber.tube(f(x,y+lift,z),f(x,y+lift+.06,z-1.73),.060,.060,0x938b72,8);
        }
        for(let i=0;i<6;i++){
          const x=side*(3.26+(.5+.5*Math.cos(i*2.45))*1.10),z=.38-i*1.1;
          const rise=.25+.24*(.5+.5*Math.sin(i+side)), r=.48+.18*Math.cos(i);
          const rings=[];
          for(const [layer,width,height] of [[0,.83,-.22],[1,1,.11],[2,.78,.61],[3,.36,.91]]){
            const ring=[];
            for(let k=0;k<9;k++){
              const ang=k*TAU/9+.38*i+layer*.075;
              const radius=r*width*(.93+.11*Math.cos(2.65*k+i));
              ring.push(f(x+layer*.029+radius*Math.cos(ang),
                height*rise+.038*Math.sin(4.23*k+layer+i),z+.84*radius*Math.sin(ang)));
            }
            rings.push(ring);
            if(layer)for(let k=0;k<9;k++){
              const next=(k+1)%9;
              const facet=[rings[layer-1][k],ring[k],ring[next],rings[layer-1][next]];
              b.concrete.face(facet,layer===1?0x858d79:0x989d8b);
            }
          }
          for(let k=0;k<9;k++)b.concrete.face([rings[3][k],f(x+.11,rise,z-.032),rings[3][(k+1)%9]],0xa0a28e);
        }
      }
      const altar=-7.30;
      b.concrete.box(f,0,.54,altar,2.0,.60,1.45,0x9ca18e);
      b.timber.box(f,0,1.35,altar,1.62,1.08,1.17,0x978779);
      b.timber.box(f,0,1.39,altar+.587,1.37,.78,.028,0x5e594d);
      for(let i=0;i<15;i++)b.timber.box(f,-.646+i*.093,1.40,altar+.630,.031,.77,.045,0x968573);
      b.timber.box(f,0,1.06,altar+.626,1.46,.079,.064,0x937d68);
      b.timber.box(f,0,1.74,altar+.626,1.46,.095,.064,0x937d68);
      for(const side of [-1,1])b.tile.face([f(-1.10,1.89,altar+side*.89),f(1.10,1.89,altar+side*.89),
        f(1.10,2.42,altar),f(-1.10,2.42,altar)],0x797b6d);
      b.tile.tube(f(-1.14,2.43,altar),f(1.14,2.43,altar),.065,.065,0x838579,9,true);
    }
    shrine(split-22);

    function tofuShop(s) {
      const f=frame(course,s,13.1,Math.PI/2-.085), b=section(s);
      const box=(x,y,z,w,h,d,c)=>b.solid.box(f,x,y,z,w,h,d,c);
      const light=(x,y,z,w,h,d,c)=>b.lit.box(f,x,y,z,w,h,d,c);
      const wood=(x,y,z,w,h,d,c)=>b.timber.box(f,x,y,z,w,h,d,c);
      const mortar=(x,y,z,w,h,d,c)=>b.concrete.box(f,x,y,z,w,h,d,c);
      const front=2.49,wall=0xd8d2ba,cedar=0x827563,slate=0x717b79;
      mortar(0,-1.12,-.02,9.48,2.50,5.03,0xa6a89d);
      mortar(0,-.08,3.38,10.38,.28,1.91,0xb6b5a8);
      mortar(0,.025,4.16,10.56,.13,.43,0xbfc0b0);
      mortar(0,1.67,-2.40,9.35,3.05,.18,wall);
      for(const side of [-1,1]){
        mortar(side*4.58,1.67,.02,.18,3.05,4.80,wall);
        for(let i=0;i<19;i++)wood(side*4.69,.54,-2.37+i*.263,.053,.80,.249,i%5===2?0x8a8777:0xa19b82);
        wood(side*4.70,.96,0,.075,.078,4.84,0x777967);
      }
      mortar(0,2.83,front,9.35,.71,.17,wall);
      mortar(0,.22,front+.015,9.38,.18,.13,0x929387);
      b.interior.panel(f,0,1.51,front-.90,9.14,2.67,[0,0,1,1]);
      // Each course of kawara overlaps the one beneath. The raised bead and
      // concave pan create alternating highlights even from a grazing angle.
      const roofFront=3.08, roofBack=-2.99, eave=3.34, peak=4.63, halfW=5.00;
      const roofY=z=>eave+(peak-eave)*(1-Math.abs(z)/3.08);
      b.timber.face([f(-halfW,eave,roofFront),f(halfW,eave,roofFront),f(halfW,peak,0),f(-halfW,peak,0)],0x777164);
      b.timber.face([f(halfW,eave,roofBack),f(-halfW,eave,roofBack),f(-halfW,peak,0),f(halfW,peak,0)],0x636359);
      const sectionX=[0,.045,.12,.21,.28,.3333],sectionY=[.024,.083,.073,.021,.010,.024];
      const tileshades=[0x707979,0x6d7675,0x74807d,0x717b78,0x657272,0x727c79];
      for(const side of [-1,1]){
        for(let row=0;row<9;row++){
          const z0=side*(row*3.08/9-.015),z1=side*((row+1)*3.08/9+.018);
          for(let col=0;col<30;col++){
            const tx=-5+col/3,shade=tileshades[(17*col+13*row+(col*row)%3)%tileshades.length];
            for(let k=1;k<sectionX.length;k++){
              const xa=tx+sectionX[k-1],xb=tx+sectionX[k];
              const ya=sectionY[k-1],yb=sectionY[k];
              b.tile.face([f(xa,roofY(z1)+ya+.032,z1),f(xb,roofY(z1)+yb+.032,z1),
                f(xb,roofY(z0)+yb,z0),f(xa,roofY(z0)+ya,z0)],shade);
              b.tile.face([f(xa,roofY(z1)+ya+.013,z1+.008*side),f(xb,roofY(z1)+yb+.013,z1+.008*side),
                f(xb,roofY(z1)+yb+.032,z1),f(xa,roofY(z1)+ya+.032,z1)],slate);
            }
          }
        }
      }
      for(const side of [-1,1]){
        const x=side*4.67;
        b.concrete.face([f(x,3.14,-2.50),f(x,3.14,2.50),f(x,4.46,0)],0xbdbdad);
        for(const z of [-1.57,-.83,0,.83,1.57]) {
          const h=roofY(z)-3.19;
          wood(x,3.17+h/2,z,.094,h,.082,cedar);
        }
        b.tile.tube(f(side*halfW,eave+.06,roofFront),f(side*halfW,peak+.06,0),.066,.066,slate,9);
        b.tile.tube(f(side*halfW,peak+.06,0),f(side*halfW,eave+.06,roofBack),.066,.066,slate,9);
      }
      wood(0,eave-.08,roofFront,10.10,.17,.17,0x777464);
      wood(0,eave-.08,roofBack,10.10,.15,.15,0x646b61);
      for(let i=0;i<30;i++){
        const x=-5.1+i*.34;
        b.tile.tube(f(x,peak+.085,0),f(x+.336,peak+.085,0),.101,.118,tileshades[i%6],12,true);
      }
      b.steel.tube(f(-5.03,eave-.11,roofFront+.07),f(5.03,eave-.11,roofFront+.07),.065,.065,0x96998a,9);
      for(const x of [-4.48,4.48]){
        b.steel.tube(f(x,3.23,roofFront+.07),f(x,2.9,front+.12),.046,.046,0x96998a,8);
        b.steel.tube(f(x,.13,front+.12),f(x,2.9,front+.12),.046,.046,0x919487,8);
        for(const y of [.75,2.00])b.hardware.tube(f(x,y,front+.12),f(x,y+.039,front+.12),.054,.054,0x777a6d,8);
      }
      // Glazing and door rails stand in front of a continuous, recessed workspace.
      for(const [x,w] of [[-3.32,2.42],[-.84,2.48],[1.68,2.37],[3.71,1.51]]){
        b.pane.panel(f,x,1.43,front+.056,w-.075,2.02,[0,0,1,1]);
        for(const y of [.54,1.95,2.42])wood(x,y,front+.092,w,.047,.07,cedar);
        for(let n=1;n<3;n++)wood(x-w/2+w*n/3,1.48,front+.093,.027,1.82,.048,0x756e5f);
        wood(x,.385,front+.072,w,.22,.083,0x938572);
      }
      for(const x of [-4.58,-2.10,.48,2.88,4.52])wood(x,1.54,front+.105,.104,2.64,.16,cedar);
      wood(0,2.46,front+.125,9.25,.105,.16,cedar);
      b.steel.box(f,-3.20,.79,front-.31,2.51,.07,.61,0xb8beb2);
      for(let i=0;i<3;i++){
        const x=-3.93+i*.63;
        b.tile.box(f,x,.842,front-.26,.46,.055,.30,0xc6ccbd);
        box(x,.899,front-.26,.284,.061,.19,0xe0dac4);
      }
      box(-.18,1.17,front+.215,.032,.32,.045,0xc7b78e);
      // Lightbox, enamel projecting sign, shop curtain and a ribbed paper lantern.
      box(-.46,2.87,front+.20,7.81,.76,.35,0x6c6455);
      b.signs.panel(f,-.46,2.865,front+.383,7.63,.64,tiles.shop);
      lightboxes.panel(f,-.46,2.865,front+.386,7.63,.64,tiles.shop);
      fixtures.push({position:f(-.55,3.18,front+1.13),aim:f(-.35,.33,front+.42),color:0xffd3a1,power:116,reach:14});
      b.timber.tube(f(-2.09,2.48,front+.245),f(.47,2.48,front+.245),.022,.022,0x978770,8,true);
      const [u,bottom,v,top]=tiles.noren;
      for(let strip=0;strip<5;strip++){
        for(let k=0;k<4;k++){
          const left=(strip+k/4)/5,right=(strip+(k+1)/4)/5;
          const silk=(t,high)=>f(-2.03+2.42*t,high?2.455:1.84+.018*Math.sin(t*32),
            front+.265+(high?.012:.063)*Math.sin(t*TAU*7.2));
          b.signs.face([silk(left,false),silk(right,false),silk(right,true),silk(left,true)],0xf0ebe0,
            [[u+(v-u)*left,bottom],[u+(v-u)*right,bottom],[u+(v-u)*right,top],[u+(v-u)*left,top]]);
        }
      }
      box(3.78,2.95,front+.55,.085,.075,1.17,0x545650);
      box(3.78,2.46,front+.98,.22,1.33,.47,0x726c58);
      // Two perpendicular faces make this sign readable on the approach and exit.
      for(const side of [-1,1]){
        const face=(x,y,z)=>f(3.78+side*(.114+z),2.46+y,front+.98-side*x);
        b.signs.panel(face,0,0,0,.43,1.24,tiles.vertical);
      }
      const lx=-2.10,lz=front+.59;
      b.solid.tube(f(lx,2.67,lz),f(lx,2.87,lz),.014,.014,0x57554a,5);
      const rings=[[2.20,.087],[2.24,.14],[2.32,.177],[2.46,.185],[2.57,.162],[2.64,.087]];
      for(let i=1;i<rings.length;i++){
        const [lo,r0]=rings[i-1],[hi,r1]=rings[i];
        b.lit.tube(f(lx,lo,lz),f(lx,hi,lz),r0,r1,0xc99773,18);
        for(let j=0;j<3;j++){
          const t=(j+.25)/3,y=lo+(hi-lo)*t,r=r0+(r1-r0)*t+.001;
          b.solid.tube(f(lx,y,lz),f(lx,y+.005,lz),r,r,0x8d6955,18);
        }
      }
      for(const y of [2.2,2.64])b.solid.tube(f(lx,y-.014,lz),f(lx,y+.01,lz),.087,.087,0x41433b,12,true);
      // Vending machine, produce crates and stacked delivery trays.
      const vx=4.51,vz=front+.62;
      box(vx,1.06,vz,1.02,1.99,.65,0x914a3d);
      box(vx,.11,vz,1.02,.14,.68,0x645a50);
      b.signs.panel(f,vx,1.06,vz+.335,.96,1.89,tiles.vend);
      // Only the glass merchandise bay glows. The lower painted cabinet remains in shadow.
      const [left,low,right,high]=tiles.vend;
      lightboxes.panel(f,vx,1.43,vz+.340,.87,1.06,
        [left+(right-left)*.05,low+(high-low)*.382,right-(right-left)*.05,high-(high-low)*.054]);
      b.pane.panel(f,vx,1.50,vz+.338,.884,.91,[0,0,1,1]);
      for(let i=0;i<6;i++)box(vx+.514,.30+i*.041,vz-.03,.009,.015,.39,0x62534a);
      for(const stack of [[-4.33,.19,front+.55],[-3.45,.19,front+.56],[-4.24,.45,front+.54]]){
        const [x,y,z]=stack;
        wood(x,y-.11,z,.79,.032,.48,0x9c8771);
        for(const dx of [-.353,.353])for(const d of [-.197,.197])wood(x+dx,y,z+d,.050,.24,.044,0xaf977b);
        for(const d of [-.224,.224]){
          wood(x,y+.10,z+d,.82,.052,.030,0xb19b7f);
          wood(x,y-.006,z+d,.81,.075,.030,0xb49d7d);
          for(const dx of [-.353,.353])b.hardware.box(f,x+dx,y+.10,z+d+Math.sign(d)*.017,.012,.012,.006,0x72746a);
        }
      }
      // One long flank is visible before the gate, with a frosted side window.
      const sx=4.69;
      box(sx,1.71,.16,.095,1.17,2.46,0x6d7068);
      light(sx+.053,1.71,.16,.031,1.04,2.30,0x747e72);
      const sash=(x,y,z)=>f(sx+.077+z,y,.16-x);
      b.pane.panel(sash,0,1.71,0,2.30,1.04,[0,0,1,1]);
      for(const z of [-.62,.14,.91]) box(sx+.093,1.71,z,.041,1.11,.056,0x6d7169);
      box(4.81,.72,-1.71,.36,.66,.89,0xa7ac9c);
      const fan=(radius,angle)=>f(5.002,.73+radius*Math.sin(angle),-1.69+radius*Math.cos(angle));
      b.solid.tube(f(4.989,.73,-1.69),f(4.998,.73,-1.69),.229,.229,0x666e66,24,true);
      for(const r of [.086,.138,.181,.217])for(let n=0;n<24;n++)
        b.hardware.tube(fan(r,n*TAU/24),fan(r,(n+1)*TAU/24),.0037,.0037,0x999e90,4);
      for(let n=0;n<7;n++)b.hardware.tube(fan(.035,n*TAU/7),fan(.220,n*TAU/7),.0045,.0045,0x999e90,4);
      const sideSign=(x,y,z)=>f(sx+.066+z,y,1.80-x);
      box(sx+.018,1.93,1.80,.10,1.55,.57,0x6b6758);
      b.signs.panel(sideSign,0,1.93,.011,.53,1.48,tiles.vertical);
      // Roof aerial and an overhead service line were common on the valley shops.
      b.steel.tube(f(-2.95,4.42,-.61),f(-2.95,5.76,-.61),.027,.023,0x676e6c,5);
      b.steel.tube(f(-2.95,5.60,-1.28),f(-2.95,5.60,.13),.019,.019,0x687476,5);
      for(let i=0;i<5;i++){
        const z=-1.21+i*.29, span=.57-i*.052;
        b.steel.tube(f(-2.95-span,5.60,z),f(-2.95+span,5.60,z),.013,.013,0x7b8685,5);
      }
      if(shopFeeder) wire(f(3.94,3.39,front+.03),shopFeeder,.40,s);
    }
    tofuShop(finish+3.8);

    for(const [index,b] of sections.entries()){
      if(!b) continue;
      let closeSteelBounds;
      for(const key of Object.keys(materials)){
        if(key==="wire")continue;
        const mesh=b[key].build(materials[key]); if(!mesh) continue;
        mesh.name="Roadside "+index+" "+key;
        mesh.castShadow=["steel","solid","concrete","timber","tile","signs"].includes(key);
        mesh.receiveShadow=mesh.castShadow||key==="hardware"||key==="farSteel";
        if(key==="steel")closeSteelBounds=mesh.geometry.boundingSphere;
        if(key==="farSteel"){
          mesh.visible=false;
          limitRange(mesh,key,closeSteelBounds,drawDistance.steel);
        }
        else limitRange(mesh,key);
        if(key==="glow") mesh.renderOrder=1;
        group.add(mesh);
      }
      if(b.wire.length){
        const geom=new T.BufferGeometry();
        geom.setAttribute("position",new T.Float32BufferAttribute(b.wire,3));
        geom.computeBoundingSphere();const lines=new T.LineSegments(geom,materials.wire);
        lines.name="Utility lines "+index;limitRange(lines,"wire");group.add(lines);
      }
    }
    const climb=new T.Group();climb.name="Uphill guides and illuminated shop signs";
    const signMesh=climbSigns.build(materials.signs),posts=climbPosts.build(materials.farSteel);
    signMesh.castShadow=true;signMesh.receiveShadow=true;posts.castShadow=true;posts.receiveShadow=true;
    const displays=lightboxes.build(new T.MeshBasicMaterial({map:atlas.texture,color:0xffe2bb,
      vertexColors:true,polygonOffset:true,polygonOffsetFactor:-2}));
    climb.add(signMesh,posts,displays);group.add(climb);
    // Only two pole/awning lights can contribute near the driver at once.
    const pools=Array.from({length:2},()=>{
      const spot=new T.SpotLight(0xffc997,0,27,1.08,.84,2);
      group.add(spot,spot.target);return spot;
    });
    let night=false;
    group.userData.setNight=value=>{
      night=value;climb.visible=night;pools.forEach(p=>{p.visible=night;p.intensity=0;});
      materials.glow.opacity=night?.38:.20;
      materials.interior.color.setHex(night?0xf5c896:0xe0d8c5);
      mirrorProfile.uniforms.localReady.value=0;
    };
    const updateView=updateRoadsideView(scene,mirrors,mirrorProfile,details);
    group.userData.updateView=(renderer,camera,time,carPosition=camera.position)=>{
      if(night){
        let closest=null,second=null,a=Infinity,b=Infinity,c=Infinity;
        for(const fixture of fixtures){
          const d=carPosition.distanceToSquared(fixture.position);
          if(d<a){c=b;second=closest;b=a;closest=fixture;a=d;}
          else if(d<b){c=b;second=fixture;b=d;}
          else if(d<c)c=d;
        }
        for(let i=0;i<pools.length;i++){
          const light=pools[i],f=i?second:closest,dist=Math.sqrt(i?b:a);
          const handoff=T.MathUtils.smoothstep(Math.sqrt(c)-dist,0,6);
          light.intensity=f.power*handoff*(1-T.MathUtils.smoothstep(dist,f.reach+5,f.reach+24));
          light.position.copy(f.position);light.target.position.copy(f.aim);
          light.color.setHex(f.color);light.distance=f.reach;
        }
      }
      updateView(renderer,camera,time,night);
    };
    scene.add(group);
    return group;
  };
})();
