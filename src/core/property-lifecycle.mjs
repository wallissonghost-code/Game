import {LandMarketError} from './land-market.mjs';

const POLICY=Object.freeze({
  maxCoverage:.80,
  maxFloors:20,
  constructionBasePerM2:850,
  demolitionRate:.08,
  demolitionMin:2500,
  qualityMultipliers:{basic:.85,standard:1,premium:1.35,luxury:1.8},
  typeMultipliers:{house:1,commercial:1.15,industrial:1.3,apartment:1.4}
});

const money=v=>Math.round(Number(v)*100)/100;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const text=(v,max=100)=>String(v??'').trim().slice(0,max);
const clone=v=>JSON.parse(JSON.stringify(v));
const assert=(ok,code,message,details={})=>{if(!ok)throw new LandMarketError(code,message,details)};

function normalizePlan(plan={}){
  const type=['house','commercial','industrial','apartment'].includes(plan.type)?plan.type:'house';
  const quality=['basic','standard','premium','luxury'].includes(plan.quality)?plan.quality:'standard';
  const floors=Math.max(1,Math.min(POLICY.maxFloors,Math.trunc(finite(plan.floors,1))));
  const footprintM2=Math.max(1,money(finite(plan.footprintM2,1)));
  return{
    type,quality,floors,footprintM2,
    totalAreaM2:money(footprintM2*floors),
    modelAsset:text(plan.modelAsset||'',180),
    name:text(plan.name||'',80)
  };
}

function activeListing(snapshot,landUid){
  return (snapshot.listings||[]).find(x=>x.landUid===landUid&&x.status==='active')||null;
}

function mutableLand(snapshot,landUid){
  return (snapshot.lands||[]).find(x=>x.uid===landUid)||null;
}

function appendHistory(land,event,max=80){
  land.history=Array.isArray(land.history)?land.history:[];
  land.history.push(event);
  if(land.history.length>max)land.history.splice(0,land.history.length-max);
}

function nextStructureUid(land,now){
  const generation=Math.max(0,Math.trunc(finite(land?.metadata?.buildingGeneration,0)))+1;
  return{generation,uid:`${land.uid}-building-${generation}-${now.toString(36)}`};
}

export function quoteConstruction(land,plan,policy={}){
  assert(land,'LAND_NOT_FOUND','Terreno não encontrado.');
  const p={...POLICY,...policy},n=normalizePlan(plan);
  assert(n.footprintM2<=finite(land.areaM2,0)*p.maxCoverage,'BUILDING_COVERAGE_EXCEEDED','A construção ocupa uma área maior que o permitido no terreno.',{footprintM2:n.footprintM2,maxFootprintM2:money(finite(land.areaM2,0)*p.maxCoverage)});
  const typeMul=p.typeMultipliers[n.type]??1,qualityMul=p.qualityMultipliers[n.quality]??1;
  const constructionCost=money(n.totalAreaM2*p.constructionBasePerM2*typeMul*qualityMul);
  return clone({...n,constructionCost,maxFootprintM2:money(finite(land.areaM2,0)*p.maxCoverage)});
}

export function quoteDemolition(land,policy={}){
  assert(land,'LAND_NOT_FOUND','Terreno não encontrado.');
  assert(land.status==='built'&&land.metadata?.structure,'NO_STRUCTURE','Não existe construção para demolir.');
  const p={...POLICY,...policy},structure=land.metadata.structure;
  const basis=Math.max(0,finite(structure.buildCost,0));
  return clone({
    landUid:land.uid,
    structureUid:structure.uid,
    cost:money(Math.max(p.demolitionMin,basis*p.demolitionRate)),
    structure:clone(structure)
  });
}

