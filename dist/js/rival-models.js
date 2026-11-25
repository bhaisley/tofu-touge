/* Coachwork stations, glazing and road equipment for the four Akina rivals.
   Metres, positive X to the driver's right, nose towards negative Z. */
(() => {
  'use strict';
  const {GeometryBatch,box,rod,tube,texture,laminatedGlass,staged,heatedHatch,sealedBeam,combinationLens,buildDriver}=TougeCarGeometry;
  const T=THREE, tau=2*Math.PI, white=0xffffff, up=[0,1,0], black=0x1c2023, seal=0x23272a;
  const mix=T.MathUtils.lerp, clamp=T.MathUtils.clamp;
  const seq=(n,fn)=>Array.from({length:n+1},(_,i)=>fn(i/n));
  const between=(a,b,t)=>a.map((x,i)=>mix(x,b[i],t));
  // Each longitudinal cut gives position in half-lengths, half-breadth in
  // half-widths, wing crown and centre-deck height. The outer skin is lofted.
  const shapes={
    fd3s:{
      cuts:[[-1,.793,.446,.481],[-.93,.913,.554,.519],[-.77,.980,.664,.565],[-.59,1,.729,.622],[-.40,.958,.748,.707],[-.16,.933,.753,.758],[.12,.942,.759,.769],[.34,.978,.805,.795],[.56,1,.843,.816],[.74,.985,.826,.821],[.90,.929,.777,.788],[1,.853,.699,.727]],
      cabin:[-.75,-.13,.70,1.70],rail:[.948,.765,.726,.930],roofDrop:.062,noseRound:.305,tailRound:.320,soft:.061,sill:.150,
      post:[1.84,1.86],postWidth:[.195,.134],quarter:[2.92,2.54],wing:[.945,1.172,.750,.205,.643],tip:.54,lightY:.597
    },
    fc3s:{
      cuts:[[-1,.935,.555,.555],[-.94,.972,.608,.606],[-.79,.985,.684,.663],[-.57,.995,.715,.696],[-.37,.969,.757,.754],[-.16,.956,.768,.768],[.18,.956,.778,.778],[.40,.979,.786,.790],[.57,1,.800,.812],[.75,.988,.787,.809],[.91,.958,.781,.807],[1,.918,.740,.768]],
      cabin:[-.84,-.10,.65,1.77],rail:[.930,.803,.774,.953],roofDrop:.044,noseRound:.167,tailRound:.170,soft:.036,sill:.163,
      post:[1.75,1.82],postWidth:[.31,.165],quarter:[2.947,2.995],wing:[.945,.875,.725,.198,.613],tip:-.58,lightY:.654
    },
    gc8:{
      cuts:[[-1,.890,.661,.679],[-.94,.952,.719,.748],[-.78,.975,.764,.765],[-.57,1,.804,.792],[-.40,.981,.858,.852],[-.24,.967,.877,.880],[.12,.965,.892,.896],[.38,.979,.911,.912],[.58,1,.925,.916],[.76,.986,.927,.931],[.91,.965,.898,.910],[1,.925,.843,.883]],
      cabin:[-.98,-.30,.75,1.53],rail:[.940,.770,.759,.879],roofDrop:.050,noseRound:.179,tailRound:.191,soft:.043,sill:.163,
      post:[1.70,1.65],postWidth:[.058,.059],quarter:[2.64,2.05],wing:[.925,1.237,.722,.214,.632],tip:-.56,lightY:.654
    },
    bnr32:{
      cuts:[[-1,.892,.648,.657],[-.93,.949,.702,.704],[-.78,.979,.745,.735],[-.590,1,.792,.767],[-.39,.952,.837,.825],[-.24,.947,.862,.862],[.10,.953,.875,.873],[.35,.974,.891,.886],[.56,1,.902,.895],[.75,.986,.907,.910],[.92,.971,.891,.904],[1,.937,.824,.858]],
      cabin:[-.84,-.183,.810,1.50],rail:[.934,.779,.752,.879],roofDrop:.045,noseRound:.157,tailRound:.151,soft:.034,sill:.165,
      post:[1.72,1.57],postWidth:[.061,.069],quarter:[2.43,1.96],wing:[.919,1.080,.744,.225,.667],tip:-.58,lightY:.640
    }
  };
  function interpolate(rows,x,col){
    let i=1;while(i<rows.length-1&&x>rows[i][0])i++;
    const a=rows[i-1],b=rows[i],t=clamp((x-a[0])/(b[0]-a[0]),0,1);
    const slope=(p,q)=>(q[col]-p[col])/(q[0]-p[0]);
    const chord=slope(a,b), tangent=k=>k*chord<=0?0:2*k*chord/(k+chord);
    const start=i>1?tangent(slope(rows[i-2],a)):chord,end=i+1<rows.length?tangent(slope(b,rows[i+1])):chord;
    return mix(a[col],b[col],t*t*(3-2*t))+(b[0]-a[0])*t*(1-t)*(start*(1-t)-end*t);
  }
  // Longitudinal motion of the front/rear corner makes the fascia wrap into
  // the fenders. The same function locates its apertures, lenses and badges.
  function coach(id,s){
    const h=shapes[id], L=s.length/2,W=s.width/2;
    const section=(z,c)=>interpolate(h.cuts,z/L,c);
    const width=z=>W*section(z,1);
    const cornerHeight=z=>h.soft*(1.75-.33*Math.exp(-((Math.abs(z)-1.20)**2)/.09));
    const cornerWidth=z=>h.soft*(1.94-.42*Math.exp(-((Math.abs(z)-1.20)**2)/.09));
    const sillAt=z=>h.sill+(id==='fd3s'?.095:id==='bnr32'?.108:id==='gc8'?.070:.045)*T.MathUtils.smoothstep(z,s.frontZ+s.wheelbase+.25,L)
      +.015*T.MathUtils.smoothstep(-z,-s.frontZ+.30,L);
    const endBlend=z=>T.MathUtils.smoothstep(Math.abs(z)/L,.59,1);
    const returnDepth=dir=>dir<0?(id==='fd3s'?.065:.044):.038;
    function bumperInset(dir,y){
      const waist=dir<0?(id==='fd3s'?.42:id==='fc3s'?.445:.485):(id==='fd3s'?.46:id==='fc3s'?.455:.515);
      const shelf=(dir<0?.042:id==='fc3s'?.085:.075)*T.MathUtils.smoothstep(y,waist-.012,waist+.056);
      const turnUnder=.060*(1-T.MathUtils.smoothstep(y,h.sill,waist-.08))**2;
      const bead=(center,span)=>Math.exp(-(((y-center)/span)**2));
      let press=0;
      if(dir>0 && id==='fc3s')press=.012*bead(.362,.017)-.008*bead(.399,.018)+.008*bead(.431,.008);
      if(dir>0 && id==='gc8')press=.012*bead(.449,.018)-.011*bead(.476,.025)+.011*bead(.260,.017);
      if(dir>0 && id==='bnr32')press=.014*bead(.263,.026)-.006*bead(.307,.030);
      return shelf+turnUnder+press+.004*bead(waist,.009);
    }
    function endZ(z,q){
      const n=clamp(Math.abs(q),0,1);
      // Round the end in plan all the way into the longitudinal side skin.
      const curve=(1.04-Math.sqrt(1.04**2-n**3))/(1.04-Math.sqrt(1.04**2-1));
      return z-Math.sign(z)*endBlend(z)*curve*(z<0?h.noseRound:h.tailRound);
    }
    function top(z,q,lift=0){
      const n=Math.abs(q),station=endZ(z,q),edge=section(station,2),center=section(station,3);
      const f=id==='fd3s'?n*n*(3-2*n):n**2.45;
      const crease=(id==='fd3s'?.023:.012)*Math.exp(-((n-.77)**2)/.013)*T.MathUtils.smoothstep(-station,.63,1.16)*(1-n**5);
      const crown=h.soft*.65*(1-n*n);
      const y=mix(center,edge,f)+crown+crease;
      return [q*(width(station)-cornerWidth(station)),y+lift,
        station-Math.sign(z)*(returnDepth(Math.sign(z))+bumperInset(Math.sign(z),y))*endBlend(z)];
    }
    function breadth(z,y){
      const topY=section(z,2),t=clamp((y-h.sill)/(topY-h.sill),0,1);
      const arch=Math.max(Math.exp(-(((z-s.frontZ)/.45)**2)),Math.exp(-(((z-s.frontZ-s.wheelbase)/.47)**2)));
      const shoulder=cornerHeight(z), edge=clamp(1-(topY-y)/shoulder,0,1);
      const fillet=1-Math.sqrt(Math.max(0,1-edge*edge));
      const lower=(id==='fd3s'?.078:.060)*(1-t)**2+(.034-.020*arch)*Math.exp(-(((t-.42)/.22)**2));
      const hip=(.007-.020*arch)*Math.sin(Math.PI*t)+(.005+.005*arch)*Math.exp(-(((t-.73)/.17)**2));
      return width(z)+(hip-lower)*T.MathUtils.smoothstep(1-t,0,.085)-cornerWidth(z)*fillet;
    }
    function side(k,z,y,lift=0){
      const station=endZ(z,1),edge=clamp(1-(section(station,2)-y)/cornerHeight(station),0,1);
      const fillet=1-Math.sqrt(Math.max(0,1-edge*edge));
      return [k*(breadth(station,y)+lift),y,
        station-Math.sign(z)*(returnDepth(Math.sign(z))*fillet+bumperInset(Math.sign(z),y))*endBlend(z)];
    }
    // Wheel openings are circles in axle coordinates, including the part
    // that crosses the curved bumper return. Locate those points on the loft.
    function sideStation(target,y){
      if(Math.abs(target)<=.59*L)return target;
      let lo=target<0?-L:target,hi=target<0?target:L;
      for(let i=0;i<13;i++){
        const mid=(lo+hi)/2;
        if(side(1,mid,y)[2]<target)lo=mid;else hi=mid;
      }
      return (lo+hi)/2;
    }
    function face(dir,q,y,depth=0){
      const z=dir*L,station=endZ(z,q),yy=top(z,q)[1],u=clamp((yy-y)/(yy-h.sill),0,1);
      const edge=clamp(1-(yy-y)/cornerHeight(station),0,1), fillet=1-Math.sqrt(Math.max(0,1-edge*edge));
      const tuck=.043*u**3+.012*Math.sin(2*Math.PI*u)+.009*Math.exp(-(((u-.55)/.095)**2));
      // Use the physical section at each point of the rounded end. Lofting
      // against the nominal end station folds the FD's narrowing bonnet.
      const x=breadth(station,mix(section(station,2),h.sill,u));
      return [q*x,y,station-dir*(depth+bumperInset(dir,y)+returnDepth(dir)*fillet+tuck*(1-Math.abs(q)**4))];
    }
    // A compound backlight meets the deck on an arc. In profile the station
    // at either lower corner is closer to the axle than its centre.
    const shifts=[.120,.038,-.043,-.134];
    function roof(p,q){
      p=clamp(p,0,3);
      const j=Math.min(2,Math.floor(p)),t=p-j,n=Math.abs(q),n2=n*n;
      const zz=h.cabin.map((z,i)=>z+shifts[i]*n2);
      const front=top(zz[0],q*h.rail[0]),rear=top(zz[3],q*h.rail[3]);
      const stations=[front[2],zz[1],zz[2],rear[2]];
      const z=mix(stations[j],stations[j+1],t);
      const x0=top(zz[0],h.rail[0])[0],x3=top(zz[3],h.rail[3])[0];
      const widths=[x0,W*h.rail[1],W*h.rail[2],x3];
      const glassHeight=[front[1],s.height-.027-h.roofDrop*n2,s.height-.035-h.roofDrop*n2,rear[1]];
      const bow=(j===1?.031:j===0?.030:.045)*Math.sin(Math.PI*t)*(1-.37*n2);
      const roll=j===1?0:(j===0?.075*(t**4-t**9):.086*((1-t)**4-(1-t)**9));
      const radius=id==='fd3s'?.060:id==='fc3s'?.053:.031;
      const wrap=j===2&&id==='fc3s'?.062*Math.sin(Math.PI*t)*n**7:0;
      const crownTurn=radius*n**9*(j===1?1:j===0?t:1-t)+wrap;
      return [q*(mix(widths[j],widths[j+1],t)+.010*Math.sin(Math.PI*t)),mix(glassHeight[j],glassHeight[j+1],t)+bow+roll-crownTurn,z];
    }
    function belt(z){
      const a=h.cabin[0]+.12,b=h.cabin[3]-.134;
      return mix(h.rail[0],h.rail[3],clamp((z-a)/(b-a),0,1));
    }
    function sidePane(k,p,t){
      const j=Math.min(2,Math.floor(p)),z=mix(h.cabin[j]+shifts[j],h.cabin[j+1]+shifts[j+1],p-j);
      const a=roof(p,k),b=top(z,k*belt(z));
      const v=between(b,a,t);v[0]+=k*.021*Math.sin(Math.PI*t);return v;
    }
    return {id,s,h,L,W,width,top,side,sideStation,face,roof,belt,sidePane,sillAt};
  }

  const labels={plate:[0,0,332,165],team:[343,0,398,95],name:[350,103,460,55],grade:[0,177,475,62],
    grille:[510,174,220,78],gauges:[0,258,452,142],sponsor:[752,0,255,98],make:[768,175,242,62],
    wheelCap:[493,282,110,108]};
  function labelUV(id){
    const [x,y,w,h]=labels[id];return [[0,0],[1,0],[1,1],[0,1]].map(([u,v])=>[(x+u*w)/1024,1-(y+(1-v)*h)/512]);
  }
  function markings(id,s){
    return texture(1024,512,c=>{
      c.textBaseline='middle';c.textAlign='center';
      c.fillStyle='#e5e7db';c.fillRect(3,3,325,159);c.strokeStyle='#a1a995';c.lineWidth=3;c.strokeRect(7,7,317,151);
      c.fillStyle='#244137';c.font='bold 37px sans-serif';c.fillText('群馬  '+s.district,166,39);
      c.font='bold 72px Helvetica,Arial,sans-serif';c.fillText(s.plate,189,114,242);c.font='bold 29px sans-serif';c.fillText(s.kana,41,116);
      for(const x of [32,298]){c.fillStyle='#727b75';c.beginPath();c.arc(x,20,5,0,tau);c.fill();}
      if(s.team){c.fillStyle=id==='bnr32'?'#eee9d7':'#bc251b';c.font='italic 900 74px Georgia,serif';
        c.fillText(s.team,541,55,390);c.font='bold 15px Helvetica,sans-serif';c.fillText(id==='bnr32'?'MYOGI     RACING TEAM':'AKAGI     ROTARY   SPECIALISTS',542,14,350);}
      const lettering=(word,x,y,width)=>{
        c.save();c.translate(x,y);c.scale(width/Math.max(1,c.measureText(word).width),1);c.fillText(word,0,0);c.restore();
      };
      c.fillStyle=id==='gc8'?'#b3d7c8':id==='bnr32'?'#929393':'#c2c5c2';
      c.font=id==='gc8'?'italic 900 39px Arial':'bold 44px Helvetica,sans-serif';
      if(id==='bnr32'){
        c.font='37px Helvetica,sans-serif';
        for(const [y,color] of [[133,'#777b7d'],[129,'#45484b']]){
          c.fillStyle=color;lettering('S K Y L I N E',580,y,420);
        }
      }else lettering(s.badge,580,id==='gc8'?124:130,id==='gc8'?389:420);
      if(id==='gc8'){c.fillStyle='#dee0d5';c.font='italic bold 9px Arial';lettering('SUBARU  TECNICA  INTERNATIONAL',578,147,269);}
      const grade={fd3s:'RX-7     Type R',fc3s:'∞ III     RX-7',gc8:'WRX   STi',bnr32:'GT–R'}[id];
      const gtr=(x,y)=>{
        c.strokeStyle='#bec1c0';c.lineWidth=2;c.fillStyle='#dcdcd7';c.font='italic 900 27px Arial';c.fillText('GT',x-4,y-16);
        c.fillStyle='#ab2532';c.font='italic 900 44px Georgia';c.strokeText('R',x+6,y+8);c.fillText('R',x+6,y+8);
      };
      if(id==='bnr32'){
        for(const [x,y,stretch] of [[236,207,6.5],[618,211,4.25]]){
          c.save();c.translate(x,y);c.scale(stretch,1);gtr(0,0);c.restore();
        }
      }
      else{
        c.fillStyle=id==='gc8'?'#bf424e':'#d1d1c8';c.font='italic bold 52px Helvetica,sans-serif';c.fillText(grade,236,209,460);
        c.fillStyle='#c3c8cd';c.font='italic 900 58px Arial';
        if(id==='gc8'){
          c.beginPath();c.ellipse(620,213,91,29,0,0,tau);c.fill();
          c.fillStyle='#b83f64';c.beginPath();c.ellipse(620,212,82,24,0,0,tau);c.fill();
          c.strokeStyle='#f4d3df';c.lineWidth=5;c.beginPath();c.moveTo(581,226);
          c.bezierCurveTo(624,212,590,202,645,193);c.stroke();
        }else c.fillText(id==='fd3s'?'∞':'MAZDA',620,210,200);
      }
      c.fillStyle='#252729';c.font='italic 900 25px Arial';c.fillText('H/P Stage',877,15,228);c.font='bold 18px Arial';c.fillText('FASTEST LAP',877,42);
      c.fillRect(793,54,168,19);c.fillStyle='#ebe9e1';c.font='bold 15px Arial';c.fillText('S.S Style',877,64);
      c.fillStyle='#242428';c.font='bold 22px Arial';c.fillText('Garage R',877,88);
      c.fillStyle=id==='gc8'?'#d86885':'#ced2d0';c.font='bold italic 43px Arial';
      lettering({fd3s:'RX-7',fc3s:'mazda',gc8:'STi',bnr32:'NISSAN'}[id],889,205,204);
      c.fillStyle='#292c2e';c.beginPath();c.arc(548,336,45,0,tau);c.fill();c.strokeStyle='#969996';c.lineWidth=3;c.stroke();
      c.fillStyle=id==='gc8'?'#d76579':'#e6e5d7';c.font='italic bold 25px Arial';c.fillText({fd3s:'R',fc3s:'R',gc8:'STi',bnr32:'R'}[id],548,336);
      c.fillStyle='#161b1e';c.fillRect(0,258,452,142);
      for(const [i,x] of [86,220,358].entries()){
        c.lineWidth=2;for(let j=0;j<=32;j++){const a=(.74+j*.048)*Math.PI, r=i===1?62:53;
          c.strokeStyle=j>26&&i===1?'#ed7855':'#e7decc';c.beginPath();c.moveTo(x+Math.cos(a)*r,327+Math.sin(a)*r);
          c.lineTo(x+Math.cos(a)*(r-(j%4?5:10)),327+Math.sin(a)*(r-(j%4?5:10)));c.stroke();}
        c.strokeStyle='#f08e58';c.lineWidth=3;c.beginPath();c.moveTo(x,327);c.lineTo(x-34,347);c.stroke();
      }
    });
  }
  let optics;
  function sidewall(s){
    const [radius,width,inches]=s.wheel,aspect=Math.round((radius-inches*.0127)*100/width/5)*5;
    return texture(1024,64,(c,w,h)=>{
      c.fillStyle='#77797a';c.fillRect(0,0,w,h);
      c.fillStyle='#9c9e9d';c.font='bold 25px Arial';c.textBaseline='middle';
      c.fillText('RADIAL   '+Math.round(width*1000)+'/'+aspect+'  R'+inches,38,36);
      c.font='bold 22px Arial';c.fillText('SPORT    •    TUBELESS',544,36);
      c.fillStyle='#909190';for(let i=0;i<58;i++)c.fillRect(240+i*4,18,1,18);
      c.fillRect(0,6,w,1);c.fillRect(0,54,w,1);
    });
  }
  function finishes(id,s){
    optics||={head:sealedBeam(),signal:combinationLens(),lit:combinationLens(true),heat:heatedHatch()};
    const std=(roughness,metalness,extra={})=>new T.MeshStandardMaterial({vertexColors:true,roughness,metalness,...extra});
    const coated=(roughness,metalness,extra={})=>new T.MeshPhysicalMaterial({vertexColors:true,roughness,metalness,clearcoat:1,clearcoatRoughness:.068,...extra});
    const lens=(color,emission)=>coated(.16,.14,{color,map:optics.signal,emissive:emission,emissiveMap:optics.lit,emissiveIntensity:.055});
    const m={paint:coated(.235,id==='bnr32'?.34:id==='gc8'?.29:.075,{envMapIntensity:1.08}),trim:std(.68,.035),satin:coated(.27,.16),cloth:std(.94,.01),
      metal:std(.29,.73),rim:std(.30,.65),tire:std(.85,.015),sidewall:std(.83,.015,{map:sidewall(s)}),glass:laminatedGlass(0x425258,.28),
      sideGlass:laminatedGlass(0x27323a,.48),hatchGlass:laminatedGlass(0x222c32,.60,optics.heat),
      tail:lens(0xe52632,0xff3029),reverseLens:lens(0xf1f4f1,0xffe6c7),markerLens:lens(0xf0f1f0,0xffc891),amber:lens(0xfda038,0xff8c29),
      head:coated(.15,.26,{map:optics.head,emissiveMap:optics.head,emissive:0xffebc7,emissiveIntensity:.07}),
      lampCover:new T.MeshPhysicalMaterial({vertexColors:true,transparent:true,opacity:.17,depthWrite:false,
        roughness:.105,metalness:.04,clearcoat:1,clearcoatRoughness:.045,envMapIntensity:.86}),
      marks:std(.48,.11,{map:markings(id,s),alphaTest:.3,alphaToCoverage:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})};
    for(const k of ['paint','satin','metal','rim','glass','sideGlass','hatchGlass','tail','reverseLens','head','lampCover'])m[k].userData.routeReflections=true;
    m.paint.userData.lacquer=true;return m;
  }
  function shell(b,c){
    const {s,h,L,top,side,belt}=c;
    const f=h.cabin[0],r=h.cabin[3], axles=[s.frontZ,s.frontZ+s.wheelbase],radius=s.wheel[0],arch=radius+.033;
    const cutout=axles.map(a=>{
      const arc=seq(42,t=>{
        const z=a-arch*Math.cos(Math.PI*t),y=radius+arch*Math.sin(Math.PI*t);
        return [c.sideStation(z,y),y];
      });
      const lo=arc[0][0]-.014,hi=arc.at(-1)[0]+.014;
      return [[lo,c.sillAt(lo)],...arc,[hi,c.sillAt(hi)]];
    });
    function bottom(z){
      for(const arc of cutout){
        if(z<arc[0][0]||z>arc.at(-1)[0])continue;
        for(let i=1;i<arc.length;i++)if(z<=arc[i][0]){
          const [a,ha]=arc[i-1],[e,he]=arc[i];return mix(ha,he,(z-a)/(e-a));
        }
      }
      return c.sillAt(z);
    }
    // The open wheel wells have both a rolled lip and a dark return behind it.
    for(const k of [-1,1]){
      const outward=[k,0,0], points=[-L,L,...cutout.flatMap(arc=>arc.map(p=>p[0]))];
      for(const a of axles){
        b.patch('trim',42,4,(u,v)=>{
          const angle=Math.PI*u,z=a+arch*Math.cos(angle),y=radius+arch*Math.sin(angle);
          const p=side(k,c.sideStation(z,y),y-.003);p[0]-=k*v*.21;return p;
        },(u)=>[0,-Math.sin(Math.PI*u),-Math.cos(Math.PI*u)],0x232529);
        b.patch('paint',42,3,(u,v)=>{
          const angle=Math.PI*u,rr=arch+.018*v,z=a+rr*Math.cos(angle),y=radius+rr*Math.sin(angle);
          return side(k,c.sideStation(z,y),y,.002+.003*Math.sin(Math.PI*v));
        },outward,s.paint);
      }
      for(let i=0;i<=64;i++)points.push(mix(-L,L,i/64));
      const cuts=[...new Set(points)].sort((a,b)=>a-b);
      for(let j=1;j<cuts.length;j++){
        const station=u=>mix(cuts[j-1],cuts[j],u);
        b.patch('paint',1,15,(u,v)=>{
          const z=station(u);return side(k,z,mix(bottom(z),top(z,1)[1],1-(1-v)**1.82));
        },(u,v)=>[k,2*T.MathUtils.smoothstep(v,.66,1),Math.sign(station(u))*.22],s.paint);
        b.patch('paint',1,9,(u,v)=>{
          const z=station(u);return top(z,k*mix(belt(z),1,v));
        },up,s.paint);
      }
      // Shaped rocker flanges, deep fender pockets and mechanical undertray.
      const start=axles[0]+arch+.015,end=axles[1]-arch-.015;
      b.patch('paint',28,5,(u,v)=>{
        const z=mix(start,end,u),p=side(k,z,h.sill+.010+.085*v);
        p[0]+=k*(.019*Math.sin(Math.PI*v)+.015*(1-v))*Math.sin(Math.PI*u)**.22;return p;
      },outward,s.paint);
      b.patch('trim',28,2,(u,v)=>{
        const z=mix(start,end,u),p=side(k,z,h.sill+.009);p[0]-=k*.11*v;return p;
      },[0,-1,0],black);
    }
    for(const [dir,cabinZ] of [[-1,f],[1,r]]){
      b.patch('paint',34,34,(u,v)=>{
        const q=2*u-1, seamZ=cabinZ+(dir<0?.120:-.134)*q*q,z=mix(dir*L,seamZ,v);
        return top(z,q*belt(z));
      },up,s.paint);
    }
    box(b,'trim',[0,.265,0],[s.width*.67,.16,s.length*.74],0x232529);
    for(const a of axles)box(b,'trim',[0,radius,a],[s.width*.67,.25,.52],0x27292a);
  }
  function glazing(b,c){
    const {s,h,roof,sidePane,top}=c;
    for(const [start,end,material] of [[0,1,'glass'],[2,3,'hatchGlass']]){
      const coupeHatch=start===2 && (c.id==='fd3s'||c.id==='fc3s');
      const fcHatch=start===2&&c.id==='fc3s',width=fcHatch?1:coupeHatch?.952:start?.901:.914;
      const flange=fcHatch?1:coupeHatch?.986:start?.928:.951,normal=[0,1,start?1:-1];
      // Follow the glass outline with both the fused black border and the
      // body flange. The larger lower radii on the liftbacks show in chase.
      for(const [x0,x1,base] of [[-1,-flange,'paint'],[-flange,-width,'satin'],[-width,width,material],[width,flange,'satin'],[flange,1,'paint']]){
        if(x1<=x0)continue;
        const point=(u,v,band)=>{
          const q=mix(x0,x1,u),edge=T.MathUtils.smoothstep(Math.abs(q)/width,.78,1)**2;
          const levels=[start,start+.030+.080*edge,end-.041-(coupeHatch?.136:.079)*edge,end];
          return roof(mix(levels[band],levels[band+1],v),q);
        };
        for(let band=0;band<3;band++){
          const finish=base===material&&band!==1?'satin':base;
          b.patch(finish,base===material?36:3,band===1?16:3,(u,v)=>point(u,v,band),normal,
            finish==='paint'?s.paint:finish==='satin'?0x202225:white);
        }
      }
    }
    b.patch('paint',32,19,(u,v)=>roof(1+v,u*2-1),up,s.paint);
    for(const k of [-1,1]){
      const out=[k,0,0],post=h.post[0];
      const rotary=c.id==='fc3s'||c.id==='fd3s';
      const jamb=v=>mix(h.post[0],h.post[1],v);
      const corner=v=>.024*Math.exp(-v/.071)+.036*Math.exp(-(1-v)/.084);
      function windowEdges(v){
        const postAt=jamb(v),rear=mix(h.quarter[0],h.quarter[1],v);
        return [0,.113+corner(v),postAt-corner(v),postAt+mix(...h.postWidth,v)+corner(v),rear-corner(v),3];
      }
      const finishes=['paint','sideGlass',rotary?'paint':'satin','sideGlass','paint'];
      for(let cell=0;cell<finishes.length;cell++){
        const mat=finishes[cell],glass=mat==='sideGlass',wrap=c.id==='fc3s'&&cell===3;
        for(const [v0,v1,finish] of [[0,.045,glass?'satin':mat],[.045,.925,mat],
          [.925,.963,glass&&!wrap?'satin':mat],[.963,1,wrap?mat:'paint']]){
          b.patch(finish,[8,29,8,23,16][cell],glass&&finish===mat?10:4,(u,v)=>{
            const t=mix(v0,v1,v),edges=windowEdges(t);return sidePane(k,mix(edges[cell],edges[cell+1],u),t);
          },out,finish==='paint'?s.paint:finish==='satin'?black:white);
        }
      }
      for(const edge of [1,2,3,4])tube(b,'satin',seq(20,v=>sidePane(k,windowEdges(v)[edge],v)),.004,seal,6);
      // Door perimeter follows the crown, then turns into the rocker.
      const zA=sidePane(k,.115,0)[2],zB=sidePane(k,post,0)[2],bottom=h.sill+.105;
      const door=[...seq(8,t=>[mix(zA,zA-.045,t),mix(top(zA,1)[1],bottom+.13,t)]),
        [zA-.022,bottom+.038],[zA+.052,bottom],...seq(10,t=>[mix(zA+.067,zB-.085,t),bottom-.008*Math.sin(t*Math.PI)]),
        [zB-.015,bottom+.034],[zB+.043,bottom+.12],...seq(9,t=>[mix(zB+.05,zB,t),mix(bottom+.14,top(zB,1)[1],t)])];
      const doorCurve=new T.CatmullRomCurve3(door.map(([z,y])=>new T.Vector3(...c.side(k,z,y,.0014))));
      tube(b,'trim',doorCurve.getPoints(54).map(v=>v.toArray()),.0027,0x474843,6);
      for(const end of [zA,zB])tube(b,'trim',seq(9,t=>top(end,k*mix(1,c.belt(end),t),.0013)),.0024,0x474843,6);
      const handleZ=zB-.095,handleY=top(handleZ,1)[1]-.068;
      const P=(z,y,extra)=>c.side(k,z,y,extra);
      if(c.id!=='fd3s'){
        const handleHalf=c.id==='fc3s'?.055:.076;
        b.patch('satin',15,6,(u,v)=>P(handleZ+(2*u-1)*handleHalf,handleY+.020*(2*v-1)*(.38+.62*Math.sin(Math.PI*u)**.45),.0027),out,0x292d30);
        b.patch('paint',13,5,(u,v)=>P(handleZ+(2*u-1)*handleHalf*.92,handleY+.007+.010*(2*v-1),.004+.007*Math.sin(Math.PI*v)),out,s.paint);
      }else b.patch('satin',10,4,(u,v)=>{
        const t=.14+v*.23;const p=sidePane(k,jamb(t)-.015-u*.083,t);
        p[0]+=.004*k;return p;
      },out,0x292b2e);
      // Convex painted mirror shell tapering to the mounting foot.
      const z=roof(.385,k)[2],p=sidePane(k,.385,.18);
      rod(b,'satin',p,[k*(c.W+.021),p[1]+.039,z-.001],.028,black,9,.022);
      const center=[k*(c.W+.039),p[1]+.055,z-.026];
      const ellipse=n=>Math.sign(n)*Math.abs(n)**(c.id==='fd3s'?.94:.65);
      const mirror=(u,v)=>{const a=u*tau,t=v*Math.PI;return [center[0]+k*.106*Math.sin(t)*ellipse(Math.cos(a)),
        center[1]+.059*Math.sin(t)*ellipse(Math.sin(a)),center[2]-.077*Math.cos(t)];};
      b.patch('paint',24,10,(u,v)=>mirror(u,v*.61),(u,v)=>[k*Math.cos(u*tau),Math.sin(u*tau),-Math.cos(v*1.9)],s.paint);
      const rim=seq(24,u=>mirror(u,.61));tube(b,'satin',rim,.005,black,6);
      b.face('metal',rim,[0,0,1],0x8e9ba0);
    }
    for(const [near,far] of [[-.86,-.12],[.02,.80]])tube(b,'trim',seq(8,t=>{
      const p=roof(.053+.064*t,mix(near,far,t));p[1]+=.005;return p;
    }),.008,0x292c30,6);
    const wiper=(p,q,lift)=>{
      const a=roof(p,q);a[1]+=lift;a[2]+=lift*.52;return a;
    };
    const upright=c.id==='fc3s',origin=upright?-.51:-.04;
    rod(b,'satin',wiper(2.94,origin,.001),wiper(2.94,origin,.017),.016,black,12);
    tube(b,'satin',[wiper(2.94,origin,.017),wiper(upright?2.81:2.89,upright?-.60:.15,.018),
      wiper(upright?2.62:2.87,upright?-.66:.37,.015)],.008,0x35393c,7);
    tube(b,'trim',seq(14,t=>wiper(upright?mix(2.81,2.37,t):2.90-.06*t,upright?mix(-.59,-.75,t):mix(.13,.71,t),.009)),.007,0x222629,7);
  }
  function rounded(poly,f=.16){
    const result=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[(i+poly.length-1)%poly.length],p=poly[i],z=poly[(i+1)%poly.length];
      const b=between(p,a,f),e=between(p,z,f);
      for(const t of [0,.25,.5,.75,1])result.push(between(between(b,p,t),between(p,e,t),t));
    }
    return result;
  }
  const rect=(x0,y0,x1,y1)=>[[x0,y0],[x1,y0],[x1,y1],[x0,y1]];
  function hole(poly,kind,options={}){
    return {poly:rounded(poly,options.radius??.19),kind,...options};
  }
  function endParts(id,dir){
    const holes=[],isFront=dir<0;
    const add=(poly,kind,opts)=>holes.push(hole(poly,kind,opts));
    const pair=(poly,kind,opts)=>{for(const k of [-1,1])add(poly.map(([x,y])=>[k*x,y]),kind,opts);};
    if(isFront){
      if(id==='fd3s'){
        add([[-.54,.211],[.54,.211],[.491,.302],[.32,.342],[-.32,.342],[-.491,.302]],'radiator');
        pair([[.534,.352],[.862,.366],[.907,.412],[.677,.427],[.550,.406]],'indicator');
        for(const [y,w] of [[.211,.878],[.272,.907]])pair([[.644,y],[w,y+.006],[w-.015,y+.035],[.628,y+.033]],'duct');
      }else if(id==='fc3s'){
        add([[-.53,.195],[.53,.195],[.59,.325],[-.59,.325]],'radiator');
        pair(rect(.61,.20,.842,.303),'fog');
        pair(rect(.57,.391,.890,.440),'amber');
        pair(rect(.555,.451,.876,.482),'indicator');
        add(rect(-.44,.373,.44,.405),'duct');
      }else if(id==='gc8'){
        add([[-.494,.206],[.494,.206],[.552,.379],[-.552,.379]],'radiator');
        add([[-.346,.505],[.346,.505],[.436,.657],[-.436,.657]],'grille');
        pair([[.377,.514],[.888,.546],[.961,.631],[.907,.672],[.461,.655]],'projector');
        pair(rect(.632,.397,.918,.435),'amber');
        pair([[.823,.260],[.910,.282],[.952,.368],[.813,.368],[.838,.329]],'duct');
        for(const k of [-1,1])add(seq(28,t=>[k*.671+Math.cos(t*tau)*.139,.295+Math.sin(t*tau)*.091]).slice(0,-1),'cover',{radius:0});
      }else{
        add([[-.53,.228],[.53,.228],[.585,.365],[-.585,.365]],'radiator');
        pair(rect(.649,.241,.886,.347),'duct');
        pair(rect(.525,.403,.823,.441),'duct');
        add(rect(-.332,.503,.332,.611),'grille');
        pair([[.348,.514],[.927,.530],[.969,.601],[.898,.658],[.349,.640]],'projector');
      }
    }else{
      if(id==='fd3s'){
        add([[-.958,.545],[-.588,.520],[0,.548],[.588,.520],[.958,.545],[.979,.634],[.862,.690],[.610,.700],[0,.654],[-.610,.700],[-.862,.690],[-.979,.634]],'fd-tail',{radius:.23});
        pair(rect(.695,.397,.869,.431),'reflector');
        add([[-.285,.269],[.285,.269],[.323,.422],[-.323,.422]],'plate');
      }else if(id==='fc3s'){
        pair([[.242,.491],[.925,.493],[.958,.519],[.955,.628],[.900,.686],[.242,.687]],'fc-tail',{radius:.12});
        add(rect(-.232,.491,.232,.679),'plate');
      }else if(id==='gc8'){
        pair([[.395,.582],[.828,.586],[.959,.619],[.952,.666],[.876,.743],[.720,.765],[.411,.754]],'gc-tail');
        add([[-.290,.250],[.290,.250],[.316,.450],[-.316,.450]],'plate');
      }else{
        pair([[.526,.555],[.990,.555],[.994,.646],[.980,.733],[.912,.766],[.529,.766],[.457,.730],[.447,.667],[.455,.604]],'r32-tail',{radius:.30});
        add(rect(-.305,.325,.305,.499),'plate');
      }
    }
    return holes;
  }
  function bounds(poly){
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  }
  // A long lens is curved in both directions. Sweep its actual outline so
  // the backing, reflectors and clear skin stay in order around the corner.
  function panel(b,mat,poly,at,out,col){
    const [x0,y0,x1,y1]=bounds(poly),w=x1-x0,h=y1-y0;
    const cuts=[...new Set([...poly.map(p=>p[0]),...seq(Math.ceil(w/.065),u=>mix(x0,x1,u))])].sort((a,z)=>a-z);
    for(let i=1;i<cuts.length;i++){
      const a=cuts[i-1],z=cuts[i],mid=(a+z)/2;if(z-a<.00001)continue;
      const edges=[];
      for(let j=0;j<poly.length;j++){
        const p=poly[j],q=poly[(j+1)%poly.length];
        if((p[0]<mid)===(q[0]<mid))continue;
        edges.push(x=>mix(p[1],q[1],(x-p[0])/(q[0]-p[0])));
      }
      edges.sort((f,g)=>f(mid)-g(mid));
      for(let j=0;j+1<edges.length;j+=2){
        const xy=(u,v)=>{const x=mix(a,z,u);return [x,mix(edges[j](x),edges[j+1](x),v)];};
        b.patch(mat,1,Math.max(2,Math.ceil(h/.033)),(u,v)=>at(...xy(u,v)),out,col,(u,v)=>{
          const [x,y]=xy(u,v);return [(x-x0)/w,(y-y0)/h];
        });
      }
    }
  }
  // Sweep the bumper around open lamp buckets and grille cut-outs. Subdivide
  // even the uninterrupted bands so their reflections follow the rounded nose.
  function bumper(b,c,dir){
    const holes=endParts(c.id,dir),{s,L}=c, out=[0,0,dir];
    const z=dir*L,topY=x=>c.top(z,x)[1],low=x=>mix(c.sillAt(z)-.017,c.sillAt(z),x*x);
    const cuts=Array.from(new Set([...seq(38,u=>2*u-1),...holes.flatMap(p=>p.poly.map(v=>v[0]))])).sort((a,z)=>a-z);
    function spans(x){
      const active=[];
      for(const {poly} of holes){
        const seg=[];
        for(let i=0;i<poly.length;i++){const a=poly[i],e=poly[(i+1)%poly.length];
          if((a[0]<x)===(e[0]<x))continue;
          seg.push(q=>mix(a[1],e[1],(q-a[0])/(e[0]-a[0])));
        }
        seg.sort((a,b)=>a(x)-b(x));for(let i=0;i+1<seg.length;i+=2)active.push([seg[i],seg[i+1]]);
      }
      active.sort((a,b)=>a[0](x)-b[0](x));return active;
    }
    const bands=[],columns=cuts.map(x=>new Set(seq(27,u=>mix(low(x),topY(x),1-(1-u)**1.42))));
    for(let i=1;i<cuts.length;i++){
      const a=cuts[i-1],z=cuts[i],rows=[];
      let floor=low;
      for(const [ceiling,next] of [...spans((a+z)/2),[topY,null]]){
        rows.push([floor,ceiling]);
        for(const [x,col] of [[a,i-1],[z,i]]){
          columns[col].add(floor(x));columns[col].add(ceiling(x));
        }
        floor=next;
      }
      bands.push(rows);
    }
    const verts=columns.map((values,i)=>{
      const x=cuts[i];return [...values].sort((a,b)=>a-b).filter((y,j,arr)=>!j||y-arr[j-1]>1e-7).map(y=>{
        const a=c.face(dir,clamp(x-.0003,-1,1),y),z=c.face(dir,clamp(x+.0003,-1,1),y),
          h0=c.face(dir,x,y-.0001),h1=c.face(dir,x,y+.0001);
        const dx=new T.Vector3(...z).sub(new T.Vector3(...a)),dy=new T.Vector3(...h1).sub(new T.Vector3(...h0));
        const n=dx.cross(dy).normalize().multiplyScalar(dir);
        return {y,p:c.face(dir,x,y),n:n.toArray()};
      });
    });
    function triangle(a,b1,c1){
      const normal=a.n.map((v,i)=>v+b1.n[i]+c1.n[i]);
      b.face('paint',[a.p,b1.p,c1.p],normal,s.paint,undefined,[a.n,b1.n,c1.n]);
    }
    for(let i=0;i<bands.length;i++)for(const [floor,ceiling] of bands[i]){
      const edges=[i,i+1].map(col=>verts[col].filter(v=>v.y>=floor(cuts[col])-1e-7&&v.y<=ceiling(cuts[col])+1e-7));
      const [left,right]=edges;if(!left.length||!right.length)continue;
      let l=0,r=0;
      while(l+1<left.length||r+1<right.length){
        if(r+1===right.length || (l+1<left.length&&left[l+1].y<right[r+1].y))triangle(left[l],right[r],left[++l]);
        else triangle(left[l],right[r],right[++r]);
      }
    }
    // The chin wraps rearward at the corners into the lower quarter panels.
    const lipColor=dir<0&&c.id==='bnr32'?0x292d31:s.paint;
    b.patch(lipColor===s.paint?'paint':'satin',38,6,(u,v)=>{
      const x=u*2-1,base=low(x),p=c.face(dir,x,base+(.018+(.026*(1-Math.abs(x))))*v);
      p[2]+=dir*.018*Math.sin(Math.PI*v);return p;
    },out,lipColor);
    b.patch('trim',34,2,(u,v)=>{
      const x=u*2-1,p=c.face(dir,x,low(x));p[2]-=dir*v*.18;return p;
    },[0,-1,0],0x222528);
    for(const opening of holes)trimOpening(b,c,dir,opening);
  }
  function trimOpening(b,c,dir,o){
    const {poly,kind}=o,out=[0,0,dir];
    const [x0,y0,x1,y1]=bounds(poly),cx=(x0+x1)/2,cy=(y0+y1)/2,dx=x1-x0,dy=y1-y0;
    const duct=['radiator','duct','grille'].includes(kind),complex=kind.endsWith('-tail')||kind==='projector';
    const depth=duct?.067:kind==='plate'?.034:kind==='cover'?.002:.014;
    // An independent lens mould bridges the crease in the bumper beneath.
    const at=(x,y,d)=>{
      const t=clamp((y-y0)/dy,0,1),a=c.face(dir,x,y0),z=c.face(dir,x,y1);
      return [mix(a[0],z[0],t),y,mix(a[2],z[2],t)-dir*d];
    };
    const inner=poly.map(([x,y])=>[mix(cx,x,duct?.926:.972),mix(cy,y,duct?.82:.925)]);
    for(let i=0;i<poly.length;i++){
      const j=(i+1)%poly.length;
      const painted=duct||kind==='plate'||kind==='r32-tail';
      const steps=Math.max(1,Math.ceil(Math.abs(poly[j][0]-poly[i][0])/.075));
      b.patch(painted?'paint':'satin',steps,2,(u,v)=>{
        const p=between(poly[i],poly[j],u),q=between(inner[i],inner[j],u);
        return between(c.face(dir,...p),at(...q,depth),v);
      },[cx-poly[i][0],cy-poly[i][1],dir*.16],painted?c.s.paint:black);
    }
    const mat={amber:'amber',reflector:'tail',fog:'head',indicator:'markerLens',cover:'paint',plate:'trim','r32-tail':'paint'}[kind]||'satin';
    const col=mat==='paint'?c.s.paint:duct||complex||kind==='plate'?0x24282a:white;
    panel(b,mat,inner,(x,y)=>{
      const dome=kind==='cover'?.014*Math.max(0,1-((x-cx)/(.5*dx))**2-((y-cy)/(.5*dy))**2):0;
      return at(x,y,depth+(kind==='projector'?.050:0)-dome);
    },out,col);
    function tile(f,x,y,w,h,d,color=white){
      // Small optical elements are inset into the lamp housing. Clamp pieces
      // by their own moulded shapes, retaining the reveal around the cover.
      b.patch(f,8,3,(u,v)=>at(x+(u-.5)*w,y+(v-.5)*h,d),out,color);
    }
    function disc(x,y,rx,ry,material){
      const polar=(u,r,d)=>at(x+rx*r*Math.cos(tau*u),y+ry*r*Math.sin(tau*u),d);
      const rim=kind==='r32-tail'?0x62534f:0x2e3034;
      b.patch('satin',32,2,(u,v)=>polar(u,mix(1.075,1,v),depth-.003-.003*v),out,rim);
      b.patch(material,32,6,(u,v)=>polar(u,v,depth-.006-.010*(1-v*v)),out,white,
        (u,v)=>[.5+.49*v*Math.cos(tau*u),.5+.49*v*Math.sin(tau*u)]);
      if(material==='tail')for(const r of [.53,.86])b.patch('satin',32,1,(u,v)=>{
        const radius=r+.015*v;return polar(u,radius,depth-.007-.010*(1-radius*radius));
      },out,0x81383a);
    }
    const mark=(name,x,y,w,h,d)=>{
      const [lx,ly,lw,lh]=labels[name];
      b.patch('marks',10,3,(u,v)=>at(x+(u-.5)*w,y+(v-.5)*h,d),out,white,
        (u,v)=>[(lx+lw*(dir>0?u:1-u))/1024,1-(ly+lh*(1-v))/512]);
    };
    if(duct){
      const n=kind==='radiator'?6:kind==='grille'?4:2;
      for(let i=0;i<n;i++)tile('metal',cx,mix(y0+dy*.20,y1-dy*.20,(i+.5)/n),dx*.81,kind==='radiator'?.006:.004,depth-.003,kind==='radiator'?0x777b7a:0x484c4f);
      if(kind==='radiator')for(let i=1;i<=12;i++)tile('trim',mix(x0,x1,i/13),cy,.005,dy*.65,depth-.005,0x393d40);
      if(kind==='grille'){
        for(let i=1;i<17;i++)tile('metal',mix(x0,x1,.055+.89*i/17),cy,.003,dy*.67,depth-.004,0x63666a);
        const skyline=c.id==='bnr32';
        mark('grille',skyline?cx+dx*.28:cx,cy,dx*(skyline?.12:.20),dy*(skyline?.65:.29),.017);
      }
    }else if(kind==='plate'){
      mark('plate',cx,cy,Math.min(.330/c.width(dir*c.L),dx*.89),Math.min(.165,dy*.91),depth-.009);
      if(c.id==='bnr32')for(const k of [-1,1])tile('reverseLens',k*.261,cy+.005,.069,dy*.64,depth-.006,0xc5bfae);
    }
    else if(kind==='fd-tail'){
      for(const k of [-1,1]){
        disc(k*.773,.612,.107,.057,'tail');disc(k*.551,.608,.102,.056,'tail');
        tile('amber',k*.918,.604,.058,.048,depth-.008);tile('reverseLens',k*.385,.592,.084,.039,depth-.008);
      }
      mark('name',0,.598,.21,.036,depth-.010);
    }else if(kind==='r32-tail'){
      const k=Math.sign(cx);
      for(const x of [.574,.872])disc(k*x,cy,.099,.079,'tail');
      tile('satin',k*.725,cy,.073,.094,depth-.004,0x352f2b);
      tile('amber',k*.725,cy+.001,.063,.079,depth-.007,0x897469);
      tube(b,'trim',[...poly,poly[0]].map(([x,y])=>c.face(dir,x,y,-.001)),.0021,0x27292b,6);
    }else if(kind==='fc-tail'){
      const k=Math.sign(cx),bands=[['tail',.271,.752,.520,.664],['amber',.769,.923,.529,.653],
        ['reverseLens',.379,.431,.538,.647],['tail',.435,.739,.502,.514]];
      for(const [finish,min,max,lo,hi] of bands)tile(finish,k*(min+max)/2,(lo+hi)/2,max-min,hi-lo,depth-(finish==='reverseLens'?.012:.006));
      for(const x of [.505,.666])disc(k*x,.595,.076,.051,'tail');
      tile('metal',k*.597,.598,.620,.0035,depth-.021,0xb79586);
    }else if(kind==='gc-tail'){
      const k=Math.sign(cx);
      const band=(finish,points,d,color)=>panel(b,finish,rounded(points.map(([x,y])=>[k*x,y]),.17),(x,y)=>at(x,y,d),out,color);
      band('tail',[[.415,.641],[.810,.642],[.934,.628],[.927,.681],[.849,.733],[.688,.750],[.423,.742]],depth-.007,0xeb7778);
      band('markerLens',[[.419,.593],[.799,.597],[.829,.625],[.804,.637],[.418,.635]],depth-.008,white);
      tile('reverseLens',k*.497,.616,.131,.038,depth-.010);
      for(const x of [.566,.718])tile('metal',k*x,.616,.007,.038,depth-.012,0xaaaeb2);
      tile('tail',k*.570,.705,.253,.055,depth-.011,white);
    }else if(kind==='projector'){
      const k=Math.sign(cx),impreza=c.id==='gc8';
      for(const [offset,rxScale] of (impreza?[[-.19,.270],[.237,.145]]:[[-.216,.173],[.056,.128]])){
        const x=cx+k*dx*offset,rx=dx*rxScale,ry=dy*(impreza?.350:.328);
        const flatten=impreza?.50:offset>0?.61:1;
        const optic=(angle,r)=>{
          const sx=Math.cos(angle),sy=Math.sin(angle),xx=Math.sign(sx)*Math.abs(sx)**flatten,yy=Math.sign(sy)*Math.abs(sy)**flatten;
          return {point:at(x+rx*r*xx,cy+ry*r*yy,depth-.009+.039*(1-r*r)),uv:[.5+.49*r*xx,.5+.49*r*yy]};
        };
        const cuts=[.15,.52,.78,1],colors=[0xdde3e2,0xa5acaf,0xf8f5ed,0x848d91,0xc3cbca,0xe0e1db];
        for(let j=1;j<cuts.length;j++)for(let i=0;i<24;i++){
          const a=tau*i/24,e=tau*(i+1)/24;
          const face=[optic(a,cuts[j-1]),optic(e,cuts[j-1]),optic(e,cuts[j]),optic(a,cuts[j])];
          b.face(j===2?'head':'metal',face.map(p=>p.point),out,colors[(i+j*3)%6],face.map(p=>p.uv));
        }
        disc(x,cy,rx*(impreza?.21:.45),ry*(impreza?.28:.57),'head');
      }
      if(!impreza){
        const corner=rounded([[.781,.546],[.935,.550],[.950,.604],[.891,.645],[.792,.642]].map(([x,y])=>[k*x,y]),.18);
        panel(b,'amber',corner,(x,y)=>at(x,y,depth-.012),out,white);
      }
    }else if(kind==='cover'){
      tube(b,'satin',seq(34,t=>at(cx+dx*.449*Math.cos(t*tau),cy+dy*.443*Math.sin(t*tau),depth-.003)),.0025,0x425372,5);
      mark('make',cx,cy,dx*.72,dy*.25,depth-.018);
    }
    if(complex && kind!=='r32-tail')panel(b,'lampCover',inner,(x,y)=>{
      const dome=(1-((x-cx)/(dx*.51))**2)*(1-((y-cy)/(dy*.51))**2);
      return at(x,y,-.004-.010*Math.max(0,dome));
    },out,kind==='fd-tail'?0x453b42:0xe6e5dc);
  }

  function equipment(b,raised,closed,c){
    const {id,s,h,L,top,side}=c;
    const path=(material,pts,r,color)=>tube(b,material,pts,r,color,7);
    const pop=id==='fd3s'||id==='fc3s';
    const frontBadge=(id==='fd3s'||id==='fc3s');
    if(frontBadge){
      const z=-L+.129;
      b.patch('marks',5,4,(u,v)=>top(z+.031*(v-.5),.068*(u*2-1),.0017),up,white,
        (u,v)=>[(510+220*u)/1024,1-(174+78*(1-v))/512]);
    }
    // Pressed hood hems and the deck shut line follow the inner wing crowns.
    for(const k of [-1,1]){
      const a=pop?-L+.25:-L+.10,z=h.cabin[0]+.052;
      path('trim',seq(24,t=>top(mix(a,z,t),k*mix(pop?.55:.72,.84,t),.0015)),.0028,0x33383a);
      path('trim',seq(19,t=>top(mix(h.cabin[3]-.03,L-.04,t),k*mix(.83,.69,t),.002)),.003,0x33363a);
    }
    if(pop)for(const k of [-1,1]){
      const start=-L+(id==='fd3s'?.239:.191),end=start+(id==='fd3s'?.286:.277);
      const enclosure=(u,v,lift=0)=>{
        const q=k*mix(mix(.533,.575,v),mix(.884,.85,v),u),z=mix(start,end,v)+(id==='fd3s'?.078:.030)*u;
        return top(z,q,lift);
      };
      const cover=(u,v)=>enclosure(u,v,.006);
      const corners=[cover(0,0),cover(1,0),cover(1,1),cover(0,1)];
      path('trim',[...corners,corners[0]],.005,black);
      closed.patch('paint',8,6,cover,up,s.paint);
      const sill=mix(enclosure(0,0)[1],enclosure(1,0)[1],.5);
      const centerZ=enclosure(.5,0)[2];
      const raisedFace=(u,t)=>{
        const p=enclosure(u,0);p[1]=sill+.010+t*.136+.009*(u-.5);
        p[2]=centerZ-.016+(u-.5)*.040+t*.009;return p;
      };
      const elevated=(u,v)=>{
        const p=enclosure(u,v,.008),hinge=enclosure(u,0,.008),front=raisedFace(u,1);
        return p.map((n,i)=>n+(front[i]-hinge[i])*(1-v));
      };
      raised.patch('paint',10,7,elevated,up,s.paint);
      for(const u of [0,1])raised.patch('satin',7,3,(v,t)=>between(enclosure(u,v,.005),elevated(u,v),t),[k*(u?1:-1),0,0],black);
      raised.patch('satin',9,5,raisedFace,[0,0,-1],black);
      raised.patch('satin',9,2,(u,v)=>between(enclosure(u,0,.003),raisedFace(u,0),v),[0,-1,-1],black);
      const optic=(u,t,depth)=>{
        const p=raisedFace(.066+.868*u,.064+.86*t);p[2]-=depth;return p;
      };
      const lensRim=rounded(id==='fd3s'?[[.01,.06],[.80,.02],[.99,.17],[.99,.82],[.79,.98],[.04,.98]]:rect(0,0,1,1),.22);
      const lensPoint=([u,v],scale,depth)=>optic(.5+(u-.5)*scale,.5+(v-.5)*scale,depth);
      for(let j=0;j<lensRim.length;j++){
        const a=lensRim[j],e=lensRim[(j+1)%lensRim.length];
        raised.face('metal',[lensPoint(a,1,.003),lensPoint(e,1,.003),lensPoint(e,.91,.007),lensPoint(a,.91,.007)],[0,0,-1],0x999995);
        raised.face('metal',[lensPoint(a,.91,.007),lensPoint(e,.91,.007),lensPoint(e,.685,.001),lensPoint(a,.685,.001)],
          [0,0,-1],[0xe2e4db,0xacb1ad,0xc5c9c7,0x8f9699][j%4]);
        raised.face('head',[optic(.5,.5,.011),lensPoint(a,.685,.002),lensPoint(e,.685,.002)],[0,0,-1],white,[[.5,.5],a,e]);
        raised.face('lampCover',[optic(.5,.5,.019),lensPoint(a,.92,.010),lensPoint(e,.92,.010)],[0,0,-1],white);
      }
    }
    if(id==='fc3s'||id==='gc8'){
      const sub=id==='gc8',z0=sub?-1.294:-1.454,z1=sub?-.985:-1.119,hw=sub?.265:.207,off=sub?0:-.055;
      const onHood=(x,z,lift=0)=>top(z,x/top(z,1)[0],lift);
      // A rounded front lip, black throat set back from it and flared skirts
      // make the pressed bonnet inlet legible even with the headlamps off.
      function scoop(q,v){
        const n=Math.abs(q),z=mix(z0,z1,v)+.043*n*n*(1-v);
        const x=off+q*hw*(1+.10*Math.sin(Math.PI*v)-.28*v);
        const lift=(sub?.073:.054)*(1-v)**.82*(1-.22*n*n-.73*n**8);
        return onHood(x,z,lift+.0015);
      }
      b.patch('paint',24,12,(u,v)=>scoop(2*u-1,v),up,s.paint);
      const mouth=(q,t,recess)=>{
        const roof=scoop(q,0),base=onHood(roof[0],roof[2]+recess,t*.001);
        return [base[0],mix(base[1]+.002,roof[1]-.003,t),base[2]];
      };
      b.patch('satin',22,4,(u,v)=>mouth(1.88*u-.94,v,.029),[0,0,-1],0x191d20);
      for(const v of [0,1])b.patch(v?'paint':'satin',22,3,(u,t)=>mouth(1.88*u-.94,v,.029*t),
        v?[0,-1,0]:up,v?s.paint:0x262a2c);
      for(const q of [-1,1])b.patch('paint',12,4,(u,t)=>{
        const p=scoop(q,u),foot=onHood(p[0]+q*.043*(1-u),p[2],.001);
        return between(foot,p,t);
      },[q,1,0],s.paint);
      if(sub){
        for(const q of [-.55,0,.55])rod(b,'trim',mouth(q,0,.021),mouth(q,1,.019),.004,0x3d4146,6);
        for(const k of [-1,1])for(const offset of [0,.100]){
          const vent=(u,v,y)=>onHood(k*(.352+offset+.075*u+.030*v),-1.35+.209*v+.019*u,y);
          b.patch('satin',8,8,(u,v)=>vent(u,v,.003),up,0x242830);
          for(let i=1;i<7;i++)b.patch('metal',2,1,(u,v)=>vent(u,(i+.10*v)/7,.004),up,0x5b5b58);
          tube(b,'paint',[vent(0,0,.005),vent(1,0,.005),vent(1,1,.005),vent(0,1,.005),vent(0,0,.005)],.0035,s.paint,6);
        }
      }
    }
    if(id==='fd3s'||id==='fc3s'){
      for(const k of [-1,1]){
        for(const [label,z,y,w,d] of [['team',1.19,id==='fd3s'?.742:.731,.329,.074],['sponsor',-.545,.500,.152,.153]]){
          const [x0,y0,ww,hh]=labels[label];
          b.patch('marks',12,4,(u,v)=>side(k,z+k*(.5-u)*w,y+(v-.5)*d,.0024),[k,0,0],white,
            (u,v)=>[(x0+ww*u)/1024,1-(y0+(1-v)*hh)/512]);
        }
        if(id==='fd3s'){
          const outline=rounded([[-.916,.264],[-.767,.270],[-.780,.363],[-.827,.487],[-.877,.499],[-.943,.425]],.26);
          const outer=outline.map(([z,y])=>side(k,z,y,.003)),inner=outline.map(([z,y])=>side(k,mix(-.839,z,.68),mix(.378,y,.78),.005));
          b.face('satin',inner,[k,0,0],0x27282b);
          for(let i=0;i<inner.length;i++){
            const next=(i+1)%inner.length;b.face('paint',[outer[i],outer[next],inner[next],inner[i]],[k,0,0],s.paint);
          }
        }
      }
    }else if(id==='bnr32'){
      for(const k of [-1,1]){
        const pts=[[1.82,.15],[2.03,.15],[2.03,.40],[1.82,.40]].map(([p,v])=>{const a=c.sidePane(k,p,v);a[0]+=.003*k;return a;});
        b.face('marks',k>0?[pts[1],pts[0],pts[3],pts[2]]:pts,[k,0,0],white,labelUV('team'));
      }
    }
    const plateX=id==='fc3s'?.33:0,plateY=id==='gc8'?.384:id==='bnr32'?.404:id==='fd3s'?.326:.317;
    const plateZ=c.face(-1,plateX/c.W,plateY)[2]-.012;
    box(b,'satin',[plateX,plateY,plateZ],[.341,.172,.012],0x343839);
    const platePts=[[.165,-.082],[-.165,-.082],[-.165,.082],[.165,.082]].map(([x,y])=>[plateX+x,plateY+y,plateZ-.007]);
    b.face('marks',platePts,[0,0,-1],white,labelUV('plate'));
    // Lamp returns and painted bumper joints continue into the rear quarters.
    for(const k of [-1,1]){
      const outward=[k,0,0];
      for(const dir of [-1,1]){
        const y=dir<0?(id==='fd3s'?.415:id==='fc3s'?.445:.494):(id==='fd3s'?.483:id==='fc3s'?.472:.519);
        const end=dir*(L-.004),start=dir*(L-(dir<0?.51:.56));
        path('trim',seq(19,u=>side(k,mix(start,end,u),y-.018*Math.sin(Math.PI*u),.0013)),.0022,0x3b3d3c);
      }
      if(id!=='fd3s'){
        const y=id==='gc8'?.421:id==='fc3s'?.435:.452;
        const segments=[[-L+.04,s.frontZ-.365],[s.frontZ+.365,s.frontZ+s.wheelbase-.368],[s.frontZ+s.wheelbase+.368,L-.05]];
        for(const [a,z] of segments)b.patch('paint',18,5,(u,v)=>{
          const zz=mix(a,z,u);return side(k,zz,y+v*(id==='bnr32'?.030:.023),
            .002+.008*Math.sin(Math.PI*v)*Math.min(1,12*u,12*(1-u)));
        },outward,s.paint);
      }
      // Quarter-panel fuel flap with a stamped seam. Only the filler side has this panel.
      if(k===(id==='gc8'||id==='bnr32'?1:-1)){
        const z=s.frontZ+s.wheelbase+.328, y=c.top(z,1)[1]-.092;
        const a=id==='fd3s'?.073:.091,height=id==='fc3s'?.056:.067;
        const curve=n=>Math.sign(n)*Math.abs(n)**(id==='fd3s'?.92:.43);
        path('trim',seq(36,u=>side(k,z+a*curve(Math.cos(tau*u)),y+height*curve(Math.sin(tau*u)),.0018)),.0021,0x434541);
      }
      const markerZ=id==='gc8'||id==='bnr32'?s.frontZ+.430:s.frontZ-.424,markerY=id==='fd3s'?.404:id==='gc8'?.655:.566;
      b.patch(id==='gc8'?'markerLens':'amber',8,4,(u,v)=>side(k,markerZ+(u-.5)*.080,markerY+(v-.5)*.023*(.45+.55*Math.sin(Math.PI*u)),.003),outward,id==='gc8'?0xbec2bd:0xe0a561);
      if(id==='fd3s'){
        // The one-piece smoked garnish rolls around both rear haunches.
        const corner=(u,v,d)=>{
          const t=clamp((u-.41)/.59,0,1),half=.050*Math.sqrt(Math.max(0,1-t**3));
          const y=.596+.016*t+(2*v-1)*half;
          return u<.41?c.face(1,k*mix(.920,1,u/.41),y,-d):side(k,L-t*.188,y,d);
        };
        b.patch('satin',25,8,(u,v)=>corner(u,v,.002),u=>[k*u,0,1-u],0x30282a);
        b.patch('amber',11,5,(u,v)=>corner(.37+.27*u,.31+.27*v,.004),u=>[k,0,.6],0xb77941);
        b.patch('lampCover',24,7,(u,v)=>corner(u,v,.006),u=>[k*u,0,1-u],0x4c383b);
        const sideMarker=s.frontZ+s.wheelbase+.47;
        b.patch('tail',9,4,(u,v)=>side(k,sideMarker+.133*u,.428+(v-.5)*.030*(.55+.45*Math.sin(Math.PI*u)),.003),outward,0xeb9d97);
      }
      if(id==='gc8'||id==='fc3s'){
        const sub=id==='gc8',span=sub?.204:.130,kind=sub?'tail':'amber',color=sub?0xda777a:0xe0a65c;
        const height=(u,v)=>mix(sub?.661:.590,sub?.613+.092*v:.527+.129*v,Math.sqrt(Math.max(0,1-u**4)));
        const lens=(u,v)=>{
          if(u<.4)return c.face(1,k*mix(sub?.884:.905,1,u/.4),height(0,v),-.0025);
          const t=(u-.4)/.6;return side(k,L-span*t,height(t,v),.0025);
        };
        b.patch(kind,24,7,lens,u=>[k*u,0,1-u],color);
        for(const v of [0,1])path('satin',seq(28,u=>lens(u,v)),.0023,0x392c30);
      }
      if(id==='bnr32')b.patch('amber',14,6,(u,v)=>side(k,-L+.010+.147*u,.540+(.101-.053*u)*v+.027*u,.003),outward,0xdb9853);
    }
    // An airfoil with thickness, camber and end plates. Profiles and mount
    // spacing follow the specific manga-era aero, including the tall FD kit.
    const [station,wingY,span,chord,mount]=h.wing,zWing=station*L;
    const subWing=id==='gc8',lowWing=id==='fc3s';
    const aero=(q,v,lower=false)=>{
      const n=Math.abs(q),z=zWing+(v-.5)*chord-(lowWing?.074:.038)*n*n;
      const thickness=(id==='bnr32'?.028:lowWing?.022:.025)+.016*Math.sin(Math.PI*v);
      return [q*span,wingY+.009*n*n+.018*v+.014*Math.sin(Math.PI*v)-(lower?thickness:0),z];
    };
    b.patch('paint',26,7,(u,v)=>aero(2*u-1,v),up,s.paint);
    b.patch('paint',26,7,(u,v)=>aero(2*u-1,v,true),[0,-1,0],s.paint);
    for(const v of [0,1])b.patch('paint',26,2,(u,t)=>between(aero(2*u-1,v,true),aero(2*u-1,v),t),[0,0,v?1:-1],s.paint);
    for(const k of [-1,1]){
      const tip=span-(id==='fd3s'?.014:subWing?.012:lowWing?.035:.045);
      const footFront={fd3s:.231,fc3s:.226,gc8:.339,bnr32:.357}[id];
      const footRear=lowWing?.016:.052;
      b.patch('paint',26,13,(u,v)=>{
        const a=u*tau,n=.5+.5*Math.cos(a),flare=(1-v)**3;
        const x=k*(mix(mount,tip,v)+(.016+.028*flare)*Math.sin(a));
        const rawZ=zWing+mix(-footFront,footRear,n);
        const deck=top(rawZ,clamp(x/top(rawZ,1)[0],-1,1));
        const blade=aero(k*tip/span,.025+.95*n,true);
        const lean=subWing?.035*Math.sin(Math.PI*v):id==='fd3s'?-.017*Math.sin(Math.PI*v):0;
        return [x+k*lean,mix(deck[1]-.005,blade[1]+.005,v),mix(deck[2],blade[2],v)+.020*Math.sin(Math.PI*v)*(1-n)];
      },u=>[k*Math.sin(tau*u),0,Math.cos(tau*u)],s.paint);
      b.face('paint',[aero(k,0),aero(k,1),aero(k,1,true),aero(k,0,true)],[k,0,0],s.paint);
    }
    if(subWing||lowWing){
      const blade=(q,v)=>{
        const zz=zWing-.115+(v-.5)*(subWing?.156:.090),qx=q*mount,deck=top(zz,qx/top(zz,1)[0]);
        return [qx,deck[1]+(subWing?.041:.009)+.010*Math.sin(Math.PI*v),deck[2]];
      };
      if(subWing){
        b.patch('paint',24,6,(u,v)=>blade(u*2-1,v),up,s.paint);
        for(const v of [0,1])b.patch('paint',24,2,(u,t)=>{
          const p=blade(2*u-1,v);p[1]-=.019*t;return p;
        },[0,0,v?1:-1],s.paint);
      }
      if(lowWing)for(const k of [-1,1]){
        const x=k*.248,foot=blade(x/mount,.60),under=aero(x/span,.37,true);
        rod(b,'paint',foot,under,.013,s.paint,8,.022);
      }
      b.patch('tail',12,4,(u,v)=>{
        if(!subWing)return c.face(1,(u-.5)*.155,.739+(v-.5)*.022,-.003);
        const p=blade((u-.5)*.274/mount,.89);return [p[0],p[1]+.002+.017*v,p[2]+.004+v*.008];
      },[0,.28,1],0xd26c68);
    }
    const dir=1,out=[0,0,1], badge=(label,x,y,w,d)=>{
      b.face('marks',rect(x-w/2,y-d/2,x+w/2,y+d/2).map(([xx,yy])=>c.face(dir,xx,yy,-.003)),out,white,labelUV(label));
    };
    if(id==='gc8'){
      badge('name',0,.668,.43,.067);
      for(const k of [-1,1])path('trim',seq(18,t=>c.face(1,k*(.380-.060*t),.780-.214*t,-.0015)),.0024,0x384458);
      path('trim',seq(28,u=>c.face(1,(u-.5)*.644,.567-.005*Math.cos((u-.5)*Math.PI),-.0024)),.0023,0x333b49);
      path('satin',seq(24,u=>c.face(1,(u-.5)*.70,.779+.004*Math.cos((u-.5)*Math.PI),-.002)),.005,0x23334c);
      const key=c.face(1,.264,.637,-.004);
      rod(b,'metal',key,[key[0],key[1],key[2]+.003],.0085,0xc3c1b7,12);
    }
    if(id==='fc3s'){badge('grade',-.55,.722,.15,.027);badge('make',.55,.717,.147,.040);}
    if(id==='bnr32'){
      badge('grade',.364,.709,.102,.069);badge('make',-.716,.801,.156,.031);badge('name',0,.604,.760,.042);
      path('satin',seq(30,u=>c.face(1,(2*u-1)*.449,.660,-.0023)),.0030,0x2e3031);
      const key=c.face(1,0,.774,-.003);
      rod(b,'metal',key,[key[0],key[1],key[2]+.003],.015,0x989995,18);
      rod(b,'satin',[key[0],key[1],key[2]+.003],[key[0],key[1],key[2]+.005],.010,0x343638,14);
      for(const k of [-1,1])b.patch('satin',16,3,(u,v)=>{
        const a=tau*u;return c.face(1,k*.639+v*.015*Math.cos(a),.297+v*.021*Math.sin(a),-.002);
      },out,0x333639);
    }
    if(id==='fd3s')badge('make',.45,.470,.13,.030);
    // A rolled stainless lip, recessed black bore and separate rear canister.
    const tipZ=c.face(1,h.tip/c.face(1,1,.32)[0],.32)[2]+.026;
    const tip=[h.tip,c.sillAt(L)*.70+.046,tipZ],r=id==='gc8'?.043:.052;
    rod(b,'metal',[tip[0],tip[1]+.022,tip[2]-.31],[tip[0],tip[1]+.012,tip[2]-.12],r*1.45,0x5a5751,20);
    function pipe(t,rad,z){return [tip[0]+rad*Math.cos(t*tau),tip[1]+rad*Math.sin(t*tau),tip[2]+z];}
    for(const [r0,z0,r1,z1,mat,col] of [[r,-.17,r,0,'metal',0x90918c],[r,0,r*.84,.002,'metal',0xd4d1bf],[r*.84,.002,r*.80,-.042,'satin',0x242422]])
      b.patch(mat,32,2,(u,v)=>pipe(u,mix(r0,r1,v),mix(z0,z1,v)),(u)=>[Math.cos(u*tau),Math.sin(u*tau),1],col);
    b.face('trim',seq(28,t=>pipe(t,r*.81,-.042)).slice(0,-1),out,0x151616);
    return tip;
  }
  function wheelAssembly(b,brakes,c){
    const {id,s}=c,[radius,width,inches,spokes,alloy]=s.wheel,half=width/2,rim=inches*.0127;
    const radial=(x,r,a)=>[x,r*Math.cos(a),r*Math.sin(a)];
    function ring(section,mat,color,segments=64,outward=1){
      for(let i=1;i<section.length;i++){
        const [xa,ra]=section[i-1],[xb,rb]=section[i];
        b.patch(mat,segments,1,(u,v)=>radial(mix(xa,xb,v),mix(ra,rb,v),tau*u),
          (u)=>[outward*(ra-rb),outward*(xb-xa)*Math.cos(tau*u),outward*(xb-xa)*Math.sin(tau*u)],color);
      }
    }
    ring([[half*.69,rim-.002],[half*.94,rim+.010],[half,rim+.033],[half*.97,radius-.021],[half*.83,radius-.006],
      [half*.67,radius],[-half*.67,radius],[-half*.84,radius-.006],[-half*.98,radius-.024],[-half,rim+.033],[-half*.88,rim]],'tire',0x2f3032,64,-1);
    b.patch('sidewall',64,5,(u,v)=>{
      const r=mix(rim+.023,radius-.023,v),x=half*mix(.979,.977,v)+.0034*Math.sin(Math.PI*v);
      return radial(x,r,u*tau);
    },[1,0,0],0x57585b,(u,v)=>[1-u,v]);
    for(const x of [-.052,-.018,.018,.052])ring([[x-.0014,radius+.0004],[x+.0014,radius+.0004]],'tire',0x18191a);
    for(const k of [-1,1])for(let i=0;i<46;i++){
      const a=i*tau/46;
      b.face('tire',[radial(k*half*.63,radius+.0005,a),radial(k*half*.86,radius-.007,a+.045),
        radial(k*half*.875,radius-.008,a+.057),radial(k*half*.63,radius+.0005,a+.010)],[0,Math.cos(a),Math.sin(a)],0x191b1c);
    }
    ring([[half*.946,rim+.022],[half*.973,rim+.023],[half*.982,rim+.020]],'tire',0x3a3b3c);
    const polished=id==='fc3s',lipMetal=polished?0xdce0df:id==='gc8'?0xc8a960:0xb9bdc0;
    const shoulder=polished?rim-.024:rim-.012;
    ring([[half*.90,rim+.004],[half*.965,rim+.002],[half*.989,rim-.003],[half*.960,rim-.006],
      [half*.92,shoulder],[half*.80,shoulder-.003]],'rim',lipMetal);
    ring([[half*.80,shoulder-.003],[half*.58,shoulder-.004],[-half*.78,shoulder-.003]],'rim',alloy);
    if(polished)ring([[half*.905,shoulder+.005],[half*.908,shoulder+.004]],'metal',0x888f91);
    ring([[-half*.64,rim-.022],[half*.41,rim-.020]],'rim',0x46484c);
    const rotor=rim*.776;
    ring([[half*.25,rotor],[half*.31,rotor],[half*.31,rotor*.54],[half*.38,rotor*.48]],'metal',0x77766f);
    for(const track of [.65,.79,.92])ring([[half*.322,rotor*track],[half*.322,rotor*(track-.010)]],'metal',0x5d5c57);
    const cap= id==='gc8'?.046:.053;
    rod(b,'rim',[half*.36,0,0],[half*.69,0,0],rim*.393,alloy,32,rim*.376);
    // For the FC, broad scalloped spoke roots leave five oval apertures and
    // expose the polished two-piece lip. The STi and Nissans use cast arms.
    const widths=id==='fc3s'?[.65,.26,.264]:id==='gc8'?[.55,.19,.16]:id==='fd3s'?[.49,.18,.175]:[.56,.212,.182];
    for(let i=0;i<spokes;i++){
      const a=tau*i/spokes+.13,rr=[rim*.28,rim*.61,shoulder],twist=id==='fd3s'?.054:id==='gc8'?.019:0;
      const depth=polished?[half*.68,half*.77,half*.65]:[half*.67,half*.80,half*.89];
      const edge=(j,k,back=false)=>radial(depth[j]-(back?.021:0),rr[j],a+k*widths[j]+twist*j);
      for(let j=0;j<2;j++){
        b.patch('rim',7,7,(u,v)=>{
          const r=mix(rr[j],rr[j+1],v),angle=a+(u*2-1)*mix(widths[j],widths[j+1],v)+twist*(j+v);
          const fillet=.012*Math.sin(Math.PI*u)**.7+.003*Math.sin(Math.PI*v);
          return radial(mix(depth[j],depth[j+1],v)+fillet,r,angle);
        },[1,0,0],alloy);
        for(const k of [-1,1])b.face('rim',[edge(j,k),edge(j+1,k),edge(j+1,k,true),edge(j,k,true)],
          [0,-k*Math.sin(a),k*Math.cos(a)],new T.Color(alloy).multiplyScalar(.64).getHex());
      }
      if(polished)for(let j=0;j<5;j++){
        const theta=a+tau*j/(spokes*5),p=radial(half*.938,rim-.015,theta);
        rod(b,'metal',p,[p[0]+.003,p[1],p[2]],.0038,0x9d9f9e,6);
      }
    }
    const lugs=5,pitchRadius=id==='gc8'?.050:.05715;
    for(let i=0;i<lugs;i++){
      const a=tau*(i+.48)/lugs,py=Math.cos(a)*pitchRadius,pz=Math.sin(a)*pitchRadius;
      rod(b,'satin',[half*.68,py,pz],[half*.72,py,pz],.010,0x2a2c2d,10);
      rod(b,'metal',[half*.719,py,pz],[half*.762,py,pz],.0075,0xa2a29b,6);
    }
    rod(b,'rim',[half*.68,0,0],[half*.805,0,0],cap*.68,alloy,24,cap*.60);
    rod(b,'satin',[half*.802,0,0],[half*.828,0,0],cap*.49,id==='gc8'?0x674333:0x34383a,16);
    const capX=half*.829,capR=cap*.48;
    b.face('marks',[[capX,-capR,capR],[capX,-capR,-capR],[capX,capR,-capR],[capX,capR,capR]],[1,0,0],white,labelUV('wheelCap'));
    rod(b,'trim',[half*.74,-.04,rim*.91],[half*1.01,-.041,rim*.887],.005,black,7);
    const cc=id==='gc8'?0x383d3d:id==='bnr32'?0x2e3032:0x615e57;
    for(let i=0;i<13;i++){
      const a=-.55+.96*i/13,z=-.55+.96*(i+1)/13;
      const point=(angle,r,x)=>[x,Math.sin(angle)*r,-Math.cos(angle)*r];
      brakes.face('rim',[point(a,rotor*.74,half*.46),point(z,rotor*.74,half*.46),point(z,rotor*1.02,half*.46),point(a,rotor*1.02,half*.46)],[1,0,0],cc);
      brakes.face('rim',[point(a,rotor*1.02,half*.46),point(z,rotor*1.02,half*.46),point(z,rotor*1.02,-half*.10),point(a,rotor*1.02,-half*.10)],[0,Math.sin(a),-Math.cos(a)],cc);
    }
  }
  function interior(b,c){
    const {s,h}=c,seatX=.345,shift=s.height-1.34;
    const shell=(x,z,rows,mat,color)=>{
      for(let j=1;j<rows.length;j++){
        function contour(row,u){
          const [y,hw,hd,offset]=row,a=u*tau,curve=n=>Math.sign(n)*Math.abs(n)**.57;
          return [x+hw*curve(Math.cos(a)),y+shift,z+offset+hd*curve(Math.sin(a))];
        }
        b.patch(mat,24,1,(u,v)=>between(contour(rows[j-1],u),contour(rows[j],u),v),(u)=>[Math.cos(u*tau),0,Math.sin(u*tau)],color);
      }
    };
    for(const k of [-1,1]){
      const x=k*seatX;
      shell(x,.13,[[.325,.17,.18,-.02],[.389,.211,.225,-.02],[.438,.201,.218,-.035],[.466,.147,.173,-.032],[.468,.003,.003,-.03]],'cloth',0x35383b);
      if(c.id==='gc8'){
        // Integrated STi seatback. The charcoal insert hugs the front of
        // the curved cushion and leaves the red shoulder bolsters exposed.
        const rows=[[.418,.163,.056,.070],[.507,.203,.077,.068],[.708,.193,.071,.121],
          [.813,.208,.066,.138],[.895,.183,.061,.151],[.964,.140,.060,.167],
          [1.057,.118,.057,.185],[1.091,.096,.053,.188],[1.110,.052,.035,.190],[1.116,.002,.002,.191]];
        shell(x,.14,rows,'cloth',0x943a41);
        const insert=[.55,.72,.78,.78,.73,.77,.78,.65,.02];
        for(let i=1;i<insert.length;i++){
          b.patch('cloth',16,4,(u,v)=>{
            const [y,hw,hd,dz]=between(rows[i-1],rows[i],v),w=mix(insert[i-1],insert[i],v)*(2*u-1);
            const front=hd*(1-Math.abs(w)**(2/.57))**(.57/2);
            return [x+hw*w,y+shift,.14+dz-front-.0025];
          },[0,0,-1],0x35393c);
        }
        continue;
      }
      shell(x,.14,[[.405,.16,.053,.07],[.49,.208,.077,.061],[.76,.207,.066,.128],[.929,.165,.058,.163],[.954,.118,.048,.168],[.958,.003,.003,.169]],'cloth',0x494c50);
      for(const side of [-1,1])tube(b,'cloth',[[x+side*.128,.475+shift,.148],[x+side*.175,.627+shift,.180],[x+side*.166,.824+shift,.243],[x+side*.132,.916+shift,.263]],.035,0x34373a,10);
      shell(x,.15,[[.934,.090,.042,.174],[.984,.112,.058,.177],[1.075,.112,.055,.193],[1.106,.075,.047,.190],[1.111,.001,.001,.190]],'cloth',0x333639);
    }
    const dashY=c.top(h.cabin[0],0)[1]-.030,zDash=h.cabin[0]+.247;
    b.patch('trim',30,12,(u,v)=>{
      const q=(2*u-1)*.92,base=c.roof(0,q);
      return [base[0],mix(base[1]-.026,dashY-.024*q*q,v)+.016*Math.sin(Math.PI*v),mix(base[2]+.026,zDash+.095,v)];
    },up,0x303437);
    box(b,'trim',[0,dashY-.096,zDash+.035],[c.W*1.62,.176,.16],0x33363a);
    box(b,'trim',[seatX,dashY+.012,zDash+.101],[.327,.104,.149],0x282c30);
    const g=zDash+.178;
    b.face('marks',[[seatX-.15,dashY-.025,g],[seatX+.15,dashY-.025,g],[seatX+.15,dashY+.050,g],[seatX-.15,dashY+.050,g]],[0,0,1],white,labelUV('gauges'));
    const rim=seq(48,u=>[seatX+.156*Math.cos(tau*u),dashY+.025+.147*Math.sin(tau*u),g+.136-.034*Math.sin(tau*u)]);
    tube(b,'satin',rim,.014,0x262a2d,8);
    for(const idx of [2,22,36])rod(b,'satin',[seatX,dashY+.025,g+.145],rim[idx],.018,0x494a4b,8,.014);
    box(b,'satin',[seatX,dashY+.02,g+.143],[.109,.061,.033],black);
    box(b,'trim',[0,.462+shift,-.052],[.154,.105,.56],0x333536);
    rod(b,'metal',[.002,.50+shift,-.167],[.002,.625+shift,-.157],.009,0x777674,8);
    rod(b,'satin',[.002,.608+shift,-.157],[.002,.648+shift,-.157],.021,black,14);
    const rear=h.cabin[3]-.21, y=c.top(rear,0)[1]-.038;
    box(b,'cloth',[0,y-.021,rear-.118],[c.W*1.51,.040,.43],0x313438);
    const mirrorY=s.height-.105,mirrorZ=h.cabin[1]-.034;
    box(b,'satin',[0,mirrorY,mirrorZ],[.195,.057,.028],black);
    box(b,'metal',[0,mirrorY,mirrorZ+.015],[.175,.043,.003],0xa1aaa6);
    rod(b,'satin',[0,mirrorY+.017,mirrorZ],[0,mirrorY+.074,mirrorZ+.021],.007,black,8);
    return [.055,dashY+.022,zDash-.085];
  }

  const create=staged(function* createRival(id){
    const s=TougeRivals.cars[id],c=coach(id,s),m=finishes(id,s),b=new GeometryBatch(m);
    yield;
    shell(b,c);yield;
    glazing(b,c);yield;
    bumper(b,c,-1);yield;
    bumper(b,c,1);yield;
    const upBatch=new GeometryBatch(m),downBatch=new GeometryBatch(m);
    const tip=equipment(b,upBatch,downBatch,c);
    const cup=interior(b,c);yield;
    const group=new T.Group(),suspension=new T.Group(),body=b.build(s.trim+' coachwork');
    group.name=s.name+' · '+s.trim;suspension.rotation.order='ZXY';suspension.position.y=.36;body.position.y=-.36;
    group.add(suspension);suspension.add(body);
    const raised=upBatch.build('Raised headlamps'),closed=downBatch.build('Flush headlamp doors');
    body.add(raised,closed);
    const figure=new GeometryBatch(m);buildDriver(figure);
    const driver=figure.build('Driver');driver.position.y=s.height-1.34;body.add(driver);
    const rotating=new GeometryBatch(m),fixed=new GeometryBatch(m);wheelAssembly(rotating,fixed,c);
    const wheel=rotating.build(s.trim+' wheel'),caliper=fixed.build('Brake caliper');
    const wheels=[],front=s.frontZ,rear=front+s.wheelbase,radius=s.wheel[0],[frontTrack,rearTrack]=s.track.map(x=>x/2);
    for(const [i,axle] of [front,rear].entries())for(const side of [-1,1]){
      const hub=new T.Group(),mirror=new T.Group(),spin=wheel.clone();
      hub.position.set(side*s.track[i]/2,radius,axle);hub.name=i?'Rear hub':'Front knuckle';
      mirror.rotation.y=side<0?Math.PI:0;mirror.add(spin,caliper.clone());hub.add(mirror);group.add(hub);
      wheels.push({hub,spin,side,steers:!i});
    }
    let night=false,parked=false;
    function positionHeadlamps(){raised.visible=night||parked;closed.visible=!raised.visible;}
    const setNight=value=>{
      night=!!value;positionHeadlamps();m.head.emissiveIntensity=night?1.12:.050;
      m.tail.emissiveIntensity=night?.48:.06;
    };
    function setMotion({wheelAngle=0,rearWheelAngle=wheelAngle,steer=0,rearSteer=0,brake=0,bodyRoll=0,bodyPitch=0,suspensionOffsets,reversing=false}={}){
      suspension.rotation.x=bodyPitch;suspension.rotation.z=bodyRoll;
      for(const [i,w] of wheels.entries()){
        w.hub.position.y=radius+(suspensionOffsets?.[i]||0);w.spin.rotation.x=-w.side*(w.steers?wheelAngle:rearWheelAngle);
        w.hub.rotation.y=w.steers?steer:rearSteer;
      }
      m.tail.emissiveIntensity=(night?.48:.06)+clamp(brake,0,1)*2.0;m.reverseLens.emissiveIntensity=reversing?1.25:.025;
    }
    setNight(false);
    return {group,body,driver,suspension,wheels,setNight,setMotion,setDisplayMode:value=>{parked=!!value;driver.visible=!parked;positionHeadlamps();},
      axles:{front,rear,frontTrack,rearTrack,halfTrack:(frontTrack+rearTrack)/2,radius},
      mounts:{headlamp:[c.W*.67,c.h.lightY,-c.L+(id==='fd3s'||id==='fc3s'?.27:.045)],
        tailLamp:[c.W*.69,c.L+.12],bonnetEye:[.14,c.top(c.h.cabin[0],0)[1]+.25,c.h.cabin[0]],bonnetLook:[.14,.57,-30],shadowSize:[s.width+.59,s.length+.44],cup},
      exhaustOutlets:[{position:tip,direction:[0,0,1]}]};
  });
  window.TougeRivalModels={create,shapes};
})();
