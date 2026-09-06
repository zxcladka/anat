import cv2,numpy as np,json,os,sys
from plate_clean2 import clean
BOX={
 'Sobo_1906_528':[(41,0,49,4),(63,0,98,5),(66,8,87,14),(80,22,96,28),(78,32,90,37),(9,6,31,11),(0,13,24,17),(1,25,16,30),(0,47,10,53),(0,57,11,64),(1,64,16,70),(7,88,32,98),(65,83,86,91)],
 'Sobo_1906_470':[(2,74,24,88),(14,1,39,6),(72,3,94,8),(77,13,98,20),(79,20,99,27),(77,34,96,38),(78,39,98,44),(79,57,91,62),(2,66,17,72),(4,76,22,86),(14,89,34,95),(48,94,75,100)],
 'Sobo_1909_761':[(0,0,22,48),(0,60,22,100),(0,48,19,60),(88,40,100,100),(10,1,26,5),(3,9,25,15),(7,20,26,23),(5,24,26,30),(9,36,26,40),(10,65,26,69),(6,76,26,80),(4,89,31,94),(31,93,49,97),(53,93,56,96),(55,88,64,96),(66,85,90,89),(66,90,82,94),(78,75,95,79),(53,1,69,6),(60,9,90,14),(66,13,82,17),(70,18,86,22),(73,22,87,26),(76,26,99,30),(79,30,90,33),(88,46,90,48),(26,3,36,10),(24,9,36,15),(25,21,36,25),(24,27,36,32),(25,38,32,44),(25,66,40,70),(24,76,38,80),(25,88,40,92),(48,4,62,14),(55,12,66,20),(60,16,74,24),(64,22,78,32),(70,28,80,36),(40,84,60,93),(58,80,70,88),(70,80,78,86),(72,66,80,74)],
 'Sobo_1909_624':[(0,0,100,14),(0,14,15,100),(84,14,100,100),(0,82,100,100),(66,70,84,82),(87,45,100,55)],
 'Sobo_1911_777':[(58,2,90,9),(16,16,28,22),(24,20,37,26),(37,17,48,26),(33,25,43,32),(59,23,81,29),(66,28,81,33),(71,31,92,39),(77,44,100,52),(8,77,19,83),(18,82,29,88),(31,77,44,86),(20,88,47,94),(55,88,80,94)],
 'Sobo_1906_393':[],
 'Sobo_1906_406':[(61,36,78,53),(50,56,61,62),(46,64,69,70),(52,75,71,81),(87,43,100,52),(86,65,100,72),(6,73,16,80),(4,82,16,87),(7,90,17,97)],
}
def erase_boxes(im,boxes):
    """Підписи: на білому полі — забілити; поверх рисунка — маска чорнила + inpaint (Telea).
    Додатково автоматично: майже чорні компоненти, схожі на слова (широкі, нещільні)."""
    g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY); h,w=g.shape
    c=im.astype(np.int16); mx=np.maximum(c[:,:,0],c[:,:,1])
    ink=((c[:,:,2]<125)&(mx<125)); black=((c[:,:,2]<90)&(mx<90))
    m=np.zeros_like(g)
    gray_plate=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)[:,:,1].mean()<25          # чорно-біла пластина: чорнило може бути сірим
    bh=cv2.morphologyEx(g,cv2.MORPH_BLACKHAT,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(15,15))) if gray_plate else None
    for x0,y0,x1,y1 in boxes:
        x0e,y0e,x1e,y1e=int(x0*w/100),int(y0*h/100),int(x1*w/100),int(y1*h/100)   # рамка як задано — для класифікації
        reg=g[y0e:y1e,x0e:x1e]
        if not reg.size: continue
        opened=cv2.morphologyEx((reg<200).astype(np.uint8),cv2.MORPH_OPEN,np.ones((9,9),np.uint8))
        if opened.mean()<0.02:      # підпис на білому полі: забілити з невеликим запасом
            X0,Y0,X1,Y1=int(max(0,x0-0.5)*w/100),int(max(0,y0-0.4)*h/100),int(min(100,x1+0.5)*w/100),int(min(100,y1+0.4)*h/100)
            im[Y0:Y1,X0:X1]=(255,255,255); continue
        X0,Y0,X1,Y1=int(max(0,x0-1.2)*w/100),int(max(0,y0-1.0)*h/100),int(min(100,x1+1.2)*w/100),int(min(100,y1+1.0)*h/100)
        sub=ink[Y0:Y1,X0:X1].astype(np.uint8)
        if gray_plate: sub=np.maximum(sub,((bh[Y0:Y1,X0:X1]>35)&(g[Y0:Y1,X0:X1]<190)).astype(np.uint8))
        m[Y0:Y1,X0:X1]=np.maximum(m[Y0:Y1,X0:X1],sub)
    # авто: слова чорним чорнилом поверх рисунка
    b8=black.astype(np.uint8)
    lines=cv2.HoughLinesP(b8*255,1,np.pi/360,threshold=40,minLineLength=int(0.04*w),maxLineGap=int(0.005*w))
    if lines is not None:
        for l in lines.reshape(-1,4): x1,y1,x2,y2=[int(v) for v in l]; cv2.line(b8,(x1,y1),(x2,y2),0,5)
    b8=cv2.morphologyEx(b8,cv2.MORPH_CLOSE,np.ones((3,9),np.uint8))
    n,lab,st,_=cv2.connectedComponentsWithStats(b8,8)
    for i in range(1,n):
        x,y,bw,bhh,a=st[i]; fill=a/float(bw*bhh)
        if bhh<0.004*h or bhh>0.05*h or bw<0.004*w or bw>0.4*w or a>0.03*h*w: continue
        if fill<0.12 and max(bw,bhh)>0.12*max(h,w): continue
        if (bw/bhh>=1.6 and fill<0.6) or (fill<0.3 and bw/bhh>=0.8):
            sl=lab[y:y+bhh,x:x+bw]==i; m[y:y+bhh,x:x+bw]=np.maximum(m[y:y+bhh,x:x+bw],(ink[y:y+bhh,x:x+bw]&sl).astype(np.uint8))
    out=im
    if m.any():
        m=cv2.dilate(m,np.ones((5,5),np.uint8))
        out=cv2.inpaint(im,m*255,4,cv2.INPAINT_TELEA)
    # залишки на білому полі: дрібні темні компоненти, оточені білим — забілити
    g2=cv2.cvtColor(out,cv2.COLOR_BGR2GRAY); d=(g2<225).astype(np.uint8)
    n,lab,st,_=cv2.connectedComponentsWithStats(d,8); wm=np.zeros_like(d)
    for i in range(1,n):
        x,y,bw,bhh,a=st[i]
        if a>0.0005*h*w or bhh>0.05*h or bw>0.3*w: continue
        X0,Y0,X1,Y1=max(0,x-20),max(0,y-20),min(w,x+bw+20),min(h,y+bhh+20)
        comp=(lab[Y0:Y1,X0:X1]==i).astype(np.uint8)
        ring=cv2.dilate(comp,np.ones((31,31),np.uint8))-cv2.dilate(comp,np.ones((7,7),np.uint8))
        if ring.any() and g2[Y0:Y1,X0:X1][ring.astype(bool)].mean()>238: wm[Y0:Y1,X0:X1]|=cv2.dilate(comp,np.ones((5,5),np.uint8))
    out[wm.astype(bool)]=(255,255,255)
    return erase_boxes(out,[]) if boxes else out      # другий прохід лише авто-детектором — для залишків

