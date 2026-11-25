// Exercise the real touch entry, both stages and the two audio buses in Chromium.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

const target = process.argv[2] || path.join(__dirname, '..', 'Tofu Touge.html');
const local = !/^https?:/.test(target);
const layouts = [[320,568], [390,844], [568,320], [844,390]];
const overlap = (a,b) => a.x < b.x+b.width && b.x < a.x+a.width && a.y < b.y+b.height && b.y < a.y+a.height;

async function main() {
  const browser = await chromium.launch({executablePath:process.env.CHROME_BIN || undefined});
  try {
    const page = await browser.newPage({isMobile:true,hasTouch:true,deviceScaleFactor:1,offline:local,viewport:{width:390,height:844}});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    if (local) page.on('request', req => {if (/^https?:/.test(req.url())) errors.push(req.url());});
    await page.addInitScript(() => {
      if (!localStorage.getItem('tofu-touge-haruna-v1'))
        localStorage.setItem('tofu-touge-haruna-v1', JSON.stringify({time:128.25,score:400}));
      for (const [name,instance] of [['TougeAudio','testAudio'],['TougeDrive','testDrive']]) {
        let type;
        Object.defineProperty(window,name,{get:()=>type,set:Base=>{
          type=class extends Base {constructor(...args){super(...args);window[instance]=this;}};
        }});
      }
    });
    await page.goto(local ? pathToFileURL(path.resolve(target)).href : target);
    const stage = id => page.locator('.course-picker [data-stage="'+id+'"]');
    assert.match(await page.locator('#menu-record').innerText(), /02:08.25/);
    await stage('uphill').tap();
    assert(await page.locator('#menu-record').isHidden());
    assert.equal(await page.locator('#elevation-label').textContent(),'ELEVATION GAIN');
    await stage('downhill').tap();
    assert.match(await page.locator('#menu-record').innerText(), /02:08.25/);
    await stage('uphill').tap();
    await page.waitForFunction(()=>document.body.dataset.stage==='uphill');
    for (const [width,height] of layouts) {
      await page.setViewportSize({width,height});
      const menu=await page.locator('#start-btn').boundingBox();
      const picker=await stage('uphill').boundingBox();
      assert(menu.height>=44 && picker.height>=44 && menu.y+menu.height<=height);
      assert(!overlap(menu,await page.locator('.course-strip').boundingBox()),'Menu controls overlap the course strip at '+width+'×'+height);
      assert(!overlap(picker,await page.locator('.topbar').boundingBox()),'Course selector overlaps the header at '+width+'×'+height);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('#view-car').tap();
    await page.waitForFunction(()=>document.body.dataset.state==='viewcar',null,{timeout:90000});
    for(const [width,height] of layouts){
      await page.setViewportSize({width,height});
      const targets=await page.locator('.garage-picker button').evaluateAll(nodes=>nodes.map(el=>{
        const {x,y,width,height}=el.getBoundingClientRect();
        return {id:el.dataset.vehicle,x,y,width,height,hit:el===document.elementFromPoint(x+width/2,y+height/2)};
      }));
      assert.equal(targets.length,6);
      for(const [i,t] of targets.entries()){
        assert(t.hit&&t.width>=44&&t.height>=44&&t.x>=0&&t.y>=0&&t.x+t.width<=width+.1&&t.y+t.height<=height,
          t.id+' garage button at '+width+'×'+height);
        for(const other of targets.slice(i+1))assert(!overlap(t,other));
      }
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('[data-vehicle="bnr32"]').tap();await page.waitForFunction(()=>testDrive.vehicleId==='bnr32',null,{timeout:90000});
    await page.locator('[data-vehicle="neo86"]').tap();await page.waitForFunction(()=>testDrive.vehicleId==='neo86',null,{timeout:90000});
    await page.locator('#car-back').tap();
    await page.locator('#radio-btn').tap();
    const fx=page.locator('#sound-volume'), music=page.locator('#music-volume');
    await fx.focus();await fx.press('Home');
    await music.focus();await music.press('End');await music.press('ArrowLeft');
    assert.deepEqual(await page.evaluate(()=>[testAudio.soundVolume,testAudio.musicVolume]),[0,.99]);
    await page.locator('#radio-done').tap();
    await page.reload();
    assert.equal(await stage('uphill').getAttribute('aria-pressed'),'true');
    assert.deepEqual(await page.evaluate(()=>[testAudio.soundVolume,testAudio.musicVolume]),[0,.99]);
    await page.locator('#start-btn').tap();
    await page.waitForFunction(()=>document.body.dataset.state==='racing',null,{timeout:90000});
    assert.equal(await page.locator('#screen-label').textContent(),'UPHILL RUN');
    assert.match(await page.locator('#sector').textContent(),/VALLEY/);
    assert.match(await page.locator('#remaining').textContent(),/SUMMIT/);
    for (const [width,height] of layouts) {
      await page.setViewportSize({width,height});
      const targets = await page.locator('[data-drive]').evaluateAll(nodes=>nodes.map(el=>{
        const {x,y,width,height}=el.getBoundingClientRect();
        return {name:el.dataset.drive,x,y,width,height,hit:document.elementFromPoint(x+width/2,y+height/2)===el};
      }));
      assert.equal(targets.length,5);
      for (const [i,t] of targets.entries()) {
        assert(t.hit && t.width>=58 && t.height>=52 && t.x>=0 && t.y+t.height<=height,t.name+' at '+width+'×'+height);
        assert(t.x+t.width<=width);
        for (const other of targets.slice(i+1)) assert(!overlap(t,other));
      }
      for (const [a,b] of [['.timing','#map-unit'],['.cargo','.speed-unit'],['#map-unit','.steering'],['.speed-unit','.pedals']]) {
        assert(!overlap(await page.locator(a).boundingBox(),await page.locator(b).boundingBox()),a+' overlaps '+b+' at '+width+'×'+height);
      }
      const pauseButton=await page.locator('#pause-btn').boundingBox();
      assert(pauseButton.x+pauseButton.width<=width && pauseButton.width>=44);
    }
    const cdp=await page.context().newCDPSession(page);
    const points=[];
    for (const [i,action] of ['throttle','left','handbrake'].entries()) {
      const r=await page.locator('[data-drive="'+action+'"]').boundingBox();
      points.push({id:i+1,x:r.x+r.width/2,y:r.y+r.height/2});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
    }
    await page.waitForFunction(()=>testDrive.handbrake && testDrive.throttle>.9 && testDrive.wheel<-.6);
    assert.equal(await page.locator('[data-drive].held').count(),3);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForFunction(()=>!testDrive.handbrake && testDrive.throttle<.05);
    assert.equal(await page.locator('[data-drive].held').count(),0);
    await page.locator('#pause-btn').tap();
    assert.equal(await fx.inputValue(),'0');
    await fx.focus();await fx.press('End');await music.focus();await music.press('Home');
    assert.deepEqual(await page.evaluate(()=>[testAudio.soundVolume,testAudio.musicVolume]),[1,0]);
    await page.locator('#resume').tap();
    // An idle audio node may retain its last rendered value until its sources play.
    await page.waitForFunction(()=>testAudio.soundBus.gain.value>.98 && testAudio.musicBus.gain.value<.01);
    await page.locator('#pause-btn').tap();
    await page.locator('#to-menu').tap();await stage('downhill').tap();
    await page.locator('#start-btn').tap();
    await page.waitForFunction(()=>document.body.dataset.state==='racing',null,{timeout:90000});
    assert.equal(await page.locator('#screen-label').textContent(),'DOWNHILL RUN');
    assert.deepEqual(errors,[]);
    console.log('Both stages launched. Legacy records and independent volumes survived. All five controls fit four phone sizes and three simultaneous touches reached the drivetrain.');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
