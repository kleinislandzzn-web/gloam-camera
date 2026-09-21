// Recovered CI kernels + captured parameters. Pass order, blur, texture placement,
// curve interpolation and grainStrength mapping are browser approximations; see restoration/r51-measured/README.md.
import {R51_PROFILES} from './r51-profiles.mjs?v=20260921-live-lite-2';
import {coordinates,aberrationKernel} from './optics.mjs?v=20260921-live-lite-2';
import {highlightShoulder,fringeSeed,fringeComposite,grainOriginal,vignetteResponse} from './extended-kernels.mjs?v=20260921-live-lite-2';
import {preDevelop,postDevelop,opticalDevelop} from './develop.mjs?v=20260921-live-lite-2';
import {extendedTone} from './extended-effects.mjs?v=20260921-live-lite-2';
export function installR51(r,vertex,prefix){
 const add=(name,body)=>r.programs[name]=r.program(vertex,prefix+body);
 add('r51CA',coordinates+aberrationKernel+`uniform sampler2D source;uniform float intensity;void main(){color=rgbChromaticAberration(source,referenceSize*.5,-.4732142857142918,0.,-4.0703125,intensity,length(referenceSize*.5),3.,0.,0.,.67,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.);}`);
 add('r51Sharp',`uniform sampler2D source,blurred;uniform float amount;void main(){vec4 b=texture(source,uv);color=vec4(clamp(b.rgb+(b.rgb-texture(blurred,uv).rgb)*amount,0.,1.),b.a);}`);
 add('r51Pixel',coordinates+`uniform sampler2D source;uniform float scale,opacity;void main(){vec2 p=destCoord()-referenceSize*.5;vec2 q=(floor(p/scale)+.5)*scale+referenceSize*.5;color=mix(texture(source,uv),texture(source,q/referenceSize),opacity);}`);
 add('r51Curve',`uniform sampler2D source;uniform float blackInput,midOutput;float curve(float x){float a=clamp((x-blackInput)/(.75294117647-blackInput),0.,1.)*.76470588235;float b=mix(.76470588235,1.,clamp((x-.75294117647)/.24705882353,0.,1.));float y=x<.75294117647?a:b;return y<.49803921569?y/.49803921569*midOutput:y<.75294117647?mix(midOutput,.75294117647,(y-.49803921569)/.25490196078):y;}void main(){vec4 c=texture(source,uv);color=vec4(curve(c.r),curve(c.g),curve(c.b),c.a);}`);
 add('r51Shoulder',highlightShoulder+`uniform sampler2D source;uniform float threshold,rolloff,compression,desaturation,whiteBlend,opacity;void main(){color=highlightShoulder(texture(source,uv),threshold,rolloff,compression,desaturation,whiteBlend,opacity);}`);
 add('r51FringeSeed',coordinates+fringeSeed+`uniform sampler2D source;void main(){color=highlightBlueFringeSeed(source,.92,.13,7.2,1.18,.008);}`);
 add('r51Fringe',coordinates+fringeComposite+`uniform sampler2D source,innerTex,outerTex;uniform float opacity;void main(){color=highlightBlueFringeComposite(source,innerTex,outerTex,1.1,-.64,.64,opacity);}`);
 add('r51Bloom',coordinates+`uniform sampler2D source,blurred;void main(){vec4 c=texture(source,uv);float rad=clamp(length((uv-.5)*referenceSize)/length(referenceSize*.5),0.,1.);float m=mix(.33,1.,smoothstep(0.,1.,rad));vec3 glow=texture(blurred,uv).rgb*.05*m;color=vec4(1.-(1.-c.rgb)*(1.-glow),c.a);}`);
 add('r51Texture',grainOriginal+vignetteResponse+coordinates+`
 uniform sampler2D source,grainTex,shadowTex;uniform vec2 grainSize;uniform float grain,shadowGrain,vignette,grainShadow,grainMid,hasShadow;
 void main(){vec4 c=texture(source,uv);vec4 t=texture(grainTex,uv*referenceSize/grainSize);
 c=lusterGrainSoftLight(c,t,4.,0.,0.,.17,.5*grain*grainShadow,.41,.2*grain*grainMid,1.,0.,1.,0.,1.,0.,1.,0.,1.,0.,1.,0.);
 if(hasShadow>.5)c.rgb=1.-(1.-c.rgb)*(1.-texture(shadowTex,uv).rgb*shadowGrain);
 float rad=length((uv-.5)*referenceSize)/length(referenceSize*.5);float m=pow(smoothstep(.2,1.,rad),1.49940688467);
 c=vignetteToneResponse(c,vec4(m),vignette,.72,.45,.9,.7,.08);
 c.rgb=mix(c.rgb,c.rgb*vec3(.96,1.,1.06),m*.12*clamp(vignette/.78,0.,1.));color=c;}`);
 add('r51Output',`uniform sampler2D source,processed;uniform float amount;void main(){color=vec4(mix(texture(source,uv).rgb,clamp(texture(processed,uv).rgb,0.,1.),amount),1.);}`);
}
export function renderR51(r,prepared,s,width,height){
 r.ensureR51();
 const profile=R51_PROFILES[s.r51Profile],e=profile.specialEffects,a=profile.adjustments;
 const scale=Math.min(1,2600/Math.max(width,height)),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
 const referenceSize=[w,h].map(x=>x*2600/Math.max(w,h));
 // Reuse frames across calls. Reference pixels stay at native output long side 2600.
 const slots=[0,1,2,3,4,5,6,7,2,1,2,1,3,4,5,3,1,2,3,1];
 const f=i=>r.frame(70+slots[i],w,h),pass=(name,i,textures,u={})=>{r.pass(name,f(i),w,h,textures,{referenceSize,...u});return f(i).texture;};
 const blur=(input,radius,out)=>{pass('gaussian',0,{source:input},{sigmaUV:[radius/referenceSize[0],0]});return pass('gaussian',out,{source:f(0).texture},{sigmaUV:[0,radius/referenceSize[1]]});};
 let source=preDevelop(r,r.source,s,w,h);
 if(s.aberration>0)source=pass('r51CA',1,{source},{intensity:s.aberration});
 if(s.ccd>0){const p=e.ccdSampling.parameters;
  const low=blur(source,p.acutanceRadius,2),sharp=pass('r51Sharp',3,{source,blurred:low},{amount:1});
  const chroma=blur(source,p.chromaSoftnessRadius,4),edge=blur(source,p.edgeTextureRadius,5);
  source=pass('ccd',6,{source,sharpTex:sharp,chromaTex:chroma,edgeTex:edge},{...p,opacity:s.ccd,ccdCenter:s.ccdCenter,ccdEdge:s.ccdEdge});
 }
 source=pass('r51Pixel',7,{source},e.pixelate.parameters);
 source=pass('r51Curve',8,{source},{blackInput:a.autoToneCurve.parameters.controlPoints[0].input,midOutput:a.autoToneCurve.parameters.additionalStages[0].controlPoints[1].output});
 source=pass('grade',9,{source,lut:r.lut},{size:prepared.size,exposure:0});
 source=pass('r51Shoulder',10,{source},{...a.highlightShoulder.parameters,opacity:s.highlightShoulder});
 source=postDevelop(r,source,s,w,h,referenceSize);
 source=extendedTone(r,source,{...s,highlightShoulder:0},w,h);
 source=opticalDevelop(r,source,s,w,h,referenceSize);
 if(s.blueFringe>0){const p=e.highlightBlueFringe.parameters,seed=pass('r51FringeSeed',11,{source});
  const inner=blur(seed,p.innerRadius,12),outer=blur(seed,p.outerRadius,13);
  source=pass('r51Fringe',14,{source,innerTex:inner,outerTex:outer},{opacity:s.blueFringe});
 }
 const bloom=blur(source,e.bloomGloom.parameters.radius,15);source=pass('r51Bloom',16,{source,blurred:bloom});
 source=pass('r51Texture',17,{source,grainTex:r.grain,shadowTex:r.shadow},{...s,grainSize:[prepared.grain?.naturalWidth||1,prepared.grain?.naturalHeight||1],hasShadow:prepared.shadow?1:0});
 const sharpen=blur(source,e.sharpen.parameters.radius,18);source=pass('r51Sharp',19,{source,blurred:sharpen},{amount:e.sharpen.parameters.amount});
 r.pass('r51Output',null,width,height,{source:r.source,processed:source},{amount:s.amount});
 const error=r.gl.getError();if(error!==r.gl.NO_ERROR)throw Error('R-51 WebGL 错误 '+error);return r.canvas;
}
