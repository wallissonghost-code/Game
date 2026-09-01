(()=>{'use strict';
function createSoloSkillLevels(){return{speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0,ghost:0,dodge:0,ice:0,shock:0,berserker:0,explosive:0,guardian:0}}
function createDuoSkillLevels(){return{speed:0,medic:0,rapid:0,xp:0,flash:0,regen:0,blood:0,arc:0,phoenix:0,armor:0,pierce:0,guardian:0}}
function createPlayer(){return{x:0,y:0,r:18,speed:255,life:100,maxLife:100,inv:0,moving:false,walk:0,aim:0,shotFlash:0,fireRate:.28,xpMult:1,regen:0,flashDamage:0,bloodChance:0,bloodHeal:0,damage:2,armorReduction:0,down:false,downKiller:null}}
function createDuoPlayer(){return{x:84,y:0,r:18,speed:255,life:100,maxLife:100,moving:false,walk:0,aim:0,shotFlash:0,connected:false,down:false,fireRate:.28,xpMult:1,regen:0,armorReduction:0,damage:2,bloodChance:0,bloodHeal:0,flashDamage:0,arcLv:0,pierceLv:0,phoenixReady:false,phoenixConsumed:false,invUntil:0,lastDamageAt:0,downKiller:null}}
function createDuoInput(){return{dx:0,dy:0}}
function assertStateShape(){const p=createPlayer(),d=createDuoPlayer(),s=createSoloSkillLevels();if(p.life!==100||d.connected!==false||!Object.prototype.hasOwnProperty.call(s,'guardian'))throw Error('CAOS runtime state shape invalid');return true}
const api={createSoloSkillLevels,createDuoSkillLevels,createPlayer,createDuoPlayer,createDuoInput,assertStateShape};
assertStateShape();
window.CaosRuntimeState=Object.freeze(api);
})();
