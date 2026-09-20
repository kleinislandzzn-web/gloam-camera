import {finishImage,resolveDateSettings} from './finish.mjs';

// Two independently developed images; assembly dimensions are local, not recovered G-HALF layout constants.
export function composePair(first,second,layout,gapRatio=.02){
 if(!['horizontal','vertical'].includes(layout))throw Error('不支持的半格排列');
 const gap=Math.round(Math.min(first.width,first.height)*Math.max(0,Math.min(.1,gapRatio)));
 const horizontal=layout==='horizontal',w=horizontal?first.width*2+gap:first.width,h=horizontal?first.height:first.height*2+gap;
 if(w>32767||h>32767)throw Error('拼图尺寸过大，请使用较小的图片。');
 const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#13120f';g.fillRect(0,0,w,h);
 g.drawImage(first,0,0);
 const scale=Math.max(first.width/second.width,first.height/second.height),sw=first.width/scale,sh=first.height/scale;
 g.drawImage(second,(second.width-sw)/2,(second.height-sh)/2,sw,sh,horizontal?first.width+gap:0,horizontal?0:first.height+gap,first.width,first.height);
 return c;
}
export async function finishPhoto(source,settings,{renderer,assets,preset,photos}){
 const s=resolveDateSettings(settings);
 if(preset.family!=='G-HALF'||!s.collageLayout||s.collageLayout==='none')return finishImage(source,s);
 const secondPhoto=photos.find(p=>p.id===s.secondPhotoId);
 if(!secondPhoto)throw Error('半格拼图需要选择第二张原图；临时上传图片请重新上传或改选内置原图。');
 const tile={...s,border:'none',dateStyle:'none',collageLayout:'none'};
 const first=finishImage(source,tile),maxSide=Math.max(source.width,source.height);
 const [im,prepared]=await Promise.all([assets.image(secondPhoto.full),assets.prepare(preset,s.node,s.kelvin)]);
 const q=Math.min(1,maxSide/Math.max(secondPhoto.width,secondPhoto.height));
 renderer.render(im,prepared,s,Math.max(1,Math.round(secondPhoto.width*q)),Math.max(1,Math.round(secondPhoto.height*q)),[secondPhoto.width,secondPhoto.height]);
 const second=finishImage(renderer.canvas,{...tile,effectSeed:(s.effectSeed||1)+1});
 const pair=composePair(first,second,s.collageLayout,s.collageGap);
 return finishImage(pair,{...s,aspect:'original',dust:0,lightLeak:0,collageLayout:'none'});
}
