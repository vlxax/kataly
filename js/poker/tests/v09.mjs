
import {HoldemDemo} from '../engine.js';
const players=[
 {nick:'Hero',type:'bot'},{nick:'B1',type:'bot'},{nick:'B2',type:'bot'},
 {nick:'B3',type:'bot'},{nick:'B4',type:'bot'},{nick:'B5',type:'bot'}
];
let heroDecisions=0, hands=0;
const e=new HoldemDemo({
 players,heroNick:'Hero',stackBB:50,smallBlind:50,bigBlind:100,
 levelSeconds:999999,botDelayMs:0,testMode:true,
 onHeroDecision:(legal,res)=>{
   heroDecisions++;
   if(legal.canCheck)res({type:'check'});
   else if(legal.toCall<=legal.stack*.10)res({type:'call'});
   else res({type:'fold'});
 },
 onHandEnd:()=>hands++
});
for(let i=0;i<5;i++){
 if(e.finished)break;
 await e.startHand();
}
if(heroDecisions<1)throw new Error('Hero never received a decision');
if(hands<1)throw new Error('No hand completed');
e.destroy();
console.log(JSON.stringify({ok:true,heroDecisions,hands}));
