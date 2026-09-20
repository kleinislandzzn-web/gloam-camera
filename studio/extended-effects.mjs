import {highlightRecovery,highlightShoulder,fringeSeed,fringeComposite,ccdRadial,grainOriginal,vignetteResponse} from './extended-kernels.mjs?v=20260921-live-measured-1';
import {coordinates} from './optics.mjs?v=20260921-live-measured-1';

// Original kernels, local controls/thresholds. New effects remain opt-in until camera factories are recovered.
export const EXTENDED_DEFAULTS=Object.freeze({highlightRecovery:0,highlightShoulder:0,blueFringe:0,fringeSpread:.35,ccdCenter:1,ccdEdge:1,grainShadow:1,grainMid:1,grainHigh:1,vignetteTone:0,vignetteShadowProtect:.6,vignetteHighlightProtect:.7});
export const EXTENDED_CONTROLS=[
 ['highlightRecovery','高光压缩',0,100,100,'%','高光层次'],['highlightShoulder','高光过渡',0,100,100,'%','高光层次'],
 ['blueFringe','高光蓝紫边',0,100,100,'%','色散与彩边'],['fringeSpread','彩边扩散范围',0,100,100,'%','色散与彩边'],
 ['ccdCenter','CCD 中心强度',0,100,100,'%','CCD 空间分布'],['ccdEdge','CCD 边缘强度',0,100,100,'%','CCD 空间分布'],
 ['grainShadow','阴影颗粒权重',0,200,100,'%','颗粒分布'],['grainMid','中间调颗粒权重',0,200,100,'%','颗粒分布'],['grainHigh','高光颗粒权重',0,200,100,'%','颗粒分布'],
 ['vignetteTone','暗角影调',0,100,100,'%','暗角层次'],['vignetteShadowProtect','暗角阴影保护',0,100,100,'%','暗角层次'],['vignetteHighlightProtect','暗角高光保护',0,100,100,'%','暗角层次'],
];
export const ccdRadialGLSL=ccdRadial+`
 uniform float ccdCenter,ccdEdge;
 float ccdSpatialWeight(){return ccdSamplingRadialMask(length(referenceSize*.5),referenceSize.x*.5,referenceSize.y*.5,2.,0.,ccdCenter,1.,ccdEdge,1.,ccdEdge,1.,ccdEdge,1.,ccdEdge,1.,ccdEdge,1.,ccdEdge,1.,ccdEdge).r;}`;

// Original grain supports up to nine luminance control points. The old two-point curve
// remains mathematically identical at neutral weights. Nine points are used for custom weights.
const pairs=Array.from({length:9},(_,i)=>{const x=(i/8).toFixed(3);return `${x},weightAt(${x})`;}).join(',');
export const textureGLSL=grainOriginal+vignetteResponse+`
 uniform float grainShadow,grainMid,grainHigh,vignetteTone,vignetteShadowProtect,vignetteHighlightProtect;
 float weightAt(float l){float custom=l<.5?mix(grainShadow,grainMid,smoothstep(0.,.5,l)):mix(grainMid,grainHigh,smoothstep(.5,1.,l));return grain*mix(1.05,.55,smoothstep(.25,.95,l))*custom;}
 vec3 applyOriginalGrain(vec3 c,vec3 tex){
  if(grain<=0.)return c;
  if(grainShadow==1.&&grainMid==1.&&grainHigh==1.)return lusterGrainSoftLight(vec4(c,1),vec4(tex,1),2.,.25,grain*1.05,.95,grain*.55,1.,0.,1.,0.,1.,0.,1.,0.,1.,0.,1.,0.,1.,0.).rgb;
  return lusterGrainSoftLight(vec4(c,1),vec4(tex,1),9.,${pairs}).rgb;
 }
 vec3 applyVignetteResponse(vec3 c){float m=smoothstep(.18,.70,length(uv-.5));return vignetteToneResponse(vec4(c,1),vec4(m),vignetteTone,1.,vignetteShadowProtect,1.,vignetteHighlightProtect,.2).rgb;}
`;

export function installExtended(r,vertex,prefix){
 const add=(name,body)=>r.programs[name]=r.program(vertex,prefix+body);
 add('recoveredHighlights',highlightRecovery+highlightShoulder+`uniform sampler2D source;uniform float recovery,shoulder;void main(){vec4 c=texture(source,uv);if(recovery>0.)c=highlightRecovery(c,recovery,.65,4.);if(shoulder>0.)c=highlightShoulder(c,.65,.25,.35,.15,.05,shoulder);color=c;}`);
 add('blueFringeSeed',coordinates+fringeSeed+`uniform sampler2D source;void main(){color=highlightBlueFringeSeed(source,.65,.25,4.,1.,.6);}`);
 add('blueFringeComposite',coordinates+fringeComposite+`uniform sampler2D source,innerTex,outerTex;uniform float opacity;void main(){color=highlightBlueFringeComposite(source,innerTex,outerTex,0.,0.,.6,opacity);}`);
}
export function extendedTone(r,input,s,w,h){
 if(!(s.highlightRecovery>0||s.highlightShoulder>0))return input;
 const out=r.frame(52,w,h);r.pass('recoveredHighlights',out,w,h,{source:input},{recovery:s.highlightRecovery||0,shoulder:s.highlightShoulder||0});return out.texture;
}
export function extendedFringe(r,input,s,w,h,referenceSize){
 if(!(s.blueFringe>0))return input;
 const seed=r.frame(53,w,h),tmp=r.frame(54,w,h),inner=r.frame(55,w,h),outer=r.frame(56,w,h),out=r.frame(57,w,h);
 r.pass('blueFringeSeed',seed,w,h,{source:input},{referenceSize});
 const radius=.3+3*Math.max(0,Math.min(1,s.fringeSpread??.35));
 const blur=(f,scale)=>{r.pass('blur',tmp,w,h,{source:seed.texture},{stepSize:[radius*scale/referenceSize[0],0]});r.pass('blur',f,w,h,{source:tmp.texture},{stepSize:[0,radius*scale/referenceSize[1]]});};
 blur(inner,1);blur(outer,3);
 r.pass('blueFringeComposite',out,w,h,{source:input,innerTex:inner.texture,outerTex:outer.texture},{referenceSize,opacity:s.blueFringe});return out.texture;
}
