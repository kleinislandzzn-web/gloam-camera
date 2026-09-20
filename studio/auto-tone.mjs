// Local, explicit single-photo suggestion. This is not Gloam's recovered AutoParameterEngine.
export function suggestTone(data){
 const histogram=new Uint32Array(256);let n=0;
 for(let i=0;i<data.length;i+=4){if(data[i+3]===0)continue;histogram[Math.round(.2126*data[i]+.7152*data[i+1]+.0722*data[i+2])]++;n++;}
 if(!n)return null;
 const quantile=q=>{let sum=0;for(let i=0;i<256;i++){sum+=histogram[i];if(sum>=Math.max(1,n*q))return i/255;}return 1;};
 const low=quantile(.05),mid=quantile(.5),high=quantile(.98),clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 // Reject flat frames: no reliable tonal evidence and no recoverable texture.
 if(high-low<.025)return null;
 return {exposure:clamp(Math.log2(.45/Math.max(.05,mid))*.45,-.7,.7),shadows:clamp((.18-low)*1.5,0,.4),highlightRecovery:clamp((high-.82)*2.5,0,.45)};
}
