// Exercise overlapping entries and real WebGL recovery through the normal UI.
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

async function check(){
  const target=process.argv[2]||path.join(__dirname,'../Tofu Touge.html');
  const local=!/^https?:/.test(target);
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined});
  try{
    const page=await browser.newPage({offline:local,viewport:{width:960,height:600}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      const check=window.startupCheck={worlds:0,hold:true,fail:false};
      let World;
      Object.defineProperty(window,'TougeWorld',{get:()=>World,set:Base=>{
        World=class extends Base{
          constructor(...args){super(...args);check.world=this;check.worlds++;}
          static create(canvas,course,pause){
            if(check.fail)throw new Error('Injected startup failure');
            return super.create(canvas,course,async()=>{
              await pause();
              if(check.hold)await new Promise(resolve=>{check.release=resolve;});
            });
          }
        };
      }});
    });
    let releaseScripts;
    if(!local){
      const ready=new Promise(resolve=>{releaseScripts=resolve;});
      await page.route(url=>url.pathname.endsWith('/js/world.js'),async route=>{await ready;await route.continue();},{times:1});
    }
    await page.goto(local?pathToFileURL(path.resolve(target)).href:target,{waitUntil:local?'load':'commit'});
    const click=id=>page.locator(id).click();
    const state=s=>page.waitForFunction(s=>document.body.dataset.state===s,s,{timeout:90000});
    const heading=()=>page.locator('#dialog-title').textContent();
    if(releaseScripts){
      try{
        await page.locator('#tach i').first().waitFor({state:'attached'});
        assert.equal(await page.evaluate(()=>typeof window.TougeWorld),'undefined');
        await click('button[data-stage="uphill"]');await click('#controls-btn');
        assert.equal(await heading(),'Controls');await click('#controls-done');
        await click('button[data-stage="downhill"]');
      }finally{releaseScripts();}
    }
    await page.waitForFunction(()=>!!startupCheck.release);
    await click('#start-btn');await click('button[data-stage="uphill"]');
    assert(await page.locator('#start-btn').isEnabled());
    await click('#view-car');await click('#radio-btn');
    assert.equal(await heading(),'Pass radio');
    await page.keyboard.press('Escape');
    await click('#view-car');await click('#start-btn');await page.keyboard.press('Escape');
    assert(await page.locator('#start-btn').isEnabled());
    await click('#controls-btn');assert.equal(await heading(),'Controls');await click('#controls-done');
    await page.evaluate(()=>{startupCheck.hold=false;startupCheck.release();});
    await page.waitForFunction(()=>startupCheck.world.preparedCourses?.size>0);
    await state('menu');await click('#view-car');await state('viewcar');
    const inspected=await page.evaluate(()=>{
      const w=startupCheck.world,{parts}=TougeCarOcclusion.catalogue(w.car);
      return w.course.night && !w.car.driver.visible && parts.every(p=>p.mesh.geometry.hasAttribute('carAO'));
    });
    assert(inspected);
    await click('#car-back');await click('#start-btn');await state('countdown');
    const gridPrograms=await page.evaluate(()=>{
      const w=startupCheck.world;
      return w.effects.exhaust.lights.every(l=>l.visible && l.intensity===0)?w.renderer.info.programs.length:0;
    });
    assert(gridPrograms>0);
    await state('racing');
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    assert.equal(await page.evaluate(()=>startupCheck.world.renderer.info.programs.length),gridPrograms);
    await page.keyboard.press('p');await click('#to-menu');
    await click('button[data-stage="downhill"]');await click('#start-btn');
    await state('countdown');
    assert.deepEqual(await page.evaluate(()=>[startupCheck.worlds,startupCheck.world.course.night]),[1,false]);
    await page.keyboard.press('p');await click('#restart');await state('countdown');await state('racing');
    const lose=()=>page.evaluate(()=>new Promise(done=>{
      const check=startupCheck;
      check.context=check.world.renderer.getContext();
      check.extension=check.context.getExtension('WEBGL_lose_context');
      document.querySelector('#world').addEventListener('webglcontextlost',()=>setTimeout(done,0),{once:true});
      check.extension.loseContext();
    }));
    const restore=()=>page.evaluate(()=>new Promise(done=>{
      document.querySelector('#world').addEventListener('webglcontextrestored',()=>done(),{once:true});
      startupCheck.extension.restoreContext();
    }));
    const error=()=>page.waitForFunction(()=>document.querySelector('#dialog-title')?.textContent==='Renderer unavailable');
    await lose();await error();await restore();await page.waitForFunction(()=>document.querySelector('#veil').hidden);
    await click('#start-btn');await state('countdown');assert.equal(await page.evaluate(()=>startupCheck.worlds),2);
    await page.keyboard.press('p');await click('#to-menu');await click('#radio-btn');
    await lose();await page.waitForFunction(()=>startupCheck.context.isContextLost());
    await restore();await page.waitForFunction(()=>!startupCheck.context.isContextLost());
    assert.equal(await heading(),'Pass radio');await click('#radio-done');
    await click('button[data-map="fuji"]');await click('button[data-stage="fuji-uphill"]');await click('#start-btn');
    await state('countdown');await lose();
    assert.equal(await heading(),'Restoring graphics');
    await restore();await state('countdown');
    assert.equal(await page.locator('body').getAttribute('data-stage'),'fuji-uphill');
    // A second loss in the same start must return control to the driver.
    await lose();await error();await restore();await page.waitForFunction(()=>document.querySelector('#veil').hidden);
    await click('#start-btn');await state('countdown');await lose();await click('#cancel-restore');
    await restore();await state('menu');assert(await page.locator('#veil').isHidden());
    await click('button[data-map="haruna"]');
    await page.addInitScript(()=>{window.addEventListener('DOMContentLoaded',()=>{
      startupCheck.fail=true;startupCheck.hold=false;
    });});
    await page.reload();await click('#start-btn');await error();
    await page.evaluate(()=>{startupCheck.fail=false;});await click('#error-back');await click('#start-btn');
    await state('countdown');assert(await page.locator('#start-btn').isEnabled());
    assert.deepEqual(errors,[]);
    console.log('Cold entry cancellation, both routes, radio, walkaround, context restoration and failed-load retry passed.');
  }finally{await browser.close();}
}
check().catch(error=>{console.error(error);process.exitCode=1;});
