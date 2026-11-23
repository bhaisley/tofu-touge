// Result Japan NEO86-inspired bodywork. All fixed parts share the car's geometry batches.
(() => {
  'use strict';
  const mix = (a, b, t) => a + (b - a) * t;
  const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
  const clamp = (v, a, b) => Math.max(a, Math.min(v, b));
  const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  function interpolate(stations, value) {
    for (let i = 1; i < stations.length; i++) {
      if (value <= stations[i][0]) {
        const [start, end] = [stations[i - 1], stations[i]];
        return mix(start[1], end[1], clamp((value - start[0]) / (end[0] - start[0]), 0, 1));
      }
    }
    return stations[stations.length - 1][1];
  }
  const front = [0, 0, -1], rear = [0, 0, 1], up = [0, 1, 0], down = [0, -1, 0];
  const {pandaTrim}=window.TougeNeo86;
  const pearl = 0xeceeea, bumper = 0x24272a, gasket = 0x141619;
  const frontDepth = [[.089,.099],[.107,.149],[.128,.152],[.151,.116],[.197,.086],
    [.325,.085],[.359,.111],[.387,.124],[.400,.127],[.439,.127],[.451,.123],
    [.476,.118],[.493,.105],[.504,.087],[.551,.078],[.599,.063]];
  const trunkDepth = [[.581,.072],[.686,.065],[.774,.061],[.827,.046],[.94,.026]];
  function rearDepthAt(y) {
    if(y>=.581)return interpolate(trunkDepth,y);
    // Match the trunk tangent at the bumper shoulder. A continuous crown
    // carries the reflected horizon over the moulded surface.
    const t=clamp((y-.115)/.466,0,1),t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*.027+(t3-2*t2+t)*.149
      +(-2*t3+3*t2)*.072+(t3-t2)*(-.0311)+.288*t2*(1-t)*(1-t);
  }

  // Normalised quarter-arc loop with real corner radii, used for bezels and optical bowls.
  function roundedRect(width, height, radius, perCorner = 5) {
    const hw = width / 2, hh = height / 2, r = Math.min(radius, hw, hh);
    const loop = [];
    for (const [cx, cy, start] of [[hw-r,hh-r,0],[-hw+r,hh-r,90],[-hw+r,-hh+r,180],[hw-r,-hh+r,270]]) {
      for (let i = 0; i <= perCorner; i++) {
        const a = (start + 90 * i / perCorner) * Math.PI / 180;
        loop.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    }
    return loop;
  }
  function ring(b, finish, from, to, outward, color) {
    for (let i = 0; i < from.length; i++) {
      const j = (i + 1) % from.length;
      b.face(finish, [from[i], from[j], to[j], to[i]], outward, color);
    }
  }
  function roundPanel(b, finish, point, outward, width, height, radius, color) {
    const edge = roundedRect(width, height, radius);
    b.face(finish, edge.map(([x,y])=>point(x,y)), outward, color,
      edge.map(([x,y])=>[.5+x/width,.5+y/height]));
  }
  function curvedPanel(b,finish,point,outward,width,height,radius,color) {
    const hw=width*.5,hh=height*.5;
    b.patch(finish,18,5,(u,v)=>{
      const x=(2*u-1)*hw,dx=Math.max(0,Math.abs(x)-(hw-radius));
      const h=hh-radius+Math.sqrt(Math.max(0,radius*radius-dx*dx));
      return point(x,(2*v-1)*h);
    },outward,color);
  }
  function spline(points, count) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    return curve.getPoints(count).map(p => p.toArray());
  }

  function makeEnd(profile, back) {
    const z = back ? profile.rearZ : profile.frontZ, dir = back ? 1 : -1;
    return (u, y, offset = 0) => {
      const a = Math.abs(u), corner = a ** 9;
      const side = profile.sideAt(1,z,y);
      const width = Math.abs(side[0]);
      const turn=clamp((a-.72)/.28,0,1);
      const sx=a<.72?a:.72+.28*Math.sin(Math.PI*turn*.5);
      const shoulder=(1-.12*a*a)*Math.cos(Math.PI*turn*.5);
      const bootPocket = back ? .031 * (1 - smooth(.40,.67,a)) *
        smooth(.519,.591,y) * (1 - smooth(.731,.816,y)) : 0;
      const depth=back?rearDepthAt(y):interpolate(frontDepth,y);
      const dz=dir*(depth-bootPocket)*shoulder;
      const sideSlope=(width-profile.sideAt(1,z-dir*.025,y)[0])/(dir*.025);
      const join=sideSlope*dz*smooth(.84,1,a);
      return [Math.sign(u)*(sx*width+join+offset*corner),y,z+dz+dir*offset*(1-.68*corner)];
    };
  }
  function faceAtX(surface,x,y,offset=0) {
    let lo=0,hi=1;
    for(let i=0;i<12;i++){
      const u=.5*(lo+hi);
      if(surface(u,y)[0]<Math.abs(x))lo=u;else hi=u;
    }
    return surface(Math.sign(x)*.5*(lo+hi),y,offset);
  }
  function band(b, finish, point, u0, u1, y0, y1, color, depth0 = 0, depth1 = depth0) {
    const normal = point(0,.45)[2] < 0 ? front : rear;
    b.patch(finish, Math.max(4,Math.ceil(25*Math.abs(u1-u0))), Math.max(1,Math.ceil((y1-y0)/.012)), (u,v) =>
      point(mix(u0,u1,u),mix(y0,y1,v),mix(depth0,depth1,v)), normal, color);
  }

  function surfaceFinishes(api) {
    const grain=api.texture(96,96,(ctx,w,h)=>{
      const img=ctx.createImageData(w,h);
      let seed=160087;
      for(let i=0;i<img.data.length;i+=4){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        const value=170+Math.floor((seed/4294967296)*77);
        img.data[i]=img.data[i+1]=img.data[i+2]=value;img.data[i+3]=255;
      }
      ctx.putImageData(img,0,0);
    });
    grain.colorSpace=THREE.NoColorSpace;
    grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(14,2);
    const moulding=api.materials.satin.clone();
    moulding.roughness=.57;moulding.clearcoat=.34;moulding.clearcoatRoughness=.24;
    moulding.roughnessMap=grain;moulding.bumpMap=grain;moulding.bumpScale=.0005;
    api.materials.moulding=moulding;
    // Cut sectors of the reflector return the filament and the surroundings at
    // different angles. Only the thin periphery of this lens is fluted.
    const prism=api.texture(384,256,(ctx,w,h)=>{
      const img=ctx.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=(x+.5)/w,v=(y+.5)/h,px=(u-.5)*2,py=(.5-v)*2;
        const radius=Math.hypot(.91*px,.87*py);
        const zone=Math.floor((px+1)*3)+7*Math.floor((py+1)*2.5);
        const offset=.058*Math.cos(zone*11.78);
        const sag=py+.32*px*px+.12*Math.sin(5*px)+offset;
        const bar=Math.exp(-((sag+.36)**2)/.018)+.63*Math.exp(-((sag-.49)**2)/.031);
        const crosslight=Math.exp(-((px+.31*py-.35-offset)**2)/.044);
        const contour=Math.exp(-((px-.34*py+.42+.1*Math.sin(5*py))**2)/.032);
        const rim=smooth(.68,.99,Math.max(Math.abs(px),Math.abs(py)));
        const prism=.058*rim*Math.cos(2*Math.PI*(u*29+.22*py));
        const cuts=.12*Math.exp(-((sag+.46)**2)/.0015)+.09*Math.exp(-((px-.29*py+.37)**2)/.0018);
        const glint=.18*Math.exp(-((sag+.24+offset)**2)/.0029)+
          .09*smooth(.53,.89,Math.abs(px))*(.5+.5*Math.cos(u*106+.93*py))**9;
        const source=Math.exp(-((px-.11)**2/.058+(py+.055)**2/.071));
        const value=clamp(.33+.14*(1-radius)+.035*Math.cos(zone*8.3)+
          .38*bar+.31*crosslight+.24*contour+.41*source+prism+glint-cuts,.17,1)*255;
        const k=(y*w+x)*4;
        img.data[k]=value;img.data[k+1]=value;img.data[k+2]=value;img.data[k+3]=255;
      }
      ctx.putImageData(img,0,0);
    });
    for(const key of ['head','fog']){
      const mat=api.materials[key];
      mat.map=prism;mat.emissiveMap=prism;mat.metalness=.46;mat.roughness=.17;
      mat.emissiveIntensity=key==='head'?1.34:1.84;
      const silver=mat.clone();
      silver.metalness=.59;silver.roughness=.20;silver.emissiveIntensity=mat.emissiveIntensity*.72;
      api.materials[key+'Facet']=silver;
    }
    const cells=api.texture(192,96,(ctx,w,h)=>{
      const img=ctx.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=(x+.5)/w,v=(y+.5)/h;
        const flute=(v*12)%1,cell=(u*24+.10*Math.sin(v*10))%1;
        const rib=.20*Math.exp(-((flute-.19)**2)/.020),glint=.13*Math.exp(-((cell-.25)**2)/.035);
        const k=(y*w+x)*4,val=clamp(.51+.12*Math.sin(v*4)+.10*Math.cos(cell*2*Math.PI)+rib+glint,.20,1)*255;
        img.data[k]=val;img.data[k+1]=val;img.data[k+2]=val;img.data[k+3]=255;
      }
      ctx.putImageData(img,0,0);
    });
    api.materials.amber.map=cells;api.materials.amber.emissiveMap=cells;
    const corner=api.materials.amber.clone();
    corner.map=api.texture(144,96,(ctx,w,h)=>{
      const img=ctx.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=x/w,v=y/h,groove=.5+.5*Math.cos(22*Math.PI*v);
        const val=149+28*groove**4+19*Math.sin(2.4*u+.7*v)+20*(1-v);
        const k=4*(y*w+x);img.data[k]=img.data[k+1]=img.data[k+2]=val;img.data[k+3]=255;
      }
      ctx.putImageData(img,0,0);
    });
    corner.emissiveMap=corner.map;corner.roughness=.22;corner.emissiveIntensity=.14;
    api.materials.markerAmber=corner;
    const reverse=api.materials.metal.clone();
    reverse.map=api.texture(112,86,(ctx,w,h)=>{
      const img=ctx.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=2*(x+.5)/w-1,v=2*(y+.5)/h-1,r=Math.hypot(u*.93,v*.8);
        const a=Math.atan2(v,u);
        const glint=Math.exp(-((1.1*u+.60*v-.15)**2)/.10);
        const led=Math.exp(-((u-.14)**2/.060+(v+.05)**2/.084));
        const value=clamp(.41+.29*Math.exp(-((r-.61)**2)/.020)+.10*Math.cos(a*7)+
          .26*glint+.43*led+.055*Math.sin(u*35),.23,1)*255;
        const k=(y*w+x)*4;
        img.data[k]=value;img.data[k+1]=value;img.data[k+2]=value;img.data[k+3]=255;
      }
      ctx.putImageData(img,0,0);
    });
    reverse.roughness=.19;reverse.metalness=.52;
    reverse.emissive.setHex(0x16191a);reverse.emissiveMap=reverse.map;
    api.materials.clearCells=reverse;
    const lens=api.materials.optic.clone();
    lens.color.setHex(0xf9e5e1);lens.opacity=.13;lens.roughness=.078;lens.clearcoat=.8;
    api.materials.smokeLens=lens;
    const numberLight=api.materials.optic.clone();
    numberLight.transparent=false;numberLight.depthWrite=true;numberLight.opacity=1;
    numberLight.color.setHex(0xd7edf8);numberLight.emissive.setHex(0xafc9f6);numberLight.emissiveIntensity=.85;
    api.materials.numberLight=numberLight;
  }

  // A sealed beam contains a recessed fluted reflector, a luminous filament and
  // a separately crowned glass face. Clear regions retain the surrounding reflections.
  function sealedBeam(api, point, width, height, fogLamp) {
    const {b} = api;
    const edge = roundedRect(width,height,Math.min(.024,height*.18),6);
    const at = (scale, depth) => edge.map(([x,y]) => point(x*scale,y*scale,depth));
    ring(b, 'rubber', at(1.11,.001), at(1.035,.011), front, gasket);
    ring(b, 'metal', at(1.035,.011), at(.969,.012), front, fogLamp ? 0xa5823b : 0x96948d);
    ring(b, 'trim', at(.969,.012), at(.929,.006), front, 0x252722);
    const glow = fogLamp ? 'fog' : 'head';
    const hw=width*.467,hh=height*.467,r=Math.min(.020,hh*.34);
    const local=(u,v)=>{
      const x=(2*u-1)*hw;
      const dx=Math.max(0,Math.abs(x)-(hw-r));
      return [x,(2*v-1)*(hh-r+Math.sqrt(Math.max(0,r*r-dx*dx)))];
    };
    b.patch(glow,26,12,(u,v)=>{
      const [x,y]=local(u,v),radial=(x/hw)**2*.44+(y/hh)**2*.56;
      return point(x,y,-.024+.024*radial);
    },front,fogLamp?0xffd476:0xf7f2e3,(u,v)=>[u,v]);
    // Separate parabolic facets keep their own normals as the car rotates.
    const vertex=(a,r)=>{
      const c=Math.cos(a),s=Math.sin(a),outline=(c**6+s**6)**(-1/6);
      return [hw*r*c*outline,hh*r*s*outline,-.018+.025*r*r];
    };
    for(const [r0,r1,count,phase] of [[.13,.40,8,.13],[.40,.68,11,.20],[.68,.966,16,.08]]){
      for(let i=0;i<count;i++){
        const a=(i/count)*2*Math.PI+phase,da=2*Math.PI/count;
        const verts=[vertex(a,r0),vertex(a+da,r0),vertex(a+da,r1),vertex(a,r1)];
        const shade=(i+Math.floor(r1*13))%5;
        const mirror=shade===0||shade===3;
        const color=mirror?(fogLamp?0xf7cb79:0xf5f1e5):(fogLamp?0xffdb87:0xf9f1e2);
        const localNormals=verts.map(([x,y])=>{
          const n=new THREE.Vector3(-.040*x/(hw*hw)+.053*Math.sin(i*3.1),
            -.037*y/(hh*hh)+.051*Math.cos(i*5.3),-1);
          return n.normalize().toArray();
        });
        b.face(mirror?glow+'Facet':glow,verts.map(([x,y,d])=>point(x,y,d)),front,color,
          verts.map(([x,y])=>[.5+x/(2*hw),.5+y/(2*hh)]),localNormals);
      }
    }
    const cap=spline([point(-hw*.12,-hh*.085,-.006),point(-hw*.02,hh*.025,.004),
      point(hw*.073,hh*.005,.004),point(hw*.115,-hh*.04,-.005)],8);
    api.tube(b,'chrome',cap,.0023,fogLamp?0xcbab70:0xe1ddd5,6);
    b.patch('chrome',14,6,(u,v)=>{
      const a=2*Math.PI*u,r=.002+.0090*v;
      return point(.003+r*Math.cos(a),-.002+.78*r*Math.sin(a),.004+.007*(1-v*v));
    },front,fogLamp?0xdfbf80:0xe4ded0);
    b.patch(glow,5,2,(u,v)=>point((u-.45)*width*.075,(v-.5)*height*.025,.005),front,
      fogLamp?0xffe1a1:0xfff6dc,()=>[.64,.43]);
    b.patch('optic',60,9,(u,v)=>{
      const [x,y]=local(u,v),arc=1-.48*(x/hw)**2-.52*(y/hh)**2;
      return point(x,y,.010+.005*arc+.0002*Math.cos(2*Math.PI*27*u)*smooth(.64,1,Math.abs(x/hw)));
    },front,fogLamp?0xffd252:0xf3f1e7);
  }

  function raisedHeadlights(api, nose) {
    const {b,profile} = api;
    for(const side of [-1,1]){
      const centre=.637*side, zFront=profile.frontZ-.030, zBack=-1.775;
      const hood = (x,z) => profile.deckAt(z,clamp(x/profile.halfWidth(z),-.994,.994))[1];
      const top=hood(centre,profile.frontZ)+.158, bottom=top-.190, mid=(top+bottom)*.5;
      const housing=(s,t,upper)=>{
        const x=centre+(s-.5)*mix(.247,.216,t);
        const z=mix(zFront,zBack,t)+.013*(2*s-1)**2;
        const y=upper ? mix(top,hood(x,z)+.014,t)+.006*(1-(2*s-1)**2) :
          mix(bottom,hood(x,z)-.011,t);
        return [x,y,z];
      };
      b.patch('rubber',8,4,(u,v)=>{
        const x=centre+(u-.5)*.261,z=mix(profile.frontZ+.015,zBack+.018,v);
        return [x,hood(x,z)+.003,z];
      },up,0x131518);
      b.patch('paint',12,8,(u,v)=>housing(u,v,true),up,pearl);
      for(const [s,n] of [[0,[-1,0,0]],[1,[1,0,0]]]){
        b.patch('trim',8,2,(u,v)=>blend(housing(s,u,false),housing(s,u,true),v),n,0x25272a);
        b.patch('paint',8,1,(u,v)=>{
          const p=housing(s,u,true);
          return [p[0],p[1]-.006*(1-v),p[2]];
        },n,pearl);
      }
      const bezelPoint=(x,y,d=0)=>{
        const r=x/.123;
        return [centre+x,mid+y,zFront+.015+.018*(y/.184)+.007*r*r-d];
      };
      const outer=roundedRect(.248,.190,.010,6).map(([x,y])=>bezelPoint(x,y,.0005));
      const inner=roundedRect(.207*1.11,.139*1.11,.024*1.11,6).map(([x,y])=>bezelPoint(x,y,.001));
      ring(b,'rubber',outer,inner,front,gasket);
      roundPanel(b,'rubber',(x,y)=>bezelPoint(x,y,-.033),front,.248,.186,.010,gasket);
      sealedBeam(api,bezelPoint,.207,.139,false);
      const plinth=(u,v)=>{
        const x=(u-.5)*.253,base=faceAtX(nose,centre+x,.497,-.003),p=bezelPoint(x,-.093);
        const q=blend(base,p,v);q[1]+=.0018*Math.sin(Math.PI*v);return q;
      };
      b.patch('trim',20,7,plinth,[0,.65,-1],0x242729);
      for(const s of [0,1]){
        b.patch('rubber',8,2,(u,v)=>{
          const p=plinth(s,u);p[2]+=.032*v;p[1]-=.005*v;return p;
        },[2*s-1,0,0],0x191b1d);
      }
      // The gloss-black eyebrow rolls over the leading edge of the white popup lid.
      const brow=(u,v)=>{
        const a=2*u-1,z=mix(zFront-.019,zFront+.046,v)+.008*a*a;
        const slope=smooth(0,.22,v);
        return [centre+a*(.127+.0015*Math.sin(Math.PI*v)),
          top+.002+.006*(1-a*a)+.003*Math.sin(Math.PI*v)-.009*(1-slope),z];
      };
      b.patch('blackGlass',24,10,brow,[0,1,-.32],0x222327);
      b.patch('blackGlass',24,3,(u,v)=>blend(bezelPoint((u-.5)*.246,.081,.0008),brow(u,0),v),
        front,0x191a1d);
      for(const s of [0,1])b.patch('trim',7,2,(u,v)=>{
        const p=brow(s,u);p[1]-=.006*(1-v);return p;
      },[2*s-1,0,0],0x1e2022);
      api.rod(b,'trim',housing(.09,1,true),housing(.91,1,true),.0035,0x26272a,7);
      const marker=(t,v,d=0)=>{
        const rim=.0035*smooth(0,.045,t)*(1-smooth(.92,1,t));
        const y=.498+rim+(.044-.010*t)*v;
        if(t<=.70)return nose(side*mix(.831,.997,t/.70),y,d+.004);
        const e=nose(side*.997,y,d+.004),k=(t-.70)/.30;
        const z=mix(e[2],profile.frontZ+.072,k);
        return [mix(e[0],profile.sideAt(side,z,y,d+.005)[0],smooth(0,.78,k)),y,z];
      };
      b.patch('rubber',36,4,(u,v)=>marker(u,v),[side*.44,0,-1],gasket);
      b.patch('markerAmber',36,6,(u,v)=>marker(mix(.012,.984,u),mix(.067,.934,v),.0018),
        [side*.44,0,-1],0xd99333);
      for(let n=1;n<7;n++)b.patch('optic',28,1,(u,v)=>marker(mix(.019,.978,u),n/7+.013*v,.0028),
        [side*.44,0,-1],0xd79544);
    }
  }

  function* frontFascia(api) {
    const {b,profile}=api, nose=makeEnd(profile,false);
    // Roll the leading edge under the hood. The reveal directly below is an open
    // dark horizontal grille between the raised lamps.
    for(const [lo,hi] of [[-1,-.841],[-.600,.600],[.841,1]]){
      b.patch('paint',Math.ceil((hi-lo)*32),5,(u,v)=>{
        const a=mix(lo,hi,u),outer=Math.abs(a)>.83;
        const endHeight=outer?.542-.009*smooth(.841,1,Math.abs(a)):profile.deckAt(profile.frontZ,a)[1]-.012;
        const end=nose(a,endHeight),frac=outer?end[0]/profile.halfWidth(profile.frontZ):a;
        const deck=profile.deckAt(profile.frontZ,clamp(frac,-1,1));
        const p=blend(deck,end,v);
        p[1]+=.003*Math.sin(v*Math.PI);
        return p;
      },[0,.8,-.4],pearl);
    }
    b.patch('trim',68,4,(u,v)=>{
      const a=2*u-1,hi=mix(profile.deckAt(profile.frontZ,a)[1]-.017,.528,smooth(.828,.854,Math.abs(a)));
      const hole=smooth(.581,.607,Math.abs(a))*(1-smooth(.837,.861,Math.abs(a)));
      return nose(a,mix(.496,mix(hi,.539,hole),v),-.038*hole-.010*Math.sin(Math.PI*v));
    },front,0x1b1e20);
    b.patch('blackGlass',50,5,(u,v)=>{
      const a=mix(-.84,.84,u),hole=smooth(.59,.64,Math.abs(a));
      const hi=mix(profile.deckAt(profile.frontZ,a)[1]-.012,.537,hole);
      return nose(a,mix(.498,hi,v),-.0007+.003*Math.sin(Math.PI*v)-.034*hole);
    },front,0x181a1d);
    b.patch('moulding',66,5,(u,v)=>{
      const a=2*u-1,hole=smooth(.58,.62,Math.abs(a))*(1-smooth(.83,.88,Math.abs(a)));
      const p=nose(a,.496+.001*v,-v*(.005+.052*hole));
      p[1]+=.0015*Math.sin(Math.PI*v);return p;
    },[0,1,-.11],bumper);
    band(b,'moulding',nose,-1,1,.443,.497,bumper);
    band(b,'satin',nose,-1,1,.391,.443,0x313438);
    for(const s of [-1,1]){
      band(b,'paint',nose,s*.800,s,.392,.442,pearl,.002);
      const cx=s*.748;
      const point=(x,y,d=0)=>nose(cx+x/.851,.418+y,d+.002);
      curvedPanel(b,'rubber',(x,y)=>point(x,y),front,.183,.058,.007,0x111316);
      curvedPanel(b,'amber',(x,y)=>point(x,y,.004),front,.174,.047,.005,0xee9a32);
      for(const x of [-.075,.075]) roundPanel(b,'metal',(a,h)=>point(a+x,h,.0057),front,.007,.007,.0035,0xa07b50);
    }
    const blank=(x,y,d=0)=>nose(x/.851,.417+y,d+.002);
    roundPanel(b,'rubber',(x,y)=>blank(x,y),front,.899,.062,.009,0x141719);
    curvedPanel(b,'moulding',(x,y)=>blank(x,y,.002),front,.880,.047,.006,0x43484b);
    band(b,'trim',nose,-1,1,.364,.391,0x25282a);
    band(b,'satin',nose,-1,1,.327,.364,0x292b2c,-.009);

    // Lower bumper has three openings with returned edges that reveal their depth.
    // Coordinates here are horizontal fractions of the bumper width in front view.
    const low=.152, high=.327;
    const centreEdge=v=>mix(.474,.520,v);
    const innerFog=v=>mix(.578,.611,v), outerFog=v=>mix(.809,.842,v);
    function pillar(s, left, right, color) {
      b.patch('satin',7,4,(u,v)=>nose(s*mix(left(v),right(v),u),mix(low,high,v)),front,color);
    }
    function reveal(s, rail, normalSign){
      b.patch('trim',5,2,(u,v)=>nose(s*rail(u),mix(low,high,u),mix(-.063,0,v)),
        [normalSign*s,.02,-.10],0x222527);
    }
    for(const s of [-1,1]){
      pillar(s,centreEdge,innerFog,bumper); pillar(s,outerFog,()=>1,0x212426);
      reveal(s,centreEdge,-1); reveal(s,innerFog,1); reveal(s,outerFog,-1);
      const fogCentre=s*.735;
      const point=(x,y,d=0)=>nose(fogCentre+x/.852,.242+y,-.041+d);
      if(s===1&&api.lampSources)api.lampSources.fog=point(0,0,.014);
      b.patch('trim',8,2,(u,v)=>nose(s*mix(innerFog(v),outerFog(v),u),mix(low,high,v),-.065),
        front,0x131518);
      const outer=roundedRect(.174,.130,.011,6).map(([x,y])=>point(x,y));
      const inner=roundedRect(.144*1.11,.091*1.11,.0164*1.11,6).map(([x,y])=>point(x,y,.001));
      ring(b,'trim',outer,inner,front,0x25292a);
      roundPanel(b,'trim',(x,y)=>point(x,y,-.030),front,.174,.130,.011,0x202325);
      sealedBeam(api,point,.144,.091,true);
    }
    const radiator=(u,v,d=0)=>nose(mix(-.53,.53,u),mix(.145,.333,v),-.095+d);
    b.patch('rubber',30,3,(u,v)=>radiator(u,v),front,0x12171a);
    for(let i=0;i<15;i++){
      const h=.035+i*.065;
      b.patch('metal',20,1,(u,v)=>radiator(u,h+v*.010,.003),
        front,i%3===0?0x666a66:0x464c4b);
    }
    for(const u of [.10,.31,.69,.90]){
      b.patch('satin',1,2,(s,t)=>radiator(u+(s-.5)*.016,t,.006),front,0x242728);
    }
    b.patch('metal',22,4,(u,v)=>radiator(mix(.094,.906,u),.064+.062*v,.010+.004*Math.sin(Math.PI*v)),front,0x858a81);
    for(const u of [.120,.877]) b.patch('satin',2,4,(s,t)=>radiator(u+(s-.5)*.013,t*.26,.016),
      front,0x323534);
    for(const y of [high,low]){
      b.patch('satin',40,2,(u,v)=>nose(2*u-1,y,mix(-.079,0,v)),
        y===high?down:up,y===high?0x242526:0x393b3b);
    }
    band(b,'satin',nose,-1,1,.124,.152,0x25282a,.004,0);
    band(b,'satin',nose,-1,1,.099,.124,0x25282b,.008,.004);
    band(b,'trim',nose,-1,1,.088,.099,0x17191b,-.015,.008);
    b.patch('rubber',36,2,(u,v)=>{
      const p=nose(2*u-1,.093,-.008);
      p[2]=mix(p[2],-1.71,v);
      return p;
    },down,0x1b1e21);
    yield;
    raisedHeadlights(api,nose);yield;
  }

  // The first-generation combination lamp follows the curved upper corner
  // of the NEO bumper. Only its short outer return is visible in a true side view.
  const lampTurn=.79,lampCornerX=.837;
  function lensCurve(stations){
    const curve=new THREE.CubicInterpolant(stations.map(k=>k[0]),stations.map(k=>k[1]),1);
    return t=>curve.evaluate(t)[0];
  }
  const lensBrow=lensCurve([[0,.69],[.014,.784],[.045,.819],[.19,.842],[.37,.886],
    [.56,.931],[.74,.975],[.81,.980],[.89,.939],[.95,.843],[1,.668]]);
  const lensFloor=lensCurve([[0,.69],[.014,.535],[.042,.454],[.20,.451],[.30,.427],
    [.40,.320],[.50,.180],[.59,.100],[.68,.089],[.76,.143],[.84,.256],[.92,.413],[1,.668]]);
  const lampHeight=(t,h)=>.625+.218*h+.006*smooth(.16,.80,t);
  const lampX=(t,h)=>mix(.500+.042*(1-h),lampCornerX,t/lampTurn);
  function lampTopAt(x){
    const station=inner=>clamp(lampTurn*(x-inner)/(lampCornerX-inner),0,lampTurn);
    const t=station(lampX(0,lensBrow(station(.507))));
    return lampHeight(t,lensBrow(t));
  }

  function rearLamps(api,back){
    const {b,profile,tube}=api;
    for(const side of [-1,1]){
      const outward=[side*.29,0,1];
      const face=(t,h,depth=0)=>{
        const y=lampHeight(t,h),proud=.0012+.42*depth;
        if(t<=lampTurn)return faceAtX(back,side*lampX(t,h),y,proud);
        const k=(t-lampTurn)/(1-lampTurn),start=faceAtX(back,side*lampCornerX,y,proud);
        const cap=clamp((k-.66)/.34,0,1);
        const z=mix(start[2],1.863,k+.34*cap*cap*(1-cap)),flank=profile.sideAt(side,z,y,proud+.0015);
        const round=.006*smooth(0,.16,k)*(1-smooth(.57,.94,k));
        return [mix(start[0],flank[0],smooth(0,.46,k))+side*round,y,z];
      };
      const lens=(t,v,depth=0)=>face(t,mix(lensFloor(t),lensBrow(t),v),depth);
      b.patch('blackGlass',68,10,(t,v)=>lens(t,v,.0025+.009*smooth(.69,.89,t)),outward,0x321d25);
      for(const edge of [0,1]){
        b.patch('trim',68,3,(t,v)=>lens(t,edge,mix(-.003,.010,v)),
          [side*.28,edge?1:-1,.55],0x292428);
        b.patch('blackGlass',68,4,(t,v)=>lens(t,edge,mix(.010,.028,v)),
          [side*.38,edge?1:-1,.48],0x642834);
      }
      const perimeter=[];
      for(let i=0;i<=64;i++)perimeter.push(lens(i/64,1,.006));
      for(let i=63;i>=0;i--)perimeter.push(lens(i/64,0,.006));
      tube(b,'rubber',perimeter,.0023,0x2a2326,7);

      // The shallow row of nickel reflector cups sits above the hooked return.
      // An individual cut lens covers each LED on the common smoked backplate.
      const bank=(q,v,depth)=>{
        const t=mix(.039,.707,q),h=.567+.063*q+.085*(v-.5)*2;
        return face(t,h,depth);
      };
      b.patch('blackGlass',38,6,(u,v)=>bank(u,v,.0083),outward,0x222226);
      for(const edge of [0,1])b.patch('metal',34,2,(u,v)=>bank(u,edge?mix(.933,.982,v):mix(.018,.061,v),.0107),
        outward,0x777b7d);
      for(let i=0;i<9;i++){
        const q=(i+.5)/9;
        const cup=(a,h,d)=>bank(q+.050*a,.53+.38*h,d);
        b.patch('clearCells',10,7,(u,v)=>{
          const x=u*2-1,y=(v*2-1)*Math.sqrt(Math.max(0,1-x*x)),r=x*x+y*y;
          return cup(x,y,.0106+.0034*r+.0006*r*Math.cos(7*Math.atan2(y,x)));
        },outward,i%3===0?0x9c9698:0x827f84);
        b.patch('blackGlass',10,3,(u,v)=>{
          const a=2*Math.PI*u;
          return cup(.20*v*Math.cos(a),.25*v*Math.sin(a),.0123);
        },outward,0x414044);
        b.patch('optic',6,2,(u,v)=>cup((u-.38)*.70,.34-.30*u+.070*v,.0143),outward,0xdad5d1);
      }
      const divider=spline([[.042,.437],[.196,.439],[.290,.420],[.388,.364],[.476,.296],
        [.561,.271],[.640,.275],[.695,.311]].map(([t,h])=>face(t,h,.012)),36);
      tube(b,'blackGlass',divider,.0059,0x4e252c,8);

      // One open J-shaped light pipe has a long upper arm, a round outside
      // bend, and a short lower hook ending under the reflector bank.
      const anchors=[[.044,.760],[.170,.787],[.350,.814],[.514,.844],[.632,.873],
        [.694,.865],[.735,.818],[.762,.731],[.774,.628],[.768,.516],[.744,.409],
        [.707,.320],[.659,.253],[.601,.216],[.541,.209],[.492,.229],[.452,.260]];
      const rail=new THREE.CatmullRomCurve3(anchors.map(([t,h])=>new THREE.Vector3(...face(t,h,.0155))),
        false,'centripetal');
      const frames=Array.from({length:73},(_,i)=>{
        const t=i/72,point=rail.getPointAt(t),tangent=rail.getTangentAt(t);
        const n=new THREE.Vector3(side*.36*smooth(.63,.843,Math.abs(point.x)),.025,1).normalize();
        const across=new THREE.Vector3().crossVectors(tangent,n).normalize();
        n.crossVectors(across,tangent).normalize();
        return {point,n,across};
      });
      const section=(u,v,width,thickness,depth)=>{
        const {point,n,across}=frames[Math.round(72*u)],h=v*2-1;
        const taper=(.55+.45*smooth(0,.024,u))*(1-.65*smooth(.942,1,u));
        return point.clone().addScaledVector(across,width*h*taper)
          .addScaledVector(n,.42*(depth+thickness*Math.sqrt(Math.max(0,1-h*h)))).toArray();
      };
      b.patch('blackGlass',72,8,(u,v)=>section(u,v,.0152,.0059,.0004),outward,0x7a2331);
      b.patch('tail',72,8,(u,v)=>section(u,v,.0120,.0046,.0042),outward,0xb82b37);
      b.patch('brake',72,7,(u,v)=>section(u,v,.0080,.0025,.0074),outward,0xce4748);
      if(side===1){
        const pos=i=>frames[i].point.toArray();
        api.lampSources.tailInner=pos(0);api.lampSources.tailOuter=pos(29);
        api.lampSources.tailBottom=pos(55);api.lampSources.tailReturn=pos(72);
      }
      for(const v of [.26,.45,.64,.83])b.patch('clearCells',18,3,(u,h)=>{
        const t=mix(.795,.956,u);
        return lens(t,v+.047*h,.0132+.0010*Math.sin(Math.PI*h));
      },[side,.03,.5],0x872d38);
      b.patch('smokeLens',68,10,(u,v)=>lens(u,v,.028+.005*Math.sin(Math.PI*v)),outward,0xc19699);
    }
  }

  function ducktail(api,back) {
    const {b,profile,rearDeck,tube}=api;
    const aftWidth=.755,rearZ=profile.rearZ,fullWidth=profile.halfWidth(rearZ);
    const radius=u=>.0056*(1-smooth(.85,1,Math.abs(u)));
    const hermite=(from,to,m0,m1,t)=>
      mix(from,to,t*t*(3-2*t))+t*(1-t)*(m0*(1-t)-m1*t);
    const deckPoint=(q,z)=>rearDeck.deck(z,q*rearDeck.outerU(z));
    const startZ=rearDeck.start,flatStart=1.847,bladeY=.948,bladeZ=2.122;
    const profiles=new Map();
    function column(x){
      if(profiles.has(x))return profiles.get(x);
      const dx=Math.abs(x),q=x/fullWidth;
      const base=deckPoint(q,rearZ),landing=faceAtX(back,x,base[1]-.012);
      landing[0]=x;
      // A level transverse plane and one straight trailing edge span the
      // kit's blade. Only its short outer end caps sweep into the quarters.
      const blade=1-smooth(.603,.700,dx),seat=smooth(.625,.689,dx)*(1-smooth(.804,fullWidth,dx));
      const lampY=lampTopAt(dx),lampZ=seat?faceAtX(back,x,lampY)[2]:landing[2];
      const endZ=Math.max(rearZ,mix(mix(landing[2],lampZ,seat),bladeZ,blade));
      const shoulder=mix(landing[1],lampY+.004,smooth(.485,.63,dx)*(1-smooth(.762,fullWidth,dx)));
      const opening=deckPoint(q,startZ)[1];
      const openingSlope=(deckPoint(q,startZ+.001)[1]-deckPoint(q,startZ-.001)[1])/.002;
      const result={x,q,base,landing,endZ,blade,shoulder,opening,openingSlope,lampY,
        shape:1-smooth(.756,fullWidth,dx)};
      profiles.set(x,result);
      return result;
    }
    function topAt(c,z){
      const run=flatStart-startZ,span=c.endZ-startZ;
      const flat=z<flatStart?hermite(c.opening,bladeY,c.openingSlope*run,0,(z-startZ)/run):bladeY;
      const flank=hermite(c.opening,c.shoulder,c.openingSlope*span,.88*(c.shoulder-c.opening),(z-startZ)/span);
      const cap=clamp((z-rearZ)/Math.max(.00001,c.endZ-rearZ),0,1);
      const p=z<=rearZ?deckPoint(c.q,z):[c.x,mix(c.base[1],c.landing[1],smooth(0,1,cap)),z];
      p[1]=mix(p[1],mix(flank,flat,c.blade),c.shape);
      return p;
    }
    const rearSkin=(u,v)=>{
      const c=column(u*aftWidth),p=blend(c.landing,topAt(c,c.endZ),v);
      // The lower part of the boot tucks back under the kit's rolled lip.
      // The shallow, upright nose of the blade carries the high stop lamp.
      const fold=.13*v*(2-v)+.87*smooth(.40,.78,v);
      p[2]=mix(c.landing[2],c.endZ,mix(v,fold,1-smooth(.62,.719,Math.abs(c.x))));
      p[1]-=radius(u)*smooth(.81,1,v);
      const x=Math.abs(p[0]);
      if(x>.506 && p[1]<c.lampY+.019){
        const socket=smooth(.506,.535,x)*(1-smooth(.817,fullWidth,x))*(1-smooth(c.lampY+.001,c.lampY+.019,p[1]));
        const clearance=faceAtX(back,p[0],p[1])[2]+.0008;
        p[2]-=Math.max(0,p[2]-clearance)*socket;
      }
      return p;
    };

    // A physical slot in the white face permits the lens to sit behind the
    // stamping and keeps the narrow high-mounted stop lamp unbroken at oblique angles.
    const center=.923,halfWidth=.164,halfHeight=.0103,corner=.0074;
    const slotHeight=x=>{
      const dx=Math.max(0,Math.abs(x)-(halfWidth-corner));
      return halfHeight-corner+Math.sqrt(Math.max(0,corner*corner-dx*dx));
    };
    const heightAt=(u,y)=>{
      let lo=0,hi=1;
      for(let i=0;i<12;i++){
        const v=(lo+hi)*.5;
        if(rearSkin(u,v)[1]<y)lo=v;else hi=v;
      }
      return .5*(hi+lo);
    };
    const rails=(width,r)=>{
      const points=[];
      for(let i=0;i<8;i++)points.push(-width+r*(1-Math.cos(i*Math.PI/16)));
      for(let i=0;i<=24;i++)points.push(mix(-width+r,width-r,i/24));
      for(let i=7;i>=0;i--)points.push(width-r*(1-Math.cos(i*Math.PI/16)));
      return points;
    };
    const aperture=rails(halfWidth,corner);
    const stations=(a,c,n)=>Array.from({length:n+1},(_,i)=>mix(a,c,i/n));
    const shoulder=stations(halfWidth,aftWidth,42),edge=stations(aftWidth,fullWidth,9);
    const outside=shoulder.slice(1).concat(edge.slice(1));
    const xs=outside.map(x=>-x).reverse().concat(aperture,outside);
    // The preceding rear-window reveal has 68 transverse spans and both
    // quarter tops have five. Carry every vertex of those polylines into this row.
    const foot=rearDeck.footU(startZ),outer=rearDeck.outerU(startZ);
    const startWidth=profile.halfWidth(startZ)*outer;
    const sill=stations(-outer,-foot,5).slice(0,-1).concat(stations(-foot,foot,68),stations(foot,outer,5).slice(1));
    const incoming=sill.map(a=>rearDeck.deck(startZ,a)),opening=[incoming[0]];
    let begin=0;
    for(let j=1;j<incoming.length;j++){
      const x=fullWidth*sill[j]/outer,last=xs.length-incoming.length+j;
      let end=begin+1;
      while(end<last&&Math.abs(xs[end+1]-x)<Math.abs(xs[end]-x))end++;
      for(let i=begin+1;i<=end;i++)opening[i]=blend(incoming[j-1],incoming[j],(i-begin)/(end-begin));
      begin=end;
    }
    const bodyRows=32,capRows=9,roundRows=7,rows=bodyRows+capRows+roundRows;
    // One skin runs from the lower backlight to the rolled trailing edge.
    // All adjoining patches share their stations, including the two shoulders.
    b.patch('paint',xs.length-1,rows,(u,v)=>{
      const i=Math.round(u*(xs.length-1)),c=column(xs[i]),row=Math.round(v*rows),r=radius(c.x/aftWidth);
      if(row===0)return opening[i];
      if(row<=bodyRows){
        const z=mix(startZ,profile.rearZ,row/bodyRows);
        const q=mix(opening[i][0]/startWidth,c.q,smooth(startZ,startZ+.12,z));
        return topAt(column(q*fullWidth),z);
      }
      if(row<=bodyRows+capRows){
        const t=(row-bodyRows)/capRows,p=topAt(c,mix(profile.rearZ,c.endZ,t));
        p[2]-=r*smooth(.42,1,t);return p;
      }
      const angle=(row-bodyRows-capRows)*Math.PI/(2*roundRows),p=topAt(c,c.endZ);
      p[1]-=r*(1-Math.cos(angle));p[2]-=r*(1-Math.sin(angle));return p;
    },(u,v)=>v>(bodyRows+capRows)/rows?[0,1,1]:up,pearl);
    const quarter=shoulder.concat(edge.slice(1));
    const lowerSlot=heightAt(halfWidth/aftWidth,center-slotHeight(halfWidth));
    const upperSlot=heightAt(halfWidth/aftWidth,center+slotHeight(halfWidth));
    for(const side of [-1,1]){
      b.patch('paint',quarter.length-1,14,(t,v)=>{
        const x=side*quarter[Math.round(t*(quarter.length-1))];
        // Carry the two aperture edges and their six rows into the solid
        // quarter. A hanging vertex on this folded face opens a visible crack.
        const row=Math.round(14*v),shared=row<=6?lowerSlot*row/6:
          row<=8?mix(lowerSlot,upperSlot,(row-6)/2):mix(upperSlot,1,(row-8)/6);
        return rearSkin(x/aftWidth,mix(shared,v,smooth(halfWidth,.33,Math.abs(x))));
      },rear,pearl);
    }
    for(const high of [false,true]){
      b.patch('paint',aperture.length-1,6,(t,v)=>{
        const x=aperture[Math.round(t*(aperture.length-1))];
        const u=x/aftWidth,limit=heightAt(u,center+(high?1:-1)*slotHeight(x));
        return rearSkin(u,high?mix(limit,1,v):v*limit);
      },rear,pearl);
    }

    // Each luggage opening runs from the lower glass corner onto this skin,
    // turns over the lip and meets the lamp gasket. Follow its measured
    // incoming position and tangent so the two stampings share one shutline.
    const edgeX=.674,edgeEnd=column(edgeX).endZ,span=edgeEnd-startZ;
    const joint=rearDeck.shutline(1,1),prior=rearDeck.shutline(1,.997);
    const tangent=(joint[0]-prior[0])/(joint[2]-prior[2]);
    const edgeAt=z=>hermite(joint[0],edgeX,span*tangent,.117*span,clamp((z-startZ)/span,0,1));
    const r=radius(edgeX/aftWidth),finish=heightAt((edgeX-.0035)/aftWidth,lampTopAt(edgeX-.0035)+.0006);
    for(const s of [-1,1]){
      const path=[];
      for(let k=0;k<=36;k++){
        const z=mix(startZ,edgeEnd,k/36),x=s*edgeAt(z);
        const lateral=z<=rearZ?x*fullWidth/(profile.halfWidth(z)*rearDeck.outerU(z)):x;
        const rail=column(lateral),p=topAt(rail,z);
        if(z>rearZ)p[2]-=radius(lateral/aftWidth)*smooth(.42,1,(z-rearZ)/(rail.endZ-rearZ));
        p[1]+=.0009;path.push(p);
      }
      for(let k=1;k<=6;k++){
        const theta=k*Math.PI/12,p=topAt(column(s*edgeX),edgeEnd);
        p[1]+=.0009*Math.cos(theta)-r*(1-Math.cos(theta));
        p[2]+=.0009*Math.sin(theta)-r*(1-Math.sin(theta));
        path.push(p);
      }
      for(let k=1;k<=8;k++){
        const t=k/8,x=edgeX-.0035*smooth(0,1,t);
        const p=rearSkin(s*x/aftWidth,mix(1,finish,t));
        p[2]+=.0009;path.push(p);
      }
      // The outer steel shoulder ends above the lens. Continue its parting
      // line down the bumper stamping to the upper surface of the lamp seal.
      const from=path.at(-1),endX=s*(edgeX-.0035),endY=lampTopAt(Math.abs(endX));
      const seal=faceAtX(back,endX,endY,.0012+.42*.006);
      const steel=y=>pressedRear(faceAtX(back,endX,y));
      const fromDepth=from[2]-steel(from[1])[2],toDepth=seal[2]-steel(endY)[2];
      for(let k=1;k<=6;k++){
        const t=k/6,p=steel(mix(from[1],endY,t));
        p[2]+=mix(fromDepth,toDepth,smooth(0,1,t));path.push(p);
      }
      tube(b,'rubber',path,.0018,0x424846,6);
    }
    const stop=(x,y,proud=0)=>{
      const u=x/aftWidth,p=rearSkin(u,heightAt(u,center+y));p[2]+=proud;return p;
    };
    const outline=roundedRect(halfWidth*2,halfHeight*2,corner,7);
    const lip=outline.map(([x,y])=>stop(x,y,.0002));
    const recess=outline.map(([x,y])=>stop(x*.991,y*.90,-.0038));
    ring(b,'rubber',lip,recess,rear,0x2e2025);
    function insert(finish,width,height,r,depth,color){
      const xs=rails(width*.5,r);
      b.patch(finish,xs.length-1,5,(u,v)=>{
        const x=xs[Math.round(u*(xs.length-1))],dx=Math.max(0,Math.abs(x)-width*.5+r);
        const h=height*.5-r+Math.sqrt(Math.max(0,r*r-dx*dx));
        return stop(x,(2*v-1)*h,depth);
      },rear,color);
    }
    insert('blackGlass',.325,.0192,.0066,-.0040,0x431821);
    insert('stopLamp',.314,.0140,.0051,-.0018,0xae3943);
    for(let i=0;i<12;i++)b.patch('optic',2,2,(u,v)=>stop((i-5.5)*.0233+(u-.5)*.0013,(v-.5)*.009,-.0008),
      rear,0x953a46);

  }

  // The kit moves the plate into the boot. The bumper below it is one
  // uninterrupted shelf, with a second shallow pressing around each lamp.
  function pressedRear(p){
    const x=Math.abs(p[0]),y=p[1];
    const bell=t=>Math.exp(-t*t);
    const across=1-smooth(.71,.848,x);
    const bumper=.026*bell((y-.529)/.050)*across;
    const boot=smooth(.544,.607,y)*(1-smooth(.729,.839,y));
    const cheek=.399+.102*smooth(.548,.808,y);
    const well=boot*(-.015*(1-smooth(.31,.432,x))+.014*bell((x-cheek)/.048));
    const t=clamp(lampTurn*(x-.522)/(lampCornerX-.522),0,lampTurn),low=lampHeight(t,lensFloor(t));
    const bezel=(.014*bell((y-low+.044)/.043)-.014*bell((y-low+.001)/.023))*
      smooth(.477,.560,x)*(1-smooth(.795,.855,x));
    const top=lampHeight(t,lensBrow(t)),inner=.500+.042*(1-clamp((y-.625)/.218,0,1));
    const socket=smooth(inner-.011,inner+.012,x)*(1-smooth(.838,.871,x))*
      smooth(low-.002,low+.016,y)*(1-smooth(top-.018,top+.0008,y));
    return [p[0],y,p[2]+bumper+well+bezel-.018*socket];
  }

  // This U-shaped fold passes below the plate and joins the inboard lower
  // corner of each lamp. The broad white landing is outside the boot opening.
  const bootEdge=lensCurve([[0,.566],[.24,.567],[.327,.570],[.375,.578],[.412,.593],
    [.449,.621],[.489,.665],[.519,.702],[.536,.723]]);
  const trunkSill=x=>bootEdge(clamp(Math.abs(x),0,.536));

  function diffuserTop(x){
    const a=Math.abs(x);
    return .345-.094*smooth(.661,.837,a)+.006*Math.exp(-(((a-.632)/.062)**2));
  }
  const exhaustX=.522,exhaustY=.219;
  function diffuserBottom(x){
    const a=Math.abs(x),distance=Math.abs(a-exhaustX);
    const floor=.184-.052*smooth(.571,.806,a);
    const arch=Math.sqrt(Math.max(0,1-(distance/.091)**2));
    return mix(floor,exhaustY+.082*arch,1-smooth(.076,.095,distance));
  }
  function diffuserSkin(p){
    const a=Math.abs(p[0]),y=p[1];
    const opening=1-smooth(.066,.113,Math.hypot(a-exhaustX,(y-exhaustY)*1.10));
    const fold=.638+.122*(1-smooth(.132,.348,y));
    const panel=(1-smooth(fold-.022,fold+.018,a))*(1-smooth(.213,.330,y));
    const rib=.006*Math.exp(-(((a-fold)/.014)**2))*(1-smooth(.321,.358,y));
    return [p[0],y,p[2]-.048*opening-.034*panel+rib];
  }

  function deckDetails(api,back){
    const {b,atlasUV}=api;
    const panel=(x,y,depth=0)=>{
      const p=pressedRear(faceAtX(back,x,y));p[2]+=depth;return p;
    };
    // A tapered, black lift handle has a shallow overhanging underside.
    // Recess the camera and both white number lights under that single part.
    const halfAt=v=>{
      const corner=clamp((v-.68)/.32,0,1);
      return .375-.036*v-.013*v*v-.016*(1-Math.sqrt(1-corner*corner));
    };
    const frame=(u,v,proud=0)=>{
      const a=2*u-1,half=halfAt(v);
      const y=mix(.767+.0015*(1-a*a),.855-.009*a**4,v);
      return panel(a*half,y,.0125+.019*v+.0035*Math.sin(Math.PI*v)*(1-.55*a*a)+proud);
    };
    b.patch('blackGlass',44,10,frame,rear,0x191b21);
    for(const side of [0,1]){
      b.patch('trim',10,4,(u,v)=>{
        const lip=frame(side,u),base=panel(lip[0],lip[1]);
        return blend(base,lip,v);
      },[(side?1:-1)*.75,.16,.25],0x23242a);
    }
    for(const edge of [0,1])b.patch('trim',44,3,(u,v)=>{
      const lip=frame(u,edge),base=panel(lip[0],lip[1]);
      return blend(base,lip,v);
    },edge?up:down,edge?0x2a2d31:0x292b2d);
    const [bl,br,,tl]=atlasUV('toyotaWord');
    b.patch('marks',18,4,(u,v)=>{
      const h=mix(.17,.82,v),half=halfAt(h);
      return frame(.5+(u-.5)*.299/(2*half),h,.0011);
    },rear,0xffffff,(u,v)=>[mix(bl[0],br[0],u),mix(bl[1],tl[1],v)]);

    const plateY=.670,h=.085;
    const lower=panel(0,plateY-h)[2],upper=panel(0,plateY+h)[2];
    const plate=(x,y,d=0)=>[x,plateY+y,mix(lower,upper,.5+y/(2*h))+.009+d];
    const outline=roundedRect(.352,.177,.007);
    ring(b,'rubber',outline.map(([x,y])=>panel(x,plateY+y)),outline.map(([x,y])=>plate(x,y)),rear,0x262728);
    roundPanel(b,'trim',(x,y)=>plate(x,y),rear,.352,.177,.007,0x25272b);
    b.face('marks',[plate(-.173,-h,.0016),plate(.173,-h,.0016),plate(.173,h,.0016),
      plate(-.173,h,.0016)],rear,0xffffff,atlasUV('plate'));

    for(const side of [-1,1]){
      const p=frame(.5+side*.167/.750,0);
      const light=(x,y,d=0)=>[p[0]+x,p[1]-.003+y*.65-d*.76,p[2]-.004+y*.76+d*.65];
      roundPanel(b,'rubber',(x,y)=>light(x,y,.0006),[0,-.76,.65],.046,.014,.004,0x202226);
      curvedPanel(b,'numberLight',(x,y)=>light(x,y,.0016),[0,-.76,.65],.033,.008,.003,0xe1e6ea);
      if(side===1)api.lampSources.plate=light(0,0,.0016);
    }
    const camera=frame(.207,0);
    for(const [r,d,finish,col] of [[.0096,.0006,'rubber',0x24272a],[.0061,.0018,'blackGlass',0x29313d]]){
      b.patch(finish,18,4,(u,v)=>{
        const a=Math.PI*2*u;
        return [camera[0]+r*v*Math.cos(a),camera[1]-.004+r*v*Math.sin(a),camera[2]-.004+d+.001*(1-v*v)];
      },rear,col);
    }
  }

  function tailpipes(api,back) {
    const {b,rod}=api;
    const can=(u,x,proud=0)=>{
      const a=u*Math.PI*2,taper=1-.24*smooth(.353,.456,Math.abs(x));
      return [x,.169+(.052*taper+proud)*Math.sin(a),1.862+(.108*taper+proud)*Math.cos(a)];
    };
    const radial=u=>[0,Math.sin(u*Math.PI*2),Math.cos(u*Math.PI*2)];
    b.patch('metal',28,18,(u,v)=>can(u,mix(-.457,.457,v)),radial,0x635f59);
    for(const x of [-.362,.362])b.patch('satin',26,2,(u,v)=>can(u,x+(v-.5)*.018,.002),radial,0x404343);
    for(const side of [-1,1]){
      const cx=side*exhaustX,base=faceAtX(back,cx,exhaustY)[2]-.056;
      const tip=(u,r,z)=>{
        const a=u*2*Math.PI;
        return [cx+side*z*.055+r*Math.cos(a),exhaustY+r*Math.sin(a),base+z+.010*Math.sin(a)];
      };
      api.exhaustOutlets.push({position:tip(0,0,.050),direction:[side*.055,0,1]});
      // Rolled stainless rim, dark inner wall and soot at the back of the bore.
      const rings=[[.058,-.145],[.064,-.022],[.067,.039],[.0658,.049],
        [.063,.051],[.0588,.050],[.0567,.044],[.053,-.028],[.049,-.111]];
      const finishes=['metal','metal','chrome','chrome','chrome','chrome','metal','satin'];
      const colors=[0x68665f,0x8f908a,0xced2cf,0xe5e9e5,0xd5d8d3,0x9b9e98,0x4c4e4b,0x292a28];
      for(let i=0;i<rings.length-1;i++){
        const [r,z]=rings[i],[rr,zz]=rings[i+1],out=i<4?1:-1;
        b.patch(finishes[i],48,2,(u,v)=>tip(u,mix(r,rr,v),mix(z,zz,v)),
          u=>[out*Math.cos(u*2*Math.PI),out*Math.sin(u*2*Math.PI),.5],colors[i]);
      }
      b.patch('rubber',36,2,(u,v)=>tip(u,.049*v,-.111),rear,0x111415);
      rod(b,'metal',[cx*.82,exhaustY-.025,1.736],[cx,exhaustY,base-.109],.052,0x52534e,18);
    }
  }

  function* rearFascia(api) {
    const {b,profile}=api,back=makeEnd(profile,true);
    // The central stamping spans the space between the angled lamp edges.
    // Outer patches turn into the quarters using the same section as the sides.
    const centerWidth=.536,sideWidth=y=>profile.sideAt(1,profile.rearZ,y)[0];
    for(const side of [-1,0,1]){
      const raw=(u,y)=>{
        const edge=centerWidth/sideWidth(y);
        return back(side?side*mix(edge,1,u):(2*u-1)*edge,y);
      };
      const x=u=>raw(u,.582)[0];
      const cap=u=>{
        const a=side?mix(centerWidth/sideWidth(.815),1,u):(2*u-1)*centerWidth/sideWidth(.815);
        return profile.deckAt(profile.rearZ,a)[1]-.012;
      };
      const width=side?42:132;
      const rim=u=>diffuserTop(x(u));
      const low=u=>diffuserBottom(x(u));
      const groove=u=>.0023+.0031*smooth(.39,.55,Math.abs(x(u)));
      const sill=u=>Math.min(trunkSill(x(u)),cap(u)-groove(u));
      const painted=(u,y)=>pressedRear(raw(u,y));
      const sheet=(finish,lo,hi,rows,color)=>b.patch(finish,width,rows,(u,v)=>
        painted(u,mix(lo(u),hi(u),v)),rear,color);
      // The gloss-black valance, pearl keyline and black belt turn each
      // corner at exactly the same heights as the side of the car.
      sheet('paint',rim,()=>pandaTrim.valanceTop,14,pandaTrim.black);
      sheet('paint',()=>pandaTrim.valanceTop,()=>pandaTrim.beltBottom,7,pearl);
      sheet('paint',()=>pandaTrim.beltBottom,()=>pandaTrim.beltTop,7,pandaTrim.belt);
      const opening=u=>side?cap(u):sill(u)-groove(u);
      sheet('paint',()=>pandaTrim.beltTop,opening,48,pearl);
      if(!side){
        // Two folded edges and a recessed dark reveal form a real shutline.
        b.patch('rubber',width,6,(u,v)=>{
          const p=painted(u,sill(u)+(2*v-1)*groove(u));
          p[2]-=.006*Math.sin(Math.PI*v);return p;
        },rear,0x313435);
        b.patch('paint',width,21,(u,v)=>{
          const p=painted(u,mix(sill(u)+groove(u),cap(u),v));
          p[2]-=.0023*(1-smooth(0,.066,v));return p;
        },rear,pearl);
      }
      b.patch('moulding',width,20,(u,v)=>diffuserSkin(raw(u,mix(low(u),rim(u),v))),
        rear,0x34393b);
      b.patch('satin',width,3,(u,v)=>{
        const a=raw(u,rim(u)),p=blend(diffuserSkin(a),pressedRear(a),v);
        p[1]+=.0012*Math.sin(Math.PI*v);return p;
      },[0,.74,1],0x363c3e);
      b.patch('rubber',width,5,(u,v)=>{
        const p=diffuserSkin(raw(u,low(u)));
        p[2]=mix(p[2],1.650,v);p[1]+=.020*v;return p;
      },down,0x212527);
      yield;
    }
    rearLamps(api,back);yield;
    deckDetails(api,back);yield;
    ducktail(api,back);yield;
    tailpipes(api,back);
  }

  window.TougeNeo86.buildFascias=window.TougeNeo86.staged(function* buildFascias(api){
    surfaceFinishes(api);yield;
    yield* frontFascia(api);
    yield* rearFascia(api);
  });
})();
