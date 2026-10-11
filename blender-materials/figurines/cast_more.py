# The rest of the Twin Peaks figurine cast. exec'd from figurine.py (shares Kit, base_figure, HEAD, HR, PAL, POSES).
V = Vector


# ---------- costume helpers ----------
def lapels(k, jacket, shirt='shirt', tie=None, bow=False, open_collar=False):
    k.plate([(-.05, -.088, .64), (.05, -.088, .64), (.0, -.088, .5 if not open_collar else .56)], .012, shirt, prio=3)
    if tie:
        k.plate([(-.013, -.1, .625), (.013, -.1, .625), (.017, -.1, .53), (0, -.1, .5), (-.017, -.1, .53)], .01, tie, prio=5)
    if bow:
        for sx in (-1, 1):
            k.plate([(0, -.1, .63), (sx * .035, -.1, .645), (sx * .035, -.1, .615)], .012, bow, prio=5)
    for sx in (-1, 1):
        k.plate([(sx * .052, -.092, .645), (sx * .1, -.088, .62), (sx * .04, -.092, .49), (sx * .005, -.094, .49)], .014, jacket, prio=4)
        k.plate([(sx * .012, -.098, .655), (sx * .055, -.094, .655), (sx * .04, -.098, .62)], .012, shirt, prio=4)


def buttons(k, col, xs=(0,), zs=(.56, .5, .44), y=-.095, r=.009):
    for x in xs:
        for z in zs:
            k.ellip((x, y, z), (r, r * .6, r), col, prio=6)


def badge(k, x=.07, z=.58):
    pts = []
    for i in range(12):
        a = i / 12 * 6.283 + 1.5708; rr = .026 if i % 2 == 0 else .012
        pts.append((x + math.cos(a) * rr, -.098, z + math.sin(a) * rr))
    k.plate(pts, .008, 'gold', prio=6)


def belt(k, col='leather', buckle='gold', z=.405):
    k.cone((0, 0, z - .015), (0, 0, z + .015), .138, .138, col, prio=4, caps=False)
    k.rbox((0, -.135, z), (.02, .006, .016), .005, buckle, prio=6)


def collar_v(k, col):
    k.plate([(-.04, -.093, .64), (.04, -.093, .64), (0, -.093, .58)], .008, col, prio=3)


def pocket_flaps(k, col):
    for sx in (-1, 1):
        k.rbox((sx * .06, -.092, .56), (.03, .006, .022), .006, col, prio=4)


def apron(k):
    k.plate([(-.1, -.1, .44), (.1, -.1, .44), (.12, -.15, .22), (-.12, -.15, .22)], .008, 'apron', prio=5)


def glasses(k, col='glass_rim', big=False):
    r = .036 if big else .028
    for sx in (-1, 1):
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=.006, location=HEAD + V((sx * .052, -HR * .93, .0)), rotation=(math.pi / 2, 0, 0))
        o = bpy.context.object; k.parts.append((o, col, 7))
    k.cone(HEAD + V((-.022, -HR * .95, .004)), HEAD + V((.022, -HR * .95, .004)), .005, .005, col, prio=7, caps=False)


def eyepatch(k, side=1):
    k.ellip(HEAD + V((side * .052, -HR * .9, .0)), (.04, .02, .035), 'eyepatch', prio=7)


def hat_sheriff(k, col='sheriff_brown', band='leather'):
    k.ellip(HEAD + V((0, 0, .13)), (HR * 1.6, HR * 1.6, .015), col, prio=6)
    k.cone(HEAD + V((0, 0, .12)), HEAD + V((0, 0, .21)), HR * .95, HR * .85, col, prio=6)
    k.cone(HEAD + V((0, 0, .13)), HEAD + V((0, 0, .155)), HR * .97, HR * .97, band, prio=7, caps=False)


def beanie(k, col):
    k.ellip(HEAD + V((0, .005, .07)), (HR * 1.07, HR * 1.05, HR * .8), col, prio=5)
    k.cone(HEAD + V((0, .005, .045)), HEAD + V((0, .005, .075)), HR * 1.07, HR * 1.07, col, prio=6, caps=False)


def hearing_aid(k):
    k.ellip(HEAD + V((HR * 1.02, -.01, -.005)), (.018, .02, .03), 'sweater_cream', prio=7)


