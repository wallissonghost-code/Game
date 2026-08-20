import assert from 'node:assert/strict';
import {createLandMarket,LandMarketError} from '../src/core/land-market.mjs';
import {createPropertyLifecycle} from '../src/core/property-lifecycle.mjs';
import {createBusinessOperations} from '../src/core/business-operations.mjs';
import {createBusinessEmployment} from '../src/core/business-employment.mjs';

let t=1_800_000_000_000;
const now=()=>t;
const market=createLandMarket({now});
const lifecycle=createPropertyLifecycle({market,now});
const business=createBusinessOperations({market,now});
const jobs=createBusinessEmployment({market,business,now});

market.setBalance('owner',2_000_000);
market.setBalance('worker',1_000);
market.setBalance('worker2',1_000);
market.registerLand({uid:'job-land',ownerUid:'owner',neighborhood:'Centro',zone:'Sul',areaM2:500,baseValue:100_000,status:'empty'});
lifecycle.construct({landUid:'job-land',ownerUid:'owner',plan:{type:'commercial',quality:'standard',floors:1,footprintM2:150,name:'Loja Empregos'}});
const company=business.openBusiness({ownerUid:'owner',landUid:'job-land',name:'Ghost Shop',type:'retail',initialCapital:100_000});

const opening=jobs.createOpening({businessId:company.id,ownerUid:'owner',title:'Vendedor',salary:2_000,slots:2,description:'Atendimento e vendas'});
assert.equal(opening.status,'open');
assert.equal(jobs.listOpenings({businessId:company.id}).length,1);

const app=jobs.apply({openingId:opening.id,playerUid:'worker',note:'Tenho experiência'});
const app2=jobs.apply({openingId:opening.id,playerUid:'worker2'});
assert.equal(jobs.listApplications(opening.id).length,2);

const employment=jobs.hire({applicationId:app.id,ownerUid:'owner'});
assert.equal(employment.employeeUid,'worker');
assert.equal(jobs.getPlayerEmployment('worker').businessId,company.id);
assert.throws(()=>jobs.apply({openingId:opening.id,playerUid:'worker'}),e=>e instanceof LandMarketError&&e.code==='PLAYER_ALREADY_EMPLOYED');

jobs.reject({applicationId:app2.id,ownerUid:'owner'});

const beforeWorker=market.getBalance('worker');
const beforeTreasury=business.inspect(company.id).treasury;
const payroll=jobs.processPayroll({businessId:company.id,ownerUid:'owner',periods:2});
assert.equal(payroll.total,4_000);
assert.equal(market.getBalance('worker'),beforeWorker+4_000);
assert.equal(business.inspect(company.id).treasury,beforeTreasury-4_000);
assert.equal(jobs.listEmployees(company.id).length,1);

// Simula atraso de folha.
t+=15*24*60*60*1000;
const audit=jobs.auditPayroll(company.id);
assert.equal(audit[0].overdue,true);
assert.ok(audit[0].missedPayrolls>=1);
assert.ok(audit[0].amountDue>=2_000);

// Demissão com rescisão.
const treasuryBeforeFire=business.inspect(company.id).treasury;
const workerBeforeFire=market.getBalance('worker');
const ended=jobs.fire({employmentId:employment.id,ownerUid:'owner',paySeverance:true});
assert.equal(ended.status,'terminated');
assert.equal(ended.terminationReason,'fired');
assert.equal(market.getBalance('worker'),workerBeforeFire+2_000);
assert.equal(business.inspect(company.id).treasury,treasuryBeforeFire-2_000);
assert.equal(jobs.getPlayerEmployment('worker'),null);

// Novo vínculo e pedido de demissão.
const opening2=jobs.createOpening({businessId:company.id,ownerUid:'owner',title:'Caixa',salary:1_500,slots:1});
const app3=jobs.apply({openingId:opening2.id,playerUid:'worker2'});
const employment2=jobs.hire({applicationId:app3.id,ownerUid:'owner'});
const resigned=jobs.resign({employmentId:employment2.id,employeeUid:'worker2'});
assert.equal(resigned.terminationReason,'resigned');

const snap=jobs.snapshot();
const restored=createBusinessEmployment({market,business,now});
restored.hydrate(snap);
assert.equal(restored.getPlayerEmployment('worker'),null);
assert.equal(restored.getPlayerEmployment('worker2'),null);

console.log('BUSINESS EMPLOYMENT OK',{businessId:company.id,payrollTotal:payroll.total,terminated:2});
