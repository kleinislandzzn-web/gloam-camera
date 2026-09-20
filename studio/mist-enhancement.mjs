import {MIST_PRESETS} from './mist-presets.mjs';
/** Local visibility tuning, not recovered Gloam parameters. Zero preserves the recovered baseline. */
export function mistProfile(grade,boost=0){
 const base=MIST_PRESETS[Math.min(5,Math.max(0,Math.round(grade)-1))];
 const t=Math.max(0,Math.min(1,Number(boost)||0));
 if(!t)return base;
 return {...base,
  highlightKnee:base.highlightKnee-.22*t,
  highlightKneeWidth:base.highlightKneeWidth+.06*t,
  microAmount:Math.min(.72,base.microAmount*(1+2.2*t)),
  bloomAmount:base.bloomAmount*(1+3*t),
  veilAmount:base.veilAmount*(1+2*t),
  shadowProtection:base.shadowProtection*(1-.7*t),
  bloomRadiusRatio:base.bloomRadiusRatio*(1+.5*t),
  veilRadiusRatio:base.veilRadiusRatio*(1+.25*t)
 };
}
