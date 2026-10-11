import * as THREE from 'three';
import { Space } from './space.js';
import { curtainMaterial, curtainWall, textTexture, std } from './materials.js';

// An original town, connected by one continuous walk rather than separate menus.
export class Town extends Space {
  constructor(game) {
    super(game, 'town');
    this.bounds = { minX: -10, maxX: 10, minZ: -25, maxZ: 8 };
    this.spawn = { pos: new THREE.Vector3(0, 1.6, 5), yaw: 0 };
    this.background = new THREE.Color(0x071319);
    this.fog = new THREE.FogExp2(0x122a30, 0.033);
  }
  build() {
    const r = this.root;
    const wood = std(0x302b22, { roughness: .95 });
    const cream = std(0x8c8a75, { roughness: .8 });
    const dark = std(0x101b1c, { roughness: .72 });
    const red = std(0x631d24, { roughness: .6 });
    const warm = new THREE.MeshBasicMaterial({ color: 0xeac080 });
    const box = (w,h,d,x,y,z,mat,parent=r) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
      m.position.set(x,y,z); m.castShadow = m.receiveShadow = true; parent.add(m); return m;
    };
    const sign = (lines,x,y,z,w,h,color='#efca9b',parent=r) => {
      const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:textTexture(lines,{w:1024,h:256,bg:'#101e20',fg:color,font:'38px Georgia'})}));
      m.position.set(x,y,z); parent.add(m); return m;
    };
    box(70,.1,85,0,-.1,-20,std(0x13211f));
    box(5,.025,40,0,-.025,-10,std(0x263137,{roughness:.24,metalness:.3}));
    for(const x of [-2.75,2.75]) box(.45,.08,35,x,0,-9,cream);
    for(let i=0;i<12;i++) box(.09,.008,1.3,0,.004,5-i*2.7,std(0x919075));
    r.add(new THREE.HemisphereLight(0x8eb6c8,0x151515,1.7));
    const moonlight=new THREE.DirectionalLight(0xb0ccd6,1.4); moonlight.position.set(-6,15,-10);r.add(moonlight);
    const moon=new THREE.Mesh(new THREE.SphereGeometry(1.1,24,16),new THREE.MeshBasicMaterial({color:0xa2b9b5,fog:false})); moon.position.set(13,18,-48);r.add(moon);
    // Three mountain ridges behind the trees.
    for(let i=0;i<5;i++) {
      const m=new THREE.Mesh(new THREE.ConeGeometry(14,16+i%2*7,5),std(0x193239));
      m.position.set((i-2)*17,5,-55-(i%2)*8);r.add(m);
    }
    const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(1.5,6,7), std(0x142b27), 80);
    const dummy=new THREE.Object3D();
    for(let i=0;i<80;i++) {
      const side=i%2?1:-1, row=Math.floor(i/2);
      dummy.position.set(side*(12+(row%4)*3.4), 3+(row%3)*.4, 10-Math.floor(row/4)*5.7);
      dummy.scale.setScalar(.8+(row%4)*.18);dummy.rotation.y=i*.7;dummy.updateMatrix();trees.setMatrixAt(i,dummy.matrix);
    }
    trees.instanceMatrix.needsUpdate=true;r.add(trees);
    // Open diner: the front wall is deliberately absent so the counter is walkable.
    box(6,.18,5,-6,.06,-3,cream);box(6,3.5,.18,-6,1.8,-5.5,cream);
    box(.18,3.5,5,-9,1.8,-3,cream);box(6,.2,5.4,-6,3.6,-3,dark);
    box(6,.3,.25,-6,3.25,-.4,red);
    sign(['NIGHT OWL  /  DINER'], -6,3.8,-.25,5.8,.7,'#f3a280');
    box(4.5,.95,.65,-6,.55,-3.9,red);box(4.7,.1,.85,-6,1.07,-3.9,cream);
    for(let i=0;i<3;i++) { box(.08,.7,.08,-7.5+i*1.5,.4,-2.6,dark);box(.6,.13,.6,-7.5+i*1.5,.8,-2.6,red); }
    box(3.8,1,.06,-6,2.1,-5.37,warm);
    const dinerLight=new THREE.PointLight(0xffaa66,16,9,1.6);dinerLight.position.set(-6,2.7,-2);r.add(dinerLight);
    const cup = new THREE.Group(); cup.position.set(-5.7,1.14,-3.7);
    const ceramic=new THREE.Mesh(new THREE.CylinderGeometry(.12,.1,.2,20),std(0xe8dec4));ceramic.position.y=.1;cup.add(ceramic);
    const coffee=new THREE.Mesh(new THREE.CircleGeometry(.105,20),std(0x211208));coffee.rotation.x=-Math.PI/2;coffee.position.y=.203;cup.add(coffee);
    const handle=new THREE.Mesh(new THREE.TorusGeometry(.07,.022,8,20),std(0xe8dec4));handle.position.set(.13,.1,0);cup.add(handle);r.add(cup);
    this.add(cup,{id:'town:coffee',label:'餐馆 · 温热的咖啡',radius:4,anchor:new THREE.Vector3(0,.4,0),use:()=>this.investigate('coffee')});
    // Hotel lobby, registration desk, individual lit windows.
    box(6,.18,5,6,.06,-12,wood);box(6,6,.2,6,3,-14.5,wood);
    box(.2,3.4,5,9,1.7,-12,wood);box(6,.3,5.4,6,3.5,-12,wood);
    box(6,2.6,.2,6,4.85,-9.5,wood);
    for(const x of [4.1,6,7.9])box(1.1,1.5,.05,x,4.8,-9.36,warm);
    sign(['THE EVERGREEN', 'HOTEL'],6,3.1,-9.3,4.4,.8);
    box(3,1,.8,6,.6,-12.7,wood);box(3.2,.1,1,6,1.15,-12.7,cream);
    const hotelLight=new THREE.PointLight(0xf7ce89,15,9,1.6);hotelLight.position.set(6,2.5,-11.5);r.add(hotelLight);
    const book=box(.62,.05,.4,6,1.23,-12.5,std(0xd4c9a4));
    sign(['ROOM  /  315'],6,1.27,-12.28,.58,.15,'#ded0a3');
    this.add(book,{id:'town:ledger',label:'旅馆 · 住客登记簿',radius:4,anchor:new THREE.Vector3(0,.35,0),use:()=>this.investigate('ledger')});
    // The forest clearing: three stones, a radio, and a curtain that wakes up.
    for(let i=0;i<9;i++) {
      const a=i/9*Math.PI*2;const m=new THREE.Mesh(new THREE.DodecahedronGeometry(.32,0),std(0x556663));
      m.scale.y=.65;m.position.set(Math.sin(a)*2.6,.18,-22+Math.cos(a)*2.6);r.add(m);
    }
    const radio=box(.7,.45,.25,0,.5,-21.2,wood);
    sign(['315  •  FM'],0,.55,-21.06,.55,.16,'#dfad70');
    this.add(radio,{id:'town:radio',label:'森林 · 留下的收音机',radius:4,anchor:new THREE.Vector3(0,.6,0),use:()=>this.investigate('radio')});
    const curtain=curtainWall(2.4,3.5,curtainMaterial(0x771522,{time:this.time}),70);curtain.position.set(0,0,-24);r.add(curtain);
    this.portalLight=new THREE.PointLight(0xff6455,0,7,1.5);this.portalLight.position.set(0,2,-23);r.add(this.portalLight);
    this.add(curtain,{id:'town:return',label:'林间幕布 · 回到红房间',radius:4,anchor:new THREE.Vector3(0,1.6,.1),use:()=>this.game.story.returnToRoom()});
    for(const [x,z] of [[2.5,1],[-2.5,-8],[2.5,-18]]) {
      box(.08,3.9,.08,x,1.95,z,dark);box(.65,.08,.15,x-.28,3.9,z,dark);box(.35,.04,.2,x-.48,3.84,z,warm);
    }
    sign(['THE WOODS  /  森林'],0,2.5,-18,2.6,.45,'#a6c4bb');
    // Spherical collision samples form continuous barriers along the walls and counters.
    for (const [x1,z1,x2,z2] of [[-9,-5.5,-3,-5.5],[-9,-5.5,-9,-.5],[3,-14.5,9,-14.5],[9,-14.5,9,-9.5],[-8.2,-3.9,-3.8,-3.9],[4.5,-12.7,7.5,-12.7]]) {
      const n=Math.ceil(Math.hypot(x2-x1,z2-z1)/.35);
      for(let i=0;i<=n;i++) this.colliders.push({x:x1+(x2-x1)*i/n,z:z1+(z2-z1)*i/n,r:.22});
    }
    this.root.traverse(o=>{if(o.isMesh)o.receiveShadow=true;});
  }
  enter() {super.enter();this.game.camera.bounds=this.bounds;this.game.camera.colliders=this.colliders;this.game.camera.free=true;this.game.camera.eyeY=1.6;}
  startAmbience() {
    const a=this.game.audio;
    a.spatial('roomtone',null,.3);
    a.spatial('hum',new THREE.Vector3(-6,2,-3),.25,'［左侧：餐馆灯管的嗡鸣］');
    a.spatial('murmur',new THREE.Vector3(6,2,-12),.3,'［右侧：旅馆深处传来低语］');
    a.spatial('rustle',new THREE.Vector3(0,1,-22),.6,'［前方：森林里的风］');
  }
  async investigate(id) {
    const g=this.game,s=g.state;
    const lines={
      coffee:{who:'餐馆 · 咖啡',text:'杯沿留下一个完整的圆。杯底的账单写着：315 房，今晚不要关收音机。'},
      ledger:{who:'旅馆 · 登记簿',text:'315 房的客人连续住了二十五年。每一页的名字不同，笔迹却完全一样。最后的地址只有两个字：林间。'},
      radio:{who:'森林 · 收音机',text:'旋钮停在 3、1、5 之间。嘶嘶声里，你听到了餐馆的杯碟和旅馆的脚步。三个地方，原来是同一段记忆。'},
    };
    g.busy=true;
    try {
      await g.story.say(lines[id]);
      s.flags[`town:${id}`]=true;
      g.discover({id:`town:${id}`,label:lines[id].who});
      if(['coffee','ledger','radio'].every(k=>s.flags[`town:${k}`])&&!s.flags.townComplete) {
        s.flags.townComplete=true;g.audio.event('fragment');
        await g.story.say({who:'小镇的回声',text:'你把这段记忆留在了发现记录中。森林尽头的红幕亮了起来。你随时可以回来。'});
      }
      g.ui.updateHud();g.autosave();
    } finally {g.busy=false;}
  }
  update(dt,t) {super.update(dt,t);this.portalLight.intensity += ((this.game.state.flags.townComplete?8:1)-this.portalLight.intensity)*Math.min(1,dt*2);}
}
