/* Surveyed Mikuni horizon from Panorama-dai. Each time of day has the same
   two independently raycast SRTM layers. See tools/bake-fuji-panorama.py. */
(() => {
  'use strict';
  const T=THREE;
  const sunDirection=new T.Vector3(-.823,.244,.513).normalize();
  const dawnDirection=new T.Vector3(.93,.28,.22).normalize();
  const horizonSource=`
    uniform highp sampler2D panorama;
    uniform highp sampler2D lakeMap;
    uniform float lakeTime;
    uniform float ready,night;
    uniform vec3 skyOrigin;
    vec4 mikuniSample(vec2 uv,vec2 local,vec2 scale) {
      // Derive the footprint before wrapping longitude or folding the sky
      // into the atlas. Otherwise a single pixel can select the coarsest mip.
      #if __VERSION__ >= 300
        vec2 dx=dFdx(local),dy=dFdy(local);
        dx.x-=floor(dx.x+.5);
        dy.x-=floor(dy.x+.5);
        return textureGrad(panorama,uv,dx*scale,dy*scale);
      #else
        vec2 jump=fwidth(uv);
        return texture2D(panorama,uv,max(jump.x,jump.y)>.25?-12.:0.);
      #endif
    }
    float mikuniCoverage(float mask) {
      // The bake stores the continuous angular distance to the crest on
      // either side of 192/255. Antialias that contour at screen resolution.
      float edge=192./255.,pixel=max(.5*fwidth(mask),.5/255.);
      return smoothstep(edge-pixel,edge+pixel,mask);
    }
    float mikuniHaze(float distanceM) {
      return .94*smoothstep(320.,1050.,distanceM);
    }
    // The two halves hold afternoon and predawn radiance from a survey eye
    // mirrored under Yamanaka. Read shoreline coverage on the undisturbed ray.
    vec2 lakeUV(float azimuth,float elevation) {
      return vec2(.75*clamp((azimuth-256.)/80.,.001,.999),
        .5*(1.-night+clamp(elevation/12.,.004,.996)));
    }
    vec3 lakeWind(vec2 tileCoords) {
      vec2 tile=fract(tileCoords),scale=vec2(.125,.5);
      vec2 uv=vec2(.8125,.25)+tile*scale;
      #if __VERSION__ >= 300
        return textureGrad(lakeMap,uv,dFdx(tileCoords)*scale,dFdy(tileCoords)*scale).rgb;
      #else
        vec2 jump=fwidth(tile);
        return texture2D(lakeMap,uv,max(jump.x,jump.y)>.5?-8.:0.).rgb;
      #endif
    }
    vec3 lakeSurface(vec3 land,vec2 bearing,float azimuth,float angle) {
      vec2 flatUV=lakeUV(azimuth,angle);
      vec2 dx=dFdx(flatUV),dy=dFdy(flatUV);
      #if __VERSION__ >= 300
        if(azimuth<259. || azimuth>334. || angle<.65 || angle>7.6)return land;
        float mask=textureGrad(lakeMap,flatUV,dx,dy).a;
      #else
        float mask=texture2D(lakeMap,flatUV).a;
      #endif
      float edge=158./255.,aa=clamp(.5*fwidth(mask),.045,.18);
      float water=smoothstep(edge-aa,edge+aa,mask);
      if(water<=0.)return land;

      // Project onto the same level water plane used by the survey. Wave
      // phases stay fixed to metres of lake surface when the camera pans.
      float down=tan(radians(angle));
      float range=220./(down+sqrt(max(0.,down*down-440./14800000.)));
      vec2 pos=bearing*range;
      vec2 wind=vec2(.87462,.48481);
      vec2 across=vec2(-wind.y,wind.x);
      vec2 st=vec2(dot(pos,wind),dot(pos,across));
      float t=lakeTime;
      vec3 groups=lakeWind((st-vec2(1.7,.18)*t)/780.);
      float open=smoothstep(.62,.975,mask);
      float gust=mix(.19,1.,open)*(.22+.78*groups.b)*(1.-.30*night);
      vec2 swell=lakeWind((st+7.*(groups.rg-.5)-vec2(1.5,.11)*t)/174.).rg-.5;
      mat2 turn=mat2(.902,.432,-.432,.902);
      vec2 chop=lakeWind((turn*st-vec2(.82,-.09)*t)/58.+.37).rg-.5;
      vec2 localSlope=.075*swell+.042*(chop*turn);
      vec2 slope=(wind*localSlope.x+across*localSlope.y)*(.34+1.27*gust);
      vec3 normal=normalize(vec3(-slope.x,1.,-slope.y));
      vec3 incident=normalize(vec3(bearing.x,-down,bearing.y));
      vec3 reflected=reflect(incident,normal);
      float rayAz=degrees(atan(reflected.x,-reflected.z))+360.;
      float rayEl=degrees(asin(clamp(reflected.y,-1.,1.)));
      vec2 uv=lakeUV(rayAz,rayEl);
      // Integrate unresolved short ripples around the reflected ray. Their
      // footprint is taller than it is wide at this grazing viewing angle.
      float spread=.16+.84*gust;
      vec2 low=lakeUV(rayAz-.10*spread,rayEl-spread),high=lakeUV(rayAz+.10*spread,rayEl+spread);
      #if __VERSION__ >= 300
        vec3 reflection=.50*textureGrad(lakeMap,uv,dx,dy).rgb+
                        .25*(textureGrad(lakeMap,low,dx,dy).rgb+textureGrad(lakeMap,high,dx,dy).rgb);
      #else
        vec3 reflection=.50*texture2D(lakeMap,uv).rgb+.25*(texture2D(lakeMap,low).rgb+texture2D(lakeMap,high).rgb);
      #endif
      float cosine=clamp(dot(-incident,normal),0.,1.);
      float fresnel=.0204+.9796*pow(1.-cosine,5.);
      vec3 scatter=mix(vec3(.048,.095,.084),vec3(.026,.083,.112),open);
      scatter*=mix(vec3(1.),vec3(.56,.65,.79),night);
      // The lakebed and wet bank show through the sheltered shallow margin.
      scatter=mix(mix(land,scatter,.48),scatter,smoothstep(edge,.87,mask));
      vec3 surface=mix(scatter,reflection,fresnel*mix(.73,.98-.30*gust,smoothstep(edge,.89,mask)));
      return mix(land,surface,water);
    }
    vec3 horizonColor(vec3 d) {
      vec3 fallback=mix(vec3(.32,.38,.44),vec3(.23,.37,.51),smoothstep(-.04,.62,d.y));
      if(night>.5)fallback*=vec3(.57,.52,.64);
      if(ready<.5)return fallback;
      float horizontal=max(length(d.xz),.00001);
      vec2 bearing=horizontal>.00001?d.xz/horizontal:vec2(0.,-1.);
      float longitude=atan(bearing.x,-bearing.y)/6.28318531;
      float elevation=degrees(asin(clamp(d.y,-1.,1.)));
      // The upper quarter holds the lower and upper sky side by side.
      float skyV=2.*clamp((elevation+8.)/70.,0.,1.),upper=step(1.,skyV);
      vec2 skyScale=vec2(.5-2./1024.,.25-2./256.);
      vec2 skyUV=vec2(.5*upper+1./1024.,.75+1./256.)+skyScale*vec2(fract(longitude),skyV-upper);
      vec3 air=mikuniSample(skyUV,vec2(longitude,skyV),skyScale).rgb;

      // The far survey devotes 30% of its bearings to the 30° around Fuji.
      float delta=fract(longitude-251./360.+.5)-.5,angle=abs(delta);
      float farU=.5+sign(delta)*(min(angle,15./360.)*(.15/(15./360.))
        +max(0.,angle-15./360.)*(.35/(.5-15./360.)));
      vec2 farLocal=vec2(farU,clamp((elevation+3.)/14.,.002,.998));
      vec2 farScale=vec2(1.,7./16.);
      vec4 mountain=mikuniSample(vec2(0.,5./16.)+farLocal*farScale,farLocal,farScale);

      // The near 6.5 km of surveyed terrain is a cutout on a 3.2 km
      // cylinder. Each viewing bearing hits it once at any camera position.
      // Revealing a slope exposes the independently baked far terrain.
      vec3 eye=clamp(cameraPosition-skyOrigin,vec3(-440.,-68.,-440.),vec3(440.,68.,440.))*(.50/3200.);
      float along=dot(eye.xz,bearing);
      float travel=sqrt(1.-dot(eye.xz,eye.xz)+along*along)-along;
      vec2 nearBearing=eye.xz+travel*bearing;
      float nearElevation=degrees(atan(eye.y+travel*d.y/horizontal));
      float nearV=nearElevation< -5.?(.20/16.)*(nearElevation+21.):.20+(.80/22.)*(nearElevation+5.);
      vec2 nearLocal=vec2(atan(nearBearing.x,-nearBearing.y)/6.28318531,clamp(nearV,.002,.998));
      vec2 nearScale=vec2(1.,5./16.);
      vec4 shore=mikuniSample(nearLocal*nearScale,nearLocal,nearScale);
      vec3 land=mix(mix(air,mountain.rgb,mikuniCoverage(mountain.a)),shore.rgb,mikuniCoverage(shore.a));
      return lakeSurface(land,nearBearing,nearLocal.x*360.+360.,-nearElevation);
    }`;
  // Long grass covers the upper traverses and several open ledges between
  // the wooded hairpins. The lower switchback faces Fuji on the return run.
  const clearings=[[0,500],[705,1010],[1160,1845],[1990,2350],[2510,2710],[2770,3120],[4250,4700]];
  function meadow(station){
    const smooth=T.MathUtils.smoothstep;
    for(const [low,high] of clearings)if(station>=low-38 && station<=high+38)
      return smooth(station,low-38,low+30)*(1-smooth(station,high-28,high+38));
    return 0;
  }
  // The viewing platform sits out over the slope on black piles. A low timber
  // handrail follows the rounded end and keeps the view clear from the road.
  function lookout(b,base,tiles){
    // The parking apron falls with the pass. Level the deck above its uphill
    // edge and step down to the entrance so it remains visible from the road.
    const f=(x,y,z)=>base(x,y+.48,z);
    const radius=3.3,center=-1.55,outer=[];
    for(let i=0;i<=16;i++){
      const a=Math.PI*i/16;
      outer.push([radius*Math.cos(a),center-radius*Math.sin(a)]);
    }
    const front=3.0,planks=36,back=center-radius;
    for(let i=0;i<planks;i++){
      const z=front+(back-front)*(i+.5)/planks;
      const half=z>=center?radius:Math.sqrt(Math.max(.04,radius*radius-(z-center)**2));
      b.timber.box(f,0,.22,z,2*half,.13,(front-back)/planks-.009,
        [0xb39b79,0xb7a483,0xc3ad88,0xa99674,0xb9a788][i%5]);
    }
    b.timber.box(f,0,.095,3.21,2.16,.10,.42,0xaa9473);
    b.timber.box(f,0,-.054,3.62,2.19,.10,.42,0xa48d6a);
    for(const x of [-2.32,0,2.32]){
      b.steel.box(f,x,.062,-.02,.09,.19,6.1,0x444b48);
      for(const z of [-2.85,.12,2.6])b.steel.tube(f(x,-3.8,z),f(x,.12,z),.088,.085,0x434b4a,7,true);
    }
    const rail=[[radius,front],...outer,[-radius,front]];
    for(let i=1;i<rail.length;i++){
      const [x0,z0]=rail[i-1],[x1,z1]=rail[i],length=Math.hypot(x1-x0,z1-z0);
      b.timber.tube(f(x0,1.32,z0),f(x1,1.32,z1),.053,.053,0xb09b78,7,true);
      b.steel.tube(f(x0,.43,z0),f(x1,.43,z1),.025,.025,0x4d504b,7);
      const bars=Math.ceil(length/.24);
      for(let j=0;j<bars;j++){
        const u=j/bars,x=x0+(x1-x0)*u,z=z0+(z1-z0)*u;
        const thick=j===0 && i%2===1;
        b.steel.box(f,x,.83,z,thick?.044:.014,.95,thick?.044:.014,0x494c47);
      }
      if(i%4===2){
        b.hardware.box(f,x1,.46,z1,.095,.12,.055,0x5d5950);
        b.lit.box(f,x1,.46,z1+.033,.051,.044,.009,0xe2ba7d);
      }
    }
    for(const z of [1.8,-.55]) {
      for(const x of [-1.01,1.01])b.steel.box(f,x,.43,z,.072,.39,.31,0x515654);
      for(let j=0;j<3;j++)b.timber.box(f,0,.65,z+(j-1)*.119,2.43,.073,.102,0xc2a67d);
    }
    for(const x of [-1.12,1.12])b.timber.box(f,x,.77,2.84,.11,1.46,.11,0x6c604e);
    b.timber.box(f,0,1.23,2.84,2.70,.56,.13,0x806d53);
    b.signs.panel(f,0,1.23,2.913,2.60,.50,tiles.shop);
  }
  function hirano(b,f,tiles){
    const wall=0xc3bba4,frame=0x6c6658;
    b.concrete.box(f,0,-.52,-.02,6.85,1.4,3.98,0xb0b0a1);
    b.concrete.box(f,0,.14,.1,6.53,.18,3.87,0xd2cdbb);
    for(const x of [-2.98,-.12,2.98]){
      b.timber.box(f,x,1.37,-1.52,.15,2.5,.17,frame);
      b.timber.box(f,x,1.4,1.51,.15,2.55,.16,frame);
    }
    for(let j=0;j<22;j++)b.timber.box(f,-2.88+j*.274,1.30,-1.57,.264,2.22,.095,j%3?wall:0xb8b398);
    b.timber.box(f,0,.49,-1.43,6.05,.08,.07,0x8a806d);
    b.timber.box(f,0,2.44,-1.43,6.11,.13,.12,frame);
    b.timber.box(f,0,2.63,1.51,6.36,.19,.16,frame);
    const roof=(x,y,z)=>f(x,2.91+.107*z+y,z);
    b.solid.box(roof,0,0,0,6.92,.11,4.20,0x52736c);
    for(let j=0;j<14;j++)b.hardware.box(roof,-3.40+j*.523,.085,0,.033,.058,4.19,0x789084);
    for(const x of [-2.05,2.05])for(const z of [-.97,-.69])
      b.steel.box(f,x,.46,z,.065,.44,.063,0x676b65);
    for(let j=0;j<4;j++)b.timber.box(f,0,.70,-.8+(j-1.5)*.13,4.83,.071,.114,0xba9d75);
    b.timber.box(f,0,2.62,1.67,3.49,.78,.095,frame);
    b.signs.panel(f,0,2.62,1.725,3.36,.68,tiles.noren);
    for(const x of [-2.18,1.64]){
      b.solid.box(f,x,1.67,-1.47,.72,.92,.050,0x515953);
      b.solid.box(f,x,1.67,-1.427,.64,.82,.039,0xe1d9c5);
      for(let k=0;k<5;k++)b.solid.box(f,x,1.44+k*.105,-1.403,.47,.015,.012,0x89918b);
    }
    const ticket=(x,y,z)=>f(4.15+x,y,-.25+z);
    b.concrete.box(ticket,0,.17,0,1.03,.24,.76,0xa8a69a);
    b.solid.box(ticket,0,1.15,0,.92,1.78,.63,0xb74938);
    b.signs.panel(ticket,0,1.16,.32,.89,1.69,tiles.vend);
  }
  window.TougeFuji={horizonSource,sunDirection,dawnDirection,meadow,lookout,hirano};
})();
