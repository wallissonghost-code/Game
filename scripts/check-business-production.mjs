import assert from 'node:assert/strict';
import {createLandMarket,LandMarketError} from '../src/core/land-market.mjs';
import {createPropertyLifecycle} from '../src/core/property-lifecycle.mjs';
import {createBusinessOperations} from '../src/core/business-operations.mjs';
import {createBusinessEmployment} from '../src/core/business-employment.mjs';
import {createBusinessProduction} from '../src/core/business-production.mjs';

let t=1_900_000_000_000;const now=()=>t++;
const market=createLandMarket({now});
const lifecycle=createPropertyLifecycle({market,now});
market.setBalance('owner',2_000_000);market.setBalance('worker1',0);market.setBalance('worker2',0);
market.registerLand({uid:'prod-land-01',ownerUid:'owner',neighborhood:'Industrial',zone:'Norte',areaM2:800,baseValue:200_000,status:'empty'});
lifecycle.construct({landUid:'prod-land-01',ownerUid:'owner',plan:{type:'industrial',quality:'standard',floors:1,footprintM2:300,name:'Fábrica Teste'}});
const ops=createBusinessOperations({market,now});
const biz=ops.openBusiness({ownerUid:'owner',landUid:'prod-land-01',name:'Ghost Foods',type:'factory',initialCapital:300_000});
ops.defineProduct({businessId:biz.id,ownerUid:'owner',sku:'farinha',name:'Farinha',salePrice:10,unitCost:2});
ops.defineProduct({businessId:biz.id,ownerUid:'owner',sku:'pao',name:'Pão',salePrice:8,unitCost:0});
ops.restock({businessId:biz.id,ownerUid:'owner',sku:'farinha',quantity:1000});

const jobs=createBusinessEmployment({business:ops,market,now});
const opening=jobs.createOpening({businessId:biz.id,ownerUid:'owner',title:'Operador de Produção',salary:1000,slots:2});
const a1=jobs.apply({openingId:opening.id,playerUid:'worker1'});jobs.hire({applicationId:a1.id,ownerUid:'owner'});
const a2=jobs.apply({openingId:opening.id,playerUid:'worker2'});jobs.hire({applicationId:a2.id,ownerUid:'owner'});

const production=createBusinessProduction({business:ops,employment:jobs,now});
production.defineRecipe({businessId:biz.id,ownerUid:'owner',id:'pao-basico',name:'Pão básico',outputSku:'pao',outputQty:100,inputs:{farinha:50},cycleMs:3_600_000});
const capacity=production.estimateCapacity(biz.id);assert.equal(capacity.workforce.employees,2);assert.ok(capacity.workforce.multiplier>1);
const quote=production.productionQuote({businessId:biz.id,recipeId:'pao-basico',cycles:2});assert.equal(quote.inputs.farinha,100);assert.ok(quote.effectiveOutput>200);assert.ok(quote.durationMs<7_200_000);
const run=production.runProduction({businessId:biz.id,ownerUid:'owner',recipeId:'pao-basico',cycles:2});
const after=ops.inspect(biz.id);assert.equal(after.products.farinha.stock,900);assert.equal(after.products.pao.stock,quote.effectiveOutput);assert.equal(after.stats.productionCycles,2);assert.equal(after.stats.unitsProduced,quote.effectiveOutput);
assert.throws(()=>production.runProduction({businessId:biz.id,ownerUid:'worker1',recipeId:'pao-basico',cycles:1}),e=>e instanceof LandMarketError&&e.code==='NOT_BUSINESS_OWNER');
production.defineRecipe({businessId:biz.id,ownerUid:'owner',id:'pao-pesado',outputSku:'pao',outputQty:1,inputs:{farinha:9999}});
assert.throws(()=>production.runProduction({businessId:biz.id,ownerUid:'owner',recipeId:'pao-pesado',cycles:1}),e=>e instanceof LandMarketError&&e.code==='INSUFFICIENT_INPUT_STOCK');
const snap=production.snapshot();const restored=createBusinessProduction({business:ops,employment:jobs,now});restored.hydrate(snap);assert.equal(restored.listRecipes(biz.id).length,2);
console.log('BUSINESS PRODUCTION OK',{businessId:biz.id,employees:capacity.workforce.employees,multiplier:capacity.workforce.multiplier,output:quote.effectiveOutput});
