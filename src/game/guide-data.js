// Content for the crayon scrapbook guides (导览). Every string is bilingual { zh, en }.
// Facts are paraphrased from src/content/timeline.js / works.js; source ids (S1…S12) match
// src/content/sources.js, F-ids are guide-only sources listed below. v: 'checked' | 'pending'
// mirrors the verification status used in timeline.js.
// Each page: { scene, stamp?, alt, stickers: [{ t, b, tone, tape?, src?, v? }] }
// Tones: yellow | pink | blue | green | red | black | white

const L = (zh, en) => ({ zh, en });

export const GUIDE_SOURCES = {
  S1: { t: L('维基百科：大卫·林奇', 'Wikipedia: David Lynch'), url: 'https://en.wikipedia.org/wiki/David_Lynch' },
  S2: { t: L('林奇与克里斯汀·麦肯纳《梦之空间》（2018）', 'Lynch & Kristine McKenna, Room to Dream (2018)'), url: 'https://www.penguinrandomhouse.com/books/234010/room-to-dream-by-david-lynch-and-kristine-mckenna/' },
  S3: { t: L('戛纳电影节官方网站', 'Festival de Cannes (official site)'), url: 'https://www.festival-cannes.com/en/' },
  S4: { t: L('奥斯卡官方获奖数据库', 'Academy Awards Database (official)'), url: 'https://awardsdatabase.oscars.org/' },
  S5: { t: L('威尼斯双年展官方网站', 'La Biennale di Venezia (official site)'), url: 'https://www.labiennale.org/en' },
  S6: { t: L('大卫·林奇基金会官方网站', 'David Lynch Foundation (official site)'), url: 'https://www.davidlynchfoundation.org/' },
  S7: { t: L('克里斯·罗德利编《林奇谈林奇》', 'Chris Rodley (ed.), Lynch on Lynch'), url: 'https://www.faber.co.uk/' },
  S8: { t: L('Sacred Bones 唱片目录', 'Sacred Bones Records catalogue'), url: 'https://www.sacredbonesrecords.com/' },
  S9: { t: L('美国电影学院（AFI）片目', 'AFI Catalog of Feature Films'), url: 'https://catalog.afi.com/' },
  S10: { t: L('Criterion Collection：大卫·林奇专题', 'The Criterion Collection: David Lynch'), url: 'https://www.criterion.com/shop/collection/499-david-lynch' },
  S11: { t: L('英国电影学会《视与听》', 'BFI · Sight and Sound'), url: 'https://www.bfi.org.uk/sight-and-sound' },
  S12: { t: L('主流媒体讣告（2025 年 1 月，如 Variety）', 'Obituaries, January 2025 (e.g. Variety)'), url: 'https://variety.com/' },
  F1: { t: L('维基百科：《双峰：与火同行》', 'Wikipedia: Twin Peaks: Fire Walk with Me'), url: 'https://en.wikipedia.org/wiki/Twin_Peaks:_Fire_Walk_with_Me' },
  F2: { t: L('维基百科：《与火同行》原声专辑', 'Wikipedia: Fire Walk with Me (soundtrack album)'), url: 'https://en.wikipedia.org/wiki/Twin_Peaks:_Fire_Walk_with_Me_(soundtrack)' },
  F3: { t: L('维基百科：安杰洛·巴达拉曼蒂', 'Wikipedia: Angelo Badalamenti'), url: 'https://en.wikipedia.org/wiki/Angelo_Badalamenti' },
  F4: { t: L('维基百科：朱莉·克鲁斯', 'Wikipedia: Julee Cruise'), url: 'https://en.wikipedia.org/wiki/Julee_Cruise' },
  F5: { t: L('维基百科：《双峰：遗失的片段》', 'Wikipedia: Twin Peaks: The Missing Pieces'), url: 'https://en.wikipedia.org/wiki/Twin_Peaks:_The_Missing_Pieces' },
  F6: { t: L('维基百科：《钓大鱼》', 'Wikipedia: Catching the Big Fish'), url: 'https://en.wikipedia.org/wiki/Catching_the_Big_Fish' },
};

