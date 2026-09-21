import {R51_ID,r51Settings,R51_NOTE} from './r51-profiles.mjs?v=20260921-live-lite-2';
import {MEASURED_5219_ID,MEASURED_5219_NOTE} from './measured-5219.mjs?v=20260921-live-lite-2';
import {mountDateUI} from './date-ui.mjs?v=20260921-live-lite-2';
import {EDIT_CONTROLS,MIST_LABELS,HALATION_LABELS} from './editor-settings.mjs?v=20260921-live-lite-2';
import {FINISH_OPTIONS} from './finish.mjs?v=20260921-live-lite-2';
const $=s=>document.querySelector(s);
export const CONTROL_KEYS=['amount','exposure','grain','blackMistGrade','blackMistBoost','halationGrade','vignette','ccd','aberration','caPixels','node','kelvin',...EDIT_CONTROLS.map(x=>x[0])];
export function divisor(key){if(key==='blackMistGrade'||key==='halationGrade'||key==='kelvin')return 1;if(key==='node'||key==='caPixels')return 10;return 100;}
export function labelValue(key,v){if(key==='blackMistGrade')return MIST_LABELS[v]||'关闭';if(key==='halationGrade')return HALATION_LABELS[v]||'关闭';if(key==='exposure'||key==='negativeExposure')return v.toFixed(1)+' EV';if(key==='caPixels')return '±'+v.toFixed(1)+' px';if(key==='node')return v.toFixed(1);if(key==='kelvin')return v+' K';return Math.round(v*100)+(EDIT_CONTROLS.some(x=>x[0]===key&&x[5]==='')?'':'%');}
export function mountEditorUI({getSettings,getPreset,onChange,onAutoWB,onAutoTone,getPhotos}){
 const anchor=$('.calibration'),groups={};
 const r51Panel=document.createElement('section');r51Panel.id='r51-measured';r51Panel.innerHTML='<label class="select-control">R-51 实测配方<select id="r51-profile"><option value="noflash">无闪实测</option><option value="flash">有闪实测</option></select></label><p>应用两次拍摄的固定配方，不模拟真实闪光照明。</p><details><summary>恢复范围</summary><p></p></details>';r51Panel.querySelector('details p').textContent=R51_NOTE;document.querySelector('.controls')?.prepend(r51Panel);if(!r51Panel.isConnected)anchor.before(r51Panel);
 r51Panel.querySelector('select').onchange=e=>{onChange(r51Settings(e.target.value));refresh();};
 const measuredNote=document.createElement('p');measuredNote.id='measured-recipe-note';measuredNote.textContent=MEASURED_5219_NOTE;anchor.prepend(measuredNote);
 for(const [key,title,min,max,scale,unit,group] of EDIT_CONTROLS){
  if(!groups[group]){const d=document.createElement('details');d.className='edit-group';d.innerHTML=`<summary>${group}</summary>`;anchor.before(d);groups[group]=d;}
  const row=document.createElement('div');row.className='range-control';row.innerHTML=`<label for="${key}">${title}<output id="${key}-value">0</output></label><input id="${key}" type="range" min="${min}" max="${max}" value="0">`;groups[group].append(row);
 }
 for(const name of ['高光层次','色散与彩边','CCD 空间分布','颗粒分布','暗角层次']){const note=document.createElement('p');note.textContent='核心公式来自原包；此处调节范围为本地设置，各相机原版默认值待确认。';groups[name].append(note);}
 for(const key of ['aberration','caPixels'])groups['色散与彩边'].prepend($('#'+key).closest('.range-control'));
 groups['CCD 空间分布'].prepend($('#ccd').closest('.range-control'));
 for(const [group,text] of [['CCD 空间分布','先调高 CCD 采样，再调整中心与边缘权重。'],['颗粒分布','先开启颗粒，再调整不同亮度区域的权重。'],['暗角层次','暗角影调开启后，阴影与高光保护才会生效。']]){const p=document.createElement('p');p.textContent=text;groups[group].prepend(p);}
 const auto=document.createElement('button');auto.id='auto-wb';auto.textContent='自动白平衡';auto.title='根据当前原图的亮部颜色估计，可用色温和色调继续调整';auto.onclick=onAutoWB;groups['色彩'].prepend(auto);
 const autoTone=document.createElement('button');autoTone.id='auto-tone';autoTone.textContent='自动调整明暗 · 本地建议';autoTone.onclick=onAutoTone;groups['高光层次'].prepend(autoTone);
 const hdrNote=document.createElement('p');hdrNote.textContent='高动态范围用于单张照片的明暗压缩，不生成多张合成 HDR。';groups['细节'].append(hdrNote);
 const style=document.createElement('details');style.className='edit-group finishing-controls';style.innerHTML='<summary>画幅与边框</summary>';anchor.before(style);
 const fields=[];
 for(const [key,title] of [['aspect','画幅比例'],['border','边框配置']]){
  const row=document.createElement('label');row.className='select-control';row.append(document.createTextNode(title));const select=document.createElement('select');select.id=key;
  for(const item of FINISH_OPTIONS[key]){const option=document.createElement('option');option.value=item.value;option.textContent=item.label;select.append(option);}row.append(select);style.append(row);fields.push(key);
  if(key!=='aspect'){const img=document.createElement('img');img.id=key+'-preview';img.className='finish-style-preview';img.alt=title+' 原包素材';img.hidden=true;style.append(img);}
 }
 for(const [key,title,type,min,max,step] of [['cropX','横向取景','range',0,1,.01],['cropY','纵向取景','range',0,1,.01]]){
  const label=document.createElement('label');label.className='select-control';label.append(document.createTextNode(title));const input=document.createElement('input');input.type=type;input.id=key;if(min!==undefined){input.min=min;input.max=max;input.step=step;}label.append(input);style.append(label);fields.push(key);
 }
 const collage=document.createElement('details');collage.className='edit-group';collage.id='collage-controls';collage.innerHTML='<summary>G-HALF 半格拼图</summary><label class="select-control">排列<select id="collageLayout"><option value="none">单张</option><option value="horizontal">左右两张</option><option value="vertical">上下两张</option></select></label><label class="select-control">第二张原图<select id="secondPhotoId"></select></label><label class="select-control">中缝宽度<input id="collageGap" type="range" min="0" max=".1" step=".005"></label><p>两张原图分别应用当前胶片后拼接；布局为本地重建。第二张按中心裁切对齐。</p>';anchor.before(collage);
 for(const key of ['collageLayout','secondPhotoId','collageGap'])$('#'+key).oninput=e=>{const patch={[key]:key==='collageGap'?Number(e.target.value):e.target.value};if(key==='collageLayout'&&patch[key]!=='none'&&!getSettings().secondPhotoId)patch.secondPhotoId=getPhotos()[1]?.id||getPhotos()[0]?.id||'';onChange(patch);refresh();};
 const special=document.createElement('details');special.className='edit-group';special.innerHTML='<summary>灰尘与漏光</summary>';anchor.before(special);
 for(const [key,title] of [['dust','灰尘效果'],['lightLeak','漏光概率']]){const label=document.createElement('label');label.className='select-control';label.innerHTML=`${title}<input type="range" id="${key}" min="0" max="100" value="0"><output id="${key}-value">0%</output>`;special.append(label);fields.push(key);}
 const reroll=document.createElement('button');reroll.id='reroll';reroll.textContent='换一次随机效果';reroll.onclick=()=>{onChange({effectSeed:(getSettings().effectSeed||1)+1});refresh();};special.append(reroll);
 const quality=document.createElement('label');quality.className='select-control';quality.innerHTML='黑柔质量<select id="blackMistQuality"><option value="0">预览</option><option value="1">平衡／高</option></select>';anchor.append(quality);fields.push('blackMistQuality');
 for(const key of fields){$('#'+key).addEventListener('input',e=>{let v=e.target.value;if(['cropX','cropY','dateYear','blackMistQuality','dust','lightLeak'].includes(key))v=Number(v);if(key==='dust'||key==='lightLeak')v/=100;if(key==='dateYear'&&(v<1900||v>2099))return;const patch={[key]:v};if(key==='dateValue'&&/^\d{4}-\d{2}-\d{2}$/.test(v))patch.dateYear=Number(v.slice(0,4));onChange(patch);refresh();});}
 const dateUI=mountDateUI({getSettings,getPreset,onChange});
 function refresh(){const isR51=getPreset().id===R51_ID;document.body.classList.toggle('r51-editor',isR51);r51Panel.hidden=!isR51;$('#r51-profile').value=getSettings().r51Profile||'noflash';
  for(const key of ['caPixels','fringeSpread','grainHigh','vignetteTone','vignetteShadowProtect','vignetteHighlightProtect']){const input=$('#'+key);input.disabled=isR51;input.closest('.range-control').hidden=isR51;}
  measuredNote.hidden=getPreset().id!==MEASURED_5219_ID;$('#vignette').max=getPreset().id===MEASURED_5219_ID?200:100;dateUI.refresh();const s=getSettings();collage.hidden=getPreset().family!=='G-HALF';const select=$('#secondPhotoId');const list=getPhotos();const key=list.map(p=>p.id).join('|');if(select.dataset.list!==key){select.dataset.list=key;select.replaceChildren(new Option('请选择原图',''),...list.map(p=>new Option(p.name,p.id)));}select.value=s.secondPhotoId;$('#collageLayout').value=s.collageLayout;$('#collageGap').value=s.collageGap;for(const key of fields){const el=$('#'+key);el.value=(key==='dust'||key==='lightLeak')?Math.round(s[key]*100):s[key];const output=$('#'+key+'-value');if(output)output.textContent=Math.round(s[key]*100)+'%';}
  for(const key of ['border']){const item=FINISH_OPTIONS[key].find(x=>x.value===s[key]),im=$('#'+key+'-preview');im.hidden=!item?.src;if(item?.src)im.src=item.src;}
 }
 return {refresh};
}
