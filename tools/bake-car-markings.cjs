// Bake the car's canvas artwork on a machine with Japanese fonts installed.
'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('playwright');
const sharp=require('sharp');

async function bake() {
  const dist=path.join(__dirname,'../dist');
  const output=process.argv[2]||path.join(dist,'assets/art/neo86-markings.webp');
  const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||undefined});
  try {
    const page=await browser.newPage({offline:true});
    for(const script of ['vendor/three.min.js','js/car.js'])await page.addScriptTag({path:path.join(dist,script)});
    const png=await page.evaluate(()=>TougeNeo86.drawMarkings().image.toDataURL('image/png').split(',')[1]);
    const webp=await sharp(Buffer.from(png,'base64')).webp({lossless:true,effort:6}).toBuffer();
    const temp=output+'.'+process.pid+'.tmp';
    await fs.writeFile(temp,webp);await fs.rename(temp,output);
    console.log('Wrote '+webp.length+' bytes to '+output);
  } finally {await browser.close();}
}
bake().catch(error=>{console.error(error);process.exitCode=1;});
