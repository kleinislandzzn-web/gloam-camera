const url=p=>new URL(p,import.meta.url).href;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let catalogPromise,dialog,family,group='',current=-1,items=[],catalog,contextPreset=null;
const $=s=>dialog.querySelector(s);
function mount(){
 if(dialog)return;
 const css=document.createElement('link');css.rel='stylesheet';css.href=url('sample-gallery.css');document.head.append(css);
 dialog=document.createElement('dialog');dialog.id='sample-gallery';dialog.setAttribute('aria-labelledby','sample-title');dialog.innerHTML=`<header class="sample-header"><div><span class="sample-eyebrow">GLOAM SAMPLE COLLECTION</span><h2 id="sample-title">原 App 样片</h2></div><button class="sample-close" aria-label="关闭原 App 样片">✕</button></header><nav class="sample-cameras" aria-label="样片相机"></nav><div class="sample-toolbar"><label>胶片<select id="sample-group" aria-label="筛选样片胶片"></select></label><span class="sample-total" role="status"></span></div><p class="sample-note">原 App 包内样片 · 未叠加网页滤镜</p><p class="sample-context" hidden></p><p class="sample-error" role="alert" hidden></p><div class="sample-scroll"><div class="sample-grid"></div></div><section class="sample-viewer" hidden aria-label="样片大图"><div class="sample-viewer-tools"><button class="sample-back">← 返回样片</button><span class="sample-position"></span><a class="sample-original" target="_blank" rel="noopener">打开原尺寸 ↗</a></div><div class="sample-image-stage"><button class="sample-prev" aria-label="上一张样片">‹</button><img class="sample-full" alt=""><button class="sample-next" aria-label="下一张样片">›</button></div><p class="sample-caption"></p></section>`;
 document.body.append(dialog);$('.sample-close').onclick=()=>dialog.close();$('.sample-back').onclick=showGrid;$('.sample-prev').onclick=()=>showImage((current-1+items.length)%items.length);$('.sample-next').onclick=()=>showImage((current+1)%items.length);
 $('#sample-group').onchange=e=>{group=e.target.value;render();};
 dialog.addEventListener('cancel',e=>{if(current>=0){e.preventDefault();showGrid();}});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();return;}if(current>=0&&!/INPUT|SELECT/.test(e.target.tagName)&&['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();showImage((current+(e.key==='ArrowRight'?1:-1)+items.length)%items.length);}});
 dialog.addEventListener('close',()=>{$('.sample-full').removeAttribute('src');current=-1;});
}
function error(message){$('.sample-error').hidden=false;$('.sample-error').textContent=message;}
function render(){
 showGrid(false);$('.sample-error').hidden=true;
 const groups=catalog.groups.filter(g=>g.family===family);
 $('.sample-cameras').innerHTML=catalog.families.map(f=>`<button data-camera="${esc(f.name)}" aria-pressed="${f.name===family}">${esc(f.name)}<span>${f.availableCount ? f.availableCount+' 张' : '待补充'}</span></button>`).join('');
 $('.sample-cameras').querySelectorAll('button').forEach(b=>b.onclick=()=>{family=b.dataset.camera;group='';contextPreset=null;render();});
 $('#sample-group').innerHTML='<option value="">全部胶片</option>'+groups.map(g=>`<option value="${esc(g.id)}">${esc(g.label)} · ${g.images.length ? g.images.length+' 张可看' : '待补充'}</option>`).join('');$('#sample-group').value=group;
 items=groups.filter(g=>!group||g.id===group).flatMap(g=>g.images.map(im=>({...im,label:g.label,description:g.description})));
 $('#sample-title').textContent=family+' · 原 App 样片';const expected=groups.filter(g=>!group||g.id===group).reduce((n,g)=>n+g.expectedCount,0);$('.sample-total').textContent=items.length+' 张可看';$('.sample-note').textContent=items.length?'原 App 包内样片 · 未叠加网页滤镜':'原 App 样片待补充';
 const note=$('.sample-context');const matched=contextPreset&&groups.some(g=>g.presetIds.includes(contextPreset));note.hidden=!contextPreset||matched;note.textContent='包内未确认当前胶片的独立样片，以下展示该相机的样片合集。';
 $('.sample-grid').innerHTML=items.map((im,i)=>`<button class="sample-card" data-sample="${i}" aria-label="查看 ${esc(family+' '+im.label)} 样片 ${i+1}"><img src="${url(im.thumb)}" width="${im.width}" height="${im.height}" alt="${esc(family+' '+im.label)} 原 App 样片 ${i+1}" loading="lazy"><span>${esc(im.label)}<small>${String(i+1).padStart(2,'0')}</small></span></button>`).join('');
 const missing=expected-items.length;if(missing){const message=document.createElement('div');message.className='sample-missing';message.innerHTML=`<strong>${items.length?'其余样片待补充':'这个相机的样片尚未加入'}</strong><p>原安装包仅包含${missing} 张样片的下载索引，没有图片文件。取得原 App 下载后的样片后，即可在这里查看。</p>`;if(!items.length&&catalog.availableCount)message.innerHTML+='<button class="sample-available">查看已加入的 T3 样片 ↗</button>';$('.sample-grid').append(message);message.querySelector('button')?.addEventListener('click',()=>{family='T3';group='';contextPreset=null;render();});}
 $('.sample-grid').querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>showImage(Number(b.dataset.sample)));
 $('.sample-scroll').scrollTop=0;
}
function showGrid(focus=true){const previous=current;current=-1;$('.sample-viewer').hidden=true;$('.sample-scroll').hidden=false;$('.sample-toolbar').hidden=false;$('.sample-cameras').hidden=false;$('.sample-full').removeAttribute('src');if(focus&&previous>=0)$(`[data-sample="${previous}"]`)?.focus({preventScroll:true});}
function showImage(index){current=index;const im=items[index];$('.sample-error').hidden=true;$('.sample-scroll').hidden=true;$('.sample-toolbar').hidden=true;$('.sample-cameras').hidden=true;$('.sample-viewer').hidden=false;const image=$('.sample-full');image.alt=family+' · '+im.label+' · 原 App 样片';image.onerror=()=>error('这张样片加载失败，可打开原尺寸查看。');image.src=url(im.src);$('.sample-original').href=url(im.src);$('.sample-position').textContent=`${index+1} / ${items.length}`;$('.sample-caption').textContent=im.description||family+' · '+im.label;$('.sample-prev').disabled=$('.sample-next').disabled=items.length<2;$('.sample-back').focus({preventScroll:true});}
export async function openSamples(camera='T3',presetId=null){
 mount();if(!dialog.open)dialog.showModal();$('.sample-error').hidden=true;$('.sample-total').textContent='加载样片…';
 try{catalogPromise??=fetch(url('samples/catalog.json')).then(r=>{if(!r.ok)throw Error('样片清单加载失败');return r.json();}).catch(e=>{catalogPromise=null;throw e;});catalog=await catalogPromise;if(!dialog.open)return;
 family=catalog.families.some(f=>f.name===camera)?camera:catalog.families[0].name;contextPreset=presetId;group=catalog.groups.find(g=>g.family===family&&g.presetIds.includes(presetId))?.id||'';render();
 }catch(e){error(e.message);}
}
