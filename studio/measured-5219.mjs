// Partial capture recipe, NOT recovered scene-dependent defaults or pixel parity.
// Capture: device-install/capture/t3-5219e-targeted-result.json (user-requested no-flash).
export const MEASURED_5219_ID='T3_5219';
export const MEASURED_5219_VERSION=1;
export const MEASURED_5219_LABEL='无闪实测试片 · 部分参数';
export const MEASURED_5219_NOTE='暗角、光晕颜色及三层半径接入无闪场景实测记录；合成增益和未测通道仍用临时配方，尚未恢复自动调参。';
export const measured5219Defaults=p=>p.id===MEASURED_5219_ID?{
 measured5219:1,vignette:0.9626476,
 // A local audition choice: no runtime gain/grade was captured. Do not label it measured.
 halationGrade:1,
}:{};
export function measured5219Optics(){
 const raw=[0.489851,0.255074,0.255074],sum=raw.reduce((a,b)=>a+b,0);
 // All three observed Gaussian calls recover the same base pixel radius.
 // Using seed extent width 3952 as the blur reference is a static-path inference.
 const baseBlurAmount=(7.107886314392089/0.35)*1000/3952;
 return {baseColor:raw.map(v=>v/sum),baseBlurAmount,
  // These unmeasured channel increments are retained from the existing grade factory.
  greenBlurAmount:0,blueBlurAmount:0.1};
}
