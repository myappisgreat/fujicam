import { parseCube } from './lut.js';
const $ = id => document.getElementById(id);
const canvas = $('preview'), video = $('video');
const films = [
  { id:'ETERNA', name:'ETERNA', subtitle:'柔和電影感', number:'01' },
  { id:'ETERNA-BB', name:'BLEACH BYPASS', subtitle:'低彩・高反差', number:'02' },
  { id:'WDR', name:'WIDE DYNAMIC', subtitle:'自然・柔亮', number:'03' },
  { id:'MONO', name:'MONO', subtitle:'經典黑白', number:'04' }
];
let selected = 'ETERNA', stream, source, facing = 'environment', busy = false, switching = false;
let resultBlob, resultUrl, frame = 0, cameraEpoch = 0;
const lutCache = new Map();
const status = text => { $('status').textContent = text; };
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer:true, alpha:false });
let program, imageTexture, lutTexture, uniforms;
const vs = `#version 300 es
in vec2 position; out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fs = `#version 300 es
precision highp float; precision highp sampler3D;
in vec2 uv; out vec4 color;
uniform sampler2D image; uniform sampler3D lut;
uniform float size, exposure, grain, temperature, tint; uniform vec2 crop, resolution;
uniform bool mono, mirror;
vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 flog(vec3 c){return mix(8.735631*c+.092864,.344676*log(max(.555556*c+.009468,vec3(.000001)))/log(10.)+.790453,step(vec3(.00089),c));}
void main(){
 vec2 p=(uv-.5)*crop+.5; if(mirror)p.x=1.-p.x;
 vec3 rgb=texture(image,p).rgb;
 vec3 lin=linearize(rgb)*exp2(exposure);
 // Relative creative white balance; 0 is neutral, not a Kelvin measurement.
 vec3 balance=exp2(vec3(.5*temperature+.2*tint,-.35*tint,-.5*temperature+.2*tint));
 lin*=balance;
 // Linear sRGB / BT.709 -> BT.2020 (F-Gamut primaries).
 vec3 wide=mat3(.627404,.069097,.016391,.329283,.919540,.088013,.043313,.011362,.895595)*lin;
 vec3 pos=clamp(flog(wide),0.,1.);
 vec3 styled=texture(lut,(pos*(size-1.)+.5)/size).rgb;
 if(mono){float l=dot(styled,vec3(.2126,.7152,.0722));styled=vec3(l);}
 float noise=fract(sin(dot(floor(uv*resolution),vec2(12.9898,78.233)))*43758.5453)-.5;
 float vignette=1.-.16*smoothstep(.2,.72,length(uv-.5));
 color=vec4(clamp(styled*vignette+noise*grain,0.,1.),1.);
}`;
function shader(type, code) {
 const s=gl.createShader(type); gl.shaderSource(s,code); gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s;
}
function setup() {
 if(!gl) throw new Error('此瀏覽器不支援 WebGL 2，請使用新版 Safari 或 Chrome。');
 program=gl.createProgram(); gl.attachShader(program,shader(gl.VERTEX_SHADER,vs)); gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('無法啟動影像處理');
 gl.useProgram(program);
 const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
 uniforms=Object.fromEntries(['image','lut','size','exposure','grain','temperature','tint','crop','resolution','mono','mirror'].map(key=>[key,gl.getUniformLocation(program,key)]));
 imageTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,imageTexture);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 lutTexture=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,lutTexture);
 for(const param of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T,gl.TEXTURE_WRAP_R])gl.texParameteri(gl.TEXTURE_3D,param,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_3D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.uniform1i(uniforms.image,0);gl.uniform1i(uniforms.lut,1);
}
async function loadLut(id) {
 const key=id==='MONO'?'ETERNA':id;
 if(!lutCache.has(key)) {
  const response=await fetch(`./assets/luts/${key}.cube`);if(!response.ok)throw new Error('無法載入底片，請連線後重試。');
  lutCache.set(key,parseCube(await response.text()));
 }
 return lutCache.get(key);
}
let filmEpoch=0;
async function selectFilm(id) {
 const epoch=++filmEpoch;
 try{
  const lut=await loadLut(id);if(epoch!==filmEpoch)return;
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_3D,lutTexture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage3D(gl.TEXTURE_3D,0,gl.RGBA8,lut.size,lut.size,lut.size,0,gl.RGBA,gl.UNSIGNED_BYTE,lut.data);
  gl.uniform1f(uniforms.size,lut.size);selected=id;
  document.querySelectorAll('.film').forEach(b=>{const active=b.dataset.id===id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  const film=films.find(f=>f.id===id);$('film-label').textContent=`${film.name} / ${film.number}`;
  if(source)render();
 }catch(error){status(error.message);}
}
function dimensions(){return source===video?[video.videoWidth,video.videoHeight]:[source?.naturalWidth,source?.naturalHeight];}
function render(exporting=false) {
 if(!source || !gl || gl.isContextLost())return;
 const [sw,sh]=dimensions();if(!sw||!sh)return;
 const rect=canvas.getBoundingClientRect(), aspect=rect.width/rect.height;
 const scale=exporting?Math.min(2400,2400*aspect,sw,sh*aspect):Math.min(960,Math.round(rect.width*Math.min(devicePixelRatio,2)));
 canvas.width=Math.round(scale);canvas.height=Math.round(scale/aspect);
 gl.viewport(0,0,canvas.width,canvas.height);
 gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,imageTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 gl.uniform2f(uniforms.crop,Math.min(1,aspect/(sw/sh)),Math.min(1,(sw/sh)/aspect));
 gl.uniform1f(uniforms.exposure,Number($('ev').value));gl.uniform1f(uniforms.grain,Number($('grain').value)/500);
 gl.uniform1f(uniforms.temperature,Number($('temperature').value)/100);gl.uniform1f(uniforms.tint,Number($('tint').value)/100);
 gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform1i(uniforms.mono,selected==='MONO');
 gl.uniform1i(uniforms.mirror,source===video&&facing==='user');gl.drawArrays(gl.TRIANGLES,0,6);
}
let lastTime=0;
function animate(time){if(time-lastTime>40){render();lastTime=time;}if(stream&&!document.hidden&&!busy)frame=requestAnimationFrame(animate);}
function stopCamera(){cameraEpoch++;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());stream=null;video.srcObject=null;}
async function startCamera() {
 if(switching)return;switching=true;stopCamera();const epoch=cameraEpoch;
 source=null;$('shutter').disabled=true;status('正在開啟相機…');
 try {
  if(!gl)throw new Error('此瀏覽器不支援 WebGL 2。');
  if(!window.isSecureContext)throw new Error('相機需要 HTTPS 網址；本機開發可使用 localhost。');
  if(!navigator.mediaDevices?.getUserMedia)throw new Error('此瀏覽器無法使用相機，請用 Safari 或 Chrome。');
  const next=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1440}}});
  if(epoch!==cameraEpoch){next.getTracks().forEach(t=>t.stop());return;}
  stream=next;video.srcObject=stream;await video.play();source=video;
  $('welcome').hidden=true;$('mode').textContent='LIVE';$('shutter').disabled=false;$('flip').disabled=false;status('留住眼前的光。');
  frame=requestAnimationFrame(animate);
 }catch(error){$('welcome').hidden=false;status(error.name==='NotAllowedError'?'相機權限尚未開啟。請允許相機，或匯入照片。':error.name==='NotFoundError'?'找不到相機，可以匯入照片試拍。':error.message);}
 finally{switching=false;}
}
for(const film of films){const button=document.createElement('button');button.className='film';button.dataset.id=film.id;button.setAttribute('aria-pressed','false');button.innerHTML=`<span class="swatch"></span><b>${film.name}</b><small>${film.subtitle}</small>`;button.onclick=()=>selectFilm(film.id);$('films').append(button);}
$('start').onclick=startCamera;
$('flip').onclick=()=>{if(source!==video){startCamera();return;}facing=facing==='environment'?'user':'environment';startCamera();};
for(const id of ['import','import-welcome'])$(id).onclick=()=>$('file').click();
let importEpoch=0;
$('file').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;const epoch=++importEpoch;
 const url=URL.createObjectURL(file);const image=new Image();
 try{image.src=url;await image.decode();if(epoch!==importEpoch)return;stopCamera();source=image;$('welcome').hidden=true;$('mode').textContent='PHOTO';$('shutter').disabled=false;render();status('照片已載入，調整底片後按快門儲存。');}
 catch{status('無法讀取照片，請使用 JPEG、PNG 或 WebP。');}finally{URL.revokeObjectURL(url);event.target.value='';}
};
for(const id of ['ev','grain','temperature','tint'])$(id).oninput=()=>{
 const value=Number($(id).value);
 $(`${id}-value`).value=id==='ev'?value.toFixed(1):id==='grain'?String(value):`${value>0?'+':''}${value}`;
 if(source!==video)render();
};
$('shutter').onclick=async()=>{
 if(!source||busy)return;busy=true;$('shutter').disabled=true;cancelAnimationFrame(frame);
 try{render(true);$('flash').classList.remove('fire');void $('flash').offsetWidth;$('flash').classList.add('fire');
 resultBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.95));if(!resultBlob)throw new Error('照片輸出失敗，請重試。');
 if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(resultBlob);$('photo').src=resultUrl;$('download').href=resultUrl;
 $('download').download=`fuji-room-${selected.toLowerCase()}-${Date.now()}.jpg`;
 const shareFile=new File([resultBlob],'fuji-room.jpg',{type:'image/jpeg'});$('share').hidden=!navigator.canShare?.({files:[shareFile]});$('result').showModal();status('已沖洗完成。');
 }catch(error){status(error.message);}finally{busy=false;$('shutter').disabled=!source;render();if(stream)frame=requestAnimationFrame(animate);}
};
$('share').onclick=async()=>{try{await navigator.share({files:[new File([resultBlob],'fuji-room.jpg',{type:'image/jpeg'})]});}catch(error){if(error.name!=='AbortError')status('分享失敗，請改用儲存照片。');}};
$('close-result').onclick=()=>$('result').close();$('help').onclick=()=>$('info').showModal();$('close-info').onclick=()=>$('info').close();
window.addEventListener('resize',()=>{ $('frame-size').textContent=innerWidth>=700?'4:3':'1:1';if(source!==video)render();});$('frame-size').textContent=innerWidth>=700?'4:3':'1:1';
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(frame);if(!document.hidden&&stream&&!busy)frame=requestAnimationFrame(animate);});
window.addEventListener('pagehide',stopCamera);
canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();stopCamera();source=null;$('shutter').disabled=true;status('影像處理已中斷，請重新整理頁面。');});
let deferredInstall;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstall=event;$('install').hidden=false;});
$('install').onclick=async()=>{if(deferredInstall){await deferredInstall.prompt();deferredInstall=null;$('install').hidden=true;}};
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>status('離線快取尚未完成，仍可在線使用。'));
try{setup();await selectFilm('ETERNA');}catch(error){status(error.message);$('start').disabled=true;}
