import {mistFinalize,mistExcess,mistMask,haloComposite,reflectionSeed,toneRange,exponentialMix} from './recovered-kernels.mjs?v=20260921-live-lite-2';
import {measured5219Optics} from './measured-5219.mjs?v=20260921-live-lite-2';
import {mistProfile} from './mist-enhancement.mjs?v=20260921-live-lite-2';
const COMMON=`const vec3 LUMA=vec3(.2126,.7152,.0722);
vec3 toLinear(vec3 v){v=max(v,0.);return mix(v/12.92,pow((v+.055)/1.055,vec3(2.4)),step(vec3(.04045),v));}
vec3 toGamma(vec3 v){v=max(v,0.);return mix(v*12.92,1.055*pow(v,vec3(1./2.4))-.055,step(vec3(.0031308),v));}`;
export function installDevelop(r,vertex,prefix){
 const add=(name,code)=>r.programs[name]=r.program(vertex,prefix+code);
 add('gaussian',`uniform sampler2D source;uniform vec2 sigmaUV;void main(){vec4 sum=vec4(0.);float n=0.;for(int i=-16;i<=16;i++){float x=float(i)/5.;float w=exp(-.5*x*x);sum+=texture(source,uv+sigmaUV*x)*w;n+=w;}color=sum/n;}`);
 add('mistExcess',mistExcess+`uniform sampler2D source;uniform float knee;void main(){color=mistExcess(texture(source,uv),knee);}`);
 add('mistMask',mistMask+`uniform sampler2D source;uniform float knee,width;void main(){color=mistMask(texture(source,uv),max(knee-width,0.),knee);}`);
 add('mistFinalize',mistFinalize+`uniform sampler2D source,microTex,bloomTex,veilTex,maskTex;uniform float microAmount,bloomAmount,veilAmount,headroomCap,darkPriority,insidePower,shadowProtection,shadowPower,detailLow,detailHigh;void main(){color=mistFinalize(texture(source,uv),texture(microTex,uv),texture(bloomTex,uv),texture(veilTex,uv),texture(maskTex,uv),microAmount,bloomAmount,veilAmount,headroomCap,darkPriority,insidePower,shadowProtection,shadowPower,detailLow,detailHigh);}`);
 add('exponentialMix',exponentialMix+`uniform sampler2D nearTex,midTex,farTex;void main(){color=exponentialMix(texture(nearTex,uv),texture(midTex,uv),texture(farTex,uv));}`);
 add('reflectionSeed',reflectionSeed+`uniform sampler2D source;uniform vec3 baseColor;void main(){color=reflectionSeed(texture(source,uv),baseColor);}`);
 add('haloComposite',haloComposite+`uniform sampler2D source,redTex,greenTex,blueTex;uniform vec3 baseColor;uniform float reflectionGain,greenGain,blueGain,correctionMode;void main(){color=halationComposite(texture(source,uv),texture(redTex,uv),texture(greenTex,uv),texture(blueTex,uv),baseColor,reflectionGain,greenGain,blueGain,correctionMode);}`);
 add('whiteBalance',COMMON+`uniform sampler2D source;uniform float temperature,tint,negativeExposure;
 // Bradford cone transform, with local temperature/tint-to-cone mapping.
 void main(){vec3 c=toLinear(texture(source,uv).rgb);vec3 xyz=mat3(.4124564,.2126729,.0193339,.3575761,.7151522,.1191920,.1804375,.0721750,.9503041)*c;
 mat3 B=mat3(.8951,-.7502,.0389,.2664,1.7135,-.0685,-.1614,.0367,1.0296);
 vec3 cone=B*xyz;cone*=exp(vec3(temperature*.14+tint*.04,-tint*.07,-temperature*.22+tint*.04));
 xyz=inverse(B)*cone;c=mat3(3.2404542,-.9692660,.0556434,-1.5371385,1.8760108,-.2040259,-.4985314,.0415560,1.0572252)*xyz;
 color=vec4(toGamma(c*exp2(negativeExposure)),1.);}`);
 add('toneRange',toneRange+`uniform sampler2D source;uniform float highlights,shadows,blackPoint,whitePoint;void main(){color=toneRangeSoftLight(source,7.,0.,blackPoint*.7,.18,shadows*.6,.45,shadows*.08,.55,highlights*.06,.8,highlights*.6,.95,whitePoint*.45,1.,whitePoint*.7,1.);}`);
 add('editColor',COMMON+`uniform sampler2D source,blurred;uniform float exposure,contrast,vibrance,colorOffset,sharpen,hdr,ccdNoise,noiseSeed;uniform vec2 originalSize;
 float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+noiseSeed*7.7)*43758.5453);}
 void main(){vec3 c=texture(source,uv).rgb;vec3 b=texture(blurred,uv).rgb;
 c=toGamma(toLinear(c)*exp2(exposure));
 float y=dot(c,LUMA),by=dot(b,LUMA);float local=y-by;
 c+=(c-b)*sharpen*1.5*smoothstep(.006,.045,abs(local));
 float hy=max(y-.55,0.);float compressed=y-hdr*.28*hy*hy+hdr*.08*(1.-smoothstep(.05,.55,y))*y;
 c*=compressed/max(y,.00001);c=mix(c,clamp((c-.5)*exp2(contrast)+.5,0.,1.),abs(contrast)>0.?1.:0.);
 y=dot(c,LUMA);float saturation=max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b);
 // Reduced gain for already saturated pixels, unlike plain saturation.
 c=mix(vec3(y),c,1.+vibrance*(1.-clamp(saturation,0.,1.))*.8);
 c+=colorOffset*vec3(.055,-.018,-.045)*(1.-smoothstep(.6,1.,y));
 vec2 px=floor(uv*originalSize);vec3 n=vec3(noise(px),noise(px+23.7),noise(px+71.3))-.5;
 c+=n*ccdNoise*.10*(.25+.75*(1.-smoothstep(.05,.85,y)));
 color=vec4(clamp(c,0.,1.),1.);}`);
}
function blur(r,source,out,scratch,w,h,sigmaX,sigmaY){
 const a=r.frame(scratch,w,h),b=r.frame(out,w,h);
 r.pass('gaussian',a,w,h,{source},{sigmaUV:[sigmaX,0]});r.pass('gaussian',b,w,h,{source:a.texture},{sigmaUV:[0,sigmaY]});return b.texture;
}
export function preDevelop(r,input,s,w,h){
 if(!(s.temperature||s.tint||s.negativeExposure))return input;
 const out=r.frame(20,w,h);r.pass('whiteBalance',out,w,h,{source:input},{temperature:s.temperature||0,tint:s.tint||0,negativeExposure:s.negativeExposure||0});return out.texture;
}
export function postDevelop(r,input,s,w,h,originalSize){
 let source=input;
 if(s.highlights||s.shadows||s.blackPoint||s.whitePoint){const f=r.frame(21,w,h);r.pass('toneRange',f,w,h,{source},{highlights:s.highlights||0,shadows:s.shadows||0,blackPoint:s.blackPoint||0,whitePoint:s.whitePoint||0});source=f.texture;}
 if(s.exposure||s.contrast||s.vibrance||s.colorOffset||s.sharpen||s.hdr||s.ccdNoise){
  const b=blur(r,source,22,23,w,h,1.2/originalSize[0],1.2/originalSize[1]);const f=r.frame(24,w,h);
  r.pass('editColor',f,w,h,{source,blurred:b},{exposure:s.exposure||0,contrast:s.contrast||0,vibrance:s.vibrance||0,colorOffset:s.colorOffset||0,sharpen:s.sharpen||0,hdr:s.hdr||0,ccdNoise:s.ccdNoise||0,noiseSeed:s.effectSeed||1,originalSize});source=f.texture;
 }
 return source;
}
export function opticalDevelop(r,input,s,w,h,originalSize){
 let source=input;
 const grade=s.blackMistGrade===undefined?(s.bloom>0?Math.min(6,Math.max(1,Math.ceil(s.bloom*6))):0):s.blackMistGrade;
 if(grade>0){
  const p=mistProfile(grade,s.blackMistBoost),diagonal=Math.hypot(...originalSize);
  const radius=which=>Math.max(diagonal*p[which+'RadiusRatio'],p[which+'RadiusMinimum']);
  const micro=blur(r,source,30,31,w,h,radius('micro')/originalSize[0],radius('micro')/originalSize[1]);
  const excess=r.frame(32,w,h),mask=r.frame(33,w,h);r.pass('mistExcess',excess,w,h,{source},{knee:p.highlightKnee});r.pass('mistMask',mask,w,h,{source},{knee:p.highlightKnee,width:p.highlightKneeWidth});
  const down=s.blackMistQuality===0?[4,8]:[2,4];
  const bw=Math.max(1,Math.round(w/down[0])),bh=Math.max(1,Math.round(h/down[0])),vw=Math.max(1,Math.round(w/down[1])),vh=Math.max(1,Math.round(h/down[1]));
  let bloom=blur(r,excess.texture,34,35,bw,bh,radius('bloom')/originalSize[0],radius('bloom')/originalSize[1]);
  let veil=blur(r,excess.texture,36,37,vw,vh,radius('veil')/originalSize[0],radius('veil')/originalSize[1]);
  // Original downscale helper applies radius 1 after upsampling.
  bloom=blur(r,bloom,38,39,w,h,1/originalSize[0],1/originalSize[1]);veil=blur(r,veil,40,39,w,h,1/originalSize[0],1/originalSize[1]);
  const out=r.frame(41,w,h);r.pass('mistFinalize',out,w,h,{source,microTex:micro,bloomTex:bloom,veilTex:veil,maskTex:mask.texture},p);source=out.texture;
 }
 const gradeH=s.halationGrade===undefined?(s.halation>0?Math.min(4,Math.max(1,Math.ceil(s.halation*4))):0):s.halationGrade;
 if(gradeH>0){
  // Original grade factory 0x100627ce0 and render normalization 0x1004f9ab8.
  const reflectionGain=2**[-4.1,-3.35,-2.5,-1.58][Math.max(0,Math.min(3,gradeH-1))];
  const measured=s.measured5219===1?measured5219Optics():null;
  const q=Math.min(1,900/Math.max(w,h)),hw=Math.max(1,Math.round(w*q)),hh=Math.max(1,Math.round(h*q)),seed=r.frame(42,hw,hh),baseColor=measured?.baseColor||[.26/2.26,1/2.26,1/2.26];
  r.pass('reflectionSeed',seed,hw,hh,{source},{baseColor});
  const diffuse=(radius,out)=>{
   const samples=[.35,.85,1.75].map((factor,i)=>{const sigma=Math.max(originalSize[0]/1000*radius*factor,.5);return blur(r,seed.texture,48+i,51,hw,hh,sigma/originalSize[0],sigma/originalSize[1]);});
   const f=r.frame(out,hw,hh);r.pass('exponentialMix',f,hw,hh,{nearTex:samples[0],midTex:samples[1],farTex:samples[2]});return f.texture;
  };
  const radius=measured?.baseBlurAmount??14.07;
  const red=diffuse(radius,43),green=diffuse(radius+(measured?.greenBlurAmount??0),45),blue=diffuse(radius+(measured?.greenBlurAmount??0)+(measured?.blueBlurAmount??.1),46);
  const out=r.frame(47,w,h);r.pass('haloComposite',out,w,h,{source,redTex:red,greenTex:green,blueTex:blue},{baseColor,reflectionGain,greenGain:2**-1.4,blueGain:2**-1.4,correctionMode:2});source=out.texture;
 }
 return source;
}