const lynch = {
  id: 'lynch',
  title: L('大卫·林奇的涂鸦本', 'The David Lynch Scrapbook'),
  short: L('大卫·林奇', 'David Lynch'),
  pages: [
    {
      scene: 'lynchCover', stamp: '1946',
      alt: L('蜡笔画：一个头发高高翘起、穿黑西装的人端着咖啡，站在红幕布和 Z 字地板前。', 'Crayon drawing: a man with tall swooping hair and a black suit holds a coffee cup in front of red curtains and a zigzag floor.'),
      stickers: [
        { t: L('你好，大卫·林奇！', 'Hello, David Lynch!'), b: L('他是画家、导演、音乐人，也是一个很爱咖啡的做梦人。翻开这本小本子，我们一起走一遍他的一生。', 'Painter, film‑maker, musician, and a dreamer who loved his coffee. Turn the pages and walk through his life with us.'), tone: 'yellow', tape: true },
        { t: L('一本非官方的小册子', 'An unofficial little book'), b: L('这是粉丝做的导览，所有图画都是蜡笔涂鸦，不是剧照。', 'A fan‑made guide. Every picture here is a crayon doodle, not a film still.'), tone: 'white' },
      ],
    },
    {
      scene: 'montana', stamp: '1946',
      alt: L('蜡笔画：蒙大拿的大山、松树、小房子和太阳，一条弯弯的路连着好几个小点。', 'Crayon drawing: Montana mountains, pine trees, a little house and a sun, with a winding road joining several dots.'),
      stickers: [
        { t: L('1946 年 1 月 20 日', '20 January 1946'), b: L('大卫出生在蒙大拿州的米苏拉。爸爸是美国农业部的研究科学家，研究树木。', 'David is born in Missoula, Montana. His father is a research scientist for the US Department of Agriculture who studies trees.'), tone: 'green', tape: true, src: ['S1', 'S2'], v: 'checked' },
        { t: L('搬家，再搬家', 'Moving, moving again'), b: L('一家人搬过很多地方：爱达荷、华盛顿州、弗吉尼亚……大卫还当过童子军，拿到了最高的“鹰级童子军”。', 'The family moves a lot — Idaho, Washington State, Virginia… David is a Boy Scout and reaches the top rank, Eagle Scout.'), tone: 'blue', src: ['S1', 'S2'], v: 'checked' },
      ],
    },
    {
      scene: 'painter', stamp: '1966',
      alt: L('蜡笔画：画架上有六个生病的小脑袋，旁边是调色盘、画笔和费城的烟囱。', 'Crayon drawing: an easel with six sick little heads, a palette, brushes and Philadelphia chimneys.'),
      stickers: [
        { t: L('先当画家', 'A painter first'), b: L('他最想过的是“艺术生活”：画画、抽烟、喝咖啡。1966 年进入费城的宾夕法尼亚美术学院。', 'What he wants most is “the art life”: painting, smoking, coffee. In 1966 he enters the Pennsylvania Academy of the Fine Arts in Philadelphia.'), tone: 'yellow', tape: true, src: ['S1', 'S7'], v: 'pending' },
        { t: L('会动的画', 'A painting that moves'), b: L('1967 年的《六个人生病（六次）》：一块雕塑屏幕上循环播放的动画，配着警报声。他从画画走向了电影。', 'Six Men Getting Sick (1967): a looping animation on a sculpted screen, with a siren. Painting turns into film.'), tone: 'pink', src: ['S1', 'S7'], v: 'pending' },
      ],
    },
    {
      scene: 'grandmother', stamp: '1970',
      alt: L('蜡笔画：一张床上长出一株植物，植物顶端是一位奶奶的笑脸；旁边是一台电影摄影机。', 'Crayon drawing: a plant grows out of a bed with a grandmother’s smiling face on top; a film camera stands nearby.'),
      stickers: [
        { t: L('《祖母》', 'The Grandmother'), b: L('一个孤单的男孩用一颗种子种出了自己的奶奶。这部短片让林奇拿到美国电影学院（AFI）的资助。', 'A lonely boy grows himself a grandmother from a seed. This short film wins Lynch a grant from the American Film Institute (AFI).'), tone: 'green', tape: true, src: ['S1', 'S9'], v: 'checked' },
        { t: L('去电影学校', 'Off to film school'), b: L('他开始在 AFI 的高级电影研究中心学习，并认识了音效师艾伦·斯普莱特——声音从此和画面一样重要。', 'He starts at the AFI’s Center for Advanced Film Studies and meets sound designer Alan Splet — from now on sound matters as much as pictures.'), tone: 'blue', src: ['S1', 'S9'], v: 'checked' },
      ],
    },
    {
      scene: 'eraserhead', stamp: '1977',
      alt: L('蜡笔画：一个头发竖得很高的男人站在冒烟的工厂前，旁边有一台暖气片和一个小舞台。', 'Crayon drawing: a man with very tall hair stands before smoking factories, beside a radiator with a tiny stage.'),
      stickers: [
        { t: L('《橡皮头》', 'Eraserhead'), b: L('黑白的噩梦：工厂的嗡嗡声、暖气片里唱歌的小女士、一个怎么也哄不好的婴儿。断断续续拍了大约五年。', 'A black‑and‑white bad dream: humming factories, a little lady singing inside the radiator, a baby nobody can soothe. Shot on and off for about five years.'), tone: 'black', tape: true, src: ['S1', 'S9'], v: 'checked' },
        { t: L('午夜场的明星', 'Star of the midnight show'), b: L('它在深夜场一放再放，慢慢成了“午夜电影”的经典。', 'It plays at midnight screenings again and again, and becomes a midnight‑movie classic.'), tone: 'white', src: ['S1'], v: 'checked' },
      ],
    },
    {
      scene: 'elephant', stamp: '1980',
      alt: L('蜡笔画：一座用纸做的教堂模型，周围有八颗金色星星和一盏煤气灯。', 'Crayon drawing: a paper cathedral model surrounded by eight gold stars and a gas lamp.'),
      stickers: [
        { t: L('《象人》', 'The Elephant Man'), b: L('维多利亚时代的伦敦，一个外表不同的男人，和他的尊严。一部关于善良的电影。', 'Victorian London: a man who looks different, and his dignity. A film about kindness.'), tone: 'yellow', tape: true, src: ['S1', 'S4'], v: 'checked' },
        { t: L('八颗星星', 'Eight stars'), b: L('它获得了 8 项奥斯卡提名，林奇第一次被提名最佳导演。', 'It earns 8 Academy Award nominations, including Lynch’s first for Best Director.'), tone: 'pink', src: ['S4'], v: 'checked' },
      ],
    },
    {
      scene: 'velvet', stamp: '1986',
      alt: L('蜡笔画：左边是沙丘和一条大沙虫；右边是白篱笆、红玫瑰、草地上的一只耳朵和一只知更鸟。', 'Crayon drawing: on the left, sand dunes and a giant worm; on the right, a white fence, red roses, an ear in the grass and a robin.'),
      stickers: [
        { t: L('《沙丘》（1984）', 'Dune (1984)'), b: L('一部很大的科幻片。林奇后来说，他对最后的剪辑没有掌控权。', 'A huge science‑fiction film. Lynch later said he had no control over the final cut.'), tone: 'yellow', src: ['S1'], v: 'checked' },
        { t: L('《蓝丝绒》（1986）', 'Blue Velvet (1986)'), b: L('草地上捡到一只耳朵，揭开了漂亮小镇下面的黑暗。作曲家安杰洛·巴达拉曼蒂从这里开始和林奇长期合作。', 'An ear found in a field opens up the darkness under a pretty small town. Composer Angelo Badalamenti begins his long partnership with Lynch here.'), tone: 'blue', tape: true, src: ['S1', 'S4'], v: 'checked' },
      ],
    },
    {
      scene: 'twinpeaks', stamp: '1990',
      alt: L('蜡笔画：两座山峰、高高的冷杉、“欢迎来到双峰”的牌子、一杯咖啡、一块樱桃派、一只猫头鹰和一根木头。', 'Crayon drawing: twin mountains, tall fir trees, a “Welcome to Twin Peaks” sign, coffee, cherry pie, an owl and a log.'),
      stickers: [
        { t: L('《双峰》', 'Twin Peaks'), b: L('“谁杀了劳拉·帕尔默？”林奇和马克·弗罗斯特一起创作的电视剧，1990 年 4 月在 ABC 首播，播了两季。', '“Who killed Laura Palmer?” Created by Lynch with Mark Frost, it premieres on ABC in April 1990 and runs two seasons.'), tone: 'red', tape: true, src: ['S1'], v: 'checked' },
        { t: L('樱桃派和黑咖啡', 'Cherry pie & black coffee'), b: L('红房间、Z 字地板、倒着说话的人……这些古怪的东西从这里走进了流行文化。', 'The Red Room, the zigzag floor, people who talk backwards… these strange things walk into pop culture from here.'), tone: 'white', src: ['S1'], v: 'checked' },
      ],
    },
    {
      scene: 'wildheart', stamp: '1990',
      alt: L('蜡笔画：夜晚的公路上一辆小车开向一团大火，天上挂着一片金色棕榈叶。', 'Crayon drawing: a little car drives along a night road toward a big fire, with a golden palm leaf in the sky.'),
      stickers: [
        { t: L('《我心狂野》', 'Wild at Heart'), b: L('一对恋人沿着公路逃跑，到处是《绿野仙踪》的影子。1990 年在戛纳拿到最高奖金棕榈。', 'Two lovers on the run down the highway, with The Wizard of Oz everywhere. It wins the Palme d’Or at Cannes in 1990.'), tone: 'yellow', tape: true, src: ['S1', 'S3'], v: 'checked' },
        { t: L('与火同行（1992）', 'Fire Walk with Me (1992)'), b: L('他回到双峰，拍了劳拉生命的最后七天。翻到另一本小册子可以看更多！', 'He returns to Twin Peaks to film Laura’s last seven days. There’s a whole other scrapbook about it!'), tone: 'red', src: ['S1'], v: 'pending' },
      ],
    },
    {
      scene: 'highway', stamp: '1997',
      alt: L('蜡笔画：上面是夜里的公路和一条黄色中线；下面是一位老人开着割草机穿过田野。', 'Crayon drawing: above, a highway at night with a yellow centre line; below, an old man rides a lawn mower across fields.'),
      stickers: [
        { t: L('《妖夜慌踪》（1997）', 'Lost Highway (1997)'), b: L('神秘的录像带、一个人变成另一个人，黄色中线在黑夜里一直延伸。剧本与巴里·吉福德合写。', 'Mystery videotapes, one man turning into another, a yellow line racing into the dark. Co‑written with Barry Gifford.'), tone: 'black', src: ['S1', 'S7'], v: 'pending' },
        { t: L('《史崔特先生的故事》（1999）', 'The Straight Story (1999)'), b: L('一位老爷爷开着割草机跨过两个州去看哥哥。真人真事，也是林奇最温柔的电影。', 'An old man rides a lawn mower across two states to visit his brother. A true story, and Lynch’s gentlest film.'), tone: 'green', tape: true, src: ['S1'], v: 'checked' },
      ],
    },
    {
      scene: 'mulholland', stamp: '2001',
      alt: L('蜡笔画：夜里的山丘上有一块“穆赫兰道”路牌，一个蓝色的小盒子和一把蓝钥匙，两个女孩的脸。', 'Crayon drawing: a “Mulholland Dr” sign on night hills, a little blue box and a blue key, two girls’ faces.'),
      stickers: [
        { t: L('《穆赫兰道》', 'Mulholland Drive'), b: L('好莱坞的梦，正面和反面。它一开始是一部被电视台拒掉的试播集，后来变成了电影。', 'The Hollywood dream, front side and flip side. It began as a TV pilot that was turned down, then became a film.'), tone: 'blue', tape: true, src: ['S1'], v: 'checked' },
        { t: L('戛纳最佳导演', 'Best Director at Cannes'), b: L('2001 年，林奇和乔尔·科恩（《缺席的人》）并列获得戛纳最佳导演。', 'In 2001 Lynch shares the Cannes Best Director award with Joel Coen (The Man Who Wasn’t There).'), tone: 'yellow', src: ['S1', 'S3'], v: 'checked' },
      ],
    },
    {
      scene: 'meditate', stamp: '1973',
      alt: L('蜡笔画：一个人盘腿坐着冥想，下面的池塘里有小鱼和一条金色的大鱼，旁边有一杯冒热气的咖啡。', 'Crayon drawing: a man sits cross‑legged meditating above a pond with little fish and one big golden fish, next to a steaming coffee.'),
      stickers: [
        { t: L('钓大鱼', 'Catching the big fish'), b: L('林奇说，想法像鱼：小鱼在水面，大鱼在深处。他在 2006 年的小书《钓大鱼》里讲了这个比喻。', 'Lynch said ideas are like fish: little ones swim near the surface, big ones live deep down. He tells this in his 2006 book Catching the Big Fish.'), tone: 'blue', tape: true, src: ['S1', 'F6'], v: 'pending' },
        { t: L('每天冥想', 'Meditating every day'), b: L('从 1973 年起，他每天练习超觉静坐。2005 年成立大卫·林奇基金会，把冥想带进学校。', 'From 1973 he practises Transcendental Meditation every day. In 2005 he starts the David Lynch Foundation to bring it to schools.'), tone: 'green', src: ['S6', 'S2'], v: 'pending' },
        { t: L('还有咖啡', 'And coffee'), b: L('他每天喝很多很多杯咖啡。', 'He drinks many, many cups of coffee a day.'), tone: 'white', src: ['S2'], v: 'pending' },
      ],
    },
    {
      scene: 'inland', stamp: '2006',
      alt: L('蜡笔画：一只金色的狮子、一盏台灯和一张黑胶唱片，唱片上飞出音符。', 'Crayon drawing: a golden lion, a table lamp and a vinyl record with music notes flying out.'),
      stickers: [
        { t: L('《内陆帝国》与金狮', 'Inland Empire & the Golden Lion'), b: L('2006 年，他用小小的数码摄像机拍了近三小时的迷宫电影，在威尼斯首映；同年获威尼斯终身成就金狮奖。这是他最后一部长片。', 'In 2006 he makes a three‑hour maze of a film on a small digital camera, premiering in Venice, where he also receives the Golden Lion for lifetime achievement. It is his last feature film.'), tone: 'yellow', tape: true, src: ['S1', 'S5'], v: 'pending' },
        { t: L('唱歌的林奇', 'Lynch sings'), b: L('他还出唱片：《疯狂小丑时间》（2011）和《大梦》（2013），由 Sacred Bones 发行。', 'He makes records too: Crazy Clown Time (2011) and The Big Dream (2013), released by Sacred Bones.'), tone: 'pink', src: ['S8'], v: 'pending' },
      ],
    },
    {
      scene: 'thereturn', stamp: '2017',
      alt: L('蜡笔画：一台冒出闪电的电视、一根写着 6 的电线杆，还有一本翻开的书。', 'Crayon drawing: a TV sparking with lightning, an electricity pole marked 6, and an open book.'),
      stickers: [
        { t: L('《双峰：回归》', 'Twin Peaks: The Return'), b: L('25 年后，双峰回来了。2017 年在 Showtime 播出，一共 18 集，每一集都是林奇自己导演的。', '25 years later, Twin Peaks comes back. It airs on Showtime in 2017: 18 parts, every one directed by Lynch himself.'), tone: 'red', tape: true, src: ['S1'], v: 'checked' },
        { t: L('《梦之空间》（2018）', 'Room to Dream (2018)'), b: L('一本和克里斯汀·麦肯纳合写的书：一章是传记，下一章是林奇自己的回忆。', 'A book written with Kristine McKenna: one chapter biography, the next Lynch’s own memories.'), tone: 'white', src: ['S1', 'S2'], v: 'checked' },
      ],
    },
    {
      scene: 'farewell', stamp: '2025',
      alt: L('蜡笔画：一座金色小人奖杯、一个看着地平线的摄影机，夜空里的星星和慢慢合上的红幕布。', 'Crayon drawing: a little golden statuette, a camera looking at the horizon, night stars and red curtains slowly closing.'),
      stickers: [
        { t: L('荣誉奥斯卡', 'An honorary Oscar'), b: L('2019 年，电影学院在理事会奖上授予他荣誉奥斯卡。', 'In 2019 the Academy gives him an honorary Oscar at the Governors Awards.'), tone: 'yellow', src: ['S4'], v: 'pending' },
        { t: L('地平线在哪里？', 'Where’s the horizon?'), b: L('2022 年，他在斯皮尔伯格的《造梦之家》里客串老导演约翰·福特。', 'In 2022 he plays the old director John Ford in a cameo in Steven Spielberg’s The Fabelmans.'), tone: 'blue', src: ['S1'], v: 'checked' },
        { t: L('再见，大卫', 'Goodbye, David'), b: L('2025 年 1 月 16 日，林奇在洛杉矶去世，享年 78 岁。他留下了很多很多梦。', 'David Lynch died in Los Angeles on 16 January 2025, aged 78. He left us lots and lots of dreams.'), tone: 'black', tape: true, src: ['S1', 'S12'], v: 'checked' },
      ],
    },
    {
      scene: 'sources', type: 'sources',
      alt: L('蜡笔画：一摞书、一支铅笔和一杯咖啡。', 'Crayon drawing: a stack of books, a pencil and a cup of coffee.'),
      sources: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S11', 'S12', 'F6'],
      note: L('这是一本非官方的粉丝导览，与大卫·林奇的遗产管理方及任何片方无关。图画全部为原创蜡笔涂鸦；文字为转述概括。标着“待复核”的条目还需对照原始资料再检查。',
        'An unofficial fan guide, not affiliated with David Lynch’s estate or any studio. All pictures are original crayon doodles; all text is paraphrased. Items marked “to re‑check” still need checking against primary sources.'),
    },
  ],
};

