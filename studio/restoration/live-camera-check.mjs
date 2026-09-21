import {LiveCamera} from '../live-camera.mjs?v=20260921-live-lite-2';
import {Renderer} from '../renderer.mjs?v=20260921-live-lite-2';
import {finishImage} from '../finish.mjs?v=20260921-live-lite-2';
import {r51Settings} from '../r51-profiles.mjs?v=20260921-live-lite-2';
import {defaultFilmSettings} from '../film-settings.mjs?v=20260921-live-lite-2';
const results=[],check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(name);};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const until=async fn=>{for(let i=0;i<150;i++){if(fn())return;await sleep(100);}throw Error('Timed out');};
const feed=document.querySelector('#feed'),g=feed.getContext('2d'),video=document.querySelector('#video'),canvas=document.querySelector('#output');
let color=0,session;
function paint(){g.fillStyle=color?'#08d633':'#d62208';g.fillRect(0,0,160,240);g.fillStyle='#103ce1';g.fillRect(160,0,160,240);g.fillStyle='#eee';g.fillRect(100,60,80,80);}
paint();const timer=setInterval(paint,50);
try{
 const manifest=await(await fetch('../manifest.json')).json(),films=manifest.presets.filter(p=>p.group==='main'&&p.available);let preset=films[0],settings=defaultFilmSettings(preset),attempts=0,lastStatus='',constraints;
 const options={manifest,video,canvas,getPreset:()=>preset,getSettings:()=>settings,onStatus:s=>lastStatus=s,secure:true};
 session=new LiveCamera({...options,secure:false,mediaDevices:{getUserMedia:()=>{attempts++;}}});
 check('HTTP denied before requesting hardware',!await session.start()&&attempts===0&&lastStatus.includes('HTTPS'));
 session.secure=true;session.mediaDevices={getUserMedia:async()=>{throw new DOMException('Denied','NotAllowedError');}};
 check('Permission denial clears state',!await session.start()&&!session.running&&!session.starting&&lastStatus.includes('权限'));
 let resolveLate;session.mediaDevices={getUserMedia:()=>new Promise(r=>resolveLate=r)};
 const pending=session.start();session.stop();const late=feed.captureStream(15);resolveLate(late);
 check('Stop while permission pending ends late stream',!await pending&&late.getTracks().every(t=>t.readyState==='ended'));
 const streams=[];session.mediaDevices={getUserMedia:async c=>{constraints=c;const s=feed.captureStream(15);streams.push(s);return s;}};
 session.previewMode='full';check('Synthetic stream starts',await session.start());
 await until(()=>Number(canvas.dataset.frames)>2);
 check('Video only, no microphone',constraints.audio===false&&constraints.video.facingMode.ideal==='environment');
 const pixels=()=>Array.from(canvas.getContext('2d').getImageData(20,20,1,1).data);
 const before=pixels();color=1;await sleep(400);session.draw();const after=pixels();
 check('Live texture updates each frame',before.some((v,i)=>v!==after[i]),{before,after});
 const verified=[];
 for(const p of films){preset=p;settings=defaultFilmSettings(p);await session.refresh();session.draw();check('Preset '+p.id,session.running&&canvas.dataset.preset===p.id);verified.push(p.id);}
 check('All 31 main presets render',verified.length===31);
 const copyPixels=source=>{const c=document.createElement('canvas');c.width=source.width;c.height=source.height;const x=c.getContext('2d');x.drawImage(source,0,0);return x.getImageData(0,0,c.width,c.height).data;};
 const equal=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
 const offline=new Renderer(document.createElement('canvas'));
 for(const [id,mode] of [['CCD2008_STD','noflash'],['CCD2008_STD','flash'],['T3_5219','noflash']]){
  preset=films.find(p=>p.id===id);settings={...defaultFilmSettings(preset),...(id==='CCD2008_STD'?r51Settings(mode):{})};await session.refresh();session.draw();
  const live=copyPixels(canvas),frozen=session.source(320,240,true);offline.lastImages.source=null;offline.render(frozen,session.prepared,settings,320,240,[320,240]);const expected=copyPixels(finishImage(offline.canvas,settings));
  check(id+' '+mode+' preview equals static renderer',equal(live,expected));
  const pendingShot=session.capture();check(id+' pauses during capture',session.capturing);const captured=await pendingShot;check(id+' resumes after capture',!session.capturing);
  const bitmap=await createImageBitmap(captured.blob),c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
  check(id+' '+mode+' saved PNG equals static renderer',equal(copyPixels(c),expected));
 }
 preset=films.find(p=>p.id==='CCD2008_STD');settings=defaultFilmSettings(preset);await session.refresh();session.previewMode='color';
 let fastPasses=0;const originalPass=session.renderer.pass.bind(session.renderer);session.renderer.pass=(...args)=>{fastPasses++;return originalPass(...args)};session.draw();session.renderer.pass=originalPass;
 check('Color preview uses one GPU pass',fastPasses===1,fastPasses);
 check('Upload source is preview-sized',session.renderer.lastImages.source.width===320&&session.renderer.lastImages.source.height===240);
 const cheapPreview=copyPixels(canvas),cheapShot=await session.capture(),bitmap=await createImageBitmap(cheapShot.blob),shotCanvas=document.createElement('canvas');shotCanvas.width=bitmap.width;shotCanvas.height=bitmap.height;shotCanvas.getContext('2d').drawImage(bitmap,0,0);bitmap.close();
 const frozenSource=session.source(320,240,true);offline.lastImages.source=null;offline.render(frozenSource,session.prepared,settings,320,240,[320,240]);const fullPixels=copyPixels(finishImage(offline.canvas,settings));
 check('Color mode still captures full recipe',equal(copyPixels(shotCanvas),fullPixels));check('Color preview is explicitly reduced',!equal(cheapPreview,fullPixels));session.previewMode='full';
 session.previewSize=0;session.autoSize=720;session.drawTime=100;session.qualityChanged=performance.now()-4000;session.metrics();check('Slow automatic preview steps down',session.autoSize===480);
 const previousSize=session.autoSize;session.metrics();check('Adaptive quality has hysteresis',session.autoSize===previousSize);

 settings={...settings,amount:0};await session.refresh();session.mirror=false;session.draw();const left=pixels();session.mirror=true;session.draw();const mirrored=pixels();
 check('Mirror flips camera input',left[1]>left[2]&&mirrored[2]>mirrored[1],{left,mirrored});
 const shot=await session.capture();check('PNG capture created',shot.blob.type==='image/png'&&shot.blob.size>100&&shot.width===320&&shot.height===240,{size:shot.blob.size,width:shot.width,height:shot.height});
 const image=new Image(),url=URL.createObjectURL(shot.blob);image.src=url;await image.decode();check('PNG decodes',image.naturalWidth===shot.width);URL.revokeObjectURL(url);
 const prep=session.refresh();let blocked=false;try{await session.capture();}catch{blocked=true;}await prep;check('Shutter blocked while preparing filter',blocked);
 session.stop();const frameCount=canvas.dataset.frames;await sleep(200);check('Stop ends stream and rendering',streams.every(s=>s.getTracks().every(t=>t.readyState==='ended'))&&canvas.dataset.frames===frameCount&&video.srcObject===null);
 const deferred=[];session.mediaDevices={getUserMedia:()=>new Promise(r=>deferred.push(r))};
 const first=session.start('environment'),second=session.start('user'),winner=feed.captureStream(15);deferred[1](winner);check('Latest start succeeds',await second);const stale=feed.captureStream(15);deferred[0](stale);check('Stale start cannot replace active stream',!await first&&session.stream===winner&&stale.getTracks().every(t=>t.readyState==='ended'));
 session.stop();check('Final stream released',winner.getTracks().every(t=>t.readyState==='ended'));
 document.querySelector('#result').textContent=JSON.stringify({status:'PASS',checks:results.length,results},null,2);
}catch(error){document.querySelector('#result').textContent=JSON.stringify({status:'FAIL',error:error.stack,results},null,2);}
finally{clearInterval(timer);session?.stop();}
