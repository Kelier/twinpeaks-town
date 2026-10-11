export const NPCS = {
 cooper:{name:'戴尔·库珀',en:'DALE COOPER',role:'FBI 特别探员',portrait:0,theme:'trust',bio:'一位相信证据，也愿意认真听完一个梦的调查者。咖啡是他的日常仪式；直觉让他看见常识之外的联系。',fact:'与警长哈里·杜鲁门共同调查劳拉·帕尔默之死。',place:'diner'},
 laura:{name:'劳拉·帕尔默',en:'LAURA PALMER',role:'小镇记忆的中心',portrait:1,theme:'dream',bio:'所有人似乎都认识她，几乎没有人看见她的全部。她的缺席，揭开了小镇日常表面下的裂缝。',fact:'她的死亡是原剧调查的起点。本作中的显影与录音为原创支线表达。',place:'redroom'},
 audrey:{name:'奥黛丽·霍恩',en:'AUDREY HORNE',role:'大北方旅馆的观察者',portrait:2,theme:'secret',bio:'敏锐、好奇，常比旁人更早察觉大人的秘密。她熟悉旅馆，也知道每一扇门背后的沉默。',fact:'本杰明·霍恩的女儿；她主动接近库珀的调查。',place:'lodge'},
 margaret:{name:'玛格丽特·兰特曼',en:'THE LOG LADY',role:'带来另一种证词的人',portrait:3,theme:'dream',bio:'她抱着一截木头说话。面对她的提示，重要的不是立即解释，而是愿意停下来聆听。',fact:'通常被镇民称为“原木夫人”，她的提示与森林和梦境紧密相关。',place:'woods'},
 truman:{name:'哈里·杜鲁门',en:'HARRY S. TRUMAN',role:'双峰镇警长',portrait:4,theme:'trust',bio:'熟悉镇上的道路，也熟悉住在这里的人。他在库珀的直觉与当地的现实之间建立信任。',fact:'库珀的重要调查搭档。这里指原剧的哈里·杜鲁门。',place:'diner'},
};
export const RELATIONS=[
 ['cooper','laura','调查 / 记忆','secret'],['truman','cooper','共同调查','trust'],['audrey','cooper','提供线索','trust'],['audrey','laura','同一座小镇的秘密','secret'],['margaret','cooper','梦境提示','dream'],['margaret','laura','林中的回声','dream'],['truman','laura','小镇与案件','secret']
];
export const PLACES={diner:{name:'双 R 餐馆',en:'THE DOUBLE R',time:'06:18 AM',music:'enter:redroom'},lodge:{name:'大北方旅馆',en:'THE GREAT NORTHERN',time:'08:07 AM',music:'enter:theater'},woods:{name:'林中空地',en:'GHOSTWOOD',time:'05:31 PM',music:'enter:radiator'},redroom:{name:'红房间',en:'THE WAITING ROOM',time:'OUTSIDE OF TIME',music:'finale'}};
export const EVIDENCE={receipt:{title:'一张咖啡账单',label:'06:18 / DOUBLE R',text:'两杯咖啡。其中一杯的名字被划去了。背面留下 315 和一笔绿色铅线。',place:'diner'},key:{title:'315 房间的钥匙',label:'08:07 / GREAT NORTHERN',text:'黄铜钥匙旁边压着一张纸条：最后一个声音，来自树木之间。',place:'lodge'},tape:{title:'林中的录音',label:'17:31 / GHOSTWOOD',text:'电流声之后，先是杯碟，接着是走廊里的脚步，最后才是风。',place:'woods'}};
export function newCase(){return {version:2,place:'diner',evidence:[],met:[],notes:[],flags:{},completed:false,ending:null,stickers:[],scrap:[]};}
export function objective(s){
 if(s.completed)return '调查已归档。你可以留在梦里，或回望林奇的一生。';
 if(!s.flags.accepted)return '与窗边的库珀交谈，开始调查。';
 if(!s.evidence.includes('receipt'))return '检查柜台上的咖啡账单。';
 if(!s.evidence.includes('key'))return '前往大北方旅馆，向奥黛丽询问 315。';
 if(!s.evidence.includes('tape'))return '在森林找到原木夫人，聆听并调谐收音机。';
 if(!s.flags.deduced)return '回到双 R 餐馆，把三条线索交给杜鲁门。';
 return '林中的红幕已经打开。跟随劳拉的回声。';
}
export const LIFE=[
 {year:'1946',range:'1946—1965',title:'在成为导演之前，\n他先看见了树。',tag:'A CHILD OF THE NORTHWEST',text:'大卫·林奇出生于蒙大拿州米苏拉，成长中随家庭迁居。后来那些平静街道、花园与森林的表象，会在他的电影中不断与不安并置。',note:'人生事实与作品母题并置；母题连接属于编辑解读。',theme:'pine',ids:[0,1]},
 {year:'1966',range:'1966—1970',title:'他想让一幅画，\n开始移动。',tag:'THE PAINTER',text:'在费城的宾夕法尼亚美术学院，绘画、声音与运动相遇。《六个人生病》把绘画变成循环影像；短片《字母》《祖母》继续试验身体、语言与梦。',note:'绘画不是电影之前的一站，而是一种贯穿创作的观看方式。',theme:'red',ids:[2,3,4,5]},
 {year:'1977',range:'1971—1984',title:'漫长的黑夜，\n终于发出声音。',tag:'THE FILMMAKER',text:'《橡皮头》经过多年的制作，走进午夜场。工业噪声、狭窄室内与难以解释的焦虑，组成了自己的世界。《象人》让更广泛的观众看见他的同情与克制。',note:'随后，《沙丘》带来大制作的经验与创作控制上的矛盾。',theme:'ink',ids:[6,7,8]},
 {year:'1986',range:'1986—1989',title:'草坪的下面，\n还有另一个世界。',tag:'SOUND BECOMES A WORLD',text:'《蓝丝绒》让熟悉的小镇变得陌生。与安杰洛·巴达拉曼蒂的合作，也让音乐成为叙事空间的一部分：温柔的旋律与不安的低音，可以在同一刻存在。',note:'双峰镇的声音世界即将成形。',theme:'blue',ids:[9]},
 {year:'1990',range:'1990—1992',title:'一座小镇，\n改变了电视的梦。',tag:'WELCOME TO TWIN PEAKS',text:'林奇与马克·弗罗斯特共同创造《双峰》。劳拉·帕尔默的缺席连接了一个复杂的共同体。《我心狂野》获得戛纳金棕榈；《与火同行》随后把视线转回劳拉的经历。',note:'游戏只在双峰镇展开；电影生涯在这本档案里继续。',theme:'pine',ids:[10,11,12]},
 {year:'2001',range:'1997—2014',title:'名字会改变，\n情感留下来。',tag:'IDENTITY & THE IMAGE',text:'从《妖夜慌踪》到《穆赫兰道》《内陆帝国》，身份、表演与影像互相侵入。《史崔特先生的故事》则以缓慢的公路旅程呈现另一种温柔。他也持续绘画、摄影和制作音乐。',note:'2014 年，PAFA 的 The Unified Field 展览回望他的视觉艺术。',theme:'red',ids:[13,14,15,16,17,18,19]},
 {year:'2017',range:'2017—2024',title:'二十五年后，\n回去的还是那个人吗？',tag:'THE RETURN',text:'《双峰：回归》的十八集全部由林奇执导。熟悉的地名与人物回来了，时间却不肯原样复现。晚年的书写、艺术、音乐与短片，让“导演”之外的他仍然持续被看见。',note:'这不是对所有谜题的解答，而是与时间重逢。',theme:'pine',ids:[20,21,22,23,24,25]},
 {year:'2025',range:'1946—2025',title:'灯暗下来，\n梦还没有结束。',tag:'A LIFE IN DREAMS',text:'2025 年 1 月 16 日，大卫·林奇去世。他留下的不只是电影目录，还有一种看待日常的方法：认真听见房间里的声音，允许未知保留它的形状。',note:'致敬大卫·林奇。这里的回望，可以随时重新开始。',theme:'ink',ids:[26]},
];
