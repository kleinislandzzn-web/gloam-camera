import {installColorPreview} from './preview-color.mjs?v=20260921-live-lite-2';
import {R51_ID,R51_PROFILES} from './r51-profiles.mjs?v=20260921-live-lite-2';
import {installR51,renderR51} from './r51-render.mjs?v=20260921-live-lite-2';
import {MEASURED_5219_ID} from './measured-5219.mjs?v=20260921-live-lite-2';
import {EXTENDED_DEFAULTS,installExtended,extendedTone,extendedFringe,textureGLSL,ccdRadialGLSL} from './extended-effects.mjs?v=20260921-live-lite-2';
import {installDevelop,preDevelop,postDevelop,opticalDevelop} from './develop.mjs?v=20260921-live-lite-2';
import {CCD_RECIPE,coordinates,ccdKernel,aberrationKernel} from './optics.mjs?v=20260921-live-lite-2';
// Event-driven WebGL2 renderer. Recipes are local approximations; see manifest and docs.
export class Renderer {
 constructor(canvas) {
  this.canvas=canvas;const g=this.gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!g)throw Error('当前浏览器未启用 WebGL2，请使用支持 GPU 加速的浏览器。');
  this.floatOptics=!!g.getExtension("EXT_color_buffer_float");this.maxSize=g.getParameter(g.MAX_TEXTURE_SIZE);this.programs={};this.frames=[];
  const vertex=`#version 300 es\nout vec2 uv;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
  const prefix=`#version 300 es\nprecision highp float;precision highp sampler3D;in vec2 uv;out vec4 color;\n`;
  this.programs.grade=this.program(vertex,prefix+`
   uniform sampler2D source;uniform sampler3D lut;uniform float exposure;uniform int size;
   const vec3 Y=vec3(.2126,.7152,.0722);
   vec3 lookup(vec3 c){vec3 q=clamp(c,0.,1.)*float(size-1);ivec3 p=ivec3(floor(q));vec3 t=fract(q),v=vec3(0);for(int z=0;z<2;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec3 f=mix(1.-t,t,vec3(x,y,z));v+=texelFetch(lut,min(p+ivec3(x,y,z),ivec3(size-1)),0).rgb*f.x*f.y*f.z;}return clamp(v,0.,1.);}
   vec3 linearRGB(vec3 v){return mix(v/12.92,pow((v+.055)/1.055,vec3(2.4)),step(vec3(.04045),v));}
   vec3 gammaRGB(vec3 v){return mix(v*12.92,1.055*pow(max(v,0.),vec3(1./2.4))-.055,step(vec3(.0031308),v));}
   void main(){vec3 c=texture(source,uv).rgb;
    c=gammaRGB(linearRGB(clamp(c,0.,1.))*exp2(exposure));color=vec4(lookup(c),1.);
   }`);
  this.programs.aberration=this.program(vertex,prefix+coordinates+aberrationKernel+`
   uniform sampler2D source;uniform float intensity,caPixels;
   void main(){color=rgbChromaticAberration(source,referenceSize*.5,caPixels,0.,-caPixels,intensity,length(referenceSize*.5),3.,0.,0.,.25,0.,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.,1.);}`);
  this.programs.sharpen=this.program(vertex,prefix+`
   uniform sampler2D source,blurred;void main(){vec4 b=texture(source,uv);color=vec4(clamp(b.rgb+(b.rgb-texture(blurred,uv).rgb)*.8,0.,1.),b.a);}`);
  this.programs.ccd=this.program(vertex,prefix+coordinates+ccdRadialGLSL+ccdKernel+`
   uniform sampler2D source,sharpTex,chromaTex,edgeTex;
   uniform float lumaAcutance,chromaSoftness,falseColorAmount,sampleSpread,edgeTextureAmount,edgeJitterAmount,edgeNoiseAmount,opacity;
   void main(){color=ccdSampling(source,sharpTex,chromaTex,edgeTex,lumaAcutance,chromaSoftness,falseColorAmount,sampleSpread,edgeTextureAmount,edgeJitterAmount,edgeNoiseAmount,opacity*ccdSpatialWeight());}`);
  this.programs.seed=this.program(vertex,prefix+`
   uniform sampler2D source;void main(){vec3 c=texture(source,uv).rgb;float y=dot(c,vec3(.2126,.7152,.0722));float m=smoothstep(.58,.96,y);float n=clamp((y-.58)/.42,0.,1.);color=vec4(c*m*n,1.);}`);
  this.programs.blur=this.program(vertex,prefix+`
   uniform sampler2D source;uniform vec2 stepSize;void main(){vec3 v=texture(source,uv).rgb*.227027;v+=(texture(source,uv+stepSize*1.384615).rgb+texture(source,uv-stepSize*1.384615).rgb)*.316216;v+=(texture(source,uv+stepSize*3.230769).rgb+texture(source,uv-stepSize*3.230769).rgb)*.070270;color=vec4(v,1.);}`);
  this.programs.final=this.program(vertex,prefix+`
   uniform sampler2D source,graded,bloomTex,microTex,grainTex,vignetteTex,shadowTex;
   uniform vec2 originalSize,grainSize;uniform float amount,grain,bloom,halation,vignette,hasVignette,hasShadow,shadowGrain,measured5219;
   ${textureGLSL}
   float soft(float b,float o){return o<.5?2.*b*o+b*b*(1.-2.*o):2.*b*(1.-o)+sqrt(max(b,0.))*(2.*o-1.);}
   vec3 grainBlend(vec3 base,vec3 over,float w){vec3 b=pow(clamp(base,0.,1.),vec3(1./2.2)),o=pow(clamp(over,0.,1.),vec3(1./2.2));vec3 s=vec3(soft(b.r,o.r),soft(b.g,o.g),soft(b.b,o.b));return pow(max(mix(b,s,w),0.),vec3(2.2));}
   vec3 linearRGB(vec3 v){return mix(v/12.92,pow((v+.055)/1.055,vec3(2.4)),step(vec3(.04045),v));}
   float labL(vec3 c){float y=dot(linearRGB(clamp(c,0.,1.)),vec3(.2126729,.7151522,.0721750));float f=y>216./24389.?pow(y,1./3.):((24389./27.)*y+16.)/116.;return clamp((116.*f-16.)/100.,0.,1.);}
   float vignetteSoft(float b,float o){float d=b<=.25?((16.*b-12.)*b+4.)*b:sqrt(b);return o<=.5?b-(1.-2.*o)*b*(1.-b):b+(2.*o-1.)*(d-b);}
   void main(){vec3 original=texture(source,uv).rgb;if(amount<=0.){color=vec4(original,1.);return;}
    vec3 c=texture(graded,uv).rgb;vec3 light=texture(bloomTex,uv).rgb;vec3 micro=texture(microTex,uv).rgb;
    float y=dot(c,vec3(.2126,.7152,.0722));c=mix(c,micro,bloom*.11);
    c+=light*bloom*.42*(1.-y); // highlight-derived, headroom-limited glow
    float seed=dot(light,vec3(.2126,.7152,.0722));c+=seed*vec3(1.,.22,.055)*halation*.48*(1.-c);
    float l=labL(c);float weight=grain*mix(1.05,.55,smoothstep(.25,.95,l));
    vec3 tex=texture(grainTex,uv*originalSize*.25/grainSize).rgb;c=applyOriginalGrain(c,tex);
    {vec3 s=hasShadow>.5?texture(shadowTex,uv).rgb:tex;c=grainBlend(c,s,shadowGrain*(1.-smoothstep(.1,.6,l)));}
    if(hasVignette>.5){vec4 overlay=texture(vignetteTex,uv);vec3 o=overlay.rgb;vec3 b=clamp(c,0.,1.);vec3 v=vec3(vignetteSoft(b.r,o.r),vignetteSoft(b.g,o.g),vignetteSoft(b.b,o.b));
     // JPEG texture is already display-encoded here; do not apply linear-to-sRGB twice.
     if(measured5219>.5){float amount=clamp(vignette,0.,2.),alpha=clamp(overlay.a,0.,1.);c=mix(b,v,min(amount,1.)*alpha);if(amount>1.){v=vec3(vignetteSoft(c.r,o.r),vignetteSoft(c.g,o.g),vignetteSoft(c.b,o.b));c=mix(c,v,(amount-1.)*alpha);}}
     else c=mix(b,v,vignette);
    }
    else{float r=length((uv-.5)*vec2(1.,1.));c*=1.-vignette*.32*smoothstep(.18,.70,r);}
    if(vignetteTone>0.)c=applyVignetteResponse(c);
    color=vec4(mix(original,clamp(c,0.,1.),amount),1.);
   }`);
  installDevelop(this,vertex,prefix);installExtended(this,vertex,prefix);
  this.ensureColorPreview=()=>{if(!this.programs.colorPreview)installColorPreview(this,vertex,prefix);};
  this.ensureR51=()=>{if(!this.programs.r51Output)installR51(this,vertex,prefix);};
  this.source=this.texture();this.grain=this.texture(true);this.vignette=this.texture();this.shadow=this.texture();this.lut=g.createTexture();this.lastImages={};this.lastTable=null;
 }
 program(v,f){const g=this.gl,p=g.createProgram();for(const [type,text] of [[g.VERTEX_SHADER,v],[g.FRAGMENT_SHADER,f]]){const s=g.createShader(type);g.shaderSource(s,text);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));g.attachShader(p,s);g.deleteShader(s);}g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw Error(g.getProgramInfoLog(p));return p;}
 texture(repeat=false){const g=this.gl,t=g.createTexture();g.bindTexture(g.TEXTURE_2D,t);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);for(const p of [g.TEXTURE_WRAP_S,g.TEXTURE_WRAP_T])g.texParameteri(g.TEXTURE_2D,p,repeat?g.REPEAT:g.CLAMP_TO_EDGE);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,1,1,0,g.RGBA,g.UNSIGNED_BYTE,new Uint8Array([128,128,128,255]));return t;}
 image(key,texture,img){if(!img||this.lastImages[key]===img)return;const g=this.gl;g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,texture);g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,true);g.pixelStorei(g.UNPACK_COLORSPACE_CONVERSION_WEBGL,g.NONE);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,img);if(key==='grain'){g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR_MIPMAP_LINEAR);}g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL,false);this.lastImages[key]=img;}
 frame(index,w,h){const g=this.gl;let f=this.frames[index];if(!f){f=this.frames[index]={texture:this.texture(),buffer:g.createFramebuffer()};}if(f.w!==w||f.h!==h){g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,f.texture);g.texImage2D(g.TEXTURE_2D,0,index>=30&&this.floatOptics?g.RGBA16F:g.RGBA,w,h,0,g.RGBA,index>=30&&this.floatOptics?g.HALF_FLOAT:g.UNSIGNED_BYTE,null);g.bindFramebuffer(g.FRAMEBUFFER,f.buffer);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,f.texture,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('GPU framebuffer 分配失败');f.w=w;f.h=h;}return f;}
 pass(name,frame,w,h,textures,uniforms={}){const g=this.gl,p=this.programs[name];g.useProgram(p);g.bindFramebuffer(g.FRAMEBUFFER,frame?.buffer||null);g.viewport(0,0,w,h);let i=0;for(const [name,t] of Object.entries(textures)){g.activeTexture(g.TEXTURE0+i);g.bindTexture(name==='lut'?g.TEXTURE_3D:g.TEXTURE_2D,t);g.uniform1i(g.getUniformLocation(p,name),i++);}for(const [name,v] of Object.entries(uniforms)){const loc=g.getUniformLocation(p,name);if(Array.isArray(v)){if(v.length===3)g.uniform3fv(loc,v);else g.uniform2fv(loc,v);}else if(name==='size')g.uniform1i(loc,v);else g.uniform1f(loc,v);}g.drawArrays(g.TRIANGLES,0,3);}
 render(image,prepared,settings,width,height,originalSize,options={}){
  settings={...EXTENDED_DEFAULTS,...settings,measured5219:prepared.presetId===MEASURED_5219_ID&&settings.measured5219===1?1:0};
  const g=this.gl;if(width>this.maxSize||height>this.maxSize)throw Error(`图片超过 GPU 最大尺寸 ${this.maxSize}`);if(this.canvas.width!==width)this.canvas.width=width;if(this.canvas.height!==height)this.canvas.height=height;
  this.image('source',this.source,image);if(!options.colorPreview){this.image('grain',this.grain,prepared.grain);this.image('vignette',this.vignette,prepared.vignette);this.image('shadow',this.shadow,prepared.shadow);}
  if(this.lastTable!==prepared.table){g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_3D,this.lut);g.pixelStorei(g.UNPACK_ALIGNMENT,1);g.texImage3D(g.TEXTURE_3D,0,g.RGB32F,prepared.size,prepared.size,prepared.size,0,g.RGB,g.FLOAT,prepared.table);for(const p of [g.TEXTURE_MIN_FILTER,g.TEXTURE_MAG_FILTER])g.texParameteri(g.TEXTURE_3D,p,g.NEAREST);this.lastTable=prepared.table;}
  if(options.colorPreview){this.ensureColorPreview();this.pass('colorPreview',null,width,height,{source:this.source,lut:this.lut},{size:prepared.size,exposure:settings.exposure||0,amount:settings.amount??1});const err=g.getError();if(err!==g.NO_ERROR)throw Error('颜色预览 GPU 错误 '+err);return this.canvas;}
  if(prepared.presetId===R51_ID&&Object.hasOwn(R51_PROFILES,settings.r51Profile))return renderR51(this,prepared,settings,width,height);
  const a=this.frame(0,width,height);const ratio=Math.min(1,440/Math.max(width,height)),bw=Math.max(1,Math.round(width*ratio)),bh=Math.max(1,Math.round(height*ratio));const b=this.frame(1,bw,bh),c=this.frame(2,bw,bh),d=this.frame(3,bw,bh),micro=this.frame(4,bw,bh);
  // Fix spatial scale across preview/export; original preset resolution policy is still unknown.
  const factor=1400/Math.max(...originalSize),referenceSize=originalSize.map(v=>v*factor);
  let optical=this.source;
  if(settings.aberration>0){const ca=this.frame(5,width,height);this.pass('aberration',ca,width,height,{source:optical},{referenceSize,intensity:settings.aberration,caPixels:settings.caPixels??1.7});optical=ca.texture;}
  if(settings.ccd>0){
   const tmp=this.frame(6,width,height),chroma=this.frame(7,width,height),edges=this.frame(8,width,height),sharp=this.frame(9,width,height),ccd=this.frame(10,width,height);
   this.pass('blur',tmp,width,height,{source:optical},{stepSize:[1.1/referenceSize[0],0]});
   this.pass('blur',chroma,width,height,{source:tmp.texture},{stepSize:[0,1.1/referenceSize[1]]});
   this.pass('sharpen',sharp,width,height,{source:optical,blurred:chroma.texture});
   this.pass('blur',tmp,width,height,{source:optical},{stepSize:[2.2/referenceSize[0],0]});
   this.pass('blur',edges,width,height,{source:tmp.texture},{stepSize:[0,2.2/referenceSize[1]]});
   this.pass('ccd',ccd,width,height,{source:optical,sharpTex:sharp.texture,chromaTex:chroma.texture,edgeTex:edges.texture},{referenceSize,...CCD_RECIPE,opacity:settings.ccd,ccdCenter:settings.ccdCenter,ccdEdge:settings.ccdEdge});optical=ccd.texture;
  }
  optical=preDevelop(this,optical,settings,width,height);
  this.pass('grade',a,width,height,{source:optical,lut:this.lut},{size:prepared.size,exposure:0});
  let developed=postDevelop(this,a.texture,settings,width,height,originalSize);
  developed=extendedTone(this,developed,settings,width,height);
  developed=opticalDevelop(this,developed,settings,width,height,originalSize);
  developed=extendedFringe(this,developed,settings,width,height,referenceSize);
  this.pass('final',null,width,height,{source:this.source,graded:developed,bloomTex:developed,microTex:developed,grainTex:this.grain,vignetteTex:this.vignette,shadowTex:this.shadow},{...settings,bloom:0,halation:0,shadowGrain:settings.shadowGrain??0,originalSize,grainSize:[prepared.grain?.naturalWidth||1,prepared.grain?.naturalHeight||1],hasVignette:prepared.vignette?1:0,hasShadow:prepared.shadow?1:0});
  const err=g.getError();if(err!==g.NO_ERROR)throw Error(`WebGL 错误 ${err}`);return this.canvas;
 }
}
export class Assets {
 constructor(manifest){this.manifest=manifest;this.images=new Map();this.tables=new Map();this.prepared=new Map();}
 image(path){if(!path)return Promise.resolve(null);if(!this.images.has(path))this.images.set(path,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{this.images.delete(path);reject(Error('无法读取图片 '+path));};im.src=new URL(path,import.meta.url).href;}));return this.images.get(path);}
 table(id){if(!this.tables.has(id))this.tables.set(id,(async()=>{const meta=this.manifest.tables[id],r=await fetch(new URL(meta.path,import.meta.url));if(!r.ok)throw Error('无法读取色表 '+meta.path);const b=await r.arrayBuffer();const t=meta.format==='u8'?Float32Array.from(new Uint8Array(b),v=>v/255):new Float32Array(b);if(t.length!==meta.size**3*3||!t.every(Number.isFinite))throw Error('色表数据无效');return t;})());return this.tables.get(id);}
 async prepare(preset,index=2,kelvin=5200){const key=[preset.id,index,kelvin].join(':');if(this.prepared.has(key))return this.prepared.get(key);const task=(async()=>{if(!preset.available)throw Error(preset.missing);let nodes;
  if(preset.kind==='cube')nodes=[{node:preset.nodes[0],weight:1}];
  else{const i0=Math.floor(index),i1=Math.ceil(index),ks=[3500,5200,6500],k0=[...ks].reverse().find(k=>k<=kelvin)??3500,k1=ks.find(k=>k>=kelvin)??6500,kt=k0===k1?0:(kelvin-k0)/(k1-k0);const iw=i0===i1?[[i0,1]]:[[i0,1-(index-i0)],[i1,index-i0]],kw=k0===k1?[[k0,1]]:[[k0,1-kt],[k1,kt]];nodes=iw.flatMap(([i,a])=>kw.map(([k,b])=>({node:preset.nodes.find(n=>n.index===i&&n.kelvin===k),weight:a*b}))).filter(n=>n.weight>0);if(nodes.some(n=>!n.node))throw Error('缺少矩阵节点');}
  const values=await Promise.all(nodes.map(n=>this.table(n.node.table)));let table=values[0];if(nodes.length>1){table=new Float32Array(values[0].length);for(let n=0;n<nodes.length;n++)for(let i=0;i<table.length;i++)table[i]+=values[n][i]*nodes[n].weight;}
  const [grain,vignette,shadow]=await Promise.all([this.image(preset.grain),this.image(preset.vignetteTexture),this.image(preset.shadowTexture)]);return {presetId:preset.id,table,size:this.manifest.tables[nodes[0].node.table].size,grain,vignette,shadow};})();this.prepared.set(key,task);if(this.prepared.size>60)this.prepared.delete(this.prepared.keys().next().value);return task;}
}
