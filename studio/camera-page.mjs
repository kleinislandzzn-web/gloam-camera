import {LiveCamera} from './live-camera.mjs';
import {readFilmSettings,saveFilmSettings} from './film-settings.mjs';
const $=id=>document.getElementById(id);
let session,preset,settings,photoURL,photoFile,shooting=false,ready=false;
const status=text=>$('camera-status').textContent=text;
function state(){const live=!!session?.running,pending=!!session?.starting;$('camera-start').disabled=!ready||pending||live||!session?.secure||!session?.mediaDevices?.getUserMedia;$('camera-start').textContent=pending?'等待授权…':'开启摄像头';$('camera-stop').disabled=!live&&!pending;$('camera-flip').disabled=pending||shooting||!session?.secure;$('camera-shutter').disabled=!live||shooting||!!session?.preparing;$('camera-placeholder').hidden=live;$('live-label').hidden=!live;}
function selection(){settings=readFilmSettings(preset);$('camera-amount').value=Math.round(settings.amount*100);$('camera-amount-value').textContent=$('camera-amount').value+'%';$('camera-edit').href='editor.html?preset='+encodeURIComponent(preset.id);session?.refresh();}
function releasePhoto(){if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;photoFile=null;$('camera-shot').hidden=true;$('camera-shot-image').removeAttribute('src');$('camera-download').removeAttribute('href');}
async function init(){try{
 const response=await fetch(new URL('manifest.json',import.meta.url));if(!response.ok)throw Error('胶片清单加载失败');const data=await response.json(),films=data.presets.filter(p=>p.group==='main'&&p.available);
 const selected=new URLSearchParams(location.search).get('preset');preset=films.find(p=>p.id===selected)||films[0];
 session=new LiveCamera({manifest:data,video:$('camera-source'),canvas:$('camera-result'),getPreset:()=>preset,getSettings:()=>settings,onStatus:status,onState:state});session.previewSize=0;
 for(const family of new Set(films.map(p=>p.family)))$('camera-family').append(new Option(family,family));
 function filmList(){const siblings=films.filter(p=>p.family===$('camera-family').value);$('camera-film').replaceChildren(...siblings.map(p=>new Option(p.name,p.id)));if(!siblings.includes(preset))preset=siblings[0];$('camera-film').value=preset.id;selection();}
 $('camera-family').value=preset.family;filmList();$('camera-family').disabled=false;$('camera-film').disabled=false;
 $('camera-family').onchange=filmList;$('camera-film').onchange=()=>{preset=films.find(p=>p.id===$('camera-film').value);selection();};
 $('camera-start').onclick=()=>session.start();$('camera-stop').onclick=()=>session.stop();
 $('camera-flip').onclick=async()=>{session.facing=session.facing==='environment'?'user':'environment';$('camera-flip').textContent=session.facing==='user'?'切换后置':'切换前置';session.mirror=session.facing==='user';$('camera-mirror').checked=session.mirror;if(session.running)await session.start(session.facing);};
 $('camera-mirror').onchange=e=>session.mirror=e.target.checked;$('camera-quality').onchange=e=>session.previewSize=Number(e.target.value);
 $('camera-amount').oninput=e=>{settings.amount=Number(e.target.value)/100;$('camera-amount-value').textContent=e.target.value+'%';saveFilmSettings(preset,settings);session.refresh();};
 $('camera-shutter').onclick=async()=>{if(shooting)return;shooting=true;state();try{const shot=await session.capture();if(!shot)return;releasePhoto();photoURL=URL.createObjectURL(shot.blob);const name=`Gloam_${shot.preset}_${Date.now()}.png`;photoFile=new File([shot.blob],name,{type:'image/png'});$('camera-shot-image').src=photoURL;$('camera-download').href=photoURL;$('camera-download').download=name;$('camera-shot-info').textContent=`${shot.width} × ${shot.height} · PNG`;$('camera-size').textContent=`${shot.width} × ${shot.height}`;$('camera-shot').hidden=false;$('camera-share').hidden=!navigator.canShare?.({files:[photoFile]});status('照片已生成。点击“保存照片”下载，或通过分享菜单存储。');}catch(e){status(e.message);}finally{shooting=false;state();}};
 $('camera-share').onclick=async()=>{if(!photoFile)return;try{await navigator.share({files:[photoFile],title:'Gloam 胶片照片'});}catch(e){if(e.name!=='AbortError')status('分享未成功，请使用“保存照片”。');}};
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&(session.running||session.starting))session.stop('页面已离开，摄像头已关闭。返回后请重新开启。');});
 window.addEventListener('pagehide',()=>{session.stop('');releasePhoto();});window.addEventListener('pageshow',()=>state());
 document.addEventListener('keydown',e=>{if(e.key==='Escape')session.stop();});
 ready=true;$('camera-security').hidden=session.secure&&!!session.mediaDevices?.getUserMedia;status(session.secure?'选择胶片，然后点击开启摄像头。':'手机请使用 HTTPS 地址开启摄像头；当前地址可浏览胶片设置。');state();
}catch(e){status('无法准备相机：'+e.message);}}
init();
