/* Sculpted GR86 coupe and NEO86 wide-body panels. All dimensions are in metres. */
(() => {
  'use strict';
  const N = window.TougeNeo86;
  const mix = (a,b,t) => a+(b-a)*t;
  const clamp = (x,lo=0,hi=1) => Math.max(lo,Math.min(hi,x));
  const smooth = (a,b,x) => {const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
  const bell = v => Math.exp(-v*v);
  const pi = Math.PI, up=[0,1,0], down=[0,-1,0], forward=[0,0,-1], back=[0,0,1];
  const {pandaTrim}=N;
  const white=0xeceeea, flare=0x191b1e, weatherstrip=0x161a1d;
  const frontAxle=-1.320, rearAxle=1.255, radius=.316, frontCab=-.790, backCab=1.635;

  // Shape-preserving tangents keep highlights continuous across the roof stations.
  function curve(rows) {
    const slope=rows.map((p,i)=>i ? (p[1]-rows[i-1][1])/(p[0]-rows[i-1][0]):0);
    const tangents=rows.map((_,i)=>{
      if (!i) return slope[1];
      if (i===rows.length-1) return slope[i];
      const a=slope[i],b=slope[i+1];
      return a*b>0 ? 2*a*b/(a+b) : 0;
    });
    return z=>{
      if (z<=rows[0][0]) return rows[0][1];
      for(let i=1;i<rows.length;i++){
        const [x,y]=rows[i];
        if (z>x) continue;
        const [prev,v]=rows[i-1],d=x-prev,t=(z-prev)/d,t2=t*t,t3=t2*t;
        return (2*t3-3*t2+1)*v+(t3-2*t2+t)*d*tangents[i-1]+(3*t2-2*t3)*y+(t3-t2)*d*tangents[i];
      }
      return rows[rows.length-1][1];
    };
  }
  const roofSide=curve([[-.79,.756],[-.72,.791],[-.48,.954],[-.26,1.095],[-.075,1.181],[.08,1.226],
    [.29,1.249],[.46,1.245],[.65,1.223],[.84,1.169],[1.04,1.094],[1.25,.996],[1.42,.916],[1.514,.871]]);
  const roofWidth=curve([[-.79,.799],[-.62,.773],[-.27,.693],[0,.639],[.30,.617],
    [.61,.622],[.88,.651],[1.15,.707],[1.35,.760],[1.51,.801],[backCab,.824]]);
  const roofCrown=curve([[-.79,.027],[-.48,.048],[-.12,.053],[.26,.048],[.58,.050],
    [.86,.057],[1.17,.041],[1.38,.022],[1.514,.010]]);
  const glassBow=curve([[-.79,-.038],[-.61,-.077],[-.19,-.090],[.05,-.060],
    [.31,0],[.67,.040],[1.04,.060],[1.23,.048],[1.39,.028],[1.55,.011],[backCab,0]]);
  // The fixed quarter light stays nearly level along the belt, then turns
  // up in a short radius to meet the descending roof rail ahead of the axle.
  const sideGlassStart=-.633,sideGlassEnd=.969;
  const sillGlass=curve([[sideGlassStart,.833],[-.54,.829],[-.23,.838],[.13,.849],[.46,.864],
    [.65,.874],[.77,.881],[.836,.892],[.893,.913],[.936,.947],[.959,.975],[sideGlassEnd,1.001]]);
  const headGlass=curve([[sideGlassStart,.833],[-.54,.884],[-.34,1.018],[-.10,1.134],[.13,1.187],
    [.36,1.195],[.55,1.177],[.71,1.138],[.855,1.076],[.932,1.035],[.960,1.016],[sideGlassEnd,1.001]]);
  const archSpec=z=>({z,r:z<0?.357:.352,h:z<0?.352:.351,top:z<0?.082:.093});
  const arches=[archSpec(frontAxle),archSpec(rearAxle)];
  const floorY=.146;
  const glassHeader=a=>.810+.049*a*a;
  // The mounted pane sweeps aft at the center. Its broad lower span meets
  // the deck at nearly one height before turning up into the short corners.
  const glassSill=a=>{
    const r=a*a,center=Math.max(0,1-r/.54);
    return 1.552-r*(.090+.024*r)+.024*center*center;
  };
  const glassRow=v=>.42*v+.58*v*v*(3-2*v);
  const glassStation=(a,t)=>mix(glassHeader(a),glassSill(a),t);
  const sailStations=[sideGlassEnd];
  for(let i=1;i<=50;i++){
    const z=glassStation(1,glassRow(i/50));
    if(z>sideGlassEnd)sailStations.push(z);
  }
  for(let i=1;i<=7;i++)sailStations.push(mix(glassSill(1),backCab,i/7));
  const sideCount=(from,to)=>from===sideGlassEnd&&to===backCab?sailStations.length-1:Math.max(3,Math.ceil((to-from)/.020));
  const sideStation=(from,to,u)=>{
    if(from===sideGlassEnd&&to===backCab)return sailStations[Math.round(u*(sailStations.length-1))];
    return mix(from,to,to===sideGlassEnd?1-(1-u)**1.36:u);
  };
  const bootCrown=curve([[.82,0],[1.08,.014],[1.29,.052],[1.405,.063],
    [1.49,.059],[1.60,.041],[1.71,.012],[1.78,0]]);
  const sailCrown=curve([[.83,0],[1.10,.015],[1.31,.067],[1.46,.105],
    [1.55,.129],[1.60,.132],[1.67,.122],[1.76,.084],[1.86,.025],[1.96,0]]);

  function cutHeight(z) {
    for (const arch of arches) {
      const d=Math.abs(z-arch.z),opening=arch.r+.016;
      // The white shell stops inside the black trim. This overlap keeps the
      // discretised sheet-metal cut from peeking out behind the curved lip.
      if(d<=opening) return radius+(arch.h+.018)*Math.sqrt(Math.max(0,1-(d/opening)**2));
      if(d<opening+.024) return mix(radius,floorY,(d-opening)/.024);
    }
    return floorY;
  }

  function coachwork(api) {
    const {profile}=api;
    const extent=(z,from,to,fade)=>smooth(from,from+fade,z)*(1-smooth(to-fade,to,z));
    const shoulderRound=z=>extent(z,profile.frontZ,profile.rearZ,.205);
    const rollWidth=z=>shoulderRound(z)*(.047+.012*bell((z-rearAxle)/.49));
    const rollHeight=z=>shoulderRound(z)*(.048+.012*bell((z-frontAxle)/.42));
    const outerU=z=>1-rollWidth(z)/profile.halfWidth(z);
    function outer(s,z,y,offset=0) {
      const p=profile.sideAt(s,z,y,offset), shoulder=profile.shoulderY(z);
      const taper=extent(z,profile.frontZ,profile.rearZ,.23)*smooth(.37,.48,y)*(1-smooth(shoulder-.050,shoulder,y));
      const door=extent(z,-.99,.93,.27);
      const shoulderBlade=.022*bell((y-(.666+.030*Math.sin((z+.38)*2)))/.093);
      const pinch=-.035*door*bell((y-(.565+.040*z))/.085);
      p[0]+=s*taper*(shoulderBlade+pinch);
      // The combination lamp wraps into a shallow seat behind the rear wheel.
      p[0]-=s*.010*smooth(1.845,1.910,z)*smooth(.626,.681,y)*(1-smooth(.820,.855,y));
      const ry=rollHeight(z);
      if(ry>.00001 && y>shoulder-ry){
        const h=clamp((y-shoulder+ry)/ry);
        p[0]-=s*rollWidth(z)*(1-Math.sqrt(Math.max(0,1-h*h)));
        p[1]+=(deck(z,s*outerU(z))[1]-shoulder)*h*h;
      }
      return p;
    }
    function deck(z,u) {
      const p=profile.deckAt(z,u),a=Math.abs(u);
      const f=extent(z,profile.frontZ,frontCab,.16),quarter=extent(z,.67,profile.rearZ,.24);
      const inner=mix(.61,.72,smooth(-1.88,-.85,z));
      const hoodCrest=.012*bell((a-inner)/.067)+.021*bell((a-.875)/.115)-.005*bell((a-.52)/.13);
      const haunch=.014*bell((a-.87)/.103);
      // The rear wing rolls up just outside the trunk shutline. A shallow
      // pressed channel separates its highlight from the flatter boot lid.
      const crest=mix(.800,.916,smooth(1.13,1.89,z));
      const stamp=extent(z,1.075,1.940,.20)*(.009*bell((a-crest)/.094)-.0016*bell((a-crest+.075)/.047));
      p[1]+=(hoodCrest*f+haunch*quarter+stamp)*(1-smooth(.925,1,a))+bootCrown(z)*(1-.42*a**4)
        +sailCrown(z)*(1-.92*smooth(.54,1.02,a));
      return p;
    }
    const footU=z=>.93-.018*bell((z+.45)/.42)-.012*bell((z-1.30)/.29);
    const foot=(s,z)=>deck(z,s*footU(z));
    const widthAt=z=>z<1.46?roofWidth(z):mix(roofWidth(z),profile.halfWidth(z)*footU(z),smooth(1.46,backCab,z));
    const roofAt=(z,a)=>{
      const rail=extent(z,-.08,.72,.16);
      return roofSide(z)+roofCrown(z)*(1-a*a)
        +rail*(.007*bell((a-.62)/.20)-.004*bell(a/.26)-.002*bell((a-.916)/.023))
        -.0131*smooth(-.22,.12,z);
    };
    const rearZ=(z,a)=>z+glassBow(z)*(1-a*a);
    const blendStart=.525;
    // In the ZN8 side elevation the rear glass falls in one shallow sweep.
    // A second tangent-matched span turns its painted reveal onto the trunk.
    const curves=new Map();
    const hermite=(t,y0,y1,m0,m1)=>{
      const t2=t*t,t3=t2*t;
      return (2*t3-3*t2+1)*y0+(t3-2*t2+t)*m0+(-2*t3+3*t2)*y1+(t3-t2)*m1;
    };
    function backGlassHeight(z,a,x,physical) {
      let rail=curves.get(a);
      if(!rail){
        const start=rearZ(blendStart,a),cut=rearZ(glassSill(a),a),span=cut-start;
        const sill=1.039-.010*a*a-.035*smooth(.818,1,a);
        const slope=-.310+.028*a*a;
        rail={start,span,y0:roofAt(blendStart,a),y1:sill,
          m0:span*(roofAt(blendStart+.001,a)-roofAt(blendStart-.001,a))/
            (rearZ(blendStart+.001,a)-rearZ(blendStart-.001,a)),m1:span*slope};
        const tailX=a*widthAt(backCab),cap=at=>deck(at,tailX/profile.halfWidth(at))[1],reach=backCab-cut;
        rail.reveal={cut,reach,y0:sill,y1:cap(backCab),
          m0:slope*reach,m1:reach*(cap(backCab+.001)-cap(backCab-.001))/.002};
        curves.set(a,rail);
      }
      if(z>=backCab)return deck(physical,x/profile.halfWidth(physical))[1];
      const r=rail.reveal;
      if(physical>r.cut)return hermite(clamp((physical-r.cut)/r.reach),r.y0,r.y1,r.m0,r.m1);
      return hermite(clamp((physical-rail.start)/rail.span),rail.y0,rail.y1,rail.m0,rail.m1);
    }
    function rawCanopy(z,u) {
      const a=Math.abs(u),frontBlend=smooth(frontCab,frontCab+.105,z),edge=deck(z,u*footU(z));
      const x=mix(edge[0],u*widthAt(z),frontBlend);
      const physical=z+frontBlend*glassBow(z)*(1-a*a);
      if(z>=blendStart)return [x,backGlassHeight(z,a,x,physical),physical];
      let y=roofAt(z,a);
      if(z<frontCab+.17){
        const difference=deck(frontCab,u*footU(frontCab))[1]-roofAt(frontCab,a);
        y+=difference*(1-smooth(frontCab,frontCab+.17,z));
      }
      return [x,Math.max(edge[1],y),physical];
    }
    function sidePoint(s,z,v,base,rail){
      const arc=Math.sin(pi*v),height=rail[1]-base[1];
      const crown=(.012+.012*extent(z,.72,1.485,.19)*arc)*arc*smooth(0,.11,height);
      return [mix(base[0],rail[0],v)+s*crown,mix(base[1],rail[1],v),mix(base[2],rail[2],v)];
    }
    // The pressed C-pillar rolls through the roof edge. Both adjoining skins
    // sample the same quadratic section, including the tangent at its middle.
    const rollAt=z=>extent(z,.39,backCab,.22);
    function sail(s,z,t,roll,base,rail){
      const inner=rawCanopy(z,s*(1-.119*roll));
      const outer=sidePoint(s,z,1-.20*roll,base,rail),u=1-t;
      return inner.map((p,i)=>u*u*p+2*u*t*rail[i]+t*t*outer[i]);
    }
    function canopy(z,u){
      const a=Math.abs(u),roll=rollAt(z);
      if(!roll||a<=1-.119*roll)return rawCanopy(z,u);
      const s=Math.sign(u),t=.5*(1-(1-a)/(.119*roll));
      return sail(s,z,t,roll,foot(s,z),rawCanopy(z,s));
    }
    function cabinSide(s,z,v,recess=0) {
      const base=foot(s,z),rail=rawCanopy(z,s),roll=rollAt(z);
      const p=roll&&v>1-.20*roll?sail(s,z,.5+.5*(1-v)/(.20*roll),roll,base,rail)
        :sidePoint(s,z,v,base,rail);
      p[0]-=s*recess;
      return p;
    }
    return {outer,deck,outerU,foot,footU,widthAt,canopy,cabinSide};
  }

  function sheetMetal(api,body) {
    const {b,profile,tube}=api,{outer,deck,outerU,footU}=body;
    const zBreaks=[profile.frontZ,profile.rearZ];
    for (const a of arches){
      const cut=a.r+.016;
      zBreaks.push(a.z-cut-.024,a.z-cut,a.z,a.z+cut,a.z+cut+.024);
    }
    zBreaks.sort((a,c)=>a-c);
    const bands=[
      [floorY,.162,'trim',0x22252a],[.162,pandaTrim.valanceTop,'paint',pandaTrim.black],
      [pandaTrim.valanceTop,pandaTrim.beltBottom,'paint',white],
      [pandaTrim.beltBottom,pandaTrim.beltTop,'paint',pandaTrim.belt],
      [pandaTrim.beltTop,.603,'paint',white],[.603,'lip','paint',white],['lip','deck','paint',white]
    ];
    for(const s of [-1,1]){
      for(let i=1;i<zBreaks.length;i++){
        const a=zBreaks[i-1],c=zBreaks[i],length=c-a;
        const nu=Math.max(2,Math.ceil(length/.029));
        for(const [lower,upper,baseFinish,baseColor] of bands){
          const frontApron=c<=frontAxle&&upper===pandaTrim.valanceTop;
          const finish=frontApron?'satin':baseFinish;
          const color=frontApron?0x24272a:baseColor;
          const boundary=(key,z)=>{
            if(key==='deck')return profile.shoulderY(z);
            if(key==='lip')return Math.max(.604,profile.shoulderY(z)-.047);
            return Math.min(profile.shoulderY(z),key);
          };
          b.patch(finish,nu,upper==='deck'?13:upper==='lip'?7:4,(u,v)=>{
            const z=mix(a,c,u),cut=cutHeight(z);
            const lo=Math.max(cut,boundary(lower,z)),hi=Math.max(lo,boundary(upper,z));
            return outer(s,z,mix(lo,hi,upper==='deck'?Math.sin(v*pi*.5):v));
          },[s,0,0],color);
        }
      }
      // Match the side shell at the door belt and along the entire C-pillar.
      for(const [from,to] of [[frontCab,sideGlassStart],[sideGlassStart,sideGlassEnd],[sideGlassEnd,backCab]]){
        b.patch('paint',sideCount(from,to),5,(u,v)=>{
          const z=sideStation(from,to,u);return deck(z,s*mix(footU(z),outerU(z),v));
        },up,white);
      }
    }
    const bonnets=(z,u)=>deck(z,(u*2-1)*outerU(z));
    b.patch('paint',36,38,(u,v)=>bonnets(mix(profile.frontZ,frontCab,v),u),up,white);
    // The fascia continues this same deck from the backlight through the ducktail.
    api.rearDeck={start:backCab,deck,footU,outerU};
    const seam=(s,z)=>{
      const frac=mix(.59,.758,smooth(profile.frontZ,frontCab,z));
      const p=deck(z,s*frac);p[1]+=.0014;return p;
    };
    for(const s of [-1,1]){
      const points=[];
      for(let i=0;i<=28;i++)points.push(seam(s,mix(profile.frontZ+.012,frontCab+.002,i/28)));
      tube(b,'rubber',points,.0027,0x323735,6);
    }
    const aftEdge=[];
    for(let i=0;i<=32;i++){const p=deck(frontCab-.003,mix(-.752,.752,i/32));p[1]+=.001;aftEdge.push(p);}
    tube(b,'rubber',aftEdge,.0026,0x2b322e,6);
    b.patch('interior',5,12,(u,v)=>[mix(-.66,.66,u),.153,mix(profile.frontZ+.04,profile.rearZ-.05,v)],down,0x222522);
  }

  function wheelArch(api,body,s,arch) {
    const {b,profile}=api,{outer}=body;
    const arcPoint=(u,radial)=>{
      const angle=u*pi,cs=Math.cos(angle),sn=Math.sin(angle);
      const a=arch.r+radial*.100,z=arch.z+a*cs;
      const y=Math.min(profile.shoulderY(z)-.009,radius+sn*(arch.h+radial*arch.top));
      const base=outer(s,z,y);
      // Rolled lip, near-vertical outer crown, then a shallow return against the wing.
      const bulge=(arch.z<0?.084:.092)*(1-.98*smooth(0,1,radial));
      const edge=.002+.008*bell((radial-.13)/.23);
      return [base[0]+s*(bulge+edge),y,z];
    };
    const outward=(u)=>[s,.35*Math.sin(u*pi),.28*Math.cos(u*pi)];
    b.patch('flareGloss',64,9,(u,v)=>arcPoint(u,v),outward,flare);
    function lip(u,v) {
      const angle=u*pi,p=arcPoint(u,0);
      const inward=.011*v;p[0]-=s*inward;p[1]-=.0035*v*Math.sin(angle);p[2]-=.0035*v*Math.cos(angle);
      return p;
    }
    b.patch('flareGloss',58,2,lip,(u)=>[s*.3,-Math.sin(pi*u),-Math.cos(pi*u)],0x202225);
    const joint=[];
    for(let i=0;i<=13;i++){
      const t=i/13,u=arch.z<0?.775+.021*t:.246-.020*t;
      const p=arcPoint(u,t);p[0]+=s*.0008;joint.push(p);
    }
    api.tube(b,'rubber',joint,.0012,0x1b1d1c,6);
    b.patch('rubber',42,4,(u,v)=>{
      const angle=pi*u,p=lip(u,1);p[0]=mix(p[0],s*.670,v);
      p[1]+=.007*Math.sin(pi*v)*Math.sin(angle);p[2]+=.007*Math.sin(pi*v)*Math.cos(angle);
      return p;
    },(u)=>[0,-Math.sin(pi*u),-Math.cos(pi*u)],0x26292b);
    b.patch('interior',38,2,(u,v)=>{
      const t=pi*u;return [s*.669,radius+arch.h*v*Math.sin(t),arch.z+arch.r*v*Math.cos(t)];
    },[s,0,0],0x25282a);
    for(const end of [0,1]){
      const dir=end? -1:1;
      const bumperEnd=arch.z<0?dir<0:dir>0;
      const leg=(radial,height)=>{
        const top=arcPoint(end,radial),ease=smooth(0,.99,height);
        const z0=arch.z+dir*(arch.r+.025+(bumperEnd?.046:.086)*radial);
        const y0=bumperEnd?.147+.035*radial:.126+.051*radial;
        const z=mix(z0,top[2],height),y=mix(y0,radius,height);
        const base=outer(s,z,y),rise=s*(top[0]-outer(s,top[2],radius)[0]);
        // Front and tail ends feather into the bumper. The two inside ends
        // turn inward onto the skirt flange as the tyre opening reaches the sill.
        const toe=(bumperEnd?.018:.057)*(1-smooth(0,1,radial))+.002;
        base[0]+=s*mix(toe,rise,ease);
        return base;
      };
      b.patch('flareGloss',12,10,leg,[s,0,0],flare);
      b.patch('rubber',6,9,(u,v)=>{
        const p=leg(0,v);p[0]=mix(p[0],s*.670,u);return p;
      },[0,0,-dir],0x222428);
      b.patch('flareGloss',9,3,(u,v)=>{
        const p=leg(u,0);p[0]-=s*.027*v;p[1]-=.003*Math.sin(pi*v);return p;
      },down,0x24292e);
    }
  }

  function sideFurniture(api,body) {
    const {b,tube,atlasUV,profile}=api,{outer,deck,outerU,footU,foot,cabinSide}=body;
    function stickerUV(value,u,v) {
      return [mix(mix(value[0][0],value[1][0],u),mix(value[3][0],value[2][0],u),v),
        mix(mix(value[0][1],value[1][1],u),mix(value[3][1],value[2][1],u),v)];
    }
    for(const s of [-1,1]){
      for(const arch of arches)wheelArch(api,body,s,arch);
      const skirt=(z,k)=>{
        const ends=smooth(.40,.95,Math.abs(z)),sx=Math.abs(outer(s,z,.18)[0]);
        const ys=[.239+ends*.049,.191+ends*.016,.153,.138,.113,.119];
        // Fit the top flange to the actual quarter skin at its rising height.
        // The lower extrusion is referenced to the straight rocker underneath.
        const mount=Math.abs(outer(s,z,ys[0])[0])+.0012;
        const xs=[mount,sx+.018,sx+.034+ends*.017,sx+.057+ends*.035,sx+.055+ends*.034,sx-.031];
        return [s*xs[k],ys[k],z];
      };
      const from=frontAxle+arches[0].r+.019,to=rearAxle-arches[1].r-.019;
      for(let k=0;k<5;k++){
        b.patch(k<4?'flareGloss':'trim',31,2,(u,v)=>{
          const z=mix(from,to,u),a=skirt(z,k),c=skirt(z,k+1);
          return a.map((x,i)=>mix(x,c[i],v));
        },k===4?down:[s,k<3?.45:0,0],k===4?0x202328:0x272b32);
      }
      b.face('flareGloss',Array.from({length:6},(_,i)=>skirt(from,i)),forward,0x25272a);
      b.face('flareGloss',Array.from({length:6},(_,i)=>skirt(to,i)),back,0x25272a);
      const rockerInk=atlasUV('rockerBadge');
      b.patch('marks',8,3,(u,v)=>{
        const z=mix(.536,.702,s>0?1-u:u),a=skirt(z,0),c=skirt(z,1);
        const p=a.map((x,i)=>mix(x,c[i],mix(.83,.17,v)));p[0]+=s*.0013;p[1]+=.0005;
        return p;
      },[s,.18,0],0xffffff,(u,v)=>stickerUV(rockerInk,u,v));
      // Follow the stamped skin at each height. A straight chord through a
      // concave panel would bury portions of the door shutline in the paint.
      const path=[];
      const ledge=(z,t)=>{const p=deck(z,s*mix(footU(z),outerU(z),t));p[1]+=.0011;return p;};
      for(let i=0;i<=7;i++)path.push(ledge(-.68,i/7));
      const outline=[[-.680,profile.shoulderY(-.68)],[-.691,.660],[-.689,.419],[-.673,.283],[-.648,.239],[-.618,.218],[-.56,.205],
        [.41,.205],[.465,.216],[.502,.245],[.540,.311],[.579,.437],[.598,.587],[.600,.720],[.590,profile.shoulderY(.590)]];
      for(let i=1;i<outline.length;i++){
        const [za,ya]=outline[i-1],[zb,yb]=outline[i],shoulder=i===outline.length-1;
        const n=shoulder?18:Math.max(2,Math.ceil(Math.hypot(zb-za,yb-ya)/.024));
        for(let j=1;j<=n;j++){
          const t=shoulder?1-(1-j/n)**2:j/n,p=outer(s,mix(za,zb,t),mix(ya,yb,t),.0026);
          if(shoulder)p[1]+=.0012*t;
          path.push(p);
        }
      }
      for(let i=0;i<=7;i++)path.push(ledge(.590,1-i/7));
      // The back edge of the door crosses the painted belt up to the fixed glass.
      for(let i=1;i<=8;i++){
        const v=i/8,z=mix(.590,.560,v),base=foot(s,z)[1];
        const lane=.5*(sillGlass(z)-base)/(cabinSide(s,z,.5)[1]-base);
        const p=cabinSide(s,z,lane*v,-.0013);p[1]+=.0007;path.push(p);
      }
      tube(b,'rubber',path,.0020,0x3b3e3c,6);
      // A shallow body-coloured pocket and a separate bridge make a real finger recess.
      const handleZ=.405,hy=.665;
      b.patch('paint',26,10,(u,v)=>{
        const disc=Math.sqrt(Math.max(0,1-(2*u-1)**2)),z=handleZ+(u-.5)*.189;
        const y=hy-.010+(v-.5)*.039*disc;
        return outer(s,z,y,.0018+.002*disc*(1-v));
      },[s,0,0],0xb3bab6);
      const pull=(u,v)=>{
        const z=handleZ+(u-.5)*.165,d=.42+.58*Math.sin(pi*u);
        const t=2*pi*v,y=hy+.012*d*Math.sin(t),back=.004+.014*Math.sin(pi*u);
        return outer(s,z,y,back+.008*d*Math.cos(t));
      };
      b.patch('paint',21,12,pull,(u,v)=>[s*Math.cos(v*2*pi),Math.sin(v*2*pi),0],white);
      for(const end of [0,1]){
        const outline=[];for(let j=0;j<12;j++)outline.push(pull(end,j/12));
        b.face('paint',outline,[0,0,end?1:-1],white);
      }
      // The bumper shutline meets the short wraparound NEO combination lamp.
      const joint=[];
      for(const [z,y] of [[1.589,.529],[1.642,.551],[1.695,.581],[1.750,.616],
        [1.804,.652],[1.858,.689],[1.907,.722],[1.944,.743]]){
        joint.push(outer(s,z,y,.0012));
      }
      tube(b,'rubber',joint,.0014,0x4e5151,6);
      if(s>0){
        const uv=atlasUV('door');
        b.patch('marks',24,3,(u,v)=>outer(s,mix(.375,-.586,u),mix(.232,.352,v),.0028),[s,0,0],
          0xffffff,(u,v)=>stickerUV(uv,u,v));
        const cap=[];
        for(let i=0;i<=28;i++){
          const angle=2*pi*i/28;cap.push(outer(s,1.57+.077*Math.cos(angle),.690+.071*Math.sin(angle),.0018));
        }
        tube(b,'rubber',cap,.0019,0x424942,6);
      }
    }
  }

  function rearWindow(api,body) {
    const {b,tube}=api,{canopy,widthAt}=body;
    // Flush bonded glass and its painted opening share one curved fastback.
    const start=.708, facing=[0,1,.46];
    const station=glassStation;
    const corner=(distance,length,width,cap=0)=>{
      const d=clamp(distance/length),rise=Math.sqrt(cap*cap+d*(2-d))-cap;
      return width*(1-rise/(Math.sqrt(1+cap*cap)-cap));
    };
    // Width is measured across the bonded glass, independent of the sail
    // panels. Keeping it in metres preserves the flared base as the roof widens.
    const edges=new Map();
    const half=t=>{
      if(edges.has(t))return edges.get(t);
      const span=mix(.543,.608,t)+.012*Math.sin(pi*t)
        -corner(t,.115,.052,.23)-corner(1-t,.082,.029);
      let a=.79;
      for(let i=0;i<3;i++)a=span/widthAt(station(a,t));
      edges.set(t,a);return a;
    };
    const row=glassRow;
    const point=(a,t)=>canopy(station(a,t),a);
    const rim=(a,t)=>{
      const p=point(a,t);p[1]+=.0007;return p;
    };
    // Give the aperture, pillars and deck identical vertices on their shared
    // silhouette. In close views a mismatched tessellation leaves bright pinholes.
    for(const t of [0,1]){
      for(const side of [-1,0,1])b.patch('paint',side?6:56,7,(u,v)=>{
        const width=mix(56/68,half(t),t===0?v:1-v);
        const a=side===0?(2*u-1)*width:side*mix(width,1,u);
        return canopy(t===0?mix(start,station(a,t),v):mix(station(a,t),backCab,v),a);
      },facing,white);
    }
    for(const s of [-1,1]){
      const pillar=(u,v)=>{
        const t=row(v);return point(s*mix(half(t),1,u),t);
      };
      b.patch('paint',6,50,pillar,facing,white);
      b.patch('interior',6,50,(u,v)=>{
        const p=pillar(u,v);p[0]-=s*(.006+.016*u);p[1]-=.017;return p;
      },[-s*.28,-1,-.42],0x383d3c);
    }
    b.patch('hatchGlass',56,50,(u,v)=>{
      const t=row(v);return point((2*u-1)*half(t),t);
    },facing,0xffffff,(u,v)=>[u,1-row(v)]);
    const bead=[];
    for(let i=0;i<56;i++)bead.push(rim(half(0)*(2*i/56-1),0));
    for(let i=0;i<50;i++){const t=row(i/50);bead.push(rim(half(t),t));}
    for(let i=0;i<56;i++)bead.push(rim(half(1)*(1-2*i/56),1));
    for(let i=50;i>=0;i--){const t=row(i/50);bead.push(rim(-half(t),t));}
    tube(b,'rubber',bead,.0016,weatherstrip,6);

    // Trace the stamped corner in physical plan. Its z station and the canopy
    // parameter differ because the bonded glass bows aft across its width.
    const end=point(half(1),1),reach=backCab-end[2];
    api.rearDeck.shutline=(s,t)=>{
      const z=mix(end[2],backCab,t),travel=t*t*(3-2*t);
      const x=s*(mix(end[0],.604,travel)+reach*t*(1-t)*(.22*(1-t)-.18*t));
      let station=z,p;
      for(let i=0;i<5;i++){
        p=canopy(station,x/widthAt(station));
        station+=z-p[2];
      }
      return p;
    };
    for(const s of [-1,1]){
      const line=[];
      for(let i=0;i<=24;i++){
        const p=api.rearDeck.shutline(s,i/24);
        p[1]+=.0009;line.push(p);
      }
      tube(b,'rubber',line,.0018,0x424846,6);
    }
  }

  function roofAntenna(api,body) {
    const {b}=api,{canopy}=body;
    // A molded, body-color shark fin follows the changing roof crown. Its
    // upper ridge peaks behind the center of the teardrop-shaped gasket.
    const width=curve([[0,0],[.08,.012],[.29,.026],[.55,.037],[.78,.040],[.92,.031],[1,0]]);
    const height=curve([[0,0],[.12,.005],[.35,.018],[.61,.039],[.78,.0526],[.87,.047],[.96,.021],[1,0]]);
    const at=(t,x,lift)=>{
      const z=mix(.536,.705,t),p=canopy(z,x/roofWidth(z));p[1]+=lift;return p;
    };
    b.patch('paint',24,38,(u,t)=>{
      const a=2*u-1,r=(Math.sqrt(a*a+.0036)-.06)/(Math.sqrt(1.0036)-.06);
      return at(t,width(t)*a,.0025+height(t)*(1-r**1.12));
    },u=>[2*u-1,.52,0],white);
    for(const s of [-1,1])b.patch('rubber',38,3,(t,v)=>{
      const lip=.0012*Math.sin(pi*t)*(1-v);
      return at(t,s*(width(t)+lip),.0003+.0023*v);
    },[s,.15,0],weatherstrip);
  }

  function cabinShell(api,body) {
    const {b,tube}=api,{canopy,cabinSide,foot}=body;
    const topPanel=(finish,z0,z1,from,to,color,nv=16,nu=20)=>{
      const dir=(u,v)=>[0,1, mix(z0,z1,v)<0?-.6:.6];
      b.patch(finish,nu,nv,(u,v)=>{
        const z=mix(z0,z1,v),lo=typeof from==='function'?from(z):from,hi=typeof to==='function'?to(z):to;
        return canopy(z,mix(lo,hi,u));
      },dir,color);
    };
    function windshield(z0,z1) {
      const inside=z=>mix(.945,.951,smooth(z0,z1,z));
      const sill=.033,head=.019;
      topPanel('paint',z0,z1,-1,z=>-inside(z)-.012,white,19,5);
      topPanel('paint',z0,z1,z=>inside(z)+.012,1,white,19,5);
      for(const s of [-1,1]){
        topPanel('blackGlass',z0,z1,z=>s*inside(z),z=>s*(inside(z)+.012),0x242a2a,16,2);
        b.patch('interior',6,19,(u,v)=>{
          const z=mix(z0,z1,v),p=canopy(z,s*mix(inside(z)+.002,1,u));
          p[0]-=s*(.008+.016*u);p[1]-=.016;
          return p;
        },[-s*.3,-1,.5],0x454a47);
      }
      topPanel('blackGlass',z0,z0+sill,z=>-inside(z),inside,0x252c2b,2,30);
      topPanel('glass',z0+sill,z1-head,z=>-inside(z),inside,0xffffff,21,36);
      topPanel('blackGlass',z1-head,z1,z=>-inside(z),inside,0x252b2c,2,30);
    }
    topPanel('paint',frontCab,frontCab+.019,-1,1,white,3,30);
    windshield(frontCab+.019,-.044);
    topPanel('paint',-.044,.708,-1,1,white,28,68);
    b.patch('interior',26,18,(u,v)=>{
      const a=u*2-1,p=canopy(mix(-.055,glassHeader(a)-.008,v),a);p[0]*=.972;p[1]-=.022;return p;
    },down,0x464a46);
    rearWindow(api,body);
    for(const s of [-1,1]){
      const limits=new Map();
      function paneFraction(z,edge) {
        if(edge===0||edge===5)return edge/5;
        if(!limits.has(z)){
          const low=foot(s,z)[1],h=Math.max(.010,cabinSide(s,z,.5)[1]-low)*2;
          const lo=clamp((sillGlass(z)-low)/h,.035,.90);
          const hi=clamp((headGlass(z)-low)/h,lo,.978);
          const inset=Math.min(.5*(hi-lo),.008/h);
          limits.set(z,[0,lo,lo+inset,hi-inset,hi,1]);
        }
        return limits.get(z)[edge];
      }
      const start=sideGlassStart,end=sideGlassEnd;
      const post=v=>mix(.525,.574,v);
      const postFront=v=>post(v)-.015,postRear=v=>post(v)+.018;
      const station=(edge,v)=>typeof edge==='function'?edge(v):edge;
      const sidePanel=(finish,z0,z1,e0,e1,color,dip=0)=>{
        const vertical=e0===0&&e1===5?24:8;
        const count=sideCount(station(z0,.5),station(z1,.5));
        b.patch(finish,count,vertical,(u,v)=>{
          // More stations resolve the little radius at the quarter-light tip.
          const z=sideStation(station(z0,v),station(z1,v),u),lo=paneFraction(z,e0),hi=paneFraction(z,e1);
          return cabinSide(s,z,mix(lo,hi,v),dip*Math.sin(pi*v)*Math.sin(pi*u));
        },[s,.18,0],color);
      };
      sidePanel('paint',frontCab,start,0,5,white);sidePanel('paint',end,backCab,0,5,white);
      sidePanel('paint',start,end,0,1,white);sidePanel('paint',start,end,4,5,white);
      sidePanel('blackGlass',start,end,1,2,0x222728);sidePanel('blackGlass',start,end,3,4,0x222728);
      sidePanel('sideGlass',start,postFront,2,3,0xffffff,.005);
      sidePanel('blackGlass',postFront,postRear,2,3,0x25292b);
      sidePanel('sideGlass',postRear,end,2,3,0xbbc9c5,.0035);
      const badge=api.atlasUV('quarterBadge');
      b.patch('marks',9,8,(u,v)=>{
        const z=mix(.595,.677,s>0?1-u:u),y=mix(.887,.971,v),base=foot(s,z)[1];
        const h=.5*(y-base)/(cabinSide(s,z,.5)[1]-base);
        const lo=paneFraction(z,2),hi=paneFraction(z,3);
        const vGlass=clamp((h-lo)/(hi-lo)),from=postRear(vGlass);
        const uGlass=1-(1-clamp((z-from)/(end-from)))**(1/1.36);
        const recess=.0035*Math.sin(pi*vGlass)*Math.sin(pi*uGlass);
        const p=cabinSide(s,z,h,recess);p[0]+=s*.0016;return p;
      },[s,.17,0],0xffffff,(u,v)=>[mix(badge[0][0],badge[1][0],u),mix(badge[0][1],badge[3][1],v)]);
      // Interior-facing pillar trims, door shoulders and parcel-shelf sides
      // give the windows a shaded room to look into in cross-light.
      const lining=(z0,z1,e0,e1,tint)=>{
        const count=Math.max(4,Math.ceil((station(z1,.5)-station(z0,.5))/.04));
        b.patch('interior',count,5,(u,v)=>{
          const z=mix(station(z0,v),station(z1,v),u),a=paneFraction(z,e0),c=paneFraction(z,e1);
          const p=cabinSide(s,z,mix(a,c,v),.026);p[1]-=.012;return p;
        },[-s,-.18,0],tint);
      };
      lining(frontCab,start,0,5,0x404442);lining(end,backCab,0,5,0x383e3e);
      lining(start,end,0,1,0x2c3233);lining(start,end,4,5,0x3b4040);
      lining(v=>postFront(v)-.004,v=>postRear(v)+.004,1,4,0x222729);
      b.patch('interior',40,6,(u,v)=>{
        const z=mix(-.71,1.265,u),p=foot(s,z),y=mix(.398,p[1]-.012,v);
        return [p[0]-s*(.036+.042*(1-v)),y,z];
      },[-s,.06,0],0x2b3031);
      const roofGutter=[];
      // The ditch meets the upper glass corner, inside the rounded metal sail.
      const gutterAt=z=>mix(.940,.798,smooth(.24,.815,z));
      const capEnd=glassHeader(.798)-.012,capStart=capEnd-.080;
      for(let i=0;i<=32;i++){
        const z=mix(-.041,capStart+.004,i/32),p=canopy(z,s*gutterAt(z));p[1]+=.0008;roofGutter.push(p);
      }
      tube(b,'rubber',roofGutter,.0020,0x626963,6);
      // Low black gutter caps bookend the painted roof above the glass.
      b.patch('rubber',6,15,(u,v)=>{
        const z=mix(capStart,capEnd,v),width=.013*(.74+.26*Math.sin(pi*v));
        const p=canopy(z,s*(gutterAt(z)+(2*u-1)*width));
        p[1]+=.0014+.0014*(1-(2*u-1)**2)*Math.sin(pi*v);return p;
      },[s*.15,1,.12],0x292d2e);
    }
    // Two linked sweep arms sit on the cowl with a narrow rubber blade against the glass.
    const onGlass=(z,u,lift=.006)=>{const p=canopy(z,u);p[1]+=lift;return p;};
    for(const [pivot,elbow,from,to] of [[-.72,-.44,-.66,-.05],[.07,.31,.11,.78]]){
      tube(b,'trim',[onGlass(-.748,pivot),onGlass(-.716,elbow),onGlass(-.688,(from+to)/2)],.005,0x25292b,6);
      const blade=[];
      for(let i=0;i<=12;i++)blade.push(onGlass(-.685+.008*Math.sin(i*pi/12),mix(from,to,i/12),.009));
      tube(b,'rubber',blade,.006,0x222527,6);
    }
    roofAntenna(api,body);
  }

  function mirrors(api,body) {
    const {b,rod}=api;
    for(const s of [-1,1]){
      const foot=body.cabinSide(s,-.536,.23);
      rod(b,'trim',[foot[0]-s*.005,foot[1]-.015,foot[2]],[s*.837,.823,-.446],.028,0x24292d,10,.022);
      rod(b,'trim',[s*.833,.821,-.446],[s*.894,.874,-.427],.022,0x252a2e,10,.031);
      const center=[s*.892,.887,-.463];
      function lens(u,v){
        const angle=2*pi*u,cs=Math.cos(angle),sn=Math.sin(angle),outer=cs*.50+.5;
        return [center[0]+s*cs*.100*v,center[1]+sn*(.046+.009*outer)*v+.012*outer,
          center[2]+.053+.028*outer-.006*v*v];
      }
      const panel=(u,v)=>{
        const l=lens(u,1),cs=Math.cos(v*pi/2);
        return [center[0]+(l[0]-center[0])*cs,center[1]+(l[1]-center[1])*cs+.007*v,
          mix(l[2]-.006,center[2]-.091,Math.sin(v*pi/2))];
      };
      const dir=u=>[s*Math.cos(2*pi*u),Math.sin(2*pi*u),-.25];
      // Upper colour cap over the black lower pedestal.
      for(const [a,c,finish,col] of [[0,.5,'paint',white],[.5,1,'satin',0x30353b]]){
        b.patch(finish,22,12,(u,v)=>panel(mix(a,c,u),v),(u)=>dir(mix(a,c,u)),col);
      }
      b.patch('rubber',40,2,(u,v)=>{
        const p=lens(u,mix(.88,1,v));p[2]-=.006*v;return p;
      },[0,0,1],0x171b1c);
      b.patch('chrome',40,5,(u,v)=>lens(u,v*.885),[0,.04,1],0xc0d0d0);
    }
    // Windscreen-mounted interior mirror. The molded shell faces the bonnet;
    // the bevel and silvered glass aim back toward the right-hand driver.
    const mount=body.canopy(-.094,0);
    oval(b,'rubber',[0,mount[1]-.005,mount[2]+.003],[.023,.004,.030],0x252a2b,20,8,-.33);
    const joint=[0,1.178,-.132];
    rod(b,'trim',[0,mount[1]-.008,mount[2]+.004],joint,.008,0x33383a,12,.0068);
    oval(b,'trim',joint,[.011,.010,.010],0x303438,14,8);
    rod(b,'trim',joint,[0,1.145,-.130],.0068,0x303538,12,.0076);
    const mirror=(u,scale,depth)=>{
      const angle=u*2*pi,c=Math.cos(angle),s=Math.sin(angle);
      const x=.106*scale*Math.sign(c)*Math.abs(c)**.39;
      const y=.0295*scale*Math.sign(s)*Math.abs(s)**.43;
      return [x,1.143+y,-.117-.105*x+.065*y+depth];
    };
    b.patch('trim',48,6,(u,v)=>mirror(u,.77+.23*Math.sin(pi*.5*v),mix(-.026,.006,v)),
      u=>[Math.cos(2*pi*u),Math.sin(2*pi*u),-.25],0x34383a);
    b.patch('trim',48,4,(u,v)=>mirror(u,.77*v,-.026-.002*(1-v*v)),forward,0x34383a);
    b.patch('rubber',48,2,(u,v)=>mirror(u,mix(.92,1,v),.008-.002*v),back,0x202426);
    b.patch('chrome',48,4,(u,v)=>mirror(u,.924*v,.009-.0008*v*v),back,0xa5b2ae);
  }

  function oval(b,finish,center,radii,color,nu=18,nv=12,pitch=0){
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    b.patch(finish,nu,nv,(u,v)=>{
      const t=u*pi*2,a=(v-.5)*pi,cv=Math.cos(a),x=radii[0]*cv*Math.cos(t),y=radii[1]*Math.sin(a),z=radii[2]*cv*Math.sin(t);
      return [center[0]+x,center[1]+y*cp-z*sp,center[2]+y*sp+z*cp];
    },(u,v)=>[Math.cos(u*2*pi)*Math.cos((v-.5)*pi),Math.sin((v-.5)*pi),Math.sin(u*2*pi)*Math.cos((v-.5)*pi)],color);
  }

  function cockpit(api,body) {
    const {b,box,rod,tube}=api;
    box(b,'interior',[0,.31,.34],[1.45,.12,2.14],0x292b2b);
    // Shallow instrument panel spanning the windscreen. Its top stays clear of the outside bonnet.
    b.patch('interior',24,12,(u,v)=>{
      const x=(u*2-1)*.755,side=Math.abs(u*2-1);
      const z=mix(-.699+.105*side,-.273+.060*side,v);
      return [x,.747+.029*Math.sin(v*pi)-.035*side*side-.102*v*v*v,z];
    },[0,.8,.3],0x373b3c);
    box(b,'interior',[0,.58,-.34],[1.40,.18,.16],0x303538,-.12);
    oval(b,'interior',[.335,.775,-.456],[.213,.075,.124],0x282c2d);
    const headrest=(center,radii,flare,lean,color)=>{
      b.patch('interior',34,18,(u,v)=>{
        const a=2*pi*u,t=(v-.5)*pi,vertical=Math.sin(t),span=Math.max(0,Math.cos(t))**.65;
        const c=Math.cos(a),sine=Math.sin(a);
        return [center[0]+radii[0]*span*(1+flare*vertical)*Math.sign(c)*Math.abs(c)**.66,
          center[1]+radii[1]*Math.sign(vertical)*Math.abs(vertical)**.68,
          center[2]+lean*vertical+radii[2]*span*Math.sign(sine)*Math.abs(sine)**.64];
      },(u,v)=>[Math.cos(2*pi*u),Math.sin((v-.5)*pi),Math.sin(2*pi*u)],color);
    };
    for(const s of [-1,1]){
      const x=s*.346;
      oval(b,'interior',[x,.441,.214],[.230,.090,.291],0x292e30,22,12,-.08);
      oval(b,'interior',[x,.677,.42],[.201,.254,.093],0x303538,24,16,.17);
      for(const wing of [-1,1]){
        oval(b,'interior',[x+wing*.176,.676,.37],[.056,.227,.085],0x292d2e,16,12,.17);
        oval(b,'interior',[x+wing*.200,.461,.20],[.049,.070,.243],0x3a3d3e,16,9,-.09);
      }
      for(const side of [-1,1])rod(b,'metal',[x+side*.050,.902,.459],
        [x+side*.050,.970,.468],.0054,0x6a7472,10);
      headrest([x,1.026,.467],[.113,.082,.062],.055,.010,0x2d3132);
      oval(b,'interior',[s*.293,.52,.935],[.182,.125,.160],0x2b3031);
      oval(b,'interior',[s*.28,.682,1.045],[.174,.172,.073],0x303436,16,10,.28);
      // The low, fixed rear pads emerge from the seat shoulders just ahead
      // of the parcel shelf, tapering slightly toward their upholstered tops.
      headrest([s*.285,.806,1.087],[.118,.067,.059],-.115,.013,0x292d2e);
      box(b,'interior',[s*.712,.55,.012],[.050,.24,1.30],0x343836);
      box(b,'interior',[s*.684,.617,.044],[.080,.057,.46],0x292d2e);
    }
    box(b,'interior',[0,.423,.050],[.215,.138,.866],0x292c30);
    rod(b,'trim',[0,.488,-.071],[0,.579,-.086],.014,0x363a3b,9,.012);
    oval(b,'interior',[0,.593,-.086],[.029,.028,.028],0x25272a,12,8);
    const cx=.343,cy=.749,cz=-.227,r=.149;
    const handwheel=[];
    for(let i=0;i<=48;i++){const t=i*pi/24;handwheel.push([cx+r*Math.cos(t),cy+r*Math.sin(t)*.96,cz-r*.28*Math.sin(t)]);}
    tube(b,'rubber',handwheel,.015,0x212526,8);
    oval(b,'interior',[cx,cy,cz],[.065,.052,.035],0x272c2f,16,10,-.2);
    for(const t of [pi*.04,pi*.96,pi*1.52]){
      rod(b,'satin',[cx,cy,cz],[cx+r*.91*Math.cos(t),cy+r*.91*Math.sin(t)*.96,cz-r*.26*Math.sin(t)],.019,0x44494b,6,.013);
    }
    // A molded parcel shelf fits between the quarter trims below the bonded
    // rear glass. The short lip follows the backs of the two rear seats.
    const shelf=(a,v)=>{
      const tail=smooth(.65,1,v),z=mix(.932+.115*a*a,1.512-.056*a*a,v)+.018*tail;
      const crown=.006*(1-a*a)*Math.sin(pi*v);
      return [a*mix(.68,.765,v),.796+.033*v+.008*a**4-.004*Math.sin(pi*v)+crown+.045*tail,z];
    };
    b.patch('interior',36,14,(u,v)=>shelf(2*u-1,v),up,0x303534);
    b.patch('interior',36,2,(u,v)=>{
      const p=shelf(2*u-1,0);p[1]-=.032*(1-v);return p;
    },forward,0x262b2b);
    // Close the tray up under the bonded sill. The outer glass is transparent
    // and this is the inner trim seen behind its lower ceramic border.
    b.patch('interior',36,6,(u,v)=>{
      const a=2*u-1,tray=shelf(a,1),lip=body.canopy(glassSill(a),a);
      return [mix(tray[0],lip[0]*.985,v),mix(tray[1],lip[1]-.010,v*v),
        mix(tray[2],lip[2]+.014,v)];
    },[0,.50,-1],0x282d2e);
    for(const s of [-1,1]){
      const anchor=shelf(s*.455,.37);
      box(b,'trim',[anchor[0],anchor[1]+.003,anchor[2]],[.069,.006,.044],0x343938,-.05);
    }
    // The main hoop and its diagonal share a plane aft of both front headrests.
    const rail=[[.673,.376,.593],[.665,.563,.600],[.645,1.029,.618],
      [.581,1.160,.625],[.550,1.188,.627],[.474,1.201,.628]];
    const mirror=([x,y,z])=>[-x,y,z];
    const hoop=rail.map(mirror).concat(rail.slice().reverse());
    tube(b,'satin',hoop,.020,0x323638,14);
    const joint=(side,index,y)=>{
      const a=rail[index],c=rail[index+1],t=(y-a[1])/(c[1]-a[1]);
      return [side*mix(a[0],c[0],t),y,mix(a[2],c[2],t)];
    };
    rod(b,'satin',joint(1,2,1.110),joint(-1,1,.632),.016,0x292d2e,12);
    for(const side of [-1,1]){
      box(b,'trim',[side*rail[0][0],.374,rail[0][2]],[.084,.008,.090],0x292d2d);
      const shoulder=side>0?rail[4]:mirror(rail[4]);
      const [x,y,z]=shelf(side*.667,.64);
      box(b,'trim',[x,y+.004,z],[.073,.009,.092],0x292d2d,-.070);
      rod(b,'satin',shoulder,[x,y+.023,z],.021,0x303435,14);
    }
  }

  function driver(api) {
    const {driverBatch:b,rod,tube}=api;
    const cx=.343,cz=-.227;
    // Seated right-hand driver, visible in profile and through the rear glass.
    const shirt=0x3c4549,hair=0x242423,skin=0xa88164;
    oval(b,'interior',[.344,.714,.257],[.151,.216,.099],shirt,20,14,.13);
    oval(b,'interior',[.344,.868,.265],[.071,.030,.054],0x303638,16,7);
    rod(b,'interior',[.344,.859,.264],[.343,.942,.258],.042,skin,14,.037);
    const faceX=curve([[.898,.010],[.910,.038],[.933,.063],[.964,.077],[.996,.084],[1.027,.082],[1.057,.079],[1.084,.063],[1.102,.032],[1.108,.002]]);
    const faceFront=curve([[.898,.029],[.910,.078],[.933,.088],[.954,.079],[.979,.073],[1.005,.075],[1.026,.082],[1.058,.086],[1.085,.063],[1.103,.031],[1.108,.002]]);
    const skullBack=curve([[.898,.010],[.925,.047],[.960,.080],[1.004,.099],[1.064,.091],[1.088,.070],[1.104,.031],[1.108,.002]]);
    const scalp=(t,y,w=0)=>{
      const si=Math.sin(t),co=Math.cos(t),face=co>=0?faceFront(y):skullBack(y);
      const cheek=.005*bell((y-.978)/.022)*Math.abs(si)*Math.max(0,co);
      return [.343+si*(faceX(y)+w),y,.258-co*(face+w+cheek)];
    };
    b.patch('interior',40,25,(u,v)=>scalp(2*pi*u,mix(.898,1.108,v)),
      (u,v)=>[Math.sin(2*pi*u),(v-.5)*.3,-Math.cos(2*pi*u)],skin);
    const hairline=t=>{
      const f=Math.cos(t),s=Math.sin(t);
      return .969+.064*smooth(-.27,1,f)-.009*bell((f+.01)/.13)
        +(.003*Math.sin(7*t+.5)+.002*Math.sin(13*t))*(.3+.7*Math.max(0,f))-.004*s;
    };
    b.patch('interior',64,18,(u,v)=>{
      const t=2*pi*u,y=mix(hairline(t),1.108,v),lift=.003+.0035*Math.sin(pi*v)+.0015*Math.cos(7*t+v*2.8);
      const p=scalp(t,y,lift*(1-v*v));p[1]+=.006*v+.002*Math.sin(pi*v);return p;
    },(u,v)=>[Math.sin(2*pi*u),v,-Math.cos(2*pi*u)],hair);
    // A small brow, cheek and jaw silhouette stays legible through the side glass.
    const nosePoint=(u,v)=>{
      const y=mix(.961,1.020,v),width=.008+.009*bell((v-.23)/.24),x=(u*2-1)*width;
      const ridge=.023*Math.sin(v*pi)**.77+.013*bell((v-.25)/.19);
      return [.343+x,y,.256-faceFront(y)-ridge*(1-(x/width)**2)];
    };
    b.patch('interior',12,12,nosePoint,forward,skin);
    for(const faceSide of [-1,1]){
      oval(b,'interior',[.343+faceSide*.079,.983,.270],[.012,.022,.016],0x9c745d,14,10,.02);
      oval(b,'interior',[.343+faceSide*.089,.986,.270],[.003,.011,.007],0x795643,10,6);
      const brow=[],lash=[];
      for(let j=0;j<8;j++){
        const t=faceSide*mix(.15,.714,j/7);
        brow.push(scalp(t,1.009+.003*Math.sin(j*pi/7),.0016));
        lash.push(scalp(t,.996+.002*Math.sin(j*pi/7),.0014));
      }
      tube(b,'interior',brow,.0027,0x47382d,6);tube(b,'interior',lash,.0016,0x524439,5);
    }
    const mouth=[-.22,-.12,0,.12,.22].map(t=>scalp(t,.945-.002*Math.cos(t*6),.0008));
    tube(b,'interior',mouth,.0015,0x875f50,5);
    for(const side of [-1,1]){
      const shoulder=[.344+side*.128,.805,.217],elbow=[.344+side*.198,.647,.082];
      const hand=[cx+side*.136,.790,cz-.007];
      const cuff=elbow.map((p,i)=>mix(p,hand[i],.18));
      rod(b,'interior',shoulder,elbow,.055,shirt,12,.041);
      rod(b,'interior',elbow,cuff,.041,shirt,12,.039);
      rod(b,'interior',cuff,hand,.031,skin,14,.022);
      oval(b,'interior',hand,[.025,.033,.026],skin,14,9);
    }
  }

  N.buildBody=N.staged(function* buildBody(api){
    const body=coachwork(api);
    sheetMetal(api,body);yield;
    sideFurniture(api,body);yield;
    cabinShell(api,body);yield;
    mirrors(api,body);yield;
    cockpit(api,body);yield;
    driver(api);yield;
  });
})();
