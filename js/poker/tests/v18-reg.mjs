
import assert from 'node:assert/strict';
import {HoldemDemo} from '../engine.js';

const players=['Hero','A','B','C','D','E'].map(nick=>({nick,type:'bot'}));

{
  const g=new HoldemDemo({players,heroNick:'Nobody',stackBB:20,botDelayMs:0,eventPaceMs:0,levelSeconds:99999});
  g._testSetState({players:[
    {seat:0,nick:'A',stack:0,bet:100,totalBet:100,allIn:true},
    {seat:1,nick:'B',stack:0,bet:100,totalBet:100,allIn:true}
  ],currentBet:100,lastFullRaise:100,pot:200});
  assert.equal(g.bettingIsLocked(),true);
  g.destroy();
}

{
  const g=new HoldemDemo({players,heroNick:'Nobody',stackBB:100,botDelayMs:0,eventPaceMs:0,levelSeconds:99999});
  const initial=g.players.reduce((s,p)=>s+p.stack,0);
  for(let i=0;i<100 && !g.finished;i++){
    await g.startHand();
    const cards=[...g.board,...g.players.flatMap(p=>p.hole||[])].filter(Boolean);
    assert.equal(new Set(cards).size,cards.length,'duplicate card');
    assert.equal(g.players.reduce((s,p)=>s+p.stack,0),initial,'chip conservation');
  }
  assert.ok(g.handNo>0);
  g.destroy();
}
console.log('V18_REG_OK');
