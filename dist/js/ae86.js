/* 1983 Toyota Sprinter Trueno GT-APEX liftback. Metres, nose toward -Z. */
(() => {
  'use strict';

  const {GeometryBatch,box,rod,tube,texture,laminatedGlass,staged}=window.TougeCarGeometry;
  const TAU = Math.PI * 2;
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const minus = (a, b) => a.map((v, i) => v - b[i]);
  const plus = (a, b) => a.map((v, i) => v + b[i]);
  const scale = (v, k) => v.map(x => x * k);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = v => scale(v, 1 / (Math.hypot(...v) || 1));
  const quadUV = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const right = [1, 0, 0], up = [0, 1, 0];
  const down = [0, -1, 0], rear = [0, 0, 1], front = [0, 0, -1];
  const white = 0xf0f0e8, graphite = 0x25272a, rubber = 0x15181a;
  // Toyota/JAF A-5275. Overhangs of .835 / .970 m meet the bumper faces.
  const frontAxle = -1.269, rearAxle = 1.131, tireRadius = .2888;
  const frontTrack = 1.355 / 2, rearTrack = 1.345 / 2;

  function sample(stations, z) {
    for (let i = 1; i < stations.length; i++) {
      const [last, now] = [stations[i - 1], stations[i]];
      if (z <= now[0]) return mix(last[1], now[1], clamp((z - last[0]) / (now[0] - last[0]), 0, 1));
    }
    return stations[stations.length - 1][1];
  }

  const atlasWidth = 1024, atlasHeight = 512;
  const areas = {
    plate: [8, 8, 342, 168], door: [6, 194, 1012, 119],
    tailBadge: [385, 8, 606, 90], apex: [390, 106, 594, 64], noseBadge: [10, 348, 448, 98],
    maker:[486,347,212,62],dash:[712,333,306,153]
  };
  function atlasUV(name) {
    const [x, y, w, h] = areas[name];
    return quadUV.map(([a, v]) => [(x + a * w) / atlasWidth, 1 - (y + (1 - v) * h) / atlasHeight]);
  }
  function decals() {
    return texture(atlasWidth, atlasHeight, ctx => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const [x, y, w, h] = areas.plate;
      ctx.fillStyle = '#e9eddd'; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#a8aea3'; ctx.lineWidth = 5;
      ctx.strokeRect(x + 5, y + 5, w - 10, h - 10);
      ctx.fillStyle = '#244739';
      ctx.font = 'bold 40px "Hiragino Kaku Gothic ProN","Yu Gothic",sans-serif';
      ctx.fillText('群馬 55', x + w * 0.5, y + 37);
      ctx.font = 'bold 33px "Hiragino Kaku Gothic ProN",sans-serif';
      ctx.fillText('お', x + 30, y + 108);
      ctx.font = 'bold 78px "Arial Narrow","Helvetica Neue",sans-serif';
      ctx.fillText('13-954', x + 196, y + 113, 260);
      for (const bx of [x + 27, x + w - 27]) {
        ctx.fillStyle = '#7e857c'; ctx.beginPath(); ctx.arc(bx, y + 18, 6, 0, TAU); ctx.fill();
        ctx.fillStyle = '#d6dbcf'; ctx.fillRect(bx - 3, y + 16, 6, 2);
      }
      const japanese = '"Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans CJK JP",sans-serif';
      ctx.fillStyle = '#1b1c1d'; ctx.textAlign = 'left';
      ctx.font = '900 90px ' + japanese;
      const main = '藤原とうふ店';
      const mainWidth = ctx.measureText(main).width;
      ctx.save(); ctx.translate(12, 257); ctx.scale(1.19, 1);
      ctx.fillText(main, 0, 0);
      ctx.font = 'bold 60px ' + japanese;
      ctx.fillText('（自家用）', mainWidth + 5, 2);
      ctx.restore();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#171b1c';
      ctx.font = 'italic 700 67px "Arial Narrow",Arial,sans-serif';
      ctx.fillText('TRUENO', 688, 57, 555);
      ctx.textAlign='left'; ctx.font='italic bold 52px Arial,sans-serif';
      ctx.fillText('APEX',398,142);ctx.font='bold 28px Arial,sans-serif';ctx.fillText('TWIN CAM 16',559,148);
      ctx.textAlign='center';ctx.fillStyle = '#e1ded2'; ctx.font = 'bold 77px "Arial Narrow",Arial,sans-serif';
      ctx.fillText('TRUENO', 231, 396, 395);
      ctx.font='bold 42px "Arial Narrow",Arial,sans-serif';ctx.fillText('TOYOTA',592,378,196);
      // Silk-screened analogue instruments in the right-hand binnacle.
      ctx.fillStyle='#17191b';ctx.fillRect(712,333,306,153);ctx.lineCap='round';
      for(const [cx,scale] of [[785,8],[938,180]]){
        const cy=411,r=55;
        for(let i=0;i<=40;i++){
          const a=(.78+1.45*i/40)*Math.PI;
          ctx.strokeStyle=i>33&&scale===8?'#de674e':'#e9e2cd';
          ctx.lineWidth=i%5?1.25:2.5;const length=i%5?4:8;
          ctx.beginPath();ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
          ctx.lineTo(cx+(r-length)*Math.cos(a),cy+(r-length)*Math.sin(a));ctx.stroke();
          if(i%5===0){ctx.fillStyle=ctx.strokeStyle;ctx.font='10px Arial';ctx.fillText(String(Math.round(i*scale/40)),cx+(r-14)*Math.cos(a),cy+(r-14)*Math.sin(a));}
        }
        ctx.strokeStyle='#e57847';ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx-33,cy+21);ctx.stroke();
        ctx.fillStyle='#a2a298';ctx.beginPath();ctx.arc(cx,cy,3.4,0,TAU);ctx.fill();
      }
    });
  }

  function heatedHatch() {
    return texture(512, 256, (ctx, w, h) => {
      ctx.strokeStyle = 'rgba(153,99,66,.83)'; ctx.lineWidth = .49;
      for (let i = 0; i < 12; i++) {
        const sy = 31 + i * 18;
        ctx.beginPath(); ctx.moveTo(14, sy); ctx.quadraticCurveTo(w / 2, sy + 1.4, w - 14, sy); ctx.stroke();
      }
      ctx.lineWidth = 1.05;
      for (const sx of [14, w-14]) { ctx.beginPath(); ctx.moveTo(sx,31); ctx.lineTo(sx,229); ctx.stroke(); }
    });
  }

  function sealedBeam() {
    return texture(384,224,(ctx,w,h)=>{
      const reflector=ctx.createRadialGradient(w*.5,h*.51,3,w*.5,h*.51,w*.69);
      reflector.addColorStop(0,'#e1ddcd');reflector.addColorStop(1,'#686965');
      ctx.fillStyle=reflector;ctx.fillRect(0,0,w,h);
      for(let y=4;y<h-4;y+=8){
        ctx.fillStyle='rgba(122,120,101,.29)';ctx.fillRect(0,y,w,2.7);
        ctx.fillStyle='rgba(255,243,213,.22)';ctx.fillRect(0,y+3,w,1.3);
      }
      for(let x=2;x<w;x+=12){
        ctx.fillStyle='rgba(80,81,81,.21)';ctx.fillRect(x,4,2,h-8);
      }
      // The domed sealed beam has a bright filament and pressed spreading
      // flutes. The reflector can still be read around the filament at night.
      const vane=13;
      for(let i=0;i<29;i++){
        const x=i*vane,fringe=ctx.createLinearGradient(x,0,x+vane,0);
        fringe.addColorStop(0,'rgba(42,45,46,.49)');fringe.addColorStop(.30,'rgba(255,255,241,.02)');
        fringe.addColorStop(.73,'rgba(255,255,241,.32)');fringe.addColorStop(1,'rgba(39,40,41,.16)');
        ctx.fillStyle=fringe;const y=20+10*Math.cos(i*.43);ctx.fillRect(x,y,vane,h-y-15);
      }
      ctx.save();ctx.translate(w*.5,h*.51);ctx.scale(1,.72);
      const core=ctx.createRadialGradient(0,0,2,0,0,w*.28);
      core.addColorStop(0,'#fffdef');core.addColorStop(.15,'#fff7db');
      core.addColorStop(.39,'rgba(252,240,192,.55)');core.addColorStop(1,'rgba(250,236,193,0)');
      ctx.fillStyle=core;ctx.fillRect(-w*.29,-w*.29,w*.58,w*.58);ctx.restore();
      ctx.strokeStyle='rgba(36,39,40,.77)';ctx.lineWidth=7;ctx.strokeRect(4,4,w-8,h-8);
      ctx.strokeStyle='rgba(247,245,225,.65)';ctx.lineWidth=2;ctx.strokeRect(11,10,w-22,h-20);
      const shade = ctx.createLinearGradient(0, 0, 0, h);
      shade.addColorStop(0, 'rgba(0,0,0,0.46)'); shade.addColorStop(0.15, 'rgba(0,0,0,0)');
      shade.addColorStop(0.82, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, w, h);
    });
  }

  // Pressed prismatic glass in the combination lamps. The separate filament
  // image controls illumination inside the lens when braking or reversing.
  function combinationLens(filament=false) {
    return texture(256,160,(ctx,w,h)=>{
      const bowl=filament?ctx.createRadialGradient(w*.47,h*.59,2,w*.47,h*.59,w*.6):
        ctx.createLinearGradient(0,0,w*.14,h);
      for(const [stop,lit,unlit] of [[0,'#fffaed','#b9b9b2'],[.18,'#ffe9cf','#c9c6ba'],
        [.42,'#d9b4aa','#90918e'],[.58,'#9d8281','#5c605f'],[.85,'#48363d','#999a91'],[1,'#1c1820','#595c5c']])
        bowl.addColorStop(stop,filament?lit:unlit);
      ctx.fillStyle=bowl;ctx.fillRect(0,0,w,h);
      if(!filament)for(let i=0;i<9;i++){
        const x=(i+.15)*w/9;
        ctx.beginPath();ctx.moveTo(x,h*.42);ctx.lineTo(x+w*.083,h*.45);
        ctx.lineTo(x+w*.057,h*.87);ctx.lineTo(x+w*.021,h*.89);ctx.closePath();
        ctx.fillStyle=i%3?'rgba(232,231,217,.16)':'rgba(30,31,30,.16)';ctx.fill();
      }
      for(let row=0;row<h;row+=6)for(let col=-3;col<w;col+=7){
        const x=col+(row%12?3:0);
        ctx.fillStyle='rgba(32,33,34,.25)';ctx.fillRect(x,row,1.6,5);
        ctx.fillStyle='rgba(255,249,231,.30)';ctx.fillRect(x+2,row+1,3.5,1.2);
      }
      for(let y=0;y<h;y+=12){
        const flute=ctx.createLinearGradient(0,y,0,y+12);
        flute.addColorStop(0,'rgba(5,5,6,.34)');flute.addColorStop(.34,'rgba(15,15,15,.02)');
        flute.addColorStop(.8,'rgba(255,251,232,.18)');flute.addColorStop(1,'rgba(255,251,232,.04)');
        ctx.fillStyle=flute;ctx.fillRect(0,y,w,12);
      }
    });
  }

  function materials() {
    const surface = (roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({
      vertexColors: true, roughness, metalness, ...extra
    });
    const head=sealedBeam(),signal=combinationLens(),filament=combinationLens(true);
    const atlasFile='ae86-markings.webp';
    const marks=new THREE.TextureLoader().load(window.TougeArtURLs?.[atlasFile]||'assets/art/'+atlasFile);
    marks.colorSpace=THREE.SRGBColorSpace;marks.anisotropy=8;
    const m={
      paint: new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.235,metalness:.035,ior:1.53,
        clearcoat:.94,clearcoatRoughness:.066,envMapIntensity:1.10}),
      trim:surface(.61,.02),cloth:surface(.93,.005),vinyl:surface(.42,.025),metal:surface(.31,.73),rim:surface(.37,.6),brakeSteel:surface(.46,.65),
      blackTrim:new THREE.MeshPhysicalMaterial({vertexColors:true,roughness:.295,clearcoat:.52,clearcoatRoughness:.15}),
      tire:surface(.82,.015),glass:laminatedGlass(0x3a4848,.28),
      sideGlass:laminatedGlass(0x1b2224,.63),hatchGlass:laminatedGlass(0x151c1e,.74,heatedHatch()),
      marks: surface(0.54, 0.03, {
        map:marks, alphaTest: 0.28, alphaToCoverage: true,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
      }),
      tail:new THREE.MeshPhysicalMaterial({vertexColors:true,map:signal,color:0xa92823,roughness:.24,
        clearcoat:1,clearcoatRoughness:.095,emissiveMap:filament,emissive:0xff2314,emissiveIntensity:.09}),
      lens:new THREE.MeshPhysicalMaterial({vertexColors:true,map:signal,roughness:.24,clearcoat:1,clearcoatRoughness:.09}),
      reverseLens:surface(.24,.10,{map:signal,emissiveMap:filament,emissive:0xffe0ab,emissiveIntensity:0}),
      fog:surface(.22,.06,{map:head,emissiveMap:head,emissive:0xffae24,emissiveIntensity:.05}),
      head:surface(.18,.08,{map:head,emissiveMap:head,emissive:0xffedd2,emissiveIntensity:1.43})
    };
    for(const key of ['paint','blackTrim','metal','rim','glass','sideGlass','hatchGlass','lens','tail','reverseLens'])m[key].userData.routeReflections=true;
    m.paint.userData.lacquer=true;
    return m;
  }

  // Section stations describe the bare flank, inside the rolled arch lips.
  // At the axle planes the lips bring the final body to 1.610 / 1.625 m.
  const widths = [[-1.98,.740],[-1.80,.787],[frontAxle,.80168],[-.73,.797],[.05,.797],
    [.69,.801],[rearAxle,.808034],[1.64,.800],[1.83,.787],[1.98,.750]];
  const heights = [[-1.98, 0.620], [-1.85, 0.662], [-1.56, 0.704], [-1.16, 0.741], [-0.81, 0.789],
    [-0.50, 0.789], [0.0, 0.794], [0.58, 0.800], [1.20, 0.807], [1.58, 0.819],
    [1.78, 0.834], [1.89, 0.826], [1.98, 0.784]];
  const deck = z => sample(heights, z);
  const width = z => sample(widths, z);
  function sideAt(s, z, y, lift = 0) {
    const h = deck(z);
    const inset = sample([[0.20, 0.046], [0.30, 0.028], [0.455, 0.008], [0.585, 0],
      [Math.max(0.596, h - 0.045), 0.008], [h, 0.048]], y);
    return [s * (width(z) - inset + lift), y, z];
  }
  function hoodAt(z, x, lift = 0) {
    const fraction = Math.abs(x) / (width(z) - 0.048);
    const bonnet=THREE.MathUtils.smoothstep(z,-1.98,-1.74)*(1-THREE.MathUtils.smoothstep(z,-.98,-.81));
    const fold=.62+.17*clamp((z+1.9)/1.05,0,1);
    const swage=.010*bonnet*Math.exp(-((fraction-fold)**2)/.008)*Math.max(0,1-fraction**8);
    return [x, deck(z) + .016*Math.max(0,1-fraction*fraction) + swage + lift, z];
  }
  const archR = 0.328, archH = 0.330;
  function sideNormal(s,z,y){
    const dz=minus(sideAt(s,z+.006,y),sideAt(s,z-.006,y));
    const dy=minus(sideAt(s,z,y+.002),sideAt(s,z,y-.002));
    return unit(scale(cross(dy,dz),s));
  }
  function opening(z) {
    for (const axle of [frontAxle, rearAxle]) {
      const d = (z - axle) / archR;
      if (Math.abs(d) <= 1.00001) return tireRadius + archH * Math.sqrt(Math.max(0, 1 - d * d));
    }
    return 0.226;
  }
  function shell(b) {
    const zs = new Set([...widths, ...heights].map(p => p[0]));
    zs.add(-0.80); zs.add(1.775);
    for (const axle of [frontAxle, rearAxle]) {
      for (let i = 0; i <= 22; i++) zs.add(axle - archR * Math.cos(i * Math.PI / 22));
      zs.add(axle - archR - 0.0003); zs.add(axle + archR + 0.0003);
    }
    const spans = [...zs].sort((a, c) => a - c);
    const courses = [
      ['trim',0x222426],['blackTrim',0x202124],['paint',white],['blackTrim',0x17191a],
      ['paint',white],['paint',white],['paint',white]
    ];
    function levels(z) {
      const h = deck(z), cut = opening(z);
      return [cut,.267,.412,.449,.493,Math.min(h-.051,.604),h-.038,h]
        .map(y => Math.max(y, cut));
    }
    for (let i = 1; i < spans.length; i++) {
      const a = spans[i - 1], c = spans[i], aa = levels(a), cc = levels(c);
      for (const s of [-1, 1]) {
        for (let j = 0; j < courses.length; j++) {
          const corners=[[a,aa[j]],[c,cc[j]],[c,cc[j+1]],[a,aa[j+1]]];
          b.face(courses[j][0],corners.map(([z,y])=>sideAt(s,z,y)),[s,0,0],courses[j][1],
            quadUV,corners.map(([z,y])=>sideNormal(s,z,y)));
        }
        // Leave the cabin open under the windows; the parcel shelf sits inside it.
        const inside = (a + c) * 0.5 > -0.80 && (a + c) * 0.5 < 1.775;
        const innerAt = z => inside ? s * (width(z) - 0.108) : 0;
        const outerAt = z => s * (width(z) - 0.048);
        b.patch('paint',inside?2:16,2,(u,v)=>{
          const z=mix(a,c,v);
          return hoodAt(z,mix(innerAt(z),outerAt(z),u));
        },up,white);
        // A dark wheel house turns inward at each cut edge.
        b.face('trim', [sideAt(s, a, aa[0]), sideAt(s, c, cc[0]), [s * 0.575, cc[0], c],
          [s * 0.575, aa[0], a]], down, 0x22232a);
      }
    }
    box(b, 'trim', [0, 0.27, 0], [1.17, 0.11, 3.72], 0x202126);
    box(b, 'trim', [0, 0.635, 0.48], [1.38, 0.26, 2.37], 0x282a2c);
    for (const s of [-1, 1]) {
      for (const axle of [frontAxle, rearAxle]) {
        for (let i = 0; i < 22; i++) {
          const angleA = Math.PI * i / 22, angleB = Math.PI * (i + 1) / 22;
          const edge = (a, offset) => sideAt(s, axle - (archR + offset) * Math.cos(a),
            tireRadius + (archH + offset) * Math.sin(a), 0.006);
          const above = tireRadius + archH * Math.sin((angleA + angleB) / 2) > 0.478;
          b.face(above ? 'paint' : 'trim', [edge(angleA, 0), edge(angleB, 0),
            edge(angleB, 0.014), edge(angleA, 0.014)], [s, 0, 0], above ? 0xdeddd5 : graphite);
        }
      }
      // Crisp rolled door shut lines, low rocker, handle and lock barrel.
      const seam = [[-0.780, 0.780], [-0.760, 0.617], [-0.731, 0.354], [-0.683, 0.277],
        [0.513, 0.277], [0.566, 0.33], [0.594, 0.544], [0.586, 0.789]];
      for (let j = 1; j < seam.length; j++) rod(b, 'trim', sideAt(s, ...seam[j - 1], 0.003),
        sideAt(s, ...seam[j], 0.003), 0.0026, 0x494a4d, 4);
      box(b, 'trim', sideAt(s, 0.435, 0.715, 0.005), [0.017, 0.040, 0.125], rubber);
      box(b, 'metal', sideAt(s, 0.432, 0.724, 0.014), [0.009, 0.012, 0.103], 0x626365);
      rod(b, 'metal', sideAt(s, 0.521, 0.703, 0.002), sideAt(s, 0.521, 0.703, 0.011),
        0.010, 0x80817c, 10);
      box(b, 'trim', [s * 0.770, 0.246, -0.04], [0.032, 0.044, 1.65], graphite);
      // Small amber repeaters at the leading fenders.
      box(b, 'trim', sideAt(s, -1.668, 0.554, 0.003), [0.015, 0.046, 0.102], rubber);
      b.patch('lens',5,3,(u,v)=>sideAt(s,mix(-1.710,-1.627,u),mix(.540,.570,v),
        .012+.003*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)),[s,0,0],0xf1a14a);
    }
    // The door skin changes rake at the belt line. Follow the stamped metal
    // so the ends of the lettering cannot disappear into a single flat quad.
    const doorUV = atlasUV('door');
    const zRows = [0.445, 0.05, -0.28, -0.5, -0.703], yRows = [0.551, 0.604, 0.690];
    for (let i = 1; i < zRows.length; i++) for (let j = 1; j < yRows.length; j++) {
      const corners = [[zRows[i-1], yRows[j-1]], [zRows[i], yRows[j-1]],
        [zRows[i], yRows[j]], [zRows[i-1], yRows[j]]];
      const uv = corners.map(([z, y]) => [
        mix(doorUV[0][0], doorUV[1][0], (0.445 - z) / 1.148),
        mix(doorUV[0][1], doorUV[3][1], (y - 0.551) / 0.139)
      ]);
      b.face('marks', corners.map(([z, y]) => sideAt(1, z, y, 0.004)), right, 0xffffff, uv);
    }
    for (const s of [-1, 1]) {
      const path = [[-1.929, 0.362], [-1.59, 0.392], [-1.22, 0.504], [-0.837, 0.630]];
      for (let i = 1; i < path.length; i++) rod(b, 'trim',
        hoodAt(path[i - 1][0], s * path[i - 1][1], 0.002),
        hoodAt(path[i][0], s * path[i][1], 0.002), 0.0027, 0x646360, 4);
    }
    const cowl=[];
    for(let i=0;i<=16;i++)cowl.push(hoodAt(-.854,mix(-.63,.63,i/16),.002));
    tube(b,'trim',cowl,.0021,0x525451,5);
    for(const side of [-1,1]){
      for(let i=0;i<22;i++){
        const x=side*(.095+i*.019);
        b.face('trim',[hoodAt(-.847,x-.003,.0017),hoodAt(-.847,x+.003,.0017),
          hoodAt(-.819,x+.006,.0017),hoodAt(-.819,x,.0017)],up,0x454841);
      }
      box(b,'trim',hoodAt(-.974,side*.36,.002),[.013,.007,.018],0x333638);
    }
  }

  function cabinSide(s, z, y, lift = 0) {
    return [s * (mix(0.748, 0.606, clamp((y - 0.790) / 0.498, 0, 1)) + lift), y, z];
  }
  function panePoint(isRear, u, v) {
    const curved = 1 - u * u;
    const crown=curved*Math.sin(v*Math.PI);
    const x = u * mix(isRear ? 0.738 : 0.748, 0.606, v);
    const y = mix(isRear ? 0.832 : 0.789, 1.286, v) + curved * mix(0.009, 0.035, v) + crown * (isRear?.012:.008);
    const z = isRear ? mix(1.778, 0.664, v) + 0.031 * crown
      : mix(-0.815, -0.246, v) - 0.024 * crown;
    return [x, y, z];
  }
  function glazedOpening(b,back) {
    // One curved stamping carries the opening, rolled rubber and glass. Share
    // their boundary vertices so thin reflections hold together from the chase.
    const facing=[0,1,back?1:-1],across=32,along=10;
    const width=back?.923:.947,sill=back?.077:.040,head=back?.952:.966;
    const outer=opening(1,0,1,0),seal=opening(width,sill,head,1);
    const glass=opening(width-.020,sill+.019,head-.020,.86);
    function opening(halfWidth,bottom,top,radius){
      return (u,v)=>{
        const edge=clamp((Math.abs(u)-.90)/.10,0,1);
        const corner=radius*(1-Math.sqrt(Math.max(0,1-edge*edge)));
        return panePoint(back,u*halfWidth,mix(bottom+.042*corner,top-.034*corner,v));
      };
    }
    function border(from,to,finish,color,bead){
      const edges=[t=>[2*t-1,0],t=>[2*t-1,1],t=>[-1,t],t=>[1,t]];
      for(let i=0;i<edges.length;i++){
        b.patch(finish,i<2?across:along,bead?4:2,(t,v)=>{
          const [u,h]=edges[i](t),a=from(u,h),c=to(u,h);
          const lip=bead*Math.sin(Math.PI*v);
          return [mix(a[0],c[0],v),mix(a[1],c[1],v)+lip,mix(a[2],c[2],v)+lip*(back?.45:-.8)];
        },facing,color);
      }
    }
    border(outer,seal,'paint',white,0);
    border(seal,glass,'trim',0x232629,.004);
    b.patch(back?'hatchGlass':'glass',across,along,(u,v)=>glass(2*u-1,v),facing,0xffffff);
  }
  function glazing(b) {
    glazedOpening(b,false);glazedOpening(b,true);
    for (const s of [-1, 1]) {
      const plane = (finish, points, color, inset = 0) => b.face(finish, points.map(([z, y]) => cabinSide(s, z, y, inset)),
        [s, 0, 0], color);
      const a = [-0.815, 0.789], f = [-0.246, 1.286], t = [0.664, 1.286], end = [1.778, 0.832];
      const q0 = [-0.701, 0.817], q1 = [0.496, 0.827], q2 = [0.426, 1.240], q3 = [-0.201, 1.239];
      const w0 = [0.552, 0.830], w1 = [1.483, 0.855], w2 = [0.615, 1.228], w3 = [0.485, 1.241];
      plane('paint', [a, f, q3, q0], white);                         // A-pillar
      const aboveDoor = [q2[0], f[1]], aboveQuarter = [w3[0], f[1]];
      plane('paint', [f, aboveDoor, q2, q3], white);                  // roof rail
      plane('paint', [aboveDoor, aboveQuarter, w3, q2], white);
      plane('paint', [aboveQuarter, t, w2, w3], white);
      plane('paint', [t, end, w1, w2], white);                       // C-pillar and hatch frame
      plane('trim', [q1, w0, w3, q2], 0x25272b);                    // B-pillar
      const sill = [a, q0, q1, w0, w1, end];
      const sillBottom = ([z]) => [z, sample([a,[0.50,0.799],end], z)];
      for (let i = 1; i < sill.length; i++) {
        const a = sill[i-1], c = sill[i];
        plane('paint', [a, c, sillBottom(c), sillBottom(a)], white);
      }
      plane('sideGlass', [q0, q1, q2, q3], 0xffffff, -0.004);
      plane('sideGlass', [w0, w1, w2, w3], 0xffffff, -0.004);
      for (const outline of [[q0, q1, q2, q3], [w0, w1, w2, w3]]) {
        for (let j = 0; j < outline.length; j++) {
          const n = (j + 1) % outline.length;
          rod(b, 'trim', cabinSide(s, ...outline[j], 0.002), cabinSide(s, ...outline[n], 0.002),
            j === 0 ? 0.012 : 0.009, 0x26282b, 5);
        }
      }
      const quarterSlant = [1.68, 0.855];
      rod(b, 'trim', cabinSide(s, 0.675, 1.269, 0.002), cabinSide(s, ...quarterSlant, 0.002),
        0.0028, 0x747671, 4);
      // Fine steel rain gutter along the roof rail.
      rod(b, 'metal', cabinSide(s, -0.235, 1.278, 0.009), cabinSide(s, 0.664, 1.278, 0.009),
        0.006, 0x8a8b87, 5);
      rod(b, 'trim', cabinSide(s, -0.745, 0.805), cabinSide(s, 0.492, 0.816), 0.010, 0x2e3031);
      rod(b, 'trim', cabinSide(s, 0.500, 0.816), cabinSide(s, 1.619, 0.846), 0.010, 0x2e3031);
      // Triangular mounting base and angular, folded door mirrors.
      plane('trim', [[-0.700, 0.820], [-0.555, 0.820], [-0.552, 0.932]], rubber);
      rod(b, 'trim', cabinSide(s, -0.595, 0.850), [s * 0.817, 0.863, -0.614], 0.020, graphite, 6, 0.026);
      // The die-cast shell narrows toward the nose. Its rolled rim leaves a
      // black reveal around the lightly convex, rear-facing mirror.
      const mirrorRing=(angle,size,z)=>{
        const c=Math.cos(angle),h=Math.sin(angle);
        const x=Math.sign(c)*Math.abs(c)**.46,y=Math.sign(h)*Math.abs(h)**.48;
        return [s*(.858+size*(.070*x+.003*y)),.897+size*(.042*y-.004*x),
          z-.011*x+.004*y];
      };
      const rings=[[.06,-.688],[.72,-.684],[.94,-.670],[1,-.637],[1,-.599],[.96,-.590]];
      for(let i=1;i<rings.length;i++){
        const [sa,za]=rings[i-1],[sb,zb]=rings[i];
        b.patch('blackTrim',32,2,(u,v)=>mirrorRing(u*TAU,mix(sa,sb,v),mix(za,zb,v)),
          u=>[s*Math.cos(u*TAU),Math.sin(u*TAU),i<3?-1:0],0x303336);
      }
      b.patch('trim',32,2,(u,v)=>mirrorRing(u*TAU,mix(.96,.83,v),-.590-.003*v),rear,0x202225);
      b.patch('metal',32,4,(u,v)=>mirrorRing(u*TAU,.83*v,-.593+.002*(1-v*v)),rear,0xc2c8cb);
    }
    function roof(u, v) {
      return [u * 0.606, 1.286 + (1 - u * u) * (0.035 + Math.sin(v * Math.PI) * 0.014),
        mix(-0.246, 0.664, v)];
    }
    b.patch('paint',24,12,(u,v)=>roof(2*u-1,v),up,white);
    function wiper(back, a, elbow, bladeA, bladeB) {
      const offset = [0, 0.009, back ? 0.006 : -0.006];
      const p = ([u, v]) => plus(panePoint(back, u, v), offset);
      const mid = [(bladeA[0] + bladeB[0]) / 2, (bladeA[1] + bladeB[1]) / 2];
      rod(b, 'metal', p(a), p(elbow), 0.006, 0x363b3c, 6);
      rod(b, 'metal', p(elbow), p(mid), 0.005, 0x363b3c, 6);
      const edge=[];
      for(let i=0;i<=5;i++)edge.push(p([mix(bladeA[0],bladeB[0],i/5),mix(bladeA[1],bladeB[1],i/5)]));
      tube(b,'trim',edge,.0055,0x27292b,5);
      for(const t of [.20,.80]){
        const claw=p([mix(bladeA[0],bladeB[0],t),mix(bladeA[1],bladeB[1],t)]);
        rod(b,'metal',plus(p(mid),[0,.006,0]),claw,.003,0x4a4b49,5);
      }
    }
    wiper(true, [0.25, 0.050], [0.045, 0.143], [-0.58, 0.231], [0.16, 0.144]);
    wiper(false, [-0.39, 0.044], [-0.20, 0.073], [-0.37, 0.112], [0.11, 0.100]);
    wiper(false, [0.30, 0.043], [0.52, 0.075], [0.34, 0.104], [0.84, 0.119]);
  }

  function cushion(b,cx,rows,color) {
    const signed=(x,p)=>Math.sign(x)*Math.abs(x)**p;
    b.patch('cloth',28,(rows.length-1)*2,(u,v)=>{
      const a=TAU*u,k=v*(rows.length-1),i=Math.min(Math.floor(k),rows.length-2);
      const [y,w,d,z]=rows[i].map((n,j)=>mix(n,rows[i+1][j],k-i));
      return [cx+w*signed(Math.cos(a),.68),y,z+d*signed(Math.sin(a),.66)];
    },u=>[Math.cos(TAU*u),0,Math.sin(TAU*u)],color);
  }

  function frontSeat(b,cx){
    cushion(b,cx,[[.609,.154,.175,-.065],[.628,.200,.217,-.075],[.673,.216,.236,-.078],
      [.712,.209,.232,-.080],[.732,.175,.196,-.085],[.740,.001,.001,-.091]],0x3f373a);
    const back=[[.696,.150,.065,.120],[.725,.205,.080,.125],[.813,.216,.076,.143],
      [.903,.205,.066,.155],[.963,.180,.058,.169],[.994,.131,.050,.174],
      [1.008,.059,.024,.177],[1.010,.001,.001,.177]];
    cushion(b,cx,back,0x34363a);
    const leading=back.map(([y,width,depth,z])=>[y,z-depth]);
    // Burgundy cloth centre with raised bolsters and sewn horizontal pleats.
    const insert=(u,v)=>{
      const x=(2*u-1)*(.133+.015*Math.sin(Math.PI*v));
      const y=.735+.228*v+.009*Math.sin(u*Math.PI);
      const z=sample(leading,y)-.005+.007*Math.abs(2*u-1)**3+.0012*Math.cos(v*TAU*4);
      return [cx+x,y,z];
    };
    b.patch('cloth',16,22,insert,front,0x674c55);
    for(const side of [-1,1]){
      const lo=side<0?0:1;
      const bol=(u,v)=>{
        const p=insert(lo,v);
        p[0]+=side*(.006+.040*u)*Math.sin(Math.PI*(.06+.87*v));
        p[2]-=.024*Math.sin(Math.PI*u)*Math.sin(Math.PI*v);
        return p;
      };
      b.patch('cloth',8,13,bol,front,0x513c44);
      tube(b,'cloth',Array.from({length:10},(_,i)=>insert(lo,i/9)),.0017,0x948088,5);
    }
    // Padded loop with a genuine through-opening, seen from both windows.
    // The outer edge rolls forward at the crown like the GT-APEX seat.
    const soft=x=>Math.sign(x)*Math.abs(x)**.68;
    b.patch('vinyl',36,16,(u,v)=>{
      const a=TAU*u,c=TAU*v,r=(1+Math.cos(c))*.5;
      const x=soft(Math.cos(a))*mix(.058,.122,r);
      const y=1.088+mix(-.012,0,r)+soft(Math.sin(a))*mix(.028,.089,r);
      return [cx+x,y,.187+(y-1.088)*.13+.047*Math.sin(c)];
    },(u,v)=>[Math.cos(TAU*u)*Math.cos(TAU*v),Math.sin(TAU*u)*Math.cos(TAU*v),Math.sin(TAU*v)],0x313336);
    for(const x of [-.054,.054])rod(b,'metal',[cx+x,.985,.17],[cx+x,1.018,.175],.006,0x7c7a75,8);
  }

  function cabin(b) {
    cushion(b,0,[[.655,.636,.108,-.570],[.746,.700,.147,-.580],[.804,.707,.152,-.610],
      [.835,.648,.105,-.636],[.841,.001,.001,-.64]],0x363638);
    for(const x of [-.342,.356]){
      frontSeat(b,x);
      cushion(b,x,[[.635,.266,.075,.840],[.719,.305,.087,.824],[.834,.280,.070,.862],
        [.900,.242,.055,.899],[.928,.182,.042,.903],[.933,.001,.001,.903]],0x4a3f45);
      for(const edge of [-.19,.19])rod(b,'cloth',[x+edge,.709,.745],[x+edge*.87,.879,.834],.0026,0x7d686f,5);
    }
    box(b,'cloth',[0,.754,1.349],[1.32,.035,.770],0x363739,.04);
    for(const side of [-1,1]){
      rod(b,'trim',[side*.640,1.156,.396],[side*.596,.779,.413],.010,0x26282a,5);
      box(b,'trim',[side*.695,.652,.095],[.038,.246,.915],0x3d383d);
      box(b,'cloth',[side*.676,.685,.061],[.016,.112,.657],0x5e4b52);
      box(b,'vinyl',[side*.639,.642,.083],[.070,.036,.268],0x323337);
    }
    const wheel=a=>[.348+Math.cos(a)*.153,.898+Math.sin(a)*.143,-.414-Math.sin(a)*.046];
    tube(b,'vinyl',Array.from({length:33},(_,i)=>wheel(i*TAU/32)),.013,0x252729,9);
    for(const a of [.11,Math.PI-.11,Math.PI*1.5]){
      const center=[.348,.898,-.414],p=wheel(a),half=.013;
      b.face('metal',[plus(center,[-half,0,.006]),plus(p,[0,-half,0]),plus(p,[0,half,0]),plus(center,[half,.012,.004])],rear,0x777678);
    }
    rod(b,'vinyl',[.348,.896,-.421],[.348,.898,-.402],.046,0x343539,16);
    box(b,'trim',[.343,.847,-.577],[.350,.103,.140],0x252629,-.10);
    const dashFace=[[.508,.817,-.499],[.178,.817,-.499],[.178,.900,-.515],[.508,.900,-.515]];
    b.face('marks',dashFace,rear,0xffffff,atlasUV('dash'));
    const center=[0,.630,-.180];box(b,'trim',center,[.160,.085,.460],0x2a2b2d,-.08);
    rod(b,'vinyl',[.004,.650,-.234],[.004,.759,-.215],.010,0x2b2d2e,9,.008);
    cushion(b,.004,[[.745,.012,.014,-.215],[.754,.025,.023,-.215],[.773,.027,.024,-.216],[.783,.011,.010,-.216]],0x303137);
    box(b,'trim',[0,1.200,-.364],[.187,.056,.025],rubber);
    b.face('metal',[[-.086,1.177,-.350],[.086,1.177,-.350],[.086,1.220,-.351],[-.086,1.220,-.351]],rear,0x929c99);
    rod(b,'trim',[0,1.216,-.364],[0,1.266,-.308],.007,graphite);
  }

  function buildDriver(b) {
    // A seated delivery driver is visible through the raked glass.
    function figure(rows, shade) {
      const point = ([y, w, depth, z], a) => [0.345 + Math.cos(a) * w, y, z + Math.sin(a) * depth];
      for (let j = 1; j < rows.length; j++) {
        for (let i = 0; i < 12; i++) {
          const a = i * TAU / 12, c = (i + 1) * TAU / 12, m = (a + c) * 0.5;
          b.face('trim', [point(rows[j - 1], a), point(rows[j - 1], c), point(rows[j], c), point(rows[j], a)],
            [Math.cos(m), 0, Math.sin(m)], shade(j, m));
        }
      }
    }
    figure([[0.716, 0.133, 0.069, 0.021], [0.868, 0.151, 0.090, 0.018],
      [0.958, 0.174, 0.085, 0.011], [0.994, 0.124, 0.073, 0.009], [1.001, 0.043, 0.041, -0.014]],
      () => 0x3d454a);
    const skin = 0xb89477, hair = 0x292628;
    figure([[0.989, 0.042, 0.035, -0.021], [1.026, 0.045, 0.045, -0.024],
      [1.045, 0.060, 0.066, -0.041], [1.091, 0.078, 0.082, -0.035],
      [1.143, 0.084, 0.091, -0.024], [1.176, 0.088, 0.094, -0.020],
      [1.203, 0.074, 0.082, -0.018], [1.222, 0.044, 0.050, -0.014], [1.229, 0.001, 0.001, -0.014]],
      (level, angle) => level >= 6 || (level >= 3 && Math.sin(angle) > 0.2)
        || (level >= 5 && Math.sin(angle) > -0.65) ? hair : skin);
    for (const side of [-1, 1]) {
      const shoulder = [0.345 + side * 0.141, 0.953, -0.003];
      const elbow = [0.345 + side * 0.170, 0.837, -0.156];
      const wrist = [0.345 + side * 0.108, 0.931, -0.360];
      rod(b, 'trim', shoulder, elbow, 0.046, 0x42494b, 8, 0.034);
      rod(b, 'trim', elbow, wrist, 0.034, 0x454b4d, 8, 0.026);
      rod(b, 'trim', wrist, plus(wrist, [0, 0.008, -0.049]), 0.024, skin, 8, 0.029);
    }
  }

  function bumper(b,side) {
    const frontEnd=side<0, end=frontEnd?2.104:2.101;
    // Form the radiused ends in plan. The side returns run into the side
    // moulding without a square step at the end of the bumper.
    const levels=frontEnd?[
      [.228,-.024,'trim',0x242628],[.247,-.008,'trim',0x242628],[.274,.002,'trim',0x27292c],
      [.362,.010,'blackTrim',0x1e2022],[.444,.008,'blackTrim',0x282a2c],
      [.478,-.004,'trim',0x282a2c],[.496,-.031,'trim',0x36383a]
    ]:[
      [.247,-.030,'trim',0x1e2022],[.266,-.011,'trim',0x25272a],[.299,.001,'trim',0x25272a],
      [.386,.010,'blackTrim',0x222426],[.408,.010,'paint',white],
      [.458,.003,'paint',white],[.483,-.010,'paint',white],[.501,-.031,'paint',white]
    ];
    const across=[
      [-.790,1.800],[-.796,1.892],[-.793,1.967],[-.783,2.005],[-.761,2.036],[-.729,2.059],
      [-.682,2.073],[-.569,2.081],[-.390,2.087],[0,2.094],
      [.390,2.087],[.569,2.081],[.682,2.073],[.729,2.059],[.761,2.036],[.783,2.005],[.793,1.967],[.796,1.892],[.790,1.800]
    ];
    const point=(i,j)=>{
      const [x,z]=across[i],[y,bulge]=levels[j];
      const tangent=minus(across[Math.min(i+1,across.length-1)],across[Math.max(0,i-1)]);
      const len=Math.hypot(...tangent),nx=-tangent[1]/len,nz=tangent[0]/len;
      return [x+nx*bulge,y,side*(z+end-2.104+nz*bulge)];
    };
    for(let i=0;i<across.length-1;i++){
      for(let j=0;j<levels.length-1;j++){
        if(frontEnd && j===3 && Math.max(Math.abs(across[i][0]),Math.abs(across[i+1][0]))<=.569)continue;
        const points=[point(i,j),point(i+1,j),point(i+1,j+1),point(i,j+1)];
        const out=[across[i][0]*.58,j===0?-.55:j===levels.length-2?.75:0,side];
        b.face(levels[j][2],points,out,levels[j][3]);
      }
      for(const j of [0,levels.length-1]){
        const a=point(i,j),c=point(i+1,j),ret=[0,j===0?.018:-.012,-side*.084];
        b.face(j===0?'trim':levels[j][2],[a,c,plus(c,ret),plus(a,ret)],j===0?down:up,j===0?rubber:levels[j][3]);
      }
    }
  }

  function rearFascia(b) {
    const p=(x,y,lift=0)=>[x,y,1.980+.045*(1-(Math.abs(x)/.752)**4)+.024*(.68-y)+lift];
    const panel=(finish,x0,x1,y0,y1,color,lift=0,uv=quadUV)=>{
      const at=(u,v)=>p(mix(x0,x1,u),mix(y0,y1,v),lift);
      const shade=(u,v)=>[mix(uv[0][0],uv[1][0],u),mix(uv[0][1],uv[3][1],v)];
      b.patch(finish,Math.max(2,Math.ceil(Math.abs(x1-x0)/.085)),1,at,rear,color,shade);
    };
    panel('paint',-.751,.751,.439,.787,white);
    b.patch('paint',24,3,(u,v)=>{
      const x=mix(-.750,.750,u);
      const aft=p(x,.787),deck=hoodAt(1.965,x*.934);
      return [mix(aft[0],deck[0],v),mix(aft[1],deck[1],v)+.007*Math.sin(Math.PI*v),mix(aft[2],deck[2],v)];
    },up,white);
    // Glossy continuous zenki garnish, with a fresh black edge around the
    // two fluted combinations and the registration recess.
    panel('blackTrim',-.746,.746,.481,.704,0x16181a,.006);
    panel('blackTrim',-.749,.749,.695,.709,0x242628,.008);
    for(const side of [-1,1]){
      const lens=(mat,x0,x1,y0,y1,color,lift=.016)=>panel(mat,side*x0,side*x1,y0,y1,color,lift);
      lens('blackTrim',.251,.743,.504,.681,0x232426,.011);
      const optic=(finish,x0,x1,y0,y1,color)=>{
        b.patch(finish,8,5,(u,v)=>{
          const bulge=.0065*(1-(2*u-1)**4)*(1-(2*v-1)**4);
          return p(side*mix(x0,x1,u),mix(y0,y1,v),.016+bulge);
        },rear,color);
      };
      optic('tail',.258,.374,.530,.652,0xffffff);
      optic('tail',.379,.488,.599,.652,0xffffff);
      optic('reverseLens',.379,.488,.530,.595,0xb8b4a8);
      optic('tail',.492,.606,.530,.652,0xffffff);
      optic('lens',.610,.734,.530,.652,0xe09a43);
      for(const y of [.519,.660])lens('blackTrim',.251,.739,y,y+.010,0x25272a,.017);
      // The outboard indicator and its bezel turn continuously onto the wing.
      for(const [finish,y0,y1,color] of [['blackTrim',.501,.697,0x1f2122],['lens',.531,.650,0xcc752b]]){
        const height=v=>mix(y0,y1,v);
        b.patch(finish,8,1,(u,v)=>{
          const y=height(v),z=mix(1.839,1.980,u);
          return sideAt(side,z,y,finish==='lens'?.008:.004);
        },[side,0,0],color);
        b.patch(finish,6,1,(u,v)=>{
          const y=height(v),a=p(side*(finish==='lens'?.733:.742),y,finish==='lens'?.016:.009);
          const c=sideAt(side,1.980,y,finish==='lens'?.008:.004);
          return [mix(a[0],c[0],u)+side*.004*Math.sin(Math.PI*u),y,mix(a[2],c[2],u)];
        },[side,0,1],color);
      }
    }
    panel('marks',-.664,-.346,.731,.767,0xffffff,.0035,atlasUV('apex'));
    panel('marks',.467,.688,.721,.754,0xffffff,.0035,atlasUV('tailBadge'));
    rod(b,'metal',p(.008,.767,.002),p(.008,.767,.009),.0115,0x484c4d,12);
    panel('blackTrim',-.241,.241,.477,.696,0x27292b,.012);
    panel('marks',-.063,.063,.665,.689,0xffffff,.017,atlasUV('maker'));
    panel('trim',-.169,.169,.480,.653,0x373534,.018);
    panel('marks',-.165,.165,.484,.649,0xffffff,.021,atlasUV('plate'));
    for(const side of [-1,1]){
      box(b,'blackTrim',p(side*.197,.544,.029),[.053,.055,.027],0x232629);
      box(b,'lens',p(side*.174,.546,.031),[.007,.034,.014],0xe3e5d6);
    }
    // Two stamped hatch corners run into the upper edge of the lamp trim.
    for(const side of [-1,1]){
      const hatchSeam=[
        panePoint(true,side*.984,.014),hoodAt(1.863,side*.723,.001),p(side*.718,.787,.001),
        p(side*.717,.758,.001),p(side*.711,.712,.001)];
      tube(b,'trim',hatchSeam,.0027,0x414342,5);
    }
    // Rolled stainless exhaust tip with a recessed, open bore.
    const tip = (r, z, a) => [-0.555 + r * Math.cos(a), 0.227 + r * Math.sin(a), z];
    for (let j = 0; j < 20; j++) {
      const a = j * TAU / 20, c = (j + 1) * TAU / 20;
      b.face('metal', [tip(0.045, 1.827, a), tip(0.045, 1.827, c), tip(0.051, 2.079, c), tip(0.051, 2.079, a)],
        [Math.cos(a), Math.sin(a), 0], 0x828488);
      b.face('metal', [tip(0.051, 2.079, a), tip(0.051, 2.079, c), tip(0.041, 2.079, c), tip(0.041, 2.079, a)], rear, 0xbbbcb8);
      b.face('trim', [tip(0.041, 2.079, a), tip(0.041, 2.079, c), [-0.555, 0.227, 2.048]], rear, 0x17181b);
    }
  }

  function nose(b,raised,closed) {
    const p = (x, y, offset = 0) => [x, y, -1.985 - 0.048 * (1 - Math.pow(Math.abs(x) / 0.74, 4)) - offset];
    for (let i = 0; i < 12; i++) {
      const a = mix(-0.740, 0.740, i / 12), c = mix(-0.740, 0.740, (i + 1) / 12);
      const top = x => 0.621 + 0.015 * (1 - Math.pow(Math.abs(x) / 0.74, 2));
      b.face('paint', [p(a, 0.460), p(c, 0.460), p(c, top(c)), p(a, top(a))], front, white);
      b.face('paint', [p(a, top(a)), p(c, top(c)), hoodAt(-1.98, c * 0.934), hoodAt(-1.98, a * 0.934)], up, white);
      const left=a*.81,right=c*.81;
      b.face('trim', [p(left,.479,.006),p(right,.479,.006),
        p(right,.588,.006),p(left,.588,.006)],front,0x1d2024);
      // A single folded rail catches light along the original upper grille.
      b.face('blackTrim',[p(left,.533,.009),p(right,.533,.009),p(right,.537,.023),p(left,.537,.023)],down,0x35383b);
      b.face('blackTrim',[p(left,.537,.023),p(right,.537,.023),p(right,.544,.023),p(left,.544,.023)],front,0x3b4042);
      b.face('blackTrim',[p(left,.544,.023),p(right,.544,.023),p(right,.552,.010),p(left,.552,.010)],up,0x666965);
    }
    for (const s of [-1, 1]) {
      const pod = (x, y, z) => [s * x, y, z];
      // Fixed corner lamps flank the centre grille, still visible with the
      // headlamp doors down. Their outboard ends follow the nose in plan.
      for(const [finish,inset,depth,color] of [['trim',0,.012,0x202327],['lens',.007,.016,0x9b9d92]]){
        b.patch(finish,8,3,(u,v)=>{
          const x=mix(.598+inset,.741-inset,u);
          const y=mix(.479+inset+.006*u,.607-inset+.005*u,v);
          const lens=p(s*x,y,depth+.004*(1-(2*v-1)**4));
          lens[2]+=.007*u*u;
          return lens;
        },front,color);
      }
      const l = .399, r = .674, lensZ = -1.873;
      const topA = pod(l, 0.837, lensZ), topB = pod(r, 0.829, lensZ + 0.009);
      const bottomA = pod(l, 0.674, lensZ - 0.005), bottomB = pod(r, 0.669, lensZ + 0.005);
      const hingeA = hoodAt(-1.517, s * l, 0.010), hingeB = hoodAt(-1.526, s * r, 0.010);
      raised.face('trim', [pod(l - 0.014, 0.674, -1.908), pod(r + 0.014, 0.664, -1.895),
        pod(r + 0.014, 0.711, -1.509), pod(l - 0.014, 0.718, -1.505)], up, 0x242629);
      raised.face('trim', [bottomA, bottomB, topB, topA], front, 0x343639);
      raised.face('trim', [bottomA, topA, hingeA], [-s, 0, 0], 0x242529);
      raised.face('trim', [bottomB, topB, hingeB], [s, 0, 0], 0x292a2e);
      raised.face('paint', [topA, topB, hingeB, hingeA], up, white);
      const lampPoint=(u,v,depth=0)=>{
        const x=mix(l+.030,r-.030,u);
        return pod(x,.682+.132*v-.006*u,lensZ-.008+.009*u-depth);
      };
      for(const [finish,pad,depth,color] of [['metal',-.058,0,0x849191],['trim',-.025,.002,0x323538]]){
        raised.face(finish,[[pad,pad],[1-pad,pad],[1-pad,1-pad],[pad,1-pad]].map(([u,v])=>lampPoint(u,v,depth)),front,color);
      }
      raised.patch('head',10,5,(u,v)=>lampPoint(u,v,.003+.005*Math.sin(Math.PI*u)*Math.sin(Math.PI*v)),
        front,0xffffff);
      // The closed lids follow the same bonnet surface as the adjacent
      // steel. Only the 3 mm shut line and the barrel seam stand out in sun.
      const cover=(u,v,inset,offset)=>{
        const x=mix(l-.008+inset,r+.012-inset,u);
        const z=mix(-1.895+.010*u+inset,-1.514+.002*u-inset,v);
        return hoodAt(z,s*x,offset);
      };
      closed.patch('trim',10,8,(u,v)=>cover(u,v,0,.0016),up,0x414442);
      closed.patch('paint',10,8,(u,v)=>cover(u,v,.0031,.0022),up,white);
      const marker = (x, y, z) => [s * x, y, z];
      b.face('trim', [marker(0.546, 0.386, -2.097), marker(0.724, 0.393, -2.078),
        marker(0.727, 0.443, -2.073), marker(0.546, 0.447, -2.096)], front, rubber);
      b.face('lens', [marker(0.556, 0.394, -2.100), marker(0.712, 0.401, -2.084),
        marker(0.714, 0.434, -2.082), marker(0.556, 0.438, -2.100)], front, 0xda9346);
    }
    for(const x of [-.55,-.38,-.21,0,.21,.38,.55])box(b,'trim',p(x,.542,.005),[.008,.092,.008],0x303235);
    // A recessed lower grille and separate forward-facing indicator lenses.
    const strip=(x,y,depth=0)=>[x,y,-2.065+.036*(Math.abs(x)/.65)**3+depth];
    const grille=(mat,x0,x1,y0,y1,color,depth,uv=quadUV)=>b.patch(mat,12,1,
      (u,v)=>strip(mix(x1,x0,u),mix(y0,y1,v),depth),front,color,
      (u,v)=>[mix(uv[0][0],uv[1][0],u),mix(uv[0][1],uv[3][1],v)]);
    grille('trim',-.57,.57,.341,.461,0x17191b,.008);
    for(const y of [.358,.449])b.patch('trim',14,1,(u,v)=>strip(mix(-.57,.57,u),y,-v*.031),y<.4?up:down,0x303234);
    for(const x of [-.55,-.39,-.23,-.11,.11,.23,.39,.55])
      grille('blackTrim',x-.004,x+.004,.358,.449,0x515456,-.013);
    grille('blackTrim',-.565,.565,.390,.397,0x393b3d,-.014);
    grille('marks',-.130,.130,.368,.429,0xffffff,-.018,atlasUV('noseBadge'));
    const plate=[[.165,.130,-2.103],[-.165,.130,-2.103],[-.165,.295,-2.104],[.165,.295,-2.104]];
    b.face('trim',plate.map(([x,y,z])=>[x*1.035,.212+(y-.212)*1.05,z+.003]),front,graphite);
    b.face('marks',plate,front,0xffffff,atlasUV('plate'));
    for(const side of [-1,1]){
      const x=side*.425;
      box(b,'trim',[x,.262,-2.045],[.065,.065,.043],0x343638);
      box(b,'blackTrim',[x,.205,-2.053],[.186,.103,.079],0x202326);
      b.patch('fog',12,5,(u,v)=>[x+(u-.5)*.165,.205+(v-.5)*.081,
        -2.095-.003*Math.sin(u*Math.PI)*Math.sin(v*Math.PI)],front,0xf8bd39);
    }
  }

  // Cross-section revolved around X. The outboard face always points along +X.
  function turn(b, finish, profile, color, sides = 40) {
    const last=profile.length-1;
    const ring=(u,v)=>{
      const [x,r]=profile[Math.round(v*last)];
      return [x,r*Math.cos(TAU*u),r*Math.sin(TAU*u)];
    };
    const outward=(u,v)=>{
      const j=Math.round(v*last),a=profile[Math.max(j-1,0)],c=profile[Math.min(j+1,last)];
      const dx=c[0]-a[0],dr=c[1]-a[1];
      return [-dr,dx*Math.cos(TAU*u),dx*Math.sin(TAU*u)];
    };
    b.patch(finish,sides,last,ring,outward,color);
  }
  function rim(b) {
    // 185/60R14 sidewalls around a 14 x 6 inch deep eight-spoke casting.
    const tread=[[-.085,.173],[-.091,.205],[-.0925,.237],[-.088,.257],[-.080,.276],[-.069,.286],[-.058,tireRadius]];
    for(const x of [-.042,-.014,.014,.042]){
      tread.push([x-.0026,tireRadius],[x-.0015,tireRadius-.003],[x+.0015,tireRadius-.003],[x+.0026,tireRadius]);
    }
    tread.push([.058,tireRadius],[.069,.286],[.080,.276],[.088,.257],[.0925,.237],[.091,.205],[.085,.173]);
    turn(b,'tire',tread,0x252729,64);
    for(const radius of [.190,.198,.252])turn(b,'tire',[[.088,radius-.001],[.0925,radius],[.091,radius+.0015]],0x343638,64);
    const point=(x,r,a)=>[x,r*Math.cos(a),r*Math.sin(a)];
    for(let i=0;i<58;i++)for(const side of [-1,1]){
      const a=(i+.47*(side+1)/2)*TAU/58;
      b.face('tire',[point(side*.077,.2805,a),point(side*.047,tireRadius,a+.052),
        point(side*.047,tireRadius,a+.058),point(side*.077,.2805,a+.010)],point(0,1,a),0x141718);
    }
    turn(b,'metal',[[-.064,.164],[.037,.159],[.053,.155],[.069,.160],[.081,.168],[.084,.180],
      [.086,.184],[.084,.187],[.080,.186]],0x93918c,64);
    turn(b,'rim',[[.049,.159],[.041,.153],[.004,.145]],0x393e40,56);
    turn(b,'brakeSteel',[[.004,.117],[.010,.117],[.010,.060],[.014,.053],[.014,.027]],0x7e8281,48);
    for(const r of [.086,.105,.113])turn(b,'brakeSteel',[[.0103,r-.00065],[.0104,r+.00055]],0x616769,48);
    turn(b,'rim',[[.045,.064],[.055,.069],[.065,.061],[.071,.044],[.073,.030]],0x515452,36);
    turn(b,'blackTrim',[[.072,.033],[.081,.031],[.086,.024],[.086,0]],0x242525,32);
    for(let i=0;i<8;i++){
      const a=TAU*i/8+.14;
      const spoke=(u,v)=>{
        const radius=.049+.115*u,side=2*v-1;
        const half=.013+.008*(1-u)**3+.006*u**4;
        const t=side*half+.003*Math.sin(Math.PI*u);
        const x=.057-.023*Math.sin(Math.PI*u*.77)+.015*u**5+.012*Math.sqrt(Math.max(0,1-side*side));
        return [x,radius*Math.cos(a)-t*Math.sin(a),radius*Math.sin(a)+t*Math.cos(a)];
      };
      b.patch('rim',9,8,spoke,right,0x5a5c58);
      for(const edge of [0,1]){
        b.patch('rim',9,1,(u,v)=>plus(spoke(u,edge),[-.014*v,0,0]),
          [0,(edge?1:-1)*-Math.sin(a),(edge?1:-1)*Math.cos(a)],0x424642);
      }
    }
    for(let i=0;i<4;i++){
      const a=TAU*i/4+Math.PI*.25,y=.05715*Math.cos(a),z=.05715*Math.sin(a);
      rod(b,'rim',[.055,y,z],[.068,y,z],.0125,0x343735,12);
      rod(b,'metal',[.065,y,z],[.079,y,z],.0098,0xa2a19d,6,.009);
    }
    rod(b,'trim',[.066,.1105,-.122],[.083,.114,-.126],.0038,0x282a29,7);
    rod(b,'metal',[.079,.113,-.125],[.087,.115,-.127],.0046,0xaba9a2,8);
  }

  function wheelBrake(b) {
    const anchor=(angle,r,x)=>[x,r*Math.cos(angle),r*Math.sin(angle)];
    b.patch('brakeSteel',12,5,(u,v)=>anchor(mix(2.42,3.20,u),.100+.025*v,.019+.008*Math.sin(v*Math.PI)),
      right,0x595a55);
    b.patch('brakeSteel',12,3,(u,v)=>anchor(mix(2.42,3.20,u),.125,mix(-.019,.022,v)),
      [0,-1,.30],0x51554f);
  }

  const model=window.TougeAE86={drawMarkings:decals};
  model.create=staged(function* createTrueno() {
    const finishes = materials(), fixed = new GeometryBatch(finishes);
    yield;
    shell(fixed);
    yield;
    glazing(fixed);
    cabin(fixed);
    yield;
    bumper(fixed, -1);
    bumper(fixed, 1);
    rearFascia(fixed);
    const raised=new GeometryBatch(finishes),closed=new GeometryBatch(finishes);
    nose(fixed,raised,closed);
    yield;
    const group = new THREE.Group();
    group.name = 'Toyota Sprinter Trueno AE86';
    const body = fixed.build('Bodywork');
    const lampsUp=raised.build("Raised sealed-beam pods"),lampsDown=closed.build("Flush headlight covers");
    body.add(lampsUp,lampsDown);
    const person=new GeometryBatch(finishes);buildDriver(person);
    const driver=person.build("Driver");body.add(driver);
    const suspension = new THREE.Group();
    suspension.name = 'Sprung chassis';
    suspension.rotation.order = 'ZXY';
    suspension.position.y = 0.36;
    body.position.y = -suspension.position.y;
    suspension.add(body);
    group.add(suspension);
    const wheelBatch = new GeometryBatch(finishes);
    rim(wheelBatch);
    yield;
    const wheel=wheelBatch.build('Four-lug eight-spoke wheel');
    const brakeBatch=new GeometryBatch(finishes);wheelBrake(brakeBatch);
    const caliper=brakeBatch.build('Stationary caliper');
    const wheels = [];
    for (const z of [frontAxle, rearAxle]) {
      for (const side of [-1, 1]) {
        const hub = new THREE.Group(), mirror = new THREE.Group();
        const spin=wheel.clone(),fixedBrake=caliper.clone();
        hub.name = z === frontAxle ? 'Front knuckle' : 'Rear hub';
        hub.position.set(side * (z===frontAxle?frontTrack:rearTrack), tireRadius, z);
        mirror.rotation.y = side < 0 ? Math.PI : 0;
        // The tread, rotor and casting rotate together inside the steering
        // knuckle. The brake caliper follows the steering and suspension.
        mirror.add(spin,fixedBrake);hub.add(mirror);group.add(hub);
        wheels.push({ hub, spin, side, steers: z === frontAxle });
      }
    }
    function setMotion({ wheelAngle = 0, rearWheelAngle = wheelAngle, steer = 0, brake = 0,
      bodyRoll = 0, bodyPitch = 0, suspensionOffsets, reversing=false } = {}) {
      suspension.rotation.x = bodyPitch;
      suspension.rotation.z = bodyRoll;
      for (let i = 0; i < wheels.length; i++) {
        const w = wheels[i];
        w.hub.position.y = tireRadius + (suspensionOffsets ? suspensionOffsets[i] : 0);
        w.spin.rotation.x = -w.side * (w.steers ? wheelAngle : rearWheelAngle);
        if (w.steers) w.hub.rotation.y = steer;
      }
      finishes.tail.emissiveIntensity=(lampsUp.visible?.49:.055)+2.35*clamp(brake,0,1);
      finishes.reverseLens.emissiveIntensity=reversing?1.24:0;
    }
    const setDisplayMode=parked=>{driver.visible=!parked;};
    function setNight(night){
      lampsUp.visible=night;lampsDown.visible=!night;
      finishes.fog.emissiveIntensity=night?.82:.025;
    }
    setNight(false);
    return {group,body,driver,suspension,wheels,setMotion,setDisplayMode,setNight,
      mounts:{headlamp:[.535,.75,-1.87],tailLamp:[.555,2.025],bonnetEye:[.14,1.04,-.77],bonnetLook:[.14,.52,-30],shadowSize:[2.28,4.65]},
      exhaustOutlets:[{position:[-.555,.227,2.079],direction:[0,0,1]}],
      axles:{front:frontAxle,rear:rearAxle,frontTrack,rearTrack,halfTrack:(frontTrack+rearTrack)/2,radius:tireRadius}};
  });
})();
