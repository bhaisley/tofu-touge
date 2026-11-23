(() => {
  'use strict';
  const T=THREE, lerp=T.MathUtils.lerp, clamp=T.MathUtils.clamp;

  function noise(x,z) {
    const i=Math.floor(x), j=Math.floor(z);
    const a=x-i, b=z-j, u=a*a*(3-2*a), v=b*b*(3-2*b);
    function corner(col,row) {
      let h=Math.imul(col,0x1f1f1f1f)^Math.imul(row,0x9e3779b1);
      h=Math.imul(h^(h>>>16),0x85ebca6b);
      return ((h^(h>>>13))>>>0)/4294967296;
    }
    return lerp(lerp(corner(i,j),corner(i+1,j),u),lerp(corner(i,j+1),corner(i+1,j+1),u),v);
  }

  // This field is stored at the terrain vertices. The forest pass reduces
  // it under real tree crowns before the shoulder and tufts sample it.
  const habitat=(x,z)=>.35+.55*noise(x*.025,z*.025)+.18*noise(x*.092+7,z*.092);
  function coverAt(grid,x,z) {
    const u=clamp((x-grid.x0)/grid.step,0,grid.nx-.00001);
    const v=clamp((z-grid.z0)/grid.step,0,grid.nz-.00001);
    const i=Math.floor(u),j=Math.floor(v),a=u-i,b=v-j,stride=grid.nx+1,k=j*stride+i;
    const top=a+b>1,values=grid.cover.array;
    return Math.abs(1-a-b)*values[top?k+stride+1:k]+(top?1-b:a)*values[k+1]+(top?1-a:b)*values[k+stride];
  }

  let maps;
  function surfaceMaps() {
    if(maps)return maps;
    function load(name,space) {
      const tex=new T.TextureLoader().load(window.TougeArtURLs?.[name]||'assets/art/'+name);
      tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=8;tex.colorSpace=space;
      return {value:tex};
    }
    maps={grassAlbedo:load('haruna-grass.webp',T.SRGBColorSpace),
      grassSurface:load('haruna-grass-surface.webp',T.NoColorSpace),
      meadowScan:load('haruna-meadow.webp',T.SRGBColorSpace)};
    return maps;
  }

  // One two-metre leafy-grass scan supplies the blade-scale albedo,
  // normal and roughness. An aerial scan in the unused alpha channel
  // describes the larger greener and thinner patches between the trees.
  const groundSource=`
    uniform sampler2D grassAlbedo;
    #ifndef TUFT_COMPACT
      uniform sampler2D grassSurface,meadowScan;
    #endif
    struct GroundGrass { vec3 albedo; vec3 relief; float cover; float height; };
    GroundGrass sampleGroundGrass(vec2 world,float habitat) {
      GroundGrass grass;
      #ifdef TUFT_COMPACT
        // The eight-sampler path keeps the green albedo and a broad, matte
        // response. Only one additional texture unit is needed.
        grass.albedo=texture2D(grassAlbedo,world*.50).rgb*vec3(.88,1.05,.78);
        grass.cover=smoothstep(.26,.74,habitat);grass.relief=vec3(.5,.5,.88);grass.height=0.;
      #else
      vec2 aspect=mat2(.8,-.6,.6,.8)*world;
      float broad=texture2D(grassSurface,aspect*.033).a;
      float broken=texture2D(grassSurface,world*.112+vec2(.19,.43)).a;
      vec2 uv=world*.50+vec2(broken,broad)*.61;
      vec3 nearGrass=texture2D(grassAlbedo,uv).rgb;
      vec4 field=texture2D(meadowScan,aspect*.075+vec2(broken,broad)*.36);
      float fieldLight=clamp(1.+1.38*(dot(field.rgb,vec3(1.9,4.9,.67))-.96),.50,1.52);
      float straw=smoothstep(.25,.82,1.-broad+.28*(broken-.52));
      grass.albedo=nearGrass*mix(vec3(.74,1.12,.83),vec3(1.03,.97,.78),straw)
                    *mix(.82,1.14,broken)*fieldLight;
      grass.relief=texture2D(grassSurface,uv).rgb;
      grass.cover=smoothstep(.19,.73,habitat+.57*(broad-.55)+.32*(broken-.55));
      grass.height=field.a*.31;
      #endif
      return grass;
    }
    vec3 tuftRelief(vec3 normal,vec3 viewPosition,GroundGrass grass) {
      vec3 dx=dFdx(viewPosition),dy=dFdy(viewPosition);
      vec3 right=cross(dy,normal),forward=cross(normal,dx);
      float area=dot(dx,right);
      vec3 gradient=dFdx(grass.height)*right+dFdy(grass.height)*forward;
      return normalize(max(.0000001,abs(area))*normal-sign(area)*gradient*grass.cover);
    }
    vec3 meadowTint(vec3 forestTint,float cover) {
      return mix(forestTint,forestTint*.68+vec3(.33,.37,.32),cover);
    }
  `;
  const surfaceShader=renderer=>(renderer.capabilities.maxTextures<12?'\n#define TUFT_COMPACT\n':'')+groundSource;

  // Tufts grow in broken runs out of the wheel-worn shoulder, and then in
  // broader colonies on sunlit banks. The shop yard and shrine steps have
  // hard surfaces. Keep roots clear of the road, retaining walls and aprons.
  function* scatterSteps(course,grid,walls,project,random) {
    const plants=[[],[],[],[]],split=course.splits[0],finish=course.finish;
    function put(x,z,nearest,kind,height,width,canopy) {
      const y=project(x,z,nearest.y),step=Math.max(.18,width*.34);
      const sx=(project(x+step,z,y)-y)/step,sz=(project(x,z+step,y)-y)/step;
      if(sx*sx+sz*sz>1.90)return;
      plants[kind].push({x,z,y:y-height*.045,h:height,w:width,turn:random()*Math.PI*2,
        slopeX:sx,slopeZ:sz,shade:.80+.22*canopy+random()*.13,warm:.92+random()*.17});
    }
    function hardSurface(s,side,offset) {
      if(side<0 && s>split-39 && s<split-4 && offset<24)return true;
      if(side>0 && s>finish-26 && s<finish+23 && offset<28)return true;
      return walls.some(w=>w.side===side && s>w.start-1 && s<w.end+1 && Math.abs(offset-w.offset)<1.22);
    }
    let batch=0;
    for(const side of [-1,1]) {
      for(let s=2;s<course.length-2;s+=.75+random()*1.18) {
        if((batch++ & 63)===0)yield;
        const off=course.half+.60+random()**1.52*6.6;
        const center=course.at(s,side*off),canopy=coverAt(grid,center.x,center.z);
        const stand=noise(s*.063,side*19+.6)+.21*noise(s*.17,side+4);
        if(random()>.39+.72*canopy || stand<.23)continue;
        const count=2+Math.floor(random()*5);
        for(let k=0;k<count;k++) {
          const d=Math.max(course.half+.38,off+(random()-.5)*2.3);
          const station=s+(random()-.5)*4.5;
          if(hardSurface(station,side,d))continue;
          const point=course.at(station,side*d),nearest=course.nearest(point.x,point.z);
          if(Math.abs(nearest.s-station)>16 && nearest.distance<course.half+1)continue;
          const cropped=T.MathUtils.smoothstep(d-course.half,.37,2.8);
          const kind=cropped>.6 && stand>.79 && canopy>.48 ? 2 : cropped>.42 && stand>.52 ? 1 : 0;
          const clearance=.42+.58*T.MathUtils.smoothstep(d-course.half,.38,1.61);
          const h=((.13+random()*.18)+cropped*((kind===0?.09:kind===1?.25:.51)+random()*.22))*clearance;
          put(point.x,point.z,nearest,kind,h,h*(kind===2?.98+random()*.58:1.6+random()*1.03),canopy);
        }
      }
      // A staggered set of colonies extends across the visible face of a hill.
      // Most are short mixed grass. Silver plumes occur together in the drier
      // stands, so they don't form a dotted line beside the guardrail.
      const spacing=window.innerWidth<760?1.20:1;
      for(let s=2;s<course.length;s+=(3.4+random()*2.3)*spacing) {
        if((batch++ & 7)===0)yield;
        for(let off=course.half+4+random()*3;off<61;off+=(3.5+random()*2.8)*spacing) {
          const station=s+(random()-.5)*3.8,p=course.at(station,side*off);
          const canopy=coverAt(grid,p.x,p.z);
          if(canopy<.28 || random()>canopy*1.13)continue;
          const stand=noise(p.x*.047,p.z*.047);
          if(stand<.20)continue;
          const silverGrass=course.mapId==='fuji'?TougeFuji.meadow(station):0;
          const dominant=stand>.72-.23*silverGrass ? 3 : stand>.57-.18*silverGrass ? 2 : stand>.39 ? 1 : 0;
          const near=course.nearest(p.x,p.z);
          if(Math.abs(near.s-station)>22 && near.distance<off-2)continue;
          const count=4+Math.floor(random()*(stand>.53?10:6));
          for(let i=0;i<count;i++) {
            const x=p.x+(random()-.5)*5.9,z=p.z+(random()-.5)*5.9;
            const nearest=course.nearest(x,z,near.i);
            if(nearest.distance<course.half+2.2||hardSurface(nearest.s,Math.sign(nearest.offset),nearest.distance))continue;
            const kind=random()<.74?dominant:Math.floor(random()*2);
            const h=(kind===3?.63:kind===2?.42:kind===1?.27:.16)+random()*(kind===3?.71:kind===2?.45:.30);
            put(x,z,nearest,kind,h,h*((kind>1?1.12:1.95)+random()*.89),canopy);
          }
        }
      }
    }
    return plants;
  }
  function scatter(course,grid,walls,project,random) {
    const steps=scatterSteps(course,grid,walls,project,random);
    let result;
    do {result=steps.next();} while(!result.done);
    return result.value;
  }
  window.TougeGrass={habitat,coverAt,surfaceMaps,surfaceShader,scatter,scatterSteps};
})();