# ---------- hair helpers ----------
def hair_cap(k, col, front=.045, back=.012, low=.84):
    k.ellip(HEAD + V((0, back, front)), (HR * 1.05, HR * 1.02, HR * low), col, prio=3)


def hair_short(k, col, quiff=.0, part=None):
    hair_cap(k, col)
    k.ellip(HEAD + V((-.012, -.045, .085 + quiff)), (HR * .9, HR * .72, HR * (.5 + quiff * 3)), col, prio=4)
    for sx in (-1, 1):
        k.ellip(HEAD + V((sx * HR * .92, .03, .0)), (.032, .09, .075), col, prio=4)


def hair_long(k, col, length=.55, fringe=True):
    k.ellip(HEAD + V((0, .025, .05)), (HR * 1.08, HR * 1.04, HR * .85), col, prio=3)
    for sx in (-1, 1):
        k.cone(HEAD + V((sx * HR * .9, .03, 0)), (sx * .14, .04, length), .055, .045, col, prio=3)
        k.ellip((sx * .145, .03, length - .01), (.05, .045, .035), col, prio=3)
    k.ellip(HEAD + V((0, .1, -.12)), (HR * .9, HR * .45, HR * 1.0), col, prio=3)
    if fringe:
        k.ellip(HEAD + V((.04, -.09, .11)), (HR * .62, HR * .34, HR * .3), col, prio=4)


def hair_bob(k, col, curls=False):
    k.ellip(HEAD + V((0, .02, .045)), (HR * 1.12, HR * 1.08, HR * .88), col, prio=3)
    for sx in (-1, 1):
        k.ellip(HEAD + V((sx * HR * .95, .02, -.07)), (.05, .08, .09), col, prio=3)
    k.ellip(HEAD + V((-.03, -.085, .1)), (HR * .7, HR * .36, HR * .34), col, prio=4)
    if curls:
        for i in range(9):
            a = i / 9 * math.pi * 1.2 - .1
            k.ellip(HEAD + V((math.cos(a) * HR * 1.05, .03, math.sin(a) * HR * .8 - .02)), (.04, .04, .04), col, prio=4)


def hair_bouffant(k, col):
    k.ellip(HEAD + V((0, .02, .09)), (HR * 1.25, HR * 1.18, HR * 1.0), col, prio=3)
    for sx in (-1, 1):
        k.ellip(HEAD + V((sx * HR * 1.05, .02, -.08)), (.06, .07, .08), col, prio=3)


def hair_ponytail(k, col):
    hair_cap(k, col, low=.8)
    k.ellip(HEAD + V((0, -.07, .1)), (HR * .8, HR * .4, HR * .3), col, prio=4)
    k.cone(HEAD + V((0, HR * .95, .06)), HEAD + V((0, HR * 1.3, -.12)), .045, .03, col, prio=3)


def hair_receding(k, col):
    for sx in (-1, 1):
        k.ellip(HEAD + V((sx * HR * .9, .04, -.01)), (.045, .1, .07), col, prio=4)
    k.ellip(HEAD + V((0, HR * .7, .0)), (HR * .9, .06, .08), col, prio=4)


def hair_braid(k, col):
    hair_long(k, col, length=.5, fringe=False)
    k.cone(HEAD + V((0, HR * 1.0, -.05)), (0, .12, .4), .03, .02, col, prio=4)


def hair_wild(k, col):
    k.ellip(HEAD + V((0, .03, .05)), (HR * 1.15, HR * 1.1, HR * .9), col, prio=3)
    for sx in (-1, 1):
        k.cone(HEAD + V((sx * HR * .95, .02, 0)), (sx * .17, .05, .5), .07, .05, col, prio=3)
    k.ellip(HEAD + V((0, .1, -.13)), (HR * 1.0, HR * .5, HR * 1.05), col, prio=3)


def log_prop(k):
    k.cone((-.13, -.18, .46), (.13, -.18, .46), .055, .055, 'log', prio=5, caps=False)
    for sx in (-1, 1):
        k.ellip((sx * .132, -.18, .46), (.004, .052, .052), 'log_end', prio=6)


