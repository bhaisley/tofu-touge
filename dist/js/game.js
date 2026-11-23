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
  let world=null,state='menu',dialog='',resumeTo='racing',controlParent='menu',loading=null;
  let preparation=null,artReady=null,warmScheduled=false,contextLost=false;
  let loadChannel;
  const loadTurns=[];
  const viewport=byId('viewport');
  const walkaround=new TougeCarWalkaround(viewport,()=>state==='viewcar');
  const canOrbit=()=>state==='racing' && !dialog && world?.cameraMode<2;
  const chaseOrbit=new TougeChaseOrbit(viewport,canOrbit);
  let count=3.1,accumulator=0,prevTime=0,lastHud=0,toastTime=0,controlTab='keyboard',focusReturn=null;
  const fixed=1/120, settingsKey='tofu-touge-settings-v1';
  // Title controls can run while the remaining graphics scripts download.
  const scriptsReady=document.readyState==='complete'?Promise.resolve():
    new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  function read(key){
    try {const data=JSON.parse(localStorage.getItem(key));return data && typeof data==='object' && !Array.isArray(data)?data:{};}
    catch {return {};}
  }
  function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private sessions can still play. */}}
  const stages={
    downhill:{map:'haruna',name:'Haruna Pass',light:'Dawn',record:'tofu-touge-haruna-v1',
      objective:'Drift the hairpins of Haruna Pass.',destination:'Bring the tofu down intact.'},
    uphill:{map:'haruna',name:'Haruna Reverse',light:'Night',record:'tofu-touge-haruna-night-v1',
      objective:'Climb the hairpins from the tofu shop.',destination:'Bring the delivery to the summit.'},
    'fuji-downhill':{map:'fuji',name:'Mikuni Pass',light:'Late afternoon',record:'tofu-touge-mikuni-descent-v1',
      objective:'Descend through silvergrass above Lake Yamanaka.',destination:'Deliver the tofu to Hirano.'},
    'fuji-uphill':{map:'fuji',name:'Mikuni Ascent',light:'Blue hour',record:'tofu-touge-mikuni-ascent-v1',
      objective:'Climb from Hirano before sunrise.',destination:'Take the delivery up Mikuni Pass.'}
  };
  const settings=read(settingsKey),roads=new Map();
  let stageId=document.documentElement.dataset.cover;
  const stageFor=(map,climb)=>(map==='fuji'?'fuji-':'')+(climb?'uphill':'downhill');
  function roadFor(id){
    const map=stages[id].map;
    if(!roads.has(map))roads.set(map,map==='haruna'?new TougeCourse():new TougeCourse(map));
    const road=roads.get(map);
    return id===stageFor(map,true)?road.reversed():road;
  }
  let course=roadFor(stageId);
  const drive=new TougeDrive(course), renderPose=new TougeRenderPose(drive);
  const recordsKey=()=>stages[stageId].record;
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
  const mapButtons=document.querySelectorAll('.pass-picker button');
  const stageButtons=document.querySelectorAll('.direction-picker button');
  let hudMapBounds=null;
  const startLabel=()=>course.direction<0?'Start ascent':'Start descent';
  function showCourse(){
    const stage=stages[stageId],climb=course.direction<0;
    document.body.dataset.stage=stageId;
    document.documentElement.dataset.cover=stageId;
    for(const button of mapButtons)button.setAttribute('aria-pressed',String(button.dataset.map===stage.map));
    stageButtons.forEach((button,index)=>{
      const id=stageFor(stage.map,index===1);
      button.dataset.stage=id;
      button.setAttribute('aria-pressed',String(id===stageId));
      button.querySelector('span').textContent='· '+stages[id].light;
    });
    byId('start-btn').children[1].textContent=startLabel();
    setText('stage-objective',stage.objective);setText('stage-destination',stage.destination);
    setText('course-name',stage.name);setText('course-light',stage.light);
    setText('elevation-label',climb?'ELEVATION GAIN':'ELEVATION DROP');
    setText('hud-course',stage.name.toUpperCase());
    byId('hud-course').nextElementSibling.textContent=stage.map==='fuji'?'三国峠':'榛名山';
    byId('world').setAttribute('aria-label',stage.name+' driving view');
    byId('menu-distance').innerHTML=(course.distance/1000).toFixed(2)+' <small>KM</small>';
    const elevation=Math.abs(course.sample(course.start).y-course.sample(course.finish).y);
    byId('menu-drop').innerHTML=Math.round(elevation)+' <small>M</small>';
    showRecord();paintMap(byId('menu-map'));
  }
  function selectStage(id){
    if(state!=='menu' || dialog || stageId===id)return;
    clearEntry();
    if(stages[id].map!==stages[stageId].map)retirePass();
    stageId=id;course=roadFor(id);drive.course=course;drive.reset();renderPose.capture(drive);
    records=read(recordsKey());settings.stage=id;write(settingsKey,settings);
    showCourse();schedulePass();
  }
  for(const button of mapButtons)button.addEventListener('click',()=>selectStage(stageFor(button.dataset.map,course.direction<0)));
  for(const button of stageButtons)button.addEventListener('click',()=>selectStage(button.dataset.stage));
  function showRecord(){const el=byId('menu-record');el.hidden=!Number.isFinite(records.time);if(!el.hidden)el.textContent='PERSONAL BEST  '+timeStr(records.time);}
  function paintMap(canvas,local=false) {
    const bounds=(local && hudMapBounds)||canvas.getBoundingClientRect();
    if(!bounds.width)return;
    if(local)hudMapBounds=bounds;
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
    const lo=Math.max(course.start,p.s-50),hi=Math.min(course.finish,p.s+260);
    // Only the road centerline is needed for the map, and both strokes follow it.
    c.beginPath();
    for(let s=lo;s<=hi;s+=3){
      const i=Math.min(course.segments-1,Math.floor(s/course.step)),a=course.points[i],b=course.points[i+1];
      const t=(s-a.s)/course.step;
      const dx=a.x+(b.x-a.x)*t-drive.x,dz=a.z+(b.z-a.z)*t-drive.z;
      const x=baseX+(dx*p.rx+dz*p.rz)*scale,y=baseY-(dx*p.fx+dz*p.fz)*scale;
      if(s===lo)c.moveTo(x,y);else c.lineTo(x,y);
    }
    c.lineWidth=6;c.strokeStyle='#0e171d';c.stroke();
    c.lineWidth=3;c.strokeStyle='#dfdfcf';c.stroke();
    const next=course.splits[Math.min(2,drive.sector)];
    if(next-p.s<160){const goal=course.sample(next),[x,y]=plot(goal.x,goal.z);c.fillStyle='#ffbd84';c.fillRect(x-3,y-3,6,6);}
    c.save();c.translate(baseX,baseY);c.rotate(drive.heading-p.heading);c.fillStyle='#ff6943';c.strokeStyle='#162128';c.lineWidth=2;
    c.beginPath();c.moveTo(0,-6);c.lineTo(4.6,4);c.lineTo(0,2.5);c.lineTo(-4.6,4);c.closePath();c.stroke();c.fill();c.restore();
  }
  showCourse();
  const tacho=byId('tach'),ticks=Array.from({length:26},(_,i)=>{const el=document.createElement('i');if(i>20)el.className='hot';tacho.append(el);return el;});
  function stateTo(next){
    state=next;document.body.dataset.state=next;byId('hud').hidden=next==='menu'||next==='viewcar';
    viewport.classList.toggle('chase-orbit',canOrbit());
    byId('walkaround').hidden=next!=='viewcar';
    const labels={menu:'MAIN MENU',viewcar:'WALKAROUND',racing:course.direction<0?'UPHILL RUN':'DOWNHILL RUN',countdown:'START GRID',paused:'PAUSED',result:'RUN RESULT'};
    setText('screen-label',labels[next]);
    refreshSound();
  }
  function clearInput(){
    keys.clear();fingers.clear();handbrakeTap=false;chaseOrbit.reset();
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
    clearEntry();
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
    preparation?.resume?.();schedulePass();
  }
  const bind=(id,fn)=>byId(id).addEventListener('click',fn);
  function menu(){
    clearEntry();
    clearInput();audio.setActive(false);closeDialog(false);stateTo('menu');accumulator=0;
    byId('countdown').hidden=true;byId('chain').hidden=true;byId('toast').hidden=true;showRecord();paintMap(byId('menu-map'));
    byId('start-btn').focus({preventScroll:true});
    schedulePass();
  }
  function toast(msg,seconds=1.45){setText('toast',msg);byId('toast').hidden=false;toastTime=seconds;}
  function showError(){
    closeDialog(false);audio.setActive(false);stateTo('menu');openDialog('error','<p class="dialog-kicker">GRAPHICS</p><h2 id="dialog-title">Renderer unavailable</h2><p class="dialog-tip">This pass needs WebGL and hardware acceleration. Enable graphics acceleration in your browser or open the game in a WebGL-capable browser.</p><div class="dialog-buttons"><button id="error-back" class="primary">Main menu</button></div>');
    bind('error-back',menu);
  }
  function clearEntry(){
    if(!loading)return;
    loading=null;showEntry();
  }
  function showEntry(){
    const start=byId('start-btn'),car=byId('view-car');
    start.disabled=loading?.inspect===false;car.disabled=loading?.inspect===true;
    start.children[1].textContent=start.disabled?'Loading pass':startLabel();
    car.firstElementChild.firstChild.nodeValue=car.disabled?'LOADING CAR ':'VIEW CAR ';
    start.setAttribute('aria-busy',String(start.disabled));car.setAttribute('aria-busy',String(car.disabled));
  }
  function artworkReady(manager){
    if(!artReady)artReady=new Promise(resolve=>{
      const previous=manager.onLoad;
      manager.onLoad=function complete(){
        if(manager.onLoad===complete)manager.onLoad=previous;
        artReady=null;resolve();previous?.call(manager);
      };
    });
    return artReady;
  }
  function checkJob(job){
    if(job!==preparation)throw new DOMException('Graphics preparation superseded','AbortError');
  }
  function retirePass(){
    // Keep the input surface stable. Retiring its child canvas frees the
    // previous mountain's GPU allocations, including offscreen reflections.
    const canvas=byId('world'),job=preparation;
    preparation=null;job?.resume?.();
    canvas.replaceWith(canvas.cloneNode(false));
    world?.dispose();job?.built?.dispose();
    world=null;contextLost=false;
  }
  function postLoadTurn(){
    if(!loadChannel){
      loadChannel=new MessageChannel();
      loadChannel.port1.onmessage=()=>loadTurns.shift()();
    }
    return new Promise(resolve=>{loadTurns.push(resolve);loadChannel.port2.postMessage(null);});
  }
  async function prepareTurn(job){
    do{
      checkJob(job);
      if(document.hidden || (dialog && !loading)){
        await new Promise(resolve=>{job.resume=resolve;});
        job.resume=null;
      }else if(!loading && window.requestIdleCallback){
        await new Promise(resolve=>requestIdleCallback(resolve,{timeout:160}));
      }else if(window.scheduler?.yield){
        await scheduler.yield();
      }else if(loading && window.MessageChannel){
        // A posted task lets input and painting run between batches without
        // WebKit's recurring timer delay while a driver is waiting to enter.
        await postLoadTurn();
      }else{
        await new Promise(resolve=>setTimeout(resolve,0));
      }
      checkJob(job);
    }while(document.hidden || (dialog && !loading));
  }
  async function preparePass(job){
    const pause=()=>prepareTurn(job);
    await scriptsReady;
    await pause();
    if(!world){
      const manager=THREE.DefaultLoadingManager;
      // Between batches, all outstanding image requests can momentarily finish.
      // Keep this load open until the last geometry batch has queued its maps.
      const ticket='tofu-world-build';manager.itemStart(ticket);
      const images=artworkReady(manager);
      let pass;
      try{pass=await TougeWorld.create(byId('world'),course,pause);job.built=pass;}
      finally{manager.itemEnd(ticket);}
      await images;
      if(preparation!==job){pass.dispose();checkJob(job);}
      world=pass;job.built=null;
    }
    const pass=world;
    for(;;){
      await pause();
      const stage=course;
      pass.setCourse(stage);
      if(!pass.preparedCourses.has(stage)){
        await pass.warmGraphics(pause);
        await pause();
        if(stage!==course)continue;
        // Upload the grid's geometry and render targets behind the cover. Its
        // first visible frame and the three-second countdown start together.
        pass.render(0,drive,false);
        pass.reset();pass.preparedCourses.add(stage);
      }
      if(loading?.inspect && !stage.night && !pass.inspectionReady)await pass.warmInspection(pause);
      if(stage===course)return pass;
    }
  }
  function loadPass(){
    if(contextLost)return Promise.reject(new Error('WebGL context lost'));
    if(preparation)return preparation.ready;
    if(world?.course===course && world.preparedCourses.has(course) &&
      (!loading?.inspect || course.night || world.inspectionReady))return Promise.resolve(world);
    const job={};preparation=job;
    job.ready=preparePass(job).finally(()=>{if(preparation===job)preparation=null;});
    return job.ready;
  }
  function schedulePass(){
    if(warmScheduled || preparation || contextLost || state!=='menu' || dialog || document.hidden ||
      (world?.course===course && world.preparedCourses.has(course)))return;
    warmScheduled=true;
    const warm=()=>{
      warmScheduled=false;
      if(state==='menu' && !dialog && !document.hidden && !contextLost)loadPass().catch(()=>{});
    };
    if(window.requestIdleCallback)requestIdleCallback(warm,{timeout:600});else setTimeout(warm,100);
  }
  function leaveCar(){menu();byId('view-car').focus({preventScroll:true});}
  bind('view-car',()=>enterPass(true));bind('car-back',leaveCar);
  bind('orbit-left',()=>walkaround.move(-Math.PI/6,0));bind('orbit-right',()=>walkaround.move(Math.PI/6,0));
  function begin(){return enterPass(false);}
  async function enterPass(inspect){
    if(loading?.inspect===inspect)return;
    closeDialog(false);
    const request={inspect};loading=request;clearInput();if(!inspect)unlockAudio();
    showEntry();
    preparation?.resume?.();
    try{
      await loadPass();
      if(loading!==request)return;
      world.reset();drive.reset();accumulator=0;prevTime=0;
      if(inspect){
        const physical=course.physicalCourse;
        const station=course.mapId==='fuji'
          ?course.physicalStation(physical.splits[0]-22)
          :course.night?course.start:course.splits[0]-19;
        drive.place(station);
        const p=drive.contact;p.offset=.55;drive.x=p.x+p.rx*p.offset;drive.z=p.z+p.rz*p.offset;
        drive.steerAngle=.048;walkaround.reset();walkaround.render(world,drive,1/60);
        stateTo('viewcar');byId('car-back').focus({preventScroll:true});return;
      }
      renderPose.capture(drive);count=3.1;lastHud=0;toastTime=0;
      byId('toast').hidden=true;byId('chain').hidden=true;byId('countdown').hidden=false;setText('count-number','3');setText('count-label','START GRID');
      world.render(1/60,drive,false);stateTo('countdown');audio.update(driveTelemetry());audio.setActive(true);hud();
    }catch(error){if(loading===request){console.error('Unable to start Tofu Touge',error);showError();}}
    finally{if(loading===request)clearEntry();}
  }
  function resume(){
    if(state!=='paused')return;closeDialog(false);clearInput();unlockAudio();stateTo(resumeTo);audio.setActive(true);prevTime=0;
  }
  function camera(){
    if(!world)return;chaseOrbit.reset();const name=world.cycleCamera();toast(name+' camera');
    viewport.classList.toggle('chase-orbit',canOrbit());
    if(dialog==='pause')setText('camera-setting',name);
  }
  function recover(){
    if(resumeTo==='countdown'&&state==='paused'){resume();return;}
    chaseOrbit.reset();drive.recover();renderPose.capture(drive);accumulator=0;world.cameraReady=false;if(state==='paused')resume();
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
    const driving=state==='racing'||state==='countdown';
    radioParent=driving?'drive':dialog==='pause'?'pause':state;
    unlockAudio();audio.setMusicPreview(true);
    if(driving){
      resumeTo=state;stateTo('paused');clearInput();audio.setActive(false);
    }
    const rows=radio.tracks.map((track,i)=>'<button class="radio-track" data-track="'+i+
      '" aria-pressed="false"><span class="track-indicator" aria-hidden="true"></span><span class="track-title">'+
      track.title+'</span><span class="track-genre">'+track.genre+'</span></button>').join('');
    openDialog('radio','<p class="dialog-kicker">'+stages[stageId].name.toUpperCase()+'</p><h2 id="dialog-title">Pass radio</h2>'+
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
    openDialog('pause','<p class="dialog-kicker">'+stages[stageId].name.toUpperCase()+'</p><h2 id="dialog-title">Run paused</h2>'+
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
      ['Change camera',['C']],['Look around in chase',['Left mouse + drag']],['Return to chase',['Release mouse']],
      ['Next radio track',['N']],['Recover car (+3 s)',['R']],['Pause',['Esc','P']]
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
    const tabs=[['keyboard','Keys &amp; mouse'],['gamepad','Controller'],['touch','Touch']];
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
    const resultCourse=stages[stageId].name.toUpperCase(),displayDistance=course.distance/1000;
    const resultTitle=success?(course.direction<0?'Summit delivery complete':'Tofu delivered'):'Cargo lost';
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
    for(const i of [0,1,3,9,12,13,14,15]){
      const held=!!pad.buttons[i]?.pressed,edge=held&&!previousButtons.get(i);previousButtons.set(i,held);
      if(!edge)continue;
      if(dialog==='radio'){if(i===1||i===9)dismiss();else if(i===15)radio.select(radio.nextIndex);continue;}
      if(state==='menu'&&!dialog&&i>=12){
        const map=i<14?(i===12?'haruna':'fuji'):stages[stageId].map;
        selectStage(stageFor(map,i<14?course.direction<0:i===15));continue;
      }
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
      if(code==='Escape' && loading){event.preventDefault();clearEntry();return;}
      if(event.target.closest?.('.course-picker')&&(code==='ArrowLeft'||code==='ArrowRight')){
        event.preventDefault();const index=code==='ArrowLeft'?0:1;
        const buttons=event.target.closest('.pass-picker')?mapButtons:stageButtons;
        buttons[index].click();buttons[index].focus();return;
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
    else {preparation?.resume?.();schedulePass();}
    if(dialog==='radio')audio.setMusicPreview(!document.hidden);
  });
  window.addEventListener('resize',()=>{
    hudMapBounds=null;
    world?.resize();
    if(state==='menu')paintMap(byId('menu-map'));else if(state==='viewcar')walkaround.pending=2;else hud();
  });
  viewport.addEventListener('webglcontextlost',event=>{
    const inPass=loading || state!=='menu';
    event.preventDefault();contextLost=true;preparation?.resume?.();preparation=null;
    world?.dispose();world=null;clearInput();clearEntry();
    if(inPass)showError();
  },true);
  viewport.addEventListener('webglcontextrestored',()=>{
    contextLost=false;if(dialog==='error')menu();else schedulePass();
  },true);
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
    byId('progress-fill').style.width=drive.progress*100+'%';setText('remaining',((1-drive.progress)*course.distance/1000).toFixed(2)+(course.direction<0?' KM TO SUMMIT':' KM TO DELIVERY'));
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
      else{renderPose.capture(drive);stateTo('racing');audio.event('go');setText('count-number','GO');setText('count-label',stages[stageId].name.toUpperCase());}
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
    world.render(dt,pose,racing,null,racing?chaseOrbit.sample(dt):null);
    if(now-lastHud>48){hud();lastHud=now;}
  }
  requestAnimationFrame(frame);
  requestAnimationFrame(()=>{
    requestAnimationFrame(schedulePass);
    audio.prepareOutput();
  });
})();
