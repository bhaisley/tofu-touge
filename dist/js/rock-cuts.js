(() => {
  'use strict';
  const T = THREE;
  const up = new T.Vector3(0,1,0);
  const TAU = Math.PI*2;

  function randomSource(seed) {
    return () => {
      seed = (Math.imul(seed,1664525)+1013904223) >>> 0;
      return seed/4294967296;
    };
  }

  // Intersect fracture planes to form broad, angular faces and chipped
  // shoulders. Each individual plane keeps its own photographed surface.
  function fracturedBlock(random) {
    const planes = [];
    function plane(x,y,z,distance) {
      planes.push({n:new T.Vector3(x,y,z).normalize(),distance});
    }
    plane((random()-.5)*.43,1,(random()-.5)*.42,.68+random()*.20);
    plane(0,-1,0,.89);
    const sides = 7+Math.floor(random()*3), skew = random()*TAU;
    for (let i=0;i<sides;i++) {
      const a = skew+(i+(random()-.5)*.36)*TAU/sides;
      const x = Math.cos(a),z = Math.sin(a);
      plane(x,(random()-.40)*.48,z,.80+random()*.22);
      plane(Math.cos(a+.20),.63+random()*.63,Math.sin(a+.20),.83+random()*.23);
      if (i%2===0) plane(x,-.64-random()*.32,z,.87+random()*.16);
    }
    const faces = [];
    for (const face of planes) {
      const n = face.n,origin = n.clone().multiplyScalar(face.distance);
      const right = new T.Vector3().crossVectors(Math.abs(n.y)<.93?up:new T.Vector3(1,0,0),n).normalize();
      const vertical = new T.Vector3().crossVectors(n,right);
      let loop = [[-3,-3],[3,-3],[3,3],[-3,3]].map(([u,v])=>
        origin.clone().addScaledVector(right,u).addScaledVector(vertical,v));
      for (const other of planes) {
        if (other===face || !loop.length) continue;
        const clipped = [];
        let a = loop[loop.length-1],da = other.n.dot(a)-other.distance;
        for (const b of loop) {
          const db = other.n.dot(b)-other.distance;
          if ((da<=0)!==(db<=0)) clipped.push(a.clone().lerp(b,da/(da-db)));
          if (db<=0) clipped.push(b);
          a=b;da=db;
        }
        loop=clipped;
      }
      if (loop.length>=3) faces.push(loop);
    }
    return faces;
  }

  function findExposures(course, height, random) {
    const sites = [];
    for (let s=course.start+5;s<course.finish-35;s+=8.3) {
      const p=course.sample(s);
      for (const side of [-1,1]) for (const band of [18,24,30,36]) {
        const d=band+(random()-.5)*3.2;
        const x=p.x+p.rx*side*d,z=p.z+p.rz*side*d,y=height(x,z);
        const gx=(height(x+1.7,z)-height(x-1.7,z))/3.4;
        const gz=(height(x,z+1.7)-height(x,z-1.7))/3.4;
        const grade=Math.hypot(gx,gz), facing=(gx*p.rx+gz*p.rz)*side;
        if (grade<.26 || facing<.13 || y<p.y-.65) continue;
        const nearest=course.nearest(x,z);
        if (nearest.distance<15 || Math.abs(nearest.s-s)>22) continue;
        sites.push({s,x,z,side,gx:gx/grade,gz:gz/grade,grade,
          score:Math.min(1.07,grade)*(.75+random()*.39)+random()*.08});
      }
    }
    const chosen=[];
    function choose(from,to,side,minGap) {
      let best=null;
      for (const site of sites) {
        if (site.s<from || site.s>to || side && site.side!==side) continue;
        if (chosen.some(p=>Math.hypot(p.x-site.x,p.z-site.z)<minGap)) continue;
        if (!best || site.score>best.score) best=site;
      }
      if (best) chosen.push(best);
    }
    // At the shrine the exposed cut is opposite the steps. In the lower
    // valley it is on the high bank above the open view to the right.
    choose(course.splits[0]-2,course.splits[0]+39,1,38);
    choose(course.splits[1]+469,course.splits[1]+507,-1,38);
    choose(course.splits[0]+51,course.splits[0]+99,1,49);
    choose(course.splits[1]+527,course.splits[1]+577,-1,50);
    for (let start=course.start+14;start<course.finish-55;start+=109+random()*130)
      choose(start,start+47+random()*54,0,48+random()*36);
    return chosen;
  }

  function addRockCuts(scene,course,forestFloor,groundAt) {
    const random=randomSource(0x9bc73),height=forestFloor?.drawnHeight || groundAt;
    const group=new T.Group();group.name='Exposed Haruna bedrock';
    const shapes=Array.from({length:7},()=>fracturedBlock(random));
    const material=TougeLighting.scannedSurface('haruna-volcanic',.88,{
      vertexColors:true,roughness:.94,metalness:0,envMapIntensity:.55
    });
    material.name='Fractured volcanic rock';
    const chunks=new Map(), tmp=new T.Vector3();
    const faces=findExposures(course,height,random);
    function block(cx,cz,gx,gz,halfLength,halfDepth,halfHeight,bury,slopeFit) {
      const nearest=course.nearest(cx,cz);
      const radius=Math.hypot(halfLength,halfDepth)*1.20;
      // Allow for the entire footprint and the fill behind retaining walls,
      // including the opposing leg where a hairpin doubles back.
      if (nearest.distance-radius<14.5 || nearest.distance>42) return;
      if (nearest.offset<0 && Math.abs(nearest.s-course.splits[0])<46 && nearest.distance-radius<31) return;
      if (nearest.offset>0 && nearest.s>course.finish-80 && nearest.distance-radius<38) return;
      const key=Math.floor(cx/145)+','+Math.floor(cz/145);
      if (!chunks.has(key)) chunks.set(key,{positions:[],normals:[],uvs:[],colors:[],indices:[]});
      const chunk=chunks.get(key),cy=height(cx,cz),tx=gz,tz=-gx;
      const twist=(random()-.5)*.48,ct=Math.cos(twist),st=Math.sin(twist);
      const alongX=tx*ct+gx*st,alongZ=tz*ct+gz*st,backX=-tx*st+gx*ct,backZ=-tz*st+gz*ct;
      const shape=shapes[Math.floor(random()*shapes.length)],uShift=random(),vShift=random();
      const mineral=.76+random()*.29, weather=random();
      function fitted(p) {
        const x=cx+alongX*p.x*halfLength+backX*p.z*halfDepth;
        const z=cz+alongZ*p.x*halfLength+backZ*p.z*halfDepth;
        const land=height(x,z);
        // Bedrock follows the cut into the mountain. Detached talus keeps a
        // more level top and settles into the soil at its downhill foot.
        const slope=(land-cy)*slopeFit;
        const nominalBase=cy-halfHeight*(.89+bury)+slope;
        const foot=Math.max(0,nominalBase-land+.19)*(1-T.MathUtils.smoothstep(p.y,-.70,.04));
        return new T.Vector3(x,cy+halfHeight*(p.y-bury)+slope-foot,z);
      }
      for (const face of shape) {
        const pts=face.map(fitted),centre=new T.Vector3();
        if (pts.every(p=>p.y<height(p.x,p.z)-.12)) continue;
        for (const p of pts) centre.add(p);
        centre.multiplyScalar(1/pts.length);
        const normal=new T.Vector3().crossVectors(
          pts[1].clone().sub(pts[0]),pts[pts.length-1].clone().sub(pts[0])).normalize();
        const tangent=Math.abs(normal.y)<.82?new T.Vector3().crossVectors(up,normal).normalize():
          new T.Vector3(1,0,0).addScaledVector(normal,-normal.x).normalize();
        const bitangent=new T.Vector3().crossVectors(normal,tangent);
        const base=chunk.positions.length/3,n=pts.length;
        function vertex(point,shadeNormal,localHeight) {
          chunk.positions.push(point.x,point.y,point.z);
          chunk.normals.push(shadeNormal.x,shadeNormal.y,shadeNormal.z);
          chunk.uvs.push(point.dot(tangent)/2.7+uShift,point.dot(bitangent)/2.7+vShift);
          const moss=T.MathUtils.smoothstep(normal.y,.32,.95)*(.16+.22*weather);
          const shade=mineral*(.76+.24*T.MathUtils.smoothstep(localHeight,-.42,.45));
          chunk.colors.push(shade*(1-.24*moss),shade*(1+.05*moss),shade*(1-.48*moss));
        }
        if (halfHeight<.85) {
          for (let i=0;i<n;i++) vertex(pts[i],normal,face[i].y);
          for (let i=1;i<n-1;i++) chunk.indices.push(base,base+i,base+i+1);
          continue;
        }
        // Narrow chipped bevels catch the dawn light between joint planes.
        const bevel=Math.min(halfLength,halfDepth,halfHeight)*.021;
        for (let i=0;i<n;i++) {
          const radial=tmp.copy(pts[i]).sub(centre).normalize();
          const edgeNormal=normal.clone().addScaledVector(radial,.20).normalize();
          vertex(pts[i],edgeNormal,face[i].y);
        }
        for (let i=0;i<n;i++) {
          const inner=pts[i].clone().lerp(centre,.065).addScaledVector(normal,bevel);
          vertex(inner,normal,face[i].y);
        }
        for (let i=0;i<n;i++) {
          const j=(i+1)%n;
          chunk.indices.push(base+i,base+j,base+n+j,base+i,base+n+j,base+n+i);
        }
        for (let i=1;i<n-1;i++) chunk.indices.push(base+n,base+n+i,base+n+i+1);
      }
    }
    for (const site of faces) {
      const {x,z,gx,gz,grade}=site,tx=gz,tz=-gx;
      const ledges=2+Math.floor(random()*3),span=8+random()*11;
      for (let i=0;i<ledges;i++) {
        const along=(i/(ledges-1)-.5)*span+(random()-.5)*2.1;
        const uphill=(random()-.5)*4;
        const slopeFit=.39+.39*T.MathUtils.smoothstep(grade,.6,1.76);
        block(x+tx*along+gx*uphill,z+tz*along+gz*uphill,gx,gz,
          2.1+random()*2.8,1.45+random()*1.7,1.05+Math.min(1.3,grade)*.73+random()*.92,
          .16+random()*.23,slopeFit);
      }
      const talus=5+Math.floor(random()*8);
      for (let i=0;i<talus;i++) {
        const along=(random()+random()-1)*(span*.90+4),downhill=2.4+random()*7.6;
        const r=.32+random()**1.75*1.52;
        block(x+tx*along-gx*downhill,z+tz*along-gz*downhill,gx,gz,
          r*(.85+random()*.62),r*(.64+random()*.45),r*(.72+random()*.42),.08+random()*.29,.19);
      }
    }
    for (const chunk of chunks.values()) {
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(chunk.positions,3));
      geometry.setAttribute('normal',new T.Float32BufferAttribute(chunk.normals,3));
      geometry.setAttribute('uv',new T.Float32BufferAttribute(chunk.uvs,2));
      geometry.setAttribute('color',new T.Float32BufferAttribute(chunk.colors,3));
      geometry.setIndex(chunk.indices);geometry.computeBoundingSphere();
      const rocks=new T.Mesh(geometry,material);rocks.name='Weathered rock exposure';
      rocks.castShadow=true;rocks.receiveShadow=true;group.add(rocks);
    }
    scene.add(group);
    return group;
  }
  window.addRockCuts=addRockCuts;
})();
