(()=>{'use strict';
if(window.__caosNecromancerManifestSync)return;
const Session=window.LivePlusGameSession;
if(typeof Session!=='function')return;
const proto=Session.prototype,original=proto.connect;
if(typeof original!=='function')return;
function sync(session){
 const manifest=window.CaosLivePlus?.manifest;
 if(!manifest||!Array.isArray(manifest.actions))return false;
 try{
  if(typeof session.setManifest==='function')session.setManifest(manifest);
  else session.manifest=manifest;
  return true;
 }catch(error){console.warn('NECRO LIVE+ MANIFEST SYNC',error);return false}
}
proto.connect=function(...args){
 sync(this);
 const out=original.apply(this,args);
 Promise.resolve(out).then(()=>{sync(this);setTimeout(()=>sync(this),250);setTimeout(()=>sync(this),900)}).catch(()=>{});
 return out;
};
window.__caosNecromancerManifestSync={version:'1.0.0',sync,actions:()=>window.CaosLivePlus?.manifest?.actions?.filter(a=>String(a.id||'').startsWith('necro_')).map(a=>a.id)||[]};
})();