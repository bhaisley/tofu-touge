'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

async function main(){
  const input=process.argv[2] || path.join(__dirname,'../Tofu Touge.html');
  const offline=!/^https?:/.test(input);
  const url=offline?pathToFileURL(path.resolve(input)).href:input;
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN || undefined});
  try{
    const page=await browser.newPage({offline,viewport:{width:1040,height:650}});
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
          kmh:Math.round(d.kmh),error:gl.getError()};
      });
      assert.equal(telemetry.map,'fuji');assert.equal(telemetry.direction,sign);
      assert(telemetry.match && telemetry.sameContext && telemetry.oldReleased && telemetry.kmh>5);
      assert.equal(telemetry.error,0);
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
    console.log('Both Mikuni starts and chase cameras passed. Reversing reused the world, changing mountains released its context, and the menu retained the selected stage and original Haruna record.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
