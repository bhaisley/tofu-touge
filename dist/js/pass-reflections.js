(() => {
  'use strict';
  const T = THREE;
  function layout(length) {
    const count = Math.ceil(length / 34) + 1, columns = 10;
    return {count, columns, rows: Math.ceil(count / columns), size: 128, border: 2, spacing: length / (count - 1)};
  }

  // Six cosine-weighted hemispheres per station describe bounced light from
  // the road, forest and sky. Decode a thumbnail once, outside the frame loop.
  function diffuseProbes(image, grid) {
    const tile=24, canvas=document.createElement('canvas');
    canvas.width=grid.columns*tile;canvas.height=grid.rows*tile;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,image.width,image.height/2,0,0,canvas.width,canvas.height);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const decode=Array.from({length:256},(_,x)=>2**(x/255*3.169925)-1),samples=[],weights=new Float32Array(6);
    const size=grid.size,border=grid.border;
    for(let j=0;j<384;j++) {
      const y=1-2*(j+.5)/384,r=Math.sqrt(1-y*y),phi=j*2.39996323;
      const x=Math.cos(phi)*r,z=Math.sin(phi)*r,inv=1/(Math.abs(x)+Math.abs(y)+Math.abs(z));
      let u=x*inv,v=y*inv;
      if(z<0){const a=u;u=(1-Math.abs(v))*(a<0?-1:1);v=(1-Math.abs(a))*(v<0?-1:1);}
      const coord=k=>Math.min(tile-1,Math.floor(tile*(border+.5+(.5+.5*k)*(size-2*border-1))/size));
      const lobes=[x,-x,y,-y,z,-z].map(n=>Math.max(0,n));
      lobes.forEach((n,i)=>{weights[i]+=n;});
      samples.push({offset:4*(coord(u)+canvas.width*coord(v)),lobes});
    }
    const result=new Float32Array(grid.count*18);
    for(let k=0;k<grid.count;k++) {
      const base=4*tile*((k%grid.columns)+Math.floor(k/grid.columns)*canvas.width);
      for(const {offset,lobes} of samples)for(let axis=0;axis<6;axis++){
        if(!lobes[axis])continue;
        const w=lobes[axis]/weights[axis],start=k*18+3*axis;
        for(let c=0;c<3;c++)result[start+c]+=w*decode[pixels[base+offset+c]];
      }
    }
    return result;
  }

  // Local probes contain the actual ridge, branches, rail and verge at each station.
  // Capture is done when authoring the pass. Driving only interpolates two neighbours.
  function install(car, course) {
    const grid = layout(course.length);
    let bounce=null,night=false;
    const uniforms = {
      passRadiance: {value: null}, passLoaded: {value: 0}, passBlend: {value: 0},passNightMask:{value:0},
      passCenters: {value: [new T.Vector3(), new T.Vector3()]},
      passTiles: {value: [new T.Vector2(), new T.Vector2()]},
      passDiffuseLight:{value:Array.from({length:6},()=>new T.Vector3())},
      parkedProbe:{value:0},parkedCenter:{value:new T.Vector3()}
    };
    const loader = new T.TextureLoader();
    loader.load(window.TougeArtURLs?.['haruna-reflections.webp'] || 'assets/art/haruna-reflections.webp', map => {
      // The baker writes north-up octahedra in top-down atlas order.
      map.flipY = false; map.colorSpace = T.NoColorSpace;
      map.generateMipmaps = false; map.minFilter = T.LinearFilter;
      bounce=diffuseProbes(map.image,grid);
      uniforms.passRadiance.value = map; uniforms.passLoaded.value = night?0:1;
      uniforms.passNightMask.value=night?1:0;
    });
    const fragment = `
      uniform sampler2D passRadiance;
      uniform float passLoaded, passBlend, parkedProbe, passNightMask;
      uniform vec3 parkedCenter, passDiffuseLight[6];
      uniform vec3 passCenters[2];
      uniform vec2 passTiles[2];
      varying vec3 passPosition;
      vec2 passOct(vec3 r) {
        r /= dot(abs(r), vec3(1.));
        vec2 side = vec2(r.x < 0. ? -1. : 1., r.y < 0. ? -1. : 1.);
        return .5 + .5 * (r.z < 0. ? (1. - abs(r.yx)) * side : r.xy);
      }
      vec3 passSourceLight(vec3 rgb) {
        #ifdef TOUGE_LACQUER
          // The pass is photographed in SDR. Dark canopy sits near .10 in
          // linear light and the bright open sky reaches .70. Restore the
          // illuminant's headroom before blending captures or filtering the coat.
          float luminance=dot(rgb,vec3(.2126,.7152,.0722));
          float sky=2.7*smoothstep(.12,.71,luminance)/max(1.,luminance);
          return rgb*(1.+sky);
        #else
          return rgb;
        #endif
      }
      vec2 passCoords(vec3 ray, vec3 center, vec2 tile) {
        vec3 offset = passPosition - center;
        float rd = dot(offset, ray);
        float hit = max(1., -rd + sqrt(max(1., rd * rd + 30. * 30. - dot(offset, offset))));
        vec2 uv = passOct(normalize(offset + ray * hit));
        return (tile + (${grid.border}.5 + uv * ${grid.size - 2 * grid.border - 1}.) / ${grid.size}.) /
             vec2(${grid.columns}., ${2 * grid.rows}.);
      }
      vec3 passSample(vec3 ray, vec3 center, vec2 tile, float roughness) {
        vec2 uv=passCoords(ray,center,tile);
        vec3 sharp = texture2D(passRadiance, uv).rgb;
        vec3 wide = texture2D(passRadiance, uv + vec2(0.,.5)).rgb;
        float blur=smoothstep(.055,.34,roughness);
        #ifdef TOUGE_LACQUER
          return mix(passSourceLight(exp2(sharp*3.169925)-1.),passSourceLight(exp2(wide*3.169925)-1.),blur);
        #else
          return exp2(mix(sharp,wide,blur)*3.169925)-1.;
        #endif
      }
      vec3 passLocalReflection(vec3 ray,float roughness) {
        vec3 a = passSample(ray, passCenters[0], passTiles[0], roughness);
        vec3 b = passSample(ray, passCenters[1], passTiles[1], roughness);
        return mix(a,b,passBlend);
      }
      vec3 passReflection(vec3 ray,float roughness,vec3 distant) {
        if(passNightMask>.5){
          if(parkedProbe>.5 || roughness>.64)return distant;
          // The stationary tree line still occludes the night sky. Use only
          // its angular visibility; all reflected radiance comes from the moonlit environment.
          vec2 blur=vec2(0.,roughness > .28 ? .5 : 0.);
          vec3 a=texture2D(passRadiance,passCoords(ray,passCenters[0],passTiles[0])+blur).rgb;
          vec3 b=texture2D(passRadiance,passCoords(ray,passCenters[1],passTiles[1])+blur).rgb;
          float sky=smoothstep(.044,.190,dot(mix(a,b,passBlend),vec3(.21,.72,.07)));
          return distant*mix(.24,1.,mix(sky,1.,smoothstep(.34,.64,roughness)));
        }
        distant=passSourceLight(distant);
        if(passLoaded < .5 || parkedProbe>.5 || roughness>=.73) return distant;
        return mix(passLocalReflection(ray,roughness),distant,smoothstep(.38,.73,roughness));
      }
      vec3 passIrradiance(vec3 n,vec3 sky) {
        if(passLoaded<.5 || parkedProbe>.5)return sky;
        vec3 w=n*n;
        vec3 local=w.x*(n.x>=0.?passDiffuseLight[0]:passDiffuseLight[1])
          +w.y*(n.y>=0.?passDiffuseLight[2]:passDiffuseLight[3])
          +w.z*(n.z>=0.?passDiffuseLight[4]:passDiffuseLight[5]);
        return mix(sky,local,.84);
      }`;
    const materials = new Set();
    car.traverse(mesh => {
      if (mesh.isMesh && mesh.material.isMeshStandardMaterial) materials.add(mesh.material);
    });
    for (const material of materials) {
      const prepare = material.onBeforeCompile.bind(material);
      const priorKey = material.customProgramCacheKey();
      material.onBeforeCompile = (shader,renderer) => {
        prepare(shader,renderer);
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = 'varying vec3 passPosition;\n' + shader.vertexShader
          .replace('#include <project_vertex>', '#include <project_vertex>\n passPosition = (modelMatrix * vec4(transformed,1.)).xyz;');
        let environment = T.ShaderChunk.envmap_physical_pars_fragment.replace('return PI * envMapColor.rgb * envMapIntensity;',
          'return PI * passIrradiance(worldNormal, envMapColor.rgb) * envMapIntensity;');
        if(material.userData.routeReflections)environment=environment
          .replace('vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );', `
            // Smooth driving surfaces are lit entirely by the local captures.
            if(passLoaded>.5 && parkedProbe<.5 && roughness<=.38)
              return passLocalReflection(reflectVec,roughness)*envMapIntensity;
            if(parkedProbe>.5){
              vec3 delta=passPosition-parkedCenter;
              float h=dot(delta,reflectVec);
              reflectVec=normalize(delta+reflectVec*(-h+sqrt(max(1.,h*h+400.-dot(delta,delta)))));
            }
            vec4 envMapColor=textureCubeUV(envMap,reflectVec,roughness);`)
          .replace('return envMapColor.rgb * envMapIntensity;',
            'return passReflection(reflectVec, roughness, envMapColor.rgb) * envMapIntensity;');
        if(material.userData.lacquer)shader.fragmentShader=shader.fragmentShader.replace(
          '#include <lights_physical_fragment>',
          '#include <lights_physical_fragment>\n #ifdef USE_CLEARCOAT\n material.clearcoatF0=vec3(.052);\n #endif');
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', '#include <common>\n' + (material.userData.lacquer?'#define TOUGE_LACQUER\n':'') + fragment)
          .replace('#include <envmap_physical_pars_fragment>', environment);
      };
      material.customProgramCacheKey = () => priorKey + (material.userData.lacquer?'/haruna-lacquer':
        material.userData.routeReflections?'/haruna-reflections':'/haruna-bounce');
    }
    let previous = -1;
    let parkedTexture=null;
    function setParked(texture,center){
      if(texture===parkedTexture)return;
      parkedTexture=texture;uniforms.parkedProbe.value=texture?1:0;
      if(center)uniforms.parkedCenter.value.copy(center);
      for(const material of materials){material.envMap=texture;material.needsUpdate=true;}
    }
    function update(station) {
      const f = T.MathUtils.clamp(station / grid.spacing, 0, grid.count - 1);
      const first = Math.min(grid.count - 2, Math.floor(f));
      uniforms.passBlend.value = T.MathUtils.smoothstep(f - first, 0, 1);
      if(bounce && !night){
        const t=uniforms.passBlend.value;
        uniforms.passDiffuseLight.value.forEach((v,axis)=>{
          const j=first*18+axis*3;
          v.set(T.MathUtils.lerp(bounce[j],bounce[j+18],t),T.MathUtils.lerp(bounce[j+1],bounce[j+19],t),
            T.MathUtils.lerp(bounce[j+2],bounce[j+20],t));
        });
      }
      if (previous === first) return;
      previous = first;
      for (let i = 0; i < 2; i++) {
        const k = first + i, p = course.sample(k * grid.spacing);
        uniforms.passTiles.value[i].set(k % grid.columns, Math.floor(k / grid.columns));
        uniforms.passCenters.value[i].set(p.x, p.y + 1.3, p.z);
      }
    }
    function setNight(value){
      night=value;
      uniforms.passLoaded.value=bounce && !night?1:0;
      uniforms.passNightMask.value=bounce && night?1:0;
      setParked(null);
    }
    return {setParked,setNight,update};
  }

  // A parked car can afford a higher-resolution capture at its actual glass
  // height. Reuse the filtered cube for every orbit angle and subsequent visit.
  function captureParked(world,center){
    const {renderer,scene,sky,rig,wetRoad}=world,shadow=renderer.shadowMap;
    const floatTarget=renderer.capabilities.isWebGL2?'EXT_color_buffer_float':'EXT_color_buffer_half_float';
    if(!renderer.extensions.has(floatTarget))return null;
    // Resolve fine branches and the skyline on the parked glass at close zoom.
    // Driving uses the pass atlas. Only the walkaround allocates this capture.
    const size=innerWidth<760?128:renderer.domElement.width>=1350&&renderer.capabilities.maxTextureSize>=2048?512:256;
    const cube=new T.WebGLCubeRenderTarget(size,{type:T.HalfFloatType,minFilter:T.LinearFilter});
    const eye=new T.CubeCamera(.15,2350,cube),filter=new T.PMREMGenerator(renderer);
    const target=renderer.getRenderTarget(),skyAt=sky.position.clone(),sun=sky.material.uniforms.radiance;
    const oldAuto=shadow.autoUpdate,oldWet=wetRoad.uniforms.wetReady.value,oldSun=sun.value;
    const visible=world.groundPatches.map(p=>p.mesh.visible),rigVisible=rig.visible;
    const hiddenBody=[];
    try{
      eye.position.copy(center);sky.position.copy(center);sun.value=1;
      if(world.course.night){
        // The body must be absent from its own capture, but its headlamps
        // still illuminate the tarmac and foliage reflected in the glass.
        rig.traverse(obj=>{if(obj.isMesh && obj.visible){hiddenBody.push(obj);obj.visible=false;}});
      }else rig.visible=false;
      world.groundPatches.forEach(p=>{p.mesh.visible=false;});wetRoad.uniforms.wetReady.value=0;
      shadow.autoUpdate=false;shadow.needsUpdate=true;
      eye.update(renderer,scene);
      return filter.fromCubemap(cube.texture);
    }finally{
      rig.visible=rigVisible;for(const mesh of hiddenBody)mesh.visible=true;
      world.groundPatches.forEach((p,i)=>{p.mesh.visible=visible[i];});
      sun.value=oldSun;sky.position.copy(skyAt);wetRoad.uniforms.wetReady.value=oldWet;
      renderer.setRenderTarget(target);shadow.autoUpdate=oldAuto;shadow.needsUpdate=true;cube.dispose();filter.dispose();
    }
  }
  window.TougePassReflections = {layout, install, captureParked};
})();
