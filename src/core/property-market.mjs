import {LandMarketError,quoteLandPriceBand} from './land-market.mjs';

const POLICY=Object.freeze({
  minPriceFactor:.70,
  maxPriceFactor:1.90,
  maxOpenOffersPerBuyer:8,
  offerTtlMs:7*24*60*60*1000,
  structureResidualFloor:.35,
  depreciationPerYear:.025,
  maxDepreciation:.55,
  qualityValue:{basic:.85,standard:1,premium:1.18,luxury:1.42},
  typeValue:{house:1,commercial:1.08,industrial:1.12,apartment:1.16}
});

const money=v=>Math.round(Number(v)*100)/100;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const text=(v,max=100)=>String(v??'').trim().slice(0,max);
const clone=v=>JSON.parse(JSON.stringify(v));
const assert=(ok,code,message,details={})=>{if(!ok)throw new LandMarketError(code,message,details)};

function normalizePayment(raw){
  const mode=raw?.mode==='financed'?'financed':'cash';
  if(mode==='cash')return{mode:'cash'};
  return{
    mode:'financed',
    downPayment:Math.max(0,money(finite(raw?.downPayment,0))),
    termMonths:Math.max(1,Math.min(360,Math.trunc(finite(raw?.termMonths,120)))),
    annualRate:Math.max(0,Math.min(2,finite(raw?.annualRate,0)))
  };
}

function builtStructure(land){return land?.status==='built'&&land?.metadata?.structure?land.metadata.structure:null}
function mutableLand(snapshot,landUid){return(snapshot.lands||[]).find(x=>x.uid===landUid)||null}
function activeVacantListing(snapshot,landUid){return(snapshot.listings||[]).find(x=>x.landUid===landUid&&x.status==='active')||null}
function pushHistory(land,event,max=80){land.history=Array.isArray(land.history)?land.history:[];land.history.push(event);if(land.history.length>max)land.history.splice(0,land.history.length-max)}

export function quoteBuiltPropertyValue(land,neighborhoodIndex=1,options={}){
  assert(land,'LAND_NOT_FOUND','Imóvel não encontrado.');
  const structure=builtStructure(land);assert(structure,'PROPERTY_NOT_BUILT','O terreno não possui construção ativa.');
  const policy={...POLICY,...options};
  const landBand=quoteLandPriceBand(land,neighborhoodIndex);
  const now=finite(options.now,Date.now());
  const ageYears=Math.max(0,(now-finite(structure.builtAt,now))/(365.25*24*60*60*1000));
  const depreciation=Math.min(policy.maxDepreciation,ageYears*policy.depreciationPerYear);
  const conditionFactor=Math.max(policy.structureResidualFloor,1-depreciation);
  const qualityFactor=policy.qualityValue[structure.quality]??1;
  const typeFactor=policy.typeValue[structure.type]??1;
  const buildCost=Math.max(0,finite(structure.buildCost,0));
  const structureValue=money(buildCost*conditionFactor*qualityFactor*typeFactor);
  const reference=money(landBand.reference+structureValue);
  return clone({
    landUid:land.uid,structureUid:structure.uid,neighborhoodIndex:landBand.neighborhoodIndex,
    landValue:landBand.reference,structureValue,reference,
    min:money(reference*policy.minPriceFactor),max:money(reference*policy.maxPriceFactor),
    ageYears:Math.round(ageYears*100)/100,depreciation:Math.round(depreciation*10000)/10000,
    type:structure.type,quality:structure.quality,totalAreaM2:structure.totalAreaM2,floors:structure.floors
  });
}

