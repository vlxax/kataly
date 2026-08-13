import assert from 'node:assert/strict';
import {HoldemDemo,evaluate7} from '../engine.js';
import {createDeck} from '../deck.js';

const total=e=>e.players.reduce((sum,p)=>sum+p.stack,0);
const players=n=>Array.from({length:n},(_,i)=>({nick:i?'Bot'+i:'Hero',type:i?'bot':'real'}));
const auto=(legal,resolve)=>resolve({type:legal.canCheck?'check':'call'});

assert.equal(createDeck().length,52);
assert.equal(new Set(createDeck()).size,52);
assert.equal(evaluate7(['As','Ks','Qs','Js','Ts','2d','3c'])[0],8);

for(const seats of [6,9]){
  let ended=0;
  const e=new HoldemDemo({players:players(seats),heroNick:'Hero',stackBB:30,botDelayMs:0,eventPaceMs:0,dealPaceMs:0,boardPaceMs:0,testMode:true,levelSeconds:999999,onHeroDecision:auto,onHandEnd:()=>ended++});
  const before=total(e);
  await e.startHand();
  assert.equal(ended,1,`${seats}-max must finish a hand`);
  assert.equal(total(e),before,`${seats}-max must conserve chips`);
  assert.ok(e.players.every(p=>p.out||p.hole.length===2),`${seats}-max players need two cards`);
  e.destroy();
}

// A short BB is all-in after ante/blind but still receives two cards.
{
  const e=new HoldemDemo({players:players(6),heroNick:'Hero',stackBB:1,smallBlind:50,bigBlind:100,botDelayMs:0,eventPaceMs:0,dealPaceMs:0,boardPaceMs:0,testMode:true,levelSeconds:999999,onHeroDecision:auto});
  const before=total(e);
  await e.startHand();
  assert.ok(e.players.every(p=>p.hole.length===2||p.out),'all-in blind must receive two cards');
  assert.equal(total(e),before,'short blind hand must conserve chips');
  e.destroy();
}

// Destroy cancels a running hand rather than completing it in the background.
{
  let ended=0;
  const e=new HoldemDemo({players:players(6),heroNick:'Hero',botDelayMs:100,eventPaceMs:100,dealPaceMs:100,boardPaceMs:100,onHeroDecision:auto,onHandEnd:()=>ended++});
  const run=e.startHand();
  e.destroy();
  await run;
  assert.equal(ended,0,'destroyed hand must not finish');
}

console.log('KATALY_CORE_VNEXT_OK');
