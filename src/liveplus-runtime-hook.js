(()=>{'use strict';
const NativeBlob=window.Blob;
if(typeof NativeBlob!=='function'||window.__caosLivePlusRuntimeHook)return;
window.__caosLivePlusRuntimeHook=true;
window.Blob=new Proxy(NativeBlob,{construct(Target,args,newTarget){
  const parts=Array.isArray(args?.[0])?args[0]:[],options=args?.[1]||{};
  const type=String(options?.type||'').toLowerCase();
  if(type.includes('javascript')&&parts.some(p=>typeof p==='string'&&p.includes('function command(d){'))){
    args=[parts.map(part=>{
      if(typeof part!=='string'||!part.includes('function command(d){')||!part.includes('const SPATIAL=96;'))return part;
      if(part.includes('window.CaosLiveCommand=command;'))return part;
      return part.replace('const SPATIAL=96;','window.CaosLiveCommand=command;const SPATIAL=96;');
    }),options];
  }
  return Reflect.construct(Target,args,newTarget===window.Blob?Target:newTarget);
}});
})();
