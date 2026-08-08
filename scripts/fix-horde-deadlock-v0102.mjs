import fs from 'node:fs';

const file='cloud/connector-server.mjs';
let s=fs.readFileSync(file,'utf8');

const old="rep(\"if(hordeEnabled){spawnTimer-=dt;if(spawnTimer<=0){spawnWave();spawnTimer=Math.max(.11,.52-level*.012)}}else{spawnTimer=.1}\",\"if(hordeEnabled){if(performance.now()>=hordeWaitUntil&&hordeSpawned<hordeTarget){spawnTimer-=dt;if(spawnTimer<=0){if(enemies.length<MAX_ENEMIES){spawnHordeEnemy();hordeSpawned++}spawnTimer=.12}}}else{spawnTimer=.1}\");";
const neu="rep(\"if(hordeEnabled){spawnTimer-=dt;if(spawnTimer<=0){spawnWave();spawnTimer=Math.max(.11,.52-level*.012)}}else{spawnTimer=.1}\",\"if(hordeEnabled){const baseAlive=enemies.filter(e=>e.source==='horde'&&!e.dead).length;if(hordeSpawned>=hordeTarget&&baseAlive===0&&performance.now()>=hordeWaitUntil){hordeNumber++;hordeTarget=hordeSize(hordeNumber);hordeKilled=0;hordeSpawned=0;hordeWaitUntil=performance.now()+1800;spawnTimer=.1;toast('🌊 HORDA '+hordeNumber+' EM 2s')}if(performance.now()>=hordeWaitUntil&&hordeSpawned<hordeTarget){spawnTimer-=dt;if(spawnTimer<=0){if(enemies.length<MAX_ENEMIES){spawnHordeEnemy();hordeSpawned++}spawnTimer=.12}}}else{spawnTimer=.1}\");";

if(!s.includes(old)){
  console.error('target horde patch not found');
  process.exit(1);
}

s=s.replace(old,neu);
fs.writeFileSync(file,s);
console.log('horde deadlock watchdog applied');
