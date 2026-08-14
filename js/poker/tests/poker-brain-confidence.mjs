import assert from 'node:assert/strict';
import {analyzeSession} from '../../analytics/sessionAnalysis.js';

const base={
  handNo:1,player:'Hero',position:'CO',heroHole:['7s','2d'],board:[],
  amountBB:3,toCallBB:3,currentBetBB:3,potBeforeBB:4,potAfterBB:7,
  stackAfterBB:40,effectiveStackBeforeBB:43,preflopRaiseCount:1
};
const hands=[{handNo:1,actions:[
  {...base,street:'preflop',action:'call'},
  {...base,handNo:2,street:'river',action:'raise',amountBB:20,potBeforeBB:10,toCallBB:0},
  {...base,handNo:3,street:'flop',action:'fold',toCallBB:0}
]}];

const result=analyzeSession({hands,heroNick:'Hero'});
assert.equal(result.method.solver,false);
assert.ok(result.tagged.every(x=>typeof x.confidence==='number'&&x.confidenceLabel));
assert.ok(result.tagged.some(x=>x.verdict==='likely_error'));
assert.ok(result.tagged.some(x=>x.verdict==='questionable'));
assert.ok(result.tagged.some(x=>x.verdict==='confirmed_error'));

console.log('POKER_BRAIN_CONFIDENCE_OK');
