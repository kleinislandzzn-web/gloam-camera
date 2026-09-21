import {R51_ID,r51Name,R51_NOTE} from '../r51-profiles.mjs?v=20260921-live-lite-2';
import {MEASURED_5219_ID,MEASURED_5219_LABEL,MEASURED_5219_NOTE} from '../measured-5219.mjs?v=20260921-live-lite-2';
import {finishPhoto} from '../photo-finish.mjs?v=20260921-live-lite-2';
import {openSamples} from '../sample-gallery.mjs?v=20260921-live-lite-2';
import {CAMERA_COPY} from '../original-copy.mjs?v=20260921-live-lite-2';
import {Renderer,Assets} from '../renderer.mjs?v=20260921-live-lite-2';
import {prepareFinish,finishImage} from '../finish.mjs?v=20260921-live-lite-2';
import {readFilmSettings,filmIsEdited,colorOnlySettings} from '../film-settings.mjs?v=20260921-live-lite-2';
import {MIST_LABELS,HALATION_LABELS} from '../editor-settings.mjs?v=20260921-live-lite-2';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=p=>new URL('../'+p,import.meta.url).href;
const sourceURL=p=>/^(blob:|data:|https?:)/.test(p)?p:url(p);
const pause=()=>new Promise(r=>setTimeout(r,0));
let data,art,assets,renderer,photo,family='全部',mode='recipe',generation=0,uploading=false,frameReady=false,detailBusy=false,openedFilm=null;
const cache=new Map(),uploads=[],objectURLs=new Set();
// Alpha bounds of the original 500px camera artwork; center the visible image, not its transparent canvas.
const cameraBounds={T3:[16,42,467,433],U2:[27,42,447,433],'G-HALF':[8,42,486,433],GRD:[16,89,476,340],FX:[10,34,481,387],G12:[32,81,444,323],CCD2008:[63,135,388,275],M72:[21,50,459,361]};
function cameraIcon(f){return art.families[f]?`<svg class="camera-icon" viewBox="${cameraBounds[f].join(' ')}" aria-hidden="true" focusable="false"><image href="${url(art.families[f].src)}" width="500" height="500"/></svg>`:'';}

