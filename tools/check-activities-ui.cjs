// Drive complete deliveries through the normal fixed-step loop. Only the
// controls and display clock are scripted; the game owns every result/save.
'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {followLine,hairpinInput}=require('./check-handling.cjs');
const {lessonInput}=require('./check-activities.cjs');

async function main(){
  const src=process.argv[2]||path.join(__dirname,'../Tofu Touge.html');
  const offline=!/^https?:/.test(src),url=offline?pathToFileURL(path.resolve(src)).href:src;
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined});
  try{
    const page=await browser.newPage({offline,viewport:{width:1120,height:700}});
    const errors=[],key='tofu-touge-haruna-v1-ae86';
    page.on('pageerror',e=>errors.push(e.message));
    if(offline)page.on('request',r=>{if(/^https?:/.test(r.url()))errors.push(r.url());});
    await page.addInitScript({content:
      'const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));\n'+
      [followLine,hairpinInput,lessonInput].map(fn=>fn.toString()).join('\n')+
      '\nconst hairpin={entry:543};window.lessonPilot=lessonInput;window.deliveryPilot=followLine;'});
    await page.addInitScript(()=>{
      const nativeRAF=requestAnimationFrame.bind(window);
      let clock=0,previous=0,nativeNow=-1;
      window.requestAnimationFrame=callback=>nativeRAF(now=>{
        if(now!==nativeNow){clock+=window.fastRun?220:previous?now-previous:16;previous=nativeNow=now;}
        callback(clock);
      });
      let Drive,World;
      Object.defineProperty(window,'TougeDrive',{get:()=>Drive,set:base=>{Drive=class extends base{
        constructor(...args){super(...args);window.testDrive=this;}
        step(dt,input){
          if(window.pilot==='lesson'){
            if(this.contact.s>=543 && this.turnTime==null)this.turnTime=this.time;
            input=lessonPilot(this,this.turnTime??null);
          }else if(window.pilot==='grip')input=deliveryPilot(this,24,4.6);
          super.step(dt,input);
        }
      };}});
      Object.defineProperty(window,'TougeWorld',{get:()=>World,set:base=>{World=class extends base{
        constructor(...args){super(...args);window.testWorld=this;}
      };}});
    });
    const click=id=>page.locator(id).click();
    const waitState=state=>page.waitForFunction(s=>document.body.dataset.state===s,state,{timeout:120000});
    const shot=async name=>{
      if(process.env.TOUGE_CAPTURE_DIR)await page.screenshot({path:path.join(process.env.TOUGE_CAPTURE_DIR,name+'.jpg'),type:'jpeg',quality:87});
    };
    await page.goto(url+'?stage=uphill&car=neo86',{waitUntil:'load'});
    await click('#activities-btn');await click('#choose-lesson');await click('#activity-go');await waitState('racing');
    assert.equal(await page.locator('body').getAttribute('data-car'),'ae86');
    assert.equal(await page.locator('body').getAttribute('data-stage'),'downhill');
    await shot('lesson');
    await page.keyboard.press('r');
    await page.waitForFunction(()=>testDrive.time<1 && testWorld.runVisuals.boards.visible);
    await page.evaluate(()=>{window.pilot='lesson';});
    if(process.env.TOUGE_CAPTURE_DIR){
      await page.waitForFunction(()=>testDrive.chain>25);await shot('haruna-driving-school');
    }
    await page.evaluate(()=>{window.fastRun=true;});
    await waitState('result');assert.match(await page.locator('#dialog-title').innerText(),/clean drift/i);
    assert.match(await page.locator('#dialog-content').innerText(),/ATTEMPT 2/);
    await shot('lesson-result');
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);
    await click('#done');assert.equal(await page.locator('body').getAttribute('data-stage'),'uphill');
    assert.equal(await page.locator('body').getAttribute('data-car'),'neo86');
    await click('[data-stage="downhill"]');await click('#next-car');
    await page.evaluate(()=>{window.fastRun=false;window.pilot='grip';});
    await click('#activities-btn');await click('#choose-cup');await click('#activity-go');await waitState('racing');
    assert(await page.locator('#cup-unit').isVisible());
    assert(await page.evaluate(()=>testWorld.runVisuals.cup.group.parent===testWorld.car.body));
    await shot('cup');
    await page.evaluate(()=>{window.fastRun=true;});await waitState('result');
    assert.match(await page.locator('#dialog-title').innerText(),/water delivered/i);
    assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),null);
    await click('#done');await page.evaluate(k=>localStorage.setItem(k,JSON.stringify({time:480,score:700})),key);
    await click('#start-btn');await waitState('result');
    const best=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
    assert(best.time<480 && best.score>=700 && best.splits.length===3 && best.ghost.length>300);
    assert.equal(await page.evaluate(k=>TougeEvents.GhostTape.valid(JSON.parse(localStorage.getItem(k)).ghost,testDrive.time),key),true);
    await click('#done');assert.match(await page.locator('#menu-record').innerText(),/BEST DRIFT/);
    await click('#activities-btn');await click('#ghost-setting');await page.keyboard.press('Escape');
    await page.evaluate(()=>{window.pilot='';window.fastRun=false;});
    await click('#start-btn');await waitState('racing');
    await page.waitForFunction(()=>{
      const g=testWorld.runVisuals.ghost;
      return g?.visible && Math.hypot(g.position.x-testDrive.x,g.position.z-testDrive.z)>12;
    });await shot('ghost');
    await page.keyboard.press('Escape');await click('#ghost-setting');assert.equal(await page.evaluate(()=>testWorld.runVisuals.ghost),null);
    await click('#resume');await page.evaluate(()=>{window.pilot='grip';window.fastRun=true;});
    await waitState('result');assert.equal(await page.locator('.result-sector b').count(),3);
    const unchanged=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).time,key);
    assert.equal(unchanged,best.time);
    assert.match(await page.locator('.result-sector').innerText(),/[+−±]/);await shot('sectors');
    await click('#done');await click('#next-car');assert(await page.locator('#menu-record').isHidden());
    assert.deepEqual(errors,[]);
    console.log('Clean rolling lesson and retry, restored selections, cup finish, legacy score, recorded ghost, visibility toggle and three sector differences passed.');
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
