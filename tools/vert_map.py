import json
L=json.load(open('dl/vert_lines.json'))
# (slug, title, plate, items) ; item = (la, uk, lines-list or [('xy',x,y)])
SETS=[
 ('vert-cervical','Шийний хребець (типовий), вигляд зверху','5',[
  ('Processus spinosus','Остистий відросток',[1]),('Arcus vertebrae','Дуга хребця',[2]),('Processus articularis superior','Верхній суглобовий відросток',[3,4]),
  ('Sulcus nervi spinalis','Борозна спинномозкового нерва',[5,6]),('Tuberculum anterius processus transversi','Передній горбок поперечного відростка',[7,8]),
  ('Tuberculum posterius processus transversi','Задній горбок поперечного відростка',[10,12]),('Foramen transversarium','Отвір поперечного відростка',[('xy',13.9,82.5)]),('Corpus vertebrae','Тіло хребця',[('xy',33.5,84.5)])]),
 ('vert-atlas','Атлант (C I), вигляд зверху','7',[
  ('Tuberculum posterius','Задній горбок',[1]),('Sulcus arteriae vertebralis','Борозна хребтової артерії',[2,3]),('Facies articularis superior','Верхня суглобова поверхня',[4,5,6]),
  ('Processus transversus','Поперечний відросток',[7]),('Foramen transversarium','Отвір поперечного відростка',[8]),('Fovea dentis','Ямка зуба',[9]),('Massa lateralis','Бічна маса',[10]),('Tuberculum anterius','Передній горбок',[11])]),
 ('vert-axis','Осьовий хребець (C II), вигляд спереду','8',[
  ('Dens axis (facies articularis anterior)','Зуб осьового хребця (передня суглобова поверхня)',[1,2,3]),('Facies articularis superior','Верхня суглобова поверхня',[4]),
  ('Processus transversus','Поперечний відросток',[5,6]),('Corpus vertebrae','Тіло хребця',[7]),('Facies articularis inferior','Нижня суглобова поверхня',[8,9,10])]),
 ('vert-t10-l2','Хребці T X – L II, вигляд збоку','9',[
  ('Fovea costalis superior','Верхня реброва ямка',[1]),('Processus articularis superior','Верхній суглобовий відросток',[2]),('Fovea costalis processus transversi','Реброва ямка поперечного відростка',[3,4]),
  ('Vertebra thoracica X','Десятий грудний хребець',[5,6]),('Vertebra thoracica XII','Дванадцятий грудний хребець',[('xy',10.9,45.8)]),('Processus accessorius','Додатковий відросток',[7,8],[14]),
  ('Vertebra lumbalis I','Перший поперековий хребець',[10,11]),('Processus mammillaris','Соскоподібний відросток',[12]),('Processus costalis (transversus)','Ребровий (поперечний) відросток',[13]),('Processus articularis inferior','Нижній суглобовий відросток',[15])]),
 ('vert-thoracic-sup','Грудний хребець, вигляд зверху','10',[
  ('Processus spinosus','Остистий відросток',[1]),('Processus transversus','Поперечний відросток',[2]),('Fovea costalis processus transversi','Реброва ямка поперечного відростка',[3,4]),
  ('Processus articularis superior','Верхній суглобовий відросток',[5,6]),('Fovea costalis superior','Верхня реброва ямка (для головки ребра)',[7,('xy',76.9,66.9)])]),
 ('vert-thoracic-lat','Грудний хребець, вигляд збоку','11',[
  ('Fovea costalis superior','Верхня реброва ямка',[1,2]),('Fovea costalis inferior','Нижня реброва ямка',[3]),('Processus articularis inferior','Нижній суглобовий відросток',[4,6,8]),
  ('Incisura vertebralis inferior','Нижня хребцева вирізка',[5,7]),('Processus spinosus','Остистий відросток',[9])]),
 ('vert-lumbar','Поперековий хребець, вигляд зверху','12',[
  ('Processus spinosus','Остистий відросток',[1]),('Processus mammillaris','Соскоподібний відросток',[2]),('Processus accessorius','Додатковий відросток',[3]),
  ('Processus articularis superior','Верхній суглобовий відросток',[4]),('Processus costalis (transversus)','Ребровий (поперечний) відросток',[5])]),
 ('vert-sacrum-dorsal','Крижова кістка, дорсальна поверхня','13',[
  ('Processus articularis superior','Верхній суглобовий відросток',[1]),('Canalis sacralis','Крижовий канал',[2]),('Tuberositas sacralis','Крижова горбистість',[3,4,6]),('Facies auricularis','Вушкоподібна поверхня',[5,7]),
  ('Crista sacralis lateralis','Бічний крижовий гребінь',[8,9,10]),('Crista sacralis medialis','Присередній крижовий гребінь',[11,13,15]),('Crista sacralis mediana','Серединний крижовий гребінь',[12,14]),
  ('Foramina sacralia posteriora','Задні крижові отвори',[16,17]),('Apex ossis sacri','Верхівка крижової кістки',[18]),('Hiatus sacralis','Крижовий розтвір',[20]),('Cornu sacrale','Крижовий ріг',[21])]),
 ('vert-sacrum-pelvic','Крижова кістка, тазова поверхня','14',[
  ('Processus articularis superior','Верхній суглобовий відросток',[1]),('Lineae transversae','Поперечні лінії',[2,3,4]),('Foramina sacralia anteriora','Передні крижові отвори',[6,7,8]),('Apex ossis sacri','Верхівка крижової кістки',[10])]),
 ('vert-sacrum-base','Крижова кістка, основа (вигляд зверху)','15',[
  ('Crista sacralis mediana','Серединний крижовий гребінь',[1]),('Crista sacralis medialis','Присередній крижовий гребінь',[2,3]),('Incisura vertebralis superior','Верхня хребцева вирізка',[5,8]),
  ('Canalis sacralis','Крижовий канал',[4,7]),('Processus articularis superior','Верхній суглобовий відросток',[6]),('Pars lateralis','Бічна частина',[9])]),
 ('vert-sacrum-sagittal','Крижова кістка, сагітальний розпил','17',[
  ('Basis ossis sacri','Основа крижової кістки',[1]),('Processus articularis superior','Верхній суглобовий відросток',[2,3,4]),('Facies pelvica','Тазова поверхня',[5,7]),
  ('Canalis sacralis','Крижовий канал',[6,8]),('Synchondroses sacrales','Крижові синхондрози',[9,10,11]),('Apex ossis sacri','Верхівка крижової кістки',[12])]),
 ('vert-sacrum-coccyx','Крижова кістка і куприк, вигляд збоку','18',[
  ('Tuberositas sacralis','Крижова горбистість',[1]),('Os sacrum','Крижова кістка',[2]),('Crista sacralis mediana','Серединний крижовий гребінь',[3,4,6]),('Facies auricularis','Вушкоподібна поверхня',[5,7]),
  ('Cornu sacrale','Крижовий ріг',[9]),('Cornu coccygeum','Куприковий ріг',[10]),('Vertebra coccygea I','Перший куприковий хребець',[11,12,13]),('Os coccygis','Куприк',[('xy',40.5,91.5)])]),
]
out=[]
for slug,title,plate,items in SETS:
    lines={l['i']:l for l in L[plate]}
    its=[]
    for n,(la,uk,*groups) in enumerate(items,1):
        pts=[]
        for g in groups:
            xy=[e for e in g if isinstance(e,tuple)]
            idx=[e for e in g if isinstance(e,int)]
            if idx:
                xs0=min(lines[i]['x0'] for i in idx); xs1=max(lines[i]['x1'] for i in idx); ys0=min(lines[i]['y0'] for i in idx); ys1=max(lines[i]['y1'] for i in idx)
                pts.append([round((xs0+xs1)/2,2),round((ys0+ys1)/2,2)])
            for e in xy: pts.append([e[1],e[2]])
        its.append({'n':n,'la':la,'uk':uk,'pts':pts})
    out.append({'id':slug,'title':title,'cat':'Скелет','file':'atlas/'+slug+'.jpg','plate':plate,'items':its,
      'credit':{'artist':'Sobotta, Atlas and Text-book of Human Anatomy (American ed., 1909)','license':'Public domain','licurl':'','source':'https://commons.wikimedia.org/wiki/File:Sobo_1909_'+plate+'.png'}})
json.dump(out,open('vert_sets.json','w'),ensure_ascii=False,indent=0)
print(len(out),'sets',sum(len(s['items']) for s in out),'items')
