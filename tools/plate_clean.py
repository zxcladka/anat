import cv2,numpy as np,glob,os,sys
import pathlib
A=str(pathlib.Path(__file__).resolve().parent.parent/'atlas')+'/'
files=sorted(glob.glob(A+'*.jpg'))
def clean(f):
    im=cv2.imread(f); g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY); h,w=g.shape; sc=min(h,w)
    dark=(g<242).astype(np.uint8)
    k=max(7,int(sc*0.006)|1)
    def fillholes(m):
        ff=m.copy(); ffm=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,ffm,(0,0),1); return m|(1-ff)
    kc=max(5,int(sc*0.004)|1)
    closed=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(kc,kc)))
    solid=fillholes(closed)
    core=cv2.morphologyEx(solid,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(k,k)))
    n,lab,st,_=cv2.connectedComponentsWithStats(core,8)
    keep=np.zeros_like(core); big=np.zeros_like(core)
    for i in range(1,n):
        if st[i][4]>0.001*h*w: big[lab==i]=1
    dist=cv2.distanceTransform(1-big,cv2.DIST_L2,5) if big.any() else np.zeros_like(core,np.float32)
    for i in range(1,n):
        a=st[i][4]
        if a<=0.0004*h*w: continue
        if a<0.003*h*w:
            ys,xs=np.where(lab==i)
            if dist[ys,xs].min()>0.03*sc: continue   # маленький і далеко від кістки: цифра/знак
        keep[lab==i]=1
    # fill holes
    filled=fillholes(keep)
    r=max(3,int(sc*0.003))
    mask=cv2.dilate(filled,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1)))
    out=im.copy(); out[mask==0]=(255,255,255)
    # feather: blend at mask edge to avoid hard cut on faint shading
    changed=int(((mask==0)&(dark==1)).sum())
    return out,changed
for f in files:
    out,ch=clean(f); name=os.path.basename(f)
    os.makedirs('pclean',exist_ok=True); cv2.imwrite('pclean/'+name,out,[cv2.IMWRITE_JPEG_QUALITY,92]); print(name,ch)
