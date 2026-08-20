import {LandMarketError} from './land-market.mjs';

const POLICY=Object.freeze({
  minMonthlyRent:100,
  maxRentToValueMonthly:.04,
  minRentToValueMonthly:.0015,
  maxDepositMonths:3,
  minTermMonths:1,
  maxTermMonths:36,
  billingPeriodMs:30*24*60*60*1000,
  graceMs:5*24*60*60*1000,
  listingTtlMs:30*24*60*60*1000,
  applicationTtlMs:7*24*60*60*1000,
  maxApplicationsPerTenant:8
});

const money=v=>Math.round(Number(v)*100)/100;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const text=(v,max=100)=>String(v??'').trim().slice(0,max);
const clone=v=>JSON.parse(JSON.stringify(v));
const assert=(ok,code,message,details={})=>{if(!ok)throw new LandMarketError(code,message,details)};
const builtStructure=land=>land?.status==='built'&&land?.metadata?.structure?land.metadata.structure:null;
const mutableLand=(snapshot,uid)=>(snapshot.lands||[]).find(x=>x.uid===uid)||null;
function pushHistory(land,event,max=80){land.history=Array.isArray(land.history)?land.history:[];land.history.push(event);if(land.history.length>max)land.history.splice(0,land.history.length-max)}
function activeLease(land){const r=land?.metadata?.rentalContract;return r&&['active','delinquent'].includes(r.status)?r:null}

export function quoteRentBand({propertyValue,policy={}}={}){
  const p={...POLICY,...policy},value=Math.max(1,money(finite(propertyValue,1)));
  return{propertyValue:value,min:money(Math.max(p.minMonthlyRent,value*p.minRentToValueMonthly)),max:money(value*p.maxRentToValueMonthly)};
}

