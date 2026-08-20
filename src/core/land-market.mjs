const DEFAULT_POLICY=Object.freeze({
  minPriceFactor:.65,
  maxPriceFactor:1.75,
  minNeighborhoodIndex:.55,
  maxNeighborhoodIndex:2.25,
  maxOpenOffersPerBuyer:8,
  maxHistory:80,
  offerTtlMs:7*24*60*60*1000
});

export class LandMarketError extends Error{
  constructor(code,message,details={}){super(message);this.name='LandMarketError';this.code=code;this.details=details}
}

const money=v=>Math.round(Number(v)*100)/100;
const text=(v,max=80)=>String(v??'').trim().slice(0,max);
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const clone=v=>JSON.parse(JSON.stringify(v));
const assert=(ok,code,message,details)=>{if(!ok)throw new LandMarketError(code,message,details)};

function normalizeLand(raw){
  const uid=text(raw?.uid,100),ownerUid=text(raw?.ownerUid,100),neighborhood=text(raw?.neighborhood||'Sem bairro',80),zone=text(raw?.zone||'Sem zona',80);
  assert(uid,'LAND_UID_REQUIRED','Terreno sem UID.');
  assert(ownerUid,'LAND_OWNER_REQUIRED','Terreno sem proprietário.');
  const areaM2=Math.max(1,finite(raw?.areaM2,1));
  const baseValue=Math.max(1,money(finite(raw?.baseValue,1)));
  const financing=raw?.financing&&typeof raw.financing==='object'?{
    active:!!raw.financing.active,
    balance:Math.max(0,money(finite(raw.financing.balance,0))),
    contractUid:text(raw.financing.contractUid,100)
  }:{active:false,balance:0,contractUid:''};
  return{
    uid,ownerUid,neighborhood,zone,areaM2,baseValue,
    status:raw?.status==='built'?'built':'empty',
    financing,
    createdAt:finite(raw?.createdAt,Date.now()),
    acquiredAt:finite(raw?.acquiredAt,Date.now()),
    metadata:raw?.metadata&&typeof raw.metadata==='object'?clone(raw.metadata):{},
    history:Array.isArray(raw?.history)?clone(raw.history):[]
  };
}

function normalizePayment(raw){
  const mode=raw?.mode==='financed'?'financed':'cash';
  if(mode==='cash')return{mode:'cash'};
  return{
    mode:'financed',
    downPayment:Math.max(0,money(finite(raw?.downPayment,0))),
    termMonths:Math.max(1,Math.min(360,Math.trunc(finite(raw?.termMonths,60)))),
    annualRate:Math.max(0,Math.min(2,finite(raw?.annualRate,0)))
  };
}

export function quoteLandPriceBand(land,neighborhoodIndex=1,policy={}){
  const p={...DEFAULT_POLICY,...policy};
  const idx=Math.max(p.minNeighborhoodIndex,Math.min(p.maxNeighborhoodIndex,finite(neighborhoodIndex,1)));
  const reference=money(Math.max(1,finite(land?.baseValue,1))*idx);
  return{
    neighborhoodIndex:Math.round(idx*1000)/1000,
    reference,
    min:money(reference*p.minPriceFactor),
    max:money(reference*p.maxPriceFactor)
  };
}

export function canListVacantLand(land){
  if(!land)return{ok:false,code:'LAND_NOT_FOUND',reason:'Terreno não encontrado.'};
  if(land.status!=='empty')return{ok:false,code:'LAND_NOT_EMPTY',reason:'Somente terreno vazio pode entrar neste mercado.'};
  if(land.financing?.active&&finite(land.financing.balance,0)>0)return{ok:false,code:'LAND_FINANCING_ACTIVE',reason:'Quite o financiamento antes de vender o terreno.'};
  return{ok:true};
}