export function createPropertyLifecycle(options={}){
  const market=options.market;
  assert(market&&typeof market.getLand==='function'&&typeof market.snapshot==='function'&&typeof market.hydrate==='function','MARKET_REQUIRED','Mercado de terrenos é obrigatório.');
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  const policy={...POLICY,...(options.policy||{})};

  function ensureOwner(land,ownerUid){
    assert(land,'LAND_NOT_FOUND','Terreno não encontrado.');
    assert(land.ownerUid===text(ownerUid,100),'NOT_LAND_OWNER','Somente o proprietário pode alterar a construção deste terreno.');
  }

  function commitLandMutation(landUid,mutator){
    const snap=market.snapshot(),land=mutableLand(snap,landUid);
    assert(land,'LAND_NOT_FOUND','Terreno não encontrado.');
    mutator(land,snap);
    market.hydrate(snap);
    return market.getLand(landUid);
  }

  function construct({landUid,ownerUid,plan}){
    const land=market.getLand(landUid);ensureOwner(land,ownerUid);
    assert(land.status==='empty','LAND_NOT_EMPTY','O terreno precisa estar vazio para construir.');
    const snap=market.snapshot();assert(!activeListing(snap,land.uid),'LAND_LISTED_FOR_SALE','Remova o terreno do mercado antes de construir.');
    const quote=quoteConstruction(land,plan,policy);
    assert(market.getBalance(ownerUid)>=quote.constructionCost,'INSUFFICIENT_FUNDS','Saldo insuficiente para construir.',{required:quote.constructionCost,balance:market.getBalance(ownerUid)});
    const at=now(),id=nextStructureUid(land,at);
    market.setBalance(ownerUid,money(market.getBalance(ownerUid)-quote.constructionCost));
    const updated=commitLandMutation(land.uid,target=>{
      target.status='built';
      target.metadata=target.metadata&&typeof target.metadata==='object'?target.metadata:{};
      target.metadata.buildingGeneration=id.generation;
      target.metadata.structure={
        uid:id.uid,landUid:target.uid,generation:id.generation,type:quote.type,quality:quote.quality,
        floors:quote.floors,footprintM2:quote.footprintM2,totalAreaM2:quote.totalAreaM2,
        modelAsset:quote.modelAsset,name:quote.name,builtAt:at,buildCost:quote.constructionCost
      };
      appendHistory(target,{at,type:'constructed',landUid:target.uid,structureUid:id.uid,generation:id.generation,buildCost:quote.constructionCost,totalAreaM2:quote.totalAreaM2});
    });
    return clone({land:updated,structure:updated.metadata.structure,cost:quote.constructionCost,balance:market.getBalance(ownerUid)});
  }

  function demolish({landUid,ownerUid}){
    const land=market.getLand(landUid);ensureOwner(land,ownerUid);
    const quote=quoteDemolition(land,policy);
    assert(market.getBalance(ownerUid)>=quote.cost,'INSUFFICIENT_FUNDS','Saldo insuficiente para demolir.',{required:quote.cost,balance:market.getBalance(ownerUid)});
    const at=now();
    market.setBalance(ownerUid,money(market.getBalance(ownerUid)-quote.cost));
    const updated=commitLandMutation(land.uid,target=>{
      target.status='empty';
      target.metadata=target.metadata&&typeof target.metadata==='object'?target.metadata:{};
      target.metadata.lastDemolishedStructure=clone(target.metadata.structure);
      target.metadata.structure=null;
      appendHistory(target,{at,type:'demolished',landUid:target.uid,structureUid:quote.structureUid,demolitionCost:quote.cost,generation:quote.structure.generation});
    });
    return clone({land:updated,removedStructure:quote.structure,cost:quote.cost,balance:market.getBalance(ownerUid)});
  }

  function reconstruct({landUid,ownerUid,plan}){
    const land=market.getLand(landUid);ensureOwner(land,ownerUid);
    assert(land.status==='built'&&land.metadata?.structure,'NO_STRUCTURE','É necessário existir uma construção para reconstruir.');
    const demolition=quoteDemolition(land,policy),construction=quoteConstruction(land,plan,policy);
    const totalCost=money(demolition.cost+construction.constructionCost);
    assert(market.getBalance(ownerUid)>=totalCost,'INSUFFICIENT_FUNDS','Saldo insuficiente para demolir e reconstruir.',{required:totalCost,balance:market.getBalance(ownerUid)});
    const oldStructure=clone(land.metadata.structure),at=now(),id=nextStructureUid(land,at);
    market.setBalance(ownerUid,money(market.getBalance(ownerUid)-totalCost));
    const updated=commitLandMutation(land.uid,target=>{
      target.status='built';
      target.metadata=target.metadata&&typeof target.metadata==='object'?target.metadata:{};
      target.metadata.lastDemolishedStructure=oldStructure;
      target.metadata.buildingGeneration=id.generation;
      target.metadata.structure={
        uid:id.uid,landUid:target.uid,generation:id.generation,type:construction.type,quality:construction.quality,
        floors:construction.floors,footprintM2:construction.footprintM2,totalAreaM2:construction.totalAreaM2,
        modelAsset:construction.modelAsset,name:construction.name,builtAt:at,buildCost:construction.constructionCost
      };
      appendHistory(target,{at,type:'demolished',landUid:target.uid,structureUid:oldStructure.uid,demolitionCost:demolition.cost,generation:oldStructure.generation});
      appendHistory(target,{at,type:'reconstructed',landUid:target.uid,fromStructureUid:oldStructure.uid,toStructureUid:id.uid,generation:id.generation,buildCost:construction.constructionCost,totalCost,totalAreaM2:construction.totalAreaM2});
    });
    return clone({land:updated,previousStructure:oldStructure,structure:updated.metadata.structure,demolitionCost:demolition.cost,constructionCost:construction.constructionCost,totalCost,balance:market.getBalance(ownerUid)});
  }

  function getStructure(landUid){return clone(market.getLand(landUid)?.metadata?.structure||null)}

  return{construct,demolish,reconstruct,getStructure,quoteConstruction:(landUid,plan)=>quoteConstruction(market.getLand(landUid),plan,policy),quoteDemolition:landUid=>quoteDemolition(market.getLand(landUid),policy)};
}

export const PROPERTY_LIFECYCLE_POLICY=POLICY;
