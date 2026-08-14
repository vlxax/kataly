
import {HoldemDemo} from '../engine.js';
const players=Array.from({length:6},(_,i)=>({nick:i===0?'Hero':'B'+i,type:'bot'}));
const events=[];let hands=0,heroDecisions=0;
const e=new HoldemDemo({
  players,heroNick:'Hero',stackBB:30,smallBlind:50,bigBlind:100,
  levelSeconds:999999,botDelayMs:0,eventPaceMs:0,dealPaceMs:0,boardPaceMs:0,testMode:true,
  onHeroDecision:(legal,res)=>{heroDecisions++;res({type:legal.canCheck?'check':'call'});},
  onHandEnd:()=>hands++
});
e.on('*',ev=>events.push(ev.type));
await e.startHand();
if(!events.includes('HAND_STARTED'))throw new Error('missing HAND_STARTED');
if(events.filter(x=>x==='CARD_DEALT').length!==12)throw new Error('expected 12 CARD_DEALT');
if(!events.includes('STREET_STARTED'))throw new Error('missing streets');
if(!events.includes('BETTING_ROUND_COMPLETE'))throw new Error('missing betting complete');
if(!events.includes('HAND_FINISHED'))throw new Error('missing hand finished');
if(hands!==1||heroDecisions<1)throw new Error('hand flow failed');
e.destroy();
console.log(JSON.stringify({ok:true,hands,heroDecisions,eventCount:events.length,unique:[...new Set(events)]}));
