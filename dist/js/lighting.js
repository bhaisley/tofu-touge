(() => {
  'use strict';
  const T = THREE;
  const sunlight = new T.Vector3(.76, .28, -.59).normalize();
  const moonlight = new T.Vector3(-.55,.52,.76).normalize();
  const shadowsFor = light => {
    const right = new T.Vector3().crossVectors(new T.Vector3(0,1,0),light).normalize();
    return {light,right,up:new T.Vector3().crossVectors(light,right)};
  };
  const dayShadow=shadowsFor(sunlight), nightShadow=shadowsFor(moonlight);
  // All receivers use the same sun shadow. Ease its last few metres into the
  // baked canopy shade as the moving shadow camera crosses the scenery.
  T.ShaderChunk.shadowmap_pars_fragment = T.ShaderChunk.shadowmap_pars_fragment.replace('return shadow;', `
      vec2 edgeDistance = min(shadowCoord.xy, 1. - shadowCoord.xy);
      return mix(1., shadow, smoothstep(0., .085, min(edgeDistance.x,edgeDistance.y)));`);
  const horizonSource = `
    uniform sampler2D panorama;
    uniform float ready, night;
    uniform vec3 moonlight;
    float ridgeHeight(float u) {
      // Angular silhouette of the far ridges in the Haruna panorama.
      float a=u*6.2831853;
      return .429+.0036*cos(a)-.0022*cos(2.*a)+.0038*sin(2.*a)
        +.0038*sin(3.*a)-.0036*cos(4.*a)+.0035*sin(4.*a);
    }
    vec3 horizonColor(vec3 d) {
      float u = atan(d.x, -d.z) / 6.2831853 + .583;
      float v = .220 + asin(clamp(d.y, -1., 1.)) * .73;
      vec3 photo = texture2D(panorama, vec2(u, clamp(v, .002, .998))).rgb;
      if(night>.5) {
        float ridge=ridgeHeight(u), altitude=smoothstep(.18,.98,d.y);
        float lunarAngle=max(0.,dot(d,moonlight));
        vec3 sky=mix(vec3(.025,.039,.064),vec3(.004,.009,.022),altitude);
        sky+=vec3(.012,.018,.028)*pow(lunarAngle,14.);
        // Retain cloud and valley detail, removing the photographed sunrise.
        float luma=min(.45,dot(photo,vec3(.27,.64,.09)));
        float solar=1.-smoothstep(.016,.067,abs(fract(u)-.727));
        float thinCloud=(.29-luma)*ready*(1.-solar)*(1.-smoothstep(.89,.98,v));
        sky*=1.+clamp(thinCloud,-.13,.14)*smoothstep(ridge,ridge+.085,v);
        float mist=mix(.16,clamp(luma*(1.-solar*.80)*2.45,0.,1.),ready);
        vec3 land=mix(vec3(.0025,.0044,.0067),vec3(.016,.027,.039),mist);
        land+=vec3(.003,.0045,.006)*smoothstep(.25,ridge,v);
        float ridgeDetail=(luma-.23)*.069*ready*(1.-solar);
        return mix(land,sky,smoothstep(ridge-.0025,ridge+.0025,v+ridgeDetail));
      }
      vec3 fallback = mix(vec3(.33,.39,.42),vec3(.47,.58,.68),smoothstep(-.05,.62,d.y));
      return mix(vec3(.033,.040,.031), mix(fallback,photo,ready), smoothstep(-.42,.06,v));
    }`;

  const tiles = new Map();
  function tile(filename, colorSpace) {
    if (tiles.has(filename)) return tiles.get(filename);
    const map = new T.TextureLoader().load(window.TougeArtURLs?.[filename] || 'assets/art/' + filename);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.colorSpace = colorSpace; map.anisotropy = 8;
    tiles.set(filename,map);
    return map;
  }
  function scannedSurface(name, normalStrength, extra = {}) {
    const albedo = tile(name + '.webp', T.SRGBColorSpace);
    const surface = tile(name + '-surface.webp', T.NoColorSpace);
    const material = new T.MeshStandardMaterial({
      map: albedo, normalMap: surface, roughnessMap: surface, roughness: 1,
      normalScale: new T.Vector2(normalStrength, normalStrength), ...extra
    });
    material.onBeforeCompile = shader => {
      // Both maps share UVs. Read tangent XY and roughness in one texture fetch.
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <roughnessmap_fragment>', `
          vec3 scan = texture2D(roughnessMap, vRoughnessMapUv).rgb;
          float roughnessFactor = max(.11, roughness * scan.b);`)
        .replace('#include <normal_fragment_maps>', `
          vec2 scanXY = scan.rg * 2.0 - 1.0;
          vec3 scanNormal = vec3(scanXY * normalScale, sqrt(max(.001, 1.0 - dot(scanXY, scanXY))));
          normal = normalize(tbn * scanNormal);`);
    };
    return material;
  }

  function makeSky(scene, renderer) {
    const material = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false, toneMapped: false,
      extensions:{derivatives:true},
      uniforms: {panorama: {value: null}, ready: {value: 0}, sunlight: {value: sunlight}, radiance: {value: 0},
        night:{value:0},moonlight:{value:moonlight}},
      vertexShader: `varying vec3 direction;
        void main() {
          direction = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position.z = gl_Position.w * .999999;
        }`,
      fragmentShader: `varying vec3 direction;
        ${horizonSource}
        uniform vec3 sunlight;
        uniform float radiance;
        float starSeed(vec2 p){
          vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
          q+=dot(q,q.yzx+33.33);
          return fract((q.x+q.y)*q.z);
        }
        float starlight(vec2 angles,float altitude){
          vec2 grid=angles*vec2(640.,320.);
          vec2 cell=floor(grid);
          float magnitude=starSeed(cell);
          vec2 center=.23+.54*vec2(starSeed(cell+31.7),starSeed(cell+73.1));
          vec2 local=(fract(grid)-center)*vec2(max(.22,cos(altitude)),1.);
          float r=.026+.044*pow(starSeed(cell+14.),3.);
          float pixel=max(length(dFdx(local)),length(dFdy(local)));
          float kernel=r*r+.31*pixel*pixel;
          return smoothstep(.972,.994,magnitude)*exp(-dot(local,local)/kernel)*r*r/kernel;
        }
        void main() {
          vec3 d = normalize(direction);
          vec3 sky = horizonColor(d);
          if(night>.5){
            vec2 angles=vec2(atan(d.x,-d.z)/6.2831853+.5,asin(clamp(d.y,-1.,1.))/3.14159265+.5);
            vec3 across=normalize(cross(vec3(0.,1.,0.),moonlight)),up=cross(moonlight,across);
            vec2 disc=vec2(dot(d,across),dot(d,up))/.0073;
            float r=length(d-moonlight);
            float stars=starlight(angles,(angles.y-.5)*3.14159265);
            sky+=vec3(.75,.84,1.)*stars*smoothstep(.30,.55,d.y)*smoothstep(.02,.16,r);
            sky+=vec3(.046,.063,.088)*exp(-20.*r)+vec3(.12,.14,.17)*exp(-126.*r);
            float lunar=1.-smoothstep(.0067,.00785,r);
            if(lunar>.001){
              float relief=sqrt(max(0.,1.-dot(disc,disc)));
              float phase=smoothstep(-.19,.25,dot(vec3(disc,relief),vec3(-.54,.19,.82)));
              float maria=exp(-19.*dot(disc-vec2(.18,.15),disc-vec2(.18,.15)))
                +.67*exp(-25.*dot(disc-vec2(-.30,.41),disc-vec2(-.30,.41)))
                +.46*exp(-31.*dot(disc-vec2(.25,-.32),disc-vec2(.25,-.32)));
              vec3 face=vec3(.94,.97,.99)*(.13+.87*phase)*(.96-.27*maria);
              sky=mix(sky,face*(1.+4.0*radiance),lunar);
            }
          }else{
            // Recover the photographed sun's radiance for the lighting probe.
            float solarDisc=smoothstep(.99968,.99998,dot(d,sunlight));
            sky+=vec3(4.0,3.0,1.7)*solarDisc*radiance;
          }
          gl_FragColor = vec4(sky, 1.);
          #include <colorspace_fragment>
        }`
    });
    const geometry = new T.SphereGeometry(1900, 64, 30);
    const sky = new T.Mesh(geometry, material);
    sky.name = 'Haruna dawn'; sky.frustumCulled = false; sky.renderOrder = -100;
    scene.add(sky);
    const environments=[null,null];
    function setNight(night){
      const key=night?1:0;
      material.uniforms.night.value=key;sky.name=night?'Moon above Haruna Pass':'Haruna dawn';
      if(!material.uniforms.ready.value){scene.environment=null;return;}
      if(!environments[key]){
        const capture = new T.Scene();
        const dome = new T.Mesh(geometry, material); dome.frustumCulled = false; capture.add(dome);
        const pmrem = new T.PMREMGenerator(renderer);
        const shadows = renderer.shadowMap.autoUpdate;
        renderer.shadowMap.autoUpdate = false;
        material.uniforms.radiance.value = 1;
        try {
          environments[key]=pmrem.fromScene(capture,0,.2,2400);
        } finally {
          material.uniforms.radiance.value = 0; renderer.shadowMap.autoUpdate = shadows; pmrem.dispose();
        }
      }
      sky.userData.environment=environments[key];
      scene.environment=environments[key].texture;
    }
    sky.userData.setNight=setNight;
    new T.TextureLoader().load(window.TougeArtURLs?.['haruna-sky.webp'] || 'assets/art/haruna-sky.webp', texture => {
      texture.colorSpace = T.SRGBColorSpace; texture.wrapS = T.RepeatWrapping;
      material.uniforms.panorama.value = texture;material.uniforms.ready.value = 1;
      setNight(material.uniforms.night.value===1);
    });
    return sky;
  }

  function detailTerrainMaterial(material, sky) {
    const scan = material.onBeforeCompile;
    const cliff = tile('haruna-volcanic.webp', T.SRGBColorSpace);
    const cliffSurface = tile('haruna-volcanic-surface.webp', T.NoColorSpace);
    const grassMaps=TougeGrass.surfaceMaps();
    material.onBeforeCompile = (shader,renderer) => {
      scan(shader);
      const uniforms = sky.material.uniforms;
      for(const key of ['panorama','ready','night','moonlight'])shader.uniforms[key]=uniforms[key];
      shader.uniforms.cliff = {value:cliff}; shader.uniforms.cliffSurface = {value:cliffSurface};
      Object.assign(shader.uniforms,grassMaps);
      const surfaceVaryings = 'varying float passRim, passGrass; varying vec3 passLand; varying vec3 passSlope;\n';
      shader.vertexShader = 'attribute float rim, grassCover;\n' + surfaceVaryings + shader.vertexShader
        .replace('#include <project_vertex>', `#include <project_vertex>
          passLand=(modelMatrix*vec4(transformed,1.)).xyz; passRim=rim; passGrass=grassCover;
          passSlope=mat3(modelMatrix)*normal;`);
      shader.fragmentShader = 'uniform sampler2D cliff,cliffSurface;\n' + surfaceVaryings + horizonSource + TougeGrass.surfaceShader(renderer) + shader.fragmentShader
        .replace('#include <map_fragment>', `#include <map_fragment>
          // Thin soil exposes bedrock along the steeper faces. Project each
          // scan vertically so its grain retains scale on the pitch of the cut.
          vec3 slopeNormal=normalize(passSlope);
          GroundGrass grass=sampleGroundGrass(passLand.xz,passGrass);
          grass.cover*=1.-smoothstep(.17,.52,1.-abs(slopeNormal.y));
          diffuseColor.rgb=mix(diffuseColor.rgb,grass.albedo,grass.cover);
          float strata=.51+.24*sin(passLand.y*.47+passLand.x*.069)+.18*sin(passLand.z*.14+sin(passLand.x*.073));
          float exposure=smoothstep(.12,.31,1.-abs(slopeNormal.y))*smoothstep(.32,.68,strata)*.84;
          vec3 rockData=vec3(.5,.5,.79);
          if(exposure>.004){
            vec2 uvZ=vec2(passLand.x*sign(slopeNormal.z),passLand.y)/3.2;
            vec2 uvX=vec2(-passLand.z*sign(slopeNormal.x),passLand.y)/3.2;
            float aspect=smoothstep(.28,.72,abs(slopeNormal.x)/(abs(slopeNormal.x)+abs(slopeNormal.z)+.0001));
            vec3 beds=mix(texture2D(cliff,uvZ).rgb,texture2D(cliff,uvX).rgb,aspect);
            rockData=mix(texture2D(cliffSurface,uvZ).rgb,texture2D(cliffSurface,uvX).rgb,aspect);
            diffuseColor.rgb=mix(diffuseColor.rgb,beds*vec3(.89,.93,.92),exposure);
          }`)
        .replace('#include <color_fragment>','diffuseColor.rgb*=meadowTint(vColor,grass.cover*(1.-exposure));')
        .replace('roughness * scan.b','roughness * mix(mix(scan.b,grass.relief.b,grass.cover),rockData.b,exposure)')
        .replace('vec2 scanXY = scan.rg *','vec2 scanXY = mix(scan.rg,grass.relief.rg,grass.cover) *')
        .replace('normal = normalize(tbn * scanNormal);', `normal = normalize(tbn * scanNormal);
          normal=tuftRelief(normal,-vViewPosition,grass);
          if(exposure>.004){
            vec3 tangent=normalize(vec3(slopeNormal.z,0.,-slopeNormal.x));
            vec2 xy=(rockData.rg*2.-1.)*.72;
            vec3 stoneNormal=normalize(slopeNormal*sqrt(max(.01,1.-dot(xy,xy)))+tangent*xy.x+cross(slopeNormal,tangent)*xy.y);
            normal=normalize(mix(normal,mat3(viewMatrix)*stoneNormal,exposure));
          }`)
        .replace('#include <fog_fragment>', `#include <fog_fragment>
          float atmosphericBlend=max(passRim,.50*smoothstep(225.,520.,length(passLand-cameraPosition)));
          if(atmosphericBlend>.001){
            vec3 distant = horizonColor(normalize(passLand-cameraPosition));
            gl_FragColor.rgb = mix(gl_FragColor.rgb,linearToOutputTexel(vec4(distant,1.)).rgb,atmosphericBlend);
          }`);
    };
    material.customProgramCacheKey = () => 'Haruna terrain';
  }

  function makeSun(scene, resolution) {
    const ambient=new T.HemisphereLight(0xe0eaf2, 0x806e58, .86);
    scene.add(ambient);
    const sun = new T.DirectionalLight(0xffe0b8, 2.65);
    sun.userData.setNight=night=>{
      sun.userData.night=night;sun.color.setHex(night?0xc1d2ec:0xffe0b8);sun.intensity=night?.21:2.65;
      ambient.color.setHex(night?0x9bb7de:0xe0eaf2);ambient.groundColor.setHex(night?0x515367:0x806e58);
      ambient.intensity=night?.36:.86;
    };
    sun.castShadow = true;
    const span = resolution >= 2048 ? 52 : 42;
    const shadow = sun.shadow;
    shadow.mapSize.set(resolution, resolution);
    Object.assign(shadow.camera, {left: -span, right: span, bottom: -span, top: span, near: 1, far: 252});
    shadow.camera.updateProjectionMatrix(); shadow.bias = -.00008; shadow.normalBias = .028;
    scene.add(sun, sun.target);
    return sun;
  }

  function headlampPattern() {
    // A Japanese dipped beam steps up towards the left verge. Its hot spot
    // is just beneath the cut-off, above the broader foreground fill.
    const size=128,data=new Uint8Array(size*size*4);
    for(let j=0;j<size;j++)for(let i=0;i<size;i++){
      const x=2*(i+.5)/size-1,y=2*(j+.5)/size-1;
      const cutoff=.028+.12*T.MathUtils.smoothstep(-x,.015,.52);
      const upper=1-T.MathUtils.smoothstep(y,cutoff-.024,cutoff+.048);
      const down=Math.max(0.,-y-.022);
      const beam=Math.exp(-1.35*x*x)*(.075+.925*Math.exp(-23*down*down));
      const v=Math.round(255*beam*(.042+.958*upper)),p=4*(j*size+i);
      data[p]=data[p+1]=data[p+2]=v;data[p+3]=255;
    }
    const map=new T.DataTexture(data,size,size);map.magFilter=map.minFilter=T.LinearFilter;
    map.name='Left-hand-traffic dipped beam';map.needsUpdate=true;return map;
  }

  function trackSun(sun, x, y, z, fx, fz) {
    const {light,right:shadowRight,up:shadowUp}=sun.userData.night?nightShadow:dayShadow;
    const target = sun.target.position.set(x + fx * 19, y - 1.0, z + fz * 19);
    const texel = 2 * sun.shadow.camera.right / sun.shadow.mapSize.x;
    const across = target.dot(shadowRight), up = target.dot(shadowUp);
    target.addScaledVector(shadowRight, Math.round(across / texel) * texel - across);
    target.addScaledVector(shadowUp, Math.round(up / texel) * texel - up);
    sun.position.copy(target).addScaledVector(light, 124);
    sun.target.updateMatrixWorld();
  }

  window.TougeLighting = {scannedSurface, detailTerrainMaterial, makeSky, makeSun, trackSun,headlampPattern};
})();
