
import assert from 'node:assert/strict';
import {HoldemDemo} from '../engine.js';

function mk(){
  return new HoldemDemo({
    heroNick:'Hero',
    players:[
      {nick:'Hero',isHero:true},{nick:'A'},{nick:'B'},{nick:'C'},{nick:'D'},{nick:'E'}
    ],
    stackBB:50, levelSeconds:99999, botDelayMs:0, eventPaceMs:0
  });
}

// EVENT integrity
{
  const g=mk(); g.handHistory=[];
  let got=null; g.on('TEST_EVENT',e=>got=e);
  g.event('TEST_EVENT',{x:7});
  assert.equal(got.x,7);
  assert.equal(g.handHistory.at(-1).type,'TEST_EVENT');
  g.destroy();
}

// MINRAISE: current bet 200, last full raise 100 => minimum target 300.
{
  const g=mk();
  g._testSetState({players:[
    {nick:'Hero',stack:4800,bet:200,totalBet:200},
    {nick:'A',stack:4800,bet:200,totalBet:200}
  ],currentBet:200,lastFullRaise:100,pot:400});
  const l=g.legalFor(g.players[0],true);
  assert.equal(l.minRaise,300);
  g.destroy();
}

// SHORT ALL-IN must not count as a full raise.
// Current bet 1000, previous full raise increment 1000; player can only reach 1400.
{
  const g=mk();
  g._testSetState({players:[
    {nick:'Hero',stack:400,bet:1000,totalBet:1000},
    {nick:'A',stack:5000,bet:1000,totalBet:1000}
  ],currentBet:1000,lastFullRaise:1000,pot:2000});
  const p=g.players[0], legal=g.legalFor(p,true);
  const out=g.applyAction(p,{type:'allin'},legal,{potBefore:2000,decisionMs:1});
  assert.equal(out.fullRaise,false);
  assert.equal(g.currentBet,1400);
  assert.equal(g.lastFullRaise,1000);
  g.destroy();
}

// FULL raise updates lastFullRaise.
{
  const g=mk();
  g._testSetState({players:[
    {nick:'Hero',stack:5000,bet:1000,totalBet:1000},
    {nick:'A',stack:5000,bet:1000,totalBet:1000}
  ],currentBet:1000,lastFullRaise:1000,pot:2000});
  const p=g.players[0], legal=g.legalFor(p,true);
  const out=g.applyAction(p,{type:'raise',amount:2000},legal,{potBefore:2000,decisionMs:1});
  assert.equal(out.fullRaise,true);
  assert.equal(g.currentBet,2000);
  assert.equal(g.lastFullRaise,1000);
  g.destroy();
}

// SIDE POTS: 100 / 60 / 200 BB-style units => 180 main, 80 side, 100 uncontested layer.
{
  const g=mk();
  g._testSetState({players:[
    {seat:0,nick:'Hero',stack:0,totalBet:100,allIn:true},
    {seat:1,nick:'A',stack:0,totalBet:60,allIn:true},
    {seat:2,nick:'B',stack:0,totalBet:200,allIn:true}
  ],pot:360});
  const contenders=g.players;
  const pots=g.buildSidePots(contenders);
  assert.deepEqual(pots.map(p=>p.size),[180,80,100]);
  assert.deepEqual(pots.map(p=>p.eligible.map(x=>x.seat)),[[0,1,2],[0,2],[2]]);
  g.destroy();
}

// Folded dead money belongs in pot but folded player is never eligible.
{
  const g=mk();
  g._testSetState({players:[
    {seat:0,nick:'Hero',stack:0,totalBet:50,folded:true},
    {seat:1,nick:'A',stack:0,totalBet:50,allIn:true},
    {seat:2,nick:'B',stack:0,totalBet:50,allIn:true}
  ],pot:150});
  const contenders=g.players.filter(p=>!p.folded);
  const pots=g.buildSidePots(contenders);
  assert.equal(pots[0].size,150);
  assert.deepEqual(pots[0].eligible.map(x=>x.seat),[1,2]);
  g.destroy();
}

console.log('ENGINE_TRUST_OK');
