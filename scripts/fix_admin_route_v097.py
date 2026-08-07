from pathlib import Path
import json
p=Path('cloud/connector-server.mjs')
s=p.read_text(encoding='utf-8')
old="if(pathname==='/'||pathname==='/admin')return serveFile(res,path.join(ROOT,'painel.html'));if(pathname==='/jogo')return serveFile(res,path.join(ROOT,'index.html'));"
new="if(pathname==='/'||pathname==='/admin'||pathname==='/admin-latest'||pathname==='/painel.html')return serveFile(res,path.join(ROOT,'painel.html'));if(pathname==='/jogo')return serveFile(res,path.join(ROOT,'index.html'));"
if old not in s:
    raise SystemExit('admin route marker missing')
s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
v=Path('version.json')
data=json.loads(v.read_text(encoding='utf-8'))
data.update({
  'version':'0.9.7',
  'label':'v0.9.7',
  'releasedAt':'2026-08-07T19:22:00-03:00',
  'build':'admin-route-hard-refresh',
  'notes':['Admin /admin e /admin-latest servem o painel.html atual','Rota /painel.html alinhada ao mesmo Admin','Mantém Teste de Habilidades nativo']
})
v.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('admin route v0.9.7 patched')