def bark_paint(co, n, key):
    if key == 'log' and int((co.x * 60) + math.sin(co.z * 200) * 2) % 3 == 0:
        return (.22, .12, .06)
    return None


# ---------- characters ----------
def audrey(k):
    base_figure(k, jacket='sweater_pink', trousers='skin', dress='plaid_red', legs='skirt', torso=.9, hands=.9, arms='hips', socks='sweater_cream')
    collar_v(k, 'shirt')
    hair_bob(k, 'dark_brown', curls=True)
    return None, dict(mouth='lips')


def truman(k):
    base_figure(k, jacket='sheriff_tan', trousers='sheriff_brown', shirt='sheriff_tan', hands=1.1, torso=1.08, arms='pocket')
    collar_v(k, 'sheriff_tan'); badge(k); belt(k); pocket_flaps(k, 'sheriff_brown')
    buttons(k, 'sheriff_brown', zs=(.62, .55, .48))
    hair_short(k, 'dark_brown')
    return None, dict(mouth='flat')


def log_lady(k):
    base_figure(k, jacket='plaid_red', trousers='skin', dress='olive', legs='skirt', torso=.92, arms='hold_front', socks='olive')
    collar_v(k, 'green_sweater')
    hair_bob(k, 'auburn'); glasses(k, big=True); log_prop(k)
    return bark_paint, dict(mouth='flat')


def giant(k):
    base_figure(k, jacket='giant_suit', trousers='giant_suit', torso=1.05, hands=1.3, arms='pocket')
    lapels(k, 'giant_suit', bow='bow_tie')
    hair_receding(k, 'white_hair')
    return None, dict(mouth='flat')


def man_from_another_place(k):
    base_figure(k, jacket='red_suit', trousers='red_suit', torso=1.0, arms='dance')
    lapels(k, 'red_suit', shirt='red_suit', tie='red_suit')
    hair_short(k, 'dark_brown', quiff=.01)
    return None, dict(mouth='smile')


def leland(k):
    base_figure(k, jacket='grey_suit', trousers='grey_suit', arms='dance')
    lapels(k, 'grey_suit', tie='navy')
    hair_short(k, 'white_hair', quiff=.015)
    return None, dict(mouth='smile')


def sarah(k):
    base_figure(k, jacket='lilac', trousers='skin', dress='lilac', legs='dress', torso=.9, hands=.9)
    collar_v(k, 'cream_dress')
    hair_bob(k, 'brown_hair', curls=True)
    return None, dict(mouth='o', eyes='open', cheeks=False)


def donna(k):
    base_figure(k, jacket='sweater_cream', trousers='navy', torso=.9, hands=.9)
    collar_v(k, 'shirt')
    hair_long(k, 'dark_brown', length=.6)
    return None, dict(mouth='lips')


def james(k):
    base_figure(k, jacket='leather', trousers='denim', shirt='shirt', torso=1.0, arms='pocket')
    collar_v(k, 'shirt'); buttons(k, 'silver', xs=(.05,), zs=(.6, .5))
    hair_short(k, 'brown_hair', quiff=.03)
    return None, dict(mouth='flat')


def shelly(k):
    base_figure(k, jacket='waitress_blue', trousers='skin', dress='waitress_blue', legs='skirt', torso=.9, hands=.9)
    collar_v(k, 'apron'); apron(k)
    hair_ponytail(k, 'brown_hair')
    return None, dict(mouth='smile')


def norma(k):
    base_figure(k, jacket='waitress_blue', trousers='skin', dress='waitress_blue', legs='skirt', torso=.92, hands=.9, arms='hips')
    collar_v(k, 'apron'); apron(k)
    hair_bob(k, 'auburn')
    return None, dict(mouth='smile')


def bobby(k):
    base_figure(k, jacket='leather', trousers='denim_dark', torso=1.02, arms='pocket')
    collar_v(k, 'shirt')
    hair_short(k, 'dark_brown', quiff=.04)
    return None, dict(mouth='grin', eyes='closed', cheeks=True)


def ben_horne(k):
    base_figure(k, jacket='navy', trousers='navy', torso=1.12)
    lapels(k, 'navy', tie='gold')
    hair_short(k, 'hair_black')
    k.cone(HEAD + V((.02, -HR * .95, -.065)), HEAD + V((.09, -HR * 1.3, -.08)), .012, .012, 'cigar', prio=7)
    return None, dict(mouth='flat')


