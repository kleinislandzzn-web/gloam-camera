// Deliberately reduced live preview: LUT + exposure + blend only.
// Full recipe always runs on shutter. This flag is never persisted to film settings.
export function installColorPreview(r,vertex,prefix){
 r.programs.colorPreview=r.program(vertex,prefix+`
 uniform sampler2D source;uniform sampler3D lut;uniform int size;uniform float exposure,amount;
 vec3 lookup(vec3 c){vec3 q=clamp(c,0.,1.)*float(size-1);ivec3 p=ivec3(floor(q));vec3 t=fract(q),v=vec3(0.);for(int z=0;z<2;z++)for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec3 f=mix(1.-t,t,vec3(x,y,z));v+=texelFetch(lut,min(p+ivec3(x,y,z),ivec3(size-1)),0).rgb*f.x*f.y*f.z;}return clamp(v,0.,1.);}
 vec3 linearRGB(vec3 v){return mix(v/12.92,pow((v+.055)/1.055,vec3(2.4)),step(vec3(.04045),v));}
 vec3 gammaRGB(vec3 v){return mix(v*12.92,1.055*pow(max(v,0.),vec3(1./2.4))-.055,step(vec3(.0031308),v));}
 void main(){vec3 original=texture(source,uv).rgb;vec3 c=gammaRGB(linearRGB(original)*exp2(exposure));color=vec4(mix(original,lookup(c),amount),1.);}`);
}
