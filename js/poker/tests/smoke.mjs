
import { HoldemDemo } from '../engine.js';

const players = [
  {nick:'Hero', type:'bot'},
  {nick:'Bot1', type:'bot'},
  {nick:'Bot2', type:'bot'},
  {nick:'Bot3', type:'bot'},
  {nick:'Bot4', type:'bot'},
  {nick:'Bot5', type:'bot'}
];

let decisions = 0;
let hands = 0;

const engine = new HoldemDemo({
  players,
  heroNick:'Hero',
  stackBB:20,
  smallBlind:50,
  bigBlind:100,
  levelSeconds:999999,
  botDelayMs:0,
  onHeroDecision:(legal, resolve) => {
    decisions++;
    resolve({type:legal.canCheck ? 'check' : 'call'});
  },
  onHandEnd:() => { hands++; }
});

await engine.startHand();

if(hands !== 1) throw new Error(`Expected 1 hand, got ${hands}`);
if(engine.sessionHands.length !== 1) throw new Error('Hand history was not written');
if(engine.sessionHands[0].board.length > 5) throw new Error('Board is invalid');

const seen = [];
engine.players.forEach(p => p.hole.forEach(c => seen.push(c)));
engine.sessionHands[0].board.forEach(c => seen.push(c));

if(new Set(seen).size !== seen.length){
  throw new Error('Duplicate cards detected');
}

engine.destroy();

console.log(JSON.stringify({
  ok:true,
  hands,
  decisions,
  board:engine.sessionHands[0].board,
  winners:engine.sessionHands[0].winners
}, null, 2));
