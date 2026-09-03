import json,os,names,hand_sets,limb_sets
coords=json.load(open('coords.json')); credits=json.load(open('credits.json'))
CATS=['Скелет','Хребет','Верхня кінцівка','Нижня кінцівка','Серце і судини','Нервова система','Органи чуття','Дихальна система','Травна система','Сечова система']
sets=[]
for slug,(title,cat,file,items) in names.SETS.items():
    c=coords[slug]; bym={}
    for n,x,y in c['pts']: bym.setdefault(n,[]).append([x,y])
    its=[{'n':n,'la':la,'uk':uk,'pts':bym[n]} for n,la,uk in items if n in bym]
    cr=credits[file]
    sets.append({'id':slug,'title':title,'cat':cat,'file':'atlas/'+slug+'.svg','w':c['w'],'h':c['h'],'items':its,'credit':{'artist':cr['artist'],'license':cr['license'],'licurl':cr['licurl'],'source':'https://commons.wikimedia.org/wiki/File:'+file.replace(' ','_')}})
vert=json.load(open('vert_sets.json')); dims=json.load(open('dl/vert_dims.json'))
for v in vert:
    w,h=dims[v['id']]; scale=min(1,1600/w); v['w']=round(w*scale); v['h']=round(h*scale); v['cat']='Хребет'; v.pop('plate',None); sets.append(v)
sets+=hand_sets.build(json.load(open('dl/hand_dims.json')))
_d=json.load(open('dl/limb_dims.json'))
for _f in ['dl/th_dims.json','dl/th_dims2.json']:
    if os.path.exists(_f): _d.update(json.load(open(_f)))
sets+=limb_sets.build(_d)
import os
extra='extra_sets.json'
if os.path.exists(extra): sets+=json.load(open(extra))
js='// Згенеровано автоматично. Схеми: Wikimedia Commons (див. credit у кожному наборі).\nwindow.ATLAS='+json.dumps({'categories':CATS,'sets':sets},ensure_ascii=False,separators=(',',':'))+';\n'
open('/Users/zxc/PycharmProjects/anat/atlas/data.js','w').write(js)
print('sets',len(sets),'items',sum(len(s['items']) for s in sets),'size',len(js)//1024,'KB')
