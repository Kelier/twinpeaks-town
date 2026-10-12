import { createTitleScene } from './title-scene.js';
let room;
self.onmessage=({data})=>{
  if(data.type==='init')room=createTitleScene(data.canvas,data.options,state=>self.postMessage({type:'state',state}));
  else if(data.type==='dispose'){room?.dispose();self.close();}
  else room?.command(data);
};
