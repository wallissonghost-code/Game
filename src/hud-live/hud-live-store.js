(()=>{
  'use strict';
  const CONFIG_KEY='caos-hud-live-lab-v2';
  const CATALOG_KEYS=['caos-gift-catalog-v2','caos-gift-catalog','gift_catalog_verified'];

  const fallback=[
    {name:'GG',id:'6064',image:'',effect:'1 BOSS'},
    {name:'Rose',id:'5655',image:'',effect:'SPAWN 1 MOB'},
    {name:'White Rose',id:'8239',image:'',effect:'CURA O JOGADOR'},
    {name:'Dinosaur',id:'',image:'',effect:'+1 LEVEL'}
  ];

  const first=(obj,keys)=>{for(const k of keys){const v=obj?.[k];if(v!==undefined&&v!==null&&v!=='')return v}return ''};
  const normalize=x=>({
    name:String(first(x,['name','giftName','title','displayName'])||'Presente'),
    id:String(first(x,['id','giftId','gift_id'])||''),
    image:String(first(x,['image','imageUrl','picture','icon','iconUrl','giftPicture','pictureUrl','previewUrl','url'])||''),
    value:Number(first(x,['value','diamondCount','diamonds','diamond_count'])||1),
    liveVerified:Boolean(first(x,['liveVerified','verified','isVerified'])),
    effect:String(first(x,['effect','hudEffect'])||'')
  });

  function readArray(raw){
    if(Array.isArray(raw))return raw;
    for(const key of ['items','gifts','catalog','data','verified'])if(Array.isArray(raw?.[key]))return raw[key];
    return [];
  }

  function catalog(){
    const merged=[];
    for(const key of CATALOG_KEYS){
      try{
        const parsed=JSON.parse(localStorage.getItem(key)||'null');
        for(const item of readArray(parsed)){
          const g=normalize(item);
          const sig=(g.id?`id:${g.id}`:`name:${g.name.toLowerCase()}`);
          const at=merged.findIndex(x=>x._sig===sig);
          if(at<0)merged.push({...g,_sig:sig});
          else merged[at]={...merged[at],...g,image:g.image||merged[at].image,liveVerified:g.liveVerified||merged[at].liveVerified};
        }
      }catch{}
    }
    return merged.map(({_sig,...g})=>g);
  }

  function findGift(query){
    const q=String(query||'').trim().toLowerCase();
    if(!q)return null;
    const all=[...catalog(),...fallback.map(normalize)];
    return all.find(g=>g.id&&g.id.toLowerCase()===q)
      ||all.find(g=>g.name.toLowerCase()===q)
      ||all.find(g=>g.name.toLowerCase().includes(q))
      ||null;
  }

  function defaults(){
    return fallback.map(f=>{
      const found=findGift(f.id)||findGift(f.name);
      return {...f,...(found||{}),effect:f.effect};
    });
  }

  function load(){
    try{
      const x=JSON.parse(localStorage.getItem(CONFIG_KEY)||'null');
      if(Array.isArray(x)&&x.length)return x.slice(0,6).map(normalize).map((g,i)=>({...g,effect:String(x[i]?.effect||g.effect||'EFEITO')}));
    }catch{}
    return defaults();
  }

  function save(items){
    const clean=(Array.isArray(items)?items:[]).slice(0,6).map(normalize).map((g,i)=>({...g,effect:String(items[i]?.effect||g.effect||'EFEITO')}));
    localStorage.setItem(CONFIG_KEY,JSON.stringify(clean));
    return clean;
  }

  function reset(){localStorage.removeItem(CONFIG_KEY);return defaults()}

  window.CaosHudLiveStore={CONFIG_KEY,catalog,findGift,defaults,load,save,reset,normalize};
})();