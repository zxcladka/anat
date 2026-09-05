import cv2,numpy as np,sys,os
def fillholes(m):
    h,w=m.shape; ff=m.copy(); ffm=np.zeros((h+2,w+2),np.uint8); cv2.floodFill(ff,ffm,(0,0),1); return m|(1-ff)
def clean(src,dst,W=2000,inpaint_leaders=True,use_mask=True):
    im=cv2.imread(src); h0,w0=im.shape[:2]
    if w0!=W: im=cv2.resize(im,(W,int(h0*W/w0)),interpolation=cv2.INTER_AREA)
    g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY); h,w=g.shape; sc=min(h,w)
    dark=(g<242).astype(np.uint8)
    kc=max(5,int(sc*0.004)|1); k=max(7,int(sc*0.008)|1)
    closed=cv2.morphologyEx(dark,cv2.MORPH_CLOSE,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(kc,kc)))
    solid=fillholes(closed)
    core=cv2.morphologyEx(solid,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(k,k)))
    n,lab,st,_=cv2.connectedComponentsWithStats(core,8)
    keep=np.zeros_like(core)
    for i in range(1,n):
        if st[i][4]>0.003*h*w: keep[lab==i]=1
    filled=fillholes(keep); r=2
    mask=cv2.dilate(filled,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(2*r+1,2*r+1)))
    out=im.copy()
    if use_mask: out[mask==0]=(255,255,255)
    else: mask=np.ones_like(g)
    # виноски всередині рисунка: довгі прямі тонкі темні лінії → inpaint
    if inpaint_leaders:
        bh=cv2.morphologyEx(g,cv2.MORPH_BLACKHAT,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7)))
        thin=((bh>28)&(mask==1)).astype(np.uint8)*255
        lines=cv2.HoughLinesP(thin,1,np.pi/360,threshold=60,minLineLength=int(0.07*w),maxLineGap=int(0.012*w))
        lm=np.zeros_like(g)
        if lines is not None:
            for l in lines.reshape(-1,4): x1,y1,x2,y2=[int(v) for v in l]; cv2.line(lm,(x1,y1),(x2,y2),255,4)
            lm=cv2.bitwise_and(lm,thin.astype(np.uint8)|cv2.dilate(thin,np.ones((3,3),np.uint8)))
            lm=cv2.dilate(lm,np.ones((3,3),np.uint8))
            out=cv2.inpaint(out,lm,3,cv2.INPAINT_TELEA)
        print(os.path.basename(src),'lines',0 if lines is None else len(lines),'inpainted px',int((lm>0).sum()))
    cv2.imwrite(dst,out,[cv2.IMWRITE_JPEG_QUALITY,92]); return out
def grid(im,dst):
    h,w=im.shape[:2]; out=cv2.resize(im,(1600,int(h*1600/w)),interpolation=cv2.INTER_AREA); H,W=out.shape[:2]
    for p in range(0,101,5):
        x=int(W*p/100); y=int(H*p/100); col=(0,0,255) if p%10==0 else (0,160,255)
        cv2.line(out,(x,0),(x,H-1),col,1); cv2.line(out,(0,y),(W-1,y),col,1)
        if p%10==0: cv2.putText(out,str(p),(x+2,14),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,0,255),1,cv2.LINE_AA); cv2.putText(out,str(p),(2,max(12,y-2)),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,0,255),1,cv2.LINE_AA)
    cv2.imwrite(dst,out)
if __name__=='__main__':
    for name in sys.argv[1:]:
        out=clean('sobo2/full/'+name,'sobo2/clean/'+name[:-4]+'.jpg'); grid(out,'sobo2/cgrid/'+name)
