"""Individual portrait sculpts + scene-specific wardrobe. Run with Blender -b -t 1 -P."""
import bpy, math, json, os
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
SOURCE=HERE.parent/'miniature-production/build.py'
source=SOURCE.read_text()
# Shared modeling primitives only, not the old head or hair geometry.
exec(source[:source.index('# Sculpted ring surface:')])
OUT=HERE.parents[1]/'public/models/twin-peaks'
PROFILES={
'Dale Cooper':dict(jaw=1.06,cheek=.98,nose=1.18,eyes=.064,mouth=.043,chin=1.02,hair=(.023,.017,.015),skin=(.57,.355,.257),brow=.0058),
'Audrey Horne':dict(jaw=.96,cheek=1.01,nose=.78,eyes=.066,mouth=.043,chin=.91,hair=(.032,.019,.018),skin=(.64,.401,.31),brow=.005),
'Laura Palmer':dict(jaw=.96,cheek=1.04,nose=.84,eyes=.066,mouth=.049,chin=.96,hair=(.32,.175,.058),skin=(.67,.433,.328),brow=.0037),
'Harry Truman':dict(jaw=1.07,cheek=1.06,nose=1.05,eyes=.065,mouth=.049,chin=.99,hair=(.047,.027,.019),skin=(.51,.30,.20),brow=.0055),
'The Giant':dict(jaw=.87,cheek=.87,nose=1.40,eyes=.064,mouth=.043,chin=1.16,hair=(.135,.08,.042),skin=(.56,.355,.25),brow=.0038),
'Pete Martell':dict(jaw=1.12,cheek=1.13,nose=1.21,eyes=.065,mouth=.050,chin=.92,hair=(.20,.17,.135),skin=(.56,.33,.21),brow=.006),
'Leland Palmer':dict(jaw=1.04,cheek=1.04,nose=1.07,eyes=.062,mouth=.048,chin=.97,hair=(.55,.53,.46),skin=(.58,.36,.275),brow=.0046),
'BOB':dict(jaw=1.08,cheek=1.05,nose=1.25,eyes=.062,mouth=.054,chin=1.06,hair=(.13,.125,.115),skin=(.49,.29,.19),brow=.007)}
def gauss(v,c,w):return math.exp(-((v-c)/w)**2)
def ribbon(name,points,widths,mat,bone='head'):
 # Flat tapered lock; follows the scalp instead of round spaghetti strands.
 v=[]
 for i,(x,y,z) in enumerate(points):
  w=widths[i] if isinstance(widths,list) else widths
  v.extend([(x-w,y,z),(x,y-.003,z+.001),(x+w,y,z)])
 f=[]
 for i in range(len(points)-1):
  for j in range(2):a=i*3+j;f.append((a,a+1,a+4,a+3))
 o=mesh(name,v,f,mat,bone);s=o.modifiers.new('Soft strand edges','SUBSURF');s.levels=1
 return o

