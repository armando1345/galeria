"""Ilustraciones originales procedurales. Sin imágenes remotas ni datos personales."""
from PIL import Image, ImageDraw, ImageFont
import random, math, os
os.makedirs('public/demo',exist_ok=True)
W,H=640,800
def font(size,serif=False):
    return ImageFont.truetype('C:/Windows/Fonts/'+('georgia.ttf' if serif else 'arial.ttf'),size)
def base(seed,color):
    r=random.Random(seed);im=Image.new('RGB',(W,H),color);px=im.load()
    for y in range(H):
        for x in range(W):
            n=r.randrange(-8,9);px[x,y]=tuple(max(0,min(255,c+n)) for c in color)
    return im,r,ImageDraw.Draw(im)
def finish(im,d,n,title,sub):
    d.line((32,37,608,37),fill='#c8d0b5',width=1);d.text((34,50),'UMBRAL / ESTUDIOS DE MOVIMIENTO',font=font(12),fill='#dae0c5');d.text((550,48),n,font=font(17),fill='#dae0c5')
    d.text((35,676),title,font=font(43,True),fill='#eee8d6');d.text((37,737),sub,font=font(11),fill='#c8d0b5');d.text((37,762),'MATERIAL DE DEMOSTRACIÓN  /  2026',font=font(9),fill='#b9c4a9')
    im.save('public/demo/'+n+'.png')
im,r,d=base(23,(29,58,50))
for i in range(180):
    x=r.randrange(25,615);y=r.randrange(100,660);rad=r.choice([1,1,2,3]);d.ellipse((x-rad,y-rad,x+rad,y+rad),fill=r.choice(['#d9df9c','#648a66','#96af7a']))
# Asymmetric high-contrast landmarks: avoid a rotationally ambiguous target.
for cx,cy,size in [(127,186,57),(507,468,64),(160,537,35)]:
    points=[]
    for j in range(11):
        a=j/11*math.tau;rr=size*r.uniform(.56,1.1);points.append((cx+rr*math.cos(a),cy+rr*math.sin(a)))
    d.polygon(points,fill='#d7dbac',outline='#eef0c5',width=2)
    for j in range(1,10):d.line((cx,cy,*points[j]),fill='#294c3d',width=2)
    d.ellipse((cx-9,cy-8,cx+14,cy+13),fill='#bc6748')
d.line([(79,268),(114,319),(78,373),(146,415),(108,466)],fill='#e4e6b7',width=3)
d.text((420,170),'N / 037',font=font(24),fill='#dee2b4')
for i in range(5):d.rectangle((440+i*18,566-i*7,449+i*18,602-i*7),fill='#c4cc9a')
for i in range(28):
    angle=i*.24;rx=180-i*2.4;ry=90+i*.8;cx=320+math.cos(angle)*26;cy=365+math.sin(angle)*30
    pts=[]
    for j in range(140):
        a=j/139*2*math.pi;x=rx*math.cos(a);y=ry*math.sin(a);pts.append((cx+x*math.cos(angle)-y*math.sin(angle),cy+x*math.sin(angle)+y*math.cos(angle)))
    d.line(pts,fill=('#c7df80' if i%3==0 else '#7c9d6b'),width=2)
for x,y,rad in [(307,358,91),(439,229,27),(175,487,16)]:
    for rr in range(rad,0,-1):
        t=rr/rad;c=(int(186+47*(1-t)),int(96+100*(1-t)),int(45+60*(1-t)));d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=c)
    for j in range(1100 if rad>50 else 140):
        a=r.random()*math.tau;rr=math.sqrt(r.random())*rad;xx=x+math.cos(a)*rr;yy=y+math.sin(a)*rr;d.point((xx,yy),fill=r.choice(['#dfc77e','#886246','#a27848']))
d.line((72,614,568,614),fill='#547564');d.text((75,584),'FIG. 01     /     LA MATERIA TAMBIÉN SUEÑA',font=font(11),fill='#a9c68c');finish(im,d,'01','Órbita interior','ESTUDIO 01    ·    FORMA / GRAVEDAD / ORIGEN')
im,r,d=base(86,(110,51,45))
for i in range(150):
    x=r.randrange(30,610);y=r.randrange(100,645);d.line((x,y,x+r.randrange(-12,13),y+r.randrange(2,16)),fill='#996b50',width=1)
for stem in range(9):
    sx=115+stem*51;sy=615;top=r.randrange(160,330);ex=sx+r.randrange(-70,70);d.line((sx,sy,ex,top),fill='#dccd91',width=3)
    for k in range(7):
        t=.14+k*.115;cx=sx+(ex-sx)*t;cy=sy+(top-sy)*t;side=(-1 if k%2 else 1);length=r.randrange(38,88)
        pts=[(cx,cy),(cx+side*length*.4,cy-65),(cx+side*length,cy-42),(cx+side*length*.8,cy-7),(cx,cy)]
        d.polygon(pts,fill=r.choice(['#b7be78','#8f9b61','#e0cf92','#cf9a73']));d.line((cx,cy,cx+side*length*.82,cy-35),fill='#6b5d42',width=1)
        for j in range(4):d.line((cx+side*length*j/6,cy-12*j/3,cx+side*length*(j+1)/6,cy-38),fill='#857b53',width=1)
for j in range(36):
    x=r.randrange(60,580);y=r.randrange(150,610);rad=r.randrange(2,8);d.ellipse((x-rad,y-rad,x+rad,y+rad),fill='#e4a16f')
d.text((75,112),'HERBARIUM / FUTURO',font=font(12),fill='#e5cf9f');finish(im,d,'02','Botánica eléctrica','ESTUDIO 02    ·    NATURALEZA / PULSO / CAMBIO')
im,r,d=base(135,(35,54,77))
for k in range(11):
    bx=55+k*49;by=590-k*27;hh=r.randrange(100,310);ww=40;d.polygon([(bx,by),(bx+ww,by-22),(bx+ww,by-hh-22),(bx,by-hh)],fill=r.choice(['#8b9ea6','#d7b48c','#c5c3a3','#587e88']))
    d.polygon([(bx+ww,by-22),(bx+ww+22,by-9),(bx+ww+22,by-hh-9),(bx+ww,by-hh-22)],fill='#3d6572')
    d.polygon([(bx,by-hh),(bx+ww,by-hh-22),(bx+ww+22,by-hh-9),(bx+22,by-hh+13)],fill='#b8c5b7')
    for yy in range(int(by-hh+24),int(by-15),23):
        for xx in range(bx+7,bx+35,12):d.rectangle((xx,yy,xx+4,yy+8),fill=r.choice(['#e8d399','#294b5c','#658e9a']))
for j in range(9):d.line((45,630-j*13,590,330-j*13),fill='#72969c',width=1)
d.ellipse((75,120,214,259),fill='#e5bc78');d.ellipse((100,112,224,236),fill='#23364d')
for j in range(180):
    x=r.randrange(30,610);y=r.randrange(100,640)
    if im.getpixel((x,y))[0]<60:d.point((x,y),fill='#b5cdd0')
d.text((375,118),'35° / NOCHE ABIERTA',font=font(11),fill='#b4c5bc');finish(im,d,'03','Ciudad latente','ESTUDIO 03    ·    ESPACIO / TIEMPO / MEMORIA')
print('Tres referencias originales listas en public/demo/.')