const fwwm = {
  id: 'fwwm',
  title: L('与火同行 · 涂鸦本', 'Fire Walk with Me · Scrapbook'),
  short: L('与火同行', 'Fire Walk with Me'),
  pages: [
    {
      scene: 'fireCover', stamp: '1992',
      alt: L('蜡笔画：红幕布、黑白 Z 字地板，中间燃着一团火。', 'Crayon drawing: red curtains and a black‑and‑white zigzag floor with a fire burning in the middle.'),
      stickers: [
        { t: L('《双峰：与火同行》', 'Twin Peaks: Fire Walk with Me'), b: L('1992 年的电影，《双峰》的前传。导演大卫·林奇，编剧林奇与罗伯特·恩格斯。', 'A 1992 film and a prequel to Twin Peaks. Directed by David Lynch, written by Lynch and Robert Engels.'), tone: 'red', tape: true, src: ['F1'], v: 'checked' },
        { t: L('先说一句', 'A gentle note first'), b: L('这是一部关于一个年轻女孩所受伤害、以及她内心世界的电影，涉及家庭暴力、性侵与死亡。这本小册子只轻轻提到，不讲细节。', 'This is a film about a young woman’s suffering and her inner life. It deals with abuse, violence and death. This scrapbook mentions them gently, without detail.'), tone: 'white' },
      ],
    },
    {
      scene: 'cannes', stamp: '1992',
      alt: L('蜡笔画：电影院里一排小脑袋，一边是乌云和雷电，另一边是太阳和花。', 'Crayon drawing: a row of little heads in a cinema, a storm cloud on one side and a sun with flowers on the other.'),
      stickers: [
        { t: L('戛纳，1992 年 5 月', 'Cannes, May 1992'), b: L('电影在戛纳参加主竞赛单元首映。很多观众和影评人不喜欢它，现场有嘘声也有掌声。', 'It premieres in competition at Cannes. Many viewers and critics dislike it; there are boos as well as applause.'), tone: 'black', tape: true, src: ['F1', 'S3'], v: 'checked' },
        { t: L('后来，太阳出来了', 'Later, the sun came out'), b: L('许多年后，越来越多的人重新看它，现在它常被认为是林奇最重要的作品之一。', 'Years later, more and more people looked again. Today it is often counted among Lynch’s most important works.'), tone: 'yellow', src: ['F1', 'S10'], v: 'checked' },
      ],
    },
    {
      scene: 'deermeadow', stamp: 'FBI',
      alt: L('蜡笔画：两个 FBI 探员站在拖车营地前，一个女孩穿红裙子、别着一朵蓝玫瑰，旁边是一个戴大助听器的人。', 'Crayon drawing: two FBI agents by a trailer park, a girl in a red dress wearing a blue rose, and a man with a big hearing aid.'),
      stickers: [
        { t: L('鹿草地小镇', 'Deer Meadow'), b: L('电影从另一桩案子开始：FBI 探员切斯特·德斯蒙德（克里斯·埃塞克）和山姆·斯坦利（基弗·萨瑟兰）调查特蕾莎·班克斯的死。', 'The film opens on another case: FBI agents Chester Desmond (Chris Isaak) and Sam Stanley (Kiefer Sutherland) look into the death of Teresa Banks.'), tone: 'blue', tape: true, src: ['F1'], v: 'checked' },
        { t: L('莉儿的密码', 'Lil’s secret code'), b: L('上司戈登·科尔（林奇本人演）派来一个叫莉儿的女孩，她的表情和动作都是暗号。裙子上那朵假的蓝玫瑰，没人肯解释。', 'Their boss Gordon Cole (played by Lynch himself) sends a girl called Lil whose faces and moves are coded clues. Nobody will explain the fake blue rose on her dress.'), tone: 'pink', src: ['F1'], v: 'checked' },
      ],
    },
    {
      scene: 'jeffries', stamp: '10:10',
      alt: L('蜡笔画：一枚绿色石头的戒指掉在拖车下；另一边是 FBI 办公室的监控电视、时钟和一个穿白西装的人。', 'Crayon drawing: a green‑stone ring under a trailer; on the other side an FBI office with a security monitor, a clock and a man in a white suit.'),
      stickers: [
        { t: L('一枚戒指', 'A ring'), b: L('德斯蒙德在一辆拖车下面发现一枚刻着奇怪图案的绿石戒指——然后他就消失了。', 'Desmond finds a green‑stone ring with a strange symbol under a trailer — and then he vanishes.'), tone: 'green', tape: true, src: ['F1'], v: 'checked' },
        { t: L('菲利普·杰弗里斯', 'Phillip Jeffries'), b: L('在费城的 FBI 办公室，失踪多年的探员杰弗里斯（大卫·鲍伊）突然走出电梯，说着听不懂的话，又不见了。库珀探员盯着监控画面发呆。', 'In the Philadelphia FBI office, long‑lost agent Jeffries (David Bowie) steps out of the elevator, says puzzling things, and is gone. Agent Cooper stares at the security monitor.'), tone: 'white', src: ['F1'], v: 'checked' },
      ],
    },
    {
      scene: 'sevendays', stamp: '7',
      alt: L('蜡笔画：两个女孩手拉手走在学校前面，天上有七个小记号，旁边是一本日记和半颗心的项链。', 'Crayon drawing: two girls holding hands in front of a school, seven little tally marks in the sky, a diary and a half‑heart necklace.'),
      stickers: [
        { t: L('劳拉的最后七天', 'Laura’s last seven days'), b: L('然后故事来到双峰镇。我们跟着高中生劳拉·帕尔默（谢丽尔·李）度过她生命的最后一周。', 'Then we arrive in Twin Peaks and follow high‑school student Laura Palmer (Sheryl Lee) through the last week of her life.'), tone: 'pink', tape: true, src: ['F1'], v: 'checked' },
        { t: L('好朋友唐娜', 'Her best friend Donna'), b: L('电视剧里的唐娜在电影里换了演员，由莫伊拉·凯利扮演。', 'Donna is played by a new actress in the film: Moira Kelly.'), tone: 'yellow', src: ['F1'], v: 'checked' },
      ],
    },
    {
      scene: 'angelpainting', stamp: '?',
      alt: L('蜡笔画：卧室墙上挂着一幅画，画里的天使在给孩子们分面包；天花板上有一台吊扇。', 'Crayon drawing: a bedroom wall with a picture of an angel handing bread to children; a ceiling fan above.'),
      stickers: [
        { t: L('墙上的天使', 'The angel on the wall'), b: L('劳拉房间里挂着一幅天使和孩子们的画。在她最难过的时候，画里的天使悄悄不见了。', 'Laura’s room has a picture of an angel with children. At her darkest moment, the angel quietly disappears from the picture.'), tone: 'blue', tape: true, src: ['F1'], v: 'pending' },
        { t: L('家里的阴影', 'A shadow at home'), b: L('电影一点点揭开：危险就在她自己家里，和她的父亲利兰（雷·怀斯）有关。电影站在劳拉这一边，认真看待她的痛苦。', 'Slowly the film reveals that the danger is inside her own home, tied to her father Leland (Ray Wise). The film stays on Laura’s side and takes her pain seriously.'), tone: 'black', src: ['F1'], v: 'checked' },
      ],
    },
    {
      scene: 'onearmed', stamp: 'STOP',
      alt: L('蜡笔画：路口停着一辆小汽车，旁边一辆小卡车里的独臂男人举着一枚戒指大喊。', 'Crayon drawing: a car stopped at a crossing while a one‑armed man in a pickup beside it shouts and holds up a ring.'),
      stickers: [
        { t: L('路上的独臂人', 'The One‑Armed Man on the road'), b: L('利兰开车载着劳拉时，独臂人（他叫麦克）把车开到旁边，举着那枚戒指大声喊叫，像在警告她。', 'While Leland drives Laura, the One‑Armed Man (called Mike) pulls up beside them, shouting and holding up the ring as if to warn her.'), tone: 'yellow', tape: true, src: ['F1'], v: 'checked' },
      ],
    },
    {
      scene: 'roadhouse', stamp: 'LIVE',
      alt: L('蜡笔画：小酒馆的舞台上，一位金发歌手站在麦克风前，红幕布和音符飘在空中。', 'Crayon drawing: on a roadhouse stage a blonde singer stands at a microphone, with red curtains and floating music notes.'),
      stickers: [
        { t: L('巴达拉曼蒂的音乐', 'Badalamenti’s music'), b: L('配乐由安杰洛·巴达拉曼蒂创作，带着爵士味，又慢又暗。原声专辑 1992 年由华纳兄弟唱片发行。', 'The score is by Angelo Badalamenti: slow, dark, jazz‑tinged. The soundtrack album came out in 1992 on Warner Bros. Records.'), tone: 'blue', tape: true, src: ['F2', 'F3'], v: 'checked' },
        { t: L('小酒馆里的歌', 'A song at the Roadhouse'), b: L('朱莉·克鲁斯在小酒馆唱《蓝色世界里的问题》，歌词是林奇写的。劳拉听着听着就哭了。', 'Julee Cruise sings “Questions in a World of Blue” at the Roadhouse, with lyrics by Lynch. Listening, Laura starts to cry.'), tone: 'pink', src: ['F2', 'F4'], v: 'checked' },
      ],
    },
    {
      scene: 'redroomEnd', stamp: 'END',
      alt: L('蜡笔画：红房间里，女孩坐在椅子上，一位发光的天使飘在她头顶，Z 字地板一直延伸。', 'Crayon drawing: in the Red Room a girl sits in a chair while a glowing angel floats above her, the zigzag floor stretching away.'),
      stickers: [
        { t: L('红房间里的天使', 'An angel in the Red Room'), b: L('在电影最后，劳拉的灵魂来到红房间，库珀探员陪在她身边。一位天使出现了，劳拉流着泪，又笑了。', 'At the very end, Laura’s spirit is in the Red Room with Agent Cooper beside her. An angel appears, and Laura cries — and then smiles.'), tone: 'red', tape: true, src: ['F1'], v: 'checked' },
        { t: L('一个温柔的结尾', 'A gentle ending'), b: L('很多观众把它看成一种安慰：她终于不再一个人了。', 'Many viewers see it as comfort: at last, she is not alone.'), tone: 'white' },
      ],
    },
    {
      scene: 'missing', stamp: '2014',
      alt: L('蜡笔画：一卷卷电影胶片像拼图一样拼在一起，上面写着 2014。', 'Crayon drawing: strips of film fitted together like puzzle pieces, with 2014 written above.'),
      stickers: [
        { t: L('遗失的片段', 'The Missing Pieces'), b: L('拍了很多却剪掉的场景，在 2014 年整理成大约一个半小时的《遗失的片段》，随蓝光套装《双峰：完整之谜》发行。', 'Lots of scenes were filmed and cut. In 2014 they were assembled into The Missing Pieces, about 90 minutes long, released with the Blu‑ray set Twin Peaks: The Entire Mystery.'), tone: 'green', tape: true, src: ['F5', 'F1'], v: 'checked' },
        { t: L('故事还在继续', 'The story goes on'), b: L('25 年后的《双峰：回归》（2017）又把许多线索接了回来。', 'Twin Peaks: The Return (2017), 25 years later, picks up many of these threads again.'), tone: 'yellow', src: ['S1'], v: 'checked' },
      ],
    },
    {
      scene: 'sources', type: 'sources',
      alt: L('蜡笔画：一摞书、一支铅笔和一杯咖啡。', 'Crayon drawing: a stack of books, a pencil and a cup of coffee.'),
      sources: ['F1', 'F2', 'F3', 'F4', 'F5', 'S10', 'S3', 'S1'],
      listen: L('想听原声？配乐作者是安杰洛·巴达拉曼蒂（1937–2022）。请在正规音乐平台或唱片店收听 / 购买 1992 年的官方原声专辑，上面的维基百科条目列出了曲目与发行信息。',
        'Want to hear the score? It’s by Angelo Badalamenti (1937–2022). Please listen to or buy the official 1992 soundtrack album through legitimate music services or record shops — the Wikipedia entries above list its tracks and release details.'),
      note: L('这是一本非官方的粉丝导览，与片方、发行方及林奇的遗产管理方无关。图画全部为原创蜡笔涂鸦，不含剧照或演员肖像；文字为转述概括。标着“待复核”的条目还需对照原始资料。',
        'An unofficial fan guide, not affiliated with the producers, distributors or David Lynch’s estate. All pictures are original crayon doodles, with no stills or actor likenesses; all text is paraphrased. Items marked “to re‑check” still need checking against primary sources.'),
    },
  ],
};

export const GUIDES = { lynch, fwwm };