def lucy(k):
    base_figure(k, jacket='mustard', trousers='skin', dress='purple', legs='skirt', torso=.88, hands=.9)
    collar_v(k, 'shirt'); buttons(k, 'apron', zs=(.6, .54, .48))
    hair_bob(k, 'brown_hair', curls=True)
    return None, dict(mouth='o')


def andy(k):
    base_figure(k, jacket='sheriff_tan', trousers='sheriff_brown', shirt='sheriff_tan', torso=1.0)
    collar_v(k, 'sheriff_tan'); badge(k); belt(k)
    hair_short(k, 'brown_hair')
    return None, dict(mouth='o', eyes='open', cheeks=True)


def hawk(k):
    base_figure(k, jacket='sheriff_tan', trousers='sheriff_brown', shirt='sheriff_tan', torso=1.04, arms='pocket')
    collar_v(k, 'sheriff_tan'); badge(k); belt(k)
    hair_braid(k, 'hair_black')
    return None, dict(mouth='flat')


def julee(k):
    base_figure(k, jacket='sequin', trousers='skin', dress='sequin', legs='gown', torso=.88, hands=.9, arms='mic')
    hair_bouffant(k, 'blonde')
    return (lambda co, n, key: (.95, .95, .98) if key == 'sequin' and int(co.x * 90 + co.z * 70) % 4 == 0 else None), dict(mouth='o')


def josie(k):
    base_figure(k, jacket='teal_dress', trousers='skin', dress='teal_dress', legs='dress', torso=.86, hands=.88)
    collar_v(k, 'skin')
    hair_long(k, 'hair_black', length=.58, fringe=False)
    return None, dict(mouth='lips')


def pete(k):
    base_figure(k, jacket='plaid_red', trousers='olive', torso=1.05)
    collar_v(k, 'shirt'); buttons(k, 'shirt', zs=(.6, .52, .44))
    beanie(k, 'mustard'); hair_receding(k, 'grey_hair')
    return (lambda co, n, key: (.2, .04, .03) if key == 'plaid_red' and (int(co.x * 40) + int(co.z * 40)) % 2 == 0 else None), dict(mouth='smile')


def gordon(k):
    base_figure(k, jacket='grey_suit', trousers='grey_suit', torso=1.08)
    lapels(k, 'grey_suit', tie='navy')
    hair_short(k, 'white_hair'); hearing_aid(k); glasses(k)
    return None, dict(mouth='o')


def albert(k):
    base_figure(k, jacket='suit_black', trousers='suit_black', torso=.95, arms='pocket')
    lapels(k, 'suit_black', tie='suit_black')
    hair_short(k, 'hair_black', quiff=.01); glasses(k)
    return None, dict(mouth='frown')


def mike(k):
    base_figure(k, jacket='olive', trousers='grey_suit', arms='one_arm')
    collar_v(k, 'shirt')
    hair_receding(k, 'grey_hair')
    return None, dict(mouth='flat', eyes='open', cheeks=False)


def windom(k):
    base_figure(k, jacket='suit_black', trousers='suit_black', torso=.95, arms='hips')
    lapels(k, 'suit_black', tie='gown_red')
    hair_wild(k, 'grey_hair')
    return None, dict(mouth='grin', eyes='open', cheeks=False)


def nadine(k):
    base_figure(k, jacket='sky_blue', trousers='skin', dress='sky_blue', legs='skirt', torso=.95)
    collar_v(k, 'shirt')
    hair_bob(k, 'red_hair'); eyepatch(k, 1)
    return None, dict(mouth='o')


FIGS.update({'audrey': audrey, 'truman': truman, 'log_lady': log_lady, 'giant': giant, 'man_from_another_place': man_from_another_place,
             'leland': leland, 'sarah': sarah, 'donna': donna, 'james': james, 'shelly': shelly, 'norma': norma, 'bobby': bobby,
             'ben_horne': ben_horne, 'lucy': lucy, 'andy': andy, 'hawk': hawk, 'julee': julee, 'josie': josie, 'pete': pete,
             'gordon': gordon, 'albert': albert, 'mike': mike, 'windom': windom, 'nadine': nadine})
