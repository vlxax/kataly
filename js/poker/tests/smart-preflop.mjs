import assert from 'node:assert/strict';
import {decidePreflop,describeHand,openThreshold} from '../preflopStrategy.js';

const fixed=()=>.99;
const neutral={archetype:'balanced',loose:0,agg:.05,mistakeRate:.035};
function legal(overrides={}){
  return Object.assign({
    toCall:100,toCallBB:1,canCheck:false,canRaise:true,minRaise:200,maxRaise:10000,
    stack:9900,stackBB:99,effectiveStackBB:100,pot:250,potBB:2.5,bb:100,
    currentBet:100,currentBetBB:1,preflopRaiseCount:0
  },overrides);
}

assert.ok(openThreshold('BTN')<openThreshold('UTG'),'BTN must open wider than UTG');
assert.ok(describeHand(['As','Ah']).strength>describeHand(['7s','2d']).strength);

// Same marginal hand is opened on BTN and folded UTG.
{
  const btn=decidePreflop({hole:['Ts','7s'],position:'BTN',legal:legal(),profile:neutral,rng:fixed});
  const utg=decidePreflop({hole:['Ts','7s'],position:'UTG',legal:legal(),profile:neutral,rng:fixed});
  assert.equal(btn.type,'raise');
  assert.equal(utg.type,'fold');
}

// At 10 BB a playable late-position hand uses push/fold, not a small open.
{
  const action=decidePreflop({
    hole:['As','5s'],position:'BTN',profile:neutral,rng:fixed,
    legal:legal({stack:900,stackBB:9,effectiveStackBB:10,maxRaise:1000})
  });
  assert.equal(action.type,'allin');
  assert.match(action.reason,/push\/fold/);
}

// Premium hand facing an open 3-bets; trash folds.
{
  const facing=legal({toCall:500,toCallBB:5,currentBet:600,currentBetBB:6,minRaise:1100,pot:850,potBB:8.5,preflopRaiseCount:1});
  const premium=decidePreflop({hole:['As','Ah'],position:'CO',legal:facing,profile:neutral,rng:fixed});
  const trash=decidePreflop({hole:['7s','2d'],position:'CO',legal:facing,profile:neutral,rng:fixed});
  assert.equal(premium.type,'raise');
  assert.equal(trash.type,'fold');
  assert.match(premium.reason,/value 3-bet/);
}

console.log('SMART_PREFLOP_OK');
