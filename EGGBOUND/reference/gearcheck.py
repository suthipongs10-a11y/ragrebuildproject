import json,sys
from PIL import Image, ImageDraw, ImageChops
D='/tmp/claude-0/-home-claude/82385624-96c4-5b1d-a843-666da362f256/scratchpad/b1/'
A=json.load(open('/home/claude/eggbound/tools/anchors.json'))
G=json.load(open('/home/claude/eggbound/tools/gearcfg.json'))
def crop(n):
  im=Image.open(D+n+'.png').convert('RGBA'); return im.crop(im.getchannel('A').getbbox())
keys=sys.argv[2].split(',') if len(sys.argv)>2 else list(A)
S=480; cols=min(5,len(keys)); rows=(len(keys)+cols-1)//cols
sheet=Image.new('RGB',(S*cols,S*rows),(60,70,60))
for i,k in enumerate(keys):
  a=A[k]; base=Image.open(D+'mon001_'+k+'.png').convert('RGBA')
  view='front' if k.startswith('front') else 'back'
  col=crop('gear_collar01_'+view); s=G['collar_s']*a.get('neck_s',1); col=col.resize((int(col.width*s),int(col.height*s)))
  m=Image.new('L',col.size,0); ImageDraw.Draw(m).rectangle([0,int(col.height*0.40),col.width,col.height],fill=255)
  col.putalpha(ImageChops.multiply(col.getchannel('A'),m))
  col=col.rotate(-a.get('neck_r',0),expand=True,resample=Image.BICUBIC)
  base.alpha_composite(col,(int(a['neck'][0]-col.width/2),int(a['neck'][1]-col.height/2)))
  hat=crop('gear_hat01_'+view); s=G['hat_s']*a.get('hat_s',1); hat=hat.resize((int(hat.width*s),int(hat.height*s)))
  if a.get('hat_flip'): hat=hat.transpose(Image.FLIP_LEFT_RIGHT)
  hat=hat.rotate(-a['hat'][2],expand=True,resample=Image.BICUBIC)
  base.alpha_composite(hat,(int(a['hat'][0]-hat.width/2),int(a['hat'][1]-hat.height/2)))
  bb=(100,60,940,940); base=base.crop(bb)
  bg=Image.new('RGBA',base.size,(60,70,60,255)); bg.alpha_composite(base)
  im=bg.convert('RGB').resize((S,S)); ImageDraw.Draw(im).text((6,6),k,fill=(255,255,0))
  sheet.paste(im,((i%cols)*S,(i//cols)*S))
sheet.save(sys.argv[1],quality=88)
