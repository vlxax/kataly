
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {HoldemDemo} from '../engine.js';

const engine=fs.readFileSync(new URL('../engine.js',import.meta.url),'utf8');
const view=fs.readFileSync(new URL('../tableView.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../../../css/kataly.css',import.meta.url),'utf8');

assert.ok(engine.includes('botThinkDelay(player,legal)'));
assert.ok(engine.includes("if(this.botDelayMs===0)return 0"));
assert.ok(view.includes("const heroIndex=Math.max(0,this.players.findIndex"));
assert.ok(view.includes('POSITION ${hero.position'));
assert.ok(css.includes('.v1-room .v1-seat.hero-seat'));
assert.ok(css.includes('bottom:calc(5px + env(safe-area-inset-bottom))'));
assert.ok(css.includes('grid-template-columns:1fr 1.12fr 1.18fr'));

const players=['Hero','A','B','C','D','E'].map(nick=>({nick,type:'bot'}));
const g=new HoldemDemo({players,heroNick:'Nobody',stackBB:100,botDelayMs:0,eventPaceMs:0,levelSeconds:99999});
g.street='river';g.pot=5000;g.bb=100;
const p=g.players[1];p.position='BB';p.hole=['2s','3d'];p.stack=5000;p.bet=0;
const legal={toCall:2500,pot:5000,toCallBB:25,potBB:50,stackBB:50};
assert.equal(g.botThinkDelay(p,legal),0);
g.destroy();
console.log('V22_MOBILE_ROOM_OK');
