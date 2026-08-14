import assert from 'node:assert/strict';
import {HoldemDemo} from '../engine.js';

function mulberry32(seed){
  return function(){
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return((t^t>>>14)>>>0)/4294967296;
  };
}

async function run(seed){
  const players=Array.from({length:6},(_,i)=>({nick:i?'Bot'+i:'Hero',type:i?'bot':'real'}));
  const engine=new HoldemDemo({
    players,
    heroNick:'Hero',
    stackBB:30,
    levelSeconds:999999,
    botDelayMs:0,
    eventPaceMs:0,
    dealPaceMs:0,
    boardPaceMs:0,
    testMode:true,
    rng:mulberry32(seed),
    onHeroDecision:(legal,resolve)=>resolve({type:legal.canCheck?'check':'call'})
  });
  await engine.startHand();
  const result={
    heroHole:engine.sessionHands[0].heroHole,
    board:engine.sessionHands[0].board,
    winners:engine.sessionHands[0].winners,
    actions:engine.sessionHands[0].actions.map(a=>({player:a.player,street:a.street,action:a.action,amountBB:a.amountBB}))
  };
  engine.destroy();
  return result;
}

const first=await run(20260814);
const replay=await run(20260814);
const different=await run(20260815);
assert.deepEqual(replay,first,'same seed must reproduce the hand and bot decisions');
assert.notDeepEqual(different.heroHole.concat(different.board),first.heroHole.concat(first.board),'different seed should change the deal');

console.log('SEEDED_ENGINE_OK');
