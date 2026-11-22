(() => {
  'use strict';
  const T=THREE, magic=0x314f4143; // CAO1, little endian
  const seed=2166136261;
  const hashWord=(h,n)=>Math.imul(h^n,16777619)>>>0;
  function hashString(h,text) {
    for(let i=0;i<text.length;i++)h=hashWord(h,text.charCodeAt(i));
    return h;
  }
  function collect(root,space,accept=()=>true) {
    const inverse=space.matrixWorld.clone().invert(),surfaces=[];
    root.traverse(mesh=>{
      if(mesh.isMesh && mesh.geometry.attributes.normal && accept(mesh)){
        surfaces.push({mesh,matrix:new T.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld)});
      }
    });
    return surfaces;
  }
  function opaque(surface) {
    const m=surface.mesh.material;
    return !m.transparent && !(m.alphaTest>.01);
  }

  // The authoring tool and runtime share these identities. Quantization
  // tolerates floating-point variation between browser engines while catching
  // changed triangles, normals and relative placement. An edit to a nearby
  // occluder invalidates the affected assembly as well as the edited mesh.
  function catalogue(car) {
    car.group.updateWorldMatrix(true,true);
    const fingerprints=new Map();
    function fingerprint(geo) {
      if(fingerprints.has(geo))return fingerprints.get(geo);
      let h=seed;
      for(const [name,scale] of [['position',10000],['normal',1024]]) {
        const attr=geo.getAttribute(name);
        h=hashWord(h,attr.count);
        for(const value of attr.array)h=hashWord(h,Math.round(value*scale));
      }
      if(geo.index)for(const index of geo.index.array)h=hashWord(h,index);
      fingerprints.set(geo,h);return h;
    }
    function stamp({mesh,matrix}) {
      let h=hashString(fingerprint(mesh.geometry),mesh.name);
      for(const value of matrix.elements)h=hashWord(h,Math.round(value*10000));
      return h;
    }
    const body=collect(car.body,car.body),driver=new Set();
    car.driver?.traverse(m=>driver.add(m));
    const cabin=body.filter(p=>!driver.has(p.mesh));
    const driverParts=body.filter(p=>driver.has(p.mesh));
    const tires=car.wheels.flatMap(w=>collect(w.spin,car.group,m=>m.name==='tire'));
    const spaces=[
      {name:'body',receivers:cabin,casters:cabin.concat(tires).filter(opaque),reach:.29},
      {name:'driver',receivers:driverParts,casters:body.filter(opaque),reach:.31}
    ];
    const rightWheels=car.wheels.filter(w=>w.side>0);
    const rotating=collect(rightWheels[0].spin,rightWheels[0].spin);
    // The rotating castings never carry a stationary fender or caliper imprint.
    spaces.push({name:'rotating wheel',receivers:rotating,casters:rotating.filter(opaque),reach:.14});
    for(const wheel of rightWheels) {
      const spinning=new Set();wheel.spin.traverse(m=>spinning.add(m));
      const all=collect(wheel.hub,wheel.hub);
      spaces.push({name:wheel.steers?'front brake':'rear brake',receivers:all.filter(p=>!spinning.has(p.mesh)),
        casters:all.filter(opaque),reach:.14});
    }
    const parts=[],seen=new Set();
    for(const space of spaces) {
      let surroundings=hashString(seed,space.name);
      const stamps=space.casters.map(stamp).sort((a,b)=>a-b);
      for(const hash of stamps)surroundings=hashWord(surroundings,hash);
      for(const surface of space.receivers) {
        const geometry=surface.mesh.geometry;
        if(seen.has(geometry))continue;
        seen.add(geometry);
        parts.push({...surface,space,id:stamp(surface),surroundings,count:geometry.attributes.position.count});
      }
    }
    return {parts,spaces};
  }

  function patchMaterial(material) {
    if(material.userData.hasCarOcclusion)return;
    material.userData.hasCarOcclusion=true;
    const previous=material.onBeforeCompile,priorKey=material.customProgramCacheKey();
    material.defaultAttributeValues={...material.defaultAttributeValues,carAO:[0]};
    material.onBeforeCompile=function(shader,renderer) {
      previous.call(this,shader,renderer);
      shader.vertexShader='attribute float carAO; varying float vCarAO;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\n vCarAO=carAO;');
      shader.fragmentShader='varying float vCarAO;\n'+shader.fragmentShader
        .replace('#include <aomap_fragment>',`#include <aomap_fragment>
          reflectedLight.indirectDiffuse *= 1. - .60 * vCarAO;
          reflectedLight.indirectSpecular *= 1. - .43 * vCarAO * smoothstep(.09,.72,roughnessFactor);`);
    };
    material.customProgramCacheKey=()=>priorKey+'|car-cavity-1';
    material.needsUpdate=true;
  }
  function attach(image,parts) {
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const bytes=new Uint8Array(rgba.length/4*3);
    for(let src=0,dst=0;src<rgba.length;src+=4){bytes[dst++]=rgba[src];bytes[dst++]=rgba[src+1];bytes[dst++]=rgba[src+2];}
    if(bytes.length<8)return 0;
    const header=new DataView(bytes.buffer),n=header.getUint32(4,true),records=new Map();
    if(header.getUint32(0,true)!==magic || n>512 || 8+16*n>bytes.length)return 0;
    for(let i=0;i<n;i++){
      const h=8+16*i,id=header.getUint32(h,true),surroundings=header.getUint32(h+4,true);
      const offset=header.getUint32(h+8,true),count=header.getUint32(h+12,true);
      if(offset<8+16*n || offset+count>bytes.length)return 0;
      records.set(id+':'+surroundings,bytes.subarray(offset,offset+count));
    }
    let applied=0;
    for(const part of parts) {
      const values=records.get(part.id+':'+part.surroundings);
      if(!values || values.length!==part.count)continue;
      part.mesh.geometry.setAttribute('carAO',new T.BufferAttribute(values,1,true));
      applied++;
    }
    return applied;
  }
  function install(car) {
    const {parts}=catalogue(car);
    for(const {mesh} of parts)if(mesh.material.isMeshStandardMaterial)patchMaterial(mesh.material);
    const url=window.TougeArtURLs?.['neo86-occlusion.webp']||'assets/art/neo86-occlusion.webp';
    return new Promise(resolve=>{
      new T.ImageLoader().load(url,image=>{
        try{resolve(attach(image,parts));}catch{resolve(0);}
      },undefined,()=>resolve(0));
    });
  }
  window.TougeCarOcclusion={install,catalogue,magic};
})();
