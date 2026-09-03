import subprocess,json,sys,re,os,struct
def dims(path):
    with open(path,'rb') as f: f.seek(16); w,h=struct.unpack('>II',f.read(8))
    return w,h
def ocr_plate(path):
    out=subprocess.run(['tesseract',path,'-','--psm','11','tsv'],capture_output=True,text=True).stdout
    words=[]
    for r in out.strip().split('\n')[1:]:
        r=r.split('\t')
        if len(r)<12: continue
        level,page,block,par,line,wn,l,t,w,h,conf,text=r
        text=text.strip()
        try: conf=float(conf)
        except: continue
        if not text or conf<60 or not re.search(r'[A-Za-z]{2,}',text): continue
        words.append({'k':(int(block),int(par),int(line)),'x':int(l),'y':int(t),'w':int(w),'h':int(h),'t':text})
    groups={}
    for w in words: groups.setdefault(w['k'],[]).append(w)
    L=[]
    for k,ws in groups.items():
        ws.sort(key=lambda w:w['x'])
        cur=[ws[0]]
        for w in ws[1:]:
            prev=cur[-1]; h=max(prev['h'],w['h'],12)
            if w['x']-(prev['x']+prev['w'])>1.1*h: L.append(cur); cur=[w]
            else: cur.append(w)
        L.append(cur)
    lines=[]
    for ws in L:
        txt=' '.join(w['t'] for w in ws)
        letters=re.sub(r'[^A-Za-z]','',txt)
        if len(letters)<3 or not re.search(r'[aeiouyAEIOUY]',letters): continue
        x0=min(w['x'] for w in ws); y0=min(w['y'] for w in ws); x1=max(w['x']+w['w'] for w in ws); y1=max(w['y']+w['h'] for w in ws)
        lines.append({'x0':x0,'y0':y0,'x1':x1,'y1':y1,'t':txt,'h':y1-y0})
    lines.sort(key=lambda l:l['y0'])
    blocks=[]
    for l in lines:
        cont=bool(re.match(r'[a-z\-(]',l['t'])) or l['t'].startswith('of ')
        attached=False
        if cont:
            # attach to the nearest block above with horizontal overlap and small vertical gap
            best=None
            for B in blocks:
                ho=min(B['x1'],l['x1'])-max(B['x0'],l['x0'])
                vg=l['y0']-B['y1']
                h=max(l['h'],B['h'])
                if ho>0 and -0.2*h<=vg<=0.9*h:
                    if best is None or vg<best[0]: best=(vg,B)
            if best:
                B=best[1]; B['lines'].append(l); B['x0']=min(B['x0'],l['x0']); B['x1']=max(B['x1'],l['x1']); B['y0']=min(B['y0'],l['y0']); B['y1']=max(B['y1'],l['y1']); attached=True
        if not attached: blocks.append({'lines':[l],'x0':l['x0'],'x1':l['x1'],'y0':l['y0'],'y1':l['y1'],'h':l['h']})
    return lines,blocks
def clean(t):
    t=re.sub(r'\s*-\s+','',t)  # join hyphenated continuation "tubero- sity"
    t=re.sub(r'[^\w\s()\'-]','',t); t=re.sub(r'\s+',' ',t).strip()
    return t
if __name__=='__main__':
    for path in sys.argv[1:]:
        W,H=dims(path); lines,blocks=ocr_plate(path)
        res={'file':os.path.basename(path),'W':W,'H':H,
             'lines':[[round(l['x0']/W*100,2),round(l['y0']/H*100,2),round(l['x1']/W*100,2),round(l['y1']/H*100,2)] for l in lines],
             'blocks':[{'t':clean(' '.join(x['t'] for x in b['lines'])),'x':round((b['x0']+b['x1'])/2/W*100,2),'y':round((b['y0']+b['y1'])/2/H*100,2),'n':len(b['lines'])} for b in blocks]}
        n=re.search(r'(\d+)\.png$',path).group(1)
        json.dump(res,open('ocr/'+n+'.json','w'),ensure_ascii=False)
        print(n, '|', ' ; '.join(b['t'] for b in res['blocks']))
