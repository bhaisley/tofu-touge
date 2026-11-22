(() => {
  'use strict';
  const route = [
    [-281,-487],[-280,-450],[-275,-410],[-252,-366],[-203,-334],[-130,-310],[-20,-294],
    [55,-273],[100,-228],[112,-193],[95,-167],[64,-160],[28,-175],[-30,-198],[-101,-192],
    [-170,-157],[-215,-129],[-226,-104],[-212,-87],[-177,-84],[-126,-104],[-78,-111],
    [-18,-99],[31,-72],[101,-63],[161,-38],[192,2],[188,25],[161,36],[123,29],[61,12],
    [8,18],[-32,43],[-77,76],[-93,108],[-80,132],[-48,137],[-7,114],[37,92],[90,95],
    [139,120],[203,130],[252,165],[284,213],[300,277],[330,328],[378,361],[425,371],
    [453,394],[458,419],[443,438],[411,441],[361,427],[311,437],[286,463],[263,507],
    [213,540],[156,547],[80,552],[26,583],[12,633],[22,700],[43,749]
  ];
  const T = THREE;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const mix = (a,b,t) => a+(b-a)*t;
  const wrap = x => Math.atan2(Math.sin(x),Math.cos(x));
  const oppositeCourses=new WeakMap();
  class Course {
    constructor(downhill=null) {
      this.night=!!downhill;
      this.direction=downhill?-1:1;
      if(downhill){
        oppositeCourses.set(this,downhill);oppositeCourses.set(downhill,this);
        const {length,distance,half,segments,step,bounds}=downhill;
        Object.assign(this,{length,distance,half,segments,step,bounds});
        this.start=length-downhill.finish;
        this.finish=length-downhill.start;
        this.splits=[length-downhill.splits[1],length-downhill.splits[0],this.finish];
        this.sectors=['Valley climb','Five hairpins','Cedar summit'];
        // Stations and the right-hand road frame increase in the driver's
        // direction. The paved surface stays in the same world coordinates.
        this.points=downhill.points.slice().reverse().map((p,i)=>({
          x:p.x,y:p.y,z:p.z,s:i*step,fx:-p.fx,fz:-p.fz,rx:-p.rx,rz:-p.rz,
          heading:wrap(p.heading+Math.PI),grade:-p.grade,bank:-p.bank,curvature:-p.curvature
        }));
        return;
      }
      const spline = new T.CatmullRomCurve3(route.map(([x,north]) => new T.Vector3(x,0,-north)),false,'centripetal');
      spline.arcLengthDivisions = 6000;
      this.length = spline.getLength();
      this.start = 32;
      this.finish = this.length-56;
      this.distance = this.finish-this.start;
      this.half = 4.85;
      this.segments = Math.ceil(this.length/2.2);
      this.step = this.length/this.segments;
      this.points = [];
      for (let i=0;i<=this.segments;i++) {
        const s = i*this.step;
        const p = spline.getPointAt(i/this.segments);
        const h = 8 - 0.082*s + 2.8*Math.sin(s/105) + 1.6*Math.sin(s/213);
        this.points.push({x:p.x,z:p.z,y:h,s});
      }
      for(let i=0;i<=this.segments;i++) {
        const prev=this.points[Math.max(0,i-1)], next=this.points[Math.min(this.segments,i+1)];
        const p=this.points[i], len=Math.hypot(next.x-prev.x,next.z-prev.z);
        p.fx=(next.x-prev.x)/len; p.fz=(next.z-prev.z)/len;
        p.rx=-p.fz; p.rz=p.fx;
        p.heading=Math.atan2(p.fx,-p.fz);
        p.grade=(next.y-prev.y)/len;
      }
      for(let i=0;i<=this.segments;i++) {
        const a=this.points[Math.max(0,i-3)], b=this.points[Math.min(this.segments,i+3)];
        const p=this.points[i];
        p.curvature=wrap(b.heading-a.heading)/(b.s-a.s);
        p.bank=clamp(p.curvature*1.35,-0.055,0.055);
      }
      this.splits=[this.start+this.distance/3,this.start+this.distance*2/3,this.finish];
      this.sectors=['Cedar ridge','Five hairpins','Valley approach'];
      this.bounds={minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity};
      for(const p of this.points) {
        this.bounds.minX=Math.min(this.bounds.minX,p.x); this.bounds.maxX=Math.max(this.bounds.maxX,p.x);
        this.bounds.minZ=Math.min(this.bounds.minZ,p.z); this.bounds.maxZ=Math.max(this.bounds.maxZ,p.z);
      }
    }
    get physicalCourse() {return this.night?oppositeCourses.get(this):this;}
    reversed() {
      return oppositeCourses.get(this)||new Course(this);
    }
    physicalStation(s) {return this.night?this.length-s:s;}
    physicalIndex(i) {return this.night && i!==undefined?this.segments-1-i:i;}
    sample(distance) {
      const s=clamp(distance,0,this.length), i=Math.min(this.segments-1,Math.floor(s/this.step));
      const a=this.points[i], b=this.points[i+1], t=(s-a.s)/this.step;
      const heading=a.heading+wrap(b.heading-a.heading)*t;
      return {s,i,x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),y:mix(a.y,b.y,t),
        fx:Math.sin(heading),fz:-Math.cos(heading),rx:Math.cos(heading),rz:Math.sin(heading),
        heading,grade:mix(a.grade,b.grade,t),bank:mix(a.bank,b.bank,t),curvature:mix(a.curvature,b.curvature,t)};
    }
    nearest(x,z,hint) {
      let center=hint;
      if (center===undefined) {
        let best=Infinity; center=0;
        for(let i=0;i<=this.segments;i+=10) {
          const p=this.points[i], d=(p.x-x)**2+(p.z-z)**2;
          if(d<best){best=d;center=i;}
        }
      }
      let best=Infinity, along=0;
      const first=Math.max(0,center-19), last=Math.min(this.segments-1,center+19);
      for(let i=first;i<=last;i++) {
        const a=this.points[i],b=this.points[i+1];
        const dx=b.x-a.x,dz=b.z-a.z, t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
        const d=(x-a.x-dx*t)**2+(z-a.z-dz*t)**2;
        if(d<best){best=d;along=(i+t)*this.step;}
      }
      const p=this.sample(along);
      p.offset=(x-p.x)*p.rx+(z-p.z)*p.rz;
      p.distance=Math.sqrt(best);
      return p;
    }
    surface(p,offset) {return p.y-p.bank*offset-0.0045*offset*offset;}
    at(s,offset=0,lift=0) {
      const p=this.sample(s);
      return new T.Vector3(p.x+offset*p.rx,this.surface(p,offset)+lift,p.z+offset*p.rz);
    }
    sector(s) {return s<this.splits[0]?0:s<this.splits[1]?1:2;}
  }
  window.TougeCourse=Course;
})();
