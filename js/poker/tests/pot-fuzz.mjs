
import assert from 'node:assert/strict';
import {HoldemDemo} from '../engine.js';

for(let t=0;t<500;t++){
  const n=2+Math.floor(Math.random()*7);
  const players=Array.from({length:n},(_,i)=>({
    seat:i,nick:`P${i}`,stack:0,totalBet:1+Math.floor(Math.random()*200),
    folded:Math.random()<.25,allIn:true
  }));
  if(players.every(p=>p.folded))players[0].folded=false;
  const g=new HoldemDemo({heroNick:'P0',players:players.map(p=>({nick:p.nick})),stackBB:50,levelSeconds:99999,botDelayMs:0,eventPaceMs:0,testMode:true});
  g.players=players.map((p,i)=>Object.assign({
    type:'bot',style:'',seat:i,bet:0,out:false,hole:[],position:'',lastAction:''
  },p));
  g.pot=players.reduce((s,p)=>s+p.totalBet,0);
  const contenders=g.players.filter(p=>!p.folded);
  const pots=g.buildSidePots(contenders);
  assert.equal(pots.reduce((s,p)=>s+p.size,0),g.pot);
  for(const pot of pots)assert.ok(pot.participants.length>0);
  g.destroy();
}
console.log('POT_FUZZ_OK');