export function createPropertyRental(options={}){
  const market=options.market;
  assert(market&&typeof market.getLand==='function'&&typeof market.snapshot==='function'&&typeof market.hydrate==='function','MARKET_REQUIRED','Mercado base de propriedades é obrigatório.');
  const valuation=options.valuation;
  assert(typeof valuation==='function','VALUATION_REQUIRED','Função de avaliação do imóvel é obrigatória.');
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  const policy={...POLICY,...(options.policy||{})};
  let seq=0;
  const nextId=typeof options.idFactory==='function'?options.idFactory:(prefix)=>`${prefix}-${now().toString(36)}-${(++seq).toString(36)}`;
  const listings=new Map(),applications=new Map(),contracts=new Map();

  const getListing=id=>listings.get(text(id,100))||null;
  const getApplication=id=>applications.get(text(id,100))||null;
  const getContract=id=>contracts.get(text(id,100))||null;
  function commitLand(landUid,mutator){const snap=market.snapshot(),land=mutableLand(snap,landUid);assert(land,'LAND_NOT_FOUND','Imóvel não encontrado.');mutator(land,snap);market.hydrate(snap);return market.getLand(landUid)}
  function expire(){const t=now();for(const l of listings.values())if(l.status==='active'&&l.expiresAt<=t)l.status='expired';for(const a of applications.values())if(['open','countered'].includes(a.status)&&a.expiresAt<=t)a.status='expired';for(const c of contracts.values())syncContract(c)}
  function activeListingForLand(uid){for(const l of listings.values())if(l.landUid===uid&&l.status==='active')return l;return null}
  function rentalBand(land){const q=valuation(land.uid);assert(q&&finite(q.reference,0)>0,'VALUATION_FAILED','Não foi possível avaliar o imóvel.');return quoteRentBand({propertyValue:q.reference,policy})}
  function publicListing(l){if(!l)return null;const land=market.getLand(l.landUid),s=builtStructure(land);return clone({...l,property:land&&s?{landUid:land.uid,structureUid:s.uid,ownerUid:land.ownerUid,neighborhood:land.neighborhood,zone:land.zone,type:s.type,quality:s.quality,name:s.name||'',totalAreaM2:s.totalAreaM2}:null,rentBand:land&&s?rentalBand(land):null})}
  function syncContract(c){
    if(!c||!['active','delinquent'].includes(c.status))return c;
    const t=now();
    if(t>=c.endsAt){c.status='expired';c.updatedAt=t;commitLand(c.landUid,land=>{if(land.metadata?.rentalContract?.id===c.id)land.metadata.rentalContract={...clone(c)};pushHistory(land,{at:t,type:'rental_expired',contractId:c.id,tenantUid:c.tenantUid})});return c}
    if(t>c.nextDueAt+policy.graceMs){c.status='delinquent';c.delinquentSince=c.delinquentSince||c.nextDueAt;const missed=Math.max(1,Math.floor((t-c.nextDueAt)/policy.billingPeriodMs)+1);c.overdueAmount=money(c.monthlyRent*missed);c.updatedAt=t;commitLand(c.landUid,land=>{if(land.metadata?.rentalContract?.id===c.id)land.metadata.rentalContract={...clone(c)}})}
    return c;
  }

  function createListing({landUid,ownerUid,monthlyRent,depositMonths=1,termMonths=12}){
    expire();const land=market.getLand(landUid),owner=text(ownerUid,100);assert(land,'LAND_NOT_FOUND','Imóvel não encontrado.');assert(land.ownerUid===owner,'NOT_PROPERTY_OWNER','Somente o proprietário pode anunciar o aluguel.');const s=builtStructure(land);assert(s,'PROPERTY_NOT_BUILT','Somente imóvel construído pode ser alugado.');assert(!activeLease(land),'PROPERTY_ALREADY_RENTED','Este imóvel já possui locação ativa.');assert(!activeListingForLand(land.uid),'RENTAL_ALREADY_LISTED','Este imóvel já está anunciado para aluguel.');
    const snap=market.snapshot();assert(!(snap.listings||[]).some(x=>x.landUid===land.uid&&x.status==='active'),'PROPERTY_SALE_LISTING_CONFLICT','Remova o anúncio de venda do terreno antes de alugar.');
    const band=rentalBand(land),rent=money(monthlyRent);assert(rent>=band.min&&rent<=band.max,'RENT_OUT_OF_RANGE','Aluguel fora da faixa segura.',{rent,min:band.min,max:band.max});
    const deposit=Math.max(0,Math.min(policy.maxDepositMonths,Math.trunc(finite(depositMonths,1)))),term=Math.max(policy.minTermMonths,Math.min(policy.maxTermMonths,Math.trunc(finite(termMonths,12))));
    const l={id:nextId('rental-listing'),landUid:land.uid,structureUid:s.uid,ownerUid:owner,monthlyRent:rent,depositMonths:deposit,depositAmount:money(rent*deposit),termMonths:term,status:'active',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.listingTtlMs,sign:{visible:true,label:'ALUGA-SE'}};listings.set(l.id,l);commitLand(land.uid,target=>pushHistory(target,{at:now(),type:'rental_listed',listingId:l.id,monthlyRent:rent,depositAmount:l.depositAmount,termMonths:term}));return publicListing(l)
  }

  function cancelListing({listingId,ownerUid}){const l=getListing(listingId);assert(l,'LISTING_NOT_FOUND','Anúncio de aluguel não encontrado.');assert(l.ownerUid===text(ownerUid,100),'NOT_LISTING_OWNER','Somente o proprietário pode cancelar o anúncio.');assert(l.status==='active','LISTING_NOT_ACTIVE','Anúncio não está ativo.');l.status='cancelled';l.updatedAt=now();l.sign.visible=false;for(const a of applications.values())if(a.listingId===l.id&&['open','countered'].includes(a.status))a.status='cancelled';commitLand(l.landUid,land=>pushHistory(land,{at:now(),type:'rental_listing_cancelled',listingId:l.id}));return publicListing(l)}

  function apply({listingId,tenantUid,monthlyRent,depositMonths,termMonths}){
    expire();const l=getListing(listingId);assert(l&&l.status==='active','LISTING_NOT_ACTIVE','Anúncio de aluguel indisponível.');const tenant=text(tenantUid,100);assert(tenant&&tenant!==l.ownerUid,'INVALID_TENANT','O proprietário não pode alugar o próprio imóvel.');let open=0;for(const a of applications.values())if(a.tenantUid===tenant&&['open','countered'].includes(a.status))open++;assert(open<policy.maxApplicationsPerTenant,'TOO_MANY_APPLICATIONS','Limite de propostas de aluguel abertas atingido.');
    const rent=money(monthlyRent??l.monthlyRent),deposit=Math.max(0,Math.min(policy.maxDepositMonths,Math.trunc(finite(depositMonths,l.depositMonths)))),term=Math.max(policy.minTermMonths,Math.min(policy.maxTermMonths,Math.trunc(finite(termMonths,l.termMonths))));assert(rent>0,'INVALID_RENT','Valor de aluguel inválido.');const a={id:nextId('rental-application'),listingId:l.id,landUid:l.landUid,structureUid:l.structureUid,ownerUid:l.ownerUid,tenantUid:tenant,monthlyRent:rent,depositMonths:deposit,depositAmount:money(rent*deposit),termMonths:term,status:'open',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.applicationTtlMs,parentApplicationId:null};applications.set(a.id,a);return clone(a)
  }

  function counter({applicationId,ownerUid,monthlyRent,depositMonths,termMonths}){expire();const prev=getApplication(applicationId);assert(prev&&['open','countered'].includes(prev.status),'APPLICATION_NOT_OPEN','Proposta não está aberta.');assert(prev.ownerUid===text(ownerUid,100),'NOT_APPLICATION_OWNER','Somente o proprietário pode fazer contraproposta.');const l=getListing(prev.listingId);assert(l&&l.status==='active','LISTING_NOT_ACTIVE','Anúncio indisponível.');prev.status='superseded';prev.updatedAt=now();const rent=money(monthlyRent??prev.monthlyRent),deposit=Math.max(0,Math.min(policy.maxDepositMonths,Math.trunc(finite(depositMonths,prev.depositMonths)))),term=Math.max(policy.minTermMonths,Math.min(policy.maxTermMonths,Math.trunc(finite(termMonths,prev.termMonths))));const a={...clone(prev),id:nextId('rental-application'),monthlyRent:rent,depositMonths:deposit,depositAmount:money(rent*deposit),termMonths:term,status:'countered',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.applicationTtlMs,parentApplicationId:prev.id};applications.set(a.id,a);return clone(a)}

  function reject({applicationId,actorUid}){const a=getApplication(applicationId);assert(a&&['open','countered'].includes(a.status),'APPLICATION_NOT_OPEN','Proposta não está aberta.');const actor=text(actorUid,100);assert(actor===a.ownerUid||actor===a.tenantUid,'NOT_APPLICATION_PARTY','Jogador não participa desta negociação.');a.status=actor===a.tenantUid?'withdrawn':'rejected';a.updatedAt=now();return clone(a)}

  function accept({applicationId,ownerUid}){
    expire();const a=getApplication(applicationId);assert(a&&['open','countered'].includes(a.status),'APPLICATION_NOT_OPEN','Proposta não está aberta.');assert(a.ownerUid===text(ownerUid,100),'NOT_APPLICATION_OWNER','Somente o proprietário pode aceitar a locação.');const l=getListing(a.listingId),land=l&&market.getLand(l.landUid),s=builtStructure(land);assert(l&&l.status==='active'&&land&&s,'LISTING_NOT_ACTIVE','Anúncio indisponível.');assert(land.ownerUid===a.ownerUid,'PROPERTY_OWNER_CHANGED','Proprietário do imóvel mudou.');assert(s.uid===a.structureUid,'STRUCTURE_CHANGED','A construção foi alterada.');assert(!activeLease(land),'PROPERTY_ALREADY_RENTED','Imóvel já está alugado.');
    const upfront=money(a.depositAmount+a.monthlyRent);assert(market.getBalance(a.tenantUid)>=upfront,'INSUFFICIENT_FUNDS','Inquilino não possui saldo para caução e primeiro aluguel.',{required:upfront,balance:market.getBalance(a.tenantUid)});market.setBalance(a.tenantUid,money(market.getBalance(a.tenantUid)-upfront));market.setBalance(a.ownerUid,money(market.getBalance(a.ownerUid)+a.monthlyRent));
    const startedAt=now(),c={id:nextId('rental-contract'),listingId:l.id,landUid:land.uid,structureUid:s.uid,ownerUid:a.ownerUid,tenantUid:a.tenantUid,monthlyRent:a.monthlyRent,depositAmount:a.depositAmount,depositHeld:a.depositAmount,termMonths:a.termMonths,status:'active',startedAt,endsAt:startedAt+a.termMonths*policy.billingPeriodMs,lastPaidAt:startedAt,paidPeriods:1,nextDueAt:startedAt+policy.billingPeriodMs,overdueAmount:0,delinquentSince:0,createdAt:startedAt,updatedAt:startedAt};contracts.set(c.id,c);a.status='accepted';a.updatedAt=startedAt;l.status='rented';l.updatedAt=startedAt;l.sign.visible=false;for(const other of applications.values())if(other.listingId===l.id&&other.id!==a.id&&['open','countered'].includes(other.status))other.status='lost';commitLand(land.uid,target=>{target.metadata=target.metadata&&typeof target.metadata==='object'?target.metadata:{};target.metadata.rentalContract=clone(c);pushHistory(target,{at:startedAt,type:'rental_started',contractId:c.id,tenantUid:c.tenantUid,monthlyRent:c.monthlyRent,depositAmount:c.depositAmount,termMonths:c.termMonths})});return clone({contract:c,land:market.getLand(land.uid),upfront})
  }

  function payRent({contractId,tenantUid,periods=1}){const c=getContract(contractId);assert(c,'CONTRACT_NOT_FOUND','Contrato não encontrado.');syncContract(c);assert(['active','delinquent'].includes(c.status),'CONTRACT_NOT_ACTIVE','Contrato não está ativo.');assert(c.tenantUid===text(tenantUid,100),'NOT_TENANT','Somente o inquilino pode pagar este aluguel.');const count=Math.max(1,Math.min(12,Math.trunc(finite(periods,1)))),amount=money(c.monthlyRent*count);assert(market.getBalance(c.tenantUid)>=amount,'INSUFFICIENT_FUNDS','Saldo insuficiente para pagar aluguel.',{required:amount,balance:market.getBalance(c.tenantUid)});market.setBalance(c.tenantUid,money(market.getBalance(c.tenantUid)-amount));market.setBalance(c.ownerUid,money(market.getBalance(c.ownerUid)+amount));c.paidPeriods+=count;c.lastPaidAt=now();c.nextDueAt+=count*policy.billingPeriodMs;c.overdueAmount=0;c.delinquentSince=0;c.status='active';c.updatedAt=now();commitLand(c.landUid,land=>{if(land.metadata?.rentalContract?.id===c.id)land.metadata.rentalContract=clone(c);pushHistory(land,{at:now(),type:'rent_paid',contractId:c.id,tenantUid:c.tenantUid,amount,periods:count})});return clone(c)}

  function checkContract(contractId){const c=getContract(contractId);assert(c,'CONTRACT_NOT_FOUND','Contrato não encontrado.');syncContract(c);return clone(c)}

  function repossess({contractId,ownerUid}){const c=getContract(contractId);assert(c,'CONTRACT_NOT_FOUND','Contrato não encontrado.');syncContract(c);assert(c.ownerUid===text(ownerUid,100),'NOT_PROPERTY_OWNER','Somente o proprietário pode retomar o imóvel.');assert(['delinquent','expired'].includes(c.status),'REPOSSESSION_NOT_ALLOWED','Retomada só é permitida por inadimplência ou fim do contrato.');const at=now(),reason=c.status;c.status='terminated';c.terminatedAt=at;c.terminationReason=reason;c.updatedAt=at;let refund=0;if(reason==='expired'&&c.depositHeld>0){refund=c.depositHeld;market.setBalance(c.tenantUid,money(market.getBalance(c.tenantUid)+refund));c.depositHeld=0}commitLand(c.landUid,land=>{land.metadata=land.metadata||{};land.metadata.rentalContract={...clone(c)};pushHistory(land,{at,type:'rental_repossessed',contractId:c.id,tenantUid:c.tenantUid,reason,depositRefund:refund})});return clone({contract:c,depositRefund:refund,land:market.getLand(c.landUid)})}

  function terminateByTenant({contractId,tenantUid}){const c=getContract(contractId);assert(c,'CONTRACT_NOT_FOUND','Contrato não encontrado.');syncContract(c);assert(['active','delinquent'].includes(c.status),'CONTRACT_NOT_ACTIVE','Contrato não está ativo.');assert(c.tenantUid===text(tenantUid,100),'NOT_TENANT','Somente o inquilino pode encerrar antecipadamente.');const at=now();c.status='terminated';c.terminatedAt=at;c.terminationReason='tenant_early_exit';c.depositHeld=0;c.updatedAt=at;commitLand(c.landUid,land=>{land.metadata=land.metadata||{};land.metadata.rentalContract={...clone(c)};pushHistory(land,{at,type:'rental_terminated_by_tenant',contractId:c.id,tenantUid:c.tenantUid,depositForfeited:c.depositAmount})});return clone(c)}

  function listActive({neighborhood,zone,type,minRent=0,maxRent=Infinity}={}){expire();const n=text(neighborhood,80),z=text(zone,80),tp=text(type,40),min=finite(minRent,0),max=finite(maxRent,Infinity),out=[];for(const l of listings.values())if(l.status==='active'){const land=market.getLand(l.landUid),s=builtStructure(land);if(!land||!s)continue;if(n&&land.neighborhood!==n)continue;if(z&&land.zone!==z)continue;if(tp&&s.type!==tp)continue;if(l.monthlyRent<min||l.monthlyRent>max)continue;out.push(publicListing(l))}return out.sort((a,b)=>a.monthlyRent-b.monthlyRent||a.createdAt-b.createdAt)}
  function getApplications(listingId){expire();return[...applications.values()].filter(a=>a.listingId===text(listingId,100)).map(clone).sort((a,b)=>b.updatedAt-a.updatedAt)}
  function getContractByLand(landUid){expire();for(const c of contracts.values())if(c.landUid===text(landUid,100)&&['active','delinquent','expired'].includes(c.status))return clone(c);return null}
  function snapshot(){expire();return clone({version:1,listings:[...listings.values()],applications:[...applications.values()],contracts:[...contracts.values()]})}
  function hydrate(data){assert(data?.version===1,'UNSUPPORTED_SNAPSHOT','Snapshot de aluguel incompatível.');listings.clear();applications.clear();contracts.clear();for(const x of data.listings||[])listings.set(x.id,clone(x));for(const x of data.applications||[])applications.set(x.id,clone(x));for(const x of data.contracts||[])contracts.set(x.id,clone(x));expire();return snapshot()}

  return{createListing,cancelListing,apply,counter,reject,accept,payRent,checkContract,repossess,terminateByTenant,listActive,getApplications,getContractByLand,snapshot,hydrate};
}

export const PROPERTY_RENTAL_POLICY=POLICY;
