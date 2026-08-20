import {LandMarketError} from './land-market.mjs';

const POLICY=Object.freeze({
  baseCycleMs:60*60*1000,
  maxCyclesPerRun:24,
  maxRecipesPerBusiness:30,
  maxOutputPerCycle:10000,
  baseWorkerEfficiency:.18,
  maxWorkerBonus:2.5,
  managerBonus:.15,
  operatorBonus:.25,
  specialistBonus:.35
});

const money=v=>Math.round(Number(v)*100)/100;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const text=(v,max=100)=>String(v??'').trim().slice(0,max);
const clone=v=>JSON.parse(JSON.stringify(v));
const assert=(ok,code,message,details={})=>{if(!ok)throw new LandMarketError(code,message,details)};

function employeeWeight(title=''){
  const t=text(title,80).toLowerCase();
  if(t.includes('gerente')||t.includes('manager'))return 1.15;
  if(t.includes('especialista')||t.includes('técnico')||t.includes('tecnico'))return 1.35;
  if(t.includes('operador')||t.includes('produção')||t.includes('producao'))return 1.25;
  return 1;
}

export function createBusinessProduction(options={}){
  const business=options.business,employment=options.employment;
  assert(business&&typeof business.inspect==='function'&&typeof business.snapshot==='function'&&typeof business.hydrate==='function','BUSINESS_SYSTEM_REQUIRED','Sistema de empresas é obrigatório.');
  assert(employment&&typeof employment.listEmployees==='function','EMPLOYMENT_SYSTEM_REQUIRED','Sistema de funcionários é obrigatório.');
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  const policy={...POLICY,...(options.policy||{})};
  const recipes=new Map(),states=new Map();

  function requireOwner(businessId,ownerUid){const b=business.inspect(businessId);assert(b&&b.status==='active','BUSINESS_NOT_ACTIVE','Empresa não está ativa.');assert(b.ownerUid===text(ownerUid,100),'NOT_BUSINESS_OWNER','Somente o dono da empresa pode gerenciar a produção.');return b}
  function mutateBusiness(id,fn){const snap=business.snapshot(),b=(snap.businesses||[]).find(x=>x.id===id);assert(b,'BUSINESS_NOT_FOUND','Empresa não encontrada.');fn(b);b.updatedAt=now();business.hydrate(snap);return business.inspect(id)}
  function recipeKey(businessId,recipeId){return `${businessId}:${recipeId}`}
  function getRecipe(businessId,recipeId){return recipes.get(recipeKey(text(businessId,100),text(recipeId,80)))||null}
  function listRecipes(businessId){const id=text(businessId,100);return[...recipes.values()].filter(r=>r.businessId===id).map(clone)}

  function defineRecipe({businessId,ownerUid,id,name,outputSku,outputQty=1,inputs={},cycleMs}){
    const b=requireOwner(businessId,ownerUid),recipeId=text(id||outputSku,80),sku=text(outputSku,50);assert(recipeId&&sku,'RECIPE_FIELDS_REQUIRED','Receita precisa de ID e produto de saída.');assert(b.products?.[sku],'OUTPUT_PRODUCT_NOT_FOUND','Produto de saída precisa existir no catálogo da empresa.');
    const existing=getRecipe(b.id,recipeId);assert(existing||listRecipes(b.id).length<policy.maxRecipesPerBusiness,'RECIPE_LIMIT_REACHED','Limite de receitas atingido.');
    const normalizedInputs={};for(const [inputSku,qtyRaw] of Object.entries(inputs||{})){const k=text(inputSku,50),qty=Math.max(0,money(finite(qtyRaw,0)));if(qty>0){assert(b.products?.[k],'INPUT_PRODUCT_NOT_FOUND','Insumo não existe no catálogo.',{sku:k});normalizedInputs[k]=qty}}
    const output=Math.max(.01,Math.min(policy.maxOutputPerCycle,money(finite(outputQty,1)))),duration=Math.max(60_000,Math.trunc(finite(cycleMs,policy.baseCycleMs)));
    const recipe={id:recipeId,businessId:b.id,name:text(name||recipeId,80),outputSku:sku,outputQty:output,inputs:normalizedInputs,cycleMs:duration,createdAt:existing?.createdAt||now(),updatedAt:now()};recipes.set(recipeKey(b.id,recipeId),recipe);return clone(recipe)
  }

  function workforce(businessId){const employees=employment.listEmployees(businessId);let raw=0;for(const e of employees)raw+=employeeWeight(e.title);const bonus=Math.min(policy.maxWorkerBonus,raw*policy.baseWorkerEfficiency);return{employees:employees.length,weighted:Math.round(raw*100)/100,multiplier:Math.round((1+bonus)*1000)/1000}}

  function productionQuote({businessId,recipeId,cycles=1}){
    const b=business.inspect(businessId);assert(b&&b.status==='active','BUSINESS_NOT_ACTIVE','Empresa não está ativa.');const r=getRecipe(b.id,recipeId);assert(r,'RECIPE_NOT_FOUND','Receita de produção não encontrada.');const count=Math.max(1,Math.min(policy.maxCyclesPerRun,Math.trunc(finite(cycles,1)))),staff=workforce(b.id),effectiveOutput=money(r.outputQty*count*staff.multiplier),inputs={};for(const [sku,qty] of Object.entries(r.inputs))inputs[sku]=money(qty*count);return clone({businessId:b.id,recipeId:r.id,cycles:count,workforce:staff,baseOutput:money(r.outputQty*count),effectiveOutput,inputs,durationMs:Math.ceil(r.cycleMs*count/staff.multiplier)})
  }

  function runProduction({businessId,ownerUid,recipeId,cycles=1}){
    const b=requireOwner(businessId,ownerUid),quote=productionQuote({businessId:b.id,recipeId,cycles}),r=getRecipe(b.id,recipeId);for(const [sku,needed] of Object.entries(quote.inputs)){assert((b.products?.[sku]?.stock||0)>=needed,'INSUFFICIENT_INPUT_STOCK','Estoque de insumo insuficiente.',{sku,required:needed,available:b.products?.[sku]?.stock||0})}
    const result=mutateBusiness(b.id,target=>{for(const [sku,needed] of Object.entries(quote.inputs))target.products[sku].stock=money(target.products[sku].stock-needed);const output=target.products[r.outputSku];output.stock=money((output.stock||0)+quote.effectiveOutput);target.stats=target.stats||{};target.stats.productionRuns=Math.max(0,Math.trunc(finite(target.stats.productionRuns,0)))+1;target.stats.productionCycles=Math.max(0,Math.trunc(finite(target.stats.productionCycles,0)))+quote.cycles;target.stats.unitsProduced=money(finite(target.stats.unitsProduced,0)+quote.effectiveOutput);target.stats.lastProductionAt=now()});
    const state={businessId:b.id,recipeId:r.id,lastRunAt:now(),lastCycles:quote.cycles,lastOutput:quote.effectiveOutput,workforce:quote.workforce};states.set(recipeKey(b.id,r.id),state);return clone({quote,business:result,state})
  }

  function estimateCapacity(businessId){const b=business.inspect(businessId);assert(b,'BUSINESS_NOT_FOUND','Empresa não encontrada.');const staff=workforce(b.id),rs=listRecipes(b.id);return clone({businessId:b.id,workforce:staff,recipes:rs.map(r=>({id:r.id,outputSku:r.outputSku,basePerCycle:r.outputQty,effectivePerCycle:money(r.outputQty*staff.multiplier),effectiveCycleMs:Math.ceil(r.cycleMs/staff.multiplier)}))})}
  function snapshot(){return clone({version:1,recipes:[...recipes.values()],states:[...states.values()]})}
  function hydrate(data){assert(data?.version===1,'UNSUPPORTED_PRODUCTION_SNAPSHOT','Snapshot de produção incompatível.');recipes.clear();states.clear();for(const r of data.recipes||[])recipes.set(recipeKey(r.businessId,r.id),clone(r));for(const s of data.states||[])states.set(recipeKey(s.businessId,s.recipeId),clone(s));return snapshot()}
  return{defineRecipe,listRecipes,workforce,productionQuote,runProduction,estimateCapacity,snapshot,hydrate};
}

export const BUSINESS_PRODUCTION_POLICY=POLICY;
