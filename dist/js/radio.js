/* The radio keeps the current record and its successor decoded. Both voices
   run on the same Web Audio clock as the car, including in the offline HTML. */
(() => {
  'use strict';
  const tracks = [
    {id:'night-delivery', title:'Night Delivery', genre:'Eurobeat'},
    {id:'cedar-afterglow', title:'Cedar Afterglow', genre:'Japanese jazz-hop'},
    {id:'rain-on-the-engawa', title:'Rain on the Engawa', genre:'Lo-fi hip-hop'},
    {id:'daybreak-signal', title:'Daybreak Signal', genre:'J-pop'},
    {id:'kori-no-hibana', title:'Kōri no Hibana', genre:'Kawaii metal'}
  ];
  const script = document.currentScript?.src;
  const level = .51 * 10 ** (2 / 20);
  const blend = .24;
  function urlFor(track) {
    const name=track.id+'.mp3';
    return track.url || window.TougeMusicURLs?.[name] ||
      new URL((script?'../':'')+'assets/music/'+name,script||document.baseURI).href;
  }

  class TougeRadio {
    constructor(playlist=tracks) {
      this.tracks=playlist;this.index=0;this.offset=0;this.playing=false;
      this.cache=new Map();this.voice=null;this.queued=null;this.request=null;
      this.error=false;
    }
    get track(){return this.tracks[this.index];}
    get nextIndex(){return (this.index+1)%this.tracks.length;}

    connect(context,output) {
      if(this.context)return;
      this.context=context;this.output=output;
      if(this.playing)this.start();
    }
    read(index) {
      const existing=this.cache.get(index);
      if(existing)return existing.promise;
      const entry={controller:new AbortController()};
      entry.promise=fetch(urlFor(this.tracks[index]),{signal:entry.controller.signal})
        .then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.arrayBuffer();})
        .then(bytes=>this.context.decodeAudioData(bytes))
        .catch(error=>{
          if(this.cache.get(index)===entry)this.cache.delete(index);
          if(error.name!=='AbortError')console.warn('Tofu Touge radio: '+this.tracks[index].title,error.message);
          return null;
        });
      this.cache.set(index,entry);
      return entry.promise;
    }
    trimCache() {
      for(const [index,entry] of this.cache){
        if(index===this.index || index===this.nextIndex)continue;
        entry.controller.abort();this.cache.delete(index);
      }
    }
    makeVoice(index,buffer,when,offset,fade) {
      const ctx=this.context, source=ctx.createBufferSource(), gain=ctx.createGain();
      source.buffer=buffer;source.connect(gain).connect(this.output);
      const end=when+buffer.duration-offset;
      gain.gain.setValueAtTime(0,when);
      gain.gain.linearRampToValueAtTime(level,Math.min(end,when+fade));
      const voice={index,source,gain,when,offset,end};
      source.onended=()=>{
        source.disconnect();gain.disconnect();
        if(this.voice===voice)this.advance();
      };
      source.start(when,offset);
      return voice;
    }
    async queueAfter(voice) {
      // A failed download in the hosted edition should skip one record,
      // then continue with the next available song on the same audio clock.
      let next=this.nextIndex,buffer;
      for(let i=0;i<this.tracks.length;i++){
        buffer=await this.read(next);
        if(this.voice!==voice)return;
        if(buffer)break;
        next=(next+1)%this.tracks.length;
      }
      if(!buffer)return;
      const now=this.context.currentTime;
      if(now>=voice.end)return;
      const start=Math.max(now,voice.end-Math.min(blend,buffer.duration/4,(voice.end-voice.when)/2));
      voice.gain.gain.setValueAtTime(level,start);
      voice.gain.gain.linearRampToValueAtTime(0,voice.end);
      this.queued=this.makeVoice(next,buffer,start,0,voice.end-start);
    }
    advance() {
      this.index=this.queued?.index??this.nextIndex;this.offset=0;
      this.voice=this.queued;this.queued=null;
      this.trimCache();
      if(this.voice){
        this.onBuffer?.(this.voice.source.buffer);this.queueAfter(this.voice);
      }else this.start();
      this.onChange?.('advance');
    }
    async start() {
      if(!this.context || !this.playing || this.voice || this.request)return;
      const request=this.request=this.read(this.index);
      const buffer=await request;
      if(this.request!==request)return;
      this.request=null;this.error=!buffer;
      if(!buffer){this.onChange?.('error');return;}
      this.onBuffer?.(buffer);
      this.voice=this.makeVoice(this.index,buffer,this.context.currentTime+.012,this.offset%buffer.duration,.12);
      this.queueAfter(this.voice);this.onChange?.('playing');
    }
    stop(remember) {
      this.request=null;
      const current=this.voice, now=this.context?.currentTime||0;
      if(remember && current){
        this.offset=Math.max(0,Math.min(current.source.buffer.duration-.001,current.offset+now-current.when));
      }else if(!remember)this.offset=0;
      for(const voice of [current,this.queued]){
        if(!voice)continue;
        const gain=voice.gain.gain;
        if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);
        else {const volume=gain.value;gain.cancelScheduledValues(now);gain.setValueAtTime(volume,now);}
        gain.linearRampToValueAtTime(0,now+.075);
        voice.source.stop(now+.08);
      }
      this.voice=null;this.queued=null;
    }
    setPlaying(playing) {
      if(this.playing===playing)return;
      this.playing=playing;
      if(playing)this.start();else this.stop(true);
    }
    select(index) {
      if(!Number.isInteger(index) || !this.tracks[index])return;
      if(index===this.index){if(this.error)this.start();return;}
      this.stop(false);this.index=index;this.error=false;this.trimCache();
      this.start();this.onChange?.('select');
    }
  }
  window.TougeRadio=TougeRadio;
})();
