import json,trimesh,numpy as np,os,shutil,re
A='/Users/zxc/PycharmProjects/anat/'
LA={
 'Groove for vertebral artery':('Sulcus arteriae vertebralis','Борозна хребтової артерії'),'Transverse ligament tubercle':('Tuberculum ligamenti transversi atlantis','Горбок поперечної зв’язки атланта'),
 'Superior articular surface of atlas':('Facies articularis superior atlantis','Верхня суглобова поверхня атланта'),'Posterior tubercle of atlas':('Tuberculum posterius atlantis','Задній горбок атланта'),
 'Posterior arch of atlas':('Arcus posterior atlantis','Задня дуга атланта'),'Lateral mass':('Massa lateralis atlantis','Бічна маса атланта'),'Inferior articular surface of atlas':('Facies articularis inferior atlantis','Нижня суглобова поверхня атланта'),
 'Facet for dens':('Fovea dentis','Ямка зуба'),'Atlas':('Atlas (C I)','Атлант (C I)'),'Anterior tubercle of atlas':('Tuberculum anterius atlantis','Передній горбок атланта'),'Anterior arch of atlas':('Arcus anterior atlantis','Передня дуга атланта'),
 '(Canal for vertebral artery)':('Foramen transversarium atlantis','Поперечний отвір атланта'),
 'Posterior articular facet of dens axis':('Facies articularis posterior dentis','Задня суглобова поверхня зуба'),'Dens axis':('Dens axis','Зуб осьового хребця'),'Axis (C2)':('Axis (C II)','Осьовий хребець (C II)'),'Apex of dens axis':('Apex dentis','Верхівка зуба'),'Anterior articular facet of dens axis':('Facies articularis anterior dentis','Передня суглобова поверхня зуба'),
 'Uncinate process of vertebra':('Uncus corporis vertebrae','Гачок тіла хребця'),'Posterior tubercle of transverse process':('Tuberculum posterius processus transversi','Задній горбок поперечного відростка'),'Groove for spinal nerve':('Sulcus nervi spinalis','Борозна спинномозкового нерва'),
 'Foramen transversarium':('Foramen transversarium','Поперечний отвір'),'Cervical vertebra':('Vertebra cervicalis','Шийний хребець'),'Anterior tubercle of transverse process':('Tuberculum anterius processus transversi','Передній горбок поперечного відростка'),
 'Thoracic vertebra':('Vertebra thoracica','Грудний хребець'),'Transverse costal facet':('Fovea costalis processus transversi','Реброва ямка поперечного відростка'),'Inferior costal facet':('Fovea costalis inferior','Нижня реброва ямка'),'Superior costal facet':('Fovea costalis superior','Верхня реброва ямка'),
 'Vertebral foramen':('Foramen vertebrale','Хребцевий отвір'),'Vertebral body':('Corpus vertebrae','Тіло хребця'),'Vertebral arch':('Arcus vertebrae','Дуга хребця'),'Vertebra':('Vertebra lumbalis','Поперековий хребець'),'Transverse process':('Processus transversus','Поперечний відросток'),
 'Superior vertebral notch':('Incisura vertebralis superior','Верхня хребцева вирізка'),'Superior articular process of vertebra':('Processus articularis superior','Верхній суглобовий відросток'),'Superior articular facet of vertebra':('Facies articularis superior','Верхня суглобова поверхня'),
 'Spinous process':('Processus spinosus','Остистий відросток'),'Pedicle of vertebral arch':('Pediculus arcus vertebrae','Ніжка дуги хребця'),'Pars interarticularis of vertebral arch':('Pars interarticularis','Міжсуглобова частина дуги'),'Lateral part of transverse process':('Processus costalis','Ребровий відросток'),
 'Lamina of vertebral arch':('Lamina arcus vertebrae','Пластинка дуги хребця'),'Intervertebral surface':('Facies intervertebralis','Міжхребцева поверхня'),'Intervertebral foramen':('Foramen intervertebrale','Міжхребцевий отвір'),'Inferior vertebral notch':('Incisura vertebralis inferior','Нижня хребцева вирізка'),
 'Inferior articular facet of vertebra':('Facies articularis inferior','Нижня суглобова поверхня'),'Costal part of transverse process':('Processus accessorius','Додатковий відросток'),'Annular epiphysis':('Epiphysis anularis','Кільцеподібний епіфіз'),
 'Transverse ridges':('Lineae transversae','Поперечні лінії'),'Superior articular process of sacrum':('Processus articularis superior','Верхній суглобовий відросток'),'Sacrum':('Os sacrum','Крижова кістка'),'Sacral tuberosity':('Tuberositas sacralis','Крижова горбистість'),
 'Sacral horn':('Cornu sacrale','Крижовий ріг'),'Sacral hiatus':('Hiatus sacralis','Крижовий розтвір'),'Sacral canal':('Canalis sacralis','Крижовий канал'),'Promontory':('Promontorium','Мис'),'Posterior sacral foramina':('Foramina sacralia posteriora','Задні крижові отвори'),
 'Pelvic surface of sacrum':('Facies pelvica','Тазова поверхня'),'Median sacral crest':('Crista sacralis mediana','Серединний крижовий гребінь'),'Lateral sacral crest':('Crista sacralis lateralis','Бічний крижовий гребінь'),'Lateral part of sacrum':('Pars lateralis','Бічна частина'),
 'Intervertebral foramina':('Foramina intervertebralia','Міжхребцеві отвори'),'Intermediate sacral crest':('Crista sacralis medialis','Присередній крижовий гребінь'),'Dorsal surface of sacrum':('Facies dorsalis','Дорсальна поверхня'),'Base of sacrum':('Basis ossis sacri','Основа крижової кістки'),
 'Auricular surface of sacrum':('Facies auricularis','Вушкоподібна поверхня'),'Apex of sacrum':('Apex ossis sacri','Верхівка крижової кістки'),'Anterior sacral foramina':('Foramina sacralia anteriora','Передні крижові отвори'),'Ala of sacrum':('Ala ossis sacri','Крило крижової кістки'),
 'Coccyx':('Os coccygis','Куприк'),'Coccygeal horn':('Cornu coccygeum','Куприковий ріг'),'Base of coccyx':('Basis ossis coccygis','Основа куприка'),'Apex of coccyx':('Apex ossis coccygis','Верхівка куприка'),
}
GENERIC=['Vertebral foramen','Vertebral body','Vertebral arch','Transverse process','Superior articular process of vertebra','Spinous process','Pedicle of vertebral arch','Lamina of vertebral arch','Inferior vertebral notch','Superior vertebral notch']
SETS=[('atlas-c1','v3-atlas','Атлант (C I) — 3D',[]),('axis-c2','v3-axis','Осьовий хребець (C II) — 3D',['Vertebral foramen','Vertebral body','Vertebral arch','Transverse process','Spinous process','Lamina of vertebral arch']),
      ('vertebra-c4','v3-c4','Шийний хребець (C IV) — 3D',GENERIC),('vertebra-c7','v3-c7','VII шийний хребець (vertebra prominens) — 3D',GENERIC+['Foramen transversarium']),
      ('vertebra-t8','v3-t8','Грудний хребець (T VIII) — 3D',GENERIC),('vertebra-l3','v3-l3','Поперековий хребець (L III) — 3D',[]),('sacrum','v3-sacrum','Крижова кістка — 3D',[]),('coccyx','v3-coccyx','Куприк — 3D',[])]
