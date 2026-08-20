import assert from 'node:assert/strict';
import {createLandMarket,LandMarketError} from '../src/core/land-market.mjs';

let t=1_800_000_000_000;
const market=createLandMarket({now:()=>t++});

market.setNeighborhoodIndex('Centro',1.25);
market.setBalance('seller',10_000);
market.setBalance('buyer',300_000);
market.setBalance('buyer2',300_000);

market.registerLand({
  uid:'land-001',ownerUid:'seller',neighborhood:'Centro',zone:'Sul',areaM2:420,
  baseValue:100_000,status:'empty',metadata:{sector:'S-04',seed:'CITY-01'}
});

const listing=market.createListing({landUid:'land-001',sellerUid:'seller',askingPrice:135_000,allowFinancing:true});
assert.equal(listing.sign.visible,true);
assert.equal(listing.sign.label,'TERRENO À VENDA');
assert.equal(listing.land.uid,'land-001');
assert.equal(market.listActive({neighborhood:'Centro'}).length,1);

assert.throws(
  ()=>market.createListing({landUid:'land-001',sellerUid:'seller',askingPrice:300_000}),
  e=>e instanceof LandMarketError&&e.code==='LAND_ALREADY_LISTED'
);

const low=market.makeOffer({listingId:listing.id,buyerUid:'buyer2',amount:120_000,payment:{mode:'cash'}});
const counter=market.counterOffer({offerId:low.id,sellerUid:'seller',amount:130_000,payment:{mode:'cash'}});
assert.equal(counter.parentOfferId,low.id);
market.rejectOffer({offerId:counter.id,actorUid:'buyer2'});

const financed=market.makeOffer({
  listingId:listing.id,buyerUid:'buyer',amount:135_000,
  payment:{mode:'financed',downPayment:35_000,termMonths:120,annualRate:.09}
});
const quote=market.settlementQuote(financed.id);
assert.equal(quote.cashDue,35_000);
assert.equal(quote.principal,100_000);

const sale=market.acceptOffer({
  offerId:financed.id,sellerUid:'seller',
  financeApprover:q=>({approved:true,contractUid:`mortgage-${q.landUid}`})
});
assert.equal(sale.land.ownerUid,'buyer');
assert.equal(sale.land.uid,'land-001');
assert.equal(sale.land.neighborhood,'Centro');
assert.equal(sale.land.zone,'Sul');
assert.equal(sale.land.areaM2,420);
assert.equal(sale.land.metadata.seed,'CITY-01');
assert.equal(sale.land.financing.active,true);
assert.equal(sale.land.financing.balance,100_000);
assert.equal(market.getBalance('seller'),145_000);
assert.equal(market.getBalance('buyer'),265_000);
assert.equal(market.listActive().length,0);

assert.throws(
  ()=>market.createListing({landUid:'land-001',sellerUid:'buyer',askingPrice:140_000}),
  e=>e instanceof LandMarketError&&e.code==='LAND_FINANCING_ACTIVE'
);

market.payLandFinancing({landUid:'land-001',ownerUid:'buyer',amount:100_000});
const relisted=market.createListing({landUid:'land-001',sellerUid:'buyer',askingPrice:150_000,allowFinancing:false});
assert.equal(relisted.status,'active');

assert.throws(
  ()=>market.makeOffer({listingId:relisted.id,buyerUid:'buyer2',amount:150_000,payment:{mode:'financed',downPayment:50_000}}),
  e=>e instanceof LandMarketError&&e.code==='FINANCING_NOT_ALLOWED'
);

const cash=market.makeOffer({listingId:relisted.id,buyerUid:'buyer2',amount:150_000,payment:{mode:'cash'}});
market.acceptOffer({offerId:cash.id,sellerUid:'buyer'});
const finalLand=market.getLand('land-001');
assert.equal(finalLand.ownerUid,'buyer2');
assert.equal(finalLand.uid,'land-001');
assert.equal(finalLand.history.filter(x=>x.type==='sold').length,2);

const snapshot=market.snapshot();
const restored=createLandMarket({now:()=>t++});
restored.hydrate(snapshot);
assert.equal(restored.getLand('land-001').ownerUid,'buyer2');
assert.equal(restored.getLandHistory('land-001').filter(x=>x.type==='sold').length,2);

console.log('LAND MARKET OK',{
  landUid:finalLand.uid,
  ownerUid:finalLand.ownerUid,
  sales:finalLand.history.filter(x=>x.type==='sold').length,
  neighborhoodIndex:market.getNeighborhoodIndex('Centro')
});