def sculpt_head(kind):
 c=PROFILES[kind];female=kind in ['Laura Palmer','Audrey Horne'];aged=kind in ['The Giant','Pete Martell','Leland Palmer','BOB']
 sk=material(kind+' • complexion',c['skin'],.76)
 lips=material(kind+' • natural lip paint',(.27,.048,.050) if kind=='Audrey Horne' else (.39,.16,.135) if female else (.36,.185,.14),.72)
 crease=material(kind+' • soft skin creases',tuple(v*.72 for v in c['skin']),.85)
 hm=material(kind+' • individual hair',c['hair'],.72)
 hi=material(kind+' • hair glints',tuple(v*1.24+.006 for v in c['hair']),.73)
 brows=material(kind+' • eyebrows',(.048,.029,.023) if female else tuple(v*.58 for v in c['hair']),.9)
 eye_white=material(kind+' • muted sclera',(.43,.43,.39),.46)
 iris_m=material(kind+' • iris',(.07,.13,.14) if female or kind=='Dale Cooper' else (.105,.10,.068),.48)
 # Anatomical profiles: under-chin, jaw angle, malar bone, temple, cranium.
 profile=[(1.60,.033,.04,.027),(1.62,.065*c['chin'],.078,.008),(1.65,.098*c['jaw'],.100,.008),(1.69,.12*c['jaw'],.11,.012),(1.73,.13*c['jaw'],.117,.015),(1.78,.139*c['cheek'],.128,.018),(1.82,.141*c['cheek'],.133,.02),(1.87,.132,.133,.025),(1.92,.13,.135,.027),(1.97,.122,.130,.035),(2.01,.095,.10,.032),(2.04,.044,.046,.03),(2.05,.003,.003,.03)]
 def ring(z):
  for a,b in zip(profile,profile[1:]):
   if a[0]<=z<=b[0]:
    t=(z-a[0])/(b[0]-a[0]);return [a[i]*(1-t)+b[i]*t for i in range(1,4)]
  return profile[0][1:] if z<1.6 else profile[-1][1:]
 def detail(x,z):
  n=c['nose'];e=c['eyes']
  nose=-.043*n*gauss(x,0,.023)*gauss(z,1.809,.073)-.046*n*gauss(x,0,.028)*gauss(z,1.773,.019)
  wings=-.014*n*(gauss(x,.025,.013)+gauss(x,-.025,.013))*gauss(z,1.765,.013)
  sockets=.015*(gauss(x,e,.037)+gauss(x,-e,.037))*gauss(z,1.837,.022)
  brow=-.012*(gauss(x,e,.042)+gauss(x,-e,.042))*gauss(z,1.869,.02)
  cheeks=-.012*(gauss(x,.096,.036)+gauss(x,-.096,.036))*gauss(z,1.79,.026)
  hollow=.008*(gauss(x,.107,.024)+gauss(x,-.107,.024))*gauss(z,1.741,.025)
  philtrum=.003*gauss(x,0,.008)*gauss(z,1.743,.012)
  muzzle=-.009*gauss(x,0,.057)*gauss(z,1.723,.027)
  chin=-.009*gauss(x,0,.056)*gauss(z,1.66,.02)+.004*gauss(x,0,.057)*gauss(z,1.69,.010)
  return nose+wings+sockets+brow+cheeks+hollow+philtrum+muzzle+chin
 def surface(x,z):
  rx,ry,cy=ring(z);co=math.sqrt(max(.001,1-(x/rx)**2));return cy-ry*co+detail(x,z)*co**8
 rings=[]
 for a,b in zip(profile,profile[1:]):
  for i in range(7):rings.append(tuple(a[j]+(b[j]-a[j])*i/7 for j in range(4)))
 rings.append(profile[-1]);head=loft(kind+' • unique facial sculpt',rings,sk,'head',96,detail)
 # Vertex-painted complexion exports to glTF, including a subtle cheek flush.
 color=head.data.color_attributes.new(name='Complexion',type='FLOAT_COLOR',domain='POINT')
 for v in head.data.vertices:
  x,y,z=v.co;front=max(0,min(1,-y*8));flush=(gauss(x,.096,.035)+gauss(x,-.096,.035))*gauss(z,1.785,.025)*front
  color.data[v.index].color=(c['skin'][0],c['skin'][1]*(.98-flush*.14),c['skin'][2]*(.96-flush*.13),1)
 n=sk.node_tree.nodes.new('ShaderNodeVertexColor');n.layer_name='Complexion'
 sk.node_tree.links.new(n.outputs['Color'],sk.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
 for side in [-1,1]:
  x=side*c['eyes'];z=1.837;w=.033 if not female else .036;up=.010 if aged else .012;down=.0075
  # Almond surface interpolates from skin rim to eyeball, preventing floating goggle eyes.
  v=[(x,surface(x,z)-.009,z)];rim=[]
  for j in range(48):
   t=j*2*math.pi/48;xx=x+w*math.cos(t);zz=z+(up if math.sin(t)>0 else down)*math.sin(t)+side*(xx-x)*.035
   rim.append((xx,surface(xx,zz)-.003,zz))
  mesh('Inset almond eye '+str(side),v+rim,[(0,j+1,(j+1)%48+1) for j in range(48)],eye_white,'head')
  yy=surface(x,z)-.011
  ell('Colored iris '+str(side),(x,yy,z),(.0095,.0025,.010),iris_m,'head');ell('Deep pupil '+str(side),(x,yy-.0026,z),(.0042,.001,.005),pupil,'head');ell('Eye glint '+str(side),(x-.002,yy-.0038,z+.003),(.0014,.0007,.0014),white,'head')
  for upper in [True,False]:
   points=[]
   for j in range(17):
    t=(math.pi*j/16) if upper else (math.pi+math.pi*j/16);xx=x+w*math.cos(t);zz=z+(up if upper else down)*math.sin(t)+side*(xx-x)*.035
    points.append((xx,surface(xx,zz)-.0035,zz))
   curve(('Upper eyelid ' if upper else 'Lower eyelid ')+str(side),points,.0014 if upper else .001, brows if upper and female else crease,'head')
  # A tapered eyebrow strip, arched for Audrey and straighter for Cooper.
  v=[]
  for j in range(17):
   t=j/16;xx=side*(.027+t*.078);zz=1.867+(.016 if kind=='Audrey Horne' else .009)*math.sin(t*math.pi)-t*.005
   width=c['brow']*(.65+.35*math.sin(t*math.pi))*(1-.65*t)
   for dz in [-width,width]:v.append((xx,surface(xx,zz+dz)-.002,zz+dz))
  ob=mesh('Tapered individual brow '+str(side),v,[(j*2,j*2+1,j*2+3,j*2+2) for j in range(16)],brows,'head');ob.data.materials[0].use_backface_culling=False
  # Ears have a skin-coloured helix; the inner recess is small, never a pink disk.
  ell('Ear pinna '+str(side),(side*.143,.017,1.802),(.022,.018,.040),sk,'head')
  curve('Ear helix '+str(side),[(side*.148,-.001,1.831),(side*.159,-.003,1.821),(side*.16,-.004,1.795),(side*.149,-.002,1.773)],.003,sk,'head')
  ell('Ear concha '+str(side),(side*.15,-.002,1.806),(.006,.003,.014),crease,'head')
  xx=side*.021;zz=1.76;ell('Recessed nostril '+str(side),(xx,surface(xx,zz)-.001,zz),(.0055,.0015,.0025),crease,'head')
  if aged:
   for dz in [0,-.009]:curve('Under-eye fold',[(x-side*.025,surface(x-side*.025,1.818+dz)-.001,1.818+dz),(x,surface(x,1.813+dz)-.001,1.813+dz),(x+side*.029,surface(x+side*.029,1.821+dz)-.001,1.821+dz)],.0008,crease,'head')
   curve('Nasolabial plane',[(side*.034,surface(side*.034,1.764)-.001,1.764),(side*.052,surface(side*.052,1.741)-.001,1.741),(side*.056,surface(side*.056,1.714)-.001,1.714)],.0008,crease,'head')
 # Surface lips, not raised tubes. Distinct Cupid's bow and gentle mouth asymmetry.
 w=c['mouth'];v=[]
 for j in range(41):
  x=-w+2*w*j/40;t=x/w;fall=max(0,1-t*t);seam=1.716+.002*abs(t)
  top=seam+fall*(.005+.003*gauss(abs(t),.3,.2))*(1.25 if female else .7)
  bottom=seam-fall*(.008 if female else .005)
  for z in [bottom,seam,top]:v.append((x,surface(x,z)-.002-fall*.002,z))
 mesh('Sculpted lip planes',v,[(j*3+k,j*3+k+1,j*3+k+4,j*3+k+3) for j in range(40) for k in range(2)],lips,'head')
 curve('Mouth line',[(x,surface(x,1.716+.002*abs(x/w))-.0044,1.716+.002*abs(x/w)) for x in [-w+i*2*w/20 for i in range(21)]],.0008,crease,'head')
 if kind=='Audrey Horne':ell('Audrey beauty mark',(-.07,surface(-.07,1.744)-.001,1.744),(.0018,.001,.0018),brows,'head')
 # Scalp cap follows a variable, receding hairline instead of a horizontal helmet.
 if kind!='The Giant':
  v=[];f=[];N=80;M=24
  for k in range(M+1):
   for j in range(N):
    t=2*math.pi*j/N;front=max(0,math.cos(t));line=1.82+.13*front
    if kind=='Dale Cooper':line+=.016*math.sin(t*2)**2-.013*gauss(math.sin(t),-.2,.18)*front
    if female:line=1.77+.18*front
    if kind=='Leland Palmer':line+=.02*front
    z=line+(2.069-line)*math.sin(k/M*math.pi/2);rx,ry,cy=ring(min(z,2.048));bulge=.012*math.sin(k/M*math.pi)
    v.append(((rx+.006+bulge)*math.sin(t),cy-(ry+.007+bulge)*math.cos(t),z))
  for k in range(M):
   for j in range(N):a=k*N+j;b=k*N+(j+1)%N;f.append((a,b,b+N,a+N))
  mesh('Contoured hairline and crown',v,f,hm,'head')
  # Fine grooves remain ON the scalp, following its exact parametric surface.
  for j in range(26):
   theta=-1.45+j/25*2.9;pts=[]
   for k in range(19):
    u=.025+k/18*.9;t=theta+(.15*math.sin(u*math.pi));front=max(0,math.cos(t));line=1.82+.13*front
    if kind=='Dale Cooper':line+=.016*math.sin(t*2)**2-.013*gauss(math.sin(t),-.2,.18)*front
    if female:line=1.77+.18*front
    if kind=='Leland Palmer':line+=.02*front
    z=line+(2.069-line)*math.sin(u*math.pi/2);rx,ry,cy=ring(min(z,2.048));bulge=.012*math.sin(u*math.pi)
    pts.append(((rx+.007+bulge)*math.sin(t),cy-(ry+.008+bulge)*math.cos(t),z+.0007))
   curve('Combed scalp groove',pts,.0013,hi if j%3==0 else hm,'head')
 if female or kind=='BOB':
  long=kind in ['Laura Palmer','BOB'];end=1.47 if long else 1.70
  # One continuous bob / long-hair mantle, with low-relief locks.
  v=[];f=[];N=72;M=28
  def mantle(t,u):
   z=2.012-u*(2.012-end);rx=.122+.035*math.sin(u*math.pi*.75);ry=.12+.027*math.sin(u*math.pi)
   if not long:rx-=.013*u**4
   wave=.004*math.sin(t*15+u*8)*(u if long else .35)
   return ((rx+wave)*math.sin(t),.035-(ry+wave)*math.cos(t),z+.012*math.sin(t*3)*u**5)
  for k in range(M+1):
   for j in range(N+1):v.append(mantle(.82+j/N*(2*math.pi-1.64),k/M))
  for k in range(M):
   for j in range(N):a=k*(N+1)+j;f.append((a,a+1,a+N+2,a+N+1))
  o=mesh('Continuous sculpted hair mantle',v,f,hm,'head');mod=o.modifiers.new('Hair volume','SOLIDIFY');mod.thickness=.012
  for j in range(30):
   t=.85+j/29*(2*math.pi-1.7);pts=[]
   for k in range(19):
    x,y,z=mantle(t,.08+k/18*.9);pts.append((x*1.006,.035+(y-.035)*1.006,z))
   curve('Fine hair mantle groove',pts,.0014,hi if j%3==0 else hm,'head')
  # Soft asymmetrical fringe hugs the forehead, with no detached ribbons.
  v=[];f=[];N=48;M=10
  for k in range(M+1):
   u=k/M
   for j in range(N+1):
    x=(-.124+j/N*.248)*(1-.12*u);bottom=1.946-.024*gauss(x,-.053,.055)+.015*x/.124
    z=bottom+(2.007-bottom)*u;y=surface(x,z)-.008-.003*math.sin(u*math.pi)
    v.append((x,y,z))
  for k in range(M):
   for j in range(N):a=k*(N+1)+j;f.append((a,a+1,a+N+2,a+N+1))
  mesh('Sculpted side parted fringe',v,f,hm,'head')
 if kind=='The Giant':
  for side in [-1,1]:
   for j in range(4):curve('Sparse temple hair',[(side*.129,.011+j*.014,1.92),(side*.139,.015+j*.014,1.86),(side*.138,.02+j*.014,1.82)],.002,hm,'head')
 if kind=='BOB':
  for side in [-1,1]:
   for j in range(7):curve('Stubble',[(side*(.07+j*.008),surface(side*(.07+j*.008),1.71)-.001,1.71),(side*(.07+j*.008),surface(side*(.07+j*.008),1.692)-.001,1.692)],.0008,hm,'head')
 return sk

# Preserve the tested body skinning and animation infrastructure, replace portrait construction.
fn=source[source.index('def make_character(kind):'):source.index('\ncharacters={}')] 
a=fn.index(' headz=0');b=fn.index(" rod('Neck'",a)
fn=fn[:a]+" sk=sculpt_head(kind)\n"+fn[b:]
a=fn.index(' # Swept crown');b=fn.index(' if sheriff:',a);fn=fn[:a]+fn[b:]
a=fn.index('  # Bob cuts');b=fn.index(" if kind in ['Leland Palmer','BOB']:",a);fn=fn[:a]+fn[b:]
# The old aged-character branch would recolor the rebuilt face and add primitive hair.
a=fn.index(" if kind in ['Leland Palmer','BOB']:");b=fn.index(" if kind=='Pete Martell':",a);fn=fn[:a]+fn[b:]
# Place wardrobe correction BEFORE binding, so every new detail is skinned.
pos=fn.index(' # Basic deform rig')
fn=fn[:pos]+" wardrobe(kind,sk)\n"+fn[pos:]
# Body complexion must match the individual head.
fn=fn.replace(".068,skin,bone='neck'",".058,sk,bone='neck'").replace(",skin,handbone",",sk,handbone")
exec(fn)

def wardrobe(kind,sk):
 female=kind in ['Laura Palmer','Audrey Horne']
 burgundy=material('Audrey • burgundy fine-knit',(.20,.028,.041),.92)
 plaid=material('Audrey • warm plaid wool',(.26,.16,.12),.93)
 denim=material('BOB • washed denim',(.095,.17,.24),.91)
 taupe=material('Giant • olive taupe jacket',(.18,.16,.12),.92)
 greyshirt=material('Giant • ivory shirt',(.59,.52,.40),.92)
 woolline=material('Woven seam',(.40,.26,.17),.94)
 remove=[]
 for o in list(group.objects):
  n=o.name
  if kind in ['Leland Palmer','BOB','The Giant'] and n.startswith(('Notched lapel','Black silk tie','Tie knot','Hip pocket','Jacket button','Pocket welt')):remove.append(o);continue
  if kind=='Audrey Horne' and n.startswith(('Skirt woven check','Ivory shirt','White cuff')):remove.append(o);continue
  if kind=='Laura Palmer' and n.startswith(('Ivory shirt','White cuff')):remove.append(o);continue
  if kind=='Harry Truman' and n.startswith(('Notched lapel','Tie knot','Black silk tie','Ivory shirt')):remove.append(o);continue
  if o.type=='MESH' and n.startswith(('Tailored jacket','Continuous tailored sleeve')):
   mat=burgundy if kind=='Audrey Horne' else white if kind=='Leland Palmer' else denim if kind=='BOB' else taupe if kind=='The Giant' else None
   if mat:o.data.materials.clear();o.data.materials.append(mat)
  if o.type=='MESH' and n.startswith('Point collar') and kind in ['BOB','Harry Truman']:
   o.data.materials.clear();o.data.materials.append(denim if kind=='BOB' else tan)
  if o.type=='MESH' and n.startswith('Ivory shirt') and kind=='BOB':o.data.materials.clear();o.data.materials.append(sk)
  if o.type=='MESH' and n.startswith('Continuous pressed trousers') and kind=='BOB':o.data.materials.clear();o.data.materials.append(denim)
  if o.type=='MESH' and n.startswith('Ivory shirt') and kind=='The Giant':o.data.materials.clear();o.data.materials.append(greyshirt)
  if kind=='Audrey Horne' and n.startswith('Tailored jacket'):
   for v in o.data.vertices:
    if v.co.z<1.06:
     weight=max(0,min(1,(1.06-v.co.z)/.06));v.co.y=.022+(v.co.y-.022)*(1+.36*weight)
  if kind=='Audrey Horne' and n.startswith('Audrey pleated skirt'):remove.append(o)
  if female and n.startswith(('Continuous pressed trousers','Polished Oxford','Oxford sole','Shoe lace')):remove.append(o)
 for o in remove:bpy.data.objects.remove(o,do_unlink=True)
 if female:
  for side,suf in [(1,'L'),(-1,'R')]:
   # Bare calves and small shoes: no men's suit trousers beneath the skirt.
   o=loft('Tapered stocking calf '+suf,[(.14,.039,.044,.014),(.25,.044,.05,.016),(.39,.057,.059,.023),(.57,.06,.064,.025)],sk if kind=='Audrey Horne' else black,'shin.'+suf,32);o.location.x=side*.105
   ell('Low heel shoe '+suf,(side*.105,-.048,.085),(.051,.114,.045),white if kind=='Audrey Horne' else leather,'foot.'+suf)
   if kind=='Audrey Horne':
    box('Black saddle shoe band '+suf,(side*.105,-.035,.118),(.095,.073,.022),leather,.015,'foot.'+suf)
   box('Low heel '+suf,(side*.105,.033,.044),(.077,.065,.036),leather,.009,'foot.'+suf)
 if kind=='Audrey Horne':
  rings=[(.55,.205,.154,.02),(.70,.193,.144,.02),(.88,.169,.127,.02),(1.04,.156,.116,.02)]
  o=loft('Audrey • individually pleated tartan skirt',rings,plaid,'root',96)
  for v in o.data.vertices:
   a=math.atan2(v.co.x,v.co.y-.02);f=1+.028*math.cos(a*24);v.co.x*=f;v.co.y=.02+(v.co.y-.02)*f
  for z,rx,ry in [(.59,.207,.153),(.66,.201,.151),(.78,.186,.139),(.86,.174,.132),(.97,.164,.124)]:
   curve('Tartan horizontal',[(rx*math.sin(j*math.pi/32),.02-ry*math.cos(j*math.pi/32),z) for j in range(65)],.0021,black,'root')
  for j in range(24):
   a=j*math.pi/12;curve('Tartan vertical',[(rx*math.sin(a)*1.017,.02-ry*math.cos(a)*1.017,z) for z,rx,ry,cy in rings],.0023,woolline,'root')
  # Crew neckline follows shoulders, with exposed neck instead of white shirt.
  curve('Ribbed crew neck',[(-.072,-.048,1.5),(-.047,-.087,1.488),(0,-.094,1.48),(.047,-.087,1.488),(.072,-.048,1.5)],.008,burgundy)
 if kind=='Laura Palmer':
  curve('Black dress neckline',[(-.14,-.06,1.49),(-.08,-.092,1.465),(0,-.105,1.43),(.08,-.092,1.465),(.14,-.06,1.49)],.006,black)
  # Fine necklace and small pendant seen with the black dream dress interpretation.
  curve('Laura necklace',[(-.05,-.079,1.51),(0,-.119,1.465),(.05,-.079,1.51)],.0014,gold)
 if kind in ['BOB','Leland Palmer','Harry Truman']:
  cloth=denim if kind=='BOB' else tan if kind=='Harry Truman' else white
  patch('Shirt center placket',[(-.012,-.146,1.44),(.012,-.146,1.44),(.012,-.13,1.02),(-.012,-.13,1.02)],cloth)
  for z in [1.38,1.29,1.20,1.11]:ell('Shirt button',(0,-.15 if z>1.25 else -.133,z),(.004,.002,.004),cream)
  for side in [-1,1]:
   patch('Flap chest pocket',[(side*.055,-.143,1.35),(side*.155,-.111,1.35),(side*.155,-.111,1.26),(side*.055,-.143,1.26)],cloth)
   curve('Pocket top stitch',[(side*.055,-.147,1.344),(side*.15,-.118,1.344)],.0013,woolline)
 if kind=='Harry Truman':
  box('Sheriff duty belt',(0,-.001,1.01),(.365,.235,.038),leather,.012)
  box('Brass buckle',(0,-.124,1.01),(.044,.012,.03),gold,.003)
  for side in [-1,1]:box('Shoulder epaulette',(side*.181,.002,1.476),(.091,.11,.014),tan,.006)
 if kind=='Dale Cooper':
  # Lapel pin and white pocket edge remain legible at portrait distance.
  box('FBI lapel pin',(-.097,-.143,1.41),(.013,.005,.021),gold,.002)
  patch('White pocket square',[(-.152,-.135,1.347),(-.09,-.146,1.347),(-.10,-.146,1.364),(-.12,-.142,1.357),(-.144,-.137,1.367)],white)
 # Slim the sculpt to a less toy-like head proportion; preserve neck joint coordinates.
 for o in list(group.objects):
  if o.get('bind_bone')=='head':
   if o.type=='MESH':
    for v in o.data.vertices:
     co=o.matrix_local@v.co;co.x*=1.08 if kind=='The Giant' else .91;co.y*=.94;co.z=1.61+(co.z-1.61)*(.76 if kind=='The Giant' else .94);v.co=o.matrix_local.inverted()@co
   elif o.type=='CURVE':
    for sp in o.data.splines:
     for v in sp.bezier_points:v.co.x*=1.08 if kind=='The Giant' else .91;v.co.y*=.94;v.co.z=1.61+(v.co.z-1.61)*(.76 if kind=='The Giant' else .94)
 # Giant's body is tall and spare, Pete's is stockier.
 if kind=='Pete Martell':ROOT.scale=(1.05,1.04,.96)
 if kind=='The Giant':ROOT.scale=(.80,.86,1.28)

characters={}
for kind in PROFILES:
 col,root,rig=make_character(kind);characters[kind]=(col,root,rig)
 # Export with material batching: one skinned object per material drastically reduces draw calls.
 meshes=[o for o in col.objects if o.type=='MESH'];bins={}
 for o in meshes:
  if o.active_material and 'complexion' in o.active_material.name and not o.data.color_attributes.get('Complexion'):
   color=o.data.color_attributes.new(name='Complexion',type='FLOAT_COLOR',domain='POINT')
   for datum in color.data:datum.color=(*PROFILES[kind]['skin'],1)
 for o in meshes:bins.setdefault(o.active_material.name if o.active_material else 'none',[]).append(o)
 for mat,objects in bins.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  if len(objects)>1:bpy.ops.object.join()
  bpy.context.object.name=kind+' • '+mat
  bpy.context.object.parent=rig
 bpy.ops.object.select_all(action='DESELECT')
 for o in col.objects:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(OUT/(kind.lower().replace(' ','-')+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_force_sampling=True,export_apply=False)
 col.hide_render=True
 print('REBUILT',kind,flush=True)
# Neutral portrait studio; editable sources and actual renders.
ROOT=None;CHAR=None;group=None
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=16;s.cycles.use_denoising=False;s.cycles.max_bounces=4;s.render.threads_mode='FIXED';s.render.threads=1
s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.115,.14,.13,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.45
s.view_settings.view_transform='AgX'
def area(name,pos,power,color,size):
 d=bpy.data.lights.new(name,'AREA');d.energy=power;d.color=color;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,1.2))-o.location).to_track_quat('-Z','Y').to_euler()
