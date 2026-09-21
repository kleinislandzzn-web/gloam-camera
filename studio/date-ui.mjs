import {dateTokens,resolveDateSettings} from './finish.mjs?v=20260921-live-lite-2';
const asset=name=>new URL(`finish-assets/${name}.png`,import.meta.url).href;
const labels={U2:['年／月／日','月／日／年','日＋时分'],T3:['年／月／日','月／日／年','时分＋日'],CCD12:['日期＋时分','仅日期']};
export function mountDateUI({getSettings,getPreset,onChange}){
 const root=document.createElement('section');root.id='date-print-panel';root.innerHTML=`<div class="date-heading"><h3>日期打印</h3><button id="date-settings-toggle" type="button" aria-expanded="false" aria-controls="date-settings">设置</button></div><div class="date-options" role="group" aria-label="日期打印格式"></div><p class="date-current" aria-live="polite"></p><div id="date-settings" hidden><label class="select-control">日期字体<select id="dateStyle"><option value="T3">T3</option><option value="U2">U2</option><option value="CCD12">CCD12</option></select></label><label class="select-control">日期<input id="dateValue" type="date" min="1900-01-01" max="2099-12-31"></label><label class="select-control">时间<input id="dateTime" type="time" step="60"></label><label class="select-control">跟随当前时间<input id="dateFollowSystem" type="checkbox"></label><label class="select-control">印字大小<input id="dateSize" type="range" min=".015" max=".08" step=".001"></label><label class="select-control">右侧留白<input id="dateInsetX" type="range" min="0" max=".4" step=".001"></label><label class="select-control">底部留白<input id="dateInsetY" type="range" min="0" max=".4" step=".001"></label><p class="date-note">字形来自原包；位置与大小为本地可调。跟随时间时以本机当前时间打印。</p></div>`;
 document.querySelector('.tool-picker').before(root);
 let preferred='',signature='';
 root.querySelector('#dateFollowSystem').onchange=e=>{onChange({dateFollowSystem:e.target.checked});refresh();};
 for(const key of ['dateSize','dateInsetX','dateInsetY'])root.querySelector('#'+key).oninput=e=>{onChange({[key]:Number(e.target.value)});refresh();};
 const styleFor=()=>getSettings().dateStyle!=='none'?getSettings().dateStyle:preferred;
 root.querySelector('#date-settings-toggle').onclick=e=>{const d=root.querySelector('#date-settings');d.hidden=!d.hidden;e.currentTarget.setAttribute('aria-expanded',String(!d.hidden));};
 root.querySelector('#dateStyle').onchange=e=>{preferred=e.target.value;const s=getSettings(),patch={dateFormat:preferred==='CCD12'&&s.dateFormat==='c'?'a':s.dateFormat};if(s.dateStyle!=='none')patch.dateStyle=preferred;onChange(patch);refresh();};
 for(const key of ['dateValue','dateTime'])root.querySelector('#'+key).onchange=e=>{const value=e.target.value;if(!value||!e.target.validity.valid){refresh();return;}onChange({[key]:value,...(key==='dateValue'?{dateYear:Number(value.slice(0,4))}:{})});refresh();};
 function refresh(){
  const raw=getSettings(),s=resolveDateSettings(raw),p=getPreset();
  root.querySelector('#dateFollowSystem').checked=!!raw.dateFollowSystem;
  for(const key of ['dateValue','dateTime'])root.querySelector('#'+key).disabled=!!raw.dateFollowSystem;
  for(const key of ['dateSize','dateInsetX','dateInsetY'])root.querySelector('#'+key).value=s[key];if(signature!==p.id){signature=p.id;preferred=p.family==='U2'?'U2':p.family==='G12'?'CCD12':'T3';}
  const style=styleFor(),list=root.querySelector('.date-options');list.style.setProperty('--date-columns',labels[style].length+1);
  list.innerHTML=`<button type="button" class="date-option" data-format="none" aria-label="关闭日期打印" aria-pressed="${s.dateStyle==='none'}"><span class="date-off">×</span><span>关闭</span></button>`+labels[style].map((label,i)=>{const format=String.fromCharCode(97+i);return `<button type="button" class="date-option" data-format="${format}" aria-label="${label}" aria-pressed="${s.dateStyle!=='none'&&(s.dateFormat||'a')===format}"><img src="${asset(style+'_DatePrint_'+format.toUpperCase())}" alt="${style} 原包日期示例"><span>${label}</span></button>`;}).join('');
  list.querySelectorAll('button').forEach(b=>b.onclick=()=>{onChange(b.dataset.format==='none'?{dateStyle:'none'}:{dateStyle:style,dateFormat:b.dataset.format});refresh();});
  root.querySelector('#dateStyle').value=style;root.querySelector('#dateValue').value=s.dateValue;root.querySelector('#dateTime').value=s.dateTime;
  let line='已关闭';if(s.dateStyle!=='none'){try{line='打印内容：'+dateTokens(s).map(t=>({space:' ',colon:':',oblique:'/',quotes:'’'}[t]??t)).join('');}catch{line='请设置有效的日期和时间';}}
  root.querySelector('.date-current').textContent=line;
 }
 return {refresh};
}
