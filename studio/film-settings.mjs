import {R51_ID,r51Defaults} from './r51-profiles.mjs?v=20260921-live-measured-1';
import {EDIT_DEFAULTS} from './editor-settings.mjs?v=20260921-live-measured-1';
import {FINISH_DEFAULTS} from './finish.mjs?v=20260921-live-measured-1';
import {measured5219Defaults,MEASURED_5219_ID,MEASURED_5219_VERSION} from './measured-5219.mjs?v=20260921-live-measured-1';

const prefix='gloam.film-settings.v1.';
const memory=new Map();
// User-requested camera defaults. The initial GRD grade is provisional, not a recovered factory default.
export const GRD_DEFAULT_MIST_GRADE=3; // 1/8; native grade coefficients, local initial selection.
export const MIST_POLICY_VERSION=2;
export const cameraMistDefaults=p=>({blackMistGrade:p.family==='GRD'?GRD_DEFAULT_MIST_GRADE:0,blackMistBoost:0,blackMistQuality:1});
export const defaultFilmSettings=p=>({...p.recipe,...EDIT_DEFAULTS,...FINISH_DEFAULTS,amount:1,exposure:0,node:2,kelvin:5200,caPixels:1.7,...cameraMistDefaults(p),...measured5219Defaults(p),...r51Defaults(p)});
export function readFilmSettings(p){
 const defaults=defaultFilmSettings(p);
 try{let saved=memory.get(p.id)||JSON.parse(localStorage.getItem(prefix+p.id)||'null');
  if(saved&&p.id===MEASURED_5219_ID&&saved.__measured5219!==MEASURED_5219_VERSION){
   // Keep a recoverable copy; only replace values matching the previous defaults.
   try{localStorage.setItem(prefix+p.id+'.before-measured-v1',JSON.stringify(saved));}catch{}
   saved={...saved,measured5219:1,__measured5219:MEASURED_5219_VERSION};
   if(saved.vignette===p.recipe.vignette)saved.vignette=defaults.vignette;
   if(saved.halationGrade===EDIT_DEFAULTS.halationGrade)saved.halationGrade=defaults.halationGrade;
   memory.set(p.id,saved);try{localStorage.setItem(prefix+p.id,JSON.stringify(saved));}catch{}
  }
  if(saved&&p.id===R51_ID&&saved.__r51Measured!==1){
   try{localStorage.setItem(prefix+p.id+'.before-r51-measured-v1',JSON.stringify(saved));}catch{}
   // Replace only untouched legacy defaults; preserve explicit user adjustments.
   const old={...p.recipe,...EDIT_DEFAULTS,...cameraMistDefaults(p)},patch=r51Defaults(p);
   for(const [key,value] of Object.entries(patch))if(!(key in saved)||saved[key]===old[key])saved[key]=value;
   saved.r51Profile='noflash';saved.__r51Measured=1;memory.set(p.id,saved);
   try{localStorage.setItem(prefix+p.id,JSON.stringify(saved));}catch{}
  }
  // Migrate only mist settings once; retain all other per-film edits. Subsequent manual changes persist.
  if(saved&&typeof saved==='object'&&saved.__mistPolicy!==MIST_POLICY_VERSION){
   saved={...saved,...cameraMistDefaults(p),__mistPolicy:MIST_POLICY_VERSION};memory.set(p.id,saved);
   try{localStorage.setItem(prefix+p.id,JSON.stringify(saved));}catch{}
  }
  if(saved&&typeof saved==='object')for(const key of Object.keys(defaults)){
   if(typeof saved[key]===typeof defaults[key]&&(typeof saved[key]!=='number'||Number.isFinite(saved[key])))defaults[key]=saved[key];
  }
 }catch{}
 return defaults;
}
export function saveFilmSettings(p,s){
 const saved={...s,...(p.id===R51_ID?{__r51Measured:1}:{}),__mistPolicy:MIST_POLICY_VERSION,...(p.id===MEASURED_5219_ID?{__measured5219:MEASURED_5219_VERSION}:{})};memory.set(p.id,saved);
 try{localStorage.setItem(prefix+p.id,JSON.stringify(saved));return true;}catch{return false;}
}
export function filmIsEdited(p){return JSON.stringify(readFilmSettings(p))!==JSON.stringify(defaultFilmSettings(p));}
export function colorOnlySettings(p,s=readFilmSettings(p)){
 return {...defaultFilmSettings(p),blackMistGrade:0,blackMistBoost:0,grain:0,shadowGrain:0,vignette:0,ccd:0,aberration:0,bloom:0,halation:0,halationGrade:0,measured5219:0,r51Profile:"color",highlightShoulder:0,blueFringe:0,node:s.node,kelvin:s.kelvin};
}