function alertError(e){$('#home-error').textContent=e.message||String(e);$('#home-error').hidden=false;}
function visibleFilms(){const q=$('#film-search').value.trim().toLowerCase();return data.presets.filter(p=>p.group==='main'&&(family==='全部'||p.family===family)&&(p.name+' '+p.id).toLowerCase().includes(q));}
function updateSources(){
 $('#source-count').textContent=data.photos.length+' 张原图';$('#source-name').textContent=photo.name;$('#source-name').title=photo.name;
 $('#sources').innerHTML=data.photos.map((p,i)=>`<button class="source" data-photo="${esc(p.id)}" aria-pressed="${p.id===photo.id}" aria-label="选择原图 ${i+1}：${esc(p.name)}" title="${esc(p.name)}"><img src="${sourceURL(p.thumb)}" alt="原图 ${i+1}" loading="lazy"><span>${String(i+1).padStart(2,'0')}</span></button>`).join('');
 $$('#sources button').forEach(b=>b.onclick=()=>{photo=data.photos.find(p=>p.id===b.dataset.photo);updateSources();renderGallery();});
}
function setFamily(next){family=next;$$('#camera-families button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.family===next)));renderGallery();}
function configMarkup(p){
 const s=readFilmSettings(p),edited=filmIsEdited(p),pct=x=>Math.round((x||0)*100)+'%';
 const values=[['颗粒',pct(s.grain)],[s.blackMistGrade>0&&s.blackMistBoost>0?'黑柔增强':'黑柔',MIST_LABELS[s.blackMistGrade]],['光晕',HALATION_LABELS[s.halationGrade]]];
 if(p.family==='CCD2008'||p.family==='G12'||p.family==='GRD')values.push(['CCD',pct(s.ccd)]);else values.push(['暗角',pct(s.vignette)]);
 if(s.blueFringe>0)values.push(['蓝紫边',pct(s.blueFringe)]);if(s.highlightRecovery>0)values.push(['高光压缩',pct(s.highlightRecovery)]);if(p.family==='G-HALF'&&s.collageLayout!=='none')values.push(['半格',s.collageLayout==='horizontal'?'左右':'上下']);
 return `<span class="config-top"><span>${p.id===R51_ID?r51Name(s.r51Profile)+(edited?' · 已调节':''):edited?'我的配置':p.id===MEASURED_5219_ID?'无闪实测试片':'试片配置'}</span><span>调节 ↗</span></span><span class="config-values">${values.map(([k,v])=>`<span>${k}<b>${esc(v||'关闭')}</b></span>`).join('')}</span>`;
}
function cardMarkup(p,index){const a=art.presets[p.id],name=p.name.split(' · ').slice(1).join(' · ')||p.name;return `<article class="film-card" data-film="${p.id}">
 <button class="film-preview" data-open="${p.id}" aria-label="查看并调整 ${esc(p.name)}" data-ready="false"><img class="effect-image" src="${sourceURL(photo.thumb)}" alt="${esc(p.name)} 效果预览"><img class="before-image" src="${sourceURL(photo.preview)}" alt="原图对照" hidden><span class="film-number">${String(index+1).padStart(2,'0')}</span><span class="preview-badge">生成中</span><span class="preview-action">查看大图与前后对比 <span>↗</span></span></button>
 <div class="film-identity"><div><span class="film-family">${esc(p.family)}</span><h3>${esc(name)}</h3></div>${a?`<button class="artwork-button" data-open="${p.id}" title="${esc(a.mapping)}" aria-label="打开 ${esc(p.name)} 原包配置卡片"><img src="${url(a.src)}" alt="${esc(p.name)} ${a.shared?'共用':'原包'}卡片" loading="lazy"></button>`:''}</div>
 <button class="config-card" data-open="${p.id}" aria-label="调整 ${esc(p.name)} 的独立配置">${configMarkup(p)}</button><p class="card-origin"><span>${a?.shared?'50D 系列共用卡片':'原包胶片卡片'}</span><span>${p.kind==='matrix'?'15 个色彩节点':'独立 Cube 色表'}</span></p>${p.id===MEASURED_5219_ID?`<p class="measured-recipe-note" style="font-size:12px;color:#a8b49a;line-height:1.6" title="${MEASURED_5219_NOTE}">${MEASURED_5219_LABEL} · 自动调参待恢复</p>`:''}${p.id===R51_ID?`<p class="r51-note" style="font-size:12px;color:#a8b49a;line-height:1.6" title="${R51_NOTE}">固定实测配方 · 点击配置切换有闪／无闪 · 部分恢复</p>`:''}</article>`;}
async function renderGallery(){
 const job=++generation,list=visibleFilms(),source=photo,renderMode=mode;
 $('#home-error').hidden=true;$('#results-title').innerHTML=`${family==='全部'?'全部胶片':esc(family)} <span>${list.length}</span>`;
 $('#family-caption').textContent=[(CAMERA_COPY[family]?.description||'同一张原图，不同胶片的颜色与质感。'),renderMode==='color'?'当前仅颜色：黑柔、颗粒和日期等配置不参与此处预览。':''].filter(Boolean).join(' ');
 $('#film-grid').innerHTML=list.map(cardMarkup).join('');$('#empty').hidden=!!list.length;$('#progress').textContent=list.length?'正在显影 0 / '+list.length:'0 款匹配';
 $$('#film-grid [data-open]').forEach(b=>b.onclick=()=>openDetail(b.dataset.open));
 for(let i=0;i<list.length;i++){
  if(job!==generation)return;const p=list[i],s=renderMode==='color'?colorOnlySettings(p):readFilmSettings(p),key=[source.id,p.id,renderMode,JSON.stringify(s),s.dateFollowSystem?Math.floor(Date.now()/60000):''].join('|');
  try{
   let preview=cache.get(key);
   if(!preview){const [im,prepared]=await Promise.all([assets.image(source.preview),assets.prepare(p,s.node,s.kelvin)]);if(job!==generation)return;
    const scale=Math.min(1,560/Math.max(source.width,source.height)),w=Math.max(1,Math.round(source.width*scale)),h=Math.max(1,Math.round(source.height*scale));
    renderer.render(im,prepared,s,w,h,[source.width,source.height]);const finished=await finishPhoto(renderer.canvas,s,{renderer,assets,preset:p,photos:data.photos});
    const blob=await new Promise((resolve,reject)=>finished.toBlob(b=>b?resolve(b):reject(Error('无法生成预览')),'image/jpeg',.92));
    if(job!==generation)return;preview=URL.createObjectURL(blob);cache.set(key,preview);if(cache.size>120){const first=cache.keys().next().value;URL.revokeObjectURL(cache.get(first));cache.delete(first);}
   }
   const card=$(`[data-film="${p.id}"]`);card.querySelector('.effect-image').src=preview;const before=card.querySelector('.before-image');before.hidden=false;before.style.objectPosition=`${s.cropX*100}% ${s.cropY*100}%`;
   card.querySelector('.film-preview').dataset.ready='true';card.querySelector('.preview-badge').textContent=$('#show-before').getAttribute('aria-pressed')==='true'?'BEFORE':renderMode==='color'?'仅颜色':filmIsEdited(p)?'我的配置':'AFTER';
   $('#progress').textContent=i===list.length-1?`${list.length} 款已就绪 · 点击卡片调节`:`正在显影 ${i+1} / ${list.length}`;
  }catch(e){if(job!==generation)return;alertError(e);const card=$(`[data-film="${p.id}"]`);card.querySelector('.preview-badge').textContent='预览失败';}
  await pause();
 }
}
function sendSources(){if(!frameReady)return;$('#editor-frame').contentWindow.postMessage({type:'gloam:photos',photos:uploads,selected:photo.id},location.origin);}
function openDetail(id){
 const p=data.presets.find(p=>p.id===id);if(!p?.available||p.group!=='main')return;openedFilm=id;frameReady=false;detailBusy=false;$('#close-detail').disabled=false;
 $('#detail-label').textContent=p.name+' · 显影';$('#editor-frame').src=`editor.html?embedded=1&preset=${encodeURIComponent(id)}&photo=${encodeURIComponent(photo.id)}`;
 $('#film-detail').showModal();document.body.classList.add('detail-open');$('#close-detail').focus();
}
function closeDetail(){if(detailBusy)return;$('#film-detail').close();}
$('#film-detail').addEventListener('cancel',e=>{if(detailBusy)e.preventDefault();});
$('#film-detail').addEventListener('close',()=>{document.body.classList.remove('detail-open');$('#editor-frame').src='about:blank';frameReady=false;renderGallery();$(`[data-film="${openedFilm}"] .config-card`)?.focus({preventScroll:true});});
$('#close-detail').onclick=closeDetail;
$('#open-samples').onclick=()=>openSamples(family);
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('#editor-frame').contentWindow)return;
 if(e.data?.type==='gloam:ready'){frameReady=true;sendSources();}
 if(e.data?.type==='gloam:close')closeDetail();
 if(e.data?.type==='gloam:busy'){detailBusy=!!e.data.busy;$('#close-detail').disabled=detailBusy;}
 if(e.data?.type==='gloam:selection')$('#detail-label').textContent=e.data.name+' · 显影';
});
async function addFiles(files){
 if(uploading||!renderer||!data)return;uploading=true;$('#upload-trigger').disabled=true;let first=null,failed=0;
 try{for(const file of files){if(!/^image\/(jpeg|png|webp)$/.test(file.type)){failed++;continue;}const full=URL.createObjectURL(file);let keep=false;
  try{const im=new Image();im.src=full;await im.decode();if(im.naturalWidth>renderer.maxSize||im.naturalHeight>renderer.maxSize)throw Error('图片尺寸超过浏览器 GPU 限制');
   const c=document.createElement('canvas'),scale=Math.min(1,1400/Math.max(im.naturalWidth,im.naturalHeight));c.width=Math.round(im.naturalWidth*scale);c.height=Math.round(im.naturalHeight*scale);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
   const blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.94));if(!blob)throw Error('图片预览失败');const preview=URL.createObjectURL(blob);
   const p={id:'upload-'+crypto.randomUUID(),name:file.name,width:im.naturalWidth,height:im.naturalHeight,full,preview,thumb:preview,original:full};uploads.push(p);data.photos.push(p);objectURLs.add(full);objectURLs.add(preview);first??=p;keep=true;
  }catch{failed++;}finally{if(!keep)URL.revokeObjectURL(full);}
 }if(first){photo=first;updateSources();renderGallery();}$('#upload-status').textContent=`${first?'已添加，上传图片保留到本页关闭。':''}${failed?` ${failed} 张未加入，请使用有效的 JPG / PNG / WebP 图片。`:''}`;
 }finally{uploading=false;$('#upload-trigger').disabled=false;$('#upload').value='';}
}
$('#upload-trigger').onclick=()=>$('#upload').click();$('#upload').onchange=e=>addFiles([...e.target.files]).catch(alertError);
let dragDepth=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragDepth++;$('#drop-overlay').hidden=false;}});document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault();});document.addEventListener('dragleave',()=>{if(--dragDepth<=0){dragDepth=0;$('#drop-overlay').hidden=true;}});document.addEventListener('drop',e=>{if(!e.dataTransfer?.files.length)return;e.preventDefault();dragDepth=0;$('#drop-overlay').hidden=true;addFiles([...e.dataTransfer.files]).catch(alertError);});
async function init(){
 const responses=await Promise.all([fetch(url('manifest.json')),fetch(url('artwork.json'))]);if(responses.some(r=>!r.ok))throw Error('胶片资料读取失败，请刷新重试。');[data,art]=await Promise.all(responses.map(r=>r.json()));photo=data.photos[0];assets=new Assets(data);renderer=new Renderer(document.createElement('canvas'));await prepareFinish();
 const families=['全部',...new Set(data.presets.filter(p=>p.group==='main').map(p=>p.family))];$('#camera-families').innerHTML=families.map(f=>`<button data-family="${esc(f)}" aria-pressed="${f===family}" aria-label="${esc(f==='全部'?'全部相机':f)}"><span class="family-content">${cameraIcon(f)}<span class="family-name">${esc(f)}</span><small>${data.presets.filter(p=>p.group==='main'&&(f==='全部'||p.family===f)).length}</small></span></button>`).join('');$$('#camera-families button').forEach(b=>b.onclick=()=>setFamily(b.dataset.family));
 $('#film-search').oninput=renderGallery;$('#clear-search').onclick=()=>{$('#film-search').value='';setFamily('全部');};
 for(const [id,next] of [['recipe-mode','recipe'],['color-mode','color']])$('#'+id).onclick=()=>{mode=next;$('#recipe-mode').setAttribute('aria-pressed',String(mode==='recipe'));$('#color-mode').setAttribute('aria-pressed',String(mode==='color'));renderGallery();};
 $('#show-before').onclick=()=>{const on=$('#show-before').getAttribute('aria-pressed')!=='true';$('#show-before').setAttribute('aria-pressed',String(on));$('#show-before').textContent=on?'返回胶片效果':'查看全部原图';$('#film-grid').classList.toggle('show-before',on);$$('.film-preview[data-ready=true]').forEach(b=>{const p=data.presets.find(p=>p.id===b.dataset.open);b.querySelector('.preview-badge').textContent=on?'BEFORE':mode==='color'?'仅颜色':filmIsEdited(p)?'我的配置':'AFTER';});};
 const requested=new URLSearchParams(location.search).get('film');const initial=data.presets.find(p=>p.id===requested&&p.group==='main');if(initial)$('#film-search').value=initial.id;
 $('#upload-trigger').disabled=false;updateSources();await renderGallery();
}
init().catch(alertError);
