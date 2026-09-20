import {EDIT_DEFAULTS} from './editor-settings.mjs';
import {FINISH_DEFAULTS} from './finish.mjs';

const prefix='gloam.film-settings.v1.';
const memory=new Map();
// User-requested camera defaults. The initial GRD grade is provisional, not a recovered factory default.
export const GRD_DEFAULT_MIST_GRADE=3; // 1/8; native grade coefficients, local initial selection.
export const MIST_POLICY_VERSION=2;
export const cameraMistDefaults=p=>({blackMistGrade:p.family==='GRD'?GRD_DEFAULT_MIST_GRADE:0,blackMistBoost:0,blackMistQuality:1});
export const defaultFilmSettings=p=>({...p.recipe,...EDIT_DEFAULTS,...FINISH_DEFAULTS,amount:1,exposure:0,node:2,kelvin:5200,caPixels:1.7,...cameraMistDefaults(p)});
export function readFilmSettings(p){
 const defaults=defaultFilmSettings(p);
 try{let saved=memory.get(p.id)||JSON.parse(localStorage.getItem(prefix+p.id)||'null');
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
 const saved={...s,__mistPolicy:MIST_POLICY_VERSION};memory.set(p.id,saved);
 try{localStorage.setItem(prefix+p.id,JSON.stringify(saved));return true;}catch{return false;}
}
export function filmIsEdited(p){return JSON.stringify(readFilmSettings(p))!==JSON.stringify(defaultFilmSettings(p));}
export function colorOnlySettings(p,s=readFilmSettings(p)){
 return {...defaultFilmSettings(p),blackMistGrade:0,blackMistBoost:0,grain:0,shadowGrain:0,vignette:0,ccd:0,aberration:0,bloom:0,halation:0,node:s.node,kelvin:s.kelvin};
}
