
import {HoldemDemo} from '../engine.js';
const players=Array.from({length:6},(_,i)=>({nick:i===0?'Hero':'B'+i,type:'bot'}));
let decisions=0,hands=0,phases=[];
const e=new HoldemDemo({
 players,heroNick:'Hero',stackBB:30,smallBlind:50,bigBlind:100,
 levelSeconds:999999,botDelayMs:0,eventPaceMs:0,dealPaceMs:0,boardPaceMs:0,testMode:true,
 onChange:s=>phases.push(s.phase),
 onHeroDecision:(legal,res)=>{decisions++;res({type:legal.canCheck?'check':'call'});},
 onHandEnd:()=>hands++
});
await e.startHand();
if(hands!==1)throw new Error('hand did not finish');
if(decisions<1)throw new Error('hero never acted');
if(!phases.includes('dealing')||!phases.includes('action'))throw new Error('deal/action phases missing');
e.destroy();
console.log(JSON.stringify({ok:true,hands,decisions,phases:[...new Set(phases)]}));