export function createPropertyMarket(options={}){
  const market=options.market;
  assert(market&&typeof market.getLand==='function'&&typeof market.snapshot==='function'&&typeof market.hydrate==='function','MARKET_REQUIRED','Mercado base de terrenos é obrigatório.');
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  const policy={...POLICY,...(options.policy||{})};
  let seq=0;
  const nextId=typeof options.idFactory==='function'?options.idFactory:(prefix)=>`${prefix}-${now().toString(36)}-${(++seq).toString(36)}`;
  const listings=new Map(),offers=new Map();

  const getListing=id=>listings.get(text(id,100))||null;
  const getOffer=id=>offers.get(text(id,100))||null;
  function expireOffers(){const t=now();for(const o of offers.values())if((o.status==='open'||o.status==='countered')&&o.expiresAt<=t)o.status='expired'}
  function activePropertyListing(landUid){for(const l of listings.values())if(l.landUid===landUid&&l.status==='active')return l;return null}
  function neighborhoodIndex(land){return typeof market.getNeighborhoodIndex==='function'?market.getNeighborhoodIndex(land.neighborhood):1}
  function publicListing(l){if(!l)return null;const land=market.getLand(l.landUid),structure=builtStructure(land);return clone({...l,property:land&&structure?{landUid:land.uid,structureUid:structure.uid,ownerUid:land.ownerUid,neighborhood:land.neighborhood,zone:land.zone,landAreaM2:land.areaM2,type:structure.type,quality:structure.quality,floors:structure.floors,totalAreaM2:structure.totalAreaM2,name:structure.name||''}:null,valuation:land&&structure?quoteBuiltPropertyValue(land,neighborhoodIndex(land),{...policy,now:now()}):null})}

  function commitLand(landUid,mutator){const snap=market.snapshot(),land=mutableLand(snap,landUid);assert(land,'LAND_NOT_FOUND','Imóvel não encontrado.');mutator(land,snap);market.hydrate(snap);return market.getLand(landUid)}

  function createListing({landUid,sellerUid,askingPrice,allowFinancing=true}){
    expireOffers();const land=market.getLand(landUid),seller=text(sellerUid,100);assert(land,'LAND_NOT_FOUND','Imóvel não encontrado.');assert(land.ownerUid===seller,'NOT_PROPERTY_OWNER','Somente o proprietário pode anunciar o imóvel.');
    const structure=builtStructure(land);assert(structure,'PROPERTY_NOT_BUILT','Somente imóvel construído pode entrar neste mercado.');
    assert(!(land.financing?.active&&finite(land.financing.balance,0)>0),'PROPERTY_FINANCING_ACTIVE','Quite o financiamento atual antes de vender o imóvel.');
    assert(!activePropertyListing(land.uid),'PROPERTY_ALREADY_LISTED','Este imóvel já está anunciado.');
    const baseSnap=market.snapshot();assert(!activeVacantListing(baseSnap,land.uid),'VACANT_LAND_LISTING_CONFLICT','Remova o anúncio de terreno vazio antes de anunciar o imóvel.');
    const valuation=quoteBuiltPropertyValue(land,neighborhoodIndex(land),{...policy,now:now()}),price=money(askingPrice);
    assert(price>=valuation.min&&price<=valuation.max,'ASKING_PRICE_OUT_OF_RANGE','Preço fora da faixa segura do imóvel.',{price,min:valuation.min,max:valuation.max,reference:valuation.reference});
    const listing={id:nextId('property-listing'),landUid:land.uid,structureUid:structure.uid,sellerUid:seller,askingPrice:price,allowFinancing:!!allowFinancing,status:'active',createdAt:now(),updatedAt:now(),sign:{visible:true,label:'IMÓVEL À VENDA'}};
    listings.set(listing.id,listing);
    commitLand(land.uid,target=>pushHistory(target,{at:now(),type:'property_listed',listingId:listing.id,structureUid:structure.uid,price}));
    return publicListing(listing);
  }

  function cancelListing({listingId,sellerUid}){
    const l=getListing(listingId);assert(l,'LISTING_NOT_FOUND','Anúncio não encontrado.');assert(l.sellerUid===text(sellerUid,100),'NOT_LISTING_OWNER','Somente o vendedor pode remover o anúncio.');assert(l.status==='active','LISTING_NOT_ACTIVE','Anúncio não está ativo.');
    l.status='cancelled';l.updatedAt=now();l.sign.visible=false;for(const o of offers.values())if(o.listingId===l.id&&(o.status==='open'||o.status==='countered'))o.status='cancelled';
    commitLand(l.landUid,target=>pushHistory(target,{at:now(),type:'property_listing_cancelled',listingId:l.id,structureUid:l.structureUid}));return publicListing(l);
  }

  function makeOffer({listingId,buyerUid,amount,payment}){
    expireOffers();const l=getListing(listingId);assert(l&&l.status==='active','LISTING_NOT_ACTIVE','Anúncio indisponível.');const buyer=text(buyerUid,100);assert(buyer&&buyer!==l.sellerUid,'INVALID_BUYER','O vendedor não pode comprar o próprio imóvel.');
    let open=0;for(const o of offers.values())if(o.buyerUid===buyer&&(o.status==='open'||o.status==='countered'))open++;assert(open<policy.maxOpenOffersPerBuyer,'TOO_MANY_OPEN_OFFERS','Limite de ofertas abertas atingido.');
    const price=money(amount);assert(price>0,'INVALID_OFFER_AMOUNT','Valor da oferta inválido.');const pay=normalizePayment(payment);assert(pay.mode==='cash'||l.allowFinancing,'FINANCING_NOT_ALLOWED','Este anúncio não aceita financiamento.');if(pay.mode==='financed')assert(pay.downPayment<=price,'DOWN_PAYMENT_TOO_HIGH','Entrada maior que o valor da oferta.');
    const offer={id:nextId('property-offer'),listingId:l.id,landUid:l.landUid,structureUid:l.structureUid,buyerUid:buyer,sellerUid:l.sellerUid,amount:price,payment:pay,status:'open',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.offerTtlMs,parentOfferId:null};offers.set(offer.id,offer);return clone(offer);
  }

  function counterOffer({offerId,sellerUid,amount,payment}){
    expireOffers();const prev=getOffer(offerId);assert(prev&&(prev.status==='open'||prev.status==='countered'),'OFFER_NOT_OPEN','Oferta não está aberta.');assert(prev.sellerUid===text(sellerUid,100),'NOT_OFFER_SELLER','Somente o vendedor pode fazer contraproposta.');const l=getListing(prev.listingId);assert(l&&l.status==='active','LISTING_NOT_ACTIVE','Anúncio indisponível.');
    const price=money(amount);assert(price>0,'INVALID_OFFER_AMOUNT','Valor da contraproposta inválido.');const pay=normalizePayment(payment||prev.payment);assert(pay.mode==='cash'||l.allowFinancing,'FINANCING_NOT_ALLOWED','Este anúncio não aceita financiamento.');prev.status='superseded';prev.updatedAt=now();
    const counter={id:nextId('property-offer'),listingId:l.id,landUid:l.landUid,structureUid:l.structureUid,buyerUid:prev.buyerUid,sellerUid:l.sellerUid,amount:price,payment:pay,status:'countered',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.offerTtlMs,parentOfferId:prev.id};offers.set(counter.id,counter);return clone(counter);
  }

  function rejectOffer({offerId,actorUid}){const o=getOffer(offerId);assert(o&&(o.status==='open'||o.status==='countered'),'OFFER_NOT_OPEN','Oferta não está aberta.');const actor=text(actorUid,100);assert(actor===o.sellerUid||actor===o.buyerUid,'NOT_OFFER_PARTY','Jogador não participa desta negociação.');o.status=actor===o.buyerUid?'withdrawn':'rejected';o.updatedAt=now();return clone(o)}

  function settlementQuote(offerId){
    expireOffers();const o=getOffer(offerId);assert(o&&(o.status==='open'||o.status==='countered'),'OFFER_NOT_OPEN','Oferta não está aberta.');const l=getListing(o.listingId),land=l&&market.getLand(l.landUid),structure=builtStructure(land);assert(l&&l.status==='active'&&land&&structure,'LISTING_NOT_ACTIVE','Anúncio indisponível.');assert(land.ownerUid===l.sellerUid,'PROPERTY_OWNER_CHANGED','Proprietário do imóvel mudou.');assert(structure.uid===l.structureUid,'STRUCTURE_CHANGED','A construção do imóvel foi alterada após o anúncio.');assert(!(land.financing?.active&&finite(land.financing.balance,0)>0),'PROPERTY_FINANCING_ACTIVE','Existe financiamento ativo neste imóvel.');
    const financed=o.payment.mode==='financed',cashDue=financed?o.payment.downPayment:o.amount,principal=financed?money(o.amount-o.payment.downPayment):0;
    return clone({offerId:o.id,listingId:l.id,landUid:land.uid,structureUid:structure.uid,sellerUid:o.sellerUid,buyerUid:o.buyerUid,total:o.amount,mode:o.payment.mode,cashDue,principal,termMonths:financed?o.payment.termMonths:0,annualRate:financed?o.payment.annualRate:0});
  }

  function acceptOffer({offerId,sellerUid,financeApprover}){
    const quote=settlementQuote(offerId),o=getOffer(offerId),l=getListing(o.listingId),land=market.getLand(l.landUid),structure=clone(builtStructure(land));assert(quote.sellerUid===text(sellerUid,100),'NOT_OFFER_SELLER','Somente o vendedor pode aceitar a oferta.');assert(market.getBalance(quote.buyerUid)>=quote.cashDue,'INSUFFICIENT_FUNDS','Comprador não possui saldo para a entrada ou pagamento à vista.',{required:quote.cashDue,balance:market.getBalance(quote.buyerUid)});
    let financing=null;if(quote.mode==='financed'){assert(typeof financeApprover==='function','FINANCE_APPROVER_REQUIRED','Venda financiada exige aprovação do financiamento.');financing=financeApprover(clone(quote));assert(financing&&financing.approved===true,'FINANCING_DENIED','Financiamento não aprovado.',{reason:financing?.reason||''})}
    market.setBalance(quote.buyerUid,money(market.getBalance(quote.buyerUid)-quote.cashDue));market.setBalance(quote.sellerUid,money(market.getBalance(quote.sellerUid)+quote.total));
    const transferred=commitLand(quote.landUid,target=>{const previousOwner=target.ownerUid;target.ownerUid=quote.buyerUid;target.acquiredAt=now();target.financing=quote.mode==='financed'?{active:quote.principal>0,balance:quote.principal,contractUid:text(financing.contractUid||nextId('property-loan'),100)}:{active:false,balance:0,contractUid:''};pushHistory(target,{at:now(),type:'property_sold',listingId:l.id,offerId:o.id,fromUid:previousOwner,toUid:target.ownerUid,price:quote.total,paymentMode:quote.mode,landUid:target.uid,structureUid:structure.uid,structureType:structure.type,neighborhood:target.neighborhood,zone:target.zone})});
    l.status='sold';l.updatedAt=now();l.sign.visible=false;o.status='accepted';o.updatedAt=now();for(const other of offers.values())if(other.listingId===l.id&&other.id!==o.id&&(other.status==='open'||other.status==='countered'))other.status='lost';
    return clone({land:transferred,structure:transferred.metadata.structure,listing:publicListing(l),offer:o,settlement:quote,financing});
  }

  function listActive({neighborhood,zone,type,minPrice=0,maxPrice=Infinity}={}){expireOffers();const n=text(neighborhood,80),z=text(zone,80),tp=text(type,40),min=finite(minPrice,0),max=finite(maxPrice,Infinity),out=[];for(const l of listings.values())if(l.status==='active'){const land=market.getLand(l.landUid),structure=builtStructure(land);if(!land||!structure)continue;if(n&&land.neighborhood!==n)continue;if(z&&land.zone!==z)continue;if(tp&&structure.type!==tp)continue;if(l.askingPrice<min||l.askingPrice>max)continue;out.push(publicListing(l))}return out.sort((a,b)=>a.askingPrice-b.askingPrice||a.createdAt-b.createdAt)}
  function getOffersForListing(listingId){expireOffers();return[...offers.values()].filter(o=>o.listingId===text(listingId,100)).map(clone).sort((a,b)=>b.updatedAt-a.updatedAt)}
  function snapshot(){return clone({version:1,listings:[...listings.values()],offers:[...offers.values()]})}
  function hydrate(data){assert(data?.version===1,'UNSUPPORTED_PROPERTY_MARKET_SNAPSHOT','Snapshot do mercado de imóveis incompatível.');listings.clear();offers.clear();for(const l of data.listings||[])listings.set(l.id,clone(l));for(const o of data.offers||[])offers.set(o.id,clone(o));expireOffers();return snapshot()}

  return{createListing,cancelListing,makeOffer,counterOffer,rejectOffer,settlementQuote,acceptOffer,listActive,getOffersForListing,getListing:id=>publicListing(getListing(id)),snapshot,hydrate,quote:landUid=>quoteBuiltPropertyValue(market.getLand(landUid),neighborhoodIndex(market.getLand(landUid)),{...policy,now:now()})};
}

export const PROPERTY_MARKET_POLICY=POLICY;
