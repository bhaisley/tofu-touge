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
      cuts:[[-1,.856,.470,.505],[-.93,.935,.543,.538],[-.77,.985,.642,.576],[-.58,1,.690,.613],[-.39,.955,.710,.710],[-.16,.938,.734,.744],[.12,.948,.741,.751],[.34,.977,.769,.781],[.56,1,.801,.813],[.73,.971,.792,.817],[.90,.938,.757,.791],[1,.869,.696,.740]],
      cabin:[-.84,-.21,.40,1.55], rail:[.885,.765,.720,.849], roofDrop:.079, noseRound:.236,tailRound:.249,soft:.058,sill:.152,
      belt:.88,quarter:2.69,bPost:1.75,wing:[.93,1.047,.727,.245,.612], tip:.54,lightY:.597
    },
    fc3s:{
      cuts:[[-1,.935,.555,.555],[-.94,.972,.608,.606],[-.79,.985,.684,.663],[-.57,.995,.715,.696],[-.37,.969,.757,.754],[-.16,.956,.768,.768],[.18,.956,.778,.778],[.40,.979,.786,.790],[.57,1,.800,.812],[.75,.988,.787,.809],[.91,.958,.781,.807],[1,.918,.740,.768]],
      cabin:[-.80,-.18,.53,1.65],rail:[.890,.767,.748,.873],roofDrop:.052,noseRound:.131,tailRound:.124,soft:.028,sill:.163,
      belt:.89,quarter:2.83,bPost:1.77,wing:[.927,.850,.697,.247,.520],tip:-.58,lightY:.654
    },
    gc8:{
      cuts:[[-1,.928,.639,.651],[-.94,.961,.702,.714],[-.78,.983,.754,.746],[-.57,.997,.796,.780],[-.40,.980,.827,.831],[-.24,.969,.834,.839],[.12,.967,.845,.847],[.38,.985,.862,.863],[.58,1,.872,.866],[.76,.981,.872,.891],[.91,.960,.862,.891],[1,.925,.839,.867]],
      cabin:[-.91,-.365,.584,1.30],rail:[.905,.739,.738,.884],roofDrop:.065,noseRound:.135,tailRound:.138,soft:.029,sill:.168,
      belt:.905,quarter:2.23,bPost:1.57,wing:[.902,1.158,.695,.252,.557],tip:-.56,lightY:.612
    },
    bnr32:{
      cuts:[[-1,.924,.635,.632],[-.93,.963,.693,.687],[-.78,.980,.732,.722],[-.590,1,.779,.754],[-.39,.954,.795,.797],[-.24,.951,.811,.813],[.10,.955,.825,.829],[.35,.971,.850,.852],[.56,1,.867,.866],[.75,.980,.866,.877],[.92,.959,.857,.858],[1,.928,.808,.822]],
      cabin:[-.80,-.245,.555,1.40],rail:[.905,.758,.738,.870],roofDrop:.056,noseRound:.125,tailRound:.117,soft:.026,sill:.169,
      belt:.90,quarter:2.26,bPost:1.61,wing:[.898,1.015,.695,.267,.55],tip:-.58,lightY:.600
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
    const cornerHeight=z=>h.soft*(1.62-.36*Math.exp(-((Math.abs(z)-1.20)**2)/.084));
    const cornerWidth=z=>h.soft*(1.82-.47*Math.exp(-((Math.abs(z)-1.20)**2)/.084));
    const endBlend=z=>T.MathUtils.smoothstep(Math.abs(z)/L,.59,1);
    const returnDepth=dir=>dir<0?(id==='fd3s'?.065:.044):.038;
    function bumperInset(dir,y){
      const waist=dir<0?(id==='fd3s'?.42:id==='fc3s'?.445:.485):(id==='fd3s'?.46:id==='fc3s'?.455:.515);
      const shelf=(dir<0?.042:id==='fc3s'?.085:.075)*T.MathUtils.smoothstep(y,waist-.012,waist+.056);
      const turnUnder=.060*(1-T.MathUtils.smoothstep(y,h.sill,waist-.08))**2;
      return shelf+turnUnder+.004*Math.exp(-(((y-waist)/.009)**2));
    }
    function endZ(z,q){
      const n=clamp(Math.abs(q),0,1), curve=.30*n*n+.70*n**4;
      return z-Math.sign(z)*endBlend(z)*curve*(z<0?h.noseRound:h.tailRound);
    }
    function top(z,q,lift=0){
      const n=Math.abs(q), edge=section(z,2),center=section(z,3);
      const f=id==='fd3s'?n*n*(3-2*n):n**2.45;
      const crease=(id==='fd3s'?.026:.010)*Math.exp(-((n-.72)**2)/.013)*T.MathUtils.smoothstep(-z,.66,1.17)*(1-n**5);
      const crown=h.soft*.65*(1-n*n);
      return [q*(width(z)-cornerWidth(z)),mix(center,edge,f)+crown+crease+lift,
        endZ(z,q)-Math.sign(z)*(returnDepth(Math.sign(z))+bumperInset(Math.sign(z),mix(center,edge,f)+crown+crease))*endBlend(z)];
    }
    function side(k,z,y,lift=0){
      const topY=section(z,2),t=clamp((y-h.sill)/(topY-h.sill),0,1);
      // The fold below the belt and the lower sill recess catch different sky bands.
      const lower=(id==='fd3s'?.058:.052)*(1-t)**2+.021*Math.exp(-(((t-.39)/.19)**2));
      const shoulder=cornerHeight(z), edge=clamp(1-(topY-y)/shoulder,0,1);
      const fillet=1-Math.sqrt(Math.max(0,1-edge*edge));
      const hip=.008*Math.sin(Math.PI*t)+.008*Math.exp(-(((t-.77)/.085)**2));
      return [k*(width(z)-lower+hip-cornerWidth(z)*fillet+lift),y,
        endZ(z,1)-Math.sign(z)*(returnDepth(Math.sign(z))*fillet+bumperInset(Math.sign(z),y))*endBlend(z)];
    }
    function face(dir,q,y,depth=0){
      const z=dir*L,yy=top(z,q)[1],u=clamp((yy-y)/(yy-h.sill),0,1);
      const edge=clamp(1-(yy-y)/cornerHeight(z),0,1), fillet=1-Math.sqrt(Math.max(0,1-edge*edge));
      const tuck=.043*u**3+.012*Math.sin(2*Math.PI*u)+.009*Math.exp(-(((u-.55)/.095)**2));
      // The transverse deck rises towards the middle. Apply its own radius
      // at each column so the bumper meets that local height with a tangent.
      const x=side(1,z,mix(top(z,1)[1],h.sill,u))[0];
      return [q*x,y,endZ(z,q)-dir*(depth+bumperInset(dir,y)+returnDepth(dir)*fillet+tuck*(1-Math.abs(q)**4))];
    }
    // A compound backlight meets the deck on an arc. In profile the station
    // at either lower corner is closer to the axle than its centre.
    function roof(p,q){
      p=clamp(p,0,3);
      const j=Math.min(2,Math.floor(p)),t=p-j,n=Math.abs(q),n2=n*n;
      const shifts=[.120,.038,-.043,-.134];
      const zz=h.cabin.map((z,i)=>z+shifts[i]*n2);
      const z=mix(zz[j],zz[j+1],t);
      const x0=top(zz[0],h.rail[0])[0],x3=top(zz[3],h.rail[3])[0];
      const widths=[x0,W*h.rail[1],W*h.rail[2],x3];
      const glassHeight=[top(zz[0],q*h.rail[0])[1],s.height-.027-h.roofDrop*n2,s.height-.035-h.roofDrop*n2,top(zz[3],q*h.rail[3])[1]];
      const bow=(j===1?.031:j===0?.030:.045)*Math.sin(Math.PI*t)*(1-.37*n2);
      const roll=j===1?0:(j===0?.075*(t**4-t**9):.086*((1-t)**4-(1-t)**9));
      return [q*(mix(widths[j],widths[j+1],t)+.010*Math.sin(Math.PI*t)),mix(glassHeight[j],glassHeight[j+1],t)+bow+roll,z];
    }
    function belt(z){
      const a=h.cabin[0]+.12,b=h.cabin[3]-.134;
      return mix(h.rail[0],h.rail[3],clamp((z-a)/(b-a),0,1));
    }
    function sidePane(k,p,t){
      const ends=T.MathUtils.smoothstep(3-p,0,.20);
      const quarter=.145*Math.exp(-(((p-h.quarter)/.31)**2));
      const pillar=id==='fc3s'?.13*Math.exp(-(((p-h.bPost)/.32)**2)):0;
      p+=(1-2*t)*(quarter+pillar)*ends;
      const a=roof(p,k),b=top(a[2],k*belt(a[2]));
      const v=between(b,a,t);v[0]+=k*.016*Math.sin(Math.PI*t);return v;
    }
    return {id,s,h,L,W,width,top,side,face,roof,belt,sidePane};
  }

  const labels={plate:[0,0,332,165],team:[343,0,398,95],name:[350,103,460,55],grade:[0,177,475,62],
    grille:[510,174,220,78],gauges:[0,258,452,142],sponsor:[752,0,255,98],fuel:[772,170,232,53]};
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
      c.fillStyle='#c2c5c2';c.font='italic bold 48px Helvetica,sans-serif';c.fillText(s.badge,580,130,436);
      const grade={fd3s:'RX-7     Type R',fc3s:'∞ III     RX-7',gc8:'WRX   STi',bnr32:'GT–R'}[id];
      c.fillStyle=id==='gc8'||id==='bnr32'?'#d04151':'#d1d1c8';c.font='italic bold 52px Helvetica,sans-serif';c.fillText(grade,236,209,460);
      c.fillStyle=id==='gc8'?'#cf3468':'#c3c8cd';c.font='italic 900 58px Arial';c.fillText({gc8:'i',bnr32:'GT-R',fd3s:'∞',fc3s:'MAZDA'}[id],620,214,200);
      c.fillStyle='#242428';c.font='bold italic 36px Arial';c.fillText('MAZDA',874,26,220);c.font='italic bold 26px Arial';c.fillText('ROTARY POWER',874,65,224);
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
    const lens=(color,emission)=>coated(.21,.11,{color,map:optics.signal,emissive:emission,emissiveMap:optics.lit,emissiveIntensity:.045});
    const m={paint:coated(.235,id==='bnr32'?.39:id==='gc8'?.33:.075,{envMapIntensity:1.12}),trim:std(.68,.035),satin:coated(.27,.16),cloth:std(.94,.01),
      metal:std(.29,.73),rim:std(.30,.65),tire:std(.85,.015),sidewall:std(.83,.015,{map:sidewall(s)}),glass:laminatedGlass(0x425258,.28),
      sideGlass:laminatedGlass(0x27323a,.48),hatchGlass:laminatedGlass(0x222c32,.60,optics.heat),
      tail:lens(0xbb2427,0xff261d),reverseLens:lens(0xd8dcd1,0xffe6c7),markerLens:lens(0xd4d7ce,0xffc891),amber:lens(0xeb8b2a,0xff8c29),
      head:coated(.19,.12,{map:optics.head,emissiveMap:optics.head,emissive:0xffebc7,emissiveIntensity:.04}),
      marks:std(.48,.11,{map:markings(id,s),alphaTest:.3,alphaToCoverage:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})};
    for(const k of ['paint','satin','metal','rim','glass','sideGlass','hatchGlass','tail','reverseLens','head'])m[k].userData.routeReflections=true;
    m.paint.userData.lacquer=true;return m;
  }
  function shell(b,c){
    const {s,h,L,top,side,belt}=c;
    const f=h.cabin[0],r=h.cabin[3], axles=[s.frontZ,s.frontZ+s.wheelbase],radius=s.wheel[0],arch=radius+.033;
    // The open wheel wells have both a rolled lip and a dark return behind it.
    for(const k of [-1,1]){
      const outward=[k,0,0], points=[-L,L];
      for(const a of axles){
        for(let i=0;i<=40;i++)points.push(a-arch*Math.cos(i*Math.PI/40));
        points.push(a-arch-.014,a+arch+.014);
        b.patch('trim',42,4,(u,v)=>{
          const angle=Math.PI*u,z=a+arch*Math.cos(angle),y=radius+arch*Math.sin(angle);
          const p=side(k,z,y-.003);p[0]-=k*v*.21;return p;
        },(u)=>[0,-Math.sin(Math.PI*u),-Math.cos(Math.PI*u)],0x232529);
        b.patch('paint',42,3,(u,v)=>{
          const angle=Math.PI*u,rr=arch+.018*v,z=a+rr*Math.cos(angle),y=radius+rr*Math.sin(angle);
          return side(k,z,y,.002+.003*Math.sin(Math.PI*v));
        },outward,s.paint);
      }
      for(let i=0;i<=64;i++)points.push(mix(-L,L,i/64));
      const cuts=[...new Set(points)].sort((a,b)=>a-b);
      const bottom=z=>{
        const a=axles.reduce((best,v)=>Math.abs(v-z)<Math.abs(best-z)?v:best);
        const dz=Math.abs(z-a);return dz<=arch+1e-8?radius+Math.sqrt(Math.max(0,arch*arch-dz*dz)):
          mix(radius,h.sill,clamp((dz-arch)/.014,0,1));
      };
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
    for(const [dir,j,cabinZ] of [[-1,0,f],[1,3,r]]){
      b.patch('paint',34,34,(u,v)=>{
        const q=2*u-1, seamZ=cabinZ+(dir<0?.120:-.134)*q*q,z=mix(dir*L,seamZ,v);
        return top(z,q*belt(z));
      },up,s.paint);
    }
    box(b,'trim',[0,.295,0],[s.width*.81,.22,s.length*.83],0x232529);
    for(const a of axles)box(b,'trim',[0,radius+.015,a],[s.width*.78,.33,.68],0x27292a);
  }
  function glazing(b,c){
    const {s,h,roof,sidePane,top}=c;
    for(const [start,end,material] of [[0,1,'glass'],[2,3,'hatchGlass']]){
      // The glass, the black frit and the roof metal meet at shared edges.
      const limits=[-1,-.965,.965,1], cuts=[start,start+.024,end-.023,end];
      for(let j=1;j<cuts.length;j++)for(let i=1;i<limits.length;i++){
        b.patch(i===2&&j===2?material:'satin',i===2?28:2,j===2?16:2,
          (u,v)=>roof(mix(cuts[j-1],cuts[j],v),mix(limits[i-1],limits[i],u)),
          [0,1,start?1:-1],i===2&&j===2?white:0x191c20);
      }
    }
    b.patch('paint',32,19,(u,v)=>roof(1+v,u*2-1),up,s.paint);
    for(const k of [-1,1]){
      const out=[k,0,0],post=h.bPost;
      // The RX-7 liftbacks carry a large wraparound rear pane. The sedans'
      // C-pillars sweep out over the quarter shoulder into a separate boot.
      const rotary=c.id==='fc3s'||c.id==='fd3s';
      const pillarEnd=post+(c.id==='fc3s'?.206:c.id==='fd3s'?.104:.022);
      const ranges=[[0,.10,'paint'],[.10,post-.025,'sideGlass'],[post-.025,pillarEnd,rotary?'paint':'satin'],
        [pillarEnd,h.quarter,'sideGlass'],[h.quarter,3,'paint']];
      for(const [a,z,material] of ranges){
        const samples=[a,...[1,2].filter(p=>p>a&&p<z),z];
        for(let j=1;j<samples.length;j++)for(const [v0,v1,finish] of [[0,.044,material==='paint'?'paint':'satin'],[.044,.918,material],
          [.918,1,rotary&&samples[j-1]>=2&&material==='sideGlass'?'satin':'paint']]){
          b.patch(finish,Math.ceil((samples[j]-samples[j-1])*22),4,(u,v)=>sidePane(k,mix(samples[j-1],samples[j],u),mix(v0,v1,v)),
            out,finish==='paint'?s.paint:finish==='satin'?black:white);
        }
      }
      tube(b,'satin',seq(36,u=>sidePane(k,mix(.10,h.quarter,u),.94)),.007,seal,6);
      tube(b,'satin',seq(23,u=>sidePane(k,mix(.10,h.quarter,u),.043)),.006,seal,6);
      // Door perimeter follows the crown, then turns into the rocker.
      const zA=roof(.24,k)[2],zB=roof(post,k)[2], bottom=h.sill+.108;
      const door=[...seq(8,t=>[mix(zA,zA-.045,t),mix(top(zA,1)[1],bottom+.13,t)]),
        [zA-.022,bottom+.038],[zA+.052,bottom],...seq(10,t=>[mix(zA+.067,zB-.085,t),bottom-.008*Math.sin(t*Math.PI)]),
        [zB-.015,bottom+.034],[zB+.043,bottom+.12],...seq(9,t=>[mix(zB+.05,zB,t),mix(bottom+.14,top(zB,1)[1],t)])];
      const doorCurve=new T.CatmullRomCurve3(door.map(([z,y])=>new T.Vector3(...c.side(k,z,y,.0014))));
      tube(b,'trim',doorCurve.getPoints(54).map(v=>v.toArray()),.0027,0x474843,6);
      for(const end of [zA,zB])tube(b,'trim',seq(9,t=>top(end,k*mix(1,c.belt(end),t),.0013)),.0024,0x474843,6);
      const handleZ=zB-.095,handleY=top(handleZ,1)[1]-.068;
      const P=(z,y,extra)=>c.side(k,z,y,extra);
      if(c.id!=='fd3s')tube(b,'satin',[P(handleZ-.066,handleY,.002),P(handleZ,handleY-.002,.008),P(handleZ+.066,handleY,.003)],.012,black,8);
      if(c.id!=='fd3s')tube(b,'paint',[P(handleZ-.058,handleY+.003,.014),P(handleZ+.052,handleY+.003,.014)],.008,s.paint,8);
      else b.patch('satin',10,4,(u,v)=>{
        const p=sidePane(k,mix(post-.119,post-.022,u),.09+v*.137*(.6+.4*Math.sin(Math.PI*u)));
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
    const hand=c.id==='fc3s'?-1:1;
    rod(b,'satin',wiper(2.96,0,.001),wiper(2.96,0,.017),.016,black,12);
    tube(b,'satin',[wiper(2.96,0,.017),wiper(2.905,.15*hand,.018),wiper(2.886,.36*hand,.017)],.008,0x35393c,7);
    tube(b,'trim',seq(14,t=>wiper(2.903-.045*t,hand*mix(.125,.731,t),.009)),.007,0x222629,7);
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
        add([[-.49,.204],[.49,.204],[.438,.314],[.26,.333],[-.26,.333],[-.438,.314]],'radiator');
        pair([[.595,.343],[.882,.361],[.91,.403],[.662,.410],[.594,.390]],'indicator');
        for(const [y,w] of [[.211,.878],[.272,.907]])pair([[.644,y],[w,y+.006],[w-.015,y+.035],[.628,y+.033]],'duct');
      }else if(id==='fc3s'){
        add([[-.53,.195],[.53,.195],[.59,.325],[-.59,.325]],'radiator');
        pair(rect(.61,.20,.842,.303),'fog');
        pair(rect(.57,.391,.890,.440),'amber');
        pair(rect(.555,.451,.876,.482),'indicator');
        add(rect(-.44,.373,.44,.405),'duct');
      }else if(id==='gc8'){
        add([[-.475,.218],[.475,.218],[.53,.336],[-.53,.336]],'radiator');
        add([[-.300,.500],[.300,.500],[.388,.621],[-.388,.621]],'grille');
        pair([[.376,.509],[.876,.539],[.928,.622],[.831,.646],[.421,.632]],'projector');
        pair(rect(.646,.371,.893,.406),'amber');
        for(const k of [-1,1])add(seq(32,t=>[k*.724+Math.cos(t*tau)*.130,.295+Math.sin(t*tau)*.084]).slice(0,-1),'cover',{radius:0});
      }else{
        add([[-.53,.228],[.53,.228],[.585,.365],[-.585,.365]],'radiator');
        pair(rect(.649,.241,.886,.347),'duct');
        pair(rect(.525,.403,.823,.441),'duct');
        add(rect(-.332,.503,.332,.611),'grille');
        pair([[.350,.505],[.906,.523],[.930,.631],[.802,.642],[.358,.624]],'projector');
      }
    }else{
      if(id==='fd3s'){
        add([[-.958,.545],[-.588,.520],[0,.548],[.588,.520],[.958,.545],[.979,.634],[.862,.690],[.610,.700],[0,.654],[-.610,.700],[-.862,.690],[-.979,.634]],'fd-tail',{radius:.23});
        pair(rect(.695,.397,.869,.431),'reflector');
        add([[-.285,.269],[.285,.269],[.323,.422],[-.323,.422]],'plate');
      }else if(id==='fc3s'){
        pair([[.261,.497],[.897,.506],[.912,.681],[.269,.681]],'fc-tail');
        add(rect(-.246,.489,.246,.671),'plate');
      }else if(id==='gc8'){
        pair([[.329,.568],[.862,.557],[.964,.620],[.946,.759],[.749,.787],[.358,.753]],'gc-tail');
        add([[-.283,.508],[.283,.508],[.302,.708],[-.302,.708]],'plate');
      }else{
        pair([[.281,.526],[.827,.515],[.953,.566],[.949,.730],[.829,.768],[.294,.752]],'r32-tail',{radius:.12});
        add(rect(-.295,.325,.295,.491),'plate');
        pair(rect(.744,.344,.907,.386),'reflector');
      }
    }
    return holes;
  }
  function bounds(poly){
    const xs=poly.map(p=>p[0]),ys=poly.map(p=>p[1]);
    return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  }
  // Sweep the bumper around open lamp buckets and grille cut-outs. Subdivide
  // even the uninterrupted bands so their reflections follow the rounded nose.
  function bumper(b,c,dir){
    const holes=endParts(c.id,dir),{s,h,L}=c, out=[0,0,dir];
    const z=dir*L, topY=x=>c.top(z,x)[1], low=x=>h.sill+.012+.009*(1-x*x);
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
    const {poly,kind}=o,out=[0,0,dir],at=(x,y,d)=>c.face(dir,x,y,d);
    const [x0,y0,x1,y1]=bounds(poly),cx=(x0+x1)/2,cy=(y0+y1)/2,dx=x1-x0,dy=y1-y0;
    const duct=['radiator','duct','grille'].includes(kind),complex=kind.endsWith('-tail')||kind==='projector';
    const depth=duct?.056:kind==='plate'?.032:.014;
    const inner=poly.map(([x,y])=>[mix(cx,x,duct?.926:.972),mix(cy,y,duct?.82:.925)]);
    for(let i=0;i<poly.length;i++){
      const j=(i+1)%poly.length;
      const pt=(p,d)=>at(...p,d);
      b.face(duct||kind==='plate'?'paint':'satin',[pt(poly[i],0),pt(poly[j],0),pt(inner[j],depth),pt(inner[i],depth)],
        [cx-poly[i][0],cy-poly[i][1],dir*.16],duct||kind==='plate'?c.s.paint:black);
    }
    let mat={amber:'amber',reflector:'tail',fog:'head',indicator:'markerLens',cover:'paint',plate:'trim'}[kind]||'satin';
    const col=kind==='cover'?c.s.paint:duct||complex||kind==='plate'?0x26292b:white;
    // Triangulate the curved bucket back, including the FD's concave garnish.
    const tris=T.ShapeUtils.triangulateShape(inner.map(([x,y])=>new T.Vector2(x,y)),[]);
    for(const indices of tris){
      const pp=indices.map(i=>inner[i]);
      b.face(mat,pp.map(([x,y])=>at(x,y,depth)),out,col,pp.map(([x,y])=>[(x-x0)/dx,(y-y0)/dy]));
    }
    function tile(f,x,y,w,h,d,color=white){
      // Small optical elements are inset into the lamp housing. Clamp pieces
      // by their own moulded shapes, retaining the reveal around the cover.
      b.patch(f,8,2,(u,v)=>at(x+(u-.5)*w,y+(v-.5)*h,d),out,color);
    }
    function disc(x,y,rx,ry,material){
      const center=at(x,y,depth-.012);
      for(let j=0;j<32;j++){
        const a=tau*j/32,e=tau*(j+1)/32;
        const p=(angle,t,d)=>at(x+rx*t*Math.cos(angle),y+ry*t*Math.sin(angle),d);
        const uv=angle=>[.5+.5*Math.cos(angle),.5+.5*Math.sin(angle)];
        b.face('satin',[p(a,1.08,depth-.002),p(e,1.08,depth-.002),p(e,1,depth-.006),p(a,1,depth-.006)],out,0x202026);
        b.face(material,[center,p(a,1,depth-.006),p(e,1,depth-.006)],out,white,[[.5,.5],uv(a),uv(e)]);
        if(material==='tail')b.face('satin',[p(a,.83,depth-.012),p(e,.83,depth-.012),p(e,.79,depth-.011),p(a,.79,depth-.011)],out,0xc9574d);
      }
    }
    const mark=(name,x,y,w,h,d)=>b.face('marks',rect(x-w/2,y-h/2,x+w/2,y+h/2).map(([xx,yy])=>at(xx,yy,d)),out,white,
      dir>0?labelUV(name):[1,0,3,2].map(i=>labelUV(name)[i]));
    if(duct){
      const n=kind==='radiator'?6:kind==='grille'?4:2;
      for(let i=0;i<n;i++)tile('metal',cx,mix(y0+dy*.20,y1-dy*.20,(i+.5)/n),dx*.81,kind==='radiator'?.006:.004,depth-.003,kind==='radiator'?0x777b7a:0x484c4f);
      if(kind==='radiator')for(let i=1;i<=12;i++)tile('trim',mix(x0,x1,i/13),cy,.005,dy*.65,depth-.005,0x393d40);
      if(kind==='grille')mark('grille',cx,cy,dx*.23,dy*.54,depth-.019);
    }else if(kind==='plate')mark('plate',cx,cy,Math.min(.330/c.width(dir*c.L),dx*.89),Math.min(.161,dy*.88),depth-.005);
    else if(kind==='fd-tail'){
      for(const k of [-1,1]){
        disc(k*.770,.614,.080,.055,'tail');disc(k*.579,.611,.076,.050,'tail');
        tile('amber',k*.903,.600,.046,.036,depth-.006);tile('reverseLens',k*.426,.593,.067,.030,depth-.006);
      }
      mark('name',0,.598,.21,.036,depth-.010);
    }else if(kind==='r32-tail'){
      for(const [x,r] of [[.456,.091],[.759,.104]])disc(Math.sign(cx)*x,cy,r,r*.78,'tail');
      tile('reverseLens',Math.sign(cx)*.626,cy-.072,.063,.026,depth-.004);
    }else if(kind==='gc-tail'||kind==='fc-tail'){
      const gc=kind==='gc-tail',k=Math.sign(cx);
      const center=gc?k*.635:k*.576, span=dx*(gc?.78:.89);
      tile('tail',center,cy-dy*.19,span,dy*.43,depth-.004);
      tile('tail',center+k*span*.07,cy+dy*.22,span*.66,dy*.29,depth-.005);
      tile(gc?'reverseLens':'amber',center+k*span*.394,cy+dy*.22,span*.17,dy*.30,depth-.006);
      tile('reverseLens',center-k*span*.371,cy+dy*.19,span*.18,dy*.30,depth-.006);
      for(const t of [-.31,0,.31])tile('satin',center+t*span,cy-dy*.19,.007,dy*.41,depth-.009,0x5b2e31);
    }else if(kind==='projector'){
      const k=Math.sign(cx),impreza=c.id==='gc8';
      tile('metal',cx-k*dx*.062,cy,dx*.74,dy*.76,depth-.003,0x858b89);
      // Two independently pressed reflector bowls behind a common fluted lens.
      for(const offset of [-.219,.090]){
        const x=cx+k*dx*offset,rx=dx*(impreza?.161:.142),ry=dy*.337;
        for(let i=0;i<22;i++){
          const a=tau*i/22,e=tau*(i+1)/22;
          const point=(theta,r,d)=>at(x+rx*r*Math.cos(theta),cy+ry*r*Math.sin(theta),d);
          const reflect=[0xc0c5ba,0xa0a396,0xe4e2cf,0xaeb5b3,0x909694][i%5];
          b.face('metal',[point(a,1,depth-.007),point(e,1,depth-.007),point(e,.49,depth+.002),point(a,.49,depth+.002)],out,reflect);
        }
        disc(x,cy,rx*(impreza?.49:.75),ry*(impreza?.50:.77),'head');
      }
      tile('amber',cx+k*dx*.378,cy+.009,dx*.140,dy*.60,depth-.006);
    }else if(kind==='cover'){
      tube(b,'satin',seq(34,t=>at(cx+dx*.449*Math.cos(t*tau),cy+dy*.443*Math.sin(t*tau),depth-.003)),.0025,0x425372,5);
    }
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
      const raisedFace=(u,t)=>{
        const p=enclosure(u,0);p[1]=sill+.018+t*.132+.009*(u-.5);return p;
      };
      const elevated=(u,v)=>{const p=enclosure(u,v,.009);p[1]+=Math.max(0,raisedFace(u,1)[1]-enclosure(u,0,.009)[1])*(1-v);return p;};
      raised.patch('paint',10,7,elevated,up,s.paint);
      for(const u of [0,1])raised.patch('satin',7,3,(v,t)=>between(enclosure(u,v,.005),elevated(u,v),t),[k*(u?1:-1),0,0],black);
      raised.patch('satin',9,5,raisedFace,[0,0,-1],black);
      const optic=(u,t,depth)=>{
        const p=raisedFace(.066+.868*u,.064+.86*t);p[2]-=depth;return p;
      };
      const lensRim=rounded(rect(0,0,1,1),.21);
      const lensPoint=([u,v],scale,depth)=>optic(.5+(u-.5)*scale,.5+(v-.5)*scale,depth);
      for(let j=0;j<lensRim.length;j++){
        const a=lensRim[j],e=lensRim[(j+1)%lensRim.length];
        raised.face('metal',[lensPoint(a,1,.003),lensPoint(e,1,.003),lensPoint(e,.91,.007),lensPoint(a,.91,.007)],[0,0,-1],0x999995);
        raised.face('head',[optic(.5,.5,.013),lensPoint(a,.91,.007),lensPoint(e,.91,.007)],[0,0,-1],white,[[.5,.5],a,e]);
      }
    }
    if(id==='fc3s'||id==='gc8'){
      // The leading edge of the raised inlet is open. Its upper skin tapers
      // to the bonnet; the two Subaru extraction slots sit to either side.
      const sub=id==='gc8',z0=sub?-1.276:-1.445,z1=sub?-.968:-1.113,hw=sub?.265:.205,off=sub?0:-.042;
      function inlet(u,v){
        const z=mix(z0,z1,v),x=off+(u*2-1)*hw*(1-.22*v),p=top(z,x/c.width(z));
        p[1]+=(sub?.082:.054)*(1-v)**.74*(.82+.18*Math.sin(Math.PI*u))+.002;return p;
      }
      b.patch('paint',14,9,inlet,up,s.paint);
      const lower=u=>{const p=inlet(u,0);p[1]=top(p[2],p[0]/c.width(p[2]))[1]+.002;return p;};
      b.patch('satin',13,3,(u,t)=>between(lower(u),inlet(u,0),t),[0,0,-1],0x202326);
      for(const k of [0,1])b.patch('paint',8,3,(v,t)=>{
        const p=inlet(k,v),low=top(p[2],p[0]/c.width(p[2]));return between(low,p,t);
      },[k?1:-1,0,0],s.paint);
      if(sub)for(const k of [-1,1])for(let i=0;i<3;i++)b.patch('satin',5,3,(u,v)=>top(-1.25+i*.056+.029*v,k*(.47+.20*u),.004),up,0x292e34);
    }
    if(id==='fd3s'||id==='fc3s'){
      for(const k of [-1,1]){
        for(const [label,z,y,w,d] of [['team',1.24,id==='fd3s'?.735:.736,.307,.066],['sponsor',-.76,.510,.171,.081]]){
          const [x0,y0,ww,hh]=labels[label];
          b.patch('marks',12,4,(u,v)=>side(k,z+k*(.5-u)*w,y+(v-.5)*d,.0024),[k,0,0],white,
            (u,v)=>[(x0+ww*u)/1024,1-(y0+(1-v)*hh)/512]);
        }
        const vents=id==='fd3s'?1:3;
        for(let i=0;i<vents;i++)path('satin',seq(6,t=>side(k,mix(-.881,-.777,t),.386+i*.027+t*(id==='fd3s'?.12:.014),.004)),id==='fd3s'?.009:.004,black);
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
      const direction=id==='fd3s'?'amber':'markerLens',markerZ=s.frontZ-.428,markerY=id==='fd3s'?.403:.507;
      b.patch(direction,8,4,(u,v)=>side(k,markerZ+(u-.5)*.080,markerY+(v-.5)*.021*(.45+.55*Math.sin(Math.PI*u)),.003),outward,0xe0a561);
      if(id==='gc8'||id==='bnr32'){
        const rz=L-.12;
        b.patch('tail',15,4,(u,v)=>side(k,rz-.20*u,.626+.050*v+.035*(1-u),.0025),
          outward,0xaa5051);
      }
    }
    // An airfoil with thickness, camber and end plates. Profiles and mount
    // spacing follow the specific manga-era aero, including the tall FD kit.
    const [station,wingY,span,chord,mount]=h.wing,zWing=station*L-(id==='fd3s'?.067:.042);
    const high=id==='fd3s'?.10:0;
    const aero=(q,v,lower=false)=>{
      const n=Math.abs(q),z=zWing+(v-.5)*chord-.065*n**2;
      return [q*span,wingY+high+.012*n*n+.024*v+.014*Math.sin(Math.PI*v)-(lower?.012+.014*Math.sin(Math.PI*v):0),z];
    };
    b.patch('paint',26,7,(u,v)=>aero(2*u-1,v),up,s.paint);
    b.patch('paint',26,7,(u,v)=>aero(2*u-1,v,true),[0,-1,0],s.paint);
    for(const v of [0,1])b.patch('paint',26,2,(u,t)=>between(aero(2*u-1,v,true),aero(2*u-1,v),t),[0,0,v?1:-1],s.paint);
    for(const k of [-1,1]){
      const tall=id==='fd3s'||id==='gc8',tip=tall?span-.044:mount+.011;
      // Each standard is a tapered airfoil. The broad moulded foot conforms
      // to the deck and narrows steadily into the underside of the blade.
      b.patch('paint',26,13,(u,v)=>{
        const a=u*tau,n=Math.cos(a),flare=(1-v)**4;
        const x=k*(mix(mount,tip,v)+(.021+.030*flare)*Math.sin(a)*(.86+.14*n));
        const rawZ=Math.min(L-.012,station*L-.025+.116*n);
        const deck=top(rawZ,clamp(x/top(rawZ,1)[0],-1,1));
        const blade=aero(k*tip/span,.5+.40*n,true);
        return [x,mix(deck[1]-.009,blade[1]+.005,v),mix(deck[2],blade[2],v)];
      },u=>[k*Math.sin(tau*u),0,Math.cos(tau*u)],s.paint);
      b.face('paint',[aero(k,0),aero(k,1),aero(k,1,true),aero(k,0,true)],[k,0,0],s.paint);
    }
    const dir=1,out=[0,0,1], badge=(label,x,y,w,d)=>{
      b.face('marks',rect(x-w/2,y-d/2,x+w/2,y+d/2).map(([xx,yy])=>c.face(dir,xx,yy,-.003)),out,white,labelUV(label));
    };
    if(id!=='fd3s')badge('name',0,id==='fc3s'?.714:.784,.25,.032);
    badge('grade',id==='fc3s'?-.59:.40,id==='fc3s'?.720:id==='fd3s'?.473:.485,.194,.028);
    // A rolled stainless lip, recessed black bore and separate rear canister.
    const tip=[h.tip,h.sill+.044,L-.012],r=id==='gc8'?.043:.052;
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
    ring([[half*.90,rim+.004],[half*.965,rim+.002],[half*.989,rim-.004],[half*.954,rim-.011],
      [half*.61,rim-.018],[-half*.78,rim-.020]],'rim',alloy);
    ring([[-half*.64,rim-.022],[half*.41,rim-.020]],'rim',0x46484c);
    const rotor=rim*.776;
    ring([[half*.25,rotor],[half*.31,rotor],[half*.31,rotor*.54],[half*.38,rotor*.48]],'metal',0x77766f);
    for(const track of [.65,.79,.92])ring([[half*.322,rotor*track],[half*.322,rotor*(track-.010)]],'metal',0x5d5c57);
    const cap= id==='gc8'?.046:.053;
    rod(b,'rim',[half*.36,0,0],[half*.69,0,0],rim*.393,alloy,32,rim*.376);
    // For the FC, broad scalloped spoke roots leave five oval apertures and
    // expose the polished two-piece lip. The STi and Nissans use cast arms.
    const widths=id==='fc3s'?[.65,.34,.36]:id==='gc8'?[.50,.205,.23]:id==='fd3s'?[.49,.22,.26]:[.53,.25,.27];
    for(let i=0;i<spokes;i++){
      const a=tau*i/spokes+.13,rr=[rim*.28,rim*.61,rim*.94],depth=[half*.64,half*.785,half*.58];
      const edge=(j,k,back=false)=>radial(depth[j]-(back?.021:0),rr[j],a+k*widths[j]+(id==='fd3s'?.06*j:0));
      for(let j=0;j<2;j++){
        b.patch('rim',7,7,(u,v)=>{
          const r=mix(rr[j],rr[j+1],v),angle=a+(u*2-1)*mix(widths[j],widths[j+1],v)+(id==='fd3s'?.056*(j+v):0);
          const fillet=.007*Math.sin(Math.PI*u)**.55+.003*Math.sin(Math.PI*v);
          return radial(mix(depth[j],depth[j+1],v)+fillet,r,angle);
        },[1,0,0],alloy);
        for(const k of [-1,1])b.face('rim',[edge(j,k),edge(j+1,k),edge(j+1,k,true),edge(j,k,true)],
          [0,-k*Math.sin(a),k*Math.cos(a)],new T.Color(alloy).multiplyScalar(.64).getHex());
      }
      if(id==='fc3s')for(let j=0;j<4;j++){
        const theta=a+tau*j/(spokes*4),p=radial(half*.90,rim*.918,theta);
        rod(b,'metal',p,[p[0]+.003,p[1],p[2]],.0038,0x9d9f9e,6);
      }
    }
    const lugs=5;
    for(let i=0;i<lugs;i++){
      const a=tau*(i+.48)/lugs,py=Math.cos(a)*.051,pz=Math.sin(a)*.051;
      rod(b,'satin',[half*.68,py,pz],[half*.72,py,pz],.010,0x2a2c2d,10);
      rod(b,'metal',[half*.719,py,pz],[half*.762,py,pz],.0075,0xa2a29b,6);
    }
    rod(b,'rim',[half*.68,0,0],[half*.805,0,0],cap*.68,alloy,24,cap*.60);
    rod(b,'satin',[half*.802,0,0],[half*.828,0,0],cap*.49,id==='gc8'?0x674333:0x34383a,16);
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
    const {s,h}=c,seatX=.345,shift=s.height-1.34,accent=c.id==='gc8'?0x6b4042:0x494c50;
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
      shell(x,.14,[[.405,.16,.053,.07],[.49,.208,.077,.061],[.76,.207,.066,.128],[.929,.165,.058,.163],[.954,.118,.048,.168],[.958,.003,.003,.169]],'cloth',accent);
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
