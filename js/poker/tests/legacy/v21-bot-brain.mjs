
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HoldemDemo} from '../engine.js';

const players=['Hero','A','B','C','D','E'].map(nick=>({nick,type:'bot'}));
const g=new HoldemDemo({players,heroNick:'Nobody',stackBB:100,botDelayMs:0,eventPaceMs:0,levelSeconds:99999});

// Range discipline: premium always in UTG, trash not in UTG, BTN wider.
assert.equal(g.inRange('AA',g.positionRanges('UTG')),true);
assert.equal(g.inRange('72o',g.positionRanges('UTG')),false);
assert.equal(g.inRange('A2s',g.positionRanges('BTN')),true);
assert.equal(g.inRange('A2s',g.positionRanges('UTG')),false);

// BB defend wider than generic non-BB defend.
const prof=g.preflopProfile({seat:1,nick:'A'});
assert.equal(g.inRange('K9o',g.defendRange('BB',prof)),true);
assert.equal(g.inRange('K9o',g.defendRange('CO',prof)),false);

// Range advantage differs by texture/position.
g.board=['As','Kd','3c'];
assert.ok(g.rangeAdvantage({position:'UTG'})>g.rangeAdvantage({position:'BB'}));
g.board=['7s','6d','5c'];
assert.ok(g.rangeAdvantage({position:'BB'})>=g.rangeAdvantage({position:'UTG'}));
g.destroy();

const view=fs.readFileSync(new URL('../tableView.js',import.meta.url),'utf8');
assert.ok(view.includes("hero-seat"),'Hero oval seat must be compact');
assert.ok(view.includes('st.vpip'),'bot HUD stats missing');
console.log('V21_BOT_BRAIN_OK');
