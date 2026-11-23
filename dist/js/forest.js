(() => {
  'use strict';

  const T = THREE;
  const TAU = Math.PI * 2;
  const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));
  const speciesNames = ['Japanese cedar', 'Japanese red pine', 'Japanese beech', 'Mountain maple'];
  const boughTiles = [3, 0, 1, 2];
  const crownRatios = [0.37, 0.82, 0.90, 1.05];

  function randomStream(seed) {
    return () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  function artTexture(file) {
    const url = window.TougeArtURLs?.[file] ||
      (file === 'haruna-trees.webp' && window.TougeTreesURL) || 'assets/art/' + file;
    const map = new T.TextureLoader().load(url);
    map.colorSpace = T.SRGBColorSpace;
    map.anisotropy = 4;
    return map;
  }

  // Both the reflection camera and the shadow pass use the driver's eye for LOD.
  // Crown relief, bark and branchlets converge into the distant photograph.
  function forestMaterial(material, mode, eye, range, light, alternate) {
    material.customProgramCacheKey = () => 'haruna-forest-' + mode;
    material.onBeforeCompile = shader => {
      shader.uniforms.forestEye = {value: eye};
      shader.uniforms.forestRange = {value: range};
      shader.uniforms.canopyFill=light.fill;
      shader.uniforms.canopyKey=light.direction;
      const portrait = mode.startsWith('portrait'), shadowPortrait = mode === 'portrait-depth';
      const grassCard=mode.startsWith('grass'),blade=mode==='blades',movingGrass=grassCard||blade;
      const leaves = mode === 'bough' || mode === 'plant' || mode === 'thicket' || mode==='grass' || blade;
      if (portrait) shader.uniforms.forestAlternate = {value:alternate};
      if(movingGrass)shader.uniforms.grassWind=material.userData.wind;
      shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
        uniform vec3 forestEye;
        uniform vec2 forestRange;
        uniform vec2 canopyKey;
        varying float forestDetail;
        ${movingGrass?'uniform float grassWind;':''}
        ${grassCard?'varying float tuftHeight;':''}
        ${portrait ? 'attribute vec4 treeCell; varying vec2 treeUv; varying vec2 sunInCrown; varying vec2 atlasChoice;' : ''}`);
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 root = instanceMatrix[3].xz;
        forestDetail = 1.0 - smoothstep(forestRange.x, forestRange.y, distance(root, forestEye.xz));
        ${portrait ? `
          vec2 eyeDirection = ${shadowPortrait ? 'canopyKey' : 'forestEye.xz - root'};
          vec2 right = vec2(eyeDirection.y, -eyeDirection.x) / max(.01, length(eyeDirection));
          vec2 front = vec2(-right.y, right.x);
          vec4 cells = 1. - step(vec4(.5), abs(vec4(0., 1., 2., 3.) - treeCell.x));
          atlasChoice = treeCell.xw;
          float foot = dot(cells, mix(vec4(.495,.301,.419,.406),vec4(.518,.515,.567,.444),treeCell.w));
          float baseline = mix(.019,.017,treeCell.w);
          float crown = smoothstep(.17, .43, uv.y) * (1.-smoothstep(.85, 1., uv.y));
          float shape = max(0., 1.-pow(abs(2.*uv.x-1.), 2.)) * crown;
          forestDetail *= treeCell.z;
          float width = ${shadowPortrait ? '.83' : '1.-forestDetail*mix(.23,.12,crown)'};
          transformed.xz = right * (uv.x - foot) * treeCell.y * width +
            front * (shape*.19 + .026*(1.-crown)) * forestDetail;
          transformed.y = uv.y - baseline;
          treeUv = uv;
          sunInCrown = vec2(dot(right*treeCell.y,canopyKey),dot(front,canopyKey));
        ` : 'transformed.xz *= mix(.62, 1., forestDetail);'}
        ${grassCard?'tuftHeight=position.y;':''}
        ${blade?'transformed.y*=smoothstep(0.,.72,forestDetail);':''}
        ${movingGrass?`
          vec2 breeze=vec2(.83,-.56);
          float sweep=.5+.5*sin(dot(root,vec2(.14,.06))+grassWind*.78);
          float bend=(.022*sweep+.011*sin(dot(root,vec2(.47,.19))+grassWind*1.69))*position.y*position.y;
          transformed.xz+=bend*vec2(dot(normalize(instanceMatrix[0].xz),breeze),
                                    dot(normalize(instanceMatrix[2].xz),breeze));`:''}`);
      if (portrait) {
        shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
          vMapUv.x = (treeCell.x + clamp(uv.x, .001, .999)) * .25;`);
      }
      if (!portrait) shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        if (forestDetail <= 0.) gl_Position = vec4(2., 2., 2., 1.);`);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform float canopyFill;
        varying float forestDetail;
        ${grassCard?'varying float tuftHeight;':''}
        ${portrait ? 'varying vec2 treeUv; varying vec2 sunInCrown; varying vec2 atlasChoice; uniform sampler2D forestAlternate;' : ''}`);
      if (portrait) shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        if (atlasChoice.y > .5) {
          // The wider second pine and maple were photographed in uneven slots.
          // Follow the transparent space between crowns at each height.
          float row = 1.-treeUv.y;
          vec3 seams = vec3(.183, .457-.027*smoothstep(.29,.41,row), .711-.024*smoothstep(.407,.482,row));
          // An instance-constant cell keeps the mip derivatives continuous at the card edges.
          vec4 belongs = 1.-step(vec4(.5),abs(vec4(0.,1.,2.,3.)-atlasChoice.x));
          float u = mix(dot(belongs,vec4(0.,seams)),dot(belongs,vec4(seams,1.)),treeUv.x);
          diffuseColor *= texture2D(forestAlternate,vec2(u,treeUv.y));
          diffuseColor.a *= smoothstep(.002,.017,min(treeUv.x,1.-treeUv.x));
        } else {
          diffuseColor *= texture2D(map,vMapUv);
        }
        ${shadowPortrait ? '' : `
        float side = (treeUv.x-.5)*1.84;
        float roundness = sqrt(max(.02,1.-side*side));
        float lit = smoothstep(-.62,.83, dot(sunInCrown, vec2(side,roundness))*.77 + .24*treeUv.y);
        vec3 sun = mix(vec3(.59,.70,.80), vec3(1.10,1.035,.87), lit);
        diffuseColor.rgb *= sun * mix(.73, 1.02, smoothstep(.05,.83,treeUv.y));
        // The photographed bark shares the shade of the modeled bole.
        diffuseColor.rgb *= mix(1.,mix(.63,1.,smoothstep(.04,.40,treeUv.y)),forestDetail);
        `}`);
      if (!portrait && !mode.startsWith('wood')) {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.a *= smoothstep(.015,.76,forestDetail);
          ${grassCard?'diffuseColor.a*=smoothstep(-.045,.14,tuftHeight);':''}`);
      }
      if (leaves) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        // Thin leaves transmit skylight even when the lower face points towards the road.
        reflectedLight.indirectDiffuse += diffuseColor.rgb * canopyFill * ${blade?'vec3(.63,.71,.55)':mode==='thicket' ? 'vec3(.46,.50,.47)' : 'vec3(.32,.35,.34)'};`);
    };
    return material;
  }

  function makeBatch() {
    return {positions: [], normals: [], colors: [], uvs: [], indices: []};
  }

  function vertex(batch, x, y, z, nx, ny, nz, u, v, light) {
    batch.positions.push(x, y, z);
    const n = 1 / Math.hypot(nx, ny, nz);
    batch.normals.push(nx * n, ny * n, nz * n);
    batch.uvs.push(u, v);
    batch.colors.push(light, light, light);
  }

  function geometry(batch) {
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(batch.positions, 3));
    geo.setAttribute('normal', new T.Float32BufferAttribute(batch.normals, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(batch.colors, 3));
    geo.setAttribute('uv', new T.Float32BufferAttribute(batch.uvs, 2));
    geo.setIndex(batch.indices);
    geo.computeBoundingSphere();
    return geo;
  }

  // Tapered bole, buttress and lateral branch segments share the same bark atlas.
  function addLimb(batch, start, end, radiusA, radiusB, tile, sides, light, vStart, vEnd) {
    const axis = new T.Vector3().subVectors(end, start).normalize();
    const reference = Math.abs(axis.y) > .89 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 1, 0);
    const u = new T.Vector3().crossVectors(axis, reference).normalize();
    const v = new T.Vector3().crossVectors(axis, u);
    const first = batch.positions.length / 3;
    for (let j = 0; j < 2; j++) {
      const center = j ? end : start, r = j ? radiusB : radiusA;
      for (let i = 0; i <= sides; i++) {
        const az = i * TAU / sides, a = Math.cos(az), b = Math.sin(az);
        const nx = u.x * a + v.x * b, ny = u.y * a + v.y * b, nz = u.z * a + v.z * b;
        vertex(batch, center.x + r*nx, center.y + r*ny, center.z + r*nz, nx, ny, nz,
          (tile + .016 + i / sides * .968) * .25, j ? vEnd : vStart, light);
      }
    }
    for (let i = 0; i < sides; i++) {
      const k = first + i, next = k + sides + 1;
      batch.indices.push(k, k + 1, next, k + 1, next + 1, next);
    }
  }

  function tileUv(tile, u, v) {
    return [((tile & 1) + .002 + .996 * u) * .5, (1 - (tile >> 1) + .002 + .996 * v) * .5];
  }

  // A bough curves in both axes. The photo carries the fine individual needles
  // or leaves while the bent surface gives each spray volume and a stable shadow.
  function addBough(batch, base, az, length, width, rise, sag, tile, light, flip) {
    const dx = Math.cos(az), dz = Math.sin(az), first = batch.positions.length / 3;
    for (const t of [0, .48, 1]) {
      const bend = Math.sin(t * Math.PI);
      for (const u of [0, .5, 1]) {
        const side = (u - .5) * 2;
        const across = (u - .5) * width * (.85 + .15 * bend);
        const along = t * length - side * side * length * .12;
        const height = t * rise + bend * sag - side * side * sag * (.50 + .40 * t);
        const [s, v] = tileUv(tile, flip ? 1-u : u, t);
        vertex(batch, base.x + dx*along - dz*across, base.y + height, base.z + dz*along + dx*across,
          dx*.54 - dz*side*.45, .63 + bend*.38, dz*.54 + dx*side*.45, s, v,
          light * (.76 + .17*t + .07*Math.abs(side)));
      }
    }
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      const i = first + y * 3 + x;
      batch.indices.push(i, i + 1, i + 3, i + 1, i + 4, i + 3);
    }
  }

  function treeShape(kind, variant) {
    const rng = randomStream(194770 + kind*7107 + variant*9751);
    const wood = makeBatch(), leaves = makeBatch();
    const cedar = kind === 0, pine = kind === 1;
    const az = rng() * TAU, lean = (cedar ? .025 : pine ? .19 : .11) * (.52 + rng()*.5);
    const phase = rng() * TAU, curve = pine ? .055 : cedar ? .004 : .032;
    const trunkAt = h => {
      const drift = lean * h * h, bend = Math.sin(h*6.5 + phase) - Math.sin(phase);
      return new T.Vector3(Math.cos(az)*drift + Math.sin(az)*curve*bend, h,
        Math.sin(az)*drift - Math.cos(az)*curve*bend);
    };
    const boleRadius = (cedar ? .013 : pine ? .019 : .018) / crownRatios[kind];
    const ys = [-.011, .025, .085, .29, .53, .72, .89, .984];
    const radii = [1.67, 1.20, .96, .79, .66, .44, .26, .046];
    for (let i = 1; i < ys.length; i++) {
      addLimb(wood, trunkAt(ys[i-1]), trunkAt(ys[i]),
        radii[i-1]*boleRadius, radii[i]*boleRadius, kind, 8, .79 + .15*ys[i], ys[i-1]*7, ys[i]*7);
    }
    for (let i = 0; i < 4; i++) {
      const angle = az + i*TAU/4 + rng()*.5, reach = boleRadius * (2.1 + rng()*1.5);
      addLimb(wood, trunkAt(.045 + rng()*.025),
        new T.Vector3(Math.cos(angle)*reach, -.016, Math.sin(angle)*reach),
        boleRadius*.43, boleRadius*.19, kind, 5, .67, .35, .02);
    }
    const baseH = cedar ? .26 + rng()*.12 : pine ? .40 + rng()*.12 : .33 + rng()*.12;
    if (!cedar && !pine) {
      const forkAt = .13 + rng()*.10, stem = trunkAt(forkAt);
      for (let i=0; i<2; i++) {
        const bearing = az + .9 + i*2.9, dx=Math.cos(bearing), dz=Math.sin(bearing);
        const joint = trunkAt(.40 + i*.06).add(new T.Vector3(dx*.11,0,dz*.11));
        const tip = trunkAt(.67 + rng()*.11).add(new T.Vector3(dx*.28,0,dz*.28));
        addLimb(wood, stem, joint, boleRadius*.63, boleRadius*.44, kind, 6, .86, forkAt*7, joint.y*7);
        addLimb(wood, joint, tip, boleRadius*.44, boleRadius*.13, kind, 5, .86, joint.y*7, tip.y*7);
      }
    }
    const levels = cedar ? 8 : pine ? 5 : 6;
    for (let i = 0; i < levels; i++) {
      const f = i/(levels-1), level = baseH + (.965-baseH)*f;
      const profile = cedar ? Math.pow(1.03-f, .73) :
        .20 + .82*Math.pow(Math.max(0, Math.sin((.13+.85*f)*Math.PI)), .63);
      const spokes = cedar ? (i > 5 ? 3 : 5) : 4;
      for (let j = 0; j < spokes; j++) {
        const angle = az + 2.38*i + j*TAU/spokes + (rng()-.5)*.52;
        const h = level + (rng()-.5)*(cedar ? .024 : .078)*(1-.72*f);
        const root = trunkAt(h);
        const reach = profile * (.42 + rng()*.1);
        const clearLimb = cedar ? .41 + rng()*.14 : pine ? .55 + rng()*.16 : .51 + rng()*.15;
        const stem = reach*clearLimb;
        const lift = (cedar ? .035 : pine ? .095 : .095) * (1-.62*f) * (.73+rng()*.50);
        const branch = new T.Vector3(root.x + Math.cos(angle)*stem, h + lift,
          root.z + Math.sin(angle)*stem);
        if (i < levels-1 && (!cedar || j%2 === 0)) {
          const radius = boleRadius*(pine ? .43 : cedar ? .24 : .36)*(1-.73*f);
          addLimb(wood, root, branch, radius, radius*.38, kind, 4, .77 + .12*f, 0, .34+reach*2);
        }
        const towardTip = reach - stem;
        const rise = (cedar ? -.083 : pine ? -.048 : -.061) *
          (.63 + rng()*.52) * (1-.73*f);
        const width = reach * (cedar ? .50 : pine ? .58 : .55);
        const light = .77 + .16*f + .12*rng();
        addBough(leaves, branch, angle, towardTip, width, rise,
          (cedar ? .055 : .070)*(1-.69*f), boughTiles[kind], light, rng() > .5);
        if (i < levels-1 && (pine || j%2 === 0)) {
          // Forked terminal sprays break up the radial outline of a single whorl.
          const fork = branch.clone();
          fork.x += Math.cos(angle)*towardTip*.38;
          fork.z += Math.sin(angle)*towardTip*.38;
          fork.y += (rise*.23 + .024*(1-f));
          addBough(leaves, fork, angle + (j%2 ? -.53 : .53), towardTip*.64, width*.70,
            rise*.86, .046*(1-.65*f), boughTiles[kind], light*.97, rng() > .5);
        }
      }
    }
    return {wood: geometry(wood), leaves: geometry(leaves)};
  }

  function plantShape(tile, mound) {
    const batch = makeBatch();
    // The curved sprays fan out from a single crown. Their silhouettes remain
    // effective in low bonnet views as well as from above the shoulders.
    const planes = mound ? 2 : 3;
    for (let i = 0; i < planes; i++) {
      const az = i * Math.PI/planes + tile*.6, dx = Math.cos(az), dz = Math.sin(az);
      const first = batch.positions.length / 3;
      for (const t of [0, .52, 1]) for (const u of [0, .5, 1]) {
        const side = (u-.5)*2;
        const width = (u-.5)*(.77 + t*.15);
        const curl = mound ? .16*(1-side*side)*Math.sin(t*Math.PI) :
          t*t*(tile === 1 ? .40 : .28) - side*side*.085;
        const y = t*(1-i*.066) - side*side*t*.13;
        const [s,v] = tileUv(tile, i%2 ? u : 1-u, t);
        vertex(batch, dx*width - dz*curl, y, dz*width + dx*curl,
          dx*side*.24 - dz*.47, .65, dz*side*.24 + dx*.47, s, v, .58 + t*.42);
      }
      for (let y=0; y<2; y++) for(let x=0; x<2; x++) {
        const k=first+y*3+x;
        batch.indices.push(k,k+1,k+3,k+1,k+4,k+3);
      }
    }
    return geometry(batch);
  }

  // Two gently folded sprays give each photographed tuft volume. The source
  // quadrants have different clear margins, so place every crown at ground level.
  function grassShape(tile,crown=false) {
    const mesh=makeBatch(),bottom=[.088,.081,.051,.051][tile],top=[.70,.958,.995,.997][tile];
    if(crown) {
      // The thatch is a low, irregular crown. Its near surface fills the
      // space below the arched foliage in a downward view from the road.
      const segments=8,rings=[[-.12,.31],[.12,.32],[.31,.22],[.46,.055]];
      for(let j=0;j<segments;j++) {
        const start=mesh.positions.length/3;
        for(let r=0;r<rings.length;r++)for(let edge=0;edge<2;edge++) {
          const az=TAU*(j+edge)/segments,dx=Math.cos(az),dz=Math.sin(az),[h,width]=rings[r];
          const radius=width*(.88+.12*Math.cos(3*az+tile)+.10*Math.sin(5*az));
          const u=(j%2?.78:.22)+(j%2?-1:1)*edge*.56;
          const v=bottom+(.10+.46*r/(rings.length-1))*(top-bottom),[s,t]=tileUv(tile,u,v);
          vertex(mesh,dx*radius,h,dz*radius,dx*.50,.89,dz*.50,s,t,.55+.27*r/(rings.length-1));
        }
        for(let r=0;r<rings.length-1;r++) {
          const a=start+r*2;
          mesh.indices.push(a,a+1,a+2,a+1,a+3,a+2);
        }
      }
      return geometry(mesh);
    }
    const columns=tile<2?[0,.25,.5,.75,1]:[0,.5,1],rows=[0,.36,1],stride=columns.length;
    for(let k=0;k<2;k++) {
      const angle=tile*.63+k*1.69,dx=Math.cos(angle),dz=Math.sin(angle),start=mesh.positions.length/3;
      for(const t of rows)for(const u of columns) {
        const side=u-.5;
        const spread=.33+.67*T.MathUtils.smoothstep(t,0,.42);
        const width=side*(k?.83:1)*spread;
        const front=(1-4*side*side)*(.095+.19*Math.sin(t*Math.PI))-.085+t*t*.049;
        const [s,v]=tileUv(tile,k?1-u:u,bottom+(top-bottom)*t);
        vertex(mesh,width*dx-front*dz,t*(k?.81:1)-.045*(1-t),width*dz+front*dx,
          .51*side*dx-.31*dz,.96,.51*side*dz+.31*dx,s,v,.44+.56*t);
      }
      for(let j=0;j<rows.length-1;j++)for(let i=0;i<columns.length-1;i++) {
        const a=start+stride*j+i;
        mesh.indices.push(a,a+1,a+stride,a+1,a+stride+1,a+stride);
      }
    }
    return geometry(mesh);
  }

  function bladeTuft() {
    const mesh=makeBatch(),random=randomStream(481912),tint=new T.Color();
    const green=new T.Color(0x9ba65f),dry=new T.Color(0xc2b87b);
    for(let k=0;k<15;k++) {
      const angle=k*2.39996+random()*.4,dx=Math.cos(angle),dz=Math.sin(angle);
      const length=.17+random()*.42,height=.32+random()*.68;
      const foot=.015+random()*.13,halfWidth=.0035+random()*.009;
      const start=mesh.positions.length/3,pigment=tint.copy(green).lerp(dry,random()**1.8);
      for(const t of [0,.42,.76,1]) {
        const reach=foot+length*t*t,tip=height*(Math.sin(t*1.85)-.16*t*t*t);
        const width=(.50+.50*Math.sin(Math.PI*t))*(1-t*t)*halfWidth;
        for(const edge of [-1,0,1]) {
          vertex(mesh,dx*reach-dz*width*edge,tip-.045+(edge===0?width*.59:0),dz*reach+dx*width*edge,
            dx*.40-dz*edge*.47,.83,dz*.40+dx*edge*.47,0,0,1);
          const j=mesh.colors.length-3,shade=(.72+.28*t)*(edge===0?1.08:edge===1?.84:1);
          mesh.colors[j]=pigment.r*shade;mesh.colors[j+1]=pigment.g*shade;mesh.colors[j+2]=pigment.b*shade;
        }
      }
      for(let j=0;j<3;j++)for(let i=0;i<2;i++) {
        const a=start+3*j+i;
        mesh.indices.push(a,a+1,a+3);
        if(j<2)mesh.indices.push(a+1,a+4,a+3);
      }
    }
    return geometry(mesh);
  }

  const scale = new T.Vector3();

  function placePortrait(mesh, index, tree, matrix, tint) {
    matrix.makeRotationY(0);
    matrix.scale(scale.set(tree.w, tree.h, tree.w));
    matrix.setPosition(tree.x, tree.y, tree.z);
    mesh.setMatrixAt(index, matrix);
    tint.setRGB(tree.shade*tree.warm, tree.shade, tree.shade*(1.97-tree.warm));
    mesh.setColorAt(index, tint);
  }

  function* forestMeshes(group, trees, small, grasses, startEye,fuji) {
    const eye = startEye.clone();
    const light={fill:{value:1},direction:{value:new T.Vector2(.79,-.61)}};
    const mobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    const lod = new T.Vector2(mobile ? 31 : 43, mobile ? 51 : 68);
    const vergeLod = new T.Vector2(mobile ? 43 : 58, mobile ? 62 : 83);
    const thicketLod = new T.Vector2(mobile ? 51 : 75, mobile ? 74 : 107);
    const bark = artTexture('haruna-bark.webp');
    bark.wrapT = T.RepeatWrapping;
    const branches = artTexture('haruna-boughs.webp'), understory = artTexture('haruna-understory.webp');
    const shrubs = artTexture('haruna-thickets.webp');
    const wood = forestMaterial(new T.MeshStandardMaterial({map: bark, vertexColors: true,
      color: 0xe2dfce, roughness: .91, metalness: 0, envMapIntensity: .35}), 'wood', eye, lod, light);
    const cutout = (map, name, range) => forestMaterial(new T.MeshLambertMaterial({
      map, vertexColors: true, side: T.DoubleSide, shadowSide: T.DoubleSide,
      alphaTest: .35, alphaToCoverage: true
    }), name, eye, range, light);
    const crowns = cutout(branches, 'bough', lod), plants = cutout(understory, 'plant', vergeLod);
    const thickets = cutout(shrubs, 'thicket', thicketLod);
    const depth = (map, name, range) => forestMaterial(new T.MeshDepthMaterial({
      depthPacking: T.RGBADepthPacking, map, alphaTest: map ? .43 : 0, side: T.DoubleSide
    }), name + '-depth', eye, range, light);
    const trunkDepth = depth(null, 'wood', lod), crownDepth = depth(branches, 'bough', lod);
    const lowDepth = depth(understory, 'plant', vergeLod);
    const shrubDepth = depth(shrubs, 'thicket', thicketLod);
    const all = trees.flat();
    const treesMap = artTexture('haruna-trees.webp');
    const alternate = artTexture('haruna-trees-alt.webp');
    const sheet = new T.PlaneGeometry(1, 1, 4, 3);
    const flat = new T.PlaneGeometry(1,1);
    sheet.translate(0, .5, 0);
    flat.translate(0,.5,0);
    const farMat = forestMaterial(new T.MeshBasicMaterial({map: treesMap,
      alphaTest: .31, side: T.DoubleSide, alphaToCoverage: true}), 'portrait', eye, lod, light, alternate);
    const farDepth = forestMaterial(new T.MeshDepthMaterial({depthPacking: T.RGBADepthPacking,
      map: treesMap, alphaTest: .52, side: T.DoubleSide}), 'portrait-depth', eye, lod, light, alternate);
    const matrix = new T.Matrix4(), tint = new T.Color();
    const cellSize = 57, bins = new Map(), pockets = [];
    const farCell = 112, stands = new Map();
    for (const tree of all) {
      const x = Math.floor(tree.x/farCell), z = Math.floor(tree.z/farCell), key = x + ',' + z;
      let stand = stands.get(key);
      if (!stand) { stand = {x:x*farCell,z:z*farCell,trees:[]}; stands.set(key,stand); }
      stand.trees.push(tree);
    }
    // Every stand has its own portrait/variant attribute. Its curved and
    // flat cards share the two unit geometries' vertex and index buffers.
    function portraitGeometry(template, treeCell) {
      const geometry=new T.BufferGeometry();
      geometry.setIndex(template.index);
      for(const name in template.attributes) geometry.setAttribute(name,template.attributes[name]);
      geometry.setAttribute('treeCell',treeCell);
      geometry.boundingSphere=template.boundingSphere;
      return geometry;
    }
    sheet.computeBoundingSphere();
    flat.computeBoundingSphere();
    let standNumber=0;
    for (const stand of stands.values()) {
      if ((standNumber++ & 7) === 0) yield;
      const cells = new Float32Array(stand.trees.length*4);
      const treeCell = new T.InstancedBufferAttribute(cells, 4);
      const geo = portraitGeometry(sheet,treeCell);
      stand.curved = geo;
      stand.flat = portraitGeometry(flat,treeCell);
      const distant = new T.InstancedMesh(geo, farMat, stand.trees.length);
      distant.name = 'Mixed forest on the opposite slopes';
      distant.customDepthMaterial = farDepth;
      for (let i=0; i<stand.trees.length; i++) {
        const tree = stand.trees[i];
        placePortrait(distant, i, tree, matrix, tint);
        cells[i*4] = tree.kind;
        cells[i*4+1] = tree.turn > Math.PI ? -1 : 1;
        cells[i*4+2] = tree.detail ? 1 : 0;
        cells[i*4+3] = tree.variant;
      }
      distant.computeBoundingSphere();
      group.add(distant);
      stand.mesh = distant;
      delete stand.trees;
    }

    function pocket(shape, material, depthMaterial, name, capacity, shared) {
      const mesh = new T.InstancedMesh(shape, material, shared ? 0 : capacity);
      mesh.name = name;
      if (shared) {
        mesh.instanceMatrix=shared.instanceMatrix;
        mesh.instanceColor=shared.instanceColor;
      } else {
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.instanceColor = new T.InstancedBufferAttribute(new Float32Array(capacity*3), 3);
        mesh.instanceColor.setUsage(T.DynamicDrawUsage);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.customDepthMaterial = depthMaterial;
      mesh.count = 0;
      group.add(mesh);
      pockets.push({mesh,shared});
      return mesh;
    }
    const margin = 9;
    function bin(item, meshes, radius, innerMeshes=null, innerRadius=0) {
      const ix=Math.floor(item.x/cellSize), iz=Math.floor(item.z/cellSize);
      let row=bins.get(ix);
      if (!row) {row=new Map();bins.set(ix,row);}
      let list=row.get(iz);
      if (!list) {list=[];row.set(iz,list);}
      const cosine=Math.cos(item.turn)*item.w, sine=Math.sin(item.turn)*item.w;
      const riseX=item.slopeX===undefined ? 0 : cosine*item.slopeX-sine*item.slopeZ;
      const riseZ=item.slopeX===undefined ? 0 : sine*item.slopeX+cosine*item.slopeZ;
      list.push({x:item.x,y:item.y,z:item.z,height:item.h,cosine,sine,riseX,riseZ,
        red:item.shade*item.warm,green:item.shade,blue:item.shade*(1.97-item.warm),
        meshes,range:(radius+margin)**2,innerMeshes,innerRange:(innerRadius+margin)**2});
    }
    function fillInstances(plant, meshes) {
      for(const mesh of meshes) {
        const index=mesh.count++, a=mesh.instanceMatrix.array, m=index*16;
        // InstancedMesh initializes its homogeneous rows to identity. Only
        // these ten elements change when a plant enters the streamed window.
        a[m]=plant.cosine; a[m+1]=plant.riseX; a[m+2]=-plant.sine;
        a[m+5]=plant.height;
        a[m+8]=plant.sine; a[m+9]=plant.riseZ; a[m+10]=plant.cosine;
        a[m+12]=plant.x; a[m+13]=plant.y; a[m+14]=plant.z;
        const color=mesh.instanceColor.array, c=index*3;
        color[c]=plant.red; color[c+1]=plant.green; color[c+2]=plant.blue;
      }
    }
    for (let k = 0; k < 4; k++) {
      const close = trees[k].filter(tree => tree.detail);
      for (let v = 0; v < 2; v++) {
        yield;
        const arrangement = close.filter(tree => tree.variant === v);
        if (!arrangement.length) continue;
        const proto = treeShape(k, v);
        const cap = yield* visibleCapacity([arrangement],lod.y);
        const trunk = pocket(proto.wood,wood,trunkDepth,speciesNames[k]+' trunks',cap);
        // Crowns and trunks stream precisely the same tree instances.
        pocket(proto.leaves,crowns,crownDepth,speciesNames[k]+' needles and leaves',cap,trunk);
        const meshes=[trunk];
        for (const tree of arrangement) bin(tree, meshes, lod.y);
      }
    }
    const plantNames = ['Low cedar saplings','Forest ferns','Sasa dwarf bamboo','Mountain sedges',
      'Sasa undergrowth','Mountain azaleas','Bracken colonies','Broadleaf forest scrub'];
    for (let k=0; k<small.length; k++) {
      if (!small[k].length) continue;
      const mound = k >= 4, range=mound ? thicketLod.y : vergeLod.y;
      const cap=yield* visibleCapacity([small[k]],range);
      const groundMesh = pocket(plantShape(k%4,mound), mound ? thickets : plants,
        mound ? shrubDepth : lowDepth, plantNames[k], cap);
      const meshes=[groundMesh];
      for (let i=0;i<small[k].length;i++) {
        if ((i & 511) === 0) yield;
        bin(small[k][i],meshes,range);
      }
    }
    const grassAtlas=artTexture('haruna-grasses.webp'),wind={value:0};
    const grassNames=['Cut roadside grasses','Mountain sedge','Young susuki','Silvergrass seed heads'];
    const bladeRange=new T.Vector2(mobile?6:9,mobile?13:18);
    // Only a small window of the route can fill these instance buffers.
    // For any camera in a grid cell, all in-range plants fit in its nine
    // cells. Include empty centre cells between neighboring concentrations.
    function* visibleCapacity(lists,radius) {
      const cell=radius+margin,occupied=new Map(),totals=new Map();
      for(const list of lists)for(let i=0;i<list.length;i++) {
        if ((i & 2047) === 0) yield;
        const p=list[i];
        const x=Math.floor(p.x/cell),z=Math.floor(p.z/cell),key=x+','+z;
        const bucket=occupied.get(key);
        if(bucket)bucket.count++;else occupied.set(key,{x,z,count:1});
      }
      let max=1;
      for(const {x,z,count} of occupied.values())for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++) {
        const key=(x+i)+','+(z+j),sum=(totals.get(key)||0)+count;
        totals.set(key,sum);max=Math.max(max,sum);
      }
      return max;
    }
    const blades=forestMaterial(new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide}),'blades',eye,bladeRange,light);
    blades.userData.wind=wind;
    const base=cutout(grassAtlas,'grass',bladeRange);base.alphaTest=.22;base.userData.wind=wind;
    const closeBlades=pocket(bladeTuft(),blades,null,'Folded verge grass blades',yield* visibleCapacity(grasses.slice(0,2),bladeRange.y));
    closeBlades.castShadow=false;
    for(let k=0;k<grasses.length;k++) {
      if(!grasses[k].length)continue;
      const tall=k>1,end=(tall?72:42)*(mobile?.78:1),range=new T.Vector2(end*.56,end);
      const leaves=cutout(grassAtlas,'grass',range),shadows=depth(grassAtlas,'grass',range);
      leaves.alphaTest=.22;shadows.alphaTest=.34;leaves.userData.wind=shadows.userData.wind=wind;
      const mesh=pocket(grassShape(k),leaves,shadows,grassNames[k],yield* visibleCapacity([grasses[k]],end));
      const farMeshes=[mesh],nearMeshes=[closeBlades];
      if(k<2){
        const crown=pocket(grassShape(k,true),base,null,grassNames[k]+' thatch',yield* visibleCapacity([grasses[k]],bladeRange.y));
        crown.castShadow=false;nearMeshes.push(crown);
      }
      for(let i=0;i<grasses[k].length;i++){
        if ((i & 511) === 0) yield;
        bin(grasses[k][i],farMeshes,end,k<2 ? nearMeshes : null,bladeRange.y);
      }
    }
    const previous = new T.Vector2(Infinity, Infinity);
    const extent = thicketLod.y + margin;
    function update(view) {
      eye.copy(view);
      wind.value=performance.now()*.001;
      if ((view.x-previous.x)**2 + (view.z-previous.y)**2 < (margin-1)**2) return;
      previous.set(view.x, view.z);
      for (const stand of stands.values()) {
        const dx = view.x - clamp(view.x,stand.x,stand.x+farCell);
        const dz = view.z - clamp(view.z,stand.z,stand.z+farCell);
        const distance = dx*dx + dz*dz;
        stand.mesh.castShadow = distance < (mobile ? 76*76 : 91*91);
        stand.mesh.geometry = distance < (lod.y+margin)**2 ? stand.curved : stand.flat;
      }
      for (const {mesh} of pockets) mesh.count = 0;
      const x0 = Math.floor((view.x-extent)/cellSize), x1 = Math.floor((view.x+extent)/cellSize);
      const z0 = Math.floor((view.z-extent)/cellSize), z1 = Math.floor((view.z+extent)/cellSize);
      for (let ix=x0; ix<=x1; ix++) {
        const row=bins.get(ix);
        if(!row)continue;
        for (let iz=z0; iz<=z1; iz++) {
          const list = row.get(iz);
          if (!list) continue;
          for (const plant of list) {
            const distance=(plant.x-view.x)**2+(plant.z-view.z)**2;
            if (distance>plant.range) continue;
            fillInstances(plant,plant.meshes);
            if (plant.innerMeshes && distance<=plant.innerRange) fillInstances(plant,plant.innerMeshes);
          }
        }
      }
      for (const {mesh,shared} of pockets) {
        if (shared) mesh.count=shared.count;
        mesh.visible = mesh.count > 0;
        if (!mesh.visible) continue;
        if (!shared) {
          mesh.instanceMatrix.clearUpdateRanges();
          mesh.instanceColor.clearUpdateRanges();
          mesh.instanceMatrix.addUpdateRange(0, mesh.count*16);
          mesh.instanceColor.addUpdateRange(0, mesh.count*3);
          mesh.instanceMatrix.needsUpdate = true;
          mesh.instanceColor.needsUpdate = true;
        }
        mesh.computeBoundingSphere();
      }
    }
    group.userData.update = update;
    group.userData.setNight=night=>{
      light.fill.value=night?.07:1;
      if(night){light.direction.value.set(-.55,.76).normalize();farMat.color.setRGB(.064,.085,.125);}
      else{light.direction.value.set(.79,-.61);farMat.color.setHex(0xffffff);}
      if(fuji){
        const key=night?TougeFuji.dawnDirection:TougeFuji.sunDirection;
        light.direction.value.set(key.x,key.z).normalize();light.fill.value=night?.35:.92;
        farMat.color.setHex(night?0x9a9eb1:0xffe4ba);
      }
    };
    update(startEye);
  }

  // The drawn hillside is a sampled heightfield, and the shoulder covers its
  // edge. Project roots onto those triangles so bracken shows above the gravel
  // and trees stand on the visible slope between terrain samples.
  // The main mountainside is a regular triangle grid. Read its four actual
  // vertices at each root, including both triangles in the narrow seam where
  // their tolerances overlap. The shoulder and masonry still use their mesh bins.
  function projectHeightfield(grid, pos) {
    const {nx,nz,step}=grid, stride=nx+1, vertices=pos.array;
    const x0=pos.getX(0), z0=pos.getZ(0), x1=pos.getX(nx), z1=pos.getZ(nz*stride);
    // Allow the projection tolerance plus one unit of Float32 precision at
    // the largest world coordinate when selecting adjacent cells at a seam.
    const seam=.00001+Math.max(Math.abs(x0),Math.abs(x1),Math.abs(z0),Math.abs(z1))*2**-23/step;
    return (x,z) => {
      if(x<x0 || z<z0 || x>x1+step*seam || z>z1+step*seam) return -Infinity;
      const gx=(x-x0)/step, gz=(z-z0)/step;
      const i=Math.min(Math.floor(gx),nx-1), j=Math.min(Math.floor(gz),nz-1);
      const fx=gx-i,fz=gz-j;
      const i0=fx<seam?Math.max(0,i-1):i, i1=fx>1-seam?Math.min(nx-1,i+1):i;
      const j0=fz<seam?Math.max(0,j-1):j, j1=fz>1-seam?Math.min(nz-1,j+1):j;
      let high=-Infinity;
      for(let iz=j0;iz<=j1;iz++) for(let ix=i0;ix<=i1;ix++) {
        const a=(iz*stride+ix)*3, right=a+3, down=a+3*stride, opposite=down+3;
        const width=vertices[right]-vertices[a], depth=vertices[down+2]-vertices[a+2];
        const dx=x-vertices[a], dz=z-vertices[a+2], inv=1/(-width*depth);
        // The index order is (a, down, right), then (right, down, opposite).
        const u=-dz*width*inv, v=-depth*dx*inv;
        if (u>=-.00001 && v>=-.00001 && u+v<=1.00001) {
          const ay=vertices[a+1];
          high=Math.max(high,ay+u*(vertices[down+1]-ay)+v*(vertices[right+1]-ay));
        }
        const fromRight=x-vertices[right];
        const p=fromRight*depth*inv, q=(-width*dz-depth*fromRight)*inv;
        if (p>=-.00001 && q>=-.00001 && p+q<=1.00001) {
          const ay=vertices[right+1];
          high=Math.max(high,ay+p*(vertices[down+1]-ay)+q*(vertices[opposite+1]-ay));
        }
      }
      return high;
    };
  }

  function* groundProjection(scene,grid) {
    let terrain;
    const surfaces = [], cell = 8, stride = 10;
    scene.updateMatrixWorld(true);
    const identity = new T.Matrix4();
    for (const mesh of scene.children) {
      if (!mesh.isMesh || mesh.isInstancedMesh || !mesh.material.vertexColors || mesh.material.transparent) continue;
      const geometry = mesh.geometry, index = geometry.index;
      if (!index) continue;
      let pos = geometry.getAttribute('position');
      if (grid && geometry.getAttribute('grassCover')===grid.cover && mesh.matrixWorld.equals(identity) &&
          pos.count===(grid.nx+1)*(grid.nz+1)) {
        terrain=projectHeightfield(grid,pos);
        continue;
      }
      if (!mesh.matrixWorld.equals(identity)) pos = pos.clone().applyMatrix4(mesh.matrixWorld);
      const box = new T.Box3().setFromBufferAttribute(pos);
      const x0 = box.min.x, z0 = box.min.z;
      const cols = Math.floor((box.max.x - x0) / cell) + 1;
      const rows = Math.floor((box.max.z - z0) / cell) + 1;
      const bins = new Array(cols * rows);
      // Each grass root samples the rendered triangles three times. Cache
      // their barycentric bases once, using the same floats as the renderer.
      const triangles = new Float64Array(index.count / 3 * stride);
      let used = 0;
      for (let i = 0; i < index.count; i += 3) {
        if ((i % 6144) === 0) yield;
        const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
        const ax = pos.getX(a), bx = pos.getX(b), cx = pos.getX(c);
        const az = pos.getZ(a), bz = pos.getZ(b), cz = pos.getZ(c);
        const det = (bx-ax)*(cz-az) - (bz-az)*(cx-ax);
        if (det >= -0.00001) continue;
        const ay = pos.getY(a), offset = used;
        used += stride;
        triangles[offset] = ax;
        triangles[offset+1] = az;
        triangles[offset+2] = bx-ax;
        triangles[offset+3] = bz-az;
        triangles[offset+4] = cx-ax;
        triangles[offset+5] = cz-az;
        triangles[offset+6] = 1/det;
        triangles[offset+7] = ay;
        triangles[offset+8] = pos.getY(b)-ay;
        triangles[offset+9] = pos.getY(c)-ay;
        const xmin = Math.floor((Math.min(ax, bx, cx) - x0) / cell);
        const xmax = Math.floor((Math.max(ax, bx, cx) - x0) / cell);
        const zmin = Math.floor((Math.min(az, bz, cz) - z0) / cell);
        const zmax = Math.floor((Math.max(az, bz, cz) - z0) / cell);
        for (let iz = zmin; iz <= zmax; iz++) for (let ix = xmin; ix <= xmax; ix++) {
          const key = iz * cols + ix;
          (bins[key] || (bins[key] = [])).push(offset);
        }
      }
      surfaces.push({triangles, x0, z0, cols, rows, bins});
    }
    return (x, z, fallback) => {
      let high = terrain ? terrain(x,z) : -Infinity;
      for (const surface of surfaces) {
        const ix = Math.floor((x - surface.x0) / cell), iz = Math.floor((z - surface.z0) / cell);
        if (ix < 0 || iz < 0 || ix >= surface.cols || iz >= surface.rows) continue;
        const offsets = surface.bins[iz * surface.cols + ix];
        if (!offsets) continue;
        const a = surface.triangles;
        for (const n of offsets) {
          const dx = x-a[n], dz = z-a[n+1], inv = a[n+6];
          const u = (dx*a[n+5] - dz*a[n+4])*inv;
          const v = (a[n+2]*dz - a[n+3]*dx)*inv;
          if (u >= -0.00001 && v >= -0.00001 && u+v <= 1.00001) {
            high = Math.max(high, a[n+7] + u*a[n+8] + v*a[n+9]);
          }
        }
      }
      return Number.isFinite(high) ? high : fallback;
    };
  }

  function* addCanopyShade(group, patches, drawnHeight, groundAt) {
    const positions = [], colors = [], indices = [];
    const count = 8;
    for (let n=0;n<patches.length;n++) {
      if ((n & 63) === 0) yield;
      const patch=patches[n];
      const first = positions.length / 3, r = clamp(patch.width * .34, 1.25, 4.1);
      const x = patch.x + r * .04, z = patch.z - r * .03;
      const vertex = (px, pz, alpha) => {
        const surface=drawnHeight(px,pz,NaN);
        positions.push(px, (Number.isFinite(surface) ? surface : groundAt(px,pz)) + 0.045, pz);
        colors.push(0.022, 0.033, 0.032, alpha);
      };
      vertex(x, z, .30);
      for (const scale of [0.52, 1]) {
        for (let i = 0; i < count; i++) {
          const a = -i * TAU / count + patch.bearing;
          vertex(x + Math.cos(a) * r * scale, z + Math.sin(a) * r * scale * 0.79, scale < 1 ? .15 : 0);
        }
      }
      for (let i = 0; i < count; i++) {
        const u = first + 1 + i, v = first + 1 + (i + 1) % count;
        indices.push(first, u, v, u, u + count, v, v, u + count, v + count);
      }
    }
    if (!indices.length) return;
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 4));
    geo.setIndex(indices);
    const material = new T.MeshBasicMaterial({vertexColors: true, transparent: true,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1});
    const shade = new T.Mesh(geo, material);
    shade.name = 'Contact shade at the root flares';
    group.add(shade);
  }

  function* shadeForestFloor(scene, trees) {
    const ground = scene.getObjectByName('Cedar forest floor');
    if (!ground) return;
    const positions = ground.geometry.getAttribute('position');
    const colors = ground.geometry.getAttribute('color');
    const grass=ground.geometry.getAttribute('grassCover');
    if (!colors) return;
    const cell = 20, coverage = new Map();
    // Add a stand's canopies only to the ground cells that they cover.
    // This keeps the distant valley and open verges brighter than the shade
    // beneath a cedar grove, including where real-time shadows end.
    let placed=0;
    for (const stand of trees) for (const tree of stand) {
      if ((placed++ & 511) === 0) yield;
      if (tree.h < 3.4) continue;
      const r = clamp(2.8 + tree.w*.59, 4.7, 12);
      const disc = {x:tree.x, z:tree.z, inv:1/(r*r), density:clamp(tree.h/13,.35,1)};
      const x0 = Math.floor((tree.x-r)/cell), x1 = Math.floor((tree.x+r)/cell);
      const z0 = Math.floor((tree.z-r)/cell), z1 = Math.floor((tree.z+r)/cell);
      for (let x=x0; x<=x1; x++) for (let z=z0; z<=z1; z++) {
        const key=x+','+z;
        let discs=coverage.get(key);
        if (!discs) { discs=[]; coverage.set(key,discs); }
        discs.push(disc);
      }
    }
    for (let i=0; i<positions.count; i++) {
      if ((i & 2047) === 0) yield;
      const x=positions.getX(i), z=positions.getZ(i);
      const discs=coverage.get(Math.floor(x/cell)+','+Math.floor(z/cell));
      if (!discs) continue;
      let density=0;
      for (const disc of discs) {
        const dx=x-disc.x, dz=z-disc.z, cover=1-(dx*dx+dz*dz)*disc.inv;
        if (cover>0) density += cover*cover*disc.density;
      }
      const shade=1-Math.exp(-density*1.36);
      grass.setX(i,grass.getX(i)*(1-.83*shade));
      colors.setXYZ(i,colors.getX(i)*(1-.42*shade),colors.getY(i)*(1-.46*shade),
        colors.getZ(i)*(1-.43*shade));
    }
    colors.needsUpdate=true;
    grass.needsUpdate=true;
  }

  function* plantColonies(trees, small, course, drawnHeight, inClearing) {
    const rand=randomStream(4196615);
    let row=0;
    for (const stand of trees) for (const tree of stand) {
      if ((row++ & 511) === 0) yield;
      if (tree.verge>78 || tree.h<4.5 || rand()>.60) continue;
      const angle=rand()*TAU, radius=2.3+rand()*6;
      const cx=tree.x+Math.cos(angle)*radius, cz=tree.z+Math.sin(angle)*radius;
      const center=course.nearest(cx,cz);
      if (center.distance<course.half+2.5 || inClearing(center)) continue;
      const sx=(drawnHeight(cx+.8,cz,tree.y)-drawnHeight(cx-.8,cz,tree.y))/1.6;
      const sz=(drawnHeight(cx,cz+.8,tree.y)-drawnHeight(cx,cz-.8,tree.y))/1.6;
      if (Math.max(Math.abs(sx),Math.abs(sz))>1.6) continue;
      const slopeX=clamp(sx,-.83,.83), slopeZ=clamp(sz,-.83,.83);
      // Dwarf bamboo spreads in colonies. The damper, shaded pockets have
      // bracken and hillside scrub along the edges of the same clumps.
      const forestType=.43*Math.sin(cx*.039+cz*.013)+.25*Math.sin(cz*.063)+rand()*.62;
      const dominant=forestType>.62 ? 4 : forestType>.27 ? 6 : forestType>-.08 ? 5 : 7;
      const count=2+Math.floor(rand()*4), reach=1.4+rand()*3.0;
      for (let i=0;i<count;i++) {
        const dir=rand()*TAU, spread=rand()*reach;
        const x=cx+Math.cos(dir)*spread, z=cz+Math.sin(dir)*spread;
        if (center.distance < course.half+reach+3 && course.nearest(x,z).distance < course.half+2.1) continue;
        const tile=rand()<.83 ? dominant : 4+Math.floor(rand()*4);
        const h=(tile===7?.78:tile===6?.36:.49)+rand()*(tile===7?1.58:tile===6?.77:1.14);
        const w=h*(1.74+rand()*.95);
        small[tile].push({x,y:drawnHeight(x,z,tree.y)-.065,z,h,w,turn:rand()*TAU,slopeX,slopeZ,
          shade:.68+rand()*.32,warm:.93+rand()*.12});
      }
    }
    // Dense Sasa follows breaks in the canopy. A broken strip and a second
    // offset row leave short sightlines into the forest between colonies.
    for (let s=10;s<course.length-8;s+=1.9+rand()*2.4) for (const side of [-1,1]) {
      if ((row++ & 127) === 0) yield;
      const cover=.48+.31*Math.sin(s*.046+side*2.4)+.22*Math.sin(s*.107+side);
      if (cover<.49 || rand()>cover+.07) continue;
      const verge=course.half+3.8+1.0*Math.sin(s*.074+side)+rand()*2.6;
      const rows=cover>.65 && rand()>.32 ? 2 : 1;
      for (let row=0;row<rows;row++) {
        const point=course.at(s+row*(rand()-.5)*3,side*(verge+row*(2.4+rand()*3.4)));
        const p=course.nearest(point.x,point.z);
        if (p.distance<course.half+2.4 || inClearing(p)) continue;
        const y=drawnHeight(point.x,point.z,p.y);
        const sx=(drawnHeight(point.x+.85,point.z,y)-drawnHeight(point.x-.85,point.z,y))/1.7;
        const sz=(drawnHeight(point.x,point.z+.85,y)-drawnHeight(point.x,point.z-.85,y))/1.7;
        if (Math.max(Math.abs(sx),Math.abs(sz))>1.15) continue;
        const patch=Math.sin(s*.026+side*1.4);
        const tile=patch>.25 ? 4 : patch<-.40 ? 6 : row ? 7 : 5;
        const h=(tile===6?.46:.58)+rand()*(row?.89:.71);
        small[tile].push({x:point.x,y:y-.064,z:point.z,h,w:h*(2.1+rand()*1.1),turn:rand()*TAU,
          slopeX:sx,slopeZ:sz,shade:.86+rand()*.18,warm:.95+rand()*.10});
      }
    }
  }

  function* forestSteps(scene, course, groundAt, forestFloor, walls) {
    const group = new T.Group();
    const fuji=course.mapId==='fuji';
    group.name = fuji?'Mikuni woodland and susuki meadows':'Haruna sugi forest';
    const rng = randomStream(fuji?369207:861977);
    const drawnHeight = yield* groundProjection(scene,forestFloor);
    const trees = [[], [], [], []], small = Array.from({length:8},()=>[]), shadePatches = [];
    const {minX, maxX, minZ, maxZ} = course.bounds;
    const inClearing = p => (p.s > course.finish - 103 && p.distance < 31) ||
      (Math.abs(p.s - course.splits[0]) < 37 && p.distance < 24);
    const edge = course.half + 4.65;
    const margin = 175, cell = 12;

    function chooseSpecies(p, field) {
      const value = rng(), low = p.s > course.splits[1];
      const cedar = (fuji?(low?.15:.21):(low ? 0.34 : 0.53)) + 0.23 * (field - 0.55);
      if (value < cedar) return 0;
      if (value < cedar + 0.19) return 1;
      return value > (low ? 0.88 : 0.93) ? 3 : 2;
    }
    function placeTree(x, z, p, y, type, h, young) {
      let w = h * crownRatios[type] * (0.78 + rng() * 0.44) * (young ? 1.07 : 1);
      const crownRadius = type === 1 ? 0.83 : 0.57;
      const vergeScale = Math.min(1, (p.distance - course.half - 1) / (crownRadius * w));
      w *= vergeScale;
      h *= vergeScale;
      const rootY = drawnHeight(x, z, y);
      const shade = young ? .66 + rng()*.20 : .78 + rng()*.30;
      const detail = p.distance < 39 && h > 2.5;
      const variant = Math.sin(x*1.78 + z*2.15) > 0 ? 1 : 0;
      trees[type].push({kind: type, detail, variant, verge:p.distance, x, y: rootY - .075, z, h, w, turn: rng() * TAU,
        shade, warm: 0.94 + rng() * 0.17 + (type === 3 ? 0.035 : 0)});
      return w;
    }
    for (let gz = minZ - margin; gz < maxZ + margin; gz += cell) {
      yield;
      for (let gx = minX - margin; gx < maxX + margin; gx += cell) {
        const x = gx + (0.02 + 0.96 * rng()) * cell, z = gz + (0.02 + 0.96 * rng()) * cell;
        const p = course.nearest(x, z);
        if (p.distance < edge || p.distance > margin || inClearing(p)) continue;
        const y = groundAt(x, z);
        if (!Number.isFinite(y)) continue;
        const field = 0.50 + 0.23 * Math.sin(x * 0.051 + Math.sin(z * 0.024)) +
          0.18 * Math.sin(z * 0.048 - x * 0.029) + 0.10 * Math.cos((x + z) * 0.087);
        const downhill = y < p.y - 2 - p.distance * 0.048;
        const vista = downhill && Math.sin(p.s * 0.0104 + 0.7) > -0.30;
        const rim = clamp((margin - p.distance) / 46, 0, 1);
        let density = (0.22 + field * 0.90) * rim;
        if(fuji){
          const meadow=TougeFuji.meadow(p.s);
          // Grass on both shoulders opens each straight. On the west-facing
          // slope the clearing extends as far as the forest's distant LOD.
          const clearing=Math.max(x<p.x+5?1:0,1-T.MathUtils.smoothstep(p.distance,60,130));
          density*=.80*(1-.995*meadow*clearing);
        }
        if (vista && p.distance < 82) density *= 0.12 + 0.47 * p.distance / 82;
        if (p.s >= course.splits[1] && p.distance < 68) density *= 0.65;
        if (rng() > density) continue;
        const species = chooseSpecies(p, field);
        const h = (species === 0 ? 22.2 : species === 1 ? 17.8 : species === 2 ? 14.9 : 11.0) *
          (0.49 + rng() * 0.52 + rng() * 0.25) * (0.87 + field * 0.28);
        const width = placeTree(x, z, p, y, species, h, false);
        const interior = !vista || p.distance > 90;
        if (p.distance < 63) shadePatches.push({x, y, z, width, bearing: rng() * TAU});
        // Groves have a few mature trees around a seed tree and smaller
        // spreading understory at their margins. Vistas keep isolated trees.
        const companions = interior ? Math.floor(0.51 + field * 2.8 + rng() * 0.65) : (rng() < 0.21 ? 1 : 0);
        for (let j = 0; j < companions; j++) {
          const angle = rng() * TAU, radius = 3.9 + rng() * (j ? 7.9 : 6.2);
          const sx = x + Math.cos(angle) * radius, sz = z + Math.sin(angle) * radius;
          const q = course.nearest(sx, sz);
          if (q.distance < edge || inClearing(q)) continue;
          const sy = groundAt(sx, sz);
          if (!Number.isFinite(sy)) continue;
          const young = rng() < 0.33;
          const kind = young ? (rng() < 0.83 ? 2 : 3) : (rng() < 0.64 ? species : chooseSpecies(q, field));
          const height = young ? 2.2 + rng() * 4.3 : h * (0.48 + rng() * 0.64);
          placeTree(sx, sz, q, sy, kind, height, young);
        }
      }
    }

    // Small patches follow the shoulder and spill around the forest edge.
    // Every member checks the closest stretch of tarmac at tight switchbacks.
    let patchRow=0;
    for (let s = 4; s < course.length; s += 2.40 + rng() * 3.25) {
      if ((patchRow++ & 63) === 0) yield;
      for (const side of [-1, 1]) {
        const patch = 0.5 + 0.5 * Math.sin(s * 0.043 + side * 2.8 + Math.sin(s * 0.077));
        if (rng() > 0.28 + patch * 0.58) continue;
        const distance = course.half + 1.45 + Math.pow(rng(), 1.42) * 12;
        const point = course.at(s, side * distance);
        const dry = Math.sin(s * 0.019 + side) > 0.3;
        const shape = rng();
        const kind = dry && shape < .61 ? 3 : shape < .11 ? 0 : shape < .54 ? 1 : 2;
        const stems = 2 + Math.floor(rng() * 4);
        for (let i = 0; i < stems; i++) {
          const x = point.x + (rng() - 0.5) * 5.8, z = point.z + (rng() - 0.5) * 5.8;
          const p = course.nearest(x, z);
          if (p.distance < course.half + 1.25 || (inClearing(p) && p.distance < course.half + 3.8)) continue;
          const y = groundAt(x, z);
          if (!Number.isFinite(y)) continue;
          const h = (kind === 2 ? .48 : .24) + rng() * (kind === 2 ? .87 : .62);
          small[kind].push({x, y: drawnHeight(x, z, y) - 0.055, z, h, w: h * (kind === 1 ? 1.5 + rng()*.82 : 1.02 + rng()*.85),
            turn: rng() * TAU, shade: .81 + rng() * .29, warm: 0.89 + rng() * 0.22});
        }
      }
    }

    yield* plantColonies(trees, small, course, drawnHeight, inClearing);
    yield* shadeForestFloor(scene, trees);
    if(forestFloor.fill){
      const {position,grassCover}=forestFloor.fill.attributes;
      for(let i=0;i<position.count;i++){
        const cover=TougeGrass.coverAt(forestFloor,position.getX(i),position.getZ(i));
        // Soil just above the coping is thinner than the bank behind it.
        grassCover.setX(i,cover*(.64+.12*(i%4)));
      }
      grassCover.needsUpdate=true;
    }
    const grasses=yield* TougeGrass.scatterSteps(course,forestFloor,walls,drawnHeight,randomStream(0x4a718));
    yield* forestMeshes(group, trees, small, grasses, course.at(course.start),fuji);
    yield* addCanopyShade(group, shadePatches, drawnHeight, groundAt);
    scene.add(group);
    return group;
  }

  function addForest(scene, course, groundAt, forestFloor, walls) {
    const steps=forestSteps(scene,course,groundAt,forestFloor,walls);
    let result;
    do {result=steps.next();} while(!result.done);
    return result.value;
  }
  addForest.steps = forestSteps;
  window.addForest = addForest;
})();
