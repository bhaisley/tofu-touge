(() => {
  'use strict';
  const T = THREE;
  // Coordinates and thresholds are shared by the road shader and tire spray.
  const waterPattern = {
    depression: [.031,.00096,.0115], runoff: [.0213,.31,.74], erosion: [.061,.19,.57],
    weights: [.76,.24,.15,.10], tire: [2.4,.55,.74], tireBand: [.14,.48],
    verge: [3.4,4.83], trackDrain: .15, edgeFill: .055, pool: [.573,.705]
  };

  function sampleDrainage(image, u, v, color) {
    const width = image.width, rows = image.height, pixels = image.data;
    const x = (u-Math.floor(u))*width-.5, y = (v-Math.floor(v))*rows-.5;
    const left = Math.floor(x), bottom = Math.floor(y), a = x-left, b = y-bottom;
    const col = (left+width)%width, row = (bottom+rows)%rows, next = (col+1)%width;
    const i = 4*(row*width+col), j = 4*(row*width+next);
    const k = 4*(((row+1)%rows)*width+col), l = 4*(((row+1)%rows)*width+next);
    for (let c=0;c<3;c++) color.setComponent(c,(
      (pixels[i+c]*(1-a)+pixels[j+c]*a)*(1-b) + (pixels[k+c]*(1-a)+pixels[l+c]*a)*b
    )/255);
  }

  function surfaceMap(renderer, name, rgb, metresPerTile, color) {
    const fallback = document.createElement('canvas');
    fallback.width = fallback.height = 2;
    const ctx = fallback.getContext('2d');
    ctx.fillStyle = rgb;
    ctx.fillRect(0, 0, 2, 2);
    const map = new T.Texture(fallback);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.repeat.setScalar(1 / metresPerTile);
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    map.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
    map.needsUpdate = true;
    const url = window.TougeArtURLs?.[name] || 'assets/art/' + name;
    new T.TextureLoader().load(url, loaded => {
      // WebGL2 allocates immutable storage for the temporary 2x2 image. A
      // larger photograph needs a new GPU allocation even on the same map.
      map.dispose();
      map.image = loaded.image;
      map.needsUpdate = true;
      loaded.dispose();
    });
    return map;
  }

  // Two periodic fields describe depressions at different scales. The road
  // samples them in metres, independently of the photographed aggregate tile.
  function drainageMap() {
    let seed = 0x86bf21;
    function lattice(n) {
      const grid = new Float32Array(n * n);
      for (let i = 0; i < grid.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        grid[i] = seed / 4294967296;
      }
      return (u, v) => {
        const x = u * n, y = v * n, ix = Math.floor(x), iy = Math.floor(y);
        let a = x - ix, b = y - iy;
        a = a * a * (3 - 2 * a);
        b = b * b * (3 - 2 * b);
        const k = iy * n, k1 = ((iy + 1) % n) * n, j = (ix + 1) % n;
        return (grid[k + ix] * (1 - a) + grid[k + j] * a) * (1 - b) +
          (grid[k1 + ix] * (1 - a) + grid[k1 + j] * a) * b;
      };
    }
    const coarse = lattice(5), broad = lattice(11), fine = lattice(23), pores = lattice(57);
    const size = 256, bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, k = (y * size + x) * 4;
      bytes[k] = 255 * (coarse(u,v) * .49 + broad(u,v) * .31 + fine(u,v) * .14 + pores(u,v) * .06);
      bytes[k + 1] = 255 * (fine(u,v) * .62 + pores(u,v) * .38);
      bytes[k + 2] = 255 * broad(u,v);
      bytes[k + 3] = 255;
    }
    const map = new T.DataTexture(bytes, size, size, T.RGBAFormat);
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.minFilter = T.LinearMipmapLinearFilter;
    map.magFilter = T.LinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  }

  const packedNormal = `
    vec2 stoneSlope = stoneData.rg * 2.0 - 1.0;
    float stoneZ = sqrt(max(0.04, 1.0 - dot(stoneSlope,stoneSlope)));
    normal = normalize(tbn * vec3(stoneSlope * normalScale * microRelief, stoneZ));
  `;

  class WetRoad {
    constructor(renderer, forestGround) {
      const capabilities = renderer.capabilities;
      this.enabled = capabilities.maxTextures >= 8;
      this.camera = new T.PerspectiveCamera();
      this.camera.userData.tougeReflectionPass = true;
      this.plane = new T.Plane();
      this.position = new T.Vector3();
      this.forward = new T.Vector3();
      this.clip = new T.Vector4();
      this.corner = new T.Vector4();
      this.eyeSize = new T.Vector2();
      this.excluded = [];
      this.visibility = [];
      this.gravelSections = [];
      this.gravelStation = -Infinity;
      this.pavedHalfWidth = 4.85;
      this.basinSample = new T.Vector3();
      this.runoffSample = new T.Vector3();
      this.erosionSample = new T.Vector3();
      this.elapsed = 1;
      this.lastEye=new T.Vector3(Infinity,Infinity,Infinity);
      this.lastCameraRotation=new T.Quaternion();
      this.useSmallTarget = false;
      this.timeOverBudget = 0;
      this.lastDrawCalls = 0;
      this.lastTriangles = 0;
      const halfFloat = capabilities.isWebGL2 && renderer.extensions.has('EXT_color_buffer_float');
      this.target = new T.WebGLRenderTarget(16, 16, {
        type: halfFloat ? T.HalfFloatType : T.UnsignedByteType,
        colorSpace: T.LinearSRGBColorSpace,
        minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true, stencilBuffer: false
      });
      this.target.texture.name = 'Local wet asphalt reflection';
      this.uniforms = {
        wetScene: { value: this.target.texture },
        wetProjection: { value: new T.Matrix4() },
        wetPlane: { value: new T.Vector4(0, 1, 0, 0) },
        wetStation: { value: 0 },
        wetTexel: { value: new T.Vector2(1 / 16, 1 / 16) },
        wetReady: { value: 0 },
        wetDrainage: { value: drainageMap() }
      };
      this.pavement = this.makePavement(renderer);
      this.forestGround = forestGround;
      this.shoulder = this.makeShoulder(renderer,forestGround?.map || forestGround);
    }

    makeShoulder(renderer,forestAlbedo) {
      const material = new T.MeshStandardMaterial({
        name: 'Compacted aggregate and soil',
        map: surfaceMap(renderer, 'shoulder-gravel.webp', '#716c65', 2.5, true),
        normalMap: surfaceMap(renderer, 'shoulder-gravel-surface.webp', '#8080ee', 2.5, false),
        normalScale: new T.Vector2(.58,.58), vertexColors: true, roughness: .9, envMapIntensity: .52
      });
      const litter = forestAlbedo || surfaceMap(renderer,'forest-floor.webp','#837b65',3.8,true);
      const grassMaps=TougeGrass.surfaceMaps();
      material.onBeforeCompile = shader => {
        shader.uniforms.vergeLitter = {value:litter};
        shader.uniforms.wetDrainage = this.uniforms.wetDrainage;
        Object.assign(shader.uniforms,grassMaps);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          attribute vec3 forestTint;
          attribute float grassCover;
          varying vec3 vergeTint;
          varying vec2 vergeWorld;
          varying float vergeAcross, vergeCover, vergeUp;
        `).replace('#include <begin_vertex>', `#include <begin_vertex>
          vergeWorld = (modelMatrix*vec4(transformed,1.)).xz;
          vergeAcross = uv.x;
          vergeTint = forestTint;
          vergeCover=grassCover; vergeUp=abs(normal.y);
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vergeTint;
          varying vec2 vergeWorld;
          varying float vergeAcross, vergeCover, vergeUp;
          uniform sampler2D vergeLitter;
          uniform sampler2D wetDrainage;
          ${TougeGrass.surfaceShader(renderer)}
        `).replace('#include <map_fragment>', `
          #include <map_fragment>
          float bankVariation = texture2D(wetDrainage,vergeWorld*.046).r;
          float leafBed = smoothstep(5.48,8.45,abs(vergeAcross)+(bankVariation-.5)*3.2);
          vec3 fallenLeaves = texture2D(vergeLitter,vergeWorld/3.8).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb,fallenLeaves,leafBed);
          GroundGrass grass=sampleGroundGrass(vergeWorld,vergeCover);
          grass.cover*=smoothstep(5.12,7.45,abs(vergeAcross)+(bankVariation-.5)*2.55)
                       *(1.-smoothstep(.17,.52,1.-vergeUp));
          diffuseColor.rgb=mix(diffuseColor.rgb,grass.albedo,grass.cover);
        `).replace('#include <color_fragment>', `
          diffuseColor.rgb*=mix(mix(vColor,vergeTint,leafBed),meadowTint(vergeTint,1.),grass.cover);
        `).replace('#include <roughnessmap_fragment>', `
          vec3 stoneData = texture2D(normalMap, vNormalMapUv).rgb;
          float roughnessFactor = mix(mix(.62,.96,stoneData.b),grass.relief.b,grass.cover);
          float microRelief = 1.0 - leafBed*.36;
        `).replace('#include <normal_fragment_maps>', `vec3 vergeNormal=normal;
          ${packedNormal}
          vec2 bladeSlope=(grass.relief.rg*2.-1.)*.75;
          vec3 grassNormal=normalize(getTangentFrame(-vViewPosition,vergeNormal,vergeWorld)
            *vec3(bladeSlope,sqrt(max(.001,1.-dot(bladeSlope,bladeSlope)))));
          normal=tuftRelief(normalize(mix(normal,grassNormal,grass.cover)),-vViewPosition,grass);`);
      };
      return material;
    }

    makePavement(renderer) {
      const material = new T.MeshStandardMaterial({
        name: 'Rain-darkened aggregate and road paint',
        map: surfaceMap(renderer, 'road-asphalt.webp', '#85817e', 4, true),
        normalMap: surfaceMap(renderer, 'road-asphalt-surface.webp', '#8080e8', 4, false),
        normalScale: new T.Vector2(.60,.60), roughness: .8, metalness: 0, envMapIntensity: .72
      });
      material.onBeforeCompile = shader => {
        Object.assign(shader.uniforms, this.uniforms);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
          varying vec2 roadMetres;
          varying vec3 roadWorld;
        `).replace('#include <begin_vertex>', `#include <begin_vertex>
          roadMetres = uv;
          roadWorld = (modelMatrix * vec4(transformed,1.)).xyz;
        `);
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
          varying vec2 roadMetres;
          varying vec3 roadWorld;
          uniform sampler2D wetDrainage;
          uniform sampler2D wetScene;
          uniform mat4 wetProjection;
          uniform vec4 wetPlane;
          uniform float wetStation;
          uniform vec2 wetTexel;
          uniform float wetReady;
        `).replace('#include <map_fragment>', `
          #include <map_fragment>
          const vec3 bedUV = vec3(${waterPattern.depression});
          const vec3 runUV = vec3(${waterPattern.runoff});
          const vec3 cutUV = vec3(${waterPattern.erosion});
          const vec4 weights = vec4(${waterPattern.weights});
          const vec3 tire = vec3(${waterPattern.tire});
          vec2 soilUV = vec2(dot(roadMetres,bedUV.xy),roadMetres.y*bedUV.z);
          vec3 basin = texture2D(wetDrainage,soilUV).rgb;
          vec3 runoff = texture2D(wetDrainage,roadWorld.xz*runUV.x+runUV.yz).rgb;
          vec3 stoneData = texture2D(normalMap,vNormalMapUv).rgb;
          float stoneLuma = dot(diffuseColor.rgb,vec3(.21,.72,.07));
          float across = abs(roadMetres.x);
          float trackDistance = abs(abs(across-tire.x+(runoff.b-.5)*tire.y)-tire.z);
          float wheelTrack = 1.0 - smoothstep(${waterPattern.tireBand},trackDistance);
          float verge = smoothstep(${waterPattern.verge},across);
          float erosion = texture2D(wetDrainage,roadWorld.xz*cutUV.x+cutUV.yz).g;
          float basinHeight = dot(vec4(basin.r,runoff.r,basin.g-.5,erosion-.5),weights);
          float water = smoothstep(.412,.675,basinHeight-wheelTrack*.115+verge*.045);
          float pool = smoothstep(${waterPattern.pool},basinHeight-wheelTrack*${waterPattern.trackDrain}+verge*${waterPattern.edgeFill});
          float film = clamp(.042 + water*.28 + pool*.68, 0., 1.);
          diffuseColor.rgb *= (.49 + .10*(runoff.b-.5)) * mix(1.,.52,film) * (1.-.10*wheelTrack);

          // Short runs of joint sealer follow the lane edge. Vary their
          // position and dogleg per station so a pattern never tiles uphill.
          float section = floor(roadMetres.y/31.);
          vec3 patchShape = texture2D(wetDrainage,vec2(section*.137+.31,section*.261+.47)).rgb;
          float alongPatch = mod(roadMetres.y,31.)-4.0-10.*patchShape.b;
          float patchLength = 2.2+7.0*patchShape.r;
          float patchSide = patchShape.g > .49 ? 1. : -1.;
          float patchEdge = patchSide*(1.55+2.45*patchShape.b) + alongPatch*(patchShape.r-.5)*.8
            + (texture2D(wetDrainage,vec2(section*.41,alongPatch*.033)).g-.5)*.24;
          float jointWidth = max(.003,fwidth(roadMetres.x-patchEdge));
          float joint = (1.-smoothstep(.009,.028+jointWidth*.45,abs(roadMetres.x-patchEdge)))
            * min(1.,.034/jointWidth) * smoothstep(0.,.19,alongPatch)
            * (1.-smoothstep(patchLength-.23,patchLength,alongPatch));
          diffuseColor.rgb *= 1.-joint*.55;
          float looseGravel = smoothstep(4.62,4.85,across+(runoff.g-.5)*.18);
          diffuseColor.rgb = mix(diffuseColor.rgb,diffuseColor.rgb*1.32+vec3(.013,.010,.006),
            looseGravel*(.37+.51*basin.g));

          // Paint is laid over the aggregate. Chips and abrasion appear in
          // both the pigment and the sheen; the markings receive real shadows.
          float aa = max(.005,fwidth(roadMetres.x)*.72);
          float edgeNoise = (basin.g-.5)*.012;
          float centre = 1.-smoothstep(.067-aa,.067+aa,abs(roadMetres.x+edgeNoise));
          float sideline = 1.-smoothstep(.056-aa,.056+aa,abs(across-4.52+edgeNoise));
          float chips = smoothstep(.146,.213,stoneLuma + (basin.g-.5)*.059);
          float paint = max(centre,sideline)*mix(.24,.96,chips);
          vec3 paintColor = mix(vec3(.56,.59,.54),vec3(.58,.29,.045),centre);
          diffuseColor.rgb = mix(diffuseColor.rgb,paintColor*(.82+.16*basin.g)*(1.-.14*film),paint);
        `).replace('#include <roughnessmap_fragment>', `
          float roughnessFactor = mix(.54 + .35*stoneData.b,.083,film) * (1.-.16*joint);
          roughnessFactor = mix(roughnessFactor,mix(.61,.18,film),paint*.52);
          float microRelief = mix(1.0,.14,film) * (1.-.30*paint);
        `).replace('#include <normal_fragment_maps>', packedNormal)
          .replace('#include <opaque_fragment>', `
          float planeDistance = dot(wetPlane,vec4(roadWorld,1.));
          float stationMatch = 1.-smoothstep(26.,69.,abs(roadMetres.y-wetStation));
          float planeMatch = 1.-smoothstep(.23,.98,abs(planeDistance));
          float localCoverage = wetReady * stationMatch * planeMatch * (.005 + .052*water + .943*pool);
          if(localCoverage > .004) {
            // Project the road point onto this capture's tangent plane. Losing
            // the grade match or the capture edge hands back to standard IBL.
            vec4 projected = wetProjection*vec4(roadWorld-wetPlane.xyz*planeDistance,1.);
            vec2 uvMirror = projected.xy / max(.001,projected.w) * .5 + .5;
            vec2 border = min(uvMirror,1.-uvMirror);
            float inFrame = smoothstep(.001,.047,min(border.x,border.y))*step(.01,projected.w);
            vec2 distortion = (stoneData.rg-.5) * wetTexel * mix(4.1,.9,pool)
              + vec2(basin.g-.5,runoff.g-.5)*wetTexel*1.25;
            vec2 sampleUV = clamp(uvMirror+distortion,wetTexel*2.,1.-wetTexel*2.);
            vec2 spread = wetTexel * mix(3.6,.80,pool);
            vec3 reflected = texture2D(wetScene,sampleUV).rgb*.40;
            reflected += (texture2D(wetScene,sampleUV+vec2(spread.x,0.)).rgb
              + texture2D(wetScene,sampleUV-vec2(spread.x,0.)).rgb
              + texture2D(wetScene,sampleUV+vec2(0.,spread.y*1.55)).rgb
              + texture2D(wetScene,sampleUV-vec2(0.,spread.y*1.55)).rgb)*.15;
            float incidence = clamp(dot(normal,normalize(vViewPosition)),0.,1.);
            float fresnel = .026 + .974 * pow(1.-incidence,4.5);
            float covered = localCoverage * inFrame;
            outgoingLight = mix(outgoingLight-reflectedLight.indirectSpecular*covered*.74,
              reflected, covered*fresnel*.92);
          }
          #include <opaque_fragment>
        `);
      };
      return material;
    }

    exclude(mesh) {
      this.excluded.push(mesh);
    }

    setCourse(course) {
      this.course=course;
      this.gravelStation=-Infinity;this.uniforms.wetReady.value=0;this.elapsed=1;
      this.poolStation=-Infinity;
    }

    waterAt(station, offset, x, z) {
      if(this.course?.night){station=this.course.physicalStation(station);offset=-offset;}
      const across = Math.abs(offset);
      if (across>this.pavedHalfWidth || !Number.isFinite(station+offset+x+z)) return 0;
      const p = waterPattern, d = p.depression, r = p.runoff, e = p.erosion;
      const bed = this.basinSample, run = this.runoffSample, cut = this.erosionSample;
      const field = this.uniforms.wetDrainage.value.image;
      sampleDrainage(field,offset*d[0]+station*d[1],station*d[2],bed);
      sampleDrainage(field,x*r[0]+r[1],z*r[0]+r[2],run);
      sampleDrainage(field,x*e[0]+e[1],z*e[0]+e[2],cut);
      const trackDistance = Math.abs(Math.abs(across-p.tire[0]+(run.z-.5)*p.tire[1])-p.tire[2]);
      const wheelTrack = 1-T.MathUtils.smoothstep(trackDistance,p.tireBand[0],p.tireBand[1]);
      const verge = T.MathUtils.smoothstep(across,p.verge[0],p.verge[1]);
      const w = p.weights, height = bed.x*w[0]+run.x*w[1]+(bed.y-.5)*w[2]+(cut.y-.5)*w[3];
      return T.MathUtils.smoothstep(height-wheelTrack*p.trackDrain+verge*p.edgeFill,p.pool[0],p.pool[1]);
    }

    matchForestFloor(geometry) {
      const source = this.forestGround;
      const positions = geometry.attributes.position;
      const tints = geometry.attributes.forestTint || new T.BufferAttribute(new Float32Array(positions.count*3),3);
      const cover=geometry.attributes.grassCover || new T.BufferAttribute(new Float32Array(positions.count),1);
      const color = new T.Color(),sample = new T.Color();
      for (let i=0;i<positions.count;i++) {
        color.setRGB(.37,.42,.31);
        if (source?.colors) {
          const u = T.MathUtils.clamp((positions.getX(i)-source.x0)/source.step,0,source.nx);
          const v = T.MathUtils.clamp((positions.getZ(i)-source.z0)/source.step,0,source.nz);
          const col = Math.min(Math.floor(u),source.nx-1), row = Math.min(Math.floor(v),source.nz-1);
          const a = u-col,b = v-row,stride = source.nx+1,k = row*stride+col;
          // The forest grid splits the cell at (1,0)–(0,1). Interpolate the
          // same triangle here so tint carries across the edge of the bank.
          const upper = a+b>1;
          color.fromBufferAttribute(source.colors,upper?k+stride+1:k).multiplyScalar(Math.abs(1-a-b));
          color.add(sample.fromBufferAttribute(source.colors,k+1).multiplyScalar(upper?1-b:a));
          color.add(sample.fromBufferAttribute(source.colors,k+stride).multiplyScalar(upper?1-a:b));
        }
        tints.setXYZ(i,color.r,color.g,color.b);
        cover.setX(i,source?.cover?TougeGrass.coverAt(source,positions.getX(i),positions.getZ(i)):0);
      }
      tints.needsUpdate = true;
      geometry.setAttribute('forestTint',tints);
      cover.needsUpdate=true;
      geometry.setAttribute('grassCover',cover);
      this.shoulderGeometry = geometry;
      this.forestColorVersion = source?.colors?.version;
    }

    dressVerge(scene, course, groundHeight) {
      this.pavedHalfWidth = course.half;
      const shape = new T.IcosahedronGeometry(1,0);
      const mineral = new T.MeshStandardMaterial({roughness:.88,flatShading:true,envMapIntensity:.48});
      const placed = new T.Object3D(), tone = new T.Color();
      const basalt = new T.Color(0x514e4b), quartz = new T.Color(0x9a9284);
      let seed = 0x7a6c621;
      const random = () => {
        seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
        return seed/4294967296;
      };
      for (let from=0; from<course.length; from+=125) {
        const matrices = [], colors = [];
        const to = Math.min(from+125,course.length);
        for (let station=from+2; station<to-2; station+=4+random()*13) {
          const side = random() < .5 ? -1 : 1;
          const wash = course.half+.10+random()**2*1.4;
          const count = 3+Math.floor(random()*7);
          for (let i=0; i<count; i++) {
            const along = station+(random()-.5)*2.7;
            const offset = side*Math.max(course.half+.025,wash+(random()-.5)*.80);
            const point = course.sample(along);
            const x = point.x+point.rx*offset, z = point.z+point.rz*offset;
            const radius = .022+random()**2*.069;
            placed.position.set(x,groundHeight(x,z,point.i)+radius*.19,z);
            placed.rotation.set((random()-.5)*.4,random()*Math.PI,(random()-.5)*.34);
            placed.scale.set(radius*(.73+random()*.62),radius*(.25+random()*.22),radius);
            placed.updateMatrix();
            matrices.push(placed.matrix.clone());
            colors.push(tone.copy(basalt).lerp(quartz,random()**1.3).clone());
          }
        }
        const stones = new T.InstancedMesh(shape,mineral,matrices.length);
        stones.name = 'Loose shoulder gravel';
        stones.receiveShadow = true;
        stones.visible = false;
        for (let i=0;i<matrices.length;i++) {
          stones.setMatrixAt(i,matrices[i]);
          stones.setColorAt(i,colors[i]);
        }
        stones.computeBoundingSphere();
        scene.add(stones);
        this.gravelSections.push({stones,from,to});
      }
    }

    nearbyPools(car) {
      const station=car.contact.s;
      if(!this.course)return 1;
      if(Math.abs(station-this.poolStation)<5)return this.poolCoverage;
      this.poolStation=station;
      let peak=0;
      // Reflected radiance from plain damp aggregate is much less visible
      // than a puddle. Sample the same drainage field as the fragment shader,
      // including the lane edges and the tarmac behind an orbiting driver.
      for(const offset of [-15,-5,3,12,23,37]){
        const p=this.course.sample(station+offset);
        for(const across of [-4.25,-2.6,-.85,.85,2.6,4.25]){
          const wet=this.waterAt(p.s,across,p.x+p.rx*across,p.z+p.rz*across);
          peak=Math.max(peak,wet);
          if(peak>.76)break;
        }
        if(peak>.76)break;
      }
      return this.poolCoverage=peak;
    }

    update(renderer, scene, camera, car, sky, dt, cut, pixelRatio, mirrorDrawn=false) {
      if (camera.userData.tougeReflectionPass) return;
      if (this.shoulderGeometry && this.forestGround?.colors?.version !== this.forestColorVersion)
        this.matchForestFloor(this.shoulderGeometry);
      const station=this.course?this.course.physicalStation(car.contact.s):car.contact.s;
      if (Math.abs(station-this.gravelStation)>12) {
        this.gravelStation = station;
        for (const {stones,from,to} of this.gravelSections)
          stones.visible = from < this.gravelStation+93 && to > this.gravelStation-93;
      }
      if (!this.enabled) return;
      this.elapsed += dt;
      this.timeOverBudget = Math.max(0, Math.min(3, this.timeOverBudget + (dt > .027 ? Math.min(dt,.075) : -dt*.28)));
      if(this.timeOverBudget>1.8)this.useSmallTarget=true;
      else if(this.timeOverBudget<.12)this.useSmallTarget=false;
      renderer.getSize(this.eyeSize);
      const small = this.useSmallTarget || pixelRatio < .83 || Math.min(this.eyeSize.x,this.eyeSize.y) < 520;
      const scale = Math.min(small ? .34 : .48, (small ? 400 : 720)/Math.max(this.eyeSize.x,this.eyeSize.y));
      const w = Math.max(8, Math.round(this.eyeSize.x*scale/4)*4);
      const h = Math.max(8, Math.round(this.eyeSize.y*scale/4)*4);
      const resized = w !== this.target.width || h !== this.target.height;
      const eyeTravel=this.lastEye.distanceToSquared(camera.position);
      const turn=1-Math.abs(camera.quaternion.dot(this.lastCameraRotation));
      const stopped=Math.abs(car.speed)<.5;
      const moving=!stopped || eyeTravel>.012 || turn>.00009;
      const detail=T.MathUtils.smoothstep(this.nearbyPools(car),.12,.7);
      const hz=moving?T.MathUtils.lerp(small?12:16,small?24:34,detail):4;
      const interval=1/hz;
      const brake=Math.max(car.brake||0,car.handbrake?.72:0),skyReady=sky.material?.uniforms?.ready?.value;
      const relit=this.lastSkyReady!==skyReady || (!moving && Math.abs(brake-this.lastBrake)>.12);
      const reframed=stopped && (eyeTravel>.22 || turn>.0016);
      const freshView=cut || resized || relit || reframed || !this.uniforms.wetReady.value || eyeTravel>9 || turn>.035;
      if(!freshView && (mirrorDrawn || this.elapsed+.000001<interval))return;
      this.elapsed=freshView?0:Math.max(0,this.elapsed-Math.floor((this.elapsed+.000001)/interval)*interval);
      if (resized) {
        this.target.setSize(w,h);
        this.uniforms.wetTexel.value.set(1/w,1/h);
      }
      const contact = car.contact, offset = contact.offset;
      const slope = -contact.bank - .009*offset;
      this.position.set(car.x,contact.y-contact.bank*offset-.0045*offset*offset,car.z);
      this.plane.normal.set(-contact.grade*contact.fx-slope*contact.rx,1,
        -contact.grade*contact.fz-slope*contact.rz).normalize();
      this.plane.constant = -this.plane.normal.dot(this.position);
      camera.updateMatrixWorld();
      const altitude = this.plane.distanceToPoint(camera.position);
      if (altitude < .07) { this.uniforms.wetReady.value = 0; return; }

      const mirror = this.camera;
      const normal = this.plane.normal;
      mirror.position.copy(camera.position).addScaledVector(normal,-2*altitude);
      camera.getWorldDirection(this.forward).reflect(normal);
      mirror.up.setFromMatrixColumn(camera.matrixWorld,1).reflect(normal);
      mirror.lookAt(this.position.copy(mirror.position).add(this.forward));
      mirror.layers.mask = camera.layers.mask;
      mirror.near = camera.near;
      mirror.far = camera.far;
      mirror.updateMatrixWorld();
      mirror.projectionMatrix.copy(camera.projectionMatrix);
      this.uniforms.wetProjection.value.multiplyMatrices(mirror.projectionMatrix,mirror.matrixWorldInverse);
      this.uniforms.wetPlane.value.set(normal.x,normal.y,normal.z,this.plane.constant);
      this.uniforms.wetStation.value = station;

      // Oblique near-plane clipping keeps terrain from leaking in below the
      // reflection. Only rows controlling depth change; projected UVs do not.
      this.plane.constant += .025;
      this.plane.applyMatrix4(mirror.matrixWorldInverse);
      this.clip.set(this.plane.normal.x,this.plane.normal.y,this.plane.normal.z,this.plane.constant);
      const e = mirror.projectionMatrix.elements;
      this.corner.set((Math.sign(this.clip.x)+e[8])/e[0],(Math.sign(this.clip.y)+e[9])/e[5],-1,(1+e[10])/e[14]);
      this.clip.multiplyScalar(2/this.clip.dot(this.corner));
      e[2]=this.clip.x; e[6]=this.clip.y; e[10]=this.clip.z+1; e[14]=this.clip.w;
      mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert();

      const previousTarget = renderer.getRenderTarget();
      const shadowAuto = renderer.shadowMap.autoUpdate, shadowDirty = renderer.shadowMap.needsUpdate;
      const xr = renderer.xr.enabled;
      for (let i=0;i<this.excluded.length;i++) {
        this.visibility[i]=this.excluded[i].visible;
        this.excluded[i].visible=false;
      }
      renderer.shadowMap.autoUpdate=false;
      renderer.shadowMap.needsUpdate=false;
      renderer.xr.enabled=false;
      sky.position.copy(mirror.position);
      try {
        renderer.setRenderTarget(this.target);
        renderer.state.buffers.depth.setMask(true);
        if (!renderer.autoClear) renderer.clear();
        renderer.render(scene,mirror);
        this.lastDrawCalls=renderer.info.render.calls;
        this.lastTriangles=renderer.info.render.triangles;
        this.uniforms.wetReady.value=1;
        this.lastEye.copy(camera.position);
        this.lastCameraRotation.copy(camera.quaternion);
        this.lastBrake=brake;this.lastSkyReady=skyReady;
      } finally {
        sky.position.copy(camera.position);
        renderer.setRenderTarget(previousTarget);
        renderer.xr.enabled=xr;
        renderer.shadowMap.autoUpdate=shadowAuto;
        renderer.shadowMap.needsUpdate=shadowDirty;
        for (let i=0;i<this.excluded.length;i++) this.excluded[i].visible=this.visibility[i];
      }
    }
  }
  window.TougeWetRoad = WetRoad;
})();
