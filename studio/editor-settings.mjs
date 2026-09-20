import {EXTENDED_DEFAULTS,EXTENDED_CONTROLS} from './extended-effects.mjs';
// Editor ranges below remain local UI mappings except recovered black-mist grades.
export const EDIT_DEFAULTS = Object.freeze({...EXTENDED_DEFAULTS,negativeExposure:0,contrast:0,highlights:0,shadows:0,blackPoint:0,whitePoint:0,temperature:0,tint:0,vibrance:0,colorOffset:0,sharpen:0,hdr:0,shadowGrain:0,ccdNoise:0,blackMistGrade:0,blackMistBoost:0,blackMistQuality:1,halationGrade:0});
export const EDIT_CONTROLS = [
 ...EXTENDED_CONTROLS,
 ['negativeExposure','底片曝光',-200,200,100,'EV','影调'],
 ['contrast','对比',-100,100,100,'','影调'],['highlights','高光',-100,100,100,'','影调'],['shadows','阴影',-100,100,100,'','影调'],['blackPoint','黑点',-100,100,100,'','影调'],['whitePoint','白点',-100,100,100,'','影调'],
 ['temperature','色温',-100,100,100,'','色彩'],['tint','色调',-100,100,100,'','色彩'],['vibrance','鲜明',-100,100,100,'','色彩'],['colorOffset','色彩偏移',-100,100,100,'','色彩'],
 ['sharpen','锐度',0,100,100,'%','细节'],['hdr','高动态范围',0,100,100,'%','细节'],['shadowGrain','暗部颗粒',0,100,100,'%','细节'],['ccdNoise','CCD 噪点',0,100,100,'%','细节'],
];
export const MIST_LABELS=['关闭','1/32','1/16','1/8','1/4','1/2','1'];
export const HALATION_LABELS=['关闭','1/8','1/4','1/2','1'];
