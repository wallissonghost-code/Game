import assert from 'node:assert/strict';
import {createLandMarket,LandMarketError} from '../src/core/land-market.mjs';
import {createPropertyLifecycle} from '../src/core/property-lifecycle.mjs';
import {createPropertyMarket} from '../src/core/property-market.mjs';
import {createPropertyRental} from '../src/core/property-rental.mjs';

const DAY=24*60*60*1000;
let t=1_800_000_000_000;
const now=()=>t;
const landMarket=createLandMarket({now});
const lifecycle=createPropertyLifecycle({market:landMarket,now});
const propertyMarket=createPropertyMarket({market:landMarket,now});
const rental=createPropertyRental({market:landMarket,now,valuation:uid=>propertyMarket.quote(uid)});

landMarket.setNeighborhoodIndex('Centro',1.15);
landMarket.setBalance('owner',1_000_000);
landMarket.setBalance('tenant',120_000);
landMarket.setBalance('tenant2',120_000);
landMarket.registerLand({uid:'rent-land-01',ownerUid:'owner',neighborhood:'Centro',zone:'Sul',areaM2:500,baseValue:140_000,status:'empty'});
const built=lifecycle.construct({landUid:'rent-land-01',ownerUid:'owner',plan:{type:'house',quality:'premium',floors:1,footprintM2:180,name:'Casa Premium'}});
const structureUid=built.structure.uid;
const value=propertyMarket.quote('rent-land-01').reference;
const targetRent=Math.max(1200,Math.round(value*.006));

const listing=rental.createListing({landUid:'rent-land-01',ownerUid:'owner',monthlyRent:targetRent,depositMonths:2,termMonths:12});
assert.equal(listing.sign.label,'ALUGA-SE');
assert.equal(listing.property.structureUid,structureUid);
assert.equal(rental.listActive({type:'house'}).length,1);

const proposal=rental.apply({listingId:listing.id,tenantUid:'tenant',monthlyRent:targetRent-100,depositMonths:1,termMonths:12});
const counter=rental.counter({applicationId:proposal.id,ownerUid:'owner',monthlyRent:targetRent,depositMonths:2,termMonths:12});
const accepted=rental.accept({applicationId:counter.id,ownerUid:'owner'});
assert.equal(accepted.contract.status,'active');
assert.equal(accepted.contract.tenantUid,'tenant');
assert.equal(accepted.contract.structureUid,structureUid);
assert.equal(landMarket.getLand('rent-land-01').metadata.rentalContract.id,accepted.contract.id);

assert.throws(()=>lifecycle.demolish({landUid:'rent-land-01',ownerUid:'owner'}),e=>e instanceof LandMarketError&&e.code==='PROPERTY_RENTED');
assert.throws(()=>lifecycle.reconstruct({landUid:'rent-land-01',ownerUid:'owner',plan:{type:'house',quality:'luxury',floors:2,footprintM2:170}}),e=>e instanceof LandMarketError&&e.code==='PROPERTY_RENTED');

const tenantBefore=landMarket.getBalance('tenant');
rental.payRent({contractId:accepted.contract.id,tenantUid:'tenant',periods:1});
assert.ok(landMarket.getBalance('tenant')<tenantBefore);

// Avança para depois da próxima cobrança + carência sem pagar.
t+=36*DAY;
const delinquent=rental.checkContract(accepted.contract.id);
assert.equal(delinquent.status,'delinquent');
assert.ok(delinquent.overdueAmount>0);
const repossessed=rental.repossess({contractId:accepted.contract.id,ownerUid:'owner'});
assert.equal(repossessed.contract.status,'terminated');
assert.equal(repossessed.contract.terminationReason,'delinquent');
assert.equal(repossessed.depositRefund,0);

// Depois da retomada, o proprietário volta a poder mexer no imóvel.
const rebuilt=lifecycle.reconstruct({landUid:'rent-land-01',ownerUid:'owner',plan:{type:'house',quality:'luxury',floors:2,footprintM2:160,name:'Casa Pós Locação'}});
assert.equal(rebuilt.land.uid,'rent-land-01');
assert.notEqual(rebuilt.structure.uid,structureUid);

// Segundo contrato: encerramento normal devolve a caução.
const listing2=rental.createListing({landUid:'rent-land-01',ownerUid:'owner',monthlyRent:targetRent,depositMonths:1,termMonths:1});
const app2=rental.apply({listingId:listing2.id,tenantUid:'tenant2'});
const lease2=rental.accept({applicationId:app2.id,ownerUid:'owner'});
const deposit2=lease2.contract.depositAmount;
t+=31*DAY;
assert.equal(rental.checkContract(lease2.contract.id).status,'expired');
const tenant2Before=landMarket.getBalance('tenant2');
const ended=rental.repossess({contractId:lease2.contract.id,ownerUid:'owner'});
assert.equal(ended.depositRefund,deposit2);
assert.equal(landMarket.getBalance('tenant2'),tenant2Before+deposit2);

const history=landMarket.getLandHistory('rent-land-01');
assert.ok(history.some(x=>x.type==='rental_started'));
assert.ok(history.some(x=>x.type==='rent_paid'));
assert.ok(history.some(x=>x.type==='rental_repossessed'));

console.log('PROPERTY RENTAL OK',{landUid:'rent-land-01',firstContract:accepted.contract.id,secondContract:lease2.contract.id,history:history.length});
