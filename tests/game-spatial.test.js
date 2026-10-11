import { describe,it,expect } from 'vitest';
import * as THREE from 'three';
import {World} from '../src/game/world.js';
import {Player,H} from '../src/game/player.js';
const sound=new Proxy({}, {get:()=>()=>{}});
function setup(){const scene=new THREE.Scene(),world=new World(scene);world.solid([-10,-1,-3],[10,0,3]);const mesh=new THREE.Mesh(new THREE.BoxGeometry(.4,H,.4));mesh.position.y=H/2;const root=new THREE.Group();root.add(mesh);const p=new Player({scene:root,animations:[]},sound);p.pos.set(-2,0,0);return {world,p};}
const idle={x:0,z:0,grab:false};
describe('game spatial contact',()=>{
 it('lands with feet on the floor and does not sink after repeated steps',()=>{const {world,p}=setup();p.pos.y=2;for(let i=0;i<180;i++)p.update(1/60,idle,world);expect(p.pos.y).toBeCloseTo(.0001,4);expect(p.onGround).toBe(true);});
 it('stops at a solid wall instead of crossing it while running',()=>{const {world,p}=setup();world.solid([0,0,-3],[1,4,3],{noClimb:true});for(let i=0;i<100;i++)p.update(1/60,{...idle,x:1,run:true},world);expect(p.aabb().max[0]).toBeLessThanOrEqual(0);});
 it('can traverse the corrected one-metre shore boulder',()=>{const {world,p}=setup();world.solid([-6.2,0,-1.8],[-4.6,1,1]);p.pos.set(-7,0,.1);for(let i=0;i<8;i++)p.update(1/60,idle,world);for(let i=0;i<160;i++)p.update(1/60,{...idle,x:1,jumpHeld:true,jumpPressed:i===0},world);expect(p.pos.x).toBeGreaterThan(-4.3);});
 it('keeps pushed geometry and collider at the same ground height',()=>{const {world,p}=setup();const mesh=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.5,1.4));mesh.position.set(0,.75,0);mesh.userData.offset=new THREE.Vector3(0,.75,0);const m=world.movable(mesh,[1.6,1.5,1.4]);p.pos.set(-1.1,.0001,0);p.onGround=true;for(let i=0;i<40;i++)p.update(1/60,{...idle,x:1,grab:true},world);const bounds=new THREE.Box3().setFromObject(mesh);expect(m.min[1]).toBe(0);expect(bounds.min.y).toBe(m.min[1]);expect(mesh.position.x).toBeGreaterThan(.2);expect(p.aabb().max[0]).toBeLessThanOrEqual(m.min[0]+.05);});
});
