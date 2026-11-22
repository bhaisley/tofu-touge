(() => {
  'use strict';
  const T = THREE;
  const sunlight = new T.Vector3(.76, .28, -.59).normalize();
  const shadowRight = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), sunlight).normalize();
  const shadowUp = new T.Vector3().crossVectors(sunlight, shadowRight);
  // All receivers use the same sun shadow. Ease its last few metres into the
  // baked canopy shade as the moving shadow camera crosses the scenery.
  T.ShaderChunk.shadowmap_pars_fragment = T.ShaderChunk.shadowmap_pars_fragment.replace('return shadow;', `
      vec2 edgeDistance = min(shadowCoord.xy, 1. - shadowCoord.xy);
      return mix(1., shadow, smoothstep(0., .085, min(edgeDistance.x,edgeDistance.y)));`);
  const horizonSource = `
    uniform sampler2D panorama;
    uniform float ready;
    vec3 horizonColor(vec3 d) {
      float u = atan(d.x, -d.z) / 6.2831853 + .583;
      float v = .220 + asin(clamp(d.y, -1., 1.)) * .73;
      vec3 photo = texture2D(panorama, vec2(u, clamp(v, .002, .998))).rgb;
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
      uniforms: {panorama: {value: null}, ready: {value: 0}, sunlight: {value: sunlight}, radiance: {value: 0}},
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
        void main() {
          vec3 d = normalize(direction);
          vec3 sky = horizonColor(d);
          // The panorama is display-referred. Recover a compact sun for the lighting probe.
          float solarDisc = smoothstep(.99968, .99998, dot(d, sunlight));
          sky += vec3(4.0,3.0,1.7) * solarDisc * radiance;
          gl_FragColor = vec4(sky, 1.);
          #include <colorspace_fragment>
        }`
    });
    const geometry = new T.SphereGeometry(1900, 64, 30);
    const sky = new T.Mesh(geometry, material);
    sky.name = 'Haruna dawn'; sky.frustumCulled = false; sky.renderOrder = -100;
    scene.add(sky);
    new T.TextureLoader().load(window.TougeArtURLs?.['haruna-sky.webp'] || 'assets/art/haruna-sky.webp', texture => {
      texture.colorSpace = T.SRGBColorSpace; texture.wrapS = T.RepeatWrapping;
      material.uniforms.panorama.value = texture;
      material.uniforms.ready.value = 1;
      const capture = new T.Scene();
      const dome = new T.Mesh(geometry, material); dome.frustumCulled = false; capture.add(dome);
      const pmrem = new T.PMREMGenerator(renderer);
      const shadows = renderer.shadowMap.autoUpdate;
      renderer.shadowMap.autoUpdate = false;
      material.uniforms.radiance.value = 1;
      try {
        const environment = pmrem.fromScene(capture, 0, .2, 2400);
        scene.environment = environment.texture;
        sky.userData.environment = environment;
      } finally {
        material.uniforms.radiance.value = 0; renderer.shadowMap.autoUpdate = shadows; pmrem.dispose();
      }
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
      shader.uniforms.panorama = uniforms.panorama; shader.uniforms.ready = uniforms.ready;
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
    scene.add(new T.HemisphereLight(0xe0eaf2, 0x806e58, .86));
    const sun = new T.DirectionalLight(0xffe0b8, 2.65);
    sun.castShadow = true;
    const span = resolution >= 2048 ? 52 : 42;
    const shadow = sun.shadow;
    shadow.mapSize.set(resolution, resolution);
    Object.assign(shadow.camera, {left: -span, right: span, bottom: -span, top: span, near: 1, far: 252});
    shadow.camera.updateProjectionMatrix(); shadow.bias = -.00008; shadow.normalBias = .028;
    scene.add(sun, sun.target);
    return sun;
  }

  function trackSun(sun, x, y, z, fx, fz) {
    const target = sun.target.position.set(x + fx * 19, y - 1.0, z + fz * 19);
    const texel = 2 * sun.shadow.camera.right / sun.shadow.mapSize.x;
    const across = target.dot(shadowRight), up = target.dot(shadowUp);
    target.addScaledVector(shadowRight, Math.round(across / texel) * texel - across);
    target.addScaledVector(shadowUp, Math.round(up / texel) * texel - up);
    sun.position.copy(target).addScaledVector(sunlight, 124);
    sun.target.updateMatrixWorld();
  }

  window.TougeLighting = {scannedSurface, detailTerrainMaterial, makeSky, makeSun, trackSun};
})();
