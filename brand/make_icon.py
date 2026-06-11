#!/usr/bin/env python3
"""
MarketOne app-icon generator  (FINAL — "Growth Pulse")

Concept: a bold upward signal pulse climbing over a faint analytics chart and
ending in a clean arrowhead = conversion signal recovered, ROAS rising. A glossy
cyan node anchors the signal's origin. Brand mesh-gradient, glow, bevel, glass rim.

One supersampled master -> LANCZOS downscale to every size.
Outputs (next to this script):
  marketone-icon-1024.png  (Salla Partner Portal upload)
  marketone-icon-512.png / -192.png
  marketone-favicon.ico    (16/32/48/64)
"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
BASE, SS = 1024, 8          # 8192px master -> crisp 4096 HD export (2x supersample)
S = BASE * SS

MAGENTA=(224,28,122); ROSE=(190,24,120); VIOLET=(118,44,240)
BLUE=(20,96,255); CYAN_HI=(150,242,255); CYAN=(13,202,240); CYAN_LO=(7,150,205)
WHITE=(255,255,255); LIGHTBLU=(225,238,255)

# ---- low-level helpers ---------------------------------------------------
def coords(n):
    xs=np.arange(n,dtype=np.float32); return np.meshgrid(xs,xs)
def bloom(n,fx,fy,fr,c,strength,power=1.8):
    gx,gy=coords(n); d=np.sqrt((gx-fx*n)**2+(gy-fy*n)**2)/(fr*n)
    a=np.clip(1-d,0,1)**power*strength
    L=np.zeros((n,n,4),np.float32); L[...,0]=c[0];L[...,1]=c[1];L[...,2]=c[2];L[...,3]=a*255
    return L
def over(rgb,L):
    a=L[...,3:4]/255.0; return rgb*(1-a)+L[...,:3]*a
def base_grad(n):
    gx,gy=coords(n); t=(gx+gy)/(2.0*n)
    stops=[(0.0,MAGENTA),(0.45,VIOLET),(1.0,BLUE)]; out=np.zeros((n,n,3),np.float32)
    for (t0,c0),(t1,c1) in zip(stops[:-1],stops[1:]):
        m=(t>=t0)&(t<=t1); f=np.clip((t-t0)/(t1-t0),0,1)
        for ch in range(3): out[...,ch]=np.where(m,c0[ch]+(c1[ch]-c0[ch])*f,out[...,ch])
    return out
def P(x,y): return (x*SS,y*SS)
def _shift(a,dx,dy):
    out=np.zeros_like(a); h,w=a.shape
    xs0,xs1=max(0,dx),min(w,w+dx); ys0,ys1=max(0,dy),min(h,h+dy)
    sx,sy=max(0,-dx),max(0,-dy); out[ys0:ys1,xs0:xs1]=a[sy:sy+(ys1-ys0),sx:sx+(xs1-xs0)]; return out

# ---- shared scene pieces -------------------------------------------------
def prepare_bg():
    rgb=base_grad(S)
    rgb=over(rgb,bloom(S,0.14,0.10,0.70,MAGENTA,0.55))
    rgb=over(rgb,bloom(S,0.92,0.95,0.75,BLUE,0.55))
    rgb=over(rgb,bloom(S,0.85,0.18,0.45,ROSE,0.28))
    rgb=over(rgb,bloom(S,0.50,0.55,0.55,VIOLET,0.22))
    rgb=over(rgb,bloom(S,0.32,0.02,0.95,WHITE,0.26,power=2.2))
    vg=bloom(S,1.04,1.04,0.85,(0,0,0),0.38,power=2.2); a=vg[...,3:4]/255.0; rgb=rgb*(1-a)
    bg=Image.fromarray(np.clip(rgb,0,255).astype(np.uint8),"RGB").convert("RGBA")
    star=Image.new("RGBA",(S,S),(0,0,0,0)); sd=ImageDraw.Draw(star)
    for fx,fy,rr,al,col in [(0.16,0.18,6,55,CYAN),(0.84,0.14,5,42,WHITE),(0.11,0.42,4,32,WHITE),
                            (0.90,0.36,7,58,CYAN),(0.20,0.84,5,40,WHITE),(0.86,0.80,6,50,CYAN),
                            (0.52,0.10,4,36,WHITE),(0.40,0.26,4,28,WHITE)]:
        x,y,r=fx*S,fy*S,rr*SS; sd.ellipse([x-r,y-r,x+r,y+r],fill=(*col,al))
    star=star.filter(ImageFilter.GaussianBlur(1.0*SS))
    return Image.alpha_composite(bg,star)

def finish(bg):
    radius=int(0.225*S)
    sq=Image.new("L",(S,S),0); ImageDraw.Draw(sq).rounded_rectangle([0,0,S-1,S-1],radius=radius,fill=255)
    bg.putalpha(sq)
    inner=Image.new("L",(S,S),0)
    ImageDraw.Draw(inner).rounded_rectangle([0,0,S-1,S-1],radius=radius,outline=255,width=16*SS)
    inner=ImageChops.multiply(inner.filter(ImageFilter.GaussianBlur(13*SS)),sq)
    ish=Image.new("RGBA",(S,S),(0,0,0,0)); ish.putalpha(inner)
    A=np.asarray(ish).astype(np.float32); A[...,0:3]=8; A[...,3]*=0.18
    bg=Image.alpha_composite(bg,Image.fromarray(A.astype(np.uint8)))
    rim=Image.new("RGBA",(S,S),(0,0,0,0))
    ImageDraw.Draw(rim).rounded_rectangle([3*SS,3*SS,S-1-3*SS,S-1-3*SS],radius=radius-3*SS,
                                          outline=(255,255,255,75),width=2*SS)
    rim.putalpha(ImageChops.multiply(rim.getchannel("A"),sq))
    return Image.alpha_composite(bg,rim)

def vfill_circle(cx,cy,r,top,bot):
    arr=np.zeros((S,S,3),np.float32)
    ys=np.clip((np.arange(S)-(cy-r))/(2*r),0,1)
    for ch in range(3): arr[...,ch]=(top[ch]+(bot[ch]-top[ch])*ys)[:,None]
    img=Image.fromarray(np.clip(arr,0,255).astype(np.uint8),"RGB").convert("RGBA")
    m=Image.new("L",(S,S),0); ImageDraw.Draw(m).ellipse([cx-r,cy-r,cx+r,cy+r],fill=255)
    img.putalpha(m); return img

def glossy_orb(bg,cx,cy,r,white_core=True,glow_a=175):
    g=Image.new("RGBA",(S,S),(0,0,0,0)); gr=int(r*1.7)
    ImageDraw.Draw(g).ellipse([cx-gr,cy-gr,cx+gr,cy+gr],fill=(*CYAN,glow_a))
    g=g.filter(ImageFilter.GaussianBlur(int(r*0.5))); bg=Image.alpha_composite(bg,g)
    ring=Image.new("RGBA",(S,S),(0,0,0,0))
    ImageDraw.Draw(ring).ellipse([cx-r,cy-r,cx+r,cy+r],fill=(255,255,255,255)); bg=Image.alpha_composite(bg,ring)
    rb=int(r*0.80); bg=Image.alpha_composite(bg,vfill_circle(cx,cy,rb,CYAN_HI,CYAN_LO))
    sheen=Image.new("RGBA",(S,S),(0,0,0,0)); rs=int(rb*0.66)
    ImageDraw.Draw(sheen).ellipse([cx-rs,cy-rs-int(rb*0.22),cx+rs,cy+rs-int(rb*0.22)],fill=(255,255,255,150))
    sheen=sheen.filter(ImageFilter.GaussianBlur(int(rb*0.16)))
    cm=Image.new("L",(S,S),0); ImageDraw.Draw(cm).ellipse([cx-rb,cy-rb,cx+rb,cy+rb],fill=255)
    sheen.putalpha(ImageChops.multiply(sheen.getchannel("A"),cm)); bg=Image.alpha_composite(bg,sheen)
    spec=Image.new("RGBA",(S,S),(0,0,0,0)); sp=ImageDraw.Draw(spec); sr=int(rb*0.18)
    sp.ellipse([cx-int(rb*0.42)-sr,cy-int(rb*0.46)-sr,cx-int(rb*0.42)+sr,cy-int(rb*0.46)+sr],fill=(255,255,255,235))
    if white_core:
        cr=int(rb*0.30); sp.ellipse([cx-cr,cy-cr,cx+cr,cy+cr],fill=(255,255,255,255))
    spec=spec.filter(ImageFilter.GaussianBlur(1.2*SS)); return Image.alpha_composite(bg,spec)

def soft_white_mark(bg,mask):
    gl=Image.new("RGBA",(S,S),(0,0,0,0)); gl.paste((255,255,255,255),(0,0),mask)
    gl=gl.filter(ImageFilter.GaussianBlur(13*SS)); A=np.asarray(gl).astype(np.float32); A[...,3]*=0.42
    bg=Image.alpha_composite(bg,Image.fromarray(A.astype(np.uint8)))
    fill=np.zeros((S,S,3),np.float32); g=np.clip((np.arange(S)-S*0.22)/(S*0.55),0,1)
    for ch in range(3): fill[...,ch]=(WHITE[ch]+(LIGHTBLU[ch]-WHITE[ch])*g)[:,None]
    fi=Image.fromarray(np.clip(fill,0,255).astype(np.uint8),"RGB").convert("RGBA"); fi.putalpha(mask)
    bg=Image.alpha_composite(bg,fi)
    mnp=np.asarray(mask,np.float32)/255.0; d=int(6*SS)
    he=np.clip(mnp-_shift(mnp,d,d),0,1)
    hi=Image.new("RGBA",(S,S),(0,0,0,0)); hi.paste((255,255,255,255),(0,0),Image.fromarray((he*150).astype(np.uint8)))
    hi=hi.filter(ImageFilter.GaussianBlur(2*SS)); return Image.alpha_composite(bg,hi)

# ---- the Growth Pulse mark ----------------------------------------------
def build():
    bg=prepare_bg()

    # 1. faint ascending glass chart bars (context, behind) ---------------
    bars=Image.new("RGBA",(S,S),(0,0,0,0)); bd=ImageDraw.Draw(bars)
    y_base=752
    for bx,h in [(300,150),(412,250),(524,348),(636,452),(748,556)]:
        x=bx*SS; w=58*SS; y1=y_base*SS; y0=(y_base-h)*SS
        bd.rounded_rectangle([x-w/2,y0,x+w/2,y1],radius=20*SS,fill=(255,255,255,32))
        bd.rounded_rectangle([x-w/2,y0,x+w/2,y0+34*SS],radius=20*SS,fill=(255,255,255,46))  # brighter cap
    bg=Image.alpha_composite(bg,bars)

    # 2. the rising pulse line (ascending with one dip = recovered signal)-
    pulse=[P(238,648),P(372,548),P(470,596),P(602,408),P(690,318)]  # shaft corners
    tip=P(806,206)                                                   # arrow tip
    base_pt=pulse[-1]
    dx,dy=tip[0]-base_pt[0],tip[1]-base_pt[1]; L=math.hypot(dx,dy); ux,uy=dx/L,dy/L
    px,py=-uy,ux                                                     # perpendicular
    head_len=120*SS; hw=86*SS
    shaft_end=(tip[0]-ux*head_len*0.62, tip[1]-uy*head_len*0.62)
    bcen=(tip[0]-ux*head_len, tip[1]-uy*head_len)
    head=[tip,(bcen[0]+px*hw,bcen[1]+py*hw),(bcen[0]-px*hw,bcen[1]-py*hw)]

    stroke=62*SS; nr=stroke/2
    m=Image.new("L",(S,S),0); d=ImageDraw.Draw(m)
    line_pts=pulse+[shaft_end]
    for a,b in zip(line_pts[:-1],line_pts[1:]): d.line([a,b],fill=255,width=int(stroke))
    for (x,y) in line_pts: d.ellipse([x-nr,y-nr,x+nr,y+nr],fill=255)
    d.polygon(head,fill=255)

    # drop shadow
    sh=Image.new("RGBA",(S,S),(0,0,0,0))
    sm=Image.fromarray((_shift(np.asarray(m,np.float32)/255.0,0,18*SS)*150).astype(np.uint8))
    sh.paste((8,12,30,255),(0,0),sm); sh=sh.filter(ImageFilter.GaussianBlur(17*SS)); bg=Image.alpha_composite(bg,sh)

    bg=soft_white_mark(bg,m)

    # 3. glossy cyan signal node at the pulse origin ----------------------
    cx,cy=pulse[0]
    bg=glossy_orb(bg,cx,cy,52*SS,white_core=True)

    return bg  # full-square opaque scene (corners filled by gradient)

def finish_square(scene):
    """Full-bleed square, opaque, no rounded corners — for marketplace upload
    (Salla renders the image inside its own rounded card)."""
    bg=scene.copy()
    # thin inset bright rim for a crisp edge
    rim=Image.new("RGBA",(S,S),(0,0,0,0))
    ImageDraw.Draw(rim).rectangle([2*SS,2*SS,S-1-2*SS,S-1-2*SS],outline=(255,255,255,55),width=2*SS)
    bg=Image.alpha_composite(bg,rim)
    return bg.convert("RGB")  # flatten -> no alpha/transparency

def flatten_white_to_bg(img):
    return img

def main():
    scene=build()
    rounded=finish(scene)      # transparent rounded corners — web favicon / logos
    square=finish_square(scene)  # opaque full square — Salla / app marketplaces

    def save(img,sz,name):
        img.resize((sz,sz),Image.LANCZOS).save(os.path.join(HERE,name),optimize=True)
        print("wrote",name,f"({sz}x{sz})")

    # --- square set (Salla Partner Portal / app marketplaces) — HD first ---
    save(square,4096,"marketone-salla-4096.png")   # MAX HD upload
    save(square,2048,"marketone-salla-2048.png")
    save(square,1024,"marketone-salla-1024.png")
    save(square,512,"marketone-salla-512.png")

    # --- rounded set (web app icon / favicon / PWA) ---
    save(rounded,4096,"marketone-icon-4096.png")   # HD rounded master
    save(rounded,1024,"marketone-icon-1024.png")
    save(rounded,512,"marketone-icon-512.png")
    save(rounded,192,"marketone-icon-192.png")
    rounded.resize((256,256),Image.LANCZOS).save(os.path.join(HERE,"marketone-favicon.ico"),
                                                 sizes=[(16,16),(32,32),(48,48),(64,64)])
    print("wrote marketone-favicon.ico [16,32,48,64]")

if __name__=="__main__":
    main()
