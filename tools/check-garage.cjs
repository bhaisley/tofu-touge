'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');

async function main(){
  const source=process.argv[2]||path.join(__dirname,'../Tofu Touge.html');
  const offline=!/^https?:/.test(source),url=offline?pathToFileURL(path.resolve(source)).href:source;
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined});
  try{
    const page=await browser.newPage({offline,viewport:{width:1050,height:680}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,400));});
    await page.addInitScript(()=>{
      for(const [name,key] of [['TougeWorld','garageWorld'],['TougeDrive','garageDrive'],['TougeAudio','garageAudio']]){
        let C;Object.defineProperty(window,name,{get:()=>C,set:Base=>{
          C=class extends Base{constructor(...args){super(...args);window[key]=this;}};
        }});
      }
      localStorage.setItem('tofu-touge-haruna-v1',JSON.stringify({time:137.21,score:365}));
    });
    const click=id=>page.locator(id).click();
    const state=s=>page.waitForFunction(v=>document.body.dataset.state===v,s,{timeout:90000});
    const ready=id=>page.waitForFunction(v=>garageWorld?.vehicleId===v && garageDrive.vehicleId===v &&
      garageAudio.vehicleId===v && document.body.dataset.car===v && !document.querySelector('#view-car').disabled,id,{timeout:90000});
    await page.goto(url,{waitUntil:'load'});
    assert.equal(await page.locator('body').getAttribute('data-car'),'neo86');
    assert.match(await page.locator('#menu-record').textContent(),/02:17\.21/);
    // The title prepares the selected car during idle time. Wait for that
    // state explicitly so the test does not depend on page download speed.
    await page.waitForFunction(()=>window.garageWorld?.preparedCourses?.size>0,null,{timeout:90000});
    assert.deepEqual(await page.evaluate(()=>[...garageWorld.vehicles.keys()]),['neo86']);
    await click('#next-car');assert(await page.locator('#menu-record').isHidden());
    await click('#view-car');await state('viewcar');await ready('ae86');
    const first=await page.evaluate(()=>{
      window.firstPass=garageWorld;window.firstTrueno=garageWorld.car;window.parkingSpot=garageDrive.contact.s;
      return [[...garageWorld.vehicles.keys()],garageWorld.car.axles.rear-garageWorld.car.axles.front,
        garageWorld.effects.exhaust.jets.length,garageWorld.car.driver.visible,garageWorld.car.group.name];
    });
    assert.deepEqual(first[0],['neo86','ae86']);assert(Math.abs(first[1]-2.4)<.002);
    assert.equal(first[2],1);assert.equal(first[3],false);assert.match(first[4],/Trueno/);
    const glass=await page.evaluate(()=>{
      const pane=name=>garageWorld.car.group.getObjectByName(name).material;
      return {front:pane('glass').opacity,side:pane('sideGlass').opacity,rear:pane('hatchGlass').opacity,
        reflective:pane('sideGlass').userData.routeReflections,heated:!!pane('hatchGlass').map};
    });
    assert(glass.front<.35 && glass.side>.55 && glass.rear>glass.side && glass.rear<1);
    assert(glass.reflective && glass.heated);
    await page.evaluate(()=>{
      for(const id of ['neo86','ae86','neo86'])document.querySelector('[data-vehicle="'+id+'"]').click();
    });
    await ready('neo86');
    await page.locator('[data-vehicle="neo86"]').press('ArrowRight');await ready('ae86');
    assert(await page.evaluate(()=>garageWorld===firstPass && garageWorld.car===firstTrueno &&
      garageWorld.car.group.parent===garageWorld.rig && garageWorld.rig.children.length===1 &&
      garageDrive.contact.s===parkingSpot));
    await click('#car-back');await click('#start-btn');await state('racing');
    await page.keyboard.down('KeyW');await page.waitForFunction(()=>garageDrive.kmh>18,null,{timeout:30000});
    await page.keyboard.up('KeyW');assert(await page.locator('#boost').isHidden());
    assert(await page.evaluate(()=>garageWorld.car.driver.visible && garageDrive.boost===0));
    await page.keyboard.press('Escape');await click('#restart');await state('countdown');await state('racing');await ready('ae86');
    await page.keyboard.press('Escape');await click('#to-menu');await state('menu');
    await click('button[data-map="fuji"]');await click('button[data-stage="fuji-uphill"]');
    await click('#start-btn');await state('racing');await ready('ae86');
    assert(await page.evaluate(()=>garageWorld!==firstPass && garageWorld.course.night &&
      garageWorld.vehicles.size===1 && garageWorld.headlamps.every(l=>l.intensity>0)));
    await page.evaluate(()=>new Promise(resolve=>{
      window.lostGarage=garageWorld;
      window.loss=garageWorld.renderer.getContext().getExtension('WEBGL_lose_context');
      document.querySelector('#world').addEventListener('webglcontextlost',()=>setTimeout(resolve,0),{once:true});
      loss.loseContext();
    }));
    await page.waitForFunction(()=>document.querySelector('#dialog-title')?.textContent==='Renderer unavailable');
    await page.evaluate(()=>loss.restoreContext());await page.waitForFunction(()=>document.querySelector('#veil').hidden);
    await click('#start-btn');await state('racing');await ready('ae86');
    assert(await page.evaluate(()=>garageWorld!==lostGarage && garageWorld.vehicles.size===1));
    await page.keyboard.press('Escape');await click('#to-menu');await page.reload();await state('menu');
    assert.equal(await page.locator('body').getAttribute('data-car'),'ae86');
    await click('#next-car');await click('button[data-map="haruna"]');await click('button[data-stage="downhill"]');
    assert.match(await page.locator('#menu-record').textContent(),/02:17\.21/);
    await click('#start-btn');await state('racing');await ready('neo86');assert(await page.locator('#boost').isVisible());
    assert.deepEqual(errors,[]);console.log('Both cars passed selection, garage switching, race/restart, persistence, independent records, WebGL recovery and day/night drive checks.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
