import {LandMarketError} from './land-market.mjs';

const POLICY=Object.freeze({
  minSalary:100,
  maxSalary:1000000,
  maxOpeningsPerBusiness:20,
  maxApplicationsPerPlayer:12,
  payrollPeriodMs:7*24*60*60*1000,
  applicationTtlMs:7*24*60*60*1000,
  maxEmployeesPerBusiness:50,
  severancePeriods:1
});

const money=v=>Math.round(Number(v)*100)/100;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const text=(v,max=100)=>String(v??'').trim().slice(0,max);
const clone=v=>JSON.parse(JSON.stringify(v));
const assert=(ok,code,message,details={})=>{if(!ok)throw new LandMarketError(code,message,details)};

export function createBusinessEmployment(options={}){
  const business=options.business;
  const market=options.market;
  assert(business&&typeof business.inspect==='function'&&typeof business.snapshot==='function'&&typeof business.hydrate==='function','BUSINESS_SYSTEM_REQUIRED','Sistema de empresas é obrigatório.');
  assert(market&&typeof market.getBalance==='function'&&typeof market.setBalance==='function','MARKET_REQUIRED','Mercado base é obrigatório.');
  const now=typeof options.now==='function'?options.now:()=>Date.now();
  const policy={...POLICY,...(options.policy||{})};
  let seq=0;
  const nextId=typeof options.idFactory==='function'?options.idFactory:(prefix)=>`${prefix}-${now().toString(36)}-${(++seq).toString(36)}`;
  const openings=new Map(),applications=new Map(),employments=new Map(),payrolls=[];

  const getOpening=id=>openings.get(text(id,100))||null;
  const getApplication=id=>applications.get(text(id,100))||null;
  const getEmployment=id=>employments.get(text(id,100))||null;

  function requireOwner(businessId,ownerUid){const b=business.inspect(businessId);assert(b&&b.status==='active','BUSINESS_NOT_ACTIVE','Empresa não está ativa.');assert(b.ownerUid===text(ownerUid,100),'NOT_BUSINESS_OWNER','Somente o dono da empresa pode executar esta ação.');return b}
  function activeEmployees(businessId){return[...employments.values()].filter(e=>e.businessId===businessId&&e.status==='active')}
  function playerActiveEmployment(playerUid){const uid=text(playerUid,100);return[...employments.values()].find(e=>e.employeeUid===uid&&e.status==='active')||null}
  function mutateTreasury(businessId,fn){const snap=business.snapshot(),b=(snap.businesses||[]).find(x=>x.id===businessId);assert(b,'BUSINESS_NOT_FOUND','Empresa não encontrada.');fn(b);b.updatedAt=now();business.hydrate(snap);return business.inspect(businessId)}
  function expireApplications(){const t=now();for(const a of applications.values())if(a.status==='open'&&a.expiresAt<=t)a.status='expired'}

  function createOpening({businessId,ownerUid,title,salary,slots=1,description=''}){
    const b=requireOwner(businessId,ownerUid);
    const active=[...openings.values()].filter(o=>o.businessId===b.id&&o.status==='open').length;
    assert(active<policy.maxOpeningsPerBusiness,'OPENING_LIMIT_REACHED','Limite de vagas abertas atingido.');
    const wage=money(salary);assert(wage>=policy.minSalary&&wage<=policy.maxSalary,'SALARY_OUT_OF_RANGE','Salário fora da faixa permitida.');
    const count=Math.max(1,Math.min(policy.maxEmployeesPerBusiness,Math.trunc(finite(slots,1))));
    const o={id:nextId('job'),businessId:b.id,ownerUid:b.ownerUid,title:text(title||'Funcionário',80),description:text(description,300),salary:wage,slots:count,filled:0,status:'open',createdAt:now(),updatedAt:now()};
    openings.set(o.id,o);return clone(o);
  }

  function closeOpening({openingId,ownerUid}){const o=getOpening(openingId);assert(o,'OPENING_NOT_FOUND','Vaga não encontrada.');requireOwner(o.businessId,ownerUid);assert(o.status==='open','OPENING_NOT_OPEN','Vaga não está aberta.');o.status='closed';o.updatedAt=now();for(const a of applications.values())if(a.openingId===o.id&&a.status==='open')a.status='cancelled';return clone(o)}

  function apply({openingId,playerUid,note=''}){
    expireApplications();const o=getOpening(openingId);assert(o&&o.status==='open','OPENING_NOT_OPEN','Vaga não está disponível.');const uid=text(playerUid,100);assert(uid&&uid!==o.ownerUid,'INVALID_APPLICANT','Dono da empresa não pode se candidatar à própria vaga.');assert(!playerActiveEmployment(uid),'PLAYER_ALREADY_EMPLOYED','Jogador já possui emprego ativo.');
    let open=0;for(const a of applications.values())if(a.playerUid===uid&&a.status==='open')open++;assert(open<policy.maxApplicationsPerPlayer,'TOO_MANY_APPLICATIONS','Limite de candidaturas abertas atingido.');assert(![...applications.values()].some(a=>a.openingId===o.id&&a.playerUid===uid&&a.status==='open'),'APPLICATION_ALREADY_EXISTS','Jogador já se candidatou a esta vaga.');
    const a={id:nextId('job-application'),openingId:o.id,businessId:o.businessId,playerUid:uid,note:text(note,300),status:'open',createdAt:now(),updatedAt:now(),expiresAt:now()+policy.applicationTtlMs};applications.set(a.id,a);return clone(a)
  }

  function reject({applicationId,ownerUid}){const a=getApplication(applicationId);assert(a&&a.status==='open','APPLICATION_NOT_OPEN','Candidatura não está aberta.');requireOwner(a.businessId,ownerUid);a.status='rejected';a.updatedAt=now();return clone(a)}
  function withdraw({applicationId,playerUid}){const a=getApplication(applicationId);assert(a&&a.status==='open','APPLICATION_NOT_OPEN','Candidatura não está aberta.');assert(a.playerUid===text(playerUid,100),'NOT_APPLICANT','Somente o candidato pode retirar a candidatura.');a.status='withdrawn';a.updatedAt=now();return clone(a)}

  function hire({applicationId,ownerUid}){
    expireApplications();const a=getApplication(applicationId);assert(a&&a.status==='open','APPLICATION_NOT_OPEN','Candidatura não está aberta.');const o=getOpening(a.openingId);assert(o&&o.status==='open','OPENING_NOT_OPEN','Vaga não está aberta.');const b=requireOwner(a.businessId,ownerUid);assert(activeEmployees(b.id).length<policy.maxEmployeesPerBusiness,'EMPLOYEE_LIMIT_REACHED','Limite de funcionários atingido.');assert(!playerActiveEmployment(a.playerUid),'PLAYER_ALREADY_EMPLOYED','Jogador já possui emprego ativo.');assert(o.filled<o.slots,'OPENING_FILLED','Todas as vagas desta oferta já foram preenchidas.');
    const at=now(),e={id:nextId('employment'),businessId:b.id,openingId:o.id,employeeUid:a.playerUid,ownerUid:b.ownerUid,title:o.title,salary:o.salary,status:'active',hiredAt:at,lastPayrollAt:at,nextPayrollAt:at+policy.payrollPeriodMs,totalPaid:0,payrollCount:0,missedPayrolls:0,createdAt:at,updatedAt:at};employments.set(e.id,e);a.status='hired';a.updatedAt=at;o.filled++;if(o.filled>=o.slots)o.status='filled';o.updatedAt=at;for(const other of applications.values())if(other.playerUid===a.playerUid&&other.id!==a.id&&other.status==='open')other.status='withdrawn';return clone(e)
  }

  function processPayroll({businessId,ownerUid,periods=1}){
    const b=requireOwner(businessId,ownerUid),count=Math.max(1,Math.min(12,Math.trunc(finite(periods,1)))),employees=activeEmployees(b.id);assert(employees.length>0,'NO_ACTIVE_EMPLOYEES','Empresa não possui funcionários ativos.');
    const due=money(employees.reduce((sum,e)=>sum+e.salary*count,0));assert(b.treasury>=due,'INSUFFICIENT_BUSINESS_FUNDS','Caixa da empresa insuficiente para folha salarial.',{required:due,treasury:b.treasury});
    mutateTreasury(b.id,target=>{target.treasury=money(target.treasury-due);target.stats=target.stats||{};target.stats.payrollPaid=money(finite(target.stats.payrollPaid,0)+due)});
    const at=now(),items=[];for(const e of employees){const amount=money(e.salary*count);market.setBalance(e.employeeUid,money(market.getBalance(e.employeeUid)+amount));e.lastPayrollAt=at;e.nextPayrollAt+=count*policy.payrollPeriodMs;e.totalPaid=money(e.totalPaid+amount);e.payrollCount+=count;e.missedPayrolls=0;e.updatedAt=at;items.push({employmentId:e.id,employeeUid:e.employeeUid,amount})}
    const p={id:nextId('payroll'),businessId:b.id,periods:count,total:due,items,paidAt:at};payrolls.push(p);return clone(p)
  }

  function auditPayroll(businessId){const t=now(),result=[];for(const e of activeEmployees(text(businessId,100))){const overdue=t>e.nextPayrollAt;if(overdue){const missed=Math.max(1,Math.floor((t-e.nextPayrollAt)/policy.payrollPeriodMs)+1);e.missedPayrolls=missed;e.updatedAt=t}result.push(clone({...e,overdue,amountDue:overdue?money(e.salary*e.missedPayrolls):0}))}return result}

  function fire({employmentId,ownerUid,paySeverance=true}){
    const e=getEmployment(employmentId);assert(e&&e.status==='active','EMPLOYMENT_NOT_ACTIVE','Vínculo de emprego não está ativo.');const b=requireOwner(e.businessId,ownerUid);let severance=0;if(paySeverance){severance=money(e.salary*policy.severancePeriods);assert(b.treasury>=severance,'INSUFFICIENT_BUSINESS_FUNDS','Caixa insuficiente para rescisão.',{required:severance,treasury:b.treasury});mutateTreasury(b.id,target=>{target.treasury=money(target.treasury-severance);target.stats=target.stats||{};target.stats.severancePaid=money(finite(target.stats.severancePaid,0)+severance)});market.setBalance(e.employeeUid,money(market.getBalance(e.employeeUid)+severance))}e.status='terminated';e.terminationReason='fired';e.terminatedAt=now();e.updatedAt=e.terminatedAt;e.severancePaid=severance;return clone(e)
  }

  function resign({employmentId,employeeUid}){const e=getEmployment(employmentId);assert(e&&e.status==='active','EMPLOYMENT_NOT_ACTIVE','Vínculo de emprego não está ativo.');assert(e.employeeUid===text(employeeUid,100),'NOT_EMPLOYEE','Somente o funcionário pode pedir demissão.');e.status='terminated';e.terminationReason='resigned';e.terminatedAt=now();e.updatedAt=e.terminatedAt;return clone(e)}

  function listOpenings({businessId}={}){expireApplications();const id=text(businessId,100);return[...openings.values()].filter(o=>o.status==='open'&&(!id||o.businessId===id)).map(clone)}
  function listApplications(openingId){expireApplications();return[...applications.values()].filter(a=>a.openingId===text(openingId,100)).map(clone)}
  function listEmployees(businessId){return[...employments.values()].filter(e=>e.businessId===text(businessId,100)&&e.status==='active').map(clone)}
  function getPlayerEmployment(playerUid){const e=playerActiveEmployment(playerUid);return e?clone(e):null}
  function snapshot(){return clone({version:1,openings:[...openings.values()],applications:[...applications.values()],employments:[...employments.values()],payrolls})}
  function hydrate(data){assert(data?.version===1,'UNSUPPORTED_EMPLOYMENT_SNAPSHOT','Snapshot de empregos incompatível.');openings.clear();applications.clear();employments.clear();payrolls.length=0;for(const x of data.openings||[])openings.set(x.id,clone(x));for(const x of data.applications||[])applications.set(x.id,clone(x));for(const x of data.employments||[])employments.set(x.id,clone(x));for(const x of data.payrolls||[])payrolls.push(clone(x));expireApplications();return snapshot()}

  return{createOpening,closeOpening,apply,reject,withdraw,hire,processPayroll,auditPayroll,fire,resign,listOpenings,listApplications,listEmployees,getPlayerEmployment,snapshot,hydrate};
}

export const BUSINESS_EMPLOYMENT_POLICY=POLICY;
