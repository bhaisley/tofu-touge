'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

// Render just the eastern skyline at the Hirano bend. Wires and tree branches
// legitimately cross the sky in the full scene. The wooded ridge crosses it once.
function checkHiranoSkyline(close=false){
  const w=window.testPass,T=window.THREE,width=768,height=280;
  const scene=new T.Scene(),sky=w.sky.clone(),camera=new T.PerspectiveCamera(close?4.5:29,width/height,.35,2350);
  camera.position.copy(w.course.physicalCourse.at(w.course.length-552,3.6,2));
  camera.lookAt(camera.position.clone().add(new T.Vector3(1,.14,close?-.2:0)));
  sky.position.copy(camera.position);scene.add(sky);
  // Use linear bytes on both renderers. WebGL 1 does not sRGB-encode an
  // offscreen target, which otherwise changes the predawn contrast test.
  const target=new T.WebGLRenderTarget(width,height,{colorSpace:T.LinearSRGBColorSpace,depthBuffer:false});
  const previous=w.renderer.getRenderTarget(),pixels=new Uint8Array(width*height*4);
  try{
    w.renderer.setRenderTarget(target);w.renderer.render(scene,camera);
    w.renderer.readRenderTargetPixels(target,0,0,width,height,pixels);
  }finally{w.renderer.setRenderTarget(previous);target.dispose();}
  const green=(x,y)=>pixels[4*(width*y+x)+1];
  const contour=new Float32Array(width).fill(NaN);
  let broken=0,checked=0,sharp=0;
  for(let x=2;x<width-2;x++){
    const foot=green(x,2),skyTop=green(x,height-3),contrast=skyTop-foot;
    if(contrast<20)continue;
    checked++;
    const mid=foot+.5*contrast;
    let inSky=false,previous=foot,strongest=0;
    for(let y=3;y<height-3;y++){
      const value=green(x,y);
      strongest=Math.max(strongest,value-previous);
      if(!Number.isFinite(contour[x]) && previous<mid && value>=mid)contour[x]=y-1+(mid-previous)/(value-previous);
      if(inSky && value<foot+.36*contrast){broken++;break;}
      if(value>foot+.65*contrast)inSky=true;
      previous=value;
    }
    if(strongest>.45*contrast)sharp++;
  }
  // A magnified texture-mask staircase departs sharply from the local slope.
  // A blurred mask can hide those steps, so also check the one-pixel contrast.
  let steps=0,spans=0;
  for(let x=6;x<width-6;x++){
    const chord=(contour[x-4]+contour[x+4])*.5;
    if(!Number.isFinite(chord) || !Number.isFinite(contour[x]))continue;
    spans++;if(Math.abs(contour[x]-chord)>1)steps++;
  }
  return {broken,checked,sharp,steps,spans};
}

function checkYamanaka(){
  const w=window.testPass,T=window.THREE,size=96;
  const scene=new T.Scene(),sky=w.sky.clone(),camera=new T.PerspectiveCamera(.55,1,.35,2350);
  const clock=sky.material.uniforms.lakeTime,previousTime=clock.value;
  camera.position.copy(sky.material.uniforms.skyOrigin.value);
  sky.position.copy(camera.position);scene.add(sky);
  const target=new T.WebGLRenderTarget(size,size,{colorSpace:T.LinearSRGBColorSpace,depthBuffer:false});
  const previous=w.renderer.getRenderTarget();
  function imageAt(time){
    clock.value=time;w.renderer.render(scene,camera);
    const pixels=new Uint8Array(size*size*4);
    w.renderer.readRenderTargetPixels(target,0,0,size,size,pixels);
    return pixels;
  }
  function patch(azimuth,elevation){
    const a=T.MathUtils.degToRad(azimuth),e=T.MathUtils.degToRad(elevation);
    camera.lookAt(camera.position.clone().add(new T.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),-Math.cos(a)*Math.cos(e))));
    const start=imageAt(12),later=imageAt(15.4);
    let motion=0,green=0;
    for(let i=1;i<start.length;i+=4){
      green+=start[i];motion+=Math.abs(later[i]-start[i]);
    }
    return {motion:motion/(size*size),green:green/(size*size)};
  }
  try{
    w.renderer.setRenderTarget(target);
    // Look across the open lake, into a cove that reflects a wooded ridge,
    // and at dry hillside on that same bearing above the far bank.
    return {open:patch(282,-3.2),cove:patch(315,-3.7),dry:patch(315,1)};
  }finally{clock.value=previousTime;w.renderer.setRenderTarget(previous);target.dispose();}
}

