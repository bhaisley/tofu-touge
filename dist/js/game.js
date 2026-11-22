(() => {
  'use strict';
  // A local file tab cannot fetch the editable edition's WAVs. The adjacent
  // offline edition carries the same audio bank inside the HTML.
  if(location.protocol==='file:' && !window.TougeEmbeddedAudio && /\/dist\/index\.html$/i.test(location.pathname)){
    const offline=new URL('../Tofu Touge.html',location.href);
    offline.search=location.search;
    offline.hash=location.hash;
    location.replace(offline.href);
    return;
  }
  const byId=id=>document.getElementById(id), setText=(id,text)=>{const el=byId(id);if(el.textContent!==text)el.textContent=text;};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const radio=new TougeRadio(), audio=new TougeAudio({radio});
  const keys=new Set(), fingers=new Map(), previousButtons=new Map();
  const actions=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','Space']);
  let world=null,state='menu',dialog='',resumeTo='racing',controlParent='menu',loading=false;
  const walkaround=new TougeCarWalkaround(byId('world'),()=>state==='viewcar');
  let count=3.1,accumulator=0,prevTime=0,lastHud=0,toastTime=0,controlTab='keyboard',focusReturn=null;
  const fixed=1/120, settingsKey='tofu-touge-settings-v1';
  function read(key){
    try {const data=JSON.parse(localStorage.getItem(key));return data && typeof data==='object' && !Array.isArray(data)?data:{};}
    catch {return {};}
  }
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private sessions can still play. */}}
  const settings=read(settingsKey), downhill=new TougeCourse();
  let course=settings.stage==='uphill'?downhill.reversed():downhill;
  const drive=new TougeDrive(course), renderPose=new TougeRenderPose(drive);
  const recordsKey=()=>course.night?'tofu-touge-haruna-night-v1':'tofu-touge-haruna-v1';
  let records=read(recordsKey());
  let sound=settings.sound!==false,music=settings.music!==false;
  const savedVolume=value=>Number.isFinite(value)?clamp(value,0,1):1;
  settings.soundVolume=savedVolume(settings.soundVolume);
  settings.musicVolume=savedVolume(settings.musicVolume);
  let observedAudioContext=null, handbrakeTap=false,radioParent='menu';
  radio.select(radio.tracks.findIndex(track=>track.id===settings.track));
  audio.setSoundVolume(settings.soundVolume);audio.setMusicVolume(settings.musicVolume);
  audio.setEnabled(sound);audio.setMusicEnabled(music);
  function timeStr(sec){
    const n=Math.max(0,Math.floor(sec*100+.00001));
    return String(Math.floor(n/6000)).padStart(2,'0')+':'+String(Math.floor(n/100)%60).padStart(2,'0')+'.'+String(n%100).padStart(2,'0');
  }
  const songTime=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
  const fmt=n=>Math.round(n).toLocaleString('en-US');
  const displayDistance=downhill.distance/1000;
  const stageButtons=document.querySelectorAll('.course-picker button');
  const startLabel=()=>course.night?'Start ascent':'Start descent';
  function showCourse(){
    const night=course.night,stage=night?'uphill':'downhill';
    document.body.dataset.stage=stage;
    for(const button of stageButtons)button.setAttribute('aria-pressed',String(button.dataset.stage===stage));
    byId('start-btn').children[1].textContent=startLabel();
    setText('stage-objective',night?'Climb the hairpins from the tofu shop.':'Drift the hairpins of Haruna Pass.');
    setText('stage-destination',night?'Bring the delivery to the summit.':'Bring the tofu down intact.');
    setText('course-name',night?'Haruna Reverse':'Haruna Pass');
    setText('course-light',night?'Night':'Dawn');
    setText('elevation-label',night?'ELEVATION GAIN':'ELEVATION DROP');
    setText('hud-course',night?'HARUNA REVERSE':'HARUNA PASS');
    byId('menu-distance').innerHTML=displayDistance.toFixed(2)+' <small>KM</small>';
    const elevation=Math.abs(course.sample(course.start).y-course.sample(course.finish).y);
    byId('menu-drop').innerHTML=Math.round(elevation)+' <small>M</small>';
    showRecord();paintMap(byId('menu-map'));
  }
  function selectStage(stage){
    const next=stage==='uphill'?downhill.reversed():downhill;
    if(loading || state!=='menu' || dialog || course===next)return;
    course=next;drive.course=course;drive.reset();renderPose.capture(drive);
    records=read(recordsKey());settings.stage=stage;write(settingsKey,settings);
    showCourse();
  }
  for(const button of stageButtons)button.addEventListener('click',()=>selectStage(button.dataset.stage));
  function showRecord(){const el=byId('menu-record');el.hidden=!Number.isFinite(records.time);if(!el.hidden)el.textContent='PERSONAL BEST  '+timeStr(records.time);}
  function paintMap(canvas,local=false) {
    const bounds=canvas.getBoundingClientRect();if(!bounds.width)return;
    const ratio=Math.min(devicePixelRatio||1,2.25),w=bounds.width,h=bounds.height;
    if(canvas.width!==Math.round(w*ratio)||canvas.height!==Math.round(h*ratio)){canvas.width=Math.round(w*ratio);canvas.height=Math.round(h*ratio);}
    const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,w,h);c.lineCap='round';c.lineJoin='round';
    if(!local) {
      const b=course.bounds,pad=4,scale=Math.min((w-2*pad)/(b.maxZ-b.minZ),(h-2*pad)/(b.maxX-b.minX));
      const map=p=>[(b.maxZ-p.z-(b.maxZ-b.minZ)/2)*scale+w/2,(p.x-b.minX-(b.maxX-b.minX)/2)*scale+h/2];
      c.strokeStyle='#e9e6d8';c.lineWidth=1.4;c.beginPath();
      for(let i=0;i<course.points.length;i+=4){const [x,y]=map(course.points[i]);if(i===0)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();
      for(const [s,col] of [[course.start,'#f2eee2'],[course.finish,'#ff6943']]){
        const [x,y]=map(course.sample(s));c.fillStyle=col;c.beginPath();c.arc(x,y,2.4,0,2*Math.PI);c.fill();
      }
      return;
    }
    const p=drive.contact,scale=Math.min(w/143,h/90),baseX=w*.5,baseY=h*.80;
    const plot=(x,z)=>[baseX+((x-drive.x)*p.rx+(z-drive.z)*p.rz)*scale,baseY-((x-drive.x)*p.fx+(z-drive.z)*p.fz)*scale];
    const path=(lo,hi,col,width)=>{c.strokeStyle=col;c.lineWidth=width;c.beginPath();
      for(let s=lo,i=0;s<=hi;s+=3,i++){const q=course.sample(s),v=plot(q.x,q.z);if(i===0)c.moveTo(...v);else c.lineTo(...v);}c.stroke();};
    const lo=Math.max(course.start,p.s-50),hi=Math.min(course.finish,p.s+260);
    path(lo,hi,'#0e171d',6);path(lo,hi,'#dfdfcf',3.0);
    const next=course.splits[Math.min(2,drive.sector)];
    if(next-p.s<160){const goal=course.sample(next),[x,y]=plot(goal.x,goal.z);c.fillStyle='#ffbd84';c.fillRect(x-3,y-3,6,6);}
    c.save();c.translate(baseX,baseY);c.rotate(drive.heading-p.heading);c.fillStyle='#ff6943';c.strokeStyle='#162128';c.lineWidth=2;
    c.beginPath();c.moveTo(0,-6);c.lineTo(4.6,4);c.lineTo(0,2.5);c.lineTo(-4.6,4);c.closePath();c.stroke();c.fill();c.restore();
  }
  showCourse();
  const tacho=byId('tach'),ticks=Array.from({length:26},(_,i)=>{const el=document.createElement('i');if(i>20)el.className='hot';tacho.append(el);return el;});
  function stateTo(next){
    state=next;document.body.dataset.state=next;byId('hud').hidden=next==='menu'||next==='viewcar';
    byId('walkaround').hidden=next!=='viewcar';
    const labels={menu:'MAIN MENU',viewcar:'WALKAROUND',racing:course.night?'UPHILL RUN':'DOWNHILL RUN',countdown:'START GRID',paused:'PAUSED',result:'RUN RESULT'};
    setText('screen-label',labels[next]);
    refreshSound();
  }
  function clearInput(){
    keys.clear();fingers.clear();handbrakeTap=false;
    document.querySelectorAll('[data-drive].held').forEach(el=>el.classList.remove('held'));
  }
  function audioNeedsGesture() {
    return sound && (state==='racing' || state==='countdown' || dialog==='radio') &&
      audio.context && audio.context.state!=='running';
  }
  function unlockAudio() {
    const request=audio.unlock();
    if (audio.context && audio.context!==observedAudioContext) {
      observedAudioContext=audio.context;
      observedAudioContext.addEventListener('statechange',refreshSound);
    }
    refreshSound();
    return request;
  }
  function toggleSound(){
    if (audioNeedsGesture()) { unlockAudio(); return; }
    sound=!sound;unlockAudio();audio.setEnabled(sound);
    settings.sound=sound;write(settingsKey,settings);refreshSound();
  }
  function refreshSound(){
    const resume=audioNeedsGesture(), btn=byId('sound-btn');
    btn.setAttribute('aria-pressed',String(sound && !resume));
    btn.setAttribute('aria-label',resume?'Resume driving audio':sound?'Mute sound':'Enable sound');
    setText('sound-label',resume?'ENABLE SOUND':sound?'SOUND ON':'SOUND OFF');
    if(dialog==='radio')refreshRadio();
  }
  refreshSound();byId('sound-btn').addEventListener('click',toggleSound);
  const fullBtn=byId('full-btn');
  const fullscreen=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
  async function toggleFull(){
    try{
      if(fullscreen()){const exit=document.exitFullscreen||document.webkitExitFullscreen;await exit.call(document);}
      else{const root=document.documentElement,enter=root.requestFullscreen||root.webkitRequestFullscreen;await enter.call(root);}
    }catch{fullBtn.hidden=true;}
  }
  if(!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen))fullBtn.hidden=true;
  fullBtn.addEventListener('click',toggleFull);
  function fullChanged(){fullBtn.setAttribute('aria-label',fullscreen()?'Exit fullscreen':'Enter fullscreen');}
  document.addEventListener('fullscreenchange',fullChanged);document.addEventListener('webkitfullscreenchange',fullChanged);
  function openDialog(kind,markup,allowClose=true){
    if(!dialog)focusReturn=document.activeElement;
    dialog=kind;byId('dialog-content').innerHTML=markup;byId('dialog-close').hidden=!allowClose;
    byId('veil').hidden=false;document.body.classList.add('modal-open');
    byId('menu').inert=true;document.querySelector('.topbar').inert=true;byId('hud').inert=true;
    byId('walkaround').inert=true;
    byId('dialog').scrollTop=0;byId('dialog').focus({preventScroll:true});
  }
  function closeDialog(returnFocus=true){
    if(dialog==='radio')audio.setMusicPreview(false);
    dialog='';byId('veil').hidden=true;document.body.classList.remove('modal-open');
    byId('menu').inert=false;document.querySelector('.topbar').inert=false;byId('hud').inert=false;
    byId('walkaround').inert=false;
    if(returnFocus&&focusReturn?.isConnected)focusReturn.focus({preventScroll:true});
    focusReturn=null;
  }
  const bind=(id,fn)=>byId(id).addEventListener('click',fn);
  function menu(){
    clearInput();audio.setActive(false);closeDialog(false);stateTo('menu');accumulator=0;
    byId('countdown').hidden=true;byId('chain').hidden=true;byId('toast').hidden=true;showRecord();paintMap(byId('menu-map'));
    byId('start-btn').focus({preventScroll:true});
  }
  function toast(msg,seconds=1.45){setText('toast',msg);byId('toast').hidden=false;toastTime=seconds;}
  function showError(){
    audio.setActive(false);stateTo('menu');openDialog('error','<p class="dialog-kicker">GRAPHICS</p><h2 id="dialog-title">Renderer unavailable</h2><p class="dialog-tip">This pass needs WebGL and hardware acceleration. Enable graphics acceleration in your browser or open the game in a WebGL-capable browser.</p><div class="dialog-buttons"><button id="error-back" class="primary">Main menu</button></div>');
    bind('error-back',menu);
  }
  async function loadPass(){
    const manager=THREE.DefaultLoadingManager,previous=manager.onLoad;
    let finish;
    const ready=new Promise(resolve=>{finish=resolve;});
    const complete=()=>{finish();previous?.call(manager);};
    manager.onLoad=complete;
    try{
      const pass=new TougeWorld(byId('world'),course);
      // Keep the cover on screen until the sky, pavement and foliage have
      // decoded. The countdown's first frame then uses the finished materials.
      await ready;
      return pass;
    }finally{
      if(manager.onLoad===complete)manager.onLoad=previous;
    }
  }
  function leaveCar(){menu();byId('view-car').focus({preventScroll:true});}
  bind('view-car',()=>enterPass(true));bind('car-back',leaveCar);
  bind('orbit-left',()=>walkaround.move(-Math.PI/6,0));bind('orbit-right',()=>walkaround.move(Math.PI/6,0));
  function begin(){return enterPass(false);}
  async function enterPass(inspect){
    if(loading)return;loading=true;clearInput();if(!inspect)unlockAudio();
    closeDialog(false);byId('start-btn').disabled=true;byId('view-car').disabled=true;
    for(const button of stageButtons)button.disabled=true;
    const label=byId('start-btn').children[1];label.textContent=inspect?'Loading car':'Loading pass';
    try{
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      if(!world)world=await loadPass();else world.setCourse(course);
      world.reset();drive.reset();accumulator=0;prevTime=0;
      if(inspect){
        // Park by the shrine in daylight and by the shop on the night grid.
        drive.place(course.night?course.start:course.splits[0]-19);
        const p=drive.contact;p.offset=.55;drive.x=p.x+p.rx*p.offset;drive.z=p.z+p.rz*p.offset;
        drive.steerAngle=.048;walkaround.reset();stateTo('viewcar');
        walkaround.render(world,drive,1/60);byId('car-back').focus({preventScroll:true});return;
      }
      renderPose.capture(drive);count=3.1;lastHud=0;toastTime=0;
      byId('toast').hidden=true;byId('chain').hidden=true;byId('countdown').hidden=false;setText('count-number','3');setText('count-label','START GRID');
      stateTo('countdown');audio.update(driveTelemetry());audio.setActive(true);hud();world.render(1/60,drive,false);
    }catch(error){console.error('Unable to start Tofu Touge',error);showError();}
    finally{
      loading=false;byId('start-btn').disabled=false;byId('view-car').disabled=false;label.textContent=startLabel();
      for(const button of stageButtons)button.disabled=false;
    }
  }
  function resume(){
    if(state!=='paused')return;closeDialog(false);clearInput();unlockAudio();stateTo(resumeTo);audio.setActive(true);prevTime=0;
  }
  function camera(){
    if(!world)return;const name=world.cycleCamera();toast(name+' camera');
    if(dialog==='pause')setText('camera-setting',name);
  }
  function recover(){
    if(resumeTo==='countdown'&&state==='paused'){resume();return;}
    drive.recover();renderPose.capture(drive);accumulator=0;world.cameraReady=false;if(state==='paused')resume();
  }
  function setMusic(on){
    music=on;audio.setMusicEnabled(on);settings.music=on;write(settingsKey,settings);
    if(dialog==='pause'){
      byId('music-setting').setAttribute('aria-pressed',String(on));setText('music-setting',on?'ON':'OFF');
    }
    if(dialog==='radio')refreshRadio();
  }
  const volumeFields=[
    {id:'sound-volume',key:'soundVolume',label:'Sound effects'},
    {id:'music-volume',key:'musicVolume',label:'Music'}
  ];
  function volumeControls(){
    return '<div class="volume-mixer" role="group" aria-label="Volume">'+volumeFields.map(({id,key,label})=>{
      const percent=Math.round(settings[key]*100);
      return '<div class="volume-row"><label for="'+id+'">'+label+'</label>'+
        '<input id="'+id+'" type="range" min="0" max="100" value="'+percent+'" aria-valuetext="'+percent+' percent">'+
        '<output for="'+id+'" id="'+id+'-value">'+percent+'%</output></div>';
    }).join('')+'</div>';
  }
  function bindVolumes(){
    for(const {id,key} of volumeFields){
      const input=byId(id);
      input.addEventListener('input',()=>{
        const percent=input.valueAsNumber;
        if(!Number.isFinite(percent))return;
        settings[key]=clamp(percent/100,0,1);
        if(key==='soundVolume')audio.setSoundVolume(settings[key]);
        else audio.setMusicVolume(settings[key]);
        input.setAttribute('aria-valuetext',percent+' percent');
        byId(id+'-value').value=percent+'%';
        write(settingsKey,settings);
      });
    }
  }
  function refreshRadio(){
    const listening=!!audio.context && sound && music && !audioNeedsGesture();
    for(const row of byId('radio-list').children){
      const selected=Number(row.dataset.track)===radio.index;
      row.setAttribute('aria-pressed',String(selected));
      row.classList.toggle('playing',selected && listening && !!radio.voice);
    }
    setText('radio-status',!audio.context?'Audio unavailable':!sound?'Sound is muted':!music?'Music is off':radio.error?'Track unavailable':
      audioNeedsGesture()?'Audio paused':radio.voice?'On air':'Tuning in…');
    const power=byId('radio-power');
    power.setAttribute('aria-pressed',String(listening));
    setText('radio-power',!audio.context||!sound||audioNeedsGesture()?'Enable sound':music?'Mute music':'Enable music');
  }
  function openRadio(){
    if(loading)return;
    const driving=state==='racing'||state==='countdown';
    radioParent=driving?'drive':dialog==='pause'?'pause':state;
    unlockAudio();audio.setMusicPreview(true);
    if(driving){
      resumeTo=state;stateTo('paused');clearInput();audio.setActive(false);
    }
    const rows=radio.tracks.map((track,i)=>'<button class="radio-track" data-track="'+i+
      '" aria-pressed="false"><span class="track-indicator" aria-hidden="true"></span><span class="track-title">'+
      track.title+'</span><span class="track-genre">'+track.genre+'</span></button>').join('');
    openDialog('radio','<p class="dialog-kicker">HARUNA PASS</p><h2 id="dialog-title">Pass radio</h2>'+
      volumeControls()+'<div id="radio-list" role="group" aria-label="Soundtrack">'+rows+'</div>'+
      '<div class="radio-footer"><span id="radio-status" role="status"></span><span id="radio-time" role="timer" aria-label="Track time"></span><button id="radio-power" class="text-link"></button></div>'+
      '<div class="dialog-buttons"><button id="radio-done" class="primary">'+(driving?'Resume run':'Back')+'</button></div>');
    for(const row of byId('radio-list').children)row.addEventListener('click',()=>{
      unlockAudio();radio.select(Number(row.dataset.track));refreshRadio();
    });
    bind('radio-power',()=>{
      if(!sound){toggleSound();setMusic(true);}
      else if(!audio.context||audioNeedsGesture())unlockAudio();
      else {unlockAudio();setMusic(!music);}
    });
    bindVolumes();bind('radio-done',dismiss);refreshRadio();
  }
  radio.onChange=reason=>{
    if(reason==='select'||reason==='advance'){
      settings.track=radio.track.id;write(settingsKey,settings);
      if(state==='racing'&&!dialog)toast('♫  '+radio.track.title,2);
    }
    if(dialog==='radio')refreshRadio();
  };
  bind('radio-btn',openRadio);
  function pauseMenu(){
    const cam=['Chase','Low chase','Bonnet'][world.cameraMode];
    openDialog('pause','<p class="dialog-kicker">HARUNA PASS</p><h2 id="dialog-title">Run paused</h2>'+
      '<div class="settings-row"><span>Camera</span><button class="toggle-setting" id="camera-setting">'+cam+'</button></div>'+
      '<div class="settings-row"><button id="radio-setting" class="radio-setting" aria-haspopup="dialog"><span>Pass radio</span><strong>'+radio.track.title+' ›</strong></button><button id="music-setting" class="toggle-setting" aria-label="Music" aria-pressed="'+music+'">'+(music?'ON':'OFF')+'</button></div>'+volumeControls()+
      '<div class="dialog-buttons"><button id="resume" class="primary">Resume run</button><button id="restart" class="secondary">Restart</button></div>'+
      '<div class="pause-links"><button id="pause-controls" class="text-link">Controls</button><button id="recover" class="text-link">Recover (+3 s)</button><button id="to-menu" class="text-link">Main menu</button></div>');
    bind('resume',resume);bind('restart',begin);bind('pause-controls',()=>controls('pause'));bind('recover',recover);bind('to-menu',menu);bind('camera-setting',camera);
    bindVolumes();bind('radio-setting',openRadio);bind('music-setting',()=>setMusic(!music));
  }
  function pause(){
    if(state!=='racing' && state!=='countdown')return;
    resumeTo=state;stateTo('paused');clearInput();audio.setActive(false);pauseMenu();
  }
  const controlsData={
    keyboard:[
      ['Accelerate',['W','↑']],['Brake / reverse',['S','↓']],['Steer',['A / D','← / →']],['Handbrake',['Space']],
      ['Change camera',['C']],['Next radio track',['N']],['Recover car (+3 s)',['R']],['Pause',['Esc','P']]
    ],
    gamepad:[
      ['Accelerate',['RT / R2']],['Brake / reverse',['LT / L2']],['Steer',['Left stick']],['Handbrake',['A / Cross']],
      ['Change camera',['Y / Triangle']],['Next radio track',['D-pad →']],['Recover car (+3 s)',['B / Circle']],['Pause',['Start / Options']]
    ],
    touch:[
      ['Accelerate',['Gas']],['Brake / reverse',['Brake']],['Steer',['◀','▶']],['Handbrake',['Drift']],
      ['Change camera',['Pause → Camera']],['Choose radio track',['Radio']],['Recover car (+3 s)',['Pause → Recover']],['Pause',['Ⅱ']]
    ]
  };
  function controls(parent,tab){
    controlParent=parent;controlTab=tab||(matchMedia('(pointer:coarse)').matches?'touch':'keyboard');
    const tabs=[['keyboard','Keyboard'],['gamepad','Controller'],['touch','Touch']];
    const rows=controlsData[controlTab].map(([name,values])=>'<div><dt>'+name+'</dt><dd>'+values.map(v=>'<kbd>'+v+'</kbd>').join('<span class="or-key"> / </span>')+'</dd></div>').join('');
    openDialog('controls','<p class="dialog-kicker">DRIVER’S GUIDE</p><h2 id="dialog-title">Controls</h2><div class="controls-tabs" aria-label="Input device">'+tabs.map(([id,label])=>'<button id="tab-'+id+'" class="'+(controlTab===id?'selected':'')+'" aria-pressed="'+(controlTab===id)+'">'+label+'</button>').join('')+'</div><dl class="binding-list">'+rows+'</dl><p class="dialog-tip"><span class="tip-label">HAIRPIN TECHNIQUE</span>Brake before the hairpin, turn in and give the handbrake a short pull. Release it, keep some throttle and tap opposite steer to balance the slide. Ease off and straighten up to bank your points.</p><div class="dialog-buttons"><button id="controls-done" class="primary">Back</button></div>');
    for(const [id] of tabs)bind('tab-'+id,()=>{controls(parent,id);byId('tab-'+id).focus();});
    bind('controls-done',dismiss);
  }
  function dismiss(){
    if(dialog==='radio'){
      if(radioParent==='drive'){audio.setActive(true);resume();}
      else if(radioParent==='pause'){audio.setMusicPreview(false);pauseMenu();byId('radio-setting').focus();}
      else closeDialog(true);
    }
    else if(dialog==='controls'&&controlParent==='pause')pauseMenu();
    else if(dialog==='pause')resume();
    else if(dialog==='result'||dialog==='error')menu();
    else closeDialog(true);
  }
  bind('start-btn',begin);bind('controls-btn',()=>controls('menu'));bind('pause-btn',pause);bind('dialog-close',dismiss);
  function results(success){
    audio.setActive(false);if(success)audio.event('finish');
    stateTo('result');clearInput();byId('countdown').hidden=true;byId('chain').hidden=true;byId('toast').hidden=true;
    const pb=success&&(!Number.isFinite(records.time)||drive.time<records.time);
    if(success){if(pb)records.time=drive.time;records.score=Math.max(Number(records.score)||0,drive.score);write(recordsKey(),records);}
    const splits=drive.splitTimes.map((t,i)=>'<span>S'+(i+1)+' '+timeStr(t-(drive.splitTimes[i-1]||0))+'</span>').join('');
    const resultCourse=course.night?'HARUNA REVERSE':'HARUNA PASS';
    const resultTitle=success?(course.night?'Summit delivery complete':'Tofu delivered'):'Cargo lost';
    openDialog('result','<p class="dialog-kicker">'+resultCourse+' / '+(success?(pb?'PERSONAL BEST':'FINISH'):'DELIVERY FAILED')+'</p><h2 id="dialog-title">'+resultTitle+'</h2><p class="result-time">'+timeStr(drive.time)+'</p><dl class="result-list"><div><dt>Drift score</dt><dd>'+fmt(drive.score)+' pts</dd></div><div><dt>Tofu condition</dt><dd>'+drive.integrity+'%</dd></div><div><dt>'+(success?'Best time':'Distance covered')+'</dt><dd>'+(success?timeStr(records.time):(drive.progress*displayDistance).toFixed(2)+' km')+'</dd></div></dl><div class="result-sector">'+splits+'</div><div class="dialog-buttons"><button class="primary" id="again">Run again</button><button class="secondary" id="done">Main menu</button></div>',false);
    bind('again',begin);bind('done',menu);
  }
  function handleEvents(){
    for(const event of drive.events.splice(0)){
      switch(event.type){
        case 'bank':if(event.points>=5)toast('Drift banked  +'+fmt(event.points));break;
        case 'impact':audio.event('impact');world.shake=.78;toast('Barrier contact  −'+event.damage+'% tofu');break;
        case 'recover':toast('Car recovered  +3.00 s');break;
        case 'checkpoint':audio.event('checkpoint');toast('Sector '+event.sector+'  ·  '+timeStr(drive.time),2.2);break;
        case 'shift':audio.event('shift');break;
        case 'blowoff':audio.event('blowoff',event.strength);break;
        case 'afterfire':audio.event('afterfire',event.strength);world.exhaustPop(event.strength);break;
        case 'finish':hud();results(true);break;
        case 'failed':hud();results(false);break;
      }
    }
  }
  const down=(...codes)=>codes.some(x=>keys.has(x));
  function drivingInput(pad){
    const touch=new Set(fingers.values());
    const x=pad?.axes[0]||0,stick=Math.abs(x)>.1?Math.sign(x)*(Math.abs(x)-.1)/.9:0;
    const pressed=(i)=>pad?.buttons[i]?.value||0;
    return {
      steer:clamp(stick+Number(down('KeyD','ArrowRight')||touch.has('right'))-Number(down('KeyA','ArrowLeft')||touch.has('left')),-1,1),
      throttle:Math.max(pressed(7),Number(down('KeyW','ArrowUp')||touch.has('throttle'))),
      brake:Math.max(pressed(6),Number(down('KeyS','ArrowDown')||touch.has('brake'))),
      handbrake:pressed(0)>.4||down('Space')||touch.has('handbrake')
    };
  }
  function gamepad(){
    let pad;try{pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');}catch{return;}
    if(!pad){previousButtons.clear();return;}
    for(const i of [0,1,3,9,14,15]){
      const held=!!pad.buttons[i]?.pressed,edge=held&&!previousButtons.get(i);previousButtons.set(i,held);
      if(!edge)continue;
      if(dialog==='radio'){if(i===1||i===9)dismiss();else if(i===15)radio.select(radio.nextIndex);continue;}
      if(state==='menu'&&!dialog&&(i===14||i===15)){selectStage(i===14?'downhill':'uphill');continue;}
      if(state==='viewcar'){if(i===1 || i===9)leaveCar();continue;}
      if(i===0 && state==='racing' && !dialog) handbrakeTap=true;
      if(dialog==='result'&&i===0){begin();continue;}
      if((i===9 || (i===0&&state==='menu')) && !loading){
        if(dialog==='pause')resume();else if(!dialog&&state==='menu')begin();else if(!dialog)pause();
      }else if(state==='racing'&&!dialog){if(i===1)recover();if(i===3)camera();if(i===15)radio.select(radio.nextIndex);}
    }
    return pad;
  }
  document.addEventListener('keydown',event=>{
    if(event.altKey||event.metaKey||event.ctrlKey)return;
    const code=event.code;
    if(dialog){
      if(code==='Escape'){event.preventDefault();if(!event.repeat)dismiss();return;}
      if(code==='KeyP' && dialog==='pause'&&!event.repeat){event.preventDefault();resume();return;}
      if(code==='Tab'){
        const focusable=Array.from(byId('dialog').querySelectorAll('button:not([hidden]):not(:disabled), input:not(:disabled)'));
        if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&(document.activeElement===first||document.activeElement===byId('dialog'))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
      return;
    }
    if(code==='KeyM' && !event.repeat){toggleSound();return;}
    if(state==='viewcar'){
      if(code==='Escape'){event.preventDefault();leaveCar();}
      else if(walkaround.key(code))event.preventDefault();
      return;
    }
    if(state==='menu'){
      if(event.target.closest?.('.course-picker')&&(code==='ArrowLeft'||code==='ArrowRight')){
        event.preventDefault();const index=code==='ArrowLeft'?0:1;
        selectStage(stageButtons[index].dataset.stage);stageButtons[index].focus();return;
      }
      if(code==='Enter'&&!event.repeat&&!loading && !event.target.closest?.('button')){event.preventDefault();begin();}
      return;
    }
    if(state!=='countdown'&&state!=='racing')return;
    if(actions.has(code)){
      event.preventDefault();
      if(event.isTrusted && audioNeedsGesture()) unlockAudio();
      if(code==='Space' && !keys.has(code) && state==='racing') handbrakeTap=true;
      keys.add(code);return;
    }
    if(event.repeat)return;
    if(code==='Escape'||code==='KeyP'){event.preventDefault();pause();}
    if(code==='KeyC')camera();
    if(code==='KeyN')radio.select(radio.nextIndex);
    if(code==='KeyR'&&state==='racing')recover();
  });
  document.addEventListener('keyup',e=>keys.delete(e.code));
  document.addEventListener('pointerdown',e=>{
    if(e.isTrusted && audioNeedsGesture() && !e.target.closest('#sound-btn')) unlockAudio();
  },true);
  for(const btn of document.querySelectorAll('[data-drive]')){
    btn.addEventListener('contextmenu',e=>e.preventDefault());
    btn.addEventListener('pointerdown',e=>{
      if(state!=='countdown'&&state!=='racing')return;
      e.preventDefault();btn.setPointerCapture(e.pointerId);
      const action=btn.dataset.drive;
      if(action==='handbrake' && state==='racing') handbrakeTap=true;
      fingers.set(e.pointerId,action);btn.classList.add('held');
    });
    const release=e=>{fingers.delete(e.pointerId);if(!Array.from(fingers.values()).includes(btn.dataset.drive))btn.classList.remove('held');};
    btn.addEventListener('pointerup',release);btn.addEventListener('pointercancel',release);btn.addEventListener('lostpointercapture',release);
  }
  window.addEventListener('blur',()=>{clearInput();pause();});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){clearInput();pause();}
    if(dialog==='radio')audio.setMusicPreview(!document.hidden);
  });
  window.addEventListener('resize',()=>{
    world?.resize();
    if(state==='menu')paintMap(byId('menu-map'));else if(state==='viewcar')walkaround.pending=2;else hud();
  });
  byId('world').addEventListener('webglcontextlost',event=>{event.preventDefault();clearInput();showError();});
  byId('world').addEventListener('webglcontextrestored',()=>{world=null;menu();});
  function driveTelemetry() {
    return {
      rpm: drive.rpm,
      speed: drive.kmh,
      slip: drive.slip,
      tireScrub: drive.tireScrub,
      frontSlipAngle: drive.frontSlipAngle,
      rearSlipAngle: drive.rearSlipAngle,
      rearLock: drive.rearLock,
      wheelspin: drive.wheelspin,
      boost: drive.boost,
      angle: drive.angle,
      handbrake: drive.handbrake,
      throttle: drive.throttle,
      engineLoad: drive.engineLoad,
      brake: drive.brake,
      gear: drive.gear,
      cameraMode: world?.cameraMode,
      wall: world?.wallReflection(drive.contact,drive.heading)
    };
  }
  function hud(){
    setText('clock',timeStr(drive.time));setText('speed',String(Math.round(drive.kmh)));setText('gear',drive.gear<0?'R':String(drive.gear));
    setText('rpm',fmt(Math.round(drive.rpm/50)*50)+' RPM');setText('total-score',fmt(drive.score)+' DRIFT PTS');
    setText('boost',(drive.boost*.35).toFixed(2)+' BAR');
    const sector=Math.min(2,drive.sector);setText('sector','S'+(sector+1)+' / '+course.sectors[sector].toUpperCase());
    byId('condition').firstChild.nodeValue=String(drive.integrity);byId('cargo-meter').firstElementChild.style.width=drive.integrity+'%';
    byId('progress-fill').style.width=drive.progress*100+'%';setText('remaining',((1-drive.progress)*displayDistance).toFixed(2)+(course.night?' KM TO SUMMIT':' KM TO DELIVERY'));
    const threshold=Math.round(drive.rpm/8000*ticks.length);for(let i=0;i<ticks.length;i++)ticks[i].classList.toggle('lit',i<threshold);
    byId('chain').hidden=drive.chain<3||state==='result';
    if(!byId('chain').hidden){
      setText('chain-points','+'+fmt(drive.chain));
      setText('multiplier','×'+drive.multiplier.toFixed(1));
      setText('slip-angle',Math.round(Math.abs(drive.angle)*180/Math.PI)+'° SLIP');
    }
    paintMap(byId('hud-map'),true);
  }
  function frame(now){
    requestAnimationFrame(frame);
    const raw=prevTime?Math.max(0,(now-prevTime)/1000):1/60;prevTime=now;const dt=Math.min(raw,.25);
    const pad=gamepad();
    if(dialog==='radio'){
      const voice=radio.voice;
      const elapsed=voice?Math.max(0,voice.offset+audio.context.currentTime-voice.when):0;
      setText('radio-time',voice?songTime(elapsed)+' / '+songTime(voice.source.buffer.duration):'');
      return;
    }
    if(state==='viewcar' && world){walkaround.render(world,drive,Math.min(dt,.06),pad);return;}
    if(!world||(state!=='racing'&&state!=='countdown'))return;
    const input=drivingInput(pad);
    if(state==='countdown'){
      drive.throttle=input.throttle;
      drive.brake=input.brake;
      drive.handbrake=input.handbrake;
      // With the clutch disengaged on the grid, a short blip spins up
      // quickly, then returns to idle on flywheel inertia.
      const freeRpm=1020+input.throttle*5520;
      drive.rpm+=(freeRpm-drive.rpm)*(1-Math.exp(-dt*(freeRpm>drive.rpm?3.9:2.8)));
      drive.engineLoad+=(input.throttle*.49-drive.engineLoad)*(1-Math.exp(-dt*9));
      count-=dt;
      if(count>0){setText('count-number',String(Math.min(3,Math.ceil(count))));}
      else{renderPose.capture(drive);stateTo('racing');audio.event('go');setText('count-number','GO');setText('count-label',course.night?'HARUNA NIGHT ASCENT':'HARUNA DOWNHILL');}
    }else{
      if(raw>dt)drive.time+=raw-dt;
      accumulator+=dt;
      const heldHandbrake=input.handbrake;
      while(accumulator+1e-9>=fixed&&!drive.finished){
        renderPose.capture(drive);
        // A tap between display frames still reaches the rear brakes for one tick.
        input.handbrake=heldHandbrake || handbrakeTap;
        handbrakeTap=false;
        drive.step(fixed,input);
        accumulator-=fixed;
      }
      handleEvents();
      if(state==='result')return;
      count-=dt;if(count<-.65)byId('countdown').hidden=true;
      if(toastTime>0){toastTime-=dt;if(toastTime<=0)byId('toast').hidden=true;}
    }
    audio.update(driveTelemetry());
    world.measureFrame(raw);
    const racing=state==='racing';
    const pose=racing?renderPose.sample(drive,accumulator/fixed):drive;
    world.render(dt,pose,racing);
    if(now-lastHud>48){hud();lastHud=now;}
  }
  requestAnimationFrame(frame);
})();
