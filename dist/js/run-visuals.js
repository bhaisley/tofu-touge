(() => {
  'use strict';
  const T = THREE;

  function marker(course, station, word, color) {
    const group = new T.Group(), canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const c = canvas.getContext('2d');
    c.fillStyle = '#132126'; c.fillRect(0, 0, 256, 128);
    c.fillStyle = color; c.fillRect(0, 0, 256, 15);
    c.font = 'bold 58px sans-serif'; c.textAlign = 'center';
    c.fillStyle = '#fff9e9'; c.fillText(word, 128, 91);
    const map = new T.CanvasTexture(canvas); map.colorSpace = T.SRGBColorSpace;
    const board = new T.Mesh(new T.BoxGeometry(1.6, .8, .05), new T.MeshBasicMaterial({map}));
    board.position.y = 1.48; group.add(board);
    const post = new T.Mesh(new T.CylinderGeometry(.035, .045, 1.21, 6), new T.MeshStandardMaterial({color: 0x7c8479}));
    post.position.y = .60; group.add(post);
    const p = course.sample(station);
    group.position.copy(course.at(station, course.half + .52));
    group.rotation.y = -p.heading;
    return group;
  }

  // Vertex-coloured coachwork, glazing and wheels share one draw. The hatch
  // and the notchback have different roofs, axles and rear overhangs.
  function ghostCar(vehicle) {
    const classic=vehicle==='ae86', s=window.TougeRivals?.cars[vehicle];
    const form=s?TougeRivalModels.shapes[vehicle]:null;
    const points = [], colors = [], tint = new T.Color();
    function face(a, b, c, d, hex) {
      tint.setHex(hex);
      for (const p of [a, b, c, a, c, d]) {
        points.push(...p); colors.push(tint.r, tint.g, tint.b);
      }
    }
    const cuts = s ? form.cuts.map(([z,w,h])=>[z*s.length/2,w*s.width/2,h]) : classic
      ? [[-2.12,.71,.57],[-1.94,.79,.67],[-1.22,.815,.72],[-.72,.82,.81],[1.08,.81,.82],[1.87,.79,.77],[2.08,.74,.71]]
      : [[-2.13,.73,.53],[-1.90,.86,.62],[-1.30,.92,.72],[-.74,.89,.78],[1.28,.94,.82],[1.92,.91,.80],[2.16,.82,.75]];
    for (let i=1; i<cuts.length; i++) {
      const [a,wa,ha]=cuts[i-1], [b,wb,hb]=cuts[i];
      face([-wa*.9,ha,a],[wa*.9,ha,a],[wb*.9,hb,b],[-wb*.9,hb,b],0xadf7ec);
      for (const s of [-1,1]) {
        face([wa*.9*s,ha,a],[wa*s,ha-.06,a],[wb*s,hb-.06,b],[wb*.9*s,hb,b],0x91d6d9);
        face([wa*s,ha-.06,a],[wa*s,.43,a],[wb*s,.43,b],[wb*s,hb-.06,b],0x80c8ca);
        face([wa*s,.43,a],[wa*.96*s,.27,a],[wb*.96*s,.27,b],[wb*s,.43,b],0x244854);
      }
    }
    for (const [z,w,h] of [cuts[0],cuts[cuts.length-1]]) face([-w,.25,z],[w,.25,z],[w,h,z],[-w,h,z],0x80ddda);
    const glass = s ? form.cabin.map((z,i)=>[z,s.width/2*form.rail[i],
      i===1||i===2?s.height-.045:(i===0?cuts[4][2]:cuts[cuts.length-3][2])]) : classic
      ? [[-.74,.77,.81],[-.16,.65,1.31],[.67,.64,1.30],[1.63,.75,.81]]
      : [[-.79,.80,.76],[-.24,.65,1.24],[.44,.65,1.27],[1.40,.77,.81]];
    for (let i=1; i<glass.length; i++) {
      const [a,wa,ha]=glass[i-1], [b,wb,hb]=glass[i];
      face([-wa,ha,a],[wa,ha,a],[wb,hb,b],[-wb,hb,b],i===2?0xb3fbef:0x193c52);
      for (const s of [-1,1]) {
        face([wa*s,.79,a],[wa*s,ha,a],[wb*s,hb,b],[wb*s,.79,b],0x245366);
        if(i!==2)face([wa*s,ha+.004,a],[wa*.90*s,ha+.004,a],[wb*.90*s,hb+.004,b],[wb*s,hb+.004,b],0x99dad6);
      }
    }
    const rear=s?s.length/2:classic?2.085:2.165;
    if(form){
      const [where,height,width,chord,support]=form.wing,z=where*rear,y=height+(vehicle==='fd3s'?.10:0);
      face([-width,y,z-chord/2],[width,y,z-chord/2],[width,y+.025,z+chord/2],[-width,y+.025,z+chord/2],0xb3fbef);
      for(const k of [-1,1])face([k*support,cuts.at(-2)[2],z-.09],[k*support,cuts.at(-2)[2],z+.08],
        [k*support,y,z+.08],[k*support,y,z-.09],0x87c8c6);
    }
    const strip=(x1,x2,y1,y2,z,hex)=>face([x1,y1,z],[x2,y1,z],[x2,y2,z],[x1,y2,z],hex);
    strip(-.73,.73,.30,.42,rear+.004,0x254650);
    strip(-.69,.69,.47,.63,rear+.006,0x24505c);
    strip(-.17,.17,.47,.565,rear+.012,0xa2d4d0);
    for(const s of [-1,1]){
      strip(.39*s,.68*s,.51,.615,rear+.011,0xb49191);
      strip(.52*s,.68*s,.581,.609,rear+.014,0xffc9a9);
    }
    const radius=s?s.wheel[0]:classic?.286:.31;
    for (const axle of s?[s.frontZ,s.frontZ+s.wheelbase]:classic?[-1.22,1.18]:[-1.24,1.335]) for (const side of [-1,1]) {
      const x=side*(s?(s.track[axle===s.frontZ?0:1]+s.wheel[1])/2:classic?.825:.93);
      const rim=(i,r,inset=0)=>[x-side*inset,radius+r*Math.cos(i*Math.PI/8),axle+r*Math.sin(i*Math.PI/8)];
      for (let i=0;i<16;i++){
        face(rim(i,radius),rim(i+1,radius),rim(i+1,radius,.19),rim(i,radius,.19),0x23444a);
        face(rim(i,radius),rim(i+1,radius),rim(i+1,radius*.66),rim(i,radius*.66),0x1f414c);
        if(i%2===0)face(rim(i,radius*.66),rim(i+1,radius*.66),rim(i+1,.052),rim(i,.052),0x669ca3);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position',new T.Float32BufferAttribute(points,3));
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const material = new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,opacity:.40,depthWrite:false,forceSinglePass:true});
    const mesh = new T.Mesh(geometry, material);
    mesh.name = (s?.trim || (classic?'AE86':'NEO86'))+' personal best'; mesh.visible=false;
    return mesh;
  }

  function dashboardCup() {
    const group=new T.Group();
    group.name='Dashboard water cup';
    const profile=[[.025,0],[.027,.004],[.035,.085],[.036,.087],[.036,.089],[.033,.090],[.032,.087],[.024,.007]];
    const shell=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),24);
    const paper=new T.MeshStandardMaterial({color:0xe9e3ce,roughness:.78,side:T.DoubleSide});
    group.add(new T.Mesh(shell,paper));
    const holder=new T.Mesh(new T.CylinderGeometry(.037,.039,.021,24),new T.MeshStandardMaterial({color:0x333b3c,roughness:.76}));
    holder.position.y=.009;group.add(holder);
    const water=new T.Mesh(new T.CircleGeometry(.031,32).rotateX(-Math.PI/2),
      new T.MeshStandardMaterial({color:0x86b3b0,roughness:.13,metalness:.23}));
    group.add(water);
    return {group,water};
  }

  class RunVisuals {
    constructor(world) {this.world=world;this.ghosts={};}
    configure(mode, vehicle, useGhost) {
      if (this.ghost) this.ghost.visible=false;
      this.ghost=null;
      if(mode==='cup'){
        this.cup ||= dashboardCup();
        this.world.car.body.add(this.cup.group);
        this.cup.group.position.fromArray(this.world.car.mounts?.cup || [.058,vehicle==='ae86'?.839:.757,vehicle==='ae86'?-.61:-.5]);
      }
      if(this.cup)this.cup.group.visible=mode==='cup';
      if (mode==='hairpin' && !this.boards) {
        const h=TougeEvents.hairpin,c=this.world.course;
        this.boards=new T.Group();
        this.boards.add(marker(c,h.brake,'BRAKE','#ff754b'),marker(c,h.entry,'TURN','#ffd198'),marker(c,h.exit,'EXIT','#8ae4cb'));
        this.world.scene.add(this.boards);
      }
      if (this.boards) this.boards.visible=mode==='hairpin';
      if (useGhost) {
        if (!this.ghosts[vehicle]) {
          const mesh=ghostCar(vehicle);
          this.ghosts[vehicle]=mesh;this.world.scene.add(mesh);this.world.wetRoad.exclude(mesh);
        }
        this.ghost=this.ghosts[vehicle];
      }
    }
    updateCup(cup) {
      const surface=this.cup.water;
      surface.position.y=.009+.064*cup.water/100;
      surface.rotation.set(Math.atan(cup.y*.55),0,Math.atan(cup.x*.55));
    }
    update(pose, player) {
      const mesh=this.ghost;
      if (!mesh) return;
      const distance=pose?Math.hypot(player.x-pose.x,player.z-pose.z):0;
      mesh.visible=distance>1.25 && distance<300;
      if (!mesh.visible) return;
      const p=this.world.course.sample(pose.s);
      mesh.position.set(pose.x,this.world.roadHeight(pose.x,pose.z,p.i)+.02,pose.z);
      const yaw=pose.heading-p.heading,cos=Math.cos(yaw),sin=Math.sin(yaw);
      mesh.rotation.set(Math.atan(p.grade*cos-p.bank*sin),-pose.heading,Math.atan(-p.bank*cos-p.grade*sin),'YXZ');
      mesh.material.opacity=.41*Math.min(1,(distance-1.25)/2.6);
    }
  }

  function drawCup(canvas,cup) {
    const c=canvas.getContext('2d'), w=128,h=110;
    c.clearRect(0,0,w,h);
    c.save();c.translate(w*.5,0);
    const wall=c.createLinearGradient(-39,0,39,0);
    wall.addColorStop(0,'#879a9a');wall.addColorStop(.19,'#e7e9df');wall.addColorStop(.64,'#f8f4e6');wall.addColorStop(1,'#9da9a1');
    c.fillStyle='#35474b';c.beginPath();c.ellipse(0,92,32,8,0,0,Math.PI*2);c.fill();
    c.beginPath();c.moveTo(-43,28);c.lineTo(-31,84);c.bezierCurveTo(-28,96,28,96,31,84);c.lineTo(43,28);
    c.fillStyle=wall;c.fill();
    c.fillStyle='#586c6c';c.beginPath();c.ellipse(0,28,43,19,0,0,Math.PI*2);c.fill();
    // The dark inner wall makes the depth and the waterline readable even
    // against snow or a dark dashboard.
    c.save();c.clip();
    const level=31+(100-cup.water)*.16;
    const x=Math.max(-1.4,Math.min(1.4,cup.x)), y=Math.max(-1.3,Math.min(1.3,cup.y));
    c.translate(0,level+y*5);c.rotate(-x*.27);
    const water=c.createLinearGradient(0,-13,0,14);
    water.addColorStop(0,'#5f9296');water.addColorStop(.6,'#acd9d2');water.addColorStop(1,'#e6f4dc');
    c.beginPath();c.ellipse(0,0,41,Math.max(6,14-y*4),0,0,Math.PI*2);c.fillStyle=water;c.fill();
    c.strokeStyle='#d9fff1';c.lineWidth=1.8;c.stroke();
    c.beginPath();c.ellipse(-4,0,28,7,0,Math.PI*1.13,Math.PI*1.77);c.strokeStyle='#f1fff197';c.stroke();
    c.restore();
    c.beginPath();c.ellipse(0,28,43,19,0,0,Math.PI*2);c.strokeStyle='#eeeadd';c.lineWidth=3;c.stroke();
    c.restore();
  }
  window.TougeRunVisuals=RunVisuals;
  window.drawTougeCup=drawCup;
})();
