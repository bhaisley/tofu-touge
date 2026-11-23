/* Result Japan NEO86-inspired GR86. All model coordinates are metres, nose along -Z. */
(() => {
  'use strict';
  const T = THREE, TAU = Math.PI * 2;
  const clamp = T.MathUtils.clamp, lerp = T.MathUtils.lerp;
  const add = (a,b) => a.map((x,i) => x+b[i]);
  const sub = (a,b) => a.map((x,i) => x-b[i]);
  const mul = (a,k) => a.map(x => x*k);
  const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const length = a => Math.hypot(a[0],a[1],a[2]);
  const unit = a => mul(a,1/(length(a)||1));
  const quadrangle = [[0,0],[1,0],[1,1],[0,1]];
  // Half-tracks put the outer tire shoulders 11 mm and 13 mm inside the flare crowns.
  const dims = {frontAxle:-1.320, rearAxle:1.255, frontTrack:.878, rearTrack:.899, tireRadius:.316};
  // Shared by the rocker, the panel behind each rear wheel and the bumper return.
  const pandaTrim={valanceTop:.391,beltBottom:.443,beltTop:.497,black:0x202329,belt:0x171b21};
  const model = window.TougeNeo86 = {dims,pandaTrim};
  // The authoring tools finish a build synchronously. The game can run the
  // same geometry recipe in small batches while the stage cover is visible.
  model.staged=steps=>{
    const build=(...args)=>{
      const job=steps(...args);let part;
      do {part=job.next();} while(!part.done);
      return part.value;
    };
    build.steps=steps;return build;
  };
  function* buildPart(build,api){
    return build.steps?yield* build.steps.call(model,api):build.call(model,api);
  }

  // Shared transverse sections keep the nose, body sides and trunk tangential at their joins.
  // Station, half-width at the top of the wing, wing height, centreline height.
  const sections = [
    [-2.060,.847,.574,.594],[-1.99,.855,.610,.617],[-1.76,.874,.675,.650],
    [-1.51,.885,.724,.671],[-1.32,.893,.745,.694],[-1.04,.885,.760,.736],
    [-.77,.871,.775,.777],[-.49,.869,.787,.791],[-.08,.872,.795,.801],
    [.35,.877,.803,.810],[.71,.885,.817,.823],[1.05,.896,.847,.848],
    [1.27,.902,.857,.851],[1.52,.897,.859,.857],[1.74,.887,.852,.862],
    [1.93,.862,.849,.863],[2.025,.843,.843,.856]
  ];
  function sectionAt(z,column) {
    if(z<=sections[0][0])return sections[0][column];
    let i=1;
    while(i<sections.length && z>sections[i][0])i++;
    if(i===sections.length)return sections[i-1][column];
    const a=sections[i-1],b=sections[i],span=b[0]-a[0],t=(z-a[0])/span;
    const secant=(l,r)=>(r[column]-l[column])/(r[0]-l[0]);
    const tangent=(one,two)=>one*two<=0?0:2*one*two/(one+two);
    const slope=secant(a,b);
    const m0=i>1?tangent(secant(sections[i-2],a),slope):slope;
    const m1=i+1<sections.length?tangent(slope,secant(b,sections[i+1])):slope;
    return lerp(a[column],b[column],t*t*(3-2*t))+span*t*(1-t)*(m0*(1-t)-m1*t);
  }
  const profile = {
    frontZ:sections[0][0], rearZ:sections[sections.length-1][0],
    halfWidth:z=>sectionAt(z,1), shoulderY:z=>sectionAt(z,2),
    deckAt(z,u) {
      const edge=sectionAt(z,2),center=sectionAt(z,3),x=Math.abs(u);
      const nose=1-T.MathUtils.smoothstep(z,-.88,-.50);
      const bonnetCrease=.010*Math.exp(-((x-.73)**2)/.009)*Math.sin(Math.PI*x)*nose;
      return [u*sectionAt(z,1),lerp(center,edge,x*x*(2-x))+bonnetCrease,z];
    },
    sideAt(side,z,y,lift=0) {
      const top=sectionAt(z,2),t=clamp((y-.12)/(top-.12),0,1);
      const tuck=.033*(1-t)**3, shoulder=.014*Math.sin(Math.PI*t);
      return [side*(sectionAt(z,1)+shoulder-tuck+lift),y,z];
    }
  };

  class GeometryBatch {
    constructor(materials){this.materials=materials;this.buffers=new Map();this.colors=new Map();}
    buffer(finish) {
      if(!this.materials[finish])throw new Error('Unknown GR86 finish '+finish);
      if(!this.buffers.has(finish))this.buffers.set(finish,{p:[],n:[],c:[],uv:[],idx:[]});
      return this.buffers.get(finish);
    }
    color(hex) {
      if(!this.colors.has(hex))this.colors.set(hex,new T.Color(hex));
      return this.colors.get(hex);
    }
    vertex(data,p,n,uv,color) {
      const index=data.p.length/3;
      data.p.push(...p);data.n.push(...n);data.uv.push(...uv);data.c.push(color.r,color.g,color.b);
      return index;
    }
    face(finish,points,outward,hex=0xffffff,uv=quadrangle,normals) {
      const data=this.buffer(finish),color=this.color(hex);
      for(let i=1;i<points.length-1;i++) {
        let n=cross(sub(points[i],points[0]),sub(points[i+1],points[0]));
        if(dot(n,n)<1e-17)continue;
        const ids=dot(n,outward)<0?[0,i+1,i]:[0,i,i+1];
        n=unit(dot(n,outward)<0?mul(n,-1):n);
        for(const j of ids)data.idx.push(this.vertex(data,points[j],normals?.[j]||n,uv?.[j]||[0,0],color));
      }
    }
    patch(finish,nu,nv,at,outward,hex=0xffffff,uvAt) {
      const data=this.buffer(finish),color=this.color(hex),start=data.p.length/3;
      const positions=[],normals=[];
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)positions.push(at(i/nu,j/nv));
      const index=(i,j)=>j*(nu+1)+i;
      for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++) {
        const u=i/nu,v=j/nv,k=index(i,j);
        const du=sub(positions[index(Math.min(i+1,nu),j)],positions[index(Math.max(i-1,0),j)]);
        const dv=sub(positions[index(i,Math.min(j+1,nv))],positions[index(i,Math.max(j-1,0))]);
        const outer=typeof outward==='function'?outward(u,v):outward;
        let n=cross(du,dv);
        if(length(n)<1e-10)n=outer;
        n=unit(dot(n,outer)<0?mul(n,-1):n);
        normals.push(n);this.vertex(data,positions[k],n,uvAt?uvAt(u,v):[u,v],color);
      }
      const triangle=(a,b,c)=>{
        const n=cross(sub(positions[b],positions[a]),sub(positions[c],positions[a]));
        if(dot(n,n)<1e-17)return;
        if(dot(n,normals[a])<0)data.idx.push(start+a,start+c,start+b);
        else data.idx.push(start+a,start+b,start+c);
      };
      for(let j=0;j<nv;j++)for(let i=0;i<nu;i++) {
        const a=index(i,j),b=a+1,c=index(i,j+1),d=c+1;
        triangle(a,b,c);triangle(b,d,c);
      }
    }
    build(name) {
      const group=new T.Group();group.name=name;
      for(const [finish,data] of this.buffers) {
        if(!data.idx.length)continue;
        const geometry=new T.BufferGeometry();
        for(const [key,values,size] of [['position',data.p,3],['normal',data.n,3],['color',data.c,3],['uv',data.uv,2]])
          geometry.setAttribute(key,new T.Float32BufferAttribute(values,size));
        geometry.setIndex(data.idx);geometry.computeBoundingSphere();
        const material=this.materials[finish],mesh=new T.Mesh(geometry,material);
        mesh.name=finish;
        mesh.castShadow=!material.transparent && !['marks','tail','brake','stopLamp','head','fog','amber'].includes(finish);
        mesh.receiveShadow=true;
        group.add(mesh);
      }
      return group;
    }
  }

  function box(b,finish,center,dimensions,color,tilt=0) {
    const [w,h,l]=dimensions.map(x=>x*.5),cs=Math.cos(tilt),sn=Math.sin(tilt);
    const p=(x,y,z)=>add(center,[x,y*cs-z*sn,y*sn+z*cs]);
    const a=p(-w,-h,-l),c=p(w,-h,-l),d=p(w,h,-l),e=p(-w,h,-l);
    const f=p(-w,-h,l),g=p(w,-h,l),j=p(w,h,l),k=p(-w,h,l);
    for(const [points,n] of [
      [[a,c,d,e],[0,sn,-cs]],[[f,g,j,k],[0,-sn,cs]],[[a,e,k,f],[-1,0,0]],
      [[c,d,j,g],[1,0,0]],[[e,d,j,k],[0,cs,sn]],[[a,c,g,f],[0,-cs,-sn]]
    ])b.face(finish,points,n,color);
  }
  function rod(b,finish,a,end,radius,color,count=8,endRadius=radius) {
    const axis=unit(sub(end,a)),u=unit(cross(axis,Math.abs(axis[1])<.88?[0,1,0]:[1,0,0])),v=cross(axis,u);
    if(!length(axis))return;
    const radial=i=>add(mul(u,Math.cos(i*TAU/count)),mul(v,Math.sin(i*TAU/count)));
    for(let i=0;i<count;i++) {
      const n=radial(i),m=radial(i+1),p=add(a,mul(n,radius)),q=add(a,mul(m,radius));
      const r=add(end,mul(m,endRadius)),s=add(end,mul(n,endRadius));
      b.face(finish,[p,q,r,s],add(n,m),color,quadrangle,[n,m,m,n]);
      b.face(finish,[a,q,p],mul(axis,-1),color);b.face(finish,[end,s,r],axis,color);
    }
  }
  function tube(b,finish,points,radius,color,count=7) {
    if(points.length<2)return;
    let lastBasis,rings=[];
    for(let i=0;i<points.length;i++) {
      const axis=unit(sub(points[Math.min(i+1,points.length-1)],points[Math.max(0,i-1)]));
      let tangent=lastBasis?sub(lastBasis,mul(axis,dot(lastBasis,axis))):null;
      if(!tangent||length(tangent)<.01)tangent=cross(axis,Math.abs(axis[1])<.9?[0,1,0]:[1,0,0]);
      tangent=unit(tangent);lastBasis=tangent;
      const bitangent=cross(axis,tangent),ring=[];
      for(let j=0;j<count;j++){
        const a=j*TAU/count,n=add(mul(tangent,Math.cos(a)),mul(bitangent,Math.sin(a)));
        ring.push({p:add(points[i],mul(n,radius)),n});
      }
      if(i)for(let j=0;j<count;j++){
        const k=(j+1)%count,c=[rings[j],ring[j],ring[k],rings[k]];
        b.face(finish,c.map(p=>p.p),add(c[0].n,c[2].n),color,quadrangle,c.map(p=>p.n));
      }
      rings=ring;
    }
  }

  function texture(w,h,draw) {
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    draw(canvas.getContext('2d'),w,h);
    const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=8;return tex;
  }
  const atlasSize=[1536,512];
  const decals={door:[12,12,1492,126],plate:[10,170,396,198],grBadge:[455,170,238,75],
    neoBadge:[735,168,586,91],toyota:[481,283,169,103],showPlate:[700,297,396,198],
    toyotaWord:[1115,302,400,85],quarterBadge:[1118,398,130,108],rockerBadge:[1260,422,260,65]};
  function atlasUV(name) {
    const [x,y,w,h]=decals[name];
    return quadrangle.map(([u,v])=>[(x+u*w)/atlasSize[0],1-(y+(1-v)*h)/atlasSize[1]]);
  }
  function drawMarkings() {
    const japanese='"Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans CJK JP",sans-serif';
    return texture(...atlasSize,(c)=>{
      c.textBaseline='middle';c.textAlign='center';
      const fit=(txt,x,y,w)=>{c.save();c.translate(x,y);c.scale(w/c.measureText(txt).width,1);c.fillText(txt,0,0);c.restore();};
      c.fillStyle='#f1f1e9';c.font='bold 104px '+japanese;fit('藤原とうふ店（自家用）',758,77,1415);
      const [px,py,pw,ph]=decals.plate;
      c.fillStyle='#e7e8dd';c.fillRect(px,py,pw,ph);c.strokeStyle='#b7bbb1';c.lineWidth=4;c.strokeRect(px+3,py+3,pw-6,ph-6);
      c.fillStyle='#244437';c.font='bold 43px '+japanese;c.fillText('群馬  330',px+pw/2,py+43);
      c.font='bold 39px '+japanese;c.fillText('せ',px+44,py+126);
      c.font='bold 94px "Helvetica Neue",Arial,sans-serif';fit('・8  86',px+233,py+131,248);
      for(const pos of [31,pw-31]){
        c.fillStyle='#80877d';c.beginPath();c.arc(px+pos,py+19,7,0,TAU);c.fill();
        c.strokeStyle='#dbe0d6';c.lineWidth=2;c.beginPath();c.moveTo(px+pos-3,py+18);c.lineTo(px+pos+3,py+18);c.stroke();
      }
      // Enamel GR tile beside the separate chrome 86 numerals on the trunk.
      c.fillStyle='#bcc3c5';c.fillRect(456,171,116,72);
      c.fillStyle='#171a1f';c.fillRect(459,174,110,66);
      c.fillStyle='#af2028';c.beginPath();c.moveTo(520,174);c.lineTo(569,174);
      c.lineTo(569,240);c.lineTo(504,240);c.closePath();c.fill();
      c.fillStyle='#f0f0ee';c.font='italic 900 59px Arial';fit('GR',515,210,100);
      c.save();c.translate(634,211);c.scale(1.18,1);c.font='italic 900 70px Arial';
      c.lineJoin='round';c.lineWidth=3.7;c.strokeStyle='#4c5153';c.strokeText('86',0,0);
      const chrome=c.createLinearGradient(0,-29,0,28);
      chrome.addColorStop(0,'#ecedea');chrome.addColorStop(.46,'#cfd4d7');
      chrome.addColorStop(.51,'#888f91');chrome.addColorStop(1,'#e7e8e3');
      c.fillStyle=chrome;c.fillText('86',0,0);c.restore();
      c.fillStyle='#dce1dc';c.font='italic 600 65px Arial';fit('NEO86',1028,216,486);
      c.strokeStyle='#d8dcdb';c.lineWidth=8;
      for(const [x,y,rx,ry] of [[565,334,75,41],[565,322,61,16],[565,335,19,36]]){
        c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.stroke();
      }
      const [sx,sy,sw,sh]=decals.showPlate;
      const enamel=c.createLinearGradient(sx,sy,sx+sw*.28,sy+sh);
      enamel.addColorStop(0,'#25262b');enamel.addColorStop(.5,'#18191e');enamel.addColorStop(1,'#121317');
      c.fillStyle=enamel;c.fillRect(sx,sy,sw,sh);
      c.fillStyle='#e6e4df';c.font='84px "Times New Roman",serif';fit('NEO86',sx+sw/2,sy+115,285);
      for(const dx of [60,sw-60]){
        const x=sx+dx,y=sy+20;
        c.fillStyle='#090b0e';c.beginPath();c.arc(x,y,7,0,TAU);c.fill();
        c.fillStyle='#34373b';c.beginPath();c.arc(x,y-1,4,0,TAU);c.fill();
        c.fillStyle='#919496';c.fillRect(x-2.6,y-1.8,5.2,1.3);
      }
      c.fillStyle='#eeece8';c.font='bold 79px Arial,sans-serif';fit('TOYOTA',1315,349,378);
      c.save();c.translate(1183,452);
      c.beginPath();
      for(const [x,y] of [[0,-51],[59,-26],[59,25],[0,51],[-59,25],[-59,-26]])c.lineTo(x,y);
      c.closePath();c.fillStyle='#e2dccc';c.fill();c.lineWidth=5;c.strokeStyle='#232325';c.stroke();c.clip();
      c.fillStyle='#92343d';c.fillRect(-56,-2,112,56);
      c.fillStyle='#24252a';c.font='bold 19px Arial';fit('DRIFTER',0,-16,88);
      c.fillStyle='#ebe7dc';c.beginPath();c.moveTo(-36,12);c.lineTo(-21,9);c.lineTo(-10,2);
      c.lineTo(10,2);c.lineTo(22,9);c.lineTo(36,12);c.lineTo(36,17);c.lineTo(-36,17);c.fill();
      c.font='bold 13px Arial';c.fillText('86',0,31);c.restore();
      c.fillStyle='#eeede6';c.font='italic bold 65px Arial';fit('CR-S',1390,458,237);
    });
  }
  function markings() {
    // Store the Japanese lettering as ink in the livery itself. The same glyphs
    // then appear on machines with different system fonts, including offline.
    const map=new T.Texture();
    map.colorSpace=T.SRGBColorSpace;map.anisotropy=8;
    const assign=image=>{map.image=image;map.needsUpdate=true;};
    const name='neo86-markings.webp';
    new T.ImageLoader().load(window.TougeArtURLs?.[name]||'assets/art/'+name,assign,undefined,()=>assign(drawMarkings().image));
    return map;
  }
  model.drawMarkings=drawMarkings;
  function windshieldPrint() {
    return texture(1024,512,(c,w,h)=>{
      const shade=c.createLinearGradient(0,0,0,h*.14);
      shade.addColorStop(0,'rgba(24,33,35,.25)');shade.addColorStop(1,'rgba(24,33,35,0)');
      c.fillStyle=shade;c.fillRect(0,0,w,h*.14);
      c.fillStyle='#1b2020';
      c.beginPath();c.ellipse(w/2,15,19,13,0,0,TAU);c.fill();
      c.fillStyle='rgba(35,39,37,.90)';c.beginPath();
      for(let y=2;y<49;y+=3)for(let x=-34+(y%2)*1.5;x<34;x+=3){
        const d=Math.hypot(x/32,(y-13)/34);
        if(d>=1)continue;
        const r=1.05*(1-T.MathUtils.smoothstep(d,.54,1));
        c.moveTo(w/2+x+r,y);c.arc(w/2+x,y,r,0,TAU);
      }
      c.fill();
    });
  }
  function heatedGlass() {
    const scale=window.innerWidth<760?1:2;
    return texture(1024*scale,512*scale,c=>{
      const w=1024,h=512;c.scale(scale,scale);
      // UV rows already follow the physical bow. This is the clear opening
      // inside the ceramic print, measured separately from the outer glass.
      function opening(inset=0){
        const path=new Path2D(),left=57+inset,right=w-left,top=54+inset,base=466-inset;
        path.moveTo(left+46,top);path.lineTo(right-46,top);
        path.bezierCurveTo(right-16,top,right,top+22,right,top+51);
        path.lineTo(right,base-56);
        path.bezierCurveTo(right,base-25,right-19,base-11,right-62,base-5);
        path.bezierCurveTo(w*.73,base-1,w*.62,base,w*.5,base);
        path.bezierCurveTo(w*.38,base,w*.27,base-1,left+62,base-5);
        path.bezierCurveTo(left+19,base-11,left,base-25,left,base-56);
        path.lineTo(left,top+51);path.bezierCurveTo(left,top+22,left+16,top,left+46,top);
        path.closePath();return path;
      }
      const clear=opening(),ceramic=new Path2D();
      ceramic.rect(0,0,w,h);ceramic.addPath(clear);c.fillStyle='#171a19';c.fill(ceramic,'evenodd');
      c.save();c.clip(clear);c.strokeStyle='#202522';c.lineCap='round';c.setLineDash([.03,3.8]);
      for(let row=0;row<3;row++){
        c.lineWidth=2.1-.51*row;c.lineDashOffset=row%2*1.9;c.stroke(opening(1.2+2.25*row));
      }
      c.setLineDash([]);c.lineCap='butt';

      // The upper conductors are almost level. The lower ones sweep up at
      // their terminals with the curved sill. Both busbars join every trace.
      const rows=16,terminals=[];
      c.strokeStyle='rgba(134,97,68,.92)';c.lineWidth=.80;c.beginPath();
      for(let i=0;i<rows;i++){
        const t=i/(rows-1);
        const middle=101+331*(t+.085*t*(1-t));
        // The glass itself supplies most of the bow. Only the additional
        // sweep of the printed wire belongs in its UV map.
        const edge=middle-(4+10*t),left=61+4*t*t*t*t;
        c.moveTo(left,edge);c.quadraticCurveTo(w*.5,2*middle-edge,w-left,edge);
        terminals.push([left,edge]);
      }
      c.stroke();c.lineWidth=1.45;c.beginPath();
      for(const side of [0,1])terminals.forEach(([left,y],i)=>{
        const x=side?w-left:left;
        if(i===0)c.moveTo(x,y);else c.lineTo(x,y);
      });
      c.stroke();c.restore();
      // Small ceramic maker's etch in the lower corner, under the outer surface.
      c.save();c.translate(w-95,h-32);c.fillStyle='rgba(215,218,203,.63)';
      c.beginPath();c.moveTo(0,0);c.lineTo(10,0);c.lineTo(5,7);c.closePath();c.fill();
      c.font='bold 5px Arial';c.fillText('TEMPERED',12,4);c.font='4px Arial';c.fillText('AS2   •   M86',12,9);
      c.restore();
    });
  }
  function carMaterials() {
    const standard=(roughness,metalness,extra={})=>new T.MeshStandardMaterial({vertexColors:true,roughness,metalness,...extra});
    const physical=(roughness,metalness,extra={})=>new T.MeshPhysicalMaterial({vertexColors:true,roughness,metalness,...extra});
    const glass=(tint,absorption,map=null)=>{
      const pane=physical(.035,0,{color:tint,map,ior:1.52,transparent:true,opacity:absorption,side:T.DoubleSide,
        depthWrite:false,envMapIntensity:1.40,specularIntensity:1});
      pane.forceSinglePass=true;
      pane.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader
          .replace('#include <map_fragment>',`
            float innerPrint = 0.;
            #ifdef USE_MAP
              vec4 ink = texture2D(map, vMapUv);
              innerPrint = ink.a;
              diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, innerPrint);
            #endif`)
          .replace('#include <opaque_fragment>',`
          // Front surface reflection plus the return through the back surface.
          // The tint absorbs transmitted light and the printed frit sits inside it.
          float cosView = abs(dot(normal, geometryViewDir));
          float faceR = .0426 + .9574 * pow(1. - min(1., cosView), 5.);
          float pathLength = inversesqrt(1. - (1. - cosView*cosView) / (1.52*1.52));
          float through = pow(1. - opacity, pathLength) * (1. - innerPrint);
          float internalR = faceR * through * through;
          float returned = faceR + (1. - faceR)*(1. - faceR)*internalR / (1. - faceR*internalR + .0001);
          float transmittance = through*(1. - faceR)*(1. - faceR) / (1. - faceR*internalR + .0001);
          float layer = 1. - transmittance;
          vec3 skyReturn = vec3(0.);
          #if defined(USE_ENVMAP) && defined(RE_IndirectSpecular)
            skyReturn = returned * radiance;
          #endif
          vec3 printLight = mix(diffuseColor.rgb * .55, totalDiffuse, innerPrint);
          outgoingLight = (skyReturn + reflectedLight.directSpecular + (layer-returned)*printLight) / max(layer,.001);
          diffuseColor.a = layer;
          #include <opaque_fragment>`);
      };
      return pane;
    };
    const lamp=(color,emissive,intensity,roughness)=>standard(roughness,.08,{color,emissive,emissiveIntensity:intensity});
    const m={
      // Fine pearl in the color coat gives a broad reflection underneath the
      // much tighter resin finish. Dark panda panels use the same clear resin.
      paint:physical(.20,.14,{color:0xf8f8f7,ior:1.56,clearcoat:1,clearcoatRoughness:.055,envMapIntensity:1.08}),
      satin:physical(.33,.12,{clearcoat:.48,clearcoatRoughness:.21,envMapIntensity:1.02}),
      flareGloss:physical(.19,.015,{color:0xbabbb9,ior:1.52,clearcoat:1,clearcoatRoughness:.055,envMapIntensity:1.04}),
      trim:standard(.52,.045),rubber:standard(.85,.015),tire:standard(.82,.015),
      metal:standard(.29,.76),chrome:standard(.123,.92,{envMapIntensity:1.25}),
      wheel:standard(.32,.66),brakeSteel:standard(.39,.82),caliper:standard(.38,.38),cap:physical(.22,.17,{clearcoat:.65}),
      glass:glass(0x18251f,.24,windshieldPrint()),sideGlass:glass(0x15211c,.33),hatchGlass:glass(0x17221c,.37,heatedGlass()),
      blackGlass:physical(.12,.06,{clearcoat:.87,clearcoatRoughness:.08}),
      interior:standard(.91,.015),marks:standard(.46,.05,{map:markings(),alphaTest:.24,alphaToCoverage:true,
        polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),
      tail:lamp(0xff8197,0xde1035,.46,.20),brake:lamp(0xffb8c3,0xff354c,.27,.17),
      stopLamp:lamp(0x9f242a,0xfc1938,.012,.20),
      head:lamp(0xfff4d8,0xffe2ad,.72,.15),fog:lamp(0xffdf88,0xffb932,.88,.18),
      amber:lamp(0xffdb93,0xff9d25,.32,.26),
      optic:physical(.068,.02,{color:0xf4f9f8,transparent:true,opacity:.18,depthWrite:false,ior:1.54})
    };
    for(const name of ['paint','satin','flareGloss','wheel','chrome','metal','glass','sideGlass','hatchGlass','blackGlass','optic'])
      m[name].userData.routeReflections=true;
    m.paint.userData.lacquer=m.flareGloss.userData.lacquer=true;
    return m;
  }

  function bindDisplayPlate(material) {
    const show={value:0},min=atlasUV('plate')[0],max=atlasUV('plate')[2],display=atlasUV('showPlate')[0];
    const offset=new T.Vector2(display[0]-min[0],display[1]-min[1]);
    material.onBeforeCompile=shader=>{
      shader.uniforms.plateShift={value:offset};shader.uniforms.showPlate=show;
      shader.vertexShader='uniform vec2 plateShift; uniform float showPlate;\n'+shader.vertexShader
        .replace('#include <uv_vertex>',`#include <uv_vertex>
          #ifdef USE_MAP
            if (all(greaterThanEqual(uv,vec2(${min[0]-.0001},${min[1]-.0001}))) &&
                all(lessThanEqual(uv,vec2(${max[0]+.0001},${max[1]+.0001}))))
              vMapUv += showPlate * plateShift;
          #endif`);
    };
    return show;
  }

  // Light reflected by adjacent panels. The guide, fog and plate lamps supply
  // their actual positions in the fascia mesh, including the wrap onto the wing.
  function bindLampSpill(materials,sources,braking) {
    const names=['tailInner','tailOuter','tailBottom','tailReturn','fog','plate'];
    const uniforms={brakeLight:braking,carEmitters:{value:names.map(name=>new T.Vector3(...sources[name]))}};
    for(const material of [materials.paint,materials.satin,materials.flareGloss,materials.moulding,materials.marks]){
      if(!material)continue;
      const prepare=material.onBeforeCompile.bind(material),key=material.customProgramCacheKey();
      material.onBeforeCompile=(shader,renderer)=>{
        prepare(shader,renderer);Object.assign(shader.uniforms,uniforms);
        const coordinates='varying vec3 lampSurface, lampNormal;\n';
        shader.vertexShader=coordinates+shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\n lampSurface=position; lampNormal=normal;');
        shader.fragmentShader=coordinates+`
          uniform vec3 carEmitters[6];
          uniform float brakeLight;
          float lampIrradiance(vec3 p,vec3 n,vec3 light,float radius){
            vec3 delta=light-p;
            float d2=dot(delta,delta);
            float incidence=max(0.,dot(n,delta)*inversesqrt(max(.00001,d2)));
            return (.14+.86*incidence)*radius*radius/(radius*radius+d2);
          }
          vec3 closestOnGuide(vec3 p,vec3 a,vec3 b){
            vec3 axis=b-a;
            return a+axis*clamp(dot(p-a,axis)/max(.00001,dot(axis,axis)),0.,1.);
          }
          vec3 nearbyLamps(){
            vec3 p=lampSurface,n=normalize(lampNormal);
            n.x*=sign(p.x);p.x=abs(p.x);
            vec3 light=vec3(0.);
            if(p.z>1.68){
              float guide=max(lampIrradiance(p,n,closestOnGuide(p,carEmitters[0],carEmitters[1]),.064),
                         max(lampIrradiance(p,n,closestOnGuide(p,carEmitters[1],carEmitters[2]),.064),
                             lampIrradiance(p,n,closestOnGuide(p,carEmitters[2],carEmitters[3]),.052)));
              light+=vec3(1.,.010,.014)*(.23+.94*brakeLight)*guide;
              float down=1.-smoothstep(-.005,.020,p.y-carEmitters[5].y);
              light+=vec3(.22,.28,.38)*down*lampIrradiance(p,n,carEmitters[5],.063);
            }else if(p.z< -1.8){
              light+=vec3(.65,.28,.036)*lampIrradiance(p,n,carEmitters[4],.063);
            }
            return light;
          }\n`+shader.fragmentShader.replace('#include <lights_fragment_end>',
            '#include <lights_fragment_end>\n reflectedLight.indirectDiffuse+=material.diffuseColor*nearbyLamps();');
      };
      material.customProgramCacheKey=()=>key+'/nearby-car-lamps';
    }
  }

  model.create=model.staged(function* createGR86() {
    const group=new T.Group();group.name='Toyota GR86 · NEO86';
    const suspension=new T.Group();suspension.name='Sprung chassis';suspension.rotation.order='ZXY';
    const rollCenterHeight=.38;
    suspension.position.y=rollCenterHeight;
    const wheelCarrier=new T.Group();wheelCarrier.name='Wheel carriers';group.add(suspension,wheelCarrier);
    const materials=carMaterials(),displayPlate=bindDisplayPlate(materials.marks);
    const b=new GeometryBatch(materials),driverBatch=new GeometryBatch(materials);
    const brakeLight={value:0},lampSources={},exhaustOutlets=[];
    const api={b,driverBatch,Batch:GeometryBatch,materials,dims,profile,atlasUV,texture,box,rod,tube,wheelCarrier,lampSources,exhaustOutlets};
    yield;
    yield* buildPart(model.buildBody,api);
    yield* buildPart(model.buildFascias,api);
    bindLampSpill(materials,lampSources,brakeLight);
    const body=b.build('NEO86 bodywork');body.position.y=-suspension.position.y;suspension.add(body);
    const driver=driverBatch.build('Driver');body.add(driver);
    yield;
    const wheels=yield* buildPart(model.buildWheels,api);
    function setMotion({wheelAngle=0,rearWheelAngle=wheelAngle,steer=0,brake=0,bodyRoll=0,bodyPitch=0,suspensionOffsets}={}) {
      // Leave a clearance margin within the measured 32 mm of travel at full lock.
      // The bump rubber progressively carries the sprung body during combined roll and dive.
      const freeTravel=.026,fullTravel=.030;
      const bodyRise=suspensionOffsets?Math.max(0,Math.max(...suspensionOffsets)-fullTravel):0;
      let angleScale=1,peakClosing=0;
      for(let i=0;i<wheels.length;i++){
        const w=wheels[i],offset=suspensionOffsets?.[i]||0;
        const closing=bodyPitch*w.hub.position.z-bodyRoll*w.hub.position.x;
        const compression=offset-bodyRise+closing;
        peakClosing=Math.max(peakClosing,closing);
        if(closing>0 && compression>freeTravel){
          const excess=compression-freeTravel,remaining=fullTravel-freeTravel;
          const travel=freeTravel+remaining*excess/(remaining+excess);
          angleScale=Math.min(angleScale,Math.max(0,(travel-offset+bodyRise)/closing));
        }
        w.hub.position.y=dims.tireRadius+offset;
        w.spin.rotation.x=-(w.steers?wheelAngle:rearWheelAngle);
        if(w.steers)w.hub.rotation.y=steer;
      }
      // Once a corner reaches its stop, the shell rises as the opposite springs extend.
      const extension=(1-angleScale)*.35;
      angleScale+=extension;
      suspension.position.y=rollCenterHeight+bodyRise+peakClosing*extension;
      suspension.rotation.x=bodyPitch*angleScale;suspension.rotation.z=bodyRoll*angleScale;
      brakeLight.value=clamp(brake,0,1);
      materials.brake.emissiveIntensity=.27+3.15*brakeLight.value;
      materials.stopLamp.emissiveIntensity=.012+1.50*brakeLight.value;
    }
    function setDisplayMode(parked){driver.visible=!parked;displayPlate.value=parked?1:0;}
    return {group,body,driver,suspension,wheels,exhaustOutlets,setMotion,setDisplayMode,axles:{front:dims.frontAxle,rear:dims.rearAxle,
      frontTrack:dims.frontTrack,rearTrack:dims.rearTrack,halfTrack:(dims.frontTrack+dims.rearTrack)/2,radius:dims.tireRadius}};
  });
})();
