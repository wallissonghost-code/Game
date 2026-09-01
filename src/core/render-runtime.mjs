export function createRenderState(){
  return {
    W:0,
    H:0,
    dpr:1,
    raf:0,
    pointer:null,
    perfMode:0,
    perfFrames:0,
    perfWindowStart:performance.now(),
    perfLastFps:60,
    renderScale:1,
    frameSeq:0,
    damageFx:[],
    arcFx:[],
    shockFx:[],
    explosionFx:[],
    meteorShakeLeft:0
  };
}

export function assertRenderState(){
  const s=createRenderState();
  if(s.dpr!==1||s.renderScale!==1||!Array.isArray(s.damageFx))throw new Error('CAOS render state invalid');
  return true;
}
