// With dist served locally, run: node tools/bake-car-occlusion.cjs <game URL>
// Requires Playwright, Chromium and sharp. CHROME_BIN can select installed Chrome.
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');
const sharp = require('sharp');

function bakeInBrowser() {
  const T=THREE, model=TougeNeo86.create();
  const {parts,spaces}=TougeCarOcclusion.catalogue(model);
  const samples=64, golden=2.39996322972865;
  const directions=Array.from({length:samples},(_,i)=>{
    const radius=Math.sqrt((i+.5)/samples),angle=i*golden;
    return [radius*Math.cos(angle),radius*Math.sin(angle),Math.sqrt(1-radius*radius)];
  });

  // xyz, edge1, edge2, box minimum, box maximum, centroid for each triangle.
  const stride=18,v=new T.Vector3(),normal=new T.Vector3(),normMatrix=new T.Matrix3();
  function triangles(surfaces) {
    const raw=[];
    for(const {mesh,matrix} of surfaces) {
      const geometry=mesh.geometry, positions=geometry.attributes.position,index=geometry.index;
      const vertices=new Float32Array(positions.count*3);
      for(let i=0;i<positions.count;i++)v.fromBufferAttribute(positions,i).applyMatrix4(matrix).toArray(vertices,i*3);
      const size=index?index.count:positions.count;
      for(let i=0;i<size;i+=3) {
        const a=3*(index?index.getX(i):i),b=3*(index?index.getX(i+1):i+1),c=3*(index?index.getX(i+2):i+2);
        for(let j=0;j<3;j++)raw.push(vertices[a+j]);
        for(let j=0;j<3;j++)raw.push(vertices[b+j]-vertices[a+j]);
        for(let j=0;j<3;j++)raw.push(vertices[c+j]-vertices[a+j]);
        for(let j=0;j<3;j++)raw.push(Math.min(vertices[a+j],vertices[b+j],vertices[c+j]));
        for(let j=0;j<3;j++)raw.push(Math.max(vertices[a+j],vertices[b+j],vertices[c+j]));
        for(let j=0;j<3;j++)raw.push((vertices[a+j]+vertices[b+j]+vertices[c+j])/3);
      }
    }
    return new Float32Array(raw);
  }

  // A median-split BVH bounds each ray query to the local bodywork.
  function visibilityQuery(surfaces) {
    const tris=triangles(surfaces),order=Uint32Array.from({length:tris.length/stride},(_,i)=>i*stride);
    const tree=[],stack=new Int32Array(72);
    function build(begin,end) {
      const node={lo:[Infinity,Infinity,Infinity],hi:[-Infinity,-Infinity,-Infinity],begin,end,left:-1,right:-1};
      const id=tree.length;tree.push(node);
      for(let i=begin;i<end;i++){
        const k=order[i];
        for(let a=0;a<3;a++){
          node.lo[a]=Math.min(node.lo[a],tris[k+9+a]);node.hi[a]=Math.max(node.hi[a],tris[k+12+a]);
        }
      }
      if(end-begin>10){
        const span=node.hi.map((b,i)=>b-node.lo[i]);
        const axis=span.indexOf(Math.max(...span)),mid=(begin+end)>>>1;
        order.subarray(begin,end).sort((a,b)=>tris[a+15+axis]-tris[b+15+axis]);
        node.left=build(begin,mid);node.right=build(mid,end);
      }
      return id;
    }
    build(0,order.length);
    return (ox,oy,oz,dx,dy,dz,range)=>{
      let best=range,size=1;stack[0]=0;
      const ix=1/(dx||1e-20),iy=1/(dy||1e-20),iz=1/(dz||1e-20);
      while(size) {
        const node=tree[stack[--size]];
        const xa=(node.lo[0]-ox)*ix,xb=(node.hi[0]-ox)*ix;
        const ya=(node.lo[1]-oy)*iy,yb=(node.hi[1]-oy)*iy;
        const za=(node.lo[2]-oz)*iz,zb=(node.hi[2]-oz)*iz;
        if(Math.max(0,Math.min(xa,xb),Math.min(ya,yb),Math.min(za,zb))>
           Math.min(best,Math.max(xa,xb),Math.max(ya,yb),Math.max(za,zb)))continue;
        if(node.left>=0){stack[size++]=node.left;stack[size++]=node.right;continue;}
        for(let i=node.begin;i<node.end;i++) {
          const k=order[i],e1x=tris[k+3],e1y=tris[k+4],e1z=tris[k+5];
          const e2x=tris[k+6],e2y=tris[k+7],e2z=tris[k+8];
          const hx=dy*e2z-dz*e2y,hy=dz*e2x-dx*e2z,hz=dx*e2y-dy*e2x;
          const det=e1x*hx+e1y*hy+e1z*hz;
          if(Math.abs(det)<1e-10)continue;
          const tx=ox-tris[k],ty=oy-tris[k+1],tz=oz-tris[k+2];
          const u=(tx*hx+ty*hy+tz*hz)/det;
          if(u<0||u>1)continue;
          const qx=ty*e1z-tz*e1y,qy=tz*e1x-tx*e1z,qz=tx*e1y-ty*e1x;
          const v=(dx*qx+dy*qy+dz*qz)/det;
          if(v<0 || u+v>1)continue;
          const t=(e2x*qx+e2y*qy+e2z*qz)/det;
          if(t>.00045 && t<best)best=t;
        }
      }
      return best;
    };
  }

  function shade(ray,p,n,reach) {
    const nx=n.x,ny=n.y,nz=n.z;
    let tx,ty,tz;
    if(Math.abs(ny)<.9){const l=Math.hypot(nx,nz);tx=nz/l;ty=0;tz=-nx/l;}
    else{const l=Math.hypot(ny,nz);tx=0;ty=-nz/l;tz=ny/l;}
    const bx=ny*tz-nz*ty,by=nz*tx-nx*tz,bz=nx*ty-ny*tx;
    const seed=Math.imul(Math.round(p.x*501),73856093)^Math.imul(Math.round(p.y*501),19349663)^Math.imul(Math.round(p.z*501),83492791);
    const angle=(seed>>>0)*Math.PI*2/4294967296,cs=Math.cos(angle),sn=Math.sin(angle);
    const ox=p.x+nx*.0017,oy=p.y+ny*.0017,oz=p.z+nz*.0017;
    let blocked=0;
    for(const [sx,sy,z] of directions) {
      const x=sx*cs-sy*sn,y=sx*sn+sy*cs;
      const hit=ray(ox,oy,oz,tx*x+bx*y+nx*z,ty*x+by*y+ny*z,tz*x+bz*y+nz*z,reach);
      const distance=1-hit/reach;blocked+=distance*distance;
    }
    return Math.round(255*Math.min(1,blocked/samples*1.12));
  }
  const stats=[];
  for(const space of spaces) {
    const query=visibilityQuery(space.casters),cache=new Map();
    let total=0,mean=0;
    for(const part of parts.filter(p=>p.space===space)){
      const geo=part.mesh.geometry,pos=geo.attributes.position,n=geo.attributes.normal;
      normMatrix.getNormalMatrix(part.matrix);
      part.bytes=new Uint8Array(pos.count);
      for(let i=0;i<pos.count;i++) {
        v.fromBufferAttribute(pos,i).applyMatrix4(part.matrix);
        normal.fromBufferAttribute(n,i).applyNormalMatrix(normMatrix).normalize();
        const key=[v.x,v.y,v.z].map(c=>Math.round(c*20000)).concat(
          [normal.x,normal.y,normal.z].map(c=>Math.round(c*2000))).join(',');
        let amount=cache.get(key);
        if(amount===undefined){
          amount=shade(query,v,normal,space.reach);cache.set(key,amount);
        }
        part.bytes[i]=amount;total++;mean+=amount;
      }
    }
    stats.push({assembly:space.name,vertices:total,samples:cache.size,meanOcclusion:(mean/total/255).toFixed(3)});
  }
  let offset=8+16*parts.length;
  const bytes=new Uint8Array(offset+parts.reduce((sum,p)=>sum+p.count,0)),header=new DataView(bytes.buffer);
  header.setUint32(0,TougeCarOcclusion.magic,true);header.setUint32(4,parts.length,true);
  parts.forEach((p,i)=>{
    const h=8+16*i;
    for(const [j,word] of [p.id,p.surroundings,offset,p.count].entries())header.setUint32(h+j*4,word,true);
    bytes.set(p.bytes,offset);offset+=p.count;
  });
  const blocks=[];
  for(let i=0;i<bytes.length;i+=12000)blocks.push(String.fromCharCode(...bytes.subarray(i,i+12000)));
  return {data:btoa(blocks.join('')),stats,parts:parts.length};
}

async function bake(){
  const url=process.argv[2]||'http://127.0.0.1:8477/';
  const output=process.argv[3]||path.join(__dirname,'../dist/assets/art/neo86-occlusion.webp');
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_BIN||undefined});
  try{
    const page=await browser.newPage();await page.goto(url);
    if(!await page.evaluate(()=>Boolean(window.TougeCarOcclusion))){
      await page.addScriptTag({path:path.join(__dirname,'../dist/js/neo-occlusion.js')});
    }
    const result=await page.evaluate(bakeInBrowser);
    const data=Buffer.from(result.data,'base64'),width=256,height=Math.ceil(data.length/(3*width));
    const pixels=Buffer.alloc(3*width*height);data.copy(pixels);
    const compressed=await sharp(pixels,{raw:{width,height,channels:3}}).webp({lossless:true,effort:6}).toBuffer();
    const temp=output+'.'+process.pid+'.tmp';
    await fs.writeFile(temp,compressed);await fs.rename(temp,output);
    console.log(JSON.stringify({parts:result.parts,verticesAndHeaders:data.length,bytes:compressed.length,stats:result.stats}));
  }finally{await browser.close();}
}
bake().catch(error=>{console.error(error);process.exitCode=1;});
