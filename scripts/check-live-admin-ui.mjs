import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root=process.cwd();
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent((req.url||'/').split('?')[0]);if(p==='/'||p==='/admin')p='/painel.html';const f=path.resolve(root,'.'+p);if(!f.startsWith(root)||!fs.existsSync(f)){res.writeHead(404);return res.end('not found')}res.writeHead(200,{'content-type':mime[path.extname(f)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(f).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
  await page.goto(`http://127.0.0.1:${port}/painel.html`,{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{const gifts=Array.from({length:700},(_,i)=>({id:String(5000+i),name:i===123?'Galaxy Test':`Gift ${i}`,diamondCount:(i%50)+1,icon:'',liveVerified:i<30,liveVerifiedCount:2}));localStorage.setItem('caos-gift-catalog-v2',JSON.stringify({capturedAt:Date.now(),gifts}))});
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForSelector('#giftCatalogSearch',{timeout:5000});
  const t0=Date.now();
  await page.locator('#giftCatalogSearch').fill('Galaxy Test');
  await page.waitForTimeout(250);
  const value=await page.locator('#giftCatalogSearch').inputValue();
  const rows=await page.locator('#giftCatalogList .giftCatalogRowV2').count();
  const elapsed=Date.now()-t0;
  if(value!=='Galaxy Test')throw Error(`busca perdeu texto: ${value}`);
  if(rows<1)throw Error('busca não renderizou resultado');
  if(elapsed>1800)throw Error(`busca lenta/travada: ${elapsed}ms`);
  await page.locator('#giftCatalogSearch').fill('');
  await page.waitForTimeout(350);
  const stable=await page.evaluate(()=>new Promise(resolve=>{let n=0;const box=document.querySelector('#giftCatalogList');const mo=new MutationObserver(m=>n+=m.length);if(box)mo.observe(box,{childList:true,subtree:true,characterData:true});setTimeout(()=>{mo.disconnect();resolve(n)},300)}));
  if(stable>25)throw Error(`possível loop de MutationObserver: ${stable} mutações/300ms`);
  if(errors.length)throw Error('pageerror: '+errors.join(' | '));
  console.log(`LIVE ADMIN UI OK · busca ${elapsed}ms · mutações idle ${stable}`);
} finally {await browser.close();server.close()}
