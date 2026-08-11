from PIL import Image,ImageDraw
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
import io,re

def numeric_key(p):
    m=re.search(r'(\d+)',p.stem)
    return int(m.group(1)) if m else 9999

def make_sheet(files,out):
    files=sorted(files,key=numeric_key)
    thumbs=[]
    for i,p in enumerate(files,1):
        im=Image.open(p).convert('RGBA')
        bg=Image.new('RGBA',(320,360),(245,245,245,255))
        im.thumbnail((280,290),Image.LANCZOS)
        x=(320-im.width)//2;y=20+(290-im.height)//2
        bg.alpha_composite(im,(x,y))
        d=ImageDraw.Draw(bg);d.rectangle((0,0,319,359),outline=(40,40,40,255),width=2);d.text((10,325),p.name,fill=(0,0,0,255))
        thumbs.append(bg.convert('RGB'))
    c=canvas.Canvas(str(out),pagesize=A4);W,H=A4;cols=4;rows=4;cw=W/cols;ch=H/rows
    for start in range(0,len(thumbs),16):
        for j in range(16):
            idx=start+j
            if idx>=len(thumbs):break
            col=j%cols;row=j//cols
            buf=io.BytesIO();thumbs[idx].save(buf,format='JPEG',quality=90);buf.seek(0)
            c.drawImage(ImageReader(buf),col*cw,H-(row+1)*ch,cw,ch,preserveAspectRatio=True,anchor='c')
        c.showPage()
    c.save()

Path('debug').mkdir(exist_ok=True)
armed=[p for p in Path('assets/player-armed').glob('*.png')]
weap=[p for p in Path('assets/weapons').glob('frame_*.png')]
make_sheet(armed,Path('debug/player-armed-contact.pdf'))
make_sheet(weap,Path('debug/weapons-contact.pdf'))
print('armed',len(armed),'weapons',len(weap))
