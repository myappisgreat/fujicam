const { chromium } = require('playwright');
const http=require('node:http'), fs=require('node:fs'), path=require('node:path');
const server=http.createServer((req,res)=>{const name=decodeURIComponent(req.url.split('?')[0]);const file=path.resolve('.'+(name==='/'?'/index.html':name));if(!file.startsWith(process.cwd()+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}const ext=path.extname(file);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml'})[ext]||'text/plain');res.end(data);});});
(async()=>{
 await new Promise(resolve=>server.listen(4187,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'chrome',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
 const context=await browser.newContext({viewport:{width:390,height:844},permissions:['camera'],serviceWorkers:'allow'});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4187');await page.waitForSelector('.film.active');await page.screenshot({path:'tests/mobile.png',fullPage:true});
 await page.click('#start');await page.waitForFunction(()=>document.querySelector('#mode').textContent==='LIVE');
 await page.click('[data-id="ETERNA-BB"]');await page.waitForFunction(()=>document.querySelector('[data-id="ETERNA-BB"]').classList.contains('active'));
 await page.locator('#ev').fill('0.5');await page.locator('#ev').dispatchEvent('input');await page.click('#shutter');await page.waitForSelector('#result[open]');
 await page.waitForFunction(()=>document.querySelector('#photo').naturalWidth>0);
 const photo=await page.evaluate(()=>({w:document.querySelector('#photo').naturalWidth,h:document.querySelector('#photo').naturalHeight}));
 const pixels=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=20;c.height=20;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('#photo'),0,0,20,20);return new Set(ctx.getImageData(0,0,20,20).data).size;});
 if(pixels<10)throw Error('Blank render');await page.screenshot({path:'tests/capture.png',fullPage:true});
 await page.click('#close-result');await page.click('#flip');await page.waitForFunction(()=>!document.querySelector('#shutter').disabled);
 await page.setInputFiles('#file','assets/icon-512.png');await page.waitForFunction(()=>document.querySelector('#mode').textContent==='PHOTO');
 await page.click('[data-id="MONO"]');await page.waitForFunction(()=>document.querySelector('[data-id="MONO"]').classList.contains('active'));
 await page.click('#shutter');await page.waitForSelector('#result[open]');await page.waitForFunction(()=>document.querySelector('#photo').naturalHeight===512);
 const monochrome=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=10;c.height=10;const ctx=c.getContext('2d');ctx.drawImage(document.querySelector('#photo'),0,0,10,10);const d=ctx.getImageData(0,0,10,10).data;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-d[i+1])>2||Math.abs(d[i+1]-d[i+2])>2)return false;return true;});
 if(!monochrome)throw Error('Mono not monochrome');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
 await context.setOffline(true);await page.reload();await page.waitForSelector('.film.active');await page.click('[data-id="WDR"]');await page.waitForFunction(()=>document.querySelector('[data-id="WDR"]').classList.contains('active'));
 await context.setOffline(false);await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'tests/desktop.png',fullPage:true});
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({passed:true,photo,pixelValues:pixels,monochrome,offline:true,errors}));await browser.close();server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});



