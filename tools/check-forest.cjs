// Verify the actual course meshes and the streamed instances without a browser or GPU.
'use strict';
const assert=require('node:assert/strict');
const T=require('../dist/vendor/three.min.js');
global.window=globalThis;
global.THREE={...T,
  WebGLRenderer:class {constructor(){this.shadowMap={};}},
  TextureLoader:class {load(){return new T.Texture();}}
};
const noOp=()=>{};
const ink={fillRect:noOp,fillText:noOp,beginPath:noOp,moveTo:noOp,lineTo:noOp,closePath:noOp,fill:noOp};
global.document={createElement:()=>({getContext:()=>ink})};
global.TougeLighting={
  makeSky:()=>({userData:{setNight:noOp}}),makeSun:noOp,detailTerrainMaterial:noOp,
  scannedSurface:(_name,_scale,options)=>new T.MeshStandardMaterial(options)
};
global.TougeWetRoad=class {
  constructor(){this.pavement=new T.MeshStandardMaterial();this.shoulder=new T.MeshStandardMaterial({vertexColors:true});}
  exclude(){} matchForestFloor(){} dressVerge(){}
};
// The generator yields here only after the complete forest joins the scene.
global.addRoadside={steps:function*(){yield;}};
require('../dist/js/course.js');
require('../dist/js/fuji.js');
require('../dist/js/grass.js');
require('../dist/js/rock-cuts.js');
require('../dist/js/forest.js');
require('../dist/js/world.js');

function collect(group,course) {
  const all=group.children.filter(mesh=>mesh.isInstancedMesh);
  const stands=all.filter(mesh=>mesh.geometry.hasAttribute('treeCell'));
  const near=all.filter(mesh=>!mesh.geometry.hasAttribute('treeCell'));
  const cards=new Set(),grass=new Set();
  const transform=new T.Matrix4(),point=new T.Vector3();
  for(const trunk of near.filter(mesh=>mesh.name.endsWith(' trunks'))) {
    const name=trunk.name.replace(' trunks',' needles and leaves');
    if(!near.some(mesh=>mesh.name===name && mesh.instanceMatrix===trunk.instanceMatrix &&
      mesh.instanceColor===trunk.instanceColor)) throw Error('Unpaired '+trunk.name);
  }
  const views=[];
  for(let i=0;i<61;i++) {
    const s=course.start+(course.finish-course.start)*i/60;
    views.push(course.at(s,Math.sin(s*.054)*3,2.6));
  }
  function sample(view) {
    group.userData.update(view);
    let hash=2166136261;
    const add=value=>{hash=Math.imul(hash^value,16777619);};
    for(const stand of stands) {
      cards.add(stand.geometry.attributes.position);
      add(stand.castShadow);add(stand.geometry.attributes.position.count);
    }
    for(const mesh of near) {
      const {count,instanceMatrix,instanceColor}=mesh;
      add(count);
      if(count>instanceMatrix.count || count>instanceColor.count) throw Error('Overflow in '+mesh.name);
      if(!count)continue;
      if(!Number.isFinite(mesh.boundingSphere.radius)) throw Error('Invalid bounds for '+mesh.name);
      const box=mesh.geometry.boundingBox;
      for(const instance of [0,Math.floor(count/2),count-1]){
        mesh.getMatrixAt(instance,transform);
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
          point.set(x,y,z).applyMatrix4(transform);
          assert(mesh.boundingSphere.distanceToPoint(point)<.002,'Culled instance of '+mesh.name);
        }
      }
      if(/grass|sedge|susuki/i.test(mesh.name))grass.add(mesh.name);
      for(const attribute of [instanceMatrix,instanceColor]) {
        const array=attribute.array;
        const bits=new Uint32Array(array.buffer,array.byteOffset,count*attribute.itemSize);
        for(const value of bits) add(value);
      }
    }
    return hash;
  }
  group.userData.setNight(false);
  group.userData.update(views.at(-1));
  const downhill=views.map(sample);
  group.userData.setNight(true);
  const uphill=views.reverse().map(sample).reverse();
  return {downhill,uphill,stands:stands.length,cards:cards.size,grass:grass.size,
    standAttributes:new Set(stands.map(mesh=>mesh.geometry.attributes.treeCell)).size};
}

for(const [mountain,mobile] of [['haruna',false],['haruna',true],['fuji',false],['fuji',true]]) {
  global.innerWidth=mobile?440:1280;
  global.matchMedia=query=>({matches:mobile && query==='(pointer: coarse)'});
  const course=new TougeCourse(mountain), world=Object.create(TougeWorld.prototype);
  const steps=world.build(null,course);
  while(!world.forest) assert(!steps.next().done,'World construction skipped the forest');
  steps.return();
  if(mountain==='fuji'){
    const tiles=world.scene.children.filter(mesh=>mesh.name==='Mikuni mountainside');
    const index=tiles[0].geometry.index,positions=tiles[0].geometry.attributes.position;
    const point=new T.Vector3();
    let offset=0;
    for(const {geometry:g} of tiles){
      assert(g.index===index && g.attributes.position===positions && g.drawRange.start===offset);
      const end=offset+g.drawRange.count;
      for(;offset<end;offset++)assert(g.boundingBox.containsPoint(point.fromBufferAttribute(positions,index.getX(offset))));
    }
    assert(tiles.length>1 && offset===index.count,'All mountain triangles must belong to one tile');
  }
  const report=collect(world.forest,course);
  assert.deepEqual(report.uphill,report.downhill,'A return trip must restore every transform, color and LOD');
  assert(report.stands>1 && report.standAttributes===report.stands,'Each stand must retain its own tree variants');
  assert.equal(report.cards,2,'Stands must share their two portrait vertex buffers');
  assert(report.grass>=4,'The course must stream short and tall roadside grasses');
  console.log(`${mountain} · ${mobile?'Touch':'Desktop'} · ${report.stands} forest stands · ${report.grass} grass batches · 122 verified views`);
}
