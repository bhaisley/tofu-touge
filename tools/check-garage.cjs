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
    await page.keyboard.down('KeyS');
    await page.waitForFunction(()=>garageDrive.gear<0 &&
      garageWorld.car.group.getObjectByName('reverseLens').material.emissiveIntensity>1);
    await page.keyboard.up('KeyS');await page.keyboard.down('KeyW');
    await page.waitForFunction(()=>garageDrive.kmh>18 && garageDrive.gear>0 &&
      garageWorld.car.group.getObjectByName('reverseLens').material.emissiveIntensity===0,null,{timeout:30000});
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
    await click('#view-car');await state('viewcar');await click('[data-vehicle="neo86"]');await ready('neo86');
    await click('#car-back');await click('button[data-map="haruna"]');await click('button[data-stage="downhill"]');
    assert.match(await page.locator('#menu-record').textContent(),/02:17\.21/);
    await click('#start-btn');await state('racing');await ready('neo86');assert(await page.locator('#boost').isVisible());
    for(const [id,stage,nickname] of [['fd3s','downhill','FD3S'],['fc3s','uphill','FC3S'],['gc8','downhill','GC8'],['bnr32','uphill','BNR32']]){
      await page.keyboard.press('Escape');await click('#to-menu');await state('menu');
      await click('button[data-stage="'+stage+'"]');await click('#view-car');await state('viewcar');
      await click('[data-vehicle="'+id+'"]');await ready(id);
      assert.match(await page.locator('#garage-car').textContent(),new RegExp(nickname));
      assert.equal(await page.locator('[data-vehicle="'+id+'"]').getAttribute('aria-pressed'),'true');
      const parked=await page.evaluate(id=>{
        const car=garageWorld.car,s=TougeRivals.cars[id];
        const hubs=car.wheels.map(wheel=>wheel.hub.position);
        const front=hubs[0].z,rear=hubs[2].z;
        const position=car.body.getObjectByName('paint').geometry.getAttribute('position');
        let fenderHalfWidth=0,roofHeight=0;
        for(let i=0;i<position.count;i++){
          const z=position.getZ(i);
          if(Math.min(Math.abs(z-front),Math.abs(z-rear))<.25){
            fenderHalfWidth=Math.max(fenderHalfWidth,Math.abs(position.getX(i)));
          }
          roofHeight=Math.max(roofHeight,position.getY(i));
        }
        const bounds=new THREE.Box3();
        for(const part of car.body.children.filter(p=>p.isMesh)){
          part.geometry.computeBoundingBox();bounds.union(part.geometry.boundingBox);
        }
        return {
          wheelbase:[0,1].map(side=>Math.abs(hubs[side+2].z-hubs[side].z-s.wheelbase)),
          track:[0,1].map(axle=>Math.abs(hubs[axle*2+1].x-hubs[axle*2].x-s.track[axle])),
          length:Math.abs(bounds.max.z-bounds.min.z-s.length),
          width:Math.abs(2*fenderHalfWidth-s.width),height:Math.abs(roofHeight-s.height),
          interior:!car.driver.visible&&!!car.body.getObjectByName('hatchGlass').material.map
        };
      },id);
      assert(parked.interior,id+' has its garage interior and heated backlight');
      assert([...parked.track,...parked.wheelbase].every(error=>error<.001),id+' hub positions');
      assert(parked.length<.012&&parked.width<.009&&parked.height<.002,id+' installed body envelope '+JSON.stringify(parked));
      await click('#car-back');await click('#start-btn');await state('racing');await ready(id);
      await page.keyboard.down('KeyW');
      await page.waitForFunction(id=>{
        if(garageDrive.kmh<20)return false;
        return ['idle','low','drive','high','coast','intake'].every(layer=>{
          const buffer=garageAudio.buffers.get(id+'-'+layer);
          return buffer && garageAudio.loops.get('engine-'+layer)?.source.buffer===buffer;
        });
      },id,{timeout:45000});
      await page.keyboard.up('KeyW');
      assert(await page.evaluate(([id,night])=>garageWorld.car.driver.visible &&
        garageWorld.course.night===night && garageWorld.car.group.parent===garageWorld.rig &&
        (!['fd3s','fc3s'].includes(id)||garageWorld.car.body.getObjectByName('Raised headlamps').visible===night),[id,stage==='uphill']));
    }
    await page.keyboard.press('Escape');await click('#to-menu');await page.reload();await state('menu');
    assert.equal(await page.locator('body').getAttribute('data-car'),'bnr32');
    assert.deepEqual(errors,[]);console.log('Six selectable cars, race/restart, records, WebGL recovery, four rival engine banks and day/night running equipment passed.');
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
