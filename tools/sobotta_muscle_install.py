import json,shutil,os,cv2,re
SC='/private/tmp/claude-501/-Users-zxc-PycharmProjects-jarvis/85d4ce99-9c2d-4704-a46b-c3f471931a94/scratchpad/sobo3/'
A='/Users/zxc/PycharmProjects/anat/'
S=json.load(open(SC+'musc_sets.json'))
p=A+'atlas/data.js'; s=open(p).read(); head,body=s.split('window.ATLAS=',1); data=json.loads(body.rstrip().rstrip(';'))
if 'М’язи' not in data['categories']: data['categories'].append('М’язи')
ids={x['id']:x for x in data['sets']}
for name,v in S.items():
    sid=v['id']; im=cv2.imread(SC+f'final/{sid}.jpg'); h,w=im.shape[:2]
    shutil.copy(SC+f'final/{sid}.jpg',A+f'atlas/{sid}.jpg')
    st={'id':sid,'title':v['title'],'cat':v['cat'],'file':f'atlas/{sid}.jpg','w':w,'h':h,
        'items':[{'n':i+1,'la':la,'uk':uk,'pts':[[x,y]]} for i,(la,uk,x,y) in enumerate(v['items'])],
        'credit':{'artist':'Sobotta, Atlas and Text-book of Human Anatomy (American ed., 1909)','license':'Public domain','licurl':'','source':f'https://commons.wikimedia.org/wiki/File:{name}.png'}}
    if sid in ids: ids[sid].update(st)
    else: data['sets'].append(st); ids[sid]=st
open(p,'w').write(head+'window.ATLAS='+json.dumps(data,ensure_ascii=False)+';\n')
# curriculum
p=A+'atlas/curriculum.js'; s=open(p).read(); head,body=s.split('window.CURRICULUM=',1); cur=json.loads(body.rstrip().rstrip(';'))
c1=[c for c in cur['courses'] if c['id']=='c1'][0]
for name,v in S.items():
    for tk in v['topics']:
        mid,n=tk.split(':'); m=[x for x in c1['modules'] if x['id']==mid][0]; t=[x for x in m['topics'] if x['n']==int(n)][0]
        if v['id'] not in t['sets']: t['sets'].append(v['id'])
open(p,'w').write(head+'window.CURRICULUM='+json.dumps(cur,ensure_ascii=False,indent=1)+';\n')
# ліцензії
L=open(A+'ЛІЦЕНЗІЇ.md').read(); rows=[]
for name,v in S.items():
    if f"| {v['id']} |" not in L: rows.append(f"| {v['id']} | {v['title']} | {v['id']}.jpg | Sobotta 1909 | Public domain | [commons](https://commons.wikimedia.org/wiki/File:{name}.png) |")
if rows:
    i=L.index('## CC BY-SA'); L=L[:i].rstrip('\n')+'\n'+'\n'.join(rows)+'\n\n'+L[i:]
open(A+'ЛІЦЕНЗІЇ.md','w').write(L)
print('installed',len(S),'sets; total sets',len(data['sets']),'items',sum(len(x['items']) for x in data['sets']))
