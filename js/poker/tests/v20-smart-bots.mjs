
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HoldemDemo} from '../engine.js';

const players=['Hero','A','B','C','D','E'].map(nick=>({nick,type:'bot'}));
const g=new HoldemDemo({players,heroNick:'Nobody',stackBB:100,botDelayMs:0,eventPaceMs:0,levelSeconds:99999});

// Postflop evaluator must value strong made hands above naked air.
g.board=['Ah','Kd','7c'];
let p={nick:'A',position:'BTN',hole:['As','Ad'],stack:5000,bet:0,totalBet:0,folded:false,out:false,allIn:false};
let strong=g.postflopFeatures(p);
p={nick:'A',position:'BTN',hole:['2s','3d'],stack:5000,bet:0,totalBet:0,folded:false,out:false,allIn:false};
let weak=g.postflopFeatures(p);
assert.ok(strong.strength>weak.strength,'made hand should outrank air');

// Flush draw must be detected.
g.board=['Ah','7h','2c'];
p={nick:'A',position:'BTN',hole:['Kh','Qh'],stack:5000,bet:0,totalBet:0,folded:false,out:false,allIn:false};
assert.equal(g.postflopFeatures(p).flushDraw,true);
g.destroy();

// UI contract: no opponent narration block at bottom, Hero position is permanent.
const view=fs.readFileSync(new URL('../tableView.js',import.meta.url),'utf8');
assert.equal(view.includes('id="v1TurnStatus"'),false,'opponent status block should be removed');
assert.ok(view.includes('POSITION ${hero.position'), 'Hero position must remain in HUD');
assert.ok(view.includes("classList.add('v1-controls-hidden')"),'controls should hide outside Hero turn');
console.log('V20_SMART_BOTS_OK');
