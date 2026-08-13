import assert from 'node:assert/strict';
import {HoldemDemo} from '../engine.js?v=200';

const g=new HoldemDemo({
  heroNick:'Hero',
  players:[{nick:'Hero'},{nick:'A'}],
  stackBB:100,botDelayMs:0,eventPaceMs:0,levelSeconds:99999
});

// Uncontested pot must go to the remaining player and use string winner names.
g.players[0].stack=9000;
g.players[1].stack=9000;
g.players[0].folded=false;
g.players[1].folded=true;
g.pot=2000;
const before=g.players[0].stack;
const awards=g.showdown();
assert.equal(g.players[0].stack,before+2000);
assert.deepEqual(awards[0].winners,['Hero']);

// Raw event history must be populated for diagnostics.
g.event('TEST_EVENT',{x:1});
assert.equal(g.handHistory.at(-1).type,'TEST_EVENT');

g.destroy();
assert.equal(g.destroyed,true);
console.log('V8_REGRESSION_OK');
