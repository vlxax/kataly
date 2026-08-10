
import { BOT_ARCHETYPES } from './personalities.js';
export { BOT_ARCHETYPES };
export function makeBots(count){
  const list=[];
  for(let i=0;i<count;i++){
    const b=BOT_ARCHETYPES[i % BOT_ARCHETYPES.length];
    list.push({...b,id:`bot_${Date.now()}_${i}`});
  }
  return list;
}
