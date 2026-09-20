/** Canvas finishing. Original glyphs/frames; local compositing recipes, not native parity. */
export const FINISH_DEFAULTS = Object.freeze({aspect:'original',cropX:.5,cropY:.5,border:'none',dateStyle:'none',dateFormat:'a',dateTime:'12:00',dateValue:'2026-09-16',dateYear:2026,dateFollowSystem:false,dateSize:.049,dateInsetX:.064,dateInsetY:.067,dust:0,lightLeak:0,effectSeed:1,collageLayout:'none',secondPhotoId:'',collageGap:.02});
const url = path => new URL(path,import.meta.url).href;
const aspect = ['original','1:1','4:3','3:4','3:2','2:3','16:9','9:16'].map(value=>({value,label:value==='original'?'原始比例':value}));
const border = [{value:'none',label:'无边框'},...[1,2].map(n=>({value:`ghalf-${n}`,label:`G-HALF 胶片 ${n}`,src:url(`finish-assets/border-ghalf-${n}.png`)})),...[1,2,3,4,5,7].map(n=>({value:`135c-${n}`,label:`135C 胶片 ${n}`,src:url(`finish-assets/border-135c-${n}.png`)}))];
const dateStyle = [{value:'none',label:'无日期'},...['T3','U2','CCD12'].map(value=>({value,label:`${value} 日期`,src:url(`finish-assets/date-${value}-preview.png`)}))];
export const FINISH_OPTIONS = Object.freeze({aspect,border,dateStyle,aspects:aspect,borders:border,dates:dateStyle});
const assets=new Map();let preparePromise;
export async function prepareFinish(){
 if(!preparePromise) preparePromise=(async()=>{
  const response=await fetch(url('finish-manifest.json'));if(!response.ok)throw Error(`Finishing manifest: HTTP ${response.status}`);
  const manifest=await response.json();
  await Promise.all(Object.entries(manifest.assets).map(async([key,item])=>{
   const im=new Image();im.decoding='async';im.src=url(item.src);
   await im.decode();if(!im.naturalWidth||!im.naturalHeight)throw Error(`Invalid finishing image: ${key}`);assets.set(key,im);
  }));return manifest;
 })().catch(error=>{preparePromise=null;throw error;});
 return preparePromise;
}
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(Number(x))?Number(x):a));
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function random(seed){let a=(Number(seed)||0)>>>0;return()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function imageAsset(key){const im=assets.get(key);if(!im)throw Error(`Finishing asset ${key} not ready; await prepareFinish() first.`);return im;}
/** Width/height describe the center (or positioned) crop; border does not change dimensions. */
export function finishDimensions(width,height,settings={}){
 const s={...FINISH_DEFAULTS,...settings};let ratio=width/height;
 if(s.aspect!=='original'){
  if(!aspect.some(a=>a.value===s.aspect))throw Error(`Unsupported aspect: ${s.aspect}`);
  const [a,b]=s.aspect.split(':').map(Number);ratio=a/b;
 }
 let w=width,h=height;if(w/h>ratio)w=Math.round(h*ratio);else h=Math.round(w/ratio);
 return {width:Math.max(1,w),height:Math.max(1,h),x:Math.round((width-w)*clamp(s.cropX)),y:Math.round((height-h)*clamp(s.cropY))};
}
function drawLeak(g,w,h,probability,seed){
 if(!probability)return;
 const rng=random((Number(seed)||0)^0x4e19);if(rng()>=probability)return;
 // A seeded warm edge exposure; no recovered leak raster was present in the package.
 const edge=rng()>.5?1:0,cy=h*(.15+rng()*.7),rx=w*(.38+rng()*.22),ry=h*(.55+rng()*.6);
 g.save();g.globalCompositeOperation='screen';g.translate(edge*w,cy);g.scale(rx,ry);
 const gradient=g.createRadialGradient(0,0,0,0,0,1);gradient.addColorStop(0,'rgba(255,212,102,.9)');gradient.addColorStop(.24,'rgba(255,96,23,.65)');gradient.addColorStop(.56,'rgba(208,24,12,.3)');gradient.addColorStop(1,'rgba(96,0,0,0)');g.fillStyle=gradient;g.fillRect(-1,-1,2,2);g.restore();
}
function drawDust(g,w,h,amount,seed){
 if(!amount)return;
 const rng=random((Number(seed)||0)^0xa017),unit=Math.min(w,h);
 g.save();g.globalCompositeOperation='source-over';
 // Normalized geometry keeps the same pattern at preview and original resolution.
 for(let i=0;i<150;i++){
  const x=rng()*w,y=rng()*h,r=unit*(.00025+Math.pow(rng(),4)*.0018),light=rng()>.3;
  g.fillStyle=light?`rgba(246,238,218,${amount*(.24+rng()*.56)})`:`rgba(24,20,18,${amount*(.2+rng()*.5)})`;
  g.beginPath();g.ellipse(x,y,r,r*(.45+rng()),rng()*Math.PI,0,Math.PI*2);g.fill();
 }
 for(let i=0;i<8;i++){
  const x=rng()*w,y=rng()*h,len=unit*(.001+rng()*.013);g.strokeStyle=`rgba(248,236,204,${amount*.34})`;g.lineWidth=unit*(.00015+rng()*.0003);g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+len*.3,y+len*.4,x+len,y-len*.2);g.stroke();
 }g.restore();
}
function drawBorder(g,w,h,type){
 if(type==='none')return;if(!border.some(o=>o.value===type))throw Error(`Unsupported border: ${type}`);
 const im=imageAsset(`border-${type}`);
 // Preserve orientation: rotate a landscape original for a portrait photo and vice versa.
 g.save();if((im.naturalWidth>im.naturalHeight)!==(w>h)){
  g.translate(w,0);g.rotate(Math.PI/2);g.drawImage(im,0,0,h,w);
 }else g.drawImage(im,0,0,w,h);g.restore();
}
export function resolveDateSettings(s,now=new Date()){
 if(!s.dateFollowSystem)return s;
 const pad=n=>String(n).padStart(2,'0');
 return {...s,dateFollowSystem:false,dateValue:`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,dateYear:now.getFullYear(),dateTime:`${pad(now.getHours())}:${pad(now.getMinutes())}`};
}
export function dateTokens(s){
 s=resolveDateSettings(s);
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s.dateValue));if(!m)throw Error('Date must use YYYY-MM-DD.');
 const year=s.dateYear==null||s.dateYear===''?Number(m[1]):Math.trunc(Number(s.dateYear));
 if(!Number.isFinite(year)||year<1||year>9999)throw Error('Date year must be 1–9999.');
 const month=Number(m[2]),day=Number(m[3]);const days=[31,year%4===0&&(year%100!==0||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];
 if(month<1||month>12||day<1||day>days[month-1])throw Error('Invalid calendar date.');
 const fmt=s.dateFormat||'a',time=/^(\d{2}):(\d{2})$/.exec(s.dateTime||'12:00');
 if(!time||Number(time[1])>23||Number(time[2])>59)throw Error('Invalid print time.');
 const clock=[...time[1],'colon',...time[2]],dayDigits=[...String(day)],monthDigits=[...String(month)];
 if(s.dateStyle==='CCD12'){
  const date=[...String(year).padStart(4,'0'),'oblique',...m[2],'oblique',...m[3]];
  if(!['a','b'].includes(fmt))throw Error('Unsupported CCD date format.');
  return fmt==='a'?[...date,'space',...clock]:date;
 }
 if(!['a','b','c'].includes(fmt))throw Error('Unsupported date format.');
 const yr=s.dateStyle==='U2'?['quotes',...String(year).padStart(4,'0').slice(-2)]:[...String(year).padStart(4,'0')];
 if(fmt==='c')return s.dateStyle==='U2'?[...dayDigits,'space',...clock]:[...clock,'space',...dayDigits];
 return fmt==='b'?[...monthDigits,'space',...dayDigits,'space',...yr]:[...yr,'space',...monthDigits,'space',...dayDigits];
}
function drawDate(g,w,h,s){
 if(s.dateStyle==='none')return;if(!dateStyle.some(o=>o.value===s.dateStyle))throw Error(`Unsupported date style: ${s.dateStyle}`);
 const tokens=dateTokens(s),glyphs=tokens.map(token=>s.dateStyle==='CCD12'&&token==='space'?null:imageAsset(`date-${s.dateStyle}-${token}`));
 const short=Math.min(w,h),height=short*clamp(s.dateSize??.049,.015,.08),gap=short*.0012;
 const widths=glyphs.map(im=>im?height*im.naturalWidth/im.naturalHeight:height*.6),total=widths.reduce((a,b)=>a+b,0)+gap*(glyphs.length-1);
 let x=Math.max(0,w-short*clamp(s.dateInsetX??.064,0,.4)-total),y=Math.max(0,h-short*clamp(s.dateInsetY??.067,0,.4)-height);
 g.save();g.globalCompositeOperation=s.dateStyle==='CCD12'?'source-over':'screen';
 glyphs.forEach((im,i)=>{if(im)g.drawImage(im,x,y,widths[i],height);x+=widths[i]+gap;});g.restore();
}
/** Settings are independent of renderer settings; unrelated keys are ignored. */
export function finishImage(sourceCanvas,settings={},targetCanvas){
 if(!sourceCanvas?.width||!sourceCanvas?.height)throw Error('Finishing requires a nonempty source canvas.');
 const s={...FINISH_DEFAULTS,...settings},dim=finishDimensions(sourceCanvas.width,sourceCanvas.height,s);
 let source=sourceCanvas;if(sourceCanvas===targetCanvas){source=canvas(sourceCanvas.width,sourceCanvas.height);source.getContext('2d').drawImage(sourceCanvas,0,0);}
 const out=targetCanvas||canvas(dim.width,dim.height);
 if(out.width!==dim.width)out.width=dim.width;if(out.height!==dim.height)out.height=dim.height;
 const g=out.getContext('2d');if(!g)throw Error('Finishing target must be a 2D canvas.');
 g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='copy';
 g.drawImage(source,dim.x,dim.y,dim.width,dim.height,0,0,dim.width,dim.height);g.globalCompositeOperation='source-over';
 drawLeak(g,out.width,out.height,clamp(s.lightLeak),s.effectSeed);
 drawDust(g,out.width,out.height,clamp(s.dust),s.effectSeed);
 drawBorder(g,out.width,out.height,s.border);drawDate(g,out.width,out.height,s);g.restore();
 return out;
}