export function createLandMarket(options={}){
  const policy={...DEFAULT_POLICY,...(options.policy||{})};
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  let seq=0;
  const nextId=typeof options.idFactory==='function'?options.idFactory:(prefix)=>`${prefix}-${now().toString(36)}-${(++seq).toString(36)}`;
  const lands=new Map(),listings=new Map(),offers=new Map(),balances=new Map(),neighborhoodIndexes=new Map();

  function pushHistory(land,event){
    land.history.push({at:now(),...event});
    if(land.history.length>policy.maxHistory)land.history.splice(0,land.history.length-policy.maxHistory);
  }
  function getLand(uid){return lands.get(text(uid,100))||null}
  function getListing(id){return listings.get(text(id,100))||null}
  function getOffer(id){return offers.get(text(id,100))||null}
  function indexFor(land){return neighborhoodIndexes.get(land.neighborhood)||1}
  function publicLand(land){return land?clone(land):null}
  function publicListing(l){if(!l)return null;const land=getLand(l.landUid);return clone({...l,land:land?{uid:land.uid,neighborhood:land.neighborhood,zone:land.zone,areaM2:land.areaM2,baseValue:land.baseValue,ownerUid:land.ownerUid}:null,priceBand:land?quoteLandPriceBand(land,indexFor(land),policy):null})}
  function expireOffers(){const t=now();for(const o of offers.values())if((o.status==='open'||o.status==='countered')&&o.expiresAt<=t)o.status='expired'}
  function activeListingForLand(landUid){for(const l of listings.values())if(l.landUid===landUid&&l.status==='active')return l;return null}

  function registerLand(raw){
    const land=normalizeLand(raw),existing=lands.get(land.uid);
    assert(!existing||existing.ownerUid===land.ownerUid,'LAND_UID_CONFLICT','UID de terreno já pertence a outro jogador.',{landUid:land.uid});
    if(existing){land.history=existing.history;land.createdAt=existing.createdAt}
    lands.set(land.uid,land);
    return publicLand(land);
  }

  function setNeighborhoodIndex(neighborhood,value){
    const name=text(neighborhood,80);assert(name,'NEIGHBORHOOD_REQUIRED','Bairro obrigatório.');
    const v=Math.max(policy.minNeighborhoodIndex,Math.min(policy.maxNeighborhoodIndex,finite(value,1)));
    neighborhoodIndexes.set(name,Math.round(v*1000)/1000);
    return neighborhoodIndexes.get(name);
  }

  function getNeighborhoodIndex(neighborhood){return neighborhoodIndexes.get(text(neighborhood,80))||1}
  function setBalance(playerUid,value){balances.set(text(playerUid,100),Math.max(0,money(finite(value,0))));return getBalance(playerUid)}
  function getBalance(playerUid){return balances.get(text(playerUid,100))||0}

  function createListing({landUid,sellerUid,askingPrice,allowFinancing=true}){
    expireOffers();
    const land=getLand(landUid);assert(land,'LAND_NOT_FOUND','Terreno não encontrado.',{landUid});
    assert(land.ownerUid===text(sellerUid,100),'NOT_LAND_OWNER','Somente o proprietário pode anunciar este terreno.');
    const eligible=canListVacantLand(land);assert(eligible.ok,eligible.code,eligible.reason);
    assert(!activeListingForLand(land.uid),'LAND_ALREADY_LISTED','Este terreno já está anunciado.');
    const band=quoteLandPriceBand(land,indexFor(land),policy),price=money(askingPrice);
    assert(price>=band.min&&price<=band.max,'ASKING_PRICE_OUT_OF_RANGE','Preço fora da faixa segura do terreno.',{price,min:band.min,max:band.max,reference:band.reference});
    const listing={id:nextId('listing'),landUid:land.uid,sellerUid:land.ownerUid,askingPrice:price,allowFinancing:!!allowFinancing,status:'active',createdAt:now(),updatedAt:now(),sign:{visible:true,label:'TERRENO À VENDA'}};
    listings.set(listing.id,listing);pushHistory(land,{type:'listed',listingId:listing.id,price});
    return publicListing(listing);
  }

  function cancelListing({listingId,sellerUid}){
    const l=getListing(listingId);assert(l,'LISTING_NOT_FOUND','Anúncio não encontrado.');
    assert(l.sellerUid===text(sellerUid,100),'NOT_LISTING_OWNER','Somente o vendedor pode remover o anúncio.');
    assert(l.status==='active','LISTING_NOT_ACTIVE','Anúncio não está ativo.');
    l.status='cancelled';l.updatedAt=now();l.sign.visible=false;
    for(const o of offers.values())if(o.listingId===l.id&&(o.status==='open'||o.status==='countered'))o.status='cancelled';
    const land=getLand(l.landUid);if(land)pushHistory(land,{type:'listing_cancelled',listingId:l.id});
    return publicListing(l);
  }

  function makeOffer({listingId,buyerUid,amount,payment}){
    expireOffers();
    const l=getListing(listingId);assert(l&&l.status==='active','LISTING_NOT_ACTIVE','Anúncio indisponível.');
    const buyer=text(buyerUid,100);assert(buyer&&buyer!==l.sellerUid,'INVALID_BUYER','O vendedor não pode comprar o próprio terreno.');
    let openCount=0;for(const o of offers.values())if(o.buyerUid===buyer&&(o.status==='open'||o.status==='countered'))openCount++;
    assert(openCount<policy.maxOpenOffersPerBuyer,'TOO_MANY_OPEN_OFFERS','Limite de ofertas abertas atingido.');
    const price=money(amount);assert(price>0,'INVALID_OFFER_AMOUNT','Valor da oferta inválido.');
    const pay=normalizePayment(payment);assert(pay.mode==='cash'||l.allowFinancing,'FINANCING_NOT_ALLOWED','Este anúncio não aceita financiamento.');
    if(pay.mode==='financed')assert(pay.downPayment<=price,'DOWN_PAYMENT_TOO_HIGH','Entrada maior que o valor da oferta.');
    const offer={id:nextId('offer'),listingId:l.id,landUid:l.landUid,buyerUid:buyer,sellerUid:l.sellerUid,amount:price,payment:pay,status:'open',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.offerTtlMs,parentOfferId:null};
    offers.set(offer.id,offer);return clone(offer);
  }

  function counterOffer({offerId,sellerUid,amount,payment}){
    expireOffers();
    const prev=getOffer(offerId);assert(prev&&(prev.status==='open'||prev.status==='countered'),'OFFER_NOT_OPEN','Oferta não está aberta.');
    assert(prev.sellerUid===text(sellerUid,100),'NOT_OFFER_SELLER','Somente o vendedor pode fazer contraproposta.');
    const l=getListing(prev.listingId);assert(l&&l.status==='active','LISTING_NOT_ACTIVE','Anúncio indisponível.');
    const price=money(amount);assert(price>0,'INVALID_OFFER_AMOUNT','Valor da contraproposta inválido.');
    const pay=normalizePayment(payment||prev.payment);assert(pay.mode==='cash'||l.allowFinancing,'FINANCING_NOT_ALLOWED','Este anúncio não aceita financiamento.');
    prev.status='superseded';prev.updatedAt=now();
    const counter={id:nextId('offer'),listingId:l.id,landUid:l.landUid,buyerUid:prev.buyerUid,sellerUid:l.sellerUid,amount:price,payment:pay,status:'countered',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.offerTtlMs,parentOfferId:prev.id};
    offers.set(counter.id,counter);return clone(counter);
  }

  function rejectOffer({offerId,actorUid}){
    const o=getOffer(offerId);assert(o&&(o.status==='open'||o.status==='countered'),'OFFER_NOT_OPEN','Oferta não está aberta.');
    const actor=text(actorUid,100);assert(actor===o.sellerUid||actor===o.buyerUid,'NOT_OFFER_PARTY','Jogador não participa desta negociação.');
    o.status=actor===o.buyerUid?'withdrawn':'rejected';o.updatedAt=now();return clone(o);
  }

  function settlementQuote(offerId){
    expireOffers();const o=getOffer(offerId);assert(o&&(o.status==='open'||o.status==='countered'),'OFFER_NOT_OPEN','Oferta não está aberta.');
    const l=getListing(o.listingId),land=l&&getLand(l.landUid);assert(l&&l.status==='active'&&land,'LISTING_NOT_ACTIVE','Anúncio indisponível.');
    assert(land.ownerUid===l.sellerUid,'LAND_OWNER_CHANGED','Proprietário do terreno mudou.');
    const eligible=canListVacantLand(land);assert(eligible.ok,eligible.code,eligible.reason);
    const financed=o.payment.mode==='financed',cashDue=financed?o.payment.downPayment:o.amount,principal=financed?money(o.amount-o.payment.downPayment):0;
    return clone({offerId:o.id,listingId:l.id,landUid:land.uid,sellerUid:o.sellerUid,buyerUid:o.buyerUid,total:o.amount,mode:o.payment.mode,cashDue,principal,termMonths:financed?o.payment.termMonths:0,annualRate:financed?o.payment.annualRate:0});
  }

  function acceptOffer({offerId,sellerUid,financeApprover}){
    const quote=settlementQuote(offerId),o=getOffer(offerId),l=getListing(o.listingId),land=getLand(o.landUid);
    assert(quote.sellerUid===text(sellerUid,100),'NOT_OFFER_SELLER','Somente o vendedor pode aceitar a oferta.');
    assert(getBalance(quote.buyerUid)>=quote.cashDue,'INSUFFICIENT_FUNDS','Comprador não possui saldo para a parte à vista.',{required:quote.cashDue,balance:getBalance(quote.buyerUid)});
    let financing=null;
    if(quote.mode==='financed'){
      assert(typeof financeApprover==='function','FINANCE_APPROVER_REQUIRED','Venda financiada exige aprovação do financiamento.');
      financing=financeApprover(clone(quote));
      assert(financing&&financing.approved===true,'FINANCING_DENIED','Financiamento não aprovado.',{reason:financing?.reason||''});
    }
    balances.set(quote.buyerUid,money(getBalance(quote.buyerUid)-quote.cashDue));
    balances.set(quote.sellerUid,money(getBalance(quote.sellerUid)+quote.total));
    const previousOwner=land.ownerUid;land.ownerUid=quote.buyerUid;land.acquiredAt=now();
    land.financing=quote.mode==='financed'?{active:quote.principal>0,balance:quote.principal,contractUid:text(financing.contractUid||nextId('loan'),100)}:{active:false,balance:0,contractUid:''};
    pushHistory(land,{type:'sold',listingId:l.id,offerId:o.id,fromUid:previousOwner,toUid:land.ownerUid,price:quote.total,paymentMode:quote.mode,neighborhood:land.neighborhood,zone:land.zone,areaM2:land.areaM2});
    l.status='sold';l.updatedAt=now();l.sign.visible=false;o.status='accepted';o.updatedAt=now();
    for(const other of offers.values())if(other.listingId===l.id&&other.id!==o.id&&(other.status==='open'||other.status==='countered'))other.status='lost';
    return clone({land:publicLand(land),listing:publicListing(l),offer:o,settlement:quote,financing});
  }

  function payLandFinancing({landUid,ownerUid,amount}){
    const land=getLand(landUid);assert(land,'LAND_NOT_FOUND','Terreno não encontrado.');assert(land.ownerUid===text(ownerUid,100),'NOT_LAND_OWNER','Somente o proprietário pode quitar o financiamento.');
    assert(land.financing?.active&&land.financing.balance>0,'NO_ACTIVE_FINANCING','Terreno não possui financiamento ativo.');
    const value=Math.max(0,money(amount));assert(value>0,'INVALID_PAYMENT','Pagamento inválido.');assert(getBalance(ownerUid)>=value,'INSUFFICIENT_FUNDS','Saldo insuficiente.');
    const applied=Math.min(value,land.financing.balance);balances.set(text(ownerUid,100),money(getBalance(ownerUid)-applied));land.financing.balance=money(land.financing.balance-applied);
    if(land.financing.balance<=0){land.financing.balance=0;land.financing.active=false;pushHistory(land,{type:'financing_paid_off',contractUid:land.financing.contractUid})}
    return publicLand(land);
  }

  function listActive({neighborhood,zone,minPrice=0,maxPrice=Infinity}={}){
    expireOffers();const n=text(neighborhood,80),z=text(zone,80),min=finite(minPrice,0),max=finite(maxPrice,Infinity),out=[];
    for(const l of listings.values())if(l.status==='active'){
      const land=getLand(l.landUid);if(!land)continue;if(n&&land.neighborhood!==n)continue;if(z&&land.zone!==z)continue;if(l.askingPrice<min||l.askingPrice>max)continue;out.push(publicListing(l));
    }
    return out.sort((a,b)=>a.askingPrice-b.askingPrice||a.createdAt-b.createdAt);
  }

  function getOffersForListing(listingId){expireOffers();return[...offers.values()].filter(o=>o.listingId===text(listingId,100)).map(clone).sort((a,b)=>b.updatedAt-a.updatedAt)}
  function getLandHistory(landUid){const land=getLand(landUid);assert(land,'LAND_NOT_FOUND','Terreno não encontrado.');return clone(land.history)}
  function snapshot(){return clone({version:1,lands:[...lands.values()],listings:[...listings.values()],offers:[...offers.values()],balances:[...balances.entries()],neighborhoodIndexes:[...neighborhoodIndexes.entries()]})}
  function hydrate(data){
    assert(data?.version===1,'UNSUPPORTED_SNAPSHOT','Snapshot do mercado incompatível.');lands.clear();listings.clear();offers.clear();balances.clear();neighborhoodIndexes.clear();
    for(const raw of data.lands||[])lands.set(raw.uid,normalizeLand(raw));for(const l of data.listings||[])listings.set(l.id,clone(l));for(const o of data.offers||[])offers.set(o.id,clone(o));for(const [k,v] of data.balances||[])balances.set(k,money(v));for(const [k,v] of data.neighborhoodIndexes||[])neighborhoodIndexes.set(k,finite(v,1));
    expireOffers();return snapshot();
  }

  return{registerLand,getLand:uid=>publicLand(getLand(uid)),setNeighborhoodIndex,getNeighborhoodIndex,setBalance,getBalance,createListing,cancelListing,makeOffer,counterOffer,rejectOffer,settlementQuote,acceptOffer,payLandFinancing,listActive,getOffersForListing,getLandHistory,snapshot,hydrate};
}

export const LAND_MARKET_POLICY=DEFAULT_POLICY;
