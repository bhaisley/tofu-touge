// With dist served locally, run: node tools/bake-reflections.cjs <local game URL> [haruna|fuji]
// Requires Playwright. CHROME_BIN can select an installed Chromium-based browser.
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require('playwright');

async function bake() {
  const source = process.argv[2] || 'http://127.0.0.1:8477/';
  const map = process.argv[3] || 'haruna';
  if (!['haruna', 'fuji'].includes(map)) throw Error('Choose haruna or fuji.');
  const filename = map + '-reflections.webp';
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_BIN || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    // Car materials are outside the capture. A first bake can start with an empty asset directory entry.
    await page.route('**/game.js', route => route.fulfill({contentType: 'text/javascript', body: ''}));
    await page.route('**/' + filename, route => route.fulfill({contentType: 'image/png',
      body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')}));
    await page.goto(source);
    const report = await page.evaluate(async map => {
      const T = THREE;
      const ready = new Promise((resolve, reject) => {
        T.DefaultLoadingManager.onLoad = resolve; T.DefaultLoadingManager.onError = url => reject(Error('Image failed: ' + url));
      });
      const course = new TougeCourse(map);
      const world = new TougeWorld(document.createElement('canvas'), course);
      await ready;
      const {renderer, scene, sky} = world;
      world.rig.visible = false;
      for (const patch of world.groundPatches) patch.mesh.visible = false;
      const grid = TougePassReflections.layout(course.length);
      const cube = new T.WebGLCubeRenderTarget(128, {type: T.HalfFloatType, minFilter: T.LinearFilter});
      const eye = new T.CubeCamera(.12, 2350, cube);
      const streetView = new T.PerspectiveCamera(76, 1, .2, 2350);
      const image = new T.WebGLRenderTarget(grid.size * 2, grid.size, {depthBuffer: false, type: T.UnsignedByteType});
      const stage = new T.Scene(), ortho = new T.OrthographicCamera(-1,1,1,-1,0,1);
      const shader = new T.ShaderMaterial({
        uniforms: {env: {value: cube.texture}}, depthTest: false, depthWrite: false, toneMapped: false,
        vertexShader: 'varying vec2 local; void main(){local=uv; gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader: `varying vec2 local; uniform samplerCube env;
          void main(){
            float soft=step(.5,local.x);
            vec2 st=vec2(fract(local.x*2.),local.y);
            vec2 uv=clamp((st*${grid.size}.-${grid.border}.5)/${grid.size-2*grid.border-1}.,0.,1.)*2.-1.;
            vec3 d=vec3(uv,1.-abs(uv.x)-abs(uv.y));
            if(d.z<0.) d.xy=(1.-abs(d.yx))*vec2(d.x<0.?-1.:1.,d.y<0.?-1.:1.);
            d=normalize(d);
            vec3 color=textureCube(env,d).rgb;
            if(soft>.5){
              vec3 a=normalize(cross(abs(d.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.),d));
              vec3 b=cross(d,a);
              color*=2.;
              for(int i=0;i<24;i++){
                float k=float(i)+.5, angle=k*2.399963, radius=.32*sqrt(k/24.);
                color+=textureCube(env,normalize(d+radius*(a*cos(angle)+b*sin(angle)))).rgb;
              }
              color/=26.;
            }
            gl_FragColor=vec4(clamp(log2(1.+max(vec3(0.),color))/3.169925,0.,1.),1.);
          }`
      });
      stage.add(new T.Mesh(new T.PlaneGeometry(2,2),shader));
      const canvas = document.createElement('canvas');
      canvas.width = grid.columns * grid.size; canvas.height = 2 * grid.rows * grid.size;
      const ctx = canvas.getContext('2d', {alpha: false});
      const pixels = new Uint8Array(grid.size * grid.size * 8);
      const sharp = ctx.createImageData(grid.size,grid.size), soft = ctx.createImageData(grid.size,grid.size);
      const stride = grid.size * 4;
      renderer.shadowMap.autoUpdate = false;
      for (let i=0; i<grid.count; i++) {
        const p=course.sample(i*grid.spacing);
        eye.position.set(p.x,p.y+1.3,p.z); sky.position.copy(eye.position);
        world.forest.userData.update(eye.position);
        TougeLighting.trackSun(world.sun,p.x,p.y,p.z,p.fx,p.fz);
        renderer.setRenderTarget(null);
        streetView.position.copy(eye.position);
        streetView.lookAt(p.x+p.fx*20,p.y+1.3+p.grade*20,p.z+p.fz*20);
        world.roadside.userData.updateView(renderer,streetView,i);
        renderer.shadowMap.needsUpdate = true;
        eye.update(renderer,scene);
        renderer.setRenderTarget(image); renderer.render(stage,ortho);
        renderer.readRenderTargetPixels(image,0,0,grid.size*2,grid.size,pixels);
        const x=(i%grid.columns)*grid.size, y=Math.floor(i/grid.columns)*grid.size;
        for(let row=0;row<grid.size;row++) {
          const from=row*2*stride;
          sharp.data.set(pixels.subarray(from,from+stride),row*stride);
          soft.data.set(pixels.subarray(from+stride,from+2*stride),row*stride);
        }
        ctx.putImageData(sharp,x,y); ctx.putImageData(soft,x,y+grid.rows*grid.size);
        if(i%8===7)await new Promise(requestAnimationFrame);
      }
      return {count:grid.count,spacing:grid.spacing,data:canvas.toDataURL('image/webp',.94)};
    }, map);
    if (errors.length) throw Error(errors.join('\n'));
    const output = path.join(__dirname, '../dist/assets/art', filename);
    await fs.writeFile(output,Buffer.from(report.data.split(',')[1],'base64'));
    console.log('Baked %d stations at %s m spacing into %s',report.count,report.spacing.toFixed(1),output);
  } finally { await browser.close(); }
}
bake().catch(error=>{console.error(error);process.exitCode=1;});