SETS={
 'Sobo_1906_528':('heart','Серце: фронтальний розріз (камери, клапани, судини)','Серце і судини',[
  ('Aorta','Аорта',45,12),('Valva aortae','Аортальний клапан (півмісяцеві заслінки)',47,26),('Atrium sinistrum','Ліве передсердя',67,22),('Ostium venae pulmonalis','Отвір легеневої вени',77,22),
  ('Cuspis anterior valvae mitralis','Передня стулка мітрального клапана',58,41),('Cuspis posterior valvae mitralis','Задня стулка мітрального клапана',68,44),('Ventriculus sinister','Лівий шлуночок',66,62),
  ('Ventriculus dexter','Правий шлуночок',24,62),('Valva tricuspidalis','Тристулковий клапан',30,55),('Pars muscularis septi interventricularis','М’язова частина міжшлуночкової перегородки',45,66),
  ('Pars membranacea septi interventricularis','Перетинчаста частина міжшлуночкової перегородки',39,29),('Musculi papillares ventriculi dextri','Сосочкові м’язи правого шлуночка',32,66),('Musculi papillares ventriculi sinistri','Сосочкові м’язи лівого шлуночка',66,75),
  ('Auricula dextra','Праве вушко',21,15),('Arteria coronaria dextra','Права вінцева артерія',33,31),('Chordae tendineae','Сухожилкові струни',60,52),('Trabeculae carneae','М’ясисті перекладки',25,73)]),
 'Sobo_1906_470':('kidney','Нирка: фронтальний розріз','Сечова система',[
  ('Capsula fibrosa renis','Волокниста капсула нирки',39,11),('Cortex renalis','Кіркова речовина',50,84),('Columnae renales','Ниркові стовпи',22,55),('Pyramis renalis','Ниркова піраміда',33,65),('Medulla renalis','Мозкова речовина',63,63),
  ('Papilla renalis','Нирковий сосочок',39,67),('Pelvis renalis','Ниркова миска',66,45),('Calix renalis major','Велика ниркова чашечка',52,47),('Calix renalis minor','Мала ниркова чашечка',41,40),('Ureter','Сечовід',72,58),
  ('Arteria renalis','Ниркова артерія',76,47),('Rami venae renalis','Гілки ниркової вени',58,17),('Corpus adiposum sinus renalis','Жирове тіло ниркової пазухи',70,29),('Hilum renale','Ниркові ворота',69,50),
  ('Extremitas superior renis','Верхній кінець нирки',52,9),('Extremitas inferior renis','Нижній кінець нирки',47,86),('Margo lateralis renis','Бічний край нирки',14,50)]),
 'Sobo_1909_761':('eye','Очне яблуко та очна ямка: сагітальний розріз','Органи чуття',[
  ('Sclera','Склера (білкова оболонка)',44,31),('Cornea','Рогівка',33,50),('Lens','Кришталик',37,52),('Iris','Райдужка',35,44),('Pupilla','Зіниця',34,50),('Camera anterior bulbi','Передня камера ока',33,47),
  ('Corpus ciliare','Війкове тіло',37,38),('Corpus vitreum','Скловидне тіло',48,50),('Retina','Сітківка',50,66),('Choroidea','Судинна оболонка',56,42),('Nervus opticus','Зоровий нерв',68,50),('Vagina nervi optici','Піхва зорового нерва',72,44),
  ('Musculus rectus superior','Верхній прямий м’яз',50,27),('Musculus levator palpebrae superioris','М’яз-підіймач верхньої повіки',52,20),('Musculus rectus inferior','Нижній прямий м’яз',62,62),('Musculus obliquus inferior','Нижній косий м’яз',44,72),
  ('Corpus adiposum orbitae','Жирове тіло очної ямки',70,38),('Palpebra superior','Верхня повіка',29,32),('Palpebra inferior','Нижня повіка',30,66),('Tarsus superior','Верхній хрящ повіки',30,38),('Tarsus inferior','Нижній хрящ повіки',31,62),('Fornix conjunctivae superior','Верхнє склепіння кон’юнктиви',32,27),('Fornix conjunctivae inferior','Нижнє склепіння кон’юнктиви',33,74)]),
 'Sobo_1909_624':('brain','Головний мозок: серединний розріз','Нервова система',[
  ('Lobus frontalis','Лобова частка',80,35),('Lobus parietalis','Тім’яна частка',52,15),('Lobus occipitalis','Потилична частка',12,58),('Gyrus cinguli','Поясна закрутка',66,38),('Corpus callosum','Мозолисте тіло',50,42),
  ('Fornix','Склепіння',58,47),('Septum pellucidum','Прозора перегородка',66,45),('Thalamus','Таламус',59,50),('Hypothalamus','Гіпоталамус',62,66),('Hypophysis','Гіпофіз',55,76),('Corpus pineale','Шишкоподібне тіло',49,52),
  ('Lamina tecti (quadrigemina)','Пластинка покрівлі (чотиригорбкова)',48,55),('Mesencephalon','Середній мозок',45,62),('Pons','Міст',44,69),('Medulla oblongata','Довгастий мозок',37,80),('Cerebellum','Мозочок',28,57),
  ('Ventriculus quartus','Четвертий шлуночок',36,66),('Medulla spinalis','Спинний мозок',26,88),('Chiasma opticum','Зорове перехрестя',60,72)]),
 'Sobo_1911_777':('labyrinth','Кістковий лабіринт внутрішнього вуха (правий)','Органи чуття',[
  ('Cochlea','Завитка',18,55),('Cupula cochleae','Купол завитки',15,30),('Vestibulum','Присінок',38,60),('Recessus ellipticus','Еліптичний закуток',36,48),('Recessus sphericus','Сферичний закуток',40,42),
  ('Canalis semicircularis anterior','Передній півколовий канал',55,12),('Ampulla ossea anterior','Передня кісткова ампула',44,37),('Crus osseum commune','Спільна кісткова ніжка',51,44),('Aqueductus vestibuli','Водопровід присінка',44,52),
  ('Canalis semicircularis lateralis','Бічний півколовий канал',72,47),('Ampulla ossea lateralis','Бічна кісткова ампула',54,58),('Canalis semicircularis posterior','Задній півколовий канал',75,60),('Ampulla ossea posterior','Задня кісткова ампула',45,70),('Canaliculus cochleae','Каналець завитки',36,73)]),
 'Sobo_1906_393':('biliary','Жовчні шляхи, підшлункова залоза та сусідні органи','Травна система',[
  ('Vesica biliaris','Жовчний міхур',15,20),('Ductus cysticus','Міхурова протока',24,42),('Ductus hepaticus communis','Спільна печінкова протока',33,35),('Ductus choledochus','Спільна жовчна протока',36,52),('Hepar','Печінка',35,20),
  ('Pars superior duodeni','Верхня частина дванадцятипалої кишки',32,52),('Pars horizontalis duodeni','Горизонтальна частина дванадцятипалої кишки',57,76),('Caput pancreatis','Головка підшлункової залози',36,62),('Corpus pancreatis','Тіло підшлункової залози',60,58),('Cauda pancreatis','Хвіст підшлункової залози',80,66),
  ('Splen','Селезінка',90,55),('Ren dexter','Права нирка',12,62),('Ren sinister','Ліва нирка',76,82),('Vena cava inferior','Нижня порожниста вена',52,25),('Vena portae hepatis','Ворітна печінкова вена',44,42),('Arteria hepatica propria','Власна печінкова артерія',38,38),
  ('Vena splenica','Селезінкова вена',62,45),('Arteria splenica','Селезінкова артерія',66,48),('Vena mesenterica superior','Верхня брижова вена',46,85),('Arteria mesenterica superior','Верхня брижова артерія',53,85)]),
 'Sobo_1906_406':('abdomen','Органи черевної порожнини (шлунок відвернуто догори)','Травна система',[
  ('Gaster (facies posterior)','Шлунок (задня поверхня)',65,40),('Duodenum','Дванадцятипала кишка',44,45),('Pancreas','Підшлункова залоза',55,60),('Mesocolon transversum','Брижа поперечної ободової кишки',57,68),('Colon transversum','Поперечна ободова кишка',62,80),
  ('Vesica biliaris','Жовчний міхур',18,33),('Hepar','Печінка',35,22),('Foramen omentale (epiploicum)','Чепцевий отвір',18,68),('Ren dexter','Права нирка',17,86),('Omentum majus','Великий чепець',28,92),('Splen','Селезінка',86,62),('Diaphragma','Діафрагма',60,10),('Ligamentum hepatoduodenale','Печінково-дванадцятипалокишкова зв’язка',33,48)]),
}
if __name__=='__main__':
    os.makedirs('sobo2/final',exist_ok=True); os.makedirs('sobo2/ov',exist_ok=True)
    for name,(sid,title,cat,items) in SETS.items():
        im=clean('sobo2/full/'+name+'.png','sobo2/clean/'+name+'.jpg',use_mask=sid not in ('eye',))
        im=erase_boxes(im,BOX[name]); cv2.imwrite(f'sobo2/final/{sid}.jpg',im,[cv2.IMWRITE_JPEG_QUALITY,90])
        h,w=im.shape[:2]; ov=cv2.resize(im,(1400,int(h*1400/w)),interpolation=cv2.INTER_AREA); H,W=ov.shape[:2]
        for i,(la,uk,x,y) in enumerate(items,1):
            cx,cy=int(x*W/100),int(y*H/100); cv2.circle(ov,(cx,cy),9,(255,255,255),-1); cv2.circle(ov,(cx,cy),9,(0,0,220),2); cv2.putText(ov,str(i),(cx+11,cy+5),cv2.FONT_HERSHEY_SIMPLEX,0.55,(0,0,220),2,cv2.LINE_AA)
        leg=255*np.ones((H,420,3),np.uint8)
        for i,(la,uk,x,y) in enumerate(items,1): cv2.putText(leg,f'{i} {la}',(6,20+i*22),cv2.FONT_HERSHEY_SIMPLEX,0.45,(0,0,0),1,cv2.LINE_AA)
        cv2.imwrite(f'sobo2/ov/{sid}.png',cv2.hconcat([ov,leg])); print(sid,w,h,len(items))
    json.dump({name:{'id':v[0],'title':v[1],'cat':v[2],'items':v[3]} for name,v in SETS.items()},open('sobo2/new_sets.json','w'),ensure_ascii=False,indent=1)
