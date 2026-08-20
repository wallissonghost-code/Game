import assert from 'node:assert/strict';
import {createLandMarket,LandMarketError} from '../src/core/land-market.mjs';
import {createPropertyLifecycle} from '../src/core/property-lifecycle.mjs';

let t=1_900_000_000_000;
const market=createLandMarket({now:()=>t++});
market.setBalance('owner',2_000_000);
market.registerLand({uid:'land-life-001',ownerUid:'owner',neighborhood:'Centro',zone:'Sul',areaM2:500,baseValue:120_000,status:'empty',metadata:{sector:'A-01'}});

const lifecycle=createPropertyLifecycle({market,now:()=>t++});
const before=market.getLand('land-life-001');
assert.equal(before.uid,'land-life-001');
assert.equal(before.status,'empty');

const quote=lifecycle.quoteConstruction('land-life-001',{type:'house',quality:'standard',floors:2,footprintM2:160,name:'Casa Inicial'});
assert.equal(quote.totalAreaM2,320);
assert.ok(quote.constructionCost>0);

const built=lifecycle.construct({landUid:'land-life-001',ownerUid:'owner',plan:{type:'house',quality:'standard',floors:2,footprintM2:160,name:'Casa Inicial',modelAsset:'assets/buildings/house-01.glb'}});
assert.equal(built.land.uid,'land-life-001');
assert.equal(built.land.status,'built');
assert.equal(built.structure.landUid,'land-life-001');
assert.equal(built.structure.generation,1);
assert.equal(built.structure.name,'Casa Inicial');
const firstStructureUid=built.structure.uid;

assert.throws(
  ()=>market.createListing({landUid:'land-life-001',sellerUid:'owner',askingPrice:120_000}),
  e=>e instanceof LandMarketError&&e.code==='LAND_NOT_EMPTY'
);

const demolitionQuote=lifecycle.quoteDemolition('land-life-001');
assert.ok(demolitionQuote.cost>0);
const demolished=lifecycle.demolish({landUid:'land-life-001',ownerUid:'owner'});
assert.equal(demolished.land.uid,'land-life-001');
assert.equal(demolished.land.status,'empty');
assert.equal(demolished.land.metadata.structure,null);
assert.equal(demolished.removedStructure.uid,firstStructureUid);

const rebuiltFromEmpty=lifecycle.construct({landUid:'land-life-001',ownerUid:'owner',plan:{type:'commercial',quality:'premium',floors:3,footprintM2:180,name:'Centro Comercial'}});
assert.equal(rebuiltFromEmpty.land.uid,'land-life-001');
assert.equal(rebuiltFromEmpty.structure.generation,2);
assert.notEqual(rebuiltFromEmpty.structure.uid,firstStructureUid);
const secondStructureUid=rebuiltFromEmpty.structure.uid;

const reconstructed=lifecycle.reconstruct({landUid:'land-life-001',ownerUid:'owner',plan:{type:'apartment',quality:'luxury',floors:5,footprintM2:200,name:'Residencial Prime'}});
assert.equal(reconstructed.land.uid,'land-life-001');
assert.equal(reconstructed.land.neighborhood,'Centro');
assert.equal(reconstructed.land.zone,'Sul');
assert.equal(reconstructed.land.areaM2,500);
assert.equal(reconstructed.land.metadata.sector,'A-01');
assert.equal(reconstructed.previousStructure.uid,secondStructureUid);
assert.equal(reconstructed.structure.generation,3);
assert.notEqual(reconstructed.structure.uid,secondStructureUid);
assert.equal(reconstructed.structure.name,'Residencial Prime');
assert.equal(reconstructed.land.status,'built');

const history=market.getLandHistory('land-life-001');
assert.ok(history.some(x=>x.type==='constructed'));
assert.ok(history.filter(x=>x.type==='demolished').length>=2);
assert.ok(history.some(x=>x.type==='reconstructed'));

market.registerLand({uid:'land-listed-001',ownerUid:'owner',neighborhood:'Centro',zone:'Sul',areaM2:300,baseValue:100_000,status:'empty'});
market.createListing({landUid:'land-listed-001',sellerUid:'owner',askingPrice:100_000});
assert.throws(
  ()=>lifecycle.construct({landUid:'land-listed-001',ownerUid:'owner',plan:{footprintM2:100,floors:1}}),
  e=>e instanceof LandMarketError&&e.code==='LAND_LISTED_FOR_SALE'
);

assert.throws(
  ()=>lifecycle.construct({landUid:'land-life-001',ownerUid:'other',plan:{footprintM2:100}}),
  e=>e instanceof LandMarketError&&e.code==='NOT_LAND_OWNER'
);

console.log('PROPERTY LIFECYCLE OK',{
  landUid:reconstructed.land.uid,
  generation:reconstructed.structure.generation,
  structureUid:reconstructed.structure.uid,
  historyEvents:history.length,
  balance:market.getBalance('owner')
});
