# Explicit label positions (% of image) read from the original plates.
T={
 'Radius':('Radius','Променева кістка'),'Ulna':('Ulna','Ліктьова кістка'),
 'circ':('Circumferentia articularis capitis ulnae','Суглобовий обвід головки ліктьової кістки'),
 'styl_u':('Processus styloideus ulnae','Шилоподібний відросток ліктьової кістки'),
 'styl_r':('Processus styloideus radii','Шилоподібний відросток променевої кістки'),
 'lun':('Os lunatum','Півмісяцева кістка'),'scaph':('Os scaphoideum','Човноподібна кістка'),
 'trapd':('Os trapezoideum','Трапецієподібна кістка'),'trapz':('Os trapezium','Кістка-трапеція'),
 'triq':('Os triquetrum','Тригранна кістка'),'ham':('Os hamatum','Гачкувата кістка'),'cap':('Os capitatum','Головчаста кістка'),
 'pis':('Os pisiforme','Горохоподібна кістка'),'mc1':('Os metacarpale I','Перша п’ясткова кістка'),
 'base5':('Basis ossis metacarpalis V','Основа п’ятої п’ясткової кістки'),
 'styl3':('Processus styloideus ossis metacarpalis III','Шилоподібний відросток третьої п’ясткової кістки'),
 'heads':('Capita ossium metacarpalium','Головки п’ясткових кісток'),
 'tub_scaph':('Tuberculum ossis scaphoidei','Горбок човноподібної кістки'),'tub_trapz':('Tuberculum ossis trapezii','Горбок кістки-трапеції'),
 'hamulus':('Hamulus ossis hamati','Гачок гачкуватої кістки'),'head1':('Caput ossis metacarpalis I','Головка першої п’ясткової кістки'),
 'head2':('Caput ossis metacarpalis II','Головка другої п’ясткової кістки'),
 'ph1':('Phalanx proximalis','Проксимальна фаланга'),'ph2':('Phalanx media','Середня фаланга'),'ph3':('Phalanx distalis','Дистальна (кінцева) фаланга'),
 'ph1p':('Phalanx proximalis pollicis','Проксимальна фаланга великого пальця'),'ph2p':('Phalanx distalis pollicis','Дистальна фаланга великого пальця'),
 'tubdist':('Tuberositas phalangis distalis','Горбистість дистальної фаланги'),
 'carpus':('Carpus','Зап’ясток'),'metacarpus':('Metacarpus','П’ясток'),'phalanges':('Phalanges','Фаланги'),
 'base_ph5':('Basis phalangis (V)','Основа фаланги (V палець)'),'troch_ph5':('Trochlea phalangis (V)','Блок фаланги (V палець)'),
 'ph1i':('Phalanx proximalis indicis','Проксимальна фаланга вказівного пальця'),
}
SETS=[
 ('hand-126','Кисть, тильна поверхня: зап’ясток і п’ясток',[('Radius',32.8,12.4),('Ulna',63.1,10.2),('circ',88.8,23.1),('styl_u',88.1,29.3),('lun',81.6,33.3),('scaph',24.7,36.7),('trapd',15.3,39.8),('triq',83.4,39.8),('trapz',15.3,45.7),('ham',82.2,45.7),('cap',82.5,50.2),('mc1',10.3,52.2),('base5',81.3,55.6),('styl3',86.9,69.4),('heads',57.2,97.9)]),
 ('hand-127','Кисть, долонна поверхня: зап’ясток і п’ясток',[('styl_u',15.3,26.6),('lun',9.1,31.9),('styl_r',86.6,35.5),('pis',11.6,36.6),('tub_scaph',87.5,41.5),('triq',7.5,40.4),('trapd',86.6,45.0),('tub_trapz',86.6,49.1),('ham',11.3,45.6),('cap',10.9,53.7),('mc1',87.8,58.9)]),
 ('hand-128','Кістки кисті окремо, тильна поверхня',[('styl3',49.3,3.0),('lun',56.7,5.2),('cap',73.8,6.2),('scaph',23.4,8.0),('triq',85.5,10.5),('trapd',13.1,11.5),('ham',84.0,14.2),('trapz',12.1,18.2),('pis',86.9,19.0),('base5',88.7,25.2),('mc1',26.2,38.2),('ph1p',22.0,59.0),('ph2p',19.9,68.5),('tubdist',77.0,88.5)]),
 ('hand-129','Кістки кисті окремо, долонна поверхня',[('lun',58.4,1.8),('triq',29.8,6.0),('cap',64.1,6.0),('scaph',79.8,9.2),('pis',10.7,12.0),('trapd',85.5,12.8),('trapz',86.3,17.5),('hamulus',9.9,22.8),('head1',72.5,49.2),('head2',73.3,58.2),('ph1',73.7,65.2),('ph2',77.1,82.0),('ph3',73.7,90.5)]),
 ('hand-130','Скелет кисті, тильна поверхня',[('Radius',28.0,14.2),('Ulna',72.6,13.0),('carpus',69.6,25.2),('mc1',12.3,36.5),('metacarpus',78.8,39.8),('ph1p',10.6,53.2),('base_ph5',87.3,52.0),('ph2p',8.9,63.2),('troch_ph5',86.3,61.8),('phalanges',86.6,64.0),('ph1i',19.4,71.8),('ph2',19.8,80.5),('ph3',22.5,88.5),('tubdist',37.5,96.2)]),
 ('hand-131','Скелет кисті, долонна поверхня',[('Ulna',18.8,12.0),('Radius',73.3,10.5),('carpus',21.9,25.0),('metacarpus',17.3,41.8),('phalanges',7.3,67.0),('ph1',86.0,72.8),('ph2',87.6,86.5),('ph3',85.3,93.8)]),
]
def build(dims):
    out=[]
    for slug,title,items in SETS:
        its=[{'n':i+1,'la':T[k][0],'uk':T[k][1],'pts':[[x,y]]} for i,(k,x,y) in enumerate(items)]
        w,h=dims[slug]; plate=slug.split('-')[1]
        out.append({'id':slug,'title':title,'cat':'Верхня кінцівка','file':'atlas/'+slug+'.jpg','w':w,'h':h,'items':its,
          'credit':{'artist':'Sobotta, Atlas and Text-book of Human Anatomy (American ed., 1909)','license':'Public domain','licurl':'','source':'https://commons.wikimedia.org/wiki/File:Sobo_1909_'+plate+'.png'}})
    return out
