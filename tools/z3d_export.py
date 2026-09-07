import trimesh,numpy as np,json,re,sys,os
def load(f):
    sc=trimesh.load(f,force='scene')
    # шлях кожного вузла
    parent={}
    for e in sc.graph.to_edgelist(): parent[e[1]]=e[0]
    def path(n):
        p=[n]
        while n in parent: n=parent[n]; p.append(n)
        return list(reversed(p))
    return sc,path
def export_group(sc,path,group,out,extra_groups=(),markers_only_from=None):
    """group: назва вузла-групи (напр. 'Atlas (C1)'). Меші (без .j) → GLB; маркери .j → піни."""
    meshes=[]; markers=[]
    for n in sc.graph.nodes_geometry:
        p=path(n)
        if not any(x==group or x in extra_groups for x in p): continue
        T,gname=sc.graph[n]; g=sc.geometry[gname]
        if n.endswith('.j'):
            if markers_only_from and not any(x==markers_only_from for x in p): continue
            c=trimesh.transform_points(g.vertices,T).mean(axis=0); markers.append((n[:-2],c))
        else:
            m=g.copy(); m.apply_transform(T); meshes.append((n,m))
    if not meshes: raise SystemExit('no meshes for '+group)
    allm=trimesh.util.concatenate([m for _,m in meshes])
    c=allm.bounds.mean(axis=0); s=1.0/np.max(allm.extents)      # центр у 0, найбільший розмір = 1
    scene=trimesh.Scene()
    for i,(n,m) in enumerate(meshes):
        m.apply_translation(-c); m.apply_scale(s); m.merge_vertices()
        m.visual=trimesh.visual.ColorVisuals(m,face_colors=[235,228,210,255])
        nm=re.sub(r'_[0-9a-f]{6}$','',n)+f'#{i}'          # унікальні імена: у групі кілька мешів з однаковою назвою
        scene.add_geometry(m,node_name=nm,geom_name=nm)
    pins=[{'name':nm,'p':[round(float(v),4) for v in (pt-c)*s]} for nm,pt in markers]
    scene.export(out); json.dump({'group':group,'pins':pins,'meshes':[n for n,_ in meshes]},open(out[:-4]+'.json','w'),ensure_ascii=False,indent=1)
    return os.path.getsize(out),len(meshes),pins
if __name__=='__main__':
    sc,path=load(sys.argv[1])
    for group in sys.argv[2:]:
        out='glb/'+re.sub(r'[^A-Za-z0-9]+','-',group).strip('-').lower()+'.glb'; os.makedirs('glb',exist_ok=True)
        size,nm,pins=export_group(sc,path,group,out)
        print(group,'->',out,size//1024,'KB','meshes',nm,'pins',len(pins)); print('   ',[p['name'] for p in pins])
