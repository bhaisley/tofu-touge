// Requires Playwright. CHROME_BIN can select an installed Chromium browser.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');

async function check(){
  const file=process.argv[2]||path.join(__dirname,'..','Tofu Touge.html');
  const local=!/^https?:/.test(file);
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined});
  try{
    const page=await browser.newPage({offline:local,viewport:{width:960,height:640}});
    const errors=[],network=[];
    page.on('pageerror',e=>errors.push(e.message));
    if(local)await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
    await page.addInitScript(()=>{
      let wrapped;
      Object.defineProperty(window,'TougeAudio',{get:()=>wrapped,set:Base=>{
        wrapped=class extends Base{constructor(...args){super(...args);window.testAudio=this;}};
      }});
    });
    await page.goto(local?pathToFileURL(path.resolve(file)).href:file);
    const settle=index=>page.waitForFunction(i=>{
      const a=window.testAudio,r=a.radio;
      return a.context.state==='running' && r.voice?.index===i && r.queued?.index===r.nextIndex;
    },index,{timeout:30000});
    const row=i=>page.locator('#radio-list button').nth(i);
    await page.locator('#radio-btn').click();
    const buttons=page.locator('#radio-list button');
    const expected=['Night Delivery','Cedar Afterglow','Rain on the Engawa','Daybreak Signal','Kōri no Hibana'];
    assert.deepEqual(await buttons.locator('.track-title').allTextContents(),expected);
    const last=expected.length-1;
    const titles=[],fingerprints=new Set();
    for(const index of expected.keys()){
      await row(index).click();await settle(index);
      const sound=await page.evaluate(()=>{
        const r=testAudio.radio,v=r.voice,b=v.source.buffer,probe=testAudio.context.createAnalyser();
        probe.fftSize=2048;v.gain.connect(probe);
        return new Promise(resolve=>{
          const frame=new Float32Array(probe.fftSize);let peak=0;
          const timer=setInterval(()=>{
            probe.getFloatTimeDomainData(frame);
            for(const x of frame)peak=Math.max(peak,Math.abs(x));
          },25);
          setTimeout(()=>{
            clearInterval(timer);v.gain.disconnect(probe);
            const pcm=b.getChannelData(0);
            const fingerprint=Array.from({length:20},(_,i)=>Math.round(1000*pcm[Math.floor((i+.5)*pcm.length/20)])).join(',');
            resolve({title:r.track.title,duration:b.duration,channels:b.numberOfChannels,peak,fingerprint,cache:r.cache.size});
          },650);
        });
      });
      assert(sound.duration>18 && sound.channels===2 && sound.peak>.001 && sound.cache<=2,JSON.stringify(sound));
      assert.equal(await row(index).getAttribute('aria-pressed'),'true');
      titles.push(sound.title);fingerprints.add(sound.fingerprint);
    }
    assert.equal(fingerprints.size,expected.length);
    // Advance the paused playhead to the last beat. The real sources still
    // finish on the audio clock and the last record must crossfade into the first.
    await page.locator('#radio-power').click();
    await page.evaluate(()=>{const a=testAudio;a.radio.offset=a.buffers.get('music').duration-.75;});
    await page.locator('#radio-power').click();await settle(last);await settle(0);
    assert.equal(await row(0).getAttribute('aria-pressed'),'true');
    await row(2).click();await row(0).click();await row(1).click();await settle(1);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>testAudio.radio.voice),null);
    await page.locator('#start-btn').click();
    await page.waitForFunction(()=>document.body.dataset.state==='racing',null,{timeout:90000});await settle(1);
    await page.keyboard.press('n');await settle(2);
    await page.locator('#radio-btn').click();
    assert.equal(await page.locator('body').getAttribute('data-state'),'paused');
    await page.locator('#radio-done').click();
    assert.equal(await page.locator('body').getAttribute('data-state'),'racing');
    await page.keyboard.press('p');await page.locator('#radio-setting').click();
    await row(last).click();await settle(last);await page.locator('#radio-done').click();
    assert.equal(await page.locator('#resume').count(),1);
    assert.equal(await page.evaluate(()=>testAudio.radio.voice),null);
    await page.reload();await page.locator('#radio-btn').click();await settle(last);
    assert(!errors.length && !network.length,JSON.stringify({errors,network}));
    console.log('Audible stereo tracks: '+titles.join(', ')+'. Verified natural wrap, rapid skips, both pause paths and saved selection.');
  }finally{await browser.close();}
}
check().catch(error=>{console.error(error);process.exitCode=1;});