area('Portrait softbox',(-3,-4,5),370,(1,.88,.74),4);area('Soft cool fill',(3,-2,3),200,(.78,.87,1),3);area('Hair rim',(1,3,4),420,(1,.7,.4),3)
bpy.ops.object.camera_add();cam=bpy.context.object;s.camera=cam;cam.data.type='ORTHO';s.render.resolution_percentage=100
s.frame_set(1);bpy.context.preferences.filepaths.save_version=0
# Lay out an editable lineup in the .blend file, retain export origins in meshes.
for i,(kind,(col,root,rig)) in enumerate(characters.items()):root.location.x=(i-3.5)*.85;col.hide_render=False
cam.location=(0,-11,3);cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=7.8
s.render.resolution_x=1400;s.render.resolution_y=700;s.render.filepath=str(HERE/'previews/character-lineup.png')
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'twin-peaks-character-rebuild.blend'),compress=True)
bpy.ops.render.render(write_still=True)
for kind,(col,root,rig) in characters.items():root.location.x=0;col.hide_render=True
for kind in ['Dale Cooper','Audrey Horne','Laura Palmer','BOB']:
 col,root,rig=characters[kind];col.hide_render=False
 cam.location=(.38,-4,2.0);target=Vector((0,0,1.65));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=.88
 s.render.resolution_x=640;s.render.resolution_y=800;s.render.filepath=str(HERE/'previews'/f'{kind.lower().replace(" ","-")}.png');bpy.ops.render.render(write_still=True);col.hide_render=True
print('FINISHED',flush=True)
