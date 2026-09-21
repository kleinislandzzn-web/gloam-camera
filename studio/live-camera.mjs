import {Renderer,Assets} from './renderer.mjs?v=20260921-live-lite-2';
import {prepareFinish,finishImage,resolveDateSettings} from './finish.mjs?v=20260921-live-lite-2';

export function cameraError(error){
 const messages={NotAllowedError:'摄像头权限未允许。请在浏览器的网站设置里允许摄像头，再点击开启。',NotFoundError:'没有找到可用摄像头。',NotReadableError:'摄像头暂时无法使用，可能正被其他应用占用。',OverconstrainedError:'设备不支持请求的拍摄规格，请重试或换一个镜头。',SecurityError:'浏览器阻止了摄像头访问，请使用受信任的 HTTPS 页面。'};
 return messages[error?.name]||error?.message||'摄像头启动失败，请重试。';
}
export class LiveCamera {
 constructor({manifest,video,canvas,getPreset,getSettings,onStatus=()=>{},onState=()=>{},onMetrics=()=>{},mediaDevices=navigator.mediaDevices,secure=window.isSecureContext}){
  Object.assign(this,{video,canvas,getPreset,getSettings,onStatus,onState,onMetrics,mediaDevices,secure});
  this.assets=new Assets(manifest);this.epoch=0;this.preparation=0;this.frameId=0;this.running=false;this.starting=false;this.facing='environment';this.mirror=false;this.previewMode='color';this.previewSize=720;this.lastFrame=0;this.drawTime=0;this.autoSize=360;this.metricsFrames=0;this.metricsStart=0;this.qualityChanged=0;this.capturing=false;
  video.muted=true;video.playsInline=true;
 }
 state(){this.onState({running:this.running,starting:this.starting,preparing:!!this.preparing,capturing:this.capturing});}
 stop(message='摄像头已关闭。'){
  ++this.epoch;++this.preparation;cancelAnimationFrame(this.frameId);this.frameId=0;this.running=false;this.starting=false;this.preparing=false;
  if(this.stream)for(const track of this.stream.getTracks()){track.onended=null;track.stop();}
  this.stream=null;this.video.pause();this.video.srcObject=null;this.prepared=null;this.state();if(message)this.onStatus(message);
 }
 async start(facing=this.facing){
  this.stop('');this.facing=facing;
  if(!this.secure||!this.mediaDevices?.getUserMedia){this.onStatus('此地址不能调用实时摄像头。手机请使用受信任的 HTTPS 地址；电脑可使用 localhost。当前局域网 HTTP 链接仅能试片。');return false;}
  const epoch=this.epoch;this.starting=true;this.state();this.onStatus('等待摄像头授权…');
  try{
   if(!this.renderer){this.renderer=new Renderer(document.createElement('canvas'));this.renderer.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.stop('图像处理资源不足，镜头已停止。请刷新页面后使用自动省电。');this.renderer=null;});}
   const stream=await this.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:facing},width:{ideal:1920},height:{ideal:1080},frameRate:{ideal:15,max:24}}});
   if(epoch!==this.epoch){stream.getTracks().forEach(t=>t.stop());return false;}
   this.stream=stream;this.video.srcObject=stream;
   for(const track of stream.getVideoTracks())track.onended=()=>{if(epoch===this.epoch)this.stop('摄像头连接已结束，请重新开启。');};
   await this.video.play();await prepareFinish();if(epoch!==this.epoch)return false;
   this.starting=false;this.running=true;this.lastFrame=0;this.drawTime=0;this.autoSize=360;this.metricsFrames=0;this.metricsStart=performance.now();this.qualityChanged=this.metricsStart;this.state();
   await this.refresh();if(epoch!==this.epoch)return false;
   this.onStatus('镜头已开启。省电模式预览颜色，拍照执行完整效果。');this.schedule();return true;
  }catch(error){if(epoch!==this.epoch)return false;this.stop(cameraError(error));return false;}
 }
 async refresh(){
  if(!this.running)return;const epoch=this.epoch,id=++this.preparation;this.preparing=true;this.state();
  const preset=this.getPreset(),settings={...this.getSettings(),collageLayout:'none'};
  try{const prepared=await this.assets.prepare(preset,settings.node,settings.kelvin);if(epoch!==this.epoch||id!==this.preparation)return;
   this.snapshot={preset,settings};this.prepared=prepared;this.preparing=false;this.state();
  }catch(error){if(epoch===this.epoch&&id===this.preparation)this.stop('滤镜加载失败：'+error.message);}
 }
 schedule(){
  cancelAnimationFrame(this.frameId);if(!this.running)return;
  this.frameId=requestAnimationFrame(time=>{if(!this.running)return;
   try{if(!this.capturing&&time-this.lastFrame>=Math.max(1000/15,this.drawTime*1.25)){this.lastFrame=time;const begin=performance.now();this.draw();const elapsed=performance.now()-begin;this.drawTime=this.drawTime?this.drawTime*.8+elapsed*.2:elapsed;this.metrics();}this.schedule();}
   catch(error){this.stop('预览停止：'+error.message);}
  });
 }
 metrics(){
  const now=performance.now();this.metricsFrames++;const elapsed=now-this.metricsStart;
  if(elapsed>=1000){this.onMetrics({width:this.canvas.width,height:this.canvas.height,fps:this.metricsFrames*1000/elapsed,sourceWidth:this.video.videoWidth,sourceHeight:this.video.videoHeight,drawMs:this.drawTime});this.metricsStart=now;this.metricsFrames=0;}
  // Hysteresis prevents allocating new framebuffers every other frame on slow phones.
  if(this.previewSize===0&&now-this.qualityChanged>3000){
   if(this.drawTime>90&&this.autoSize>240){this.autoSize=this.autoSize>480?480:this.autoSize>360?360:240;this.qualityChanged=now;}
   // Do not silently increase workload after a short fast interval on mobile.
  }
 }
 dimensions(limit){const w=this.video.videoWidth,h=this.video.videoHeight;if(!w||!h)return null;const scale=Math.min(1,limit/Math.max(w,h));return [Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))];}
 source(width,height,freeze=false){
  const c=freeze?document.createElement('canvas'):(this.mirrorCanvas??=document.createElement('canvas'));if(c.width!==width)c.width=width;if(c.height!==height)c.height=height;const g=c.getContext('2d');g.setTransform(1,0,0,1,0,0);
  if(this.mirror){g.translate(width,0);g.scale(-1,1);}g.drawImage(this.video,0,0,width,height);return c;
 }
 draw(){
  if(!this.prepared||this.video.readyState<2)return;
  const max=this.previewSize===0?this.autoSize:this.previewSize,dim=this.dimensions(max);if(!dim)return;
  this.renderer.lastImages.source=null;
  this.renderer.render(this.source(...dim),this.prepared,this.snapshot.settings,...dim,[this.video.videoWidth,this.video.videoHeight],{colorPreview:this.previewMode==='color'});
  finishImage(this.renderer.canvas,this.snapshot.settings,this.canvas);
  this.canvas.dataset.frames=String(Number(this.canvas.dataset.frames||0)+1);this.canvas.dataset.preset=this.snapshot.preset.id;this.canvas.dataset.recipe=this.snapshot.settings.r51Profile||'default';this.canvas.dataset.previewMode=this.previewMode;
 }
 async capture(){
  if(!this.running||this.preparing||this.capturing||!this.prepared||this.video.readyState<2)throw Error('请先开启摄像头，等待预览就绪。');
  const dim=this.dimensions(Math.min(2600,this.renderer.maxSize));if(!dim)throw Error('摄像头尚未提供画面。');
  this.capturing=true;this.state();const epoch=this.epoch;
  try{const {preset,settings}=this.snapshot,s=resolveDateSettings(settings),source=this.source(...dim,true);
  this.renderer.lastImages.source=null;this.renderer.render(source,this.prepared,s,...dim,[this.video.videoWidth,this.video.videoHeight]);
  const output=finishImage(this.renderer.canvas,s),width=output.width,height=output.height;
  const blob=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('无法生成照片，请降低画幅后重试。')),'image/png'));
  if(epoch!==this.epoch)return null;
  return {blob,width,height,preset:preset.id,settings:s};
  }finally{this.capturing=false;if(epoch===this.epoch)this.state();}
 }
}