# шаблон: нормалізовані (за bbox) позиції загальних частин з L3
l3=json.load(open('glb/vertebra-l3.json')); l3m=trimesh.load('glb/vertebra-l3.glb',force='mesh'); b=l3m.bounds
tmpl={p['name']:(np.array(p['p'])-b[0])/(b[1]-b[0]) for p in l3['pins']}
def proj(p): return [round((p[0]+0.5)*100,2), round((0.5-p[1])*100,2)]
out_sets=[]
for fn,sid,title,extra in SETS:
    meta=json.load(open(f'glb/{fn}.json')); m=trimesh.load(f'glb/{fn}.glb',force='mesh'); bb=m.bounds
    pins=[(p['name'],np.array(p['p'])) for p in meta['pins'] if p['name'] in LA]
    have={n for n,_ in pins}
    for g in extra:
        if g in have or g not in tmpl: continue
        p=bb[0]+tmpl[g]*(bb[1]-bb[0])
        # привести до поверхні (крім отворів/вирізок — вони і так у порожнині)
        if 'foramen' not in g.lower() and 'notch' not in g.lower():
            (q,),_,_=trimesh.proximity.closest_point(m,[p]); p=q
        pins.append((g,p))
    items=[]
    for i,(n,p) in enumerate(pins,1):
        la,uk=LA.get(n,(n,n)); items.append({'n':i,'la':la,'uk':uk,'pts':[proj(p)],'p3':[round(float(v),4) for v in p]})
    shutil.copy(f'glb/{fn}.glb',A+f'models/{sid}.glb')
    out_sets.append({'id':sid,'title':title,'cat':'Хребет','file':f'models/{sid}.glb','model':True,'w':1000,'h':1000,'items':items,
        'credit':{'artist':'Z-Anatomy (Lluís Vinent Juanico), за BodyParts3D','license':'CC BY-SA 4.0','licurl':'https://creativecommons.org/licenses/by-sa/4.0/','source':'https://github.com/LluisV/Z-Anatomy'}})
    print(sid,len(items),'pins')
json.dump(out_sets,open('sets3d.json','w'),ensure_ascii=False,indent=1)