async function main(){
  const args=process.argv.slice(2),webgl1=args.includes('--webgl1');
  const input=args.find(arg=>arg!=='--webgl1') || path.join(__dirname,'../Tofu Touge.html');
  const offline=!/^https?:/.test(input);
  const url=offline?pathToFileURL(path.resolve(input)).href:input;
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined});
  try{
    const page=await browser.newPage({offline,viewport:{width:1040,height:650}});
    if(webgl1)await page.addInitScript(()=>{
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...options){
        return type==='webgl2'?null:getContext.call(this,type,...options);
      };
    });
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,400));});
    await page.addInitScript(()=>{
      let World,Drive;
      Object.defineProperty(window,'TougeWorld',{get:()=>World,set:Base=>{
        World=class extends Base{constructor(...args){super(...args);window.testPass=this;}};
      }});
      Object.defineProperty(window,'TougeDrive',{get:()=>Drive,set:Base=>{
        Drive=class extends Base{constructor(...args){super(...args);window.testDrive=this;}};
      }});
      localStorage.setItem('tofu-touge-haruna-v1',JSON.stringify({time:129,score:420}));
    });
    await page.goto(url);
    const click=selector=>page.locator(selector).click();
    const state=value=>page.waitForFunction(s=>document.body.dataset.state===s,value,{timeout:90000});
    const map=id=>click('button[data-map="'+id+'"]');
    const direction=id=>click('button[data-stage="'+id+'"]');
    await click('#view-car');await state('viewcar');
    await page.evaluate(()=>{window.originalContext=testPass.renderer.getContext();});
    await click('#car-back');
    assert.match(await page.locator('#menu-record').innerText(),/02:09.00/);
    await map('fuji');await click('#start-btn');await map('haruna');await map('fuji');
    assert(await page.locator('#menu-record').isHidden());
    const distance=await page.locator('#menu-distance').textContent();
    for(const [id,sign] of [['fuji-downhill',1],['fuji-uphill',-1]]){
      await direction(id);await click('#start-btn');await state('racing');
      await page.keyboard.down('KeyW');
      await page.waitForFunction(()=>testDrive.speed>4,null,{timeout:20000});
      await page.keyboard.up('KeyW');
      for(const mode of [0,1]){
        for(let i=0;i<3 && await page.evaluate(()=>testPass.cameraMode)!==mode;i++)await page.keyboard.press('KeyC');
        assert.equal(await page.evaluate(()=>testPass.cameraMode),mode);
      }
      await page.mouse.move(502,250);await page.mouse.down();
      await page.mouse.move(608,262,{steps:4});
      await page.waitForFunction(()=>Number.isFinite(testPass.orbitHeading));
      await page.mouse.up();
      await page.waitForFunction(()=>testPass.orbitHeading===null);
      const telemetry=await page.evaluate(()=>{
        const w=testPass,d=testDrive,gl=w.renderer.getContext();
        const previous=window.fujiContext;
        window.fujiContext=gl;
        return {map:w.course.mapId,direction:w.course.direction,match:w.course===d.course,
          sameContext:!previous || previous===gl,oldReleased:originalContext.isContextLost(),
          kmh:Math.round(d.kmh),error:gl.getError(),webgl2:w.renderer.capabilities.isWebGL2};
      });
      assert.equal(telemetry.map,'fuji');assert.equal(telemetry.direction,sign);
      assert(telemetry.match && telemetry.sameContext && telemetry.oldReleased && telemetry.kmh>5);
      assert.equal(telemetry.error,0);
      if(webgl1)assert.equal(telemetry.webgl2,false);
      await page.waitForFunction(()=>testPass.sky.material.uniforms.ready.value);
      const skyline=await page.evaluate(checkHiranoSkyline);
      assert(skyline.checked>700,id+' wooded skyline must be visible');
      assert.equal(skyline.broken,0,id+' has detached terrain in the Hirano sky');
      const detail=await page.evaluate(checkHiranoSkyline,true);
      assert(detail.checked>400 && detail.spans>400,id+' close-up must cross the Hirano ridge');
      assert(detail.sharp>.80*detail.checked,id+' lost detail at the edge of the ridge');
      assert(detail.steps<.04*detail.spans,id+' has stair steps along the Hirano ridge');
      const waterTime=await page.evaluate(()=>testPass.sky.material.uniforms.lakeTime.value);
      await page.waitForFunction(t=>testPass.sky.material.uniforms.lakeTime.value>t,waterTime);
      const lake=await page.evaluate(checkYamanaka);
      assert(lake.open.green>lake.cove.green+15,id+' must reflect bright sky and a darker opposite shore');
      assert(lake.open.motion>.2 && lake.cove.motion>.2,id+' must show wind moving across the lake');
      assert.equal(lake.dry.motion,0,id+' lake animation leaked onto the hillside');
      assert.match(await page.locator('#hud-course').textContent(),/MIKUNI/);
      assert((await page.locator('#remaining').textContent()).includes(sign===1?'TO DELIVERY':'TO SUMMIT'));
      await page.keyboard.press('Escape');await click('#to-menu');
      assert.equal(await page.locator('#menu-distance').textContent(),distance);
    }
    await page.reload();await state('menu');
    assert.equal(await page.locator('body').getAttribute('data-stage'),'fuji-uphill');
    await map('haruna');await direction('downhill');
    assert.match(await page.locator('#menu-record').innerText(),/02:09.00/);
    await click('#start-btn');await state('racing');
    const returned=await page.evaluate(()=>[testPass.course.mapId,testDrive.course===testPass.course]);
    assert.deepEqual(returned,['haruna',true]);assert.deepEqual(errors,[]);
    console.log('Both Mikuni starts, chase cameras and Hirano skylines passed. Reversing reused the world, changing mountains released its context, and the menu retained the selected stage and original Haruna record.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
