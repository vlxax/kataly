
import { HoldemDemo, evaluate7 } from '../engine.js';
import { createDeck } from '../deck.js';

function assert(cond, msg){
  if(!cond) throw new Error(msg);
}

function totalStacks(engine){
  return engine.players.reduce((s,p)=>s+p.stack,0);
}

function autoHero(legal, resolve){
  if(legal.canCheck) return resolve({type:'check'});
  if(legal.toCall <= legal.stack*0.12) return resolve({type:'call'});
  return resolve({type:'fold'});
}

// Deck
const deck = createDeck();
assert(deck.length===52, 'Deck must contain 52 cards');
assert(new Set(deck).size===52, 'Deck cards must be unique');

// Evaluator sanity
assert(evaluate7(['As','Ks','Qs','Js','Ts','2d','3c'])[0]===8, 'Royal/straight flush failed');
assert(evaluate7(['Ah','Ad','Ac','As','2d','3c','4h'])[0]===7, 'Quads failed');
assert(evaluate7(['Ah','Ad','Ac','Kd','Ks','3c','4h'])[0]===6, 'Full house failed');

async function runOne(seats){
  const players=Array.from({length:seats},(_,i)=>({nick:i===0?'Hero':'Bot'+i,type:'bot'}));
  let firstLegal=null;
  let handEnd=null;

  const e=new HoldemDemo({
    players,
    heroNick:'Hero',
    stackBB:50,
    smallBlind:50,
    bigBlind:100,
    levelSeconds:999999,
    botDelayMs:0,
    onHeroDecision:(legal,res)=>{
      if(!firstLegal) firstLegal=Object.assign({},legal);
      autoHero(legal,res);
    },
    onHandEnd:h=>handEnd=h
  });

  const initialTotal=totalStacks(e);
  await e.startHand();

  assert(handEnd, `${seats}-max hand did not finish`);
  assert(e.players.filter(p=>!p.out).every(p=>p.hole.length===2), `${seats}-max: not every active player has 2 cards`);

  const allCards=[];
  e.players.forEach(p=>p.hole.forEach(c=>allCards.push(c)));
  handEnd.board.forEach(c=>allCards.push(c));
  assert(new Set(allCards).size===allCards.length, `${seats}-max duplicate cards`);

  // No chips are created/destroyed after payouts.
  assert(totalStacks(e)===initialTotal, `${seats}-max chip conservation failed`);

  e.destroy();
  return {firstLegal, handEnd};
}

await runOne(6);
await runOne(9);

// Direct BBA test: hero chosen UTG in 6-max and should face exactly 1 BB preflop,
// not 2 BB caused by incorrectly counting BB ante as a live bet.
{
  const players=Array.from({length:6},(_,i)=>({nick:i===3?'Hero':'Bot'+i,type:'bot'}));
  let firstLegal=null;
  const e=new HoldemDemo({
    players,
    heroNick:'Hero',
    stackBB:100,
    smallBlind:50,
    bigBlind:100,
    levelSeconds:999999,
    botDelayMs:0,
    onHeroDecision:(legal,res)=>{
      if(!firstLegal) firstLegal=Object.assign({},legal);
      res({type:'fold'});
    }
  });
  await e.startHand();
  assert(firstLegal, 'BBA test did not reach Hero');
  assert(firstLegal.toCall===100, `BBA bug: expected UTG call 100, got ${firstLegal.toCall}`);
  e.destroy();
}

// Stress: many hands / tournament protocol
{
  const players=Array.from({length:6},(_,i)=>({nick:i===0?'Hero':'Bot'+i,type:'bot'}));
  let errors=[];
  let hands=0;
  const e=new HoldemDemo({
    players,
    heroNick:'Hero',
    stackBB:25,
    smallBlind:50,
    bigBlind:100,
    levelSeconds:999999,
    botDelayMs:0,
    onHeroDecision:autoHero,
    onHandEnd:()=>hands++
  });

  for(let i=0;i<100;i++){
    if(e.finished) break;
    try{
      await e.startHand();
    }catch(err){
      errors.push(String(err));
      break;
    }
  }

  assert(errors.length===0, `Stress error: ${errors[0]}`);
  assert(hands>3, `Stress test too few hands: ${hands}`);
  e.destroy();
  console.log('stress hands:',hands);
}

console.log('ALL_ENGINE_TESTS_OK');
