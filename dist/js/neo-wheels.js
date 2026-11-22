(() => {
  'use strict';
  const T = THREE, tau = 2 * Math.PI;
  const nominalRadius = .316;
  const polar = (x, r, a) => [x, r * Math.cos(a), r * Math.sin(a)];
  const canvas = (w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    return c.getContext('2d', {willReadFrequently: true});
  };
  function canvasMap(ctx, colorSpace) {
    const map = new T.CanvasTexture(ctx.canvas);
    map.colorSpace = colorSpace; map.wrapS = T.RepeatWrapping;
    map.anisotropy = 8;
    return map;
  }

  // Both maps wrap around the axle. The separate bead, shoulder and crown
  // bands use the V coordinates of the revolved tire cross-section.
  function rubberMaps() {
    const w = 2048, h = 256, pigment = canvas(w,h), relief = canvas(w,h);
    const color = pigment.createImageData(w,h), height = relief.createImageData(w,h);
    let seed = 47291;
    const noise = () => {
      seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let y = 0; y < h; y++) {
      const shoulder = Math.min(y,h-1-y) / h;
      const band = T.MathUtils.smoothstep(shoulder,.16,.28);
      const molded = Math.max(0,1 - Math.abs(shoulder - .058) * 220);
      for (let x = 0; x < w; x++) {
        const i = 4 * (x + w * y), grit = noise();
        const value = 37 + band*10 + molded*3 + grit*6;
        color.data.set([value,value+.8,value+1,255],i);
        height.data.set([141+grit*12+molded*21,0,0,255],i);
      }
    }
    pigment.putImageData(color,0,0); relief.putImageData(height,0,0);
    function line(context, shade, width, points) {
      context.strokeStyle=shade; context.lineWidth=width; context.lineCap='round';
      context.beginPath(); context.moveTo(...points[0]);
      for (const p of points.slice(1)) context.lineTo(...p);
      context.stroke();
    }
    function cut(points,width) {
      const edge=points.map(([x,y])=>[x+1,y+.5]);
      line(pigment,'#444647',width+1.2,edge); line(pigment,'#1c1d1e',width,points);
      line(relief,'rgb(72,0,0)',width+1.4,points); line(relief,'rgb(35,0,0)',width,points);
    }
    // The rounded shoulders have alternating block lengths. The two main
    // gutters are also cut into the silhouette of the tread geometry.
    for (const v of [.336,.664]) {
      cut([[-2,v*h],[w+2,v*h]],3.8);
    }
    const pitch=w/48;
    for (let k=-1;k<=48;k++) {
      const x=k*pitch, shift=k%2 ? 3 : -2;
      cut([[x-6,.181*h],[x-1,.210*h],[x+6,.247*h],[x+12+shift,.321*h]],3.15);
      cut([[x+21,.817*h],[x+14,.788*h],[x+9,.742*h],[x+shift,.678*h]],3.05);
      cut([[x+14,.368*h],[x+21,.420*h],[x+26,.457*h]],1.9);
      cut([[x+7,.636*h],[x+1,.597*h],[x-3,.553*h]],1.9);
      line(relief,'rgb(116,0,0)',1.1,[[x+13,.225*h],[x+17,.252*h],[x+20,.273*h]]);
    }
    function moldedText(text,u,v,size,stretch,bold=false) {
      for(const ctx of [pigment,relief]){
        ctx.save();ctx.translate(w*u,h*v);ctx.scale(stretch,1);
        ctx.font=(bold?'italic 800 ':'600 ')+size+'px Arial, sans-serif';
        ctx.textAlign='center';ctx.textBaseline='middle';
        if(ctx===pigment){
          ctx.fillStyle='#242526';ctx.fillText(text,.6,1);
          ctx.fillStyle=bold?'#333535':'#2f3030';ctx.fillText(text,0,0);
        }else{
          ctx.fillStyle='rgb(118,0,0)';ctx.fillText(text,.8,1);
          ctx.fillStyle=bold?'rgb(217,0,0)':'rgb(191,0,0)';ctx.fillText(text,0,0);
        }
        ctx.restore();
      }
    }
    // The large molded name and fine size line occupy the outside face.
    // The lettering wraps with the ply, including the inverted size line at six o'clock.
    moldedText('NANKANG',.813,.911,21,1.48,true);
    moldedText('SPORTNEX  CR-S',.185,.913,14,1.22,true);
    moldedText('OUTSIDE   225/40ZR18   92Y',.505,.924,10,1.32);
    moldedText('RADIAL  TUBELESS   •   REINFORCED',.319,.925,5.5,1.16);
    moldedText('TREAD  2 POLYESTER  +  2 STEEL  +  2 NYLON',.950,.925,4.4,1.08);
    moldedText('SIDEWALL  2 POLYESTER',.950,.945,4.2,1.08);
    for(const [v,width] of [[.846,.8],[.862,1.3],[.951,.7],[.967,1.25],[.978,.9]]) {
      line(pigment,'#242626',width+1,[[-1,v*h+.7],[w+1,v*h+.7]]);
      line(pigment,'#303232',width,[[-1,v*h],[w+1,v*h]]);
      line(relief,'rgb(193,0,0)',width,[[-1,v*h],[w+1,v*h]]);
    }
    for(let k=0;k<220;k++){
      const x=k*w/220;
      line(relief,'rgb(161,0,0)',.8,[[x,.833*h],[x+2,.85*h]]);
    }
    for (const [u,v,tint] of [[.443,.862,'#b6a14b'],[.731,.850,'#92473d']]) {
      pigment.strokeStyle=tint; pigment.lineWidth=1.5; pigment.beginPath();
      pigment.ellipse(u*w,v*h,2.2,1.9,0,0,tau);pigment.stroke();
    }
    const packed=relief.getImageData(0,0,w,h);
    for(let y=0;y<h;y++) {
      const crown=T.MathUtils.smoothstep(Math.min(y,h-1-y)/h,.17,.26);
      for(let x=0;x<w;x++) {
        const i=4*(x+y*w), surface=packed.data[i];
        packed.data[i+1]=(surface<100?213:177)-crown*17+noise()*9;
      }
    }
    relief.putImageData(packed,0,0);
    return {map:canvasMap(pigment,T.SRGBColorSpace),packed:canvasMap(relief,T.NoColorSpace)};
  }

  function sweptDiscMap() {
    const w=512,h=128,c=canvas(w,h);
    for(let y=0;y<h;y++){
      const v=Math.round(219+7*Math.sin(y*2.4)+5*Math.sin(y*.41)+3*Math.sin(y*4.1));
      c.fillStyle='rgb('+v+','+v+','+(v-1)+')';c.fillRect(0,y,w,1);
    }
    for(let i=0;i<31;i++){
      const x=(i*113)%w,y=4+(i*47)%(h-8);
      c.fillStyle=i%3?'rgba(97,97,92,.13)':'rgba(255,254,248,.27)';
      c.fillRect(x,y,17+(i*27)%68,.8);
    }
    return canvasMap(c,T.SRGBColorSpace);
  }

  function wheelMaterials(base) {
    const materials=Object.create(base), rubber=rubberMaps();
    const grain=canvas(128,128), pixels=grain.createImageData(128,128);
    let seed=8237;
    for(let i=0;i<pixels.data.length;i+=4){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const n=seed/4294967296;
      pixels.data.set([104+51*n,208+28*n,0,255],i);
    }
    grain.putImageData(pixels,0,0);
    const casting=canvasMap(grain,T.NoColorSpace);
    casting.wrapT=T.RepeatWrapping;casting.repeat.set(10,10);
    materials.tire=new T.MeshStandardMaterial({
      vertexColors:true, map:rubber.map, bumpMap:rubber.packed, bumpScale:.00083,
      roughnessMap:rubber.packed,roughness:1,metalness:0,envMapIntensity:.7
    });
    materials.wheel=new T.MeshPhysicalMaterial({
      color:0xc2c9d3,vertexColors:true,roughness:.52,roughnessMap:casting,metalness:.65,
      bumpMap:casting,bumpScale:.00013,clearcoat:.11,clearcoatRoughness:.45
    });
    materials.metal=new T.MeshStandardMaterial({vertexColors:true,roughness:.30,metalness:.76});
    materials.brakeSteel=new T.MeshStandardMaterial({
      color:0xb1bbbf,vertexColors:true,map:sweptDiscMap(),roughness:.45,metalness:.78
    });
    materials.caliper=new T.MeshPhysicalMaterial({
      vertexColors:true,roughness:.37,metalness:.28,clearcoat:.42,clearcoatRoughness:.25
    });
    const stamp=canvas(128,128);
    stamp.fillStyle='#fff';stamp.fillRect(0,0,128,128);
    stamp.font='900 15px Arial, sans-serif';stamp.textAlign='center';stamp.textBaseline='middle';
    stamp.fillStyle='#fff6ee';stamp.fillText('RACING',64,97);
    stamp.fillStyle='#925a4c';stamp.fillText('RACING',64,95);
    materials.cap=base.cap.clone();materials.cap.map=canvasMap(stamp,T.SRGBColorSpace);
    materials.cap.roughness=.28;materials.cap.clearcoat=.40;
    materials.wheel.userData.routeReflections=true;
    materials.metal.userData.routeReflections=true;
    return materials;
  }

  // Profile rows describe [axial coordinate, radius, texture V]. Adjacent
  // segment tangents are unit weighted so the rolled bead and rim shoulders
  // hold a continuous highlight across narrow and broad bands alike.
  function lathe(batch,finish,rows,color,slices=64) {
    const profileV=[0];
    const edges=rows.slice(1).map(([x,r],i)=>{
      const dx=x-rows[i][0],dr=r-rows[i][1],len=Math.hypot(dx,dr);
      profileV.push(profileV[i]+len/(tau*.205));
      return [-dr/len,dx/len];
    });
    const normals=rows.map((row,i)=>{
      const a=edges[Math.max(0,i-1)], b=edges[Math.min(edges.length-1,i)];
      const nx=a[0]+b[0],nr=a[1]+b[1],len=Math.hypot(nx,nr)||1;
      return [nx/len,nr/len];
    });
    for(let i=0;i<slices;i++) {
      const u0=1-i/slices,u1=1-(i+1)/slices,a=i*tau/slices,b=(i+1)*tau/slices;
      for(let k=0;k<rows.length-1;k++){
        const [x,r,v=profileV[k]]=rows[k],[x1,r1,v1=profileV[k+1]]=rows[k+1];
        const n0=normals[k],n1=normals[k+1],dir=edges[k];
        batch.face(finish,[polar(x,r,a),polar(x,r,b),polar(x1,r1,b),polar(x1,r1,a)],
          polar(dir[0],dir[1],(a+b)*.5),color,[[u0,v],[u1,v],[u1,v1],[u0,v1]],
          [polar(n0[0],n0[1],a),polar(n0[0],n0[1],b),polar(n1[0],n1[1],b),polar(n1[0],n1[1],a)]);
      }
    }
  }

  function makeWheel(api,materials) {
    const b=new api.Batch(materials);
    const inside=[
      [-.090,.225,1],[-.104,.230,.99],[-.113,.243,.95],[-.119,.260,.909],
      [-.121,.275,.872],[-.117,.289,.837],[-.110,.300,.81],[-.100,.307,.787],
      [-.088,.312,.764],[-.073,.314,.718],[-.055,.315,.674],
      [-.053,.313,.669],[-.052,.310,.666],[-.047,.310,.658],[-.045,.315,.653],
      [-.024,.3158,.582],[0,nominalRadius,.5]
    ];
    const outside=inside.slice(0,-1).reverse().map(([x,r,v])=>[-x,r,1-v]);
    lathe(b,'tire',inside.concat(outside),0xffffff,64);
    // The two terraces in the dish are cast in the same finish as the spokes.
    // A narrow turned edge catches a separate highlight at the tire bead.
    lathe(b,'wheel',[[-.107,.201],[-.111,.216],[-.109,.227],[-.100,.232],
      [.106,.232],[.115,.2318],[.119,.2309]],0x63635e,72);
    lathe(b,'metal',[[.119,.2309],[.1202,.2301],[.1205,.2292],[.1204,.2285]],0x898880,72);
    lathe(b,'wheel',[[.1204,.2285],[.1198,.2274],[.118,.2265],[.111,.2256],
      [.105,.2242],[.102,.2228],[.0998,.2205],[.0995,.2184],[.0991,.2172],
      [.0966,.2155],[.091,.2143],[.084,.2122],[.082,.2108],[.0815,.2088],
      [.0813,.2063],[.0801,.2047],[.0775,.2030],[.071,.2004],[.060,.1950],
      [.053,.1890],[.050,.1852],[.0492,.1821],[.048,.1805],[.045,.1794],
      [.034,.1790],[.018,.1800],[-.089,.1958],[-.105,.1990],[-.107,.201]],0x76756f,72);

    const bolts=Array.from({length:5},(_,i)=>polar(0,.049,i*tau/5));
    const hubEdge=a=>.0725+.008*((1-Math.cos(8*a))*.5)**.78;
    function plateHeight(r,a){
      const v=(r-.023)/(hubEdge(a)-.023),y=r*Math.cos(a),z=r*Math.sin(a);
      const lug=Math.min(...bolts.map(h=>Math.hypot(y-h[1],z-h[2])));
      return .0734-.0012*v-.0038*v*v-.012*(1-T.MathUtils.smoothstep(lug,.009,.0146));
    }
    function fillet(x,surface,width){
      const overlap=Math.max(0,width-Math.abs(x-surface));
      return Math.max(x,surface)+overlap*overlap/(4*width);
    }
    // Straight cast spokes narrow towards the barrel. Short fillets blend
    // the rounded faces into the center plate and the recessed spoke shelf.
    for(let i=0;i<8;i++){
      const spoke=(i+.5)*tau/8,ca=Math.cos(spoke),sa=Math.sin(spoke);
      const point=(t,v)=>{
        const roll=v*tau,r=.056+.130*t;
        const root=1-T.MathUtils.smoothstep(t,0,.23),foot=T.MathUtils.smoothstep(t,.82,1);
        const width=.0190-.0047*t+.0037*root*root+.0066*foot*foot;
        const depth=.0123+.0024*Math.sin(t*Math.PI)-.0031*foot*foot;
        const face=.079-.013*T.MathUtils.smoothstep(t,.32,.90)-.021*root*root-.022*foot*foot;
        const across=Math.sin(roll)*width;
        const y=r*ca-across*sa,z=r*sa+across*ca,radial=Math.hypot(y,z);
        let x=face+depth*(Math.cos(roll)-1);
        if(t<.30){
          const a=Math.atan2(z,y),edge=hubEdge(a);
          const base=plateHeight(radial,a)-.00065;
          const blend=1-T.MathUtils.smoothstep(radial,edge-.002,edge+.012);
          x=T.MathUtils.lerp(x,fillet(x,base,.010),blend);
        }else if(t>.80){
          const base=.0471+.68*(radial-.181)-.00065;
          const blend=T.MathUtils.smoothstep(radial,.173,.184);
          x=T.MathUtils.lerp(x,fillet(x,base,.009),blend);
        }
        return [x,y,z];
      };
      b.patch('wheel',16,16,point,(t,v)=>[
        Math.cos(v*tau),-Math.sin(v*tau)*sa,Math.sin(v*tau)*ca
      ],0x77766f,(t,v)=>[t*.12,v*.085]);
    }
    b.patch('wheel',112,15,(u,v)=>{
      const a=u*tau,r=.023+(hubEdge(a)-.023)*v;
      return polar(plateHeight(r,a),r,a);
    },[1,0,0],0x74736b,(u,v)=>[.1+.14*v*Math.cos(u*tau),.1+.14*v*Math.sin(u*tau)]);
    b.patch('wheel',96,4,(u,v)=>{
      const a=u*tau;
      return polar(.0684-.020*v,hubEdge(a)+.0016*Math.sin(v*Math.PI)-.004*v,a);
    },(u,v)=>polar(1-v,1,tau*u),0x62635e);
    const castMark=(y,z)=>[plateHeight(Math.hypot(y,z),Math.atan2(z,y))+.00022,y,z];
    b.patch('wheel',22,3,(u,v)=>{
      const a=u*tau,r=.0038+.00058*Math.cos(v*Math.PI);
      const p=castMark(-.061+r*Math.cos(a),r*Math.sin(a));
      p[0]+=.00035*Math.sin(v*Math.PI);return p;
    },[1,0,0],0x68695f);
    for(const line of [
      [[-.0598,.0020],[-.0621,.0011],[-.0605,.0004],[-.0621,-.0005],[-.0598,-.0017]],
      [[-.0515,.0016],[-.0484,.0016],[-.0484,-.0001],[-.0493,-.0008],[-.0501,.0001],[-.0501,.0016]],
      [[-.0501,.0005],[-.0516,-.0009]]
    ])api.tube(b,'wheel',line.map(([y,z])=>castMark(y,z)),.00032,0x64655d,5);
    // Black conical dust cap, red enamel medallion, and the three raised bosses.
    lathe(b,'cap',[[.068,.0330],[.072,.0328],[.075,.0310],[.080,.0302],
      [.093,.0275],[.104,.0240],[.111,.0212],[.114,.0192],[.115,.0170]],0x191c1d,40);
    lathe(b,'cap',[[.114,.0176],[.1151,.0172],[.1158,.0165]],0xad291b,36);
    b.patch('cap',36,3,(u,v)=>polar(.1158+.00045*(1-v*v),.0165*v,u*tau),[1,0,0],
      0xbc2d1a,(u,v)=>[.5-.5*v*Math.sin(u*tau),.5+.5*v*Math.cos(u*tau)]);
    for(const [y,z] of [[.0077,0],[.0004,.0073],[.0004,-.0073]]){
      b.patch('cap',13,5,(u,v)=>{
        const a=u*tau,e=v*Math.PI*.5,r=.0032*Math.cos(e);
        return [.1160+.0022*Math.sin(e),y+r*Math.cos(a),z+r*Math.sin(a)];
      },(u,v)=>polar(Math.sin(v*Math.PI*.5),Math.cos(v*Math.PI*.5),u*tau),0xac291a,()=>[.05,.95]);
    }
    for(const [,y,z] of bolts){
      api.rod(b,'metal',[.059,y,z],[.0687,y,z],.0120,0x181b1b,18,.0118);
      api.rod(b,'metal',[.0683,y,z],[.0703,y,z],.0104,0x252828,6,.0109);
      api.rod(b,'metal',[.0703,y,z],[.0808,y,z],.0109,0x202322,6);
      api.rod(b,'metal',[.0808,y,z],[.0835,y,z],.0109,0x303331,6,.0089);
      api.rod(b,'metal',[.0834,y,z],[.0840,y,z],.0059,0x272928,14);
    }
    const valve=(x,r)=>polar(x,r,Math.PI+.015);
    api.rod(b,'wheel',valve(.057,.194),valve(.063,.190),.0065,0x282b29,14,.0058);
    api.rod(b,'metal',valve(.062,.191),valve(.066,.188),.0058,0x999990,6,.0053);
    api.rod(b,'metal',valve(.065,.189),valve(.084,.176),.0033,0xa2a39d,12,.0030);
    api.rod(b,'metal',valve(.082,.178),valve(.086,.175),.0036,0xb2b2a9,10,.0034);
    const group=b.build('Eight-spoke wheel and tire');
    for(const mesh of group.children) {
      mesh.castShadow=mesh.name==='wheel'||mesh.name==='tire';
      mesh.receiveShadow=true;
      if(mesh.name!=='tire') mesh.scale.set(1,1.03,1.03);
    }
    return group;
  }

  function makeDisc(api,materials) {
    const b=new api.Batch(materials),r=.165;
    // Two friction plates, an open cooling gap and the radial vanes between them.
    for(const x of [-.012,.009]){
      lathe(b,'brakeSteel',[[x-.004,r,.99],[x+.002,r,.99],[x+.003,r-.002,.975]],0x858784);
      lathe(b,'brakeSteel',[[x+.003,r-.002,.975],[x+.003,.097,0]],0x858782);
      lathe(b,'brakeSteel',[[x-.004,.097,0],[x-.004,r,.99]],0x817e78);
    }
    for(let i=0;i<28;i++){
      const a=i*tau/28,beta=a+.045;
      b.face('brakeSteel',[polar(-.010,r-.002,a),polar(.005,r-.002,a),
        polar(.005,r-.002,beta),polar(-.010,r-.002,beta)],polar(0,1,(a+beta)*.5),0x79766e);
    }
    lathe(b,'brakeSteel',[[.010,.114],[.013,.110],[.014,.099],[.018,.091],[.028,.087],[.030,.079],[.030,.020]],0x696964,48);
    const group=b.build('Vented rotor and hat');
    group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=false;mesh.receiveShadow=true;}});
    return group;
  }

  function makeCaliper(api,materials,front) {
    const b=new api.Batch(materials),center=front?-1.12:1.16,span=front?.46:.37,r=front?.160:.152;
    // The formed dust shield catches the light behind the vent gap. Its
    // opening leaves room for the bridge and the pad carrier.
    const shieldR=front?.180:.170;
    const shieldAngle=u=>center+.48+u*(tau-.96);
    b.patch('caliper',50,5,(u,v)=>{
      const a=shieldAngle(u);
      return polar(-.039-.007*Math.sin(v*Math.PI),.058+(shieldR-.058)*v,a);
    },[1,0,0],0x292d2e);
    b.patch('caliper',50,3,(u,v)=>polar(-.039+.005*v,shieldR+.002*Math.sin(Math.PI*v),shieldAngle(u)),
      (u,v)=>polar(.25,1,shieldAngle(u)),0x414444);
    const boundary=[[-.98,-.006],[-.88,-.016],[-.68,-.021],[.56,-.021],[.82,-.016],
      [1,-.006],[.98,.009],[.77,.019],[.51,.023],[-.57,.023],[-.85,.017],[-1,.006]];
    const rings=[[-.024,.78],[-.020,.94],[-.011,1],[.022,1],[.033,.95],[.038,.77]].map(([x,s])=>
      boundary.map(([along,radial])=>polar(x,r+radial*s,center+along*span*s)));
    const mid=polar(.004,r,center),count=boundary.length;
    function edgeNormal(k,j){
      const point=rings[k][j],prev=rings[Math.max(0,k-1)][j],next=rings[Math.min(rings.length-1,k+1)][j];
      const prevEdge=rings[k][(j+count-1)%count],nextEdge=rings[k][(j+1)%count];
      const a=new T.Vector3().fromArray(next).sub(new T.Vector3().fromArray(prev));
      const b=new T.Vector3().fromArray(nextEdge).sub(new T.Vector3().fromArray(prevEdge));
      const n=a.cross(b).normalize(),out=new T.Vector3().fromArray(point).sub(new T.Vector3().fromArray(mid));
      if(n.dot(out)<0)n.negate();return n.toArray();
    }
    const normals=rings.map((ring,k)=>ring.map((point,j)=>edgeNormal(k,j)));
    for(let k=0;k<rings.length-1;k++){
      for(let j=0;j<boundary.length;j++){
        const next=(j+1)%boundary.length;
        const a=rings[k][j],c=rings[k][next],d=rings[k+1][next],e=rings[k+1][j];
        const out=a.map((v,i)=>(v+c[i]+d[i]+e[i])*.25-mid[i]);
        b.face('caliper',[a,c,d,e],out,front?0xac3124:0x9e3024,undefined,
          [normals[k][j],normals[k][next],normals[k+1][next],normals[k+1][j]]);
      }
    }
    b.face('caliper',rings[0],[-1,0,0],0x792621);
    b.face('caliper',rings[rings.length-1],[1,0,0],front?0xab3325:0xa43125);
    for(const sign of [-1,1]){
      b.patch('caliper',12,6,(u,v)=>{
        const a=center+span*(sign*.42+(u-.5)*.72);
        const rise=Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
        return polar(.0378+.0052*rise,r-.011+.024*v,a);
      },[1,0,0],front?0xc53b2b:0xb73527);
      const a=center+sign*span*.66;
      api.rod(b,'caliper',polar(.035,r,a),polar(.040,r,a),.0065,0x5b5a52,8);
    }
    // Bridge clip follows the bridge of the fixed housing, just below the spoke backs.
    api.rod(b,'caliper',polar(.0387,r+.010,center-.17),polar(.0387,r+.010,center+.17),.00165,0xb2afa1,6);
    const group=b.build(front?'Fixed front caliper':'Fixed rear caliper');
    group.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=false;mesh.receiveShadow=true;}});
    return group;
  }

  window.TougeNeo86.buildWheels=function buildWheels(api) {
    const materials=wheelMaterials(api.materials), wheel=makeWheel(api,materials), disc=makeDisc(api,materials);
    const calipers=[makeCaliper(api,materials,true),makeCaliper(api,materials,false)];
    const {frontAxle,rearAxle,frontTrack,rearTrack,tireRadius}=api.dims;
    const wheels=[];
    for(const [axle,z,halfTrack] of [[0,frontAxle,frontTrack],[1,rearAxle,rearTrack]]){
      for(const side of [-1,1]){
        const hub=new T.Group(),spin=new T.Group(),visual=new T.Group(),fixed=calipers[axle].clone();
        hub.name=(axle?'Rear':'Front')+(side<0?' left hub':' right hub');
        hub.position.set(side*halfTrack,tireRadius,z);
        visual.scale.setScalar(tireRadius/nominalRadius);
        if(side<0)visual.rotation.y=Math.PI;
        visual.add(wheel.clone());
        const rotor=disc.clone();
        if(axle)rotor.scale.set(1,.945,.945);
        visual.add(rotor);
        fixed.scale.set(side,1,1).multiplyScalar(tireRadius/nominalRadius);
        fixed.position.x=-side*.008*tireRadius/nominalRadius;
        spin.name='Wheel rotation';spin.add(visual);hub.add(spin,fixed);api.wheelCarrier.add(hub);
        wheels.push({hub,spin,side,steers:axle===0});
      }
    }
    return wheels;
  };
})();
