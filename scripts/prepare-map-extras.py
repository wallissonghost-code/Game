from pathlib import Path
from PIL import Image

ROOT=Path('assets/Map')
SRC=ROOT/'extras-uploaded'
OUT=ROOT/'wasteland'

REFS={
'rocks_scatter_01':('fffffffffcfff4cffc0fe0098107dc07c887c94fc711821dc03fe19ff4cffcffffff','decals',300),
'dry_grass_patch_01':('fffffff7f047f043e003c003c001c0018001c001c001c007e007f01ffe3fffff','decals',300),
'cracked_earth_patch_01':('ffffffe3ff03ff03e007f003e00380038001e001f003d083f1c3f1f1fffdffff','decals',300),
'oil_stain_01':('ffffffc3ff81ff00ff007e007e007e003e007e007f007f007f81ff81ffe7fffff','decals',300),
'rock_cluster_01':('ffffe1f7c083c003c003c003c001c0018001800180038003c003c003f8ffffff','obstacles',420),
'dead_tree_01':('ffffffff89ffede1f1f7d0f7c467fc0ffc0ff801fe09fc03fc07ff1fff9fffdf','obstacles',420),
'barricade_01':('ffffbffd9ff183f9c1e981c180018001c001c001c001c2c1cbf19ffd9fffffff','obstacles',420),
'wrecked_car_01':('ffffffffd01b8003848180018000800080008001800180018001c003ffffffff','obstacles',420),
'ground_01':('000f2196214c1e3f19bdbb9087981f986dfe0fe60fc4058050f093f3021fa70b','ground',512),
}

def ahash(im,size=16):
    im=im.convert('RGBA')
    bg=Image.new('RGBA',im.size,'white')
    bg.alpha_composite(im)
    g=bg.convert('L').resize((size,size),Image.Resampling.LANCZOS)
    vals=list(g.getdata())
    avg=sum(vals)/len(vals)
    bits=''.join('1' if v>=avg else '0' for v in vals)
    return hex(int(bits,2))[2:].zfill(size*size//4)

def hd(a,b):
    return (int(a,16)^int(b,16)).bit_count()

def crop_alpha(im):
    if 'A' not in im.getbands():
        return im.convert('RGBA')
    rgba=im.convert('RGBA')
    a=rgba.getchannel('A').point(lambda p:255 if p>8 else 0)
    box=a.getbbox()
    return rgba.crop(box) if box else rgba

def optimize(src,dst,maxdim,crop=True):
    im=Image.open(src)
    if crop:
        im=crop_alpha(im)
    else:
        im=im.convert('RGBA')
    scale=min(1.0,maxdim/max(im.size))
    if scale<1:
        im=im.resize((max(1,round(im.width*scale)),max(1,round(im.height*scale))),Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True,exist_ok=True)
    im.save(dst,optimize=True,compress_level=9)
    return im.size,dst.stat().st_size

files=sorted(SRC.glob('*.png'))
if len(files)<9:
    raise SystemExit(f'Esperava 9 PNGs extras, encontrei {len(files)}')

file_hash={p:ahash(Image.open(p)) for p in files}
pairs=[]
for p,h in file_hash.items():
    for name,(rh,cat,maxdim) in REFS.items():
        pairs.append((hd(h,rh),p,name,cat,maxdim))
pairs.sort(key=lambda x:x[0])
used_files=set(); used_names=set(); chosen=[]
for dist,p,name,cat,maxdim in pairs:
    if p in used_files or name in used_names:
        continue
    chosen.append((dist,p,name,cat,maxdim))
    used_files.add(p); used_names.add(name)
    if len(chosen)==len(REFS):
        break

if len(chosen)!=len(REFS):
    raise SystemExit('Nao foi possivel mapear todos os extras')

report=['# Mapeamento automatico dos extras','']
for dist,p,name,cat,maxdim in sorted(chosen,key=lambda x:x[2]):
    if dist>85:
        raise SystemExit(f'Imagem {p.name} distante demais de {name}: {dist}')
    dst=OUT/cat/(name+'.png')
    size,bytes_=optimize(p,dst,maxdim,crop=(cat!='ground'))
    report.append(f'{p.name} -> {dst.as_posix()} | distancia={dist} | {size[0]}x{size[1]} | {bytes_} bytes')

(OUT/'mapping-report.txt').write_text('\n'.join(report)+'\n',encoding='utf-8')
print('\n'.join(report))
