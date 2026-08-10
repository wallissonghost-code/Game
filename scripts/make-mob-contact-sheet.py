from PIL import Image, ImageDraw
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from pathlib import Path
import io
files=[Path(f'assets/player/frame_{i:03d}.png') for i in range(1,33)]
thumbs=[]
for i,p in enumerate(files,1):
    im=Image.open(p).convert('RGBA')
    bg=Image.new('RGBA',(300,340),(245,245,245,255))
    im.thumbnail((260,280),Image.LANCZOS)
    x=(300-im.width)//2;y=20+(280-im.height)//2
    bg.alpha_composite(im,(x,y))
    d=ImageDraw.Draw(bg);d.rectangle((0,0,299,339),outline=(40,40,40,255),width=2);d.text((10,310),f'FRAME {i:03d}',fill=(0,0,0,255))
    thumbs.append(bg.convert('RGB'))
Path('debug').mkdir(exist_ok=True)
c=canvas.Canvas('debug/player-contact-sheet.pdf',pagesize=A4)
W,H=A4;cols=4;rows=4;cellw=W/cols;cellh=H/rows
for start in range(0,32,16):
    for j in range(16):
        idx=start+j
        if idx>=32: break
        col=j%cols;row=j//cols
        buf=io.BytesIO();thumbs[idx].save(buf,format='JPEG',quality=88);buf.seek(0)
        c.drawImage(ImageReader(buf),col*cellw,H-(row+1)*cellh,cellw,cellh,preserveAspectRatio=True,anchor='c')
    c.showPage()
c.save()
