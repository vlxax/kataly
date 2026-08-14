import assert from 'node:assert/strict';
import {HoldemDemo} from '../engine.js';

function engine(names){
  return new HoldemDemo({
    heroNick:names[0],
    players:names.map(nick=>({nick,type:'bot'})),
    stackBB:10,
    smallBlind:1,
    bigBlind:2,
    levelSeconds:999999,
    botDelayMs:0,
    eventPaceMs:0,
    dealPaceMs:0,
    boardPaceMs:0,
    testMode:true
  });
}

function setPlayer(player,next){
  Object.assign(player,{
    stack:0,bet:0,totalBet:0,folded:false,out:false,allIn:true,
    hole:[],position:'',lastAction:''
  },next);
}

// Two all-in winners split an odd pot. The first odd chip goes clockwise from
// the button even though both winners have zero chips before the award.
{
  const g=engine(['Hero','A','B']);
  g.button=2;
  g.board=['Ah','Kd','Qc','Js','2h'];
  setPlayer(g.players[0],{hole:['Ts','3c'],totalBet:5});
  setPlayer(g.players[1],{hole:['Tc','4c'],totalBet:5});
  setPlayer(g.players[2],{hole:['9s','8s'],totalBet:5});
  g.pot=15;
  const awards=g.showdown();
  assert.equal(awards.reduce((sum,a)=>sum+a.amount,0),15);
  assert.deepEqual(g.players.map(p=>p.stack),[8,7,0]);
  assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0),15);
  g.destroy();
}

// Nested all-ins: Hero wins the main pot, A wins the side pot and B receives
// the unmatched top layer back. No chip may disappear or be created.
{
  const g=engine(['Hero','A','B']);
  g.button=2;
  g.board=['2h','3d','4c','9s','Kh'];
  setPlayer(g.players[0],{hole:['As','5s'],totalBet:50});
  setPlayer(g.players[1],{hole:['Kc','Qd'],totalBet:100});
  setPlayer(g.players[2],{hole:['Qc','Jc'],totalBet:200});
  g.pot=350;
  const awards=g.showdown();
  assert.deepEqual(g.players.map(p=>p.stack),[150,100,100]);
  assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0),350);
  assert.ok(awards.some(a=>a.amount===100&&a.winners.length===1&&a.winners[0]==='B'));
  g.destroy();
}

// Simultaneous busts are deterministic: among players eliminated in the same
// hand, the larger hand-starting stack receives the higher finishing place.
{
  const g=engine(['Hero','A','B','D']);
  g.handNo=7;
  g.board=['2h','3d','4c','9s','Kh'];
  setPlayer(g.players[0],{hole:['Qc','Jc'],totalBet:100,handStartStack:500});
  setPlayer(g.players[1],{hole:['Qh','Th'],totalBet:100,handStartStack:300});
  setPlayer(g.players[2],{hole:['As','5s'],totalBet:100,handStartStack:200});
  setPlayer(g.players[3],{stack:500,totalBet:0,allIn:false,folded:true,handStartStack:500});
  g.pot=300;
  g.finishHand();
  const hero=g.eliminations.find(e=>e.nick==='Hero');
  const a=g.eliminations.find(e=>e.nick==='A');
  assert.equal(hero.place,3);
  assert.equal(a.place,4);
  assert.equal(g.players.reduce((sum,p)=>sum+p.stack,0),800);
  g.destroy();
}

// Heads-up positions: button posts SB and acts first preflop; BB is first
// postflop actor.
{
  const g=engine(['Hero','A']);
  g.button=0;
  g.assignPositions();
  assert.equal(g.players[0].position,'BTN/SB');
  assert.equal(g.players[1].position,'BB');
  assert.equal(g.firstPostflopActor(),1);
  g.destroy();
}

console.log('TOURNAMENT_EDGE_CASES_OK');
