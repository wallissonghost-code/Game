import assert from 'node:assert/strict';
import {createLandMarket,LandMarketError} from '../src/core/land-market.mjs';
import {createPropertyLifecycle} from '../src/core/property-lifecycle.mjs';
import {createPropertyMarket} from '../src/core/property-market.mjs';

let t=1_800_000_000_000;
const now=()=>t++;
const landMarket=createLandMarket({now});
const lifecycle=createPropertyLifecycle({market:landMarket,now});
const propertyMarket=createPropertyMarket({market:landMarket,now});

landMarket.setNeighborhoodIndex('Centro',1.2);
landMarket.setBalance('seller',1_000_000);
landMarket.setBalance('buyer',900_000);
landMarket.setBalance('buyer2',900_000);
landMarket.registerLand({uid:'land-built-01',ownerUid:'seller',neighborhood:'Centro',zone:'Sul',areaM2:600,baseValue:150_000,status:'empty',metadata:{seed:'CITY-A'}});

const built=lifecycle.construct({landUid:'land-built-01',ownerUid:'seller',plan:{type:'commercial',quality:'premium',floors:2,footprintM2:180,name:'Loja Centro'}});
const originalLandUid=built.land.uid,originalStructureUid=built.structure.uid;
assert.equal(built.land.status,'built');

const valuation=propertyMarket.quote('land-built-01');
assert.ok(valuation.reference>valuation.landValue);
assert.equal(valuation.structureUid,originalStructureUid);

const listing=propertyMarket.createListing({landUid:'land-built-01',sellerUid:'seller',askingPrice:valuation.reference,allowFinancing:true});
assert.equal(listing.sign.label,'IMÓVEL À VENDA');
assert.equal(listing.property.structureUid,originalStructureUid);
assert.equal(propertyMarket.listActive({type:'commercial'}).length,1);

const low=propertyMarket.makeOffer({listingId:listing.id,buyerUid:'buyer2',amount:valuation.reference-20_000,payment:{mode:'cash'}});
const counter=propertyMarket.counterOffer({offerId:low.id,sellerUid:'seller',amount:valuation.reference-5_000,payment:{mode:'cash'}});
assert.equal(counter.parentOfferId,low.id);
propertyMarket.rejectOffer({offerId:counter.id,actorUid:'buyer2'});

const financed=propertyMarket.makeOffer({listingId:listing.id,buyerUid:'buyer',amount:valuation.reference,payment:{mode:'financed',downPayment:100_000,termMonths:180,annualRate:.085}});
const sale=propertyMarket.acceptOffer({offerId:financed.id,sellerUid:'seller',financeApprover:q=>({approved:true,contractUid:`property-loan-${q.landUid}`})});
assert.equal(sale.land.ownerUid,'buyer');
assert.equal(sale.land.uid,originalLandUid);
assert.equal(sale.structure.uid,originalStructureUid);
assert.equal(sale.land.metadata.seed,'CITY-A');
assert.equal(sale.land.financing.active,true);
assert.equal(propertyMarket.listActive().length,0);

assert.throws(()=>propertyMarket.createListing({landUid:'land-built-01',sellerUid:'buyer',askingPrice:valuation.reference}),e=>e instanceof LandMarketError&&e.code==='PROPERTY_FINANCING_ACTIVE');

landMarket.setBalance('buyer',2_000_000);
landMarket.payLandFinancing({landUid:'land-built-01',ownerUid:'buyer',amount:sale.land.financing.balance});
const listing2=propertyMarket.createListing({landUid:'land-built-01',sellerUid:'buyer',askingPrice:propertyMarket.quote('land-built-01').reference,allowFinancing:false});
assert.equal(listing2.property.ownerUid,'buyer');

assert.throws(()=>propertyMarket.makeOffer({listingId:listing2.id,buyerUid:'buyer2',amount:listing2.askingPrice,payment:{mode:'financed',downPayment:50_000}}),e=>e instanceof LandMarketError&&e.code==='FINANCING_NOT_ALLOWED');

const cash=propertyMarket.makeOffer({listingId:listing2.id,buyerUid:'buyer2',amount:listing2.askingPrice,payment:{mode:'cash'}});
propertyMarket.acceptOffer({offerId:cash.id,sellerUid:'buyer'});
const finalLand=landMarket.getLand('land-built-01');
assert.equal(finalLand.ownerUid,'buyer2');
assert.equal(finalLand.uid,originalLandUid);
assert.equal(finalLand.metadata.structure.uid,originalStructureUid);
assert.equal(finalLand.history.filter(x=>x.type==='property_sold').length,2);

const snap=propertyMarket.snapshot();
const restored=createPropertyMarket({market:landMarket,now});
restored.hydrate(snap);
assert.equal(restored.listActive().length,0);

console.log('PROPERTY MARKET OK',{landUid:finalLand.uid,structureUid:finalLand.metadata.structure.uid,ownerUid:finalLand.ownerUid,sales:finalLand.history.filter(x=>x.type==='property_sold').length});
