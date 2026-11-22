// Check the mounted glass, cage clearance, rear livery, stop lamps and registration.
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

async function check(){
  const source=process.argv[2]||path.join(__dirname,'../Tofu Touge.html');
  const local=!/^https?:/.test(source);
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined});
  try{
    const page=await browser.newPage({offline:local,viewport:{width:1200,height:800}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.addInitScript(()=>{
      for(const name of ['TougeWorld','TougeDrive']){
        let implementation;
        Object.defineProperty(window,name,{get:()=>implementation,set:Base=>{
          implementation=class extends Base{constructor(...args){super(...args);window['test'+name]=this;}};
        }});
      }
    });
    await page.goto(local?pathToFileURL(path.resolve(source)).href:source);
    await page.evaluate(()=>{
      const model=window.TougeNeo86,build=model.buildFascias;
      model.buildFascias=function(api){
        window.testPlateUV=api.atlasUV('plate');
        return build.call(this,api);
      };
    });
    await page.locator('#view-car').click();
    await page.waitForFunction(()=>document.body.dataset.state==='viewcar');
    const report=await page.evaluate(()=>{
      const w=window.testTougeWorld,d=window.testTougeDrive;
      const glass=w.car.body.getObjectByName('hatchGlass').geometry;
      const {position,uv}=glass.attributes,rows=new Map(),edges=[[],[],[],[]];
      for(let i=0;i<position.count;i++){
        const u=uv.getX(i),v=uv.getY(i),offset=Math.abs(.5-u);
        if(!rows.has(v)||offset<rows.get(v).offset)rows.set(v,{v,offset,y:position.getY(i),z:position.getZ(i)});
        // Walk the single physical outline clockwise starting at the header.
        if(v===1)edges[0].push([u,i]);
        else if(u===1)edges[1].push([-v,i]);
        else if(v===0)edges[2].push([-u,i]);
        else if(u===0)edges[3].push([v,i]);
      }
      const points=[...rows.values()].sort((a,b)=>a.z-b.z);
      const rakes=points.slice(1).map((p,i)=>THREE.MathUtils.radToDeg(Math.atan2(points[i].y-p.y,p.z-points[i].z)));
      const header=points[0],sill=points.at(-1),dy=sill.y-header.y,dz=sill.z-header.z;
      const paneHeight=Math.hypot(dy,dz);
      glass.computeBoundingBox();
      const width=glass.boundingBox.max.x-glass.boundingBox.min.x;
      const outline=edges.flatMap(edge=>edge.sort((a,b)=>a[0]-b[0]).map(([,i])=>new THREE.Vector3().fromBufferAttribute(position,i)));
      function cut(poly,axis,station){
        const hits=[];
        for(let i=0;i<poly.length;i++){
          const a=poly[i],b=poly[(i+1)%poly.length],from=a[axis],to=b[axis];
          if(from!==to && station>=Math.min(from,to) && station<=Math.max(from,to))
            hits.push(THREE.MathUtils.lerp(a[1-axis],b[1-axis],(station-from)/(to-from)));
        }
        return [Math.min(...hits),Math.max(...hits)];
      }
      function bow(poly,span){
        const center=cut(poly,0,0)[1];
        return [-.4,.4].map(f=>(center-cut(poly,0,span*f)[1])/span);
      }
      const pane=outline.map(p=>[p.x,(p.y*dy+p.z*dz)/paneHeight]);
      const sillBow=bow(pane,width);
      // The eye and aim are in car coordinates. A square projection gives x/y
      // identical units for the direct-rear height, breadth and bow ratios.
      const rear=new THREE.PerspectiveCamera(15.2,1,.1,100);
      rear.position.set(0,1.29,7.20);rear.lookAt(0,.65,1.18);rear.updateMatrixWorld();
      const projected=p=>{const q=p.clone().project(rear);return [q.x,-q.y];};
      const mounted=outline.map(projected),xs=mounted.map(p=>p[0]),span=Math.max(...xs)-Math.min(...xs);
      const headerY=projected(new THREE.Vector3(0,header.y,header.z))[1];
      const sillY=projected(new THREE.Vector3(0,sill.y,sill.z))[1];
      const [left,right]=cut(mounted,1,THREE.MathUtils.lerp(headerY,sillY,.9));
      const mountedBreadth=(right-left)/span,mountedBow=bow(mounted,span);

      // Probe opposite faces at common points through the driver's head pad.
      // The cage tube must sit aft of the upholstery even where they overlap in a rear view.
      const localMesh=name=>{
        const mesh=w.car.body.getObjectByName(name);return new THREE.Mesh(mesh.geometry,mesh.material);
      };
      const cage=localMesh('satin'),upholstery=localMesh('interior'),ray=new THREE.Raycaster();
      let headrestGap=Infinity,pairedHits=0;
      ray.far=.47;
      for(let i=0;i<10;i++)for(let j=0;j<9;j++){
        const x=.24+i*.024,y=.958+j*.012;
        ray.ray.origin.set(x,y,.32);ray.ray.direction.set(0,0,1);
        const tube=ray.intersectObject(cage,false)[0];
        if(!tube)continue;
        ray.ray.origin.set(x,y,.78);ray.ray.direction.set(0,0,-1);
        const pad=ray.intersectObject(upholstery,false)[0];
        if(pad){headrestGap=Math.min(headrestGap,tube.point.z-pad.point.z);pairedHits++;}
      }
      const body=w.car.body,marks=body.getObjectByName('marks').geometry;
      // Trace the outside surface of both corners at the same heights as the
      // panels behind the wheels. The old pearl wedges interrupted the lower black.
      const skins=['paint','satin','flareGloss','moulding','trim'].map(localMesh);
      const bumperBands=[];
      ray.far=1.8;
      for(const side of [-1,1]){
        for(const [x,z,nx,nz] of [[.710,2.10,0,1],[.805,2.07,.7,.7],[.87,1.77,1,0],[.86,1.95,1,0]]){
          const out=new THREE.Vector3(nx*side,0,nz).normalize();
          const shades=[.24,.35,.414,.468,.514].map(y=>{
            ray.ray.origin.set(side*x,y,z).add(out);ray.ray.direction.copy(out).negate();
            const hit=ray.intersectObjects(skins,false)[0];
            if(!hit)throw new Error(`Missing rear skin at ${side*x}, ${y}, ${z}`);
            const albedo=new THREE.Color().fromBufferAttribute(hit.object.geometry.attributes.color,hit.face.a);
            return albedo.multiply(hit.object.material.color).getHex();
          });
          bumperBands.push({side,z,shades});
        }
      }
      const markUV=marks.attributes.uv,markPos=marks.attributes.position;
      const plateCorners=window.testPlateUV.map(([u,v])=>{
        for(let i=0;i<markUV.count;i++)if(Math.abs(markUV.getX(i)-u)<1e-6 && Math.abs(markUV.getY(i)-v)<1e-6)
          return new THREE.Vector3().fromBufferAttribute(markPos,i);
        throw new Error('Registration atlas corner missing from the marks mesh');
      });
      const [bl,br,tr,tl]=plateCorners;
      const platePoint=(u,v)=>bl.clone().lerp(br,u).lerp(tl.clone().lerp(tr,u),v);
      const plate={center:platePoint(.5,.5).toArray(),width:bl.distanceTo(br),height:tl.y-bl.y};
      function vertices(name){
        const attr=body.getObjectByName(name).geometry.attributes.position;
        return Array.from({length:attr.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(attr,i));
      }
      const outer=vertices('brake'),center=vertices('stopLamp');
      const lamps=[outer.filter(p=>p.x<0),center,outer.filter(p=>p.x>0)];
      const stopBounds=new THREE.Box3().setFromPoints(center);
      d.place(1048);
      const gl=w.renderer.getContext();
      function pixel(point){
        const p=body.localToWorld(point.clone()).project(w.camera);
        return [(p.x*.5+.5)*gl.drawingBufferWidth,(p.y*.5+.5)*gl.drawingBufferHeight];
      }
      function sample(point){
        const [x,y]=pixel(point).map(Math.round),pixels=new Uint8Array(5*3*4);
        gl.readPixels(x-2,y-1,5,3,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
        let green=0;for(let i=1;i<pixels.length;i+=4)green+=pixels[i];
        return green/15;
      }
      function registration(parked){
        d.brake=0;w.render(1/60,d,false,parked?{yaw:3.1,pitch:.18,zoom:1}:null);
        w.camera.position.copy(w.rig.localToWorld(new THREE.Vector3(.035,1.60,4.35)));
        w.camera.lookAt(w.rig.localToWorld(new THREE.Vector3(0,.76,1.35)));
        w.camera.fov=29;w.camera.updateProjectionMatrix();w.sky.position.copy(w.camera.position);
        w.renderer.render(w.scene,w.camera);
        // Both artworks leave a broad strip of background below the lettering.
        return {plate:[.2,.5,.8].map(u=>sample(platePoint(u,.12))),driver:w.car.driver.visible};
      }
      const show=registration(true),road=registration(false);
      const lampNames=['left','center','right'];
      function chaseLights(mode){
        w.cameraMode=mode;w.cameraReady=false;d.brake=0;w.render(1/60,d,false);
        const regions=lamps.map(points=>{
          const pixels=points.map(pixel),xs=pixels.map(p=>p[0]),ys=pixels.map(p=>p[1]);
          const x=Math.floor(Math.min(...xs))-1,y=Math.floor(Math.min(...ys))-1;
          return {x,y,width:Math.ceil(Math.max(...xs))-x+2,height:Math.ceil(Math.max(...ys))-y+2};
        });
        function capture({x,y,width,height}){
          const data=new Uint8Array(width*height*4);
          gl.readPixels(x,y,width,height,gl.RGBA,gl.UNSIGNED_BYTE,data);return data;
        }
        const coast=regions.map(capture);
        w.cameraReady=false;d.brake=1;w.render(1/60,d,false);
        return Object.fromEntries(regions.map((r,k)=>{
          const on=capture(r),columns=new Set();let bright=0;
          for(let i=0;i<on.length;i+=4){
            if(on[i]>on[i+1]+15 && on[i]-coast[k][i]>12){
              bright++;columns.add((i/4)%r.width);
            }
          }
          return [lampNames[k],{bright,litColumns:columns.size,width:r.width}];
        }));
      }
      return {minRake:Math.min(...rakes),maxRake:Math.max(...rakes),sillRake:rakes.at(-1),
        paneHeight,sillY:sill.y,width,sillBow,mountedBreadth,mountedBow,headrestGap,pairedHits,bumperBands,plate,
        stopMin:stopBounds.min.toArray(),stopMax:stopBounds.max.toArray(),show,road,
        chase:chaseLights(0),lowChase:chaseLights(1),error:gl.getError()};
    });
    console.log(JSON.stringify(report,null,2));
    assert(report.minRake>1 && report.maxRake<50 && report.sillRake>8,'backlight must descend into the deck without rolling over');
    assert(report.paneHeight>.58 && report.paneHeight<.66 && report.sillY>.95,'shortened backlight must meet the raised sill');
    assert(report.width>1.35 && report.sillBow.every(s=>s>.02 && s<.055),'the broad lower aperture must retain its physical bow');
    assert(report.mountedBreadth>.93 && report.mountedBow.every(s=>Math.abs(s)<.012),'the mounted rear sill must stay broad and nearly level');
    assert(report.pairedHits>=5 && report.headrestGap>.055,'the cage diagonal must clear the back of the driver headrest');
    for(const {side,z,shades} of report.bumperBands){
      const luma=shades.map(rgb=>.2126*(rgb>>16)+.7152*((rgb>>8)&255)+.0722*(rgb&255));
      assert(luma[0]<75 && luma[1]<75 && luma[2]>190 && luma[3]<75 && luma[4]>190,
        `the black valance, pearl accent and black belt must wrap the rear on side ${side} at z=${z}`);
    }
    const {center,width,height}=report.plate;
    assert(Math.abs(center[0])<.01 && center[1]>.36 && center[1]<.46 && center[2]>2 && center[2]<2.17
      && width>.33 && width<.36 && height>.15 && height<.19,'the registration must fit the lower bumper recess');
    assert(!report.show.driver && report.road.driver,'the driver must appear on the road and leave the display car');
    assert(report.road.plate.every((green,i)=>green>report.show.plate[i]+24),'each sampled plate background must switch from dark display to light Gunma registration');
    const [minX,minY,minZ]=report.stopMin,[maxX,maxY,maxZ]=report.stopMax;
    assert(Math.abs(minX+maxX)<.01 && maxX-minX>.28 && maxX-minX<.35 && minY>.83 && maxY-minY<.035
      && minZ>1.95 && maxZ<2.22,'one narrow center stop lens must sit under the ducktail');
    for(const camera of ['chase','lowChase'])for(const [name,light] of Object.entries(report[camera])){
      // Neighboring bodywork also picks up red spill. Require most of the
      // lens width and a filled area appropriate to the slim center strip.
      const minPixels=light.width*(name==='center'?.75:2.2);
      assert(light.bright>=minPixels && light.litColumns>=.75*light.width,
        `${name} stop lamp must brighten across its projected lens in ${camera}`);
    }
    assert.equal(report.error,0);assert.deepEqual(errors,[]);
  }finally{await browser.close();}
}
check().catch(error=>{console.error(error);process.exitCode=1;});
