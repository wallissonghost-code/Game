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
      let out=part;
      if(!out.includes('window.CaosLiveCommand=command;'))out=out.replace('const SPATIAL=96;','window.CaosLiveCommand=command;const SPATIAL=96;');
      if(!out.includes('LIVEPLUS_METEOR_DODGE')&&out.includes('function autoVector(dt){')){
        const inject=`function autoVector(dt){/*LIVEPLUS_METEOR_DODGE*/\n  const activeMeteors=meteors.filter(m=>!m.hit&&m.warningLeft>0);\n  if(activeMeteors.length){\n    const threats=activeMeteors.filter(m=>{const d=Math.hypot(player.x-m.x,player.y-m.y),margin=player.r+44,windowSec=Math.max(1.15,(m.warningTotal||m.warningLeft)*.92);return d<m.r+margin&&m.warningLeft<=windowSec});\n    if(threats.length){\n      const now=performance.now(),hold=autoVector.__meteorEscape;\n      if(!hold||now>=hold.until){\n        let bestX=0,bestY=0,bestScore=-Infinity;const prevX=hold?.x||autoMoveX||0,prevY=hold?.y||autoMoveY||0;\n        for(let i=0;i<20;i++){\n          const a=i*Math.PI*2/20,cx=Math.cos(a),cy=Math.sin(a),probe=155,px=player.x+cx*probe,py=player.y+cy*probe;let score=0,minClear=Infinity;\n          for(const m of activeMeteors){const urgency=1/Math.max(.18,m.warningLeft),clear=Math.hypot(px-m.x,py-m.y)-m.r;minClear=Math.min(minClear,clear);score+=Math.min(180,clear)*urgency*.72;if(clear<player.r+18)score-=900+(player.r+18-clear)*20}\n          for(const e of enemies){if(e.dead)continue;const d=Math.hypot(px-e.x,py-e.y),boss=!!types[e.type]?.boss,avoid=(boss?260:150)+e.r;if(d<avoid)score-=(avoid-d)*(boss?5.2:2.1)}\n          score+=Math.max(-1,Math.min(1,cx*prevX+cy*prevY))*34;if(minClear>player.r+52)score+=85;\n          if(score>bestScore){bestScore=score;bestX=cx;bestY=cy}\n        }\n        autoVector.__meteorEscape={x:bestX,y:bestY,until:now+230};\n      }\n      const esc=autoVector.__meteorEscape||{x:0,y:0},blend=1-Math.exp(-dt*13);autoMoveX=autoMoveX*(1-blend)+esc.x*blend;autoMoveY=autoMoveY*(1-blend)+esc.y*blend;const n=Math.hypot(autoMoveX,autoMoveY)||1;autoMoveX/=n;autoMoveY/=n;autoMoveStrength+=(1-autoMoveStrength)*(1-Math.exp(-dt*14));autoRetreatActive=true;return{x:autoMoveX*autoMoveStrength,y:autoMoveY*autoMoveStrength};\n    }\n    autoVector.__meteorEscape=null;\n  }else autoVector.__meteorEscape=null;`;
        out=out.replace('function autoVector(dt){',inject);
      }
      return out;
    }),options];
  }
  return Reflect.construct(Target,args,newTarget===window.Blob?Target:newTarget);
}});
})();
